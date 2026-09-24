-- Un único horario por restaurante/día/turno — permite hacer upsert desde
-- Settings → Turnos sin duplicar filas.

alter table public.service_hours
  add constraint service_hours_restaurant_day_turno_key unique (restaurant_id, day_of_week, turno);
