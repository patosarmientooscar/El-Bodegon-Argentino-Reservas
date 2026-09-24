-- ---------------------------------------------------------------------------
-- Asignación automática de mesa a cada reserva nueva.
--
-- Regla (la misma que pickBestAvailableTable en lib/reservations/overlap.ts):
-- la mesa libre más pequeña donde quepa el grupo (capacidad ≥ personas; a
-- igual capacidad, la de número más bajo), no bloqueada y sin otra reserva
-- activa que se solape. Si ninguna cabe, la reserva queda sin mesa.
--
-- Va en un trigger BEFORE INSERT, no dentro de cada función, para cubrir todas
-- las entradas (web pública, bot de WhatsApp, panel) sin reescribirlas —
-- incluidas funciones futuras que inserten con table_id null. No cambia el
-- estado: una reserva web sigue entrando como 'pending' (ahora con mesa).
-- Solo actúa en INSERT: si el staff quita la mesa después, no se reasigna.
-- ---------------------------------------------------------------------------

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
