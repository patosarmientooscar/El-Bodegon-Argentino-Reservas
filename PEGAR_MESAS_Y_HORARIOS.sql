-- Mesas: 3x2 (redondas), 2x4 (cuadradas), 2x2 "altas" (cuadradas, para diferenciarlas)
insert into public.tables (restaurant_id, number, capacity, shape, pos_x, pos_y)
select r.id, v.number, v.capacity, v.shape, v.pos_x, v.pos_y
from public.restaurants r,
(values
  (1, 2, 'round',  15, 25),
  (2, 2, 'round',  35, 25),
  (3, 2, 'round',  55, 25),
  (4, 4, 'square', 25, 70),
  (5, 4, 'square', 60, 70),
  (6, 2, 'square', 80, 20),
  (7, 2, 'square', 90, 40)
) as v(number, capacity, shape, pos_x, pos_y)
where r.name = 'El Bodegón Argentino';

-- Turnos: solo cena, 20:30-23:30, cerrado martes y miércoles. Comida: cerrada todos los días.
insert into public.service_hours (restaurant_id, day_of_week, turno, open_time, close_time, closed)
select r.id, v.day_of_week, v.turno, v.open_time::time, v.close_time::time, v.closed
from public.restaurants r,
(values
  (0, 'dinner', '20:30', '23:30', false), -- domingo
  (1, 'dinner', '20:30', '23:30', false), -- lunes
  (2, 'dinner', null,    null,    true),  -- martes: cerrado
  (3, 'dinner', null,    null,    true),  -- miércoles: cerrado
  (4, 'dinner', '20:30', '23:30', false), -- jueves
  (5, 'dinner', '20:30', '23:30', false), -- viernes
  (6, 'dinner', '20:30', '23:30', false), -- sábado
  (0, 'lunch',  null,    null,    true),
  (1, 'lunch',  null,    null,    true),
  (2, 'lunch',  null,    null,    true),
  (3, 'lunch',  null,    null,    true),
  (4, 'lunch',  null,    null,    true),
  (5, 'lunch',  null,    null,    true),
  (6, 'lunch',  null,    null,    true)
) as v(day_of_week, turno, open_time, close_time, closed)
where r.name = 'El Bodegón Argentino'
on conflict (restaurant_id, day_of_week, turno) do update
set open_time = excluded.open_time, close_time = excluded.close_time, closed = excluded.closed;
