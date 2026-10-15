-- =============================================================================
-- PEGAR EN SUPABASE → SQL Editor → New query → Run   (Fase 5 — Ajustes)
-- Pausa de reservas online, horario especial por día y permisos.
-- No lleva ningún secreto. Para deshacerlo: PEGAR_AJUSTES_DESHACER.sql
-- Copia exacta de supabase/migrations/20261020120000_ajustes_reservas_online.sql
-- =============================================================================

-- Fase 5 — Ajustes: pausa de reservas online, horario especial por día y permisos.
--
-- 1. restaurant_settings.online_paused_until: reservas online (web y WhatsApp) en pausa
--    hasta esa hora. null = activas. "Solo hoy" = mañana a las 00:00 (Madrid);
--    "hasta que la active" = año 2999.
-- 2. special_dates: nuevo tipo 'hours' con open_time/close_time = horario distinto ese día.
--    'closed' y 'blocked' siguen siendo día cerrado.
-- 3. Funciones públicas (web) y del bot v1: respetan la pausa y el horario especial.
--    El código del bot no cambia: ve los días en pausa como cerrados (closed_dates) y,
--    si aun así intenta reservar, recibe 'slot_unavailable' como cuando no hay mesa.
-- 4. Permisos: mesas solo las cambia un admin; cada uno solo quita/cambia sus avisos
--    (el admin, todos). Las cuentas nuevas solo entran en un restaurante si lo dice
--    app_metadata (lo pone el servidor), no los datos que manda quien se registra.
--
-- Solo añade o reemplaza. Deshacer: PEGAR_AJUSTES_DESHACER.sql.

-- ---------------------------------------------------------------------------
-- 1. Pausa
-- ---------------------------------------------------------------------------
alter table public.restaurant_settings
  add column if not exists online_paused_until timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Horario especial
-- ---------------------------------------------------------------------------
alter table public.special_dates
  add column if not exists open_time time,
  add column if not exists close_time time;

alter table public.special_dates drop constraint if exists special_dates_type_check;
alter table public.special_dates
  add constraint special_dates_type_check check (type in ('closed', 'blocked', 'hours'));

alter table public.special_dates drop constraint if exists special_dates_hours_check;
alter table public.special_dates
  add constraint special_dates_hours_check
  check (type <> 'hours' or (open_time is not null and close_time is not null and close_time > open_time));

create unique index if not exists special_dates_one_hours_per_day
  on public.special_dates (restaurant_id, date) where type = 'hours';

-- ---------------------------------------------------------------------------
-- 3a. Ayudantes (internos: no se exponen al público)
-- ---------------------------------------------------------------------------
create or replace function public.online_booking_paused(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select s.online_paused_until > now()
    from public.restaurant_settings s
    where s.restaurant_id = p_restaurant_id
  ), false);
$$;

-- Días (Madrid) que cubre la pausa, desde hoy. Como mucho 400 días.
create or replace function public.online_paused_dates(p_restaurant_id uuid)
returns setof date
language sql
stable
security definer
set search_path = public
as $$
  select g::date
  from public.restaurant_settings s,
       generate_series(
         (now() at time zone 'Europe/Madrid')::date,
         least(
           ((s.online_paused_until - interval '1 microsecond') at time zone 'Europe/Madrid')::date,
           (now() at time zone 'Europe/Madrid')::date + 400
         ),
         interval '1 day'
       ) g
  where s.restaurant_id = p_restaurant_id
    and s.online_paused_until > now();
$$;

revoke all on function public.online_booking_paused(uuid) from public, anon, authenticated;
revoke all on function public.online_paused_dates(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3b. Web: configuración pública (+ online_paused, special_hours)
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
    'online_paused', coalesce(s.online_paused_until > now(), false),
    'online_paused_until', case when s.online_paused_until > now() then s.online_paused_until end,
    'service_hours', coalesce((
      select jsonb_agg(jsonb_build_object(
        'day_of_week', h.day_of_week, 'turno', h.turno,
        'open_time', h.open_time, 'close_time', h.close_time, 'closed', h.closed
      ))
      from public.service_hours h
      where h.restaurant_id = r.id
    ), '[]'::jsonb),
    'closed_dates', coalesce((
      select jsonb_agg(distinct x.day)
      from (
        select d.date as day
        from public.special_dates d
        where d.restaurant_id = r.id
          and d.type in ('closed', 'blocked')
          and d.date >= (now() at time zone 'Europe/Madrid')::date
        union
        select p.day from public.online_paused_dates(r.id) as p(day)
      ) x
    ), '[]'::jsonb),
    'special_hours', coalesce((
      select jsonb_object_agg(d.date::text, jsonb_build_object('open_time', d.open_time, 'close_time', d.close_time))
      from public.special_dates d
      where d.restaurant_id = r.id
        and d.type = 'hours'
        and d.date >= (now() at time zone 'Europe/Madrid')::date
    ), '{}'::jsonb)
  )
  from public.restaurants r
  left join public.restaurant_settings s on s.restaurant_id = r.id
  where r.slug = p_slug
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 3c. Web: crear reserva (+ pausa y horario especial)
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
  v_has_tables boolean;
  v_table_id uuid;
  v_special_open time;
  v_special_close time;
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

  if public.online_booking_paused(v_restaurant_id) then
    return jsonb_build_object('error', 'online_paused');
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
    where d.restaurant_id = v_restaurant_id and d.date = v_local::date and d.type in ('closed', 'blocked')
  ) then
    return jsonb_build_object('error', 'closed_day');
  end if;

  select d.open_time, d.close_time
    into v_special_open, v_special_close
  from public.special_dates d
  where d.restaurant_id = v_restaurant_id and d.date = v_local::date and d.type = 'hours'
  limit 1;

  if v_special_open is not null then
    -- Ese día manda el horario especial, no el de la semana.
    if v_local::time not between v_special_open and v_special_close then
      return jsonb_build_object('error', 'outside_hours');
    end if;
  else
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
  end if;

  select exists (select 1 from public.tables t where t.restaurant_id = v_restaurant_id)
    into v_has_tables;

  if v_has_tables then
    v_table_id := public.public_booking_pick_table(v_restaurant_id, p_party_size, p_start_time, v_duration);
    if v_table_id is null then
      return jsonb_build_object('error', 'slot_unavailable');
    end if;
  end if;

  insert into public.reservations (
    restaurant_id, table_id, customer_name, customer_phone,
    party_size, start_time, duration_minutes, status, source
  )
  values (
    v_restaurant_id, v_table_id, trim(p_customer_name), p_customer_phone,
    p_party_size, p_start_time, v_duration, 'pending', 'web'
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'status', 'pending');
exception
  when exclusion_violation then
    -- otra persona se llevó esa mesa en el mismo instante
    return jsonb_build_object('error', 'slot_unavailable');
end;
$$;

-- ---------------------------------------------------------------------------
-- 3d. Bot v1: configuración (los días en pausa salen como cerrados)
-- ---------------------------------------------------------------------------
create or replace function public.bot_get_config(p_restaurant_name text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', r.id,
    'address', r.address,
    'phone', r.phone,
    'settings', (
      select jsonb_build_object(
        'max_party_size', s.max_party_size,
        'max_advance_days', s.max_advance_days,
        'default_reservation_duration_minutes', s.default_reservation_duration_minutes
      )
      from public.restaurant_settings s
      where s.restaurant_id = r.id
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
      select jsonb_agg(x.day)
      from (
        select d.date as day
        from public.special_dates d
        where d.restaurant_id = r.id
          and d.type in ('closed', 'blocked')
          and d.date >= (now() at time zone 'Europe/Madrid')::date
        union
        select p.day from public.online_paused_dates(r.id) as p(day)
      ) x
    ), '[]'::jsonb),
    'tables', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'number', t.number, 'capacity', t.capacity, 'status_override', t.status_override
      ))
      from public.tables t
      where t.restaurant_id = r.id
    ), '[]'::jsonb)
  )
  from public.restaurants r
  where r.name = p_restaurant_name
  order by
    exists (select 1 from public.users u where u.restaurant_id = r.id) desc,
    r.created_at
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 3e. Bot v1: crear reserva (+ pausa, día cerrado y horario especial)
-- ---------------------------------------------------------------------------
create or replace function public.bot_create_reservation(
  p_restaurant_id uuid,
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
  v_max_party int;
  v_duration int;
  v_table_id uuid;
  v_table_number int;
  v_status text;
  v_local timestamp;
  v_special_open time;
  v_special_close time;
  v_id uuid;
begin
  if not exists (select 1 from public.restaurants where id = p_restaurant_id) then
    return jsonb_build_object('error', 'restaurant_not_found');
  end if;

  -- En pausa: mismo código que "sin mesa", que el bot ya sabe explicar.
  if public.online_booking_paused(p_restaurant_id) then
    return jsonb_build_object('error', 'slot_unavailable');
  end if;

  select s.max_party_size, s.default_reservation_duration_minutes
    into v_max_party, v_duration
  from public.restaurant_settings s
  where s.restaurant_id = p_restaurant_id;

  v_max_party := coalesce(v_max_party, 12);
  v_duration := coalesce(v_duration, 90);

  if p_customer_name is null or length(trim(p_customer_name)) < 2 then
    return jsonb_build_object('error', 'invalid_name');
  end if;
  if p_party_size is null or p_party_size < 1 or p_party_size > v_max_party then
    return jsonb_build_object('error', 'invalid_party_size');
  end if;
  if p_start_time is null or p_start_time < now() then
    return jsonb_build_object('error', 'past_time');
  end if;

  v_local := p_start_time at time zone 'Europe/Madrid';

  if exists (
    select 1 from public.special_dates d
    where d.restaurant_id = p_restaurant_id and d.date = v_local::date and d.type in ('closed', 'blocked')
  ) then
    return jsonb_build_object('error', 'slot_unavailable');
  end if;

  select d.open_time, d.close_time
    into v_special_open, v_special_close
  from public.special_dates d
  where d.restaurant_id = p_restaurant_id and d.date = v_local::date and d.type = 'hours'
  limit 1;

  if v_special_open is not null and v_local::time not between v_special_open and v_special_close then
    return jsonb_build_object('error', 'slot_unavailable');
  end if;

  select t.id, t.number
    into v_table_id, v_table_number
  from public.tables t
  where t.restaurant_id = p_restaurant_id
    and t.capacity = p_party_size
    and t.status_override is distinct from 'blocked'
    and not exists (
      select 1
      from public.reservations r
      where r.table_id = t.id
        and r.status in ('pending', 'confirmed', 'seated')
        and tstzrange(r.start_time, public.add_minutes(r.start_time, r.duration_minutes))
            && tstzrange(p_start_time, public.add_minutes(p_start_time, v_duration))
    )
  order by t.number
  limit 1;

  v_status := case when v_table_id is null then 'pending' else 'confirmed' end;

  insert into public.reservations (
    restaurant_id, table_id, customer_name, customer_phone,
    party_size, start_time, duration_minutes, status, source
  )
  values (
    p_restaurant_id, v_table_id, trim(p_customer_name), p_customer_phone,
    p_party_size, p_start_time, v_duration, v_status, 'whatsapp'
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'status', v_status, 'table_number', v_table_number);
exception
  when exclusion_violation then
    -- otra reserva ocupó la misma mesa justo a la vez
    return jsonb_build_object('error', 'slot_unavailable');
end;
$$;

-- ---------------------------------------------------------------------------
-- 4a. Mesas: solo admin crea o cambia (antes también staff)
-- ---------------------------------------------------------------------------
drop policy if exists "tables_insert" on public.tables;
drop policy if exists "tables_insert_admin" on public.tables;
create policy "tables_insert_admin" on public.tables
  for insert
  with check (restaurant_id = public.current_restaurant_id() and public.current_user_role() = 'admin');

drop policy if exists "tables_update" on public.tables;
drop policy if exists "tables_update_admin" on public.tables;
create policy "tables_update_admin" on public.tables
  for update
  using (restaurant_id = public.current_restaurant_id() and public.current_user_role() = 'admin')
  with check (restaurant_id = public.current_restaurant_id() and public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- 4b. Avisos: cada uno cambia/quita los suyos; el admin, todos los del restaurante
-- ---------------------------------------------------------------------------
drop policy if exists "push_subscriptions_update" on public.push_subscriptions;
create policy "push_subscriptions_update" on public.push_subscriptions
  for update
  using (
    restaurant_id = public.current_restaurant_id()
    and (user_id = auth.uid() or public.current_user_role() = 'admin')
  )
  with check (user_id = auth.uid() and restaurant_id = public.current_restaurant_id());

drop policy if exists "push_subscriptions_delete" on public.push_subscriptions;
create policy "push_subscriptions_delete" on public.push_subscriptions
  for delete
  using (
    restaurant_id = public.current_restaurant_id()
    and (user_id = auth.uid() or public.current_user_role() = 'admin')
  );

-- ---------------------------------------------------------------------------
-- 4c. Cuentas nuevas: restaurante y rol solo desde app_metadata (lo pone el
--     servidor con la service role). Antes se leían de los datos que manda el
--     propio usuario al registrarse, y cualquiera podía colarse en un restaurante.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, restaurant_id, role, name, email)
  values (
    new.id,
    nullif(new.raw_app_meta_data ->> 'restaurant_id', '')::uuid,
    case when new.raw_app_meta_data ->> 'role' = 'admin' then 'admin' else 'staff' end,
    new.raw_user_meta_data ->> 'name',
    new.email
  );
  return new;
end;
$$;

-- Comprobación: debe salir una fila con "pausa = false" (o true si ya la activaste).
select r.name, public.online_booking_paused(r.id) as pausa
from public.restaurants r where r.slug = 'el-bodegon-argentino';
