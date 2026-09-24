-- Abre el turno de comida de El Bodegón Argentino.
-- Horario de ejemplo: 13:00–16:00 los mismos días que abre la cena
-- (jueves a lunes; martes y miércoles sigue cerrado todo el día).
-- Cambia las horas o los días aquí antes de pegarlo, o después desde
-- el panel: Settings → Turnos.
-- Última franja reservable = cierre − 60 min → 13:00 … 15:00.

update public.service_hours h
set open_time = v.open_time::time,
    close_time = v.close_time::time,
    closed = v.closed
from public.restaurants r,
(values
  (0, '13:00', '16:00', false), -- domingo
  (1, '13:00', '16:00', false), -- lunes
  (2, null,    null,    true),  -- martes: cerrado
  (3, null,    null,    true),  -- miércoles: cerrado
  (4, '13:00', '16:00', false), -- jueves
  (5, '13:00', '16:00', false), -- viernes
  (6, '13:00', '16:00', false)  -- sábado
) as v(day_of_week, open_time, close_time, closed)
where h.restaurant_id = r.id
  and r.slug = 'el-bodegon-argentino'
  and h.turno = 'lunch'
  and h.day_of_week = v.day_of_week;

-- Comprobación: debe mostrar comida y cena por día.
select h.day_of_week, h.turno, h.open_time, h.close_time, h.closed
from public.service_hours h
join public.restaurants r on r.id = h.restaurant_id
where r.slug = 'el-bodegon-argentino'
order by h.day_of_week, h.turno;
