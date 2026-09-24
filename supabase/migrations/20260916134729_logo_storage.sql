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
