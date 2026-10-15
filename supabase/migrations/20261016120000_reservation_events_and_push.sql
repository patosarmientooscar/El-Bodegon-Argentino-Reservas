-- Avisos de reservas (Fase 2): notificaciones push al móvil.
--
-- 1. Cada INSERT/UPDATE relevante de public.reservations se envía (pg_net, en
--    segundo plano) a POST /api/webhooks/reservation del panel con un header
--    secreto. El panel decide a quién avisar (push; Telegram solo si se activa).
--    Es asíncrono: si el envío falla, la reserva se guarda igual.
-- 2. pg_cron revisa cada minuto las reservas que llevan más de 15 min
--    pendientes y reenvía el aviso UNA sola vez (pending_reminder_sent_at).
-- 3. push_subscriptions: un móvil/navegador por fila, con RLS por restaurante.
--
-- Solo añade objetos nuevos; deshacer con PEGAR_AVISOS_DESHACER.sql.

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- 1. Recordatorio enviado (una sola vez por reserva)
-- ---------------------------------------------------------------------------
alter table public.reservations
  add column if not exists pending_reminder_sent_at timestamptz;

-- Las pendientes que ya existen no deben disparar recordatorios al instalar.
update public.reservations
  set pending_reminder_sent_at = now()
  where status = 'pending' and pending_reminder_sent_at is null;

-- ---------------------------------------------------------------------------
-- 2. Suscripciones push (un dispositivo por fila)
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_restaurant_idx
  on public.push_subscriptions (restaurant_id);

alter table public.push_subscriptions enable row level security;

-- El equipo del restaurante ve y quita los dispositivos de su restaurante;
-- cada usuario solo da de alta los suyos.
drop policy if exists "push_subscriptions_select" on public.push_subscriptions;
create policy "push_subscriptions_select" on public.push_subscriptions
  for select
  using (restaurant_id = public.current_restaurant_id());

drop policy if exists "push_subscriptions_insert" on public.push_subscriptions;
create policy "push_subscriptions_insert" on public.push_subscriptions
  for insert
  with check (user_id = auth.uid() and restaurant_id = public.current_restaurant_id());

drop policy if exists "push_subscriptions_update" on public.push_subscriptions;
create policy "push_subscriptions_update" on public.push_subscriptions
  for update
  using (restaurant_id = public.current_restaurant_id())
  with check (user_id = auth.uid() and restaurant_id = public.current_restaurant_id());

drop policy if exists "push_subscriptions_delete" on public.push_subscriptions;
create policy "push_subscriptions_delete" on public.push_subscriptions
  for delete
  using (restaurant_id = public.current_restaurant_id());

-- ---------------------------------------------------------------------------
-- 3. Mensajes de Telegram (para el futuro: solo se usa si se activa el bot).
--    RLS sin políticas: solo el servidor (service role) puede leer/escribir.
-- ---------------------------------------------------------------------------
create table if not exists public.telegram_notifications (
  id bigint generated always as identity primary key,
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  chat_id bigint not null,
  message_id bigint not null,
  kind text not null check (kind in ('new', 'reminder')),
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists telegram_notifications_reservation_idx
  on public.telegram_notifications (reservation_id);

alter table public.telegram_notifications enable row level security;

-- ---------------------------------------------------------------------------
-- 4. Configuración privada: URL del endpoint y secreto (fuera de la API REST)
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.webhook_config (
  id boolean primary key default true check (id),
  endpoint_url text not null,
  secret text not null
);

-- ---------------------------------------------------------------------------
-- 5. Envío del evento al panel (nunca rompe la operación que lo dispara)
-- ---------------------------------------------------------------------------
create or replace function private.post_reservation_event(p_type text, p_record jsonb, p_old jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg private.webhook_config;
begin
  select * into cfg from private.webhook_config where id;
  if cfg.endpoint_url is null then
    return;
  end if;

  perform net.http_post(
    url := cfg.endpoint_url,
    body := jsonb_build_object(
      'type', p_type,
      'table', 'reservations',
      'record', p_record,
      'old_record', p_old
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', cfg.secret
    ),
    timeout_milliseconds := 5000
  );
exception when others then
  raise warning 'post_reservation_event (%): %', p_type, sqlerrm;
end;
$$;

create or replace function private.reservations_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform private.post_reservation_event('INSERT', to_jsonb(new), null);
  else
    perform private.post_reservation_event('UPDATE', to_jsonb(new), to_jsonb(old));
  end if;
  return null;
end;
$$;

drop trigger if exists reservations_notify_insert on public.reservations;
create trigger reservations_notify_insert
  after insert on public.reservations
  for each row
  execute function private.reservations_notify();

-- Solo cambios que importan al restaurante (no mesa asignada, updated_at ni
-- la marca del recordatorio).
drop trigger if exists reservations_notify_update on public.reservations;
create trigger reservations_notify_update
  after update on public.reservations
  for each row
  when (
    old.status is distinct from new.status
    or old.start_time is distinct from new.start_time
    or old.party_size is distinct from new.party_size
    or old.customer_name is distinct from new.customer_name
    or old.customer_phone is distinct from new.customer_phone
    or old.notes is distinct from new.notes
  )
  execute function private.reservations_notify();

-- ---------------------------------------------------------------------------
-- 6. Recordatorio de pendientes (> 15 min), una sola vez — pg_cron cada minuto
-- ---------------------------------------------------------------------------
create or replace function private.remind_pending_reservations()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    with marked as (
      update public.reservations
        set pending_reminder_sent_at = now()
        where status = 'pending'
          and pending_reminder_sent_at is null
          and created_at < now() - interval '15 minutes'
          and start_time > now()
        returning *
    )
    select * from marked
  loop
    perform private.post_reservation_event('REMINDER', to_jsonb(r), null);
  end loop;
end;
$$;

revoke all on function private.post_reservation_event(text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function private.reservations_notify() from public, anon, authenticated;
revoke all on function private.remind_pending_reservations() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'reservas-recordatorio-pendientes';
select cron.schedule(
  'reservas-recordatorio-pendientes',
  '* * * * *',
  $$ select private.remind_pending_reservations(); $$
);
