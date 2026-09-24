-- Disponibilidad real por mesas en la página pública de reservas.
--
-- Una hora solo se puede reservar si queda una mesa que cumpla todo esto:
--   * no está bloqueada,
--   * tiene capacidad >= personas (la más pequeña que sirva),
--   * está libre durante toda la duración de la reserva.
-- Ocupan mesa las reservas 'pending', 'confirmed' y 'seated'. Las que no
-- tienen mesa asignada (p. ej. de teléfono) también cuentan: se reparten
-- entre las mesas libres, de mayor a menor grupo, antes de mirar la nueva.
--
-- La reserva web se guarda CON mesa asignada (sigue en 'pending'). Así el
-- constraint reservations_no_table_overlap impide que dos personas que
-- reservan a la vez se lleven la misma mesa.
--
-- Nota: si el restaurante no tiene ninguna mesa creada, no se filtra por
-- mesas (solo por horario), como hasta ahora.

-- ---------------------------------------------------------------------------
-- Elige mesa (interna: no se expone al público)
-- ---------------------------------------------------------------------------
create or replace function public.public_booking_pick_table(
  p_restaurant_id uuid,
  p_party int,
  p_start timestamptz,
  p_duration int
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_end timestamptz := public.add_minutes(p_start, p_duration);
  v_ids uuid[];
  v_caps int[];
  v_item record;
  v_i int;
  v_placed boolean;
begin
  -- Mesas libres de reservas con mesa asignada, de menor a mayor capacidad.
  select array_agg(t.id order by t.capacity, t.number),
         array_agg(t.capacity order by t.capacity, t.number)
    into v_ids, v_caps
  from public.tables t
  where t.restaurant_id = p_restaurant_id
    and t.status_override is distinct from 'blocked'
    and not exists (
      select 1
      from public.reservations x
      where x.table_id = t.id
        and x.status in ('pending', 'confirmed', 'seated')
        and x.start_time < v_end
        and public.add_minutes(x.start_time, x.duration_minutes) > p_start
    );

  if v_ids is null then
    return null;
  end if;

  -- Reservas sin mesa que se solapan + la nueva, de mayor a menor grupo.
  -- Cada una se queda con la mesa libre más pequeña donde cabe.
  for v_item in
    select x.party_size as size, false as is_new
    from public.reservations x
    where x.restaurant_id = p_restaurant_id
      and x.table_id is null
      and x.status in ('pending', 'confirmed', 'seated')
      and x.start_time < v_end
      and public.add_minutes(x.start_time, x.duration_minutes) > p_start
    union all
    select p_party, true
    order by size desc, is_new
  loop
    v_placed := false;
    for v_i in 1 .. coalesce(array_length(v_ids, 1), 0) loop
      if v_caps[v_i] >= v_item.size then
        if v_item.is_new then
          return v_ids[v_i];
        end if;
        v_ids := v_ids[1 : v_i - 1] || v_ids[v_i + 1 :];
        v_caps := v_caps[1 : v_i - 1] || v_caps[v_i + 1 :];
        v_placed := true;
        exit;
      end if;
    end loop;
    if v_item.is_new and not v_placed then
      return null;
    end if;
  end loop;

  return null;
end;
$$;

revoke all on function public.public_booking_pick_table(uuid, int, timestamptz, int) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ocupación para pintar la disponibilidad (solo mesas y horarios; sin
-- nombres ni teléfonos). Rango máximo: 62 días.
-- ---------------------------------------------------------------------------
create or replace function public.public_booking_occupancy(p_slug text, p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'tables', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'number', t.number, 'capacity', t.capacity)
                       order by t.capacity, t.number)
      from public.tables t
      where t.restaurant_id = r.id
        and t.status_override is distinct from 'blocked'
    ), '[]'::jsonb),
    'busy', coalesce((
      select jsonb_agg(jsonb_build_object(
        'table_id', x.table_id,
        'party_size', x.party_size,
        'start_time', x.start_time,
        'duration_minutes', x.duration_minutes
      ))
      from public.reservations x
      where x.restaurant_id = r.id
        and x.status in ('pending', 'confirmed', 'seated')
        and x.start_time < least(p_to, p_from + interval '62 days')
        and public.add_minutes(x.start_time, x.duration_minutes) > p_from
    ), '[]'::jsonb)
  )
  from public.restaurants r
  where r.slug = p_slug
  limit 1;
$$;

revoke all on function public.public_booking_occupancy(text, timestamptz, timestamptz) from public;
grant execute on function public.public_booking_occupancy(text, timestamptz, timestamptz) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Crear reserva web: mismas validaciones que antes + mesa asignada.
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

revoke all on function public.public_booking_create(text, text, text, int, timestamptz) from public;
grant execute on function public.public_booking_create(text, text, text, int, timestamptz) to anon, authenticated, service_role;
