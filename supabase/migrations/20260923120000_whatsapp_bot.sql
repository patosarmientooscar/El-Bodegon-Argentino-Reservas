-- Bot de WhatsApp (carpeta Saas/chatbot): funciones para que el chatbot lea la
-- configuración del restaurante y cree reservas usando solo la clave pública
-- (publishable). El bot no inicia sesión, así que RLS no le deja tocar las
-- tablas directamente; estas funciones son security definer y exponen solo lo
-- necesario — nunca nombres ni teléfonos de otros clientes.

-- ---------------------------------------------------------------------------
-- Configuración: horarios, fechas cerradas, reglas y mesas
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
      select jsonb_agg(d.date)
      from public.special_dates d
      where d.restaurant_id = r.id
        and d.date >= (now() at time zone 'Europe/Madrid')::date
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
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Ocupación de mesas en un rango (solo mesa + horario, sin datos del cliente)
-- ---------------------------------------------------------------------------
create or replace function public.bot_busy_tables(p_restaurant_id uuid, p_from timestamptz, p_to timestamptz)
returns table (table_id uuid, start_time timestamptz, duration_minutes int)
language sql
stable
security definer
set search_path = public
as $$
  select r.table_id, r.start_time, r.duration_minutes
  from public.reservations r
  where r.restaurant_id = p_restaurant_id
    and r.table_id is not null
    and r.status in ('pending', 'confirmed', 'seated')
    and r.start_time < p_to
    and public.add_minutes(r.start_time, r.duration_minutes) > p_from;
$$;

-- ---------------------------------------------------------------------------
-- Crear reserva desde WhatsApp — misma regla que la opción "auto" de la app:
-- mesa de capacidad exacta, libre y no bloqueada → 'confirmed'; si no hay,
-- sin mesa y 'pending' para que el staff decida.
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
  v_id uuid;
begin
  if not exists (select 1 from public.restaurants where id = p_restaurant_id) then
    return jsonb_build_object('error', 'restaurant_not_found');
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

revoke all on function public.bot_get_config(text) from public;
revoke all on function public.bot_busy_tables(uuid, timestamptz, timestamptz) from public;
revoke all on function public.bot_create_reservation(uuid, text, text, int, timestamptz) from public;

grant execute on function public.bot_get_config(text) to anon, authenticated, service_role;
grant execute on function public.bot_busy_tables(uuid, timestamptz, timestamptz) to anon, authenticated, service_role;
grant execute on function public.bot_create_reservation(uuid, text, text, int, timestamptz) to anon, authenticated, service_role;
