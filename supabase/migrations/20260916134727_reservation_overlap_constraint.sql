-- Evita reservas solapadas en la misma mesa a nivel de base de datos.
--
-- Esto es la validación "de verdad": ni el drag&drop de la vista Rejilla ni
-- ninguna otra vía de escritura (API, script, cliente directo) puede saltarse
-- esto, a diferencia de una validación solo en el cliente.

create extension if not exists btree_gist;

-- timestamptz + interval es STABLE en Postgres (la aritmética de intervalos
-- puede depender de la zona horaria de la sesión), pero un índice GiST exige
-- expresiones IMMUTABLE. Sumar minutos a un instante concreto no depende en
-- la práctica del contexto de sesión, así que se envuelve en una función
-- declarada IMMUTABLE explícitamente — el workaround estándar para este caso.
create or replace function public.add_minutes(ts timestamptz, minutes int)
returns timestamptz
language sql
immutable
as $$
  select ts + (minutes * interval '1 minute')
$$;

alter table public.reservations
  add constraint reservations_no_table_overlap
  exclude using gist (
    table_id with =,
    tstzrange(start_time, public.add_minutes(start_time, duration_minutes)) with &&
  )
  where (table_id is not null and status in ('pending', 'confirmed', 'seated'));
