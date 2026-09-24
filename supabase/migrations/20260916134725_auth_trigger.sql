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
