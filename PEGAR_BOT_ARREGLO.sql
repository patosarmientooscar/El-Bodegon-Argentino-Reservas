-- Bot de WhatsApp: si hay varios restaurantes con el mismo nombre, el bot usa
-- el que tiene usuarios del panel asignados (el que ve el staff en la app).

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

-- Diagnóstico: un restaurante por fila
select
  r.id,
  r.name,
  (select count(*) from public.users u where u.restaurant_id = r.id) as usuarios,
  (select count(*) from public.tables t where t.restaurant_id = r.id) as mesas,
  (select count(*) from public.reservations x where x.restaurant_id = r.id and x.source = 'whatsapp') as reservas_bot
from public.restaurants r
order by r.created_at;
