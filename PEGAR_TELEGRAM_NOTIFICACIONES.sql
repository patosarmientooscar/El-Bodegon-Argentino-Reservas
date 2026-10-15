-- PEGAR EN SUPABASE → SQL Editor (una sola vez).
-- Avisos de reservas por Telegram (Fase 1). Antes de pegarlo:
--   1. Cambia PEGA_AQUI_RESERVATION_WEBHOOK_SECRET (al final) por el mismo
--      valor que pongas en Vercel como RESERVATION_WEBHOOK_SECRET.
--   2. Comprueba la URL del panel (al final).
-- Para deshacerlo: PEGAR_TELEGRAM_DESHACER.sql
-- Es una copia de supabase/migrations/20261015120000_telegram_notifications.sql
-- más la configuración del final.

-- Fase 1 — Avisos de reservas por Telegram.
--
-- Cada INSERT/UPDATE relevante de public.reservations se envía (pg_net, en
-- segundo plano) a POST /api/webhooks/reservation del panel, con un header
-- secreto. Es lo mismo que un "Database Webhook" del dashboard de Supabase,
-- pero con la URL y el secreto guardados en private.webhook_config en lugar de
-- escritos dentro del trigger.
--
-- pg_net es asíncrono: si el panel o Telegram fallan, la reserva se guarda igual.
--
-- Recordatorio: pg_cron revisa cada minuto las reservas que llevan más de
-- 15 min pendientes y reenvía el aviso UNA sola vez (pending_reminder_sent_at).
--
-- Solo añade objetos nuevos; deshacer con PEGAR_TELEGRAM_DESHACER.sql.

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
-- 2. Configuración privada: URL del endpoint y secreto (fuera de la API REST)
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.webhook_config (
  id boolean primary key default true check (id),
  endpoint_url text not null,
  secret text not null
);

-- ---------------------------------------------------------------------------
-- 3. Mensajes de Telegram enviados por reserva (para editarlos y quitar botones)
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
-- 4. Envío del evento al panel (nunca rompe la operación que lo dispara)
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
-- 5. Recordatorio de pendientes (> 15 min), una sola vez — pg_cron cada minuto
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

-- ---------------------------------------------------------------------------
-- 6. CONFIGURACIÓN — rellena el secreto antes de ejecutar
-- ---------------------------------------------------------------------------
insert into private.webhook_config (id, endpoint_url, secret)
values (
  true,
  'https://el-bodegon-argentino-reservas.vercel.app/api/webhooks/reservation',
  'PEGA_AQUI_RESERVATION_WEBHOOK_SECRET'
)
on conflict (id) do update
  set endpoint_url = excluded.endpoint_url,
      secret = excluded.secret;
