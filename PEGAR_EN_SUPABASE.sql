-- Reservas App — esquema base
-- Restaurantes, ajustes, mesas, reservas, horarios de servicio y fechas especiales.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- restaurants
-- ---------------------------------------------------------------------------
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  address text,
  phone text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- restaurant_settings (1:1 con restaurants)
-- ---------------------------------------------------------------------------
create table public.restaurant_settings (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null unique references public.restaurants (id) on delete cascade,
  reservation_buffer_minutes int not null default 30,
  min_lead_time_minutes int not null default 60,
  max_advance_days int not null default 30,
  max_party_size int not null default 12,
  default_reservation_duration_minutes int not null default 90,
  default_view text not null default 'list' check (default_view in ('list', 'grid')),
  deposit_policy jsonb
);

-- ---------------------------------------------------------------------------
-- tables (mesas del restaurante)
-- ---------------------------------------------------------------------------
create table public.tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  number int not null,
  capacity int not null,
  shape text not null default 'round' check (shape in ('round', 'square', 'rectangular')),
  pos_x float not null default 0,
  pos_y float not null default 0,
  status_override text check (status_override in ('blocked', null)),
  unique (restaurant_id, number)
);

-- ---------------------------------------------------------------------------
-- reservations
-- ---------------------------------------------------------------------------
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  table_id uuid references public.tables (id) on delete set null,
  customer_name text not null,
  customer_phone text,
  party_size int not null,
  start_time timestamptz not null,
  duration_minutes int not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'no_show', 'seated')),
  source text not null default 'phone' check (source in ('web', 'phone', 'walk_in', 'whatsapp')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reservations_restaurant_start_idx on public.reservations (restaurant_id, start_time);
create index reservations_table_idx on public.reservations (table_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger reservations_set_updated_at
  before update on public.reservations
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- service_hours
-- ---------------------------------------------------------------------------
create table public.service_hours (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  turno text not null check (turno in ('lunch', 'dinner')),
  open_time time,
  close_time time,
  closed boolean not null default false
);

create index service_hours_restaurant_idx on public.service_hours (restaurant_id, day_of_week);

-- ---------------------------------------------------------------------------
-- special_dates
-- ---------------------------------------------------------------------------
create table public.special_dates (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  date date not null,
  type text not null check (type in ('closed', 'blocked')),
  note text
);

create index special_dates_restaurant_date_idx on public.special_dates (restaurant_id, date);

-- ---------------------------------------------------------------------------
-- users (extiende auth.users)
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  restaurant_id uuid references public.restaurants (id) on delete set null,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  name text,
  email text
);

create index users_restaurant_idx on public.users (restaurant_id);
-- Trigger: crea la fila public.users correspondiente cuando se crea un auth.users.
--
-- restaurant_id y role se leen de raw_user_meta_data si vienen informados
-- (p.ej. una invitación de staff creada por un admin, que pasa
-- { restaurant_id, role, name } al hacer signUp). Si no vienen, la fila
-- queda con restaurant_id null y role 'staff' por defecto; el flujo de
-- onboarding (fuera del alcance de este prompt) se encarga de asignar
-- restaurant_id al primer admin.

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

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
-- Row Level Security — regla base: nadie ve datos de otro restaurante.
--
-- Las funciones helper son security definer para poder consultar public.users
-- sin disparar de nuevo las políticas de esa misma tabla (evita recursión).

create or replace function public.current_restaurant_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select restaurant_id from public.users where id = auth.uid()
$$;

create or replace function public.current_user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.users where id = auth.uid()
$$;

alter table public.restaurants enable row level security;
alter table public.restaurant_settings enable row level security;
alter table public.tables enable row level security;
alter table public.reservations enable row level security;
alter table public.service_hours enable row level security;
alter table public.special_dates enable row level security;
alter table public.users enable row level security;

-- ---------------------------------------------------------------------------
-- restaurants
-- ---------------------------------------------------------------------------
create policy "restaurants_select_own" on public.restaurants
  for select
  using (id = public.current_restaurant_id());

create policy "restaurants_update_admin" on public.restaurants
  for update
  using (id = public.current_restaurant_id() and public.current_user_role() = 'admin')
  with check (id = public.current_restaurant_id() and public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- restaurant_settings — select admin+staff, insert/update/delete solo admin
-- ---------------------------------------------------------------------------
create policy "restaurant_settings_select" on public.restaurant_settings
  for select
  using (restaurant_id = public.current_restaurant_id());

create policy "restaurant_settings_insert_admin" on public.restaurant_settings
  for insert
  with check (restaurant_id = public.current_restaurant_id() and public.current_user_role() = 'admin');

create policy "restaurant_settings_update_admin" on public.restaurant_settings
  for update
  using (restaurant_id = public.current_restaurant_id() and public.current_user_role() = 'admin')
  with check (restaurant_id = public.current_restaurant_id() and public.current_user_role() = 'admin');

create policy "restaurant_settings_delete_admin" on public.restaurant_settings
  for delete
  using (restaurant_id = public.current_restaurant_id() and public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- tables — admin+staff select/insert/update, solo admin delete
-- ---------------------------------------------------------------------------
create policy "tables_select" on public.tables
  for select
  using (restaurant_id = public.current_restaurant_id());

create policy "tables_insert" on public.tables
  for insert
  with check (restaurant_id = public.current_restaurant_id());

create policy "tables_update" on public.tables
  for update
  using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

create policy "tables_delete_admin" on public.tables
  for delete
  using (restaurant_id = public.current_restaurant_id() and public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- reservations — admin+staff select/insert/update, solo admin delete
-- ---------------------------------------------------------------------------
create policy "reservations_select" on public.reservations
  for select
  using (restaurant_id = public.current_restaurant_id());

create policy "reservations_insert" on public.reservations
  for insert
  with check (restaurant_id = public.current_restaurant_id());

create policy "reservations_update" on public.reservations
  for update
  using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

create policy "reservations_delete_admin" on public.reservations
  for delete
  using (restaurant_id = public.current_restaurant_id() and public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- service_hours — select admin+staff, insert/update/delete solo admin
-- ---------------------------------------------------------------------------
create policy "service_hours_select" on public.service_hours
  for select
  using (restaurant_id = public.current_restaurant_id());

create policy "service_hours_insert_admin" on public.service_hours
  for insert
  with check (restaurant_id = public.current_restaurant_id() and public.current_user_role() = 'admin');

create policy "service_hours_update_admin" on public.service_hours
  for update
  using (restaurant_id = public.current_restaurant_id() and public.current_user_role() = 'admin')
  with check (restaurant_id = public.current_restaurant_id() and public.current_user_role() = 'admin');

create policy "service_hours_delete_admin" on public.service_hours
  for delete
  using (restaurant_id = public.current_restaurant_id() and public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- special_dates — select admin+staff, insert/update/delete solo admin
-- ---------------------------------------------------------------------------
create policy "special_dates_select" on public.special_dates
  for select
  using (restaurant_id = public.current_restaurant_id());

create policy "special_dates_insert_admin" on public.special_dates
  for insert
  with check (restaurant_id = public.current_restaurant_id() and public.current_user_role() = 'admin');

create policy "special_dates_update_admin" on public.special_dates
  for update
  using (restaurant_id = public.current_restaurant_id() and public.current_user_role() = 'admin')
  with check (restaurant_id = public.current_restaurant_id() and public.current_user_role() = 'admin');

create policy "special_dates_delete_admin" on public.special_dates
  for delete
  using (restaurant_id = public.current_restaurant_id() and public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- users — select admin+staff del mismo restaurante (o la propia fila, para
-- el onboarding antes de tener restaurant_id asignado); insert/update/delete
-- solo admin.
-- ---------------------------------------------------------------------------
create policy "users_select" on public.users
  for select
  using (id = auth.uid() or restaurant_id = public.current_restaurant_id());

create policy "users_insert_admin" on public.users
  for insert
  with check (restaurant_id = public.current_restaurant_id() and public.current_user_role() = 'admin');

-- with check permite dejar restaurant_id en null (acción "quitar del
-- restaurante" desde Settings → Usuarios) además de mantenerlo en el mismo
-- restaurante; using ya garantiza que solo se tocan filas del restaurante
-- del admin que hace el cambio.
create policy "users_update_admin" on public.users
  for update
  using (restaurant_id = public.current_restaurant_id() and public.current_user_role() = 'admin')
  with check (
    (restaurant_id = public.current_restaurant_id() or restaurant_id is null)
    and public.current_user_role() = 'admin'
  );

create policy "users_delete_admin" on public.users
  for delete
  using (restaurant_id = public.current_restaurant_id() and public.current_user_role() = 'admin');
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
-- Habilita Supabase Realtime (postgres_changes) para reservations — el plano
-- de Home y las notificaciones se actualizan solos sin refrescar la página.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reservations'
  ) then
    alter publication supabase_realtime add table public.reservations;
  end if;
end $$;
-- Bucket de Storage para el logo del restaurante (Settings → Perfil).
-- No estaba en el esquema del Prompt 0 (solo tablas de Postgres); se añade
-- aquí porque "logo (subida de imagen)" lo requiere y Storage es parte del
-- mismo proyecto Supabase, sin infraestructura nueva.

insert into storage.buckets (id, name, public)
values ('restaurant-logos', 'restaurant-logos', true)
on conflict (id) do nothing;

-- Los archivos se guardan como "<restaurant_id>/<archivo>" — así la política
-- solo permite tocar la carpeta del propio restaurante.

create policy "restaurant_logos_public_read" on storage.objects
  for select
  using (bucket_id = 'restaurant-logos');

create policy "restaurant_logos_admin_insert" on storage.objects
  for insert
  with check (
    bucket_id = 'restaurant-logos'
    and (storage.foldername(name))[1] = public.current_restaurant_id()::text
    and public.current_user_role() = 'admin'
  );

create policy "restaurant_logos_admin_update" on storage.objects
  for update
  using (
    bucket_id = 'restaurant-logos'
    and (storage.foldername(name))[1] = public.current_restaurant_id()::text
    and public.current_user_role() = 'admin'
  );

create policy "restaurant_logos_admin_delete" on storage.objects
  for delete
  using (
    bucket_id = 'restaurant-logos'
    and (storage.foldername(name))[1] = public.current_restaurant_id()::text
    and public.current_user_role() = 'admin'
  );
-- Plantillas/timing de notificaciones (Settings → Notificaciones). Mismo
-- patrón que deposit_policy: un jsonb de configuración, no relacional, no
-- necesita tabla propia.

alter table public.restaurant_settings
  add column if not exists notification_settings jsonb;
-- Un único horario por restaurante/día/turno — permite hacer upsert desde
-- Settings → Turnos sin duplicar filas.

alter table public.service_hours
  add constraint service_hours_restaurant_day_turno_key unique (restaurant_id, day_of_week, turno);
