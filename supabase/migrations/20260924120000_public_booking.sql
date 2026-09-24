-- Página pública de reservas (/r/[slug]).
--
-- 1. restaurants.slug: identificador público en la URL (p.ej. el-bodegon-argentino).
-- 2. restaurant_settings.web_max_party_size: máximo de personas que se pueden
--    reservar desde la web pública (grupos mayores → llamar/WhatsApp). Es
--    distinto de max_party_size, que es el límite del panel y del bot.
-- 3. Funciones security definer para el visitante anónimo, mismo patrón que
--    bot_*: RLS sigue cerrando las tablas y estas funciones exponen solo lo
--    necesario de UN restaurante (el del slug) — nunca datos de clientes.

-- ---------------------------------------------------------------------------
-- 1. slug
-- ---------------------------------------------------------------------------
alter table public.restaurants
  add column if not exists slug text;

alter table public.restaurants
  add constraint restaurants_slug_key unique (slug);

alter table public.restaurants
  add constraint restaurants_slug_format check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- Si hay varios "El Bodegón Argentino", el slug va al que tiene usuarios del
-- panel (misma regla que bot_get_config).
update public.restaurants
set slug = 'el-bodegon-argentino'
where id = (
  select r.id
  from public.restaurants r
  where r.name = 'El Bodegón Argentino'
  order by
    exists (select 1 from public.users u where u.restaurant_id = r.id) desc,
    r.created_at
  limit 1
)
and not exists (select 1 from public.restaurants where slug = 'el-bodegon-argentino');

-- ---------------------------------------------------------------------------
-- 2. máximo de personas en la web pública
-- ---------------------------------------------------------------------------
alter table public.restaurant_settings
  add column if not exists web_max_party_size int not null default 4
  check (web_max_party_size between 1 and 50);

-- ---------------------------------------------------------------------------
-- 3a. Configuración pública (solo lo que la página necesita)
-- ---------------------------------------------------------------------------
create or replace function public.public_booking_get_config(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'name', r.name,
    'phone', r.phone,
    'address', r.address,
    'logo_url', r.logo_url,
    'settings', jsonb_build_object(
      'web_max_party_size', coalesce(s.web_max_party_size, 4),
      'max_advance_days', coalesce(s.max_advance_days, 30),
      'min_lead_time_minutes', coalesce(s.min_lead_time_minutes, 60),
      'duration_minutes', coalesce(s.default_reservation_duration_minutes, 90)
    ),
    'service_hours', coalesce((
      select jsonb_agg(jsonb_build_object(
        'day_of_week', h.day_of_week, 'turno', h.turno,
        'open_time', h.open_time, 'close_time', h.close_time, 'closed', h.closed
      ))
      from public.service_hours h
      where h.restaurant_id = r.id
    ), '[]'::jsonb),
    'closed_dates', coalesce((
      select jsonb_agg(distinct d.date)
      from public.special_dates d
      where d.restaurant_id = r.id
        and d.date >= (now() at time zone 'Europe/Madrid')::date
    ), '[]'::jsonb)
  )
  from public.restaurants r
  left join public.restaurant_settings s on s.restaurant_id = r.id
  where r.slug = p_slug
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 3b. Crear reserva desde la web pública.
--
-- La clave anónima es pública, así que alguien podría llamar a esta función
-- sin pasar por la página: por eso valida aquí lo imprescindible (personas,
-- futuro, antelación máxima, día cerrado, dentro del horario del turno). La
-- regla fina de franjas (cada 30 min, última franja antes del cierre) la
-- aplica el Server Action.
--
-- Siempre entra como 'pending' y sin mesa: el staff la confirma desde el panel.
-- ---------------------------------------------------------------------------
create or replace function public.public_booking_create(
  p_slug text,
  p_customer_name text,
  p_customer_phone text,
  p_party_size int,
  p_start_time timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_web_max int;
  v_max_advance int;
  v_duration int;
  v_local timestamp;
  v_has_hours boolean;
  v_id uuid;
begin
  select r.id,
         coalesce(s.web_max_party_size, 4),
         coalesce(s.max_advance_days, 30),
         coalesce(s.default_reservation_duration_minutes, 90)
    into v_restaurant_id, v_web_max, v_max_advance, v_duration
  from public.restaurants r
  left join public.restaurant_settings s on s.restaurant_id = r.id
  where r.slug = p_slug;

  if v_restaurant_id is null then
    return jsonb_build_object('error', 'restaurant_not_found');
  end if;

  if p_customer_name is null or length(trim(p_customer_name)) not between 2 and 80 then
    return jsonb_build_object('error', 'invalid_name');
  end if;
  if p_customer_phone is null or p_customer_phone !~ '^\+[0-9]{8,15}$' then
    return jsonb_build_object('error', 'invalid_phone');
  end if;
  if p_party_size is null or p_party_size < 1 or p_party_size > v_web_max then
    return jsonb_build_object('error', 'invalid_party_size');
  end if;
  if p_start_time is null or p_start_time <= now() then
    return jsonb_build_object('error', 'past_time');
  end if;

  v_local := p_start_time at time zone 'Europe/Madrid';

  if v_local::date > (now() at time zone 'Europe/Madrid')::date + v_max_advance then
    return jsonb_build_object('error', 'too_far');
  end if;

  if exists (
    select 1 from public.special_dates d
    where d.restaurant_id = v_restaurant_id and d.date = v_local::date
  ) then
    return jsonb_build_object('error', 'closed_day');
  end if;

  select exists (select 1 from public.service_hours h where h.restaurant_id = v_restaurant_id)
    into v_has_hours;

  if v_has_hours and not exists (
    select 1 from public.service_hours h
    where h.restaurant_id = v_restaurant_id
      and h.day_of_week = extract(dow from v_local)::int
      and not h.closed
      and h.open_time is not null
      and h.close_time is not null
      and v_local::time between h.open_time and h.close_time
  ) then
    return jsonb_build_object('error', 'outside_hours');
  end if;

  insert into public.reservations (
    restaurant_id, table_id, customer_name, customer_phone,
    party_size, start_time, duration_minutes, status, source
  )
  values (
    v_restaurant_id, null, trim(p_customer_name), p_customer_phone,
    p_party_size, p_start_time, v_duration, 'pending', 'web'
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'status', 'pending');
end;
$$;

revoke all on function public.public_booking_get_config(text) from public;
revoke all on function public.public_booking_create(text, text, text, int, timestamptz) from public;

grant execute on function public.public_booking_get_config(text) to anon, authenticated, service_role;
grant execute on function public.public_booking_create(text, text, text, int, timestamptz) to anon, authenticated, service_role;
