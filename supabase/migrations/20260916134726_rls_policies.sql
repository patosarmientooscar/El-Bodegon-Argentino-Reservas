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
