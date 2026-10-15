-- PEGAR EN SUPABASE → SQL Editor para QUITAR los avisos por Telegram.
-- Deja la base de datos como estaba antes de PEGAR_TELEGRAM_NOTIFICACIONES.sql.

select cron.unschedule(jobid) from cron.job where jobname = 'reservas-recordatorio-pendientes';

drop trigger if exists reservations_notify_insert on public.reservations;
drop trigger if exists reservations_notify_update on public.reservations;

drop function if exists private.remind_pending_reservations();
drop function if exists private.reservations_notify();
drop function if exists private.post_reservation_event(text, jsonb, jsonb);

drop table if exists public.telegram_notifications;
drop table if exists private.webhook_config;

alter table public.reservations drop column if exists pending_reminder_sent_at;
-- El esquema "private" y las extensiones pg_net / pg_cron se dejan instaladas
-- (no molestan y Supabase las usa para otras cosas).
