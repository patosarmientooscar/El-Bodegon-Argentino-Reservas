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
