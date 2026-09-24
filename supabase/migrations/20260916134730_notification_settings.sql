-- Plantillas/timing de notificaciones (Settings → Notificaciones). Mismo
-- patrón que deposit_policy: un jsonb de configuración, no relacional, no
-- necesita tabla propia.

alter table public.restaurant_settings
  add column if not exists notification_settings jsonb;
