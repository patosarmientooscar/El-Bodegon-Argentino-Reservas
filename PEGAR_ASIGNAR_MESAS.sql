-- Pegar en Supabase → SQL Editor. Hace tres cosas, en este orden:
--   1. Corrige la capacidad de las mesas de El Bodegón Argentino según su forma:
--      cuadradas = 2 personas, redondas (altas) = 3, rectangulares = 4.
--   2. Instala la asignación automática de mesa en cada reserva nueva
--      (copia de supabase/migrations/20260925130000_auto_assign_tables.sql).
--   3. Asigna mesa a las reservas futuras activas que aún no tienen.

-- 1. Capacidades por forma ---------------------------------------------------
update public.tables t
set capacity = case t.shape
                 when 'square' then 2
                 when 'round' then 3
                 when 'rectangular' then 4
               end
from public.restaurants r
where t.restaurant_id = r.id
  and r.slug = 'el-bodegon-argentino';

-- 2. Asignación automática ---------------------------------------------------
create or replace function public.pick_free_table(
  p_restaurant_id uuid,
  p_party_size int,
  p_start_time timestamptz,
  p_duration_minutes int,
  p_exclude uuid default null
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.id
  from public.tables t
  where t.restaurant_id = p_restaurant_id
    and t.capacity >= p_party_size
    and t.status_override is distinct from 'blocked'
    and not exists (
      select 1
      from public.reservations r
      where r.table_id = t.id
        and r.status in ('pending', 'confirmed', 'seated')
        and (p_exclude is null or r.id <> p_exclude)
        and tstzrange(r.start_time, public.add_minutes(r.start_time, r.duration_minutes))
            && tstzrange(p_start_time, public.add_minutes(p_start_time, p_duration_minutes))
    )
  order by t.capacity, t.number
  limit 1;
$$;

create or replace function public.reservations_auto_assign_table()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.table_id is not null or new.status not in ('pending', 'confirmed', 'seated') then
    return new;
  end if;

  -- Serializa las asignaciones por restaurante para que dos reservas
  -- simultáneas no elijan la misma mesa (misma clave que reservation_lock
  -- de la propuesta del bot v2, así ambos bloqueos se respetan).
  perform pg_advisory_xact_lock(hashtextextended('reservations:' || new.restaurant_id::text, 0));

  new.table_id := public.pick_free_table(
    new.restaurant_id, new.party_size, new.start_time, new.duration_minutes, new.id
  );
  return new;
end;
$$;

drop trigger if exists reservations_auto_assign_table on public.reservations;
create trigger reservations_auto_assign_table
  before insert on public.reservations
  for each row execute function public.reservations_auto_assign_table();

revoke all on function public.pick_free_table(uuid, int, timestamptz, int, uuid) from public, anon, authenticated;
revoke all on function public.reservations_auto_assign_table() from public, anon, authenticated;

-- 3. Asignar mesa a las reservas futuras sin mesa ----------------------------
-- Por orden de llegada; los grupos grandes primero a igual hora.
do $$
declare
  rec record;
begin
  for rec in
    select res.id, res.restaurant_id, res.party_size, res.start_time, res.duration_minutes
    from public.reservations res
    join public.restaurants r on r.id = res.restaurant_id
    where r.slug = 'el-bodegon-argentino'
      and res.table_id is null
      and res.status in ('pending', 'confirmed', 'seated')
      and res.start_time >= now()
    order by res.start_time, res.party_size desc
  loop
    update public.reservations
    set table_id = public.pick_free_table(
      rec.restaurant_id, rec.party_size, rec.start_time, rec.duration_minutes, rec.id
    )
    where id = rec.id;
  end loop;
end;
$$;

-- Comprobación: mesas con su nueva capacidad y reservas futuras aún sin mesa.
select t.number, t.shape, t.capacity
from public.tables t
join public.restaurants r on r.id = t.restaurant_id
where r.slug = 'el-bodegon-argentino'
order by t.number;

select res.start_time, res.customer_name, res.party_size, res.status
from public.reservations res
join public.restaurants r on r.id = res.restaurant_id
where r.slug = 'el-bodegon-argentino'
  and res.table_id is null
  and res.status in ('pending', 'confirmed', 'seated')
  and res.start_time >= now()
order by res.start_time;
