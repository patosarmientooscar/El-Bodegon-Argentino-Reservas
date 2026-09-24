-- Corrige capacidad/forma: las mesas 6 y 7 pasan a ser las de 4 (cuadradas),
-- las 4 y 5 pasan a ser de 2, y la mesa 3 pasa de redonda a cuadrada
-- (dejando solo la 1 y la 2 como redondas).
update public.tables t
set capacity = v.capacity, shape = v.shape
from public.restaurants r,
(values
  (3, 2, 'square'),
  (4, 2, 'square'),
  (5, 2, 'square'),
  (6, 4, 'square'),
  (7, 4, 'square')
) as v(number, capacity, shape)
where t.restaurant_id = r.id
  and r.name = 'El Bodegón Argentino'
  and t.number = v.number;
