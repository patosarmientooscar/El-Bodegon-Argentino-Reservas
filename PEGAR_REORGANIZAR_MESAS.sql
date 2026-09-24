-- Reposiciona las 7 mesas ya creadas para agruparlas como en la foto de
-- referencia: 2 mesas juntas contra la pared izquierda, una fila de 3 en
-- medio, y 2 mesas separadas a la derecha. No cambia forma/capacidad.
update public.tables t
set pos_x = v.pos_x, pos_y = v.pos_y
from public.restaurants r,
(values
  (1, 10, 38),  -- mesa 1: pared izquierda, arriba
  (2, 10, 62),  -- mesa 2: pared izquierda, abajo
  (3, 27, 62),  -- mesa 3: fila del medio
  (4, 42, 62),  -- mesa 4: fila del medio
  (5, 55, 62),  -- mesa 5: fila del medio
  (6, 78, 72),  -- mesa 6: zona derecha
  (7, 91, 72)   -- mesa 7: zona derecha
) as v(number, pos_x, pos_y)
where t.restaurant_id = r.id
  and r.name = 'El Bodegón Argentino'
  and t.number = v.number;
