-- =============================================================================
-- DESHACER la Fase 5 (PEGAR_AJUSTES.sql). Supabase → SQL Editor → Run.
-- Devuelve las funciones y permisos a como estaban. OJO: borra los horarios
-- especiales (tipo "hours") que se hayan creado; los días cerrados se quedan.
-- =============================================================================

-- Funciones como estaban antes
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
  order by
    exists (select 1 from public.users u where u.restaurant_id = r.id) desc,
    r.created_at
  limit 1;
$$;

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
    nullif(new.raw_user_meta_data ->> 'restaurant_id', '')::uuid,
    coalesce(new.raw_user_meta_data ->> 'role', 'staff'),
    new.raw_user_meta_data ->> 'name',
    new.email
  );
  return new;
end;
$$;

-- Permisos de mesas como estaban (admin y staff)
drop policy if exists "tables_insert_admin" on public.tables;
drop policy if exists "tables_update_admin" on public.tables;
drop policy if exists "tables_insert" on public.tables;
drop policy if exists "tables_update" on public.tables;
create policy "tables_insert" on public.tables
  for insert
  with check (restaurant_id = public.current_restaurant_id());
create policy "tables_update" on public.tables
  for update
  using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

-- Permisos de avisos como estaban
drop policy if exists "push_subscriptions_update" on public.push_subscriptions;
create policy "push_subscriptions_update" on public.push_subscriptions
  for update
  using (restaurant_id = public.current_restaurant_id())
  with check (user_id = auth.uid() and restaurant_id = public.current_restaurant_id());
drop policy if exists "push_subscriptions_delete" on public.push_subscriptions;
create policy "push_subscriptions_delete" on public.push_subscriptions
  for delete
  using (restaurant_id = public.current_restaurant_id());

-- Ayudantes y columnas nuevas
drop function if exists public.online_paused_dates(uuid);
drop function if exists public.online_booking_paused(uuid);

delete from public.special_dates where type = 'hours';
drop index if exists public.special_dates_one_hours_per_day;
alter table public.special_dates drop constraint if exists special_dates_hours_check;
alter table public.special_dates drop constraint if exists special_dates_type_check;
alter table public.special_dates
  add constraint special_dates_type_check check (type in ('closed', 'blocked'));
alter table public.special_dates drop column if exists open_time, drop column if exists close_time;

alter table public.restaurant_settings drop column if exists online_paused_until;
