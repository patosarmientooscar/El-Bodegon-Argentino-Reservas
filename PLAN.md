# Plan — Mejoras del panel y notificaciones (El Bodegón Argentino)

Rama de trabajo: `mejoras-panel-notificaciones` (sale de `main` en `990bcf5`).
Producción: https://el-bodegon-argentino-reservas.vercel.app (Vercel despliega `main`).

## Cómo está montado (resumen)

- **Datos** (Supabase, `supabase/migrations/`): `restaurants` (con `slug`), `restaurant_settings`
  (1:1; `web_max_party_size` = 4), `tables` (plano), `reservations`, `service_hours`,
  `special_dates` y `users` (perfil enlazado a `auth.users`, rol admin/staff).
- **Reservas**: estados `pending · confirmed · cancelled · no_show · seated`;
  origen `web · phone · walk_in · whatsapp`. Un trigger asigna mesa al insertar.
- **Seguridad**: RLS en todas las tablas, filtrada por el restaurante del usuario. La web
  pública (`/r/[slug]` y `reservar.html`) y el bot usan funciones `security definer`
  con la clave pública, que nunca devuelven datos de otros clientes.
- **Panel**: Next.js 15 App Router; Home (plano + reservas del día con Realtime), Ajustes.
  Acceso directo opcional con `AUTO_LOGIN_EMAIL/PASSWORD` (sin pantalla de login).
- **Bot de WhatsApp** (carpeta `chatbot/`): en la base de datos está la versión 1
  (`bot_create_reservation`, `bot_busy_tables`). La v2 (`whatsapp_outbox`,
  `whatsapp_conversations`, `bot_v2_*`) **no está aplicada**.

⚠️ **Choque con las reglas de negocio:** `bot_create_reservation` (v1) guarda la reserva como
`confirmed` si encuentra mesa libre, en vez de `pending`. Las de la web sí entran como
pendientes. Pendiente de decidir (no se ha tocado).

## Fases

| Fase | Estado |
| --- | --- |
| 1. Avisos por Telegram | ✅ Código hecho y probado en local · ⏳ falta activarlo (pasos abajo) |
| 2. PWA + notificaciones push | Pendiente de OK |
| 3. Home "Hoy" mobile-first | Pendiente |
| 4. Login | Pendiente |
| 5. Ajustes | Pendiente |

## Fase 1 — Avisos por Telegram

### Cómo funciona
1. Un trigger en `reservations` (INSERT y UPDATE de estado, hora, personas, nombre,
   teléfono o notas) envía el evento con **pg_net** a `POST /api/webhooks/reservation`
   con el header `x-webhook-secret`. Es asíncrono: si el panel o Telegram fallan, la
   reserva se guarda igual.
2. **Nueva y pendiente** → mensaje a todos los `TELEGRAM_CHAT_IDS` con ✅ Aceptar / ❌ Rechazar.
   Nueva ya confirmada (p. ej. bot v1) → mismo mensaje sin botones.
3. Botón pulsado → Telegram llama a `POST /api/telegram/webhook` (header
   `X-Telegram-Bot-Api-Secret-Token`). Se comprueba que el chat está autorizado, se cambia
   el estado **solo si sigue pendiente** y se editan todos los mensajes:
   "✅ Aceptada por Nombre · 21:34". Rechazar = estado `cancelled`.
4. Si se decide **desde el panel**, los mensajes pierden los botones y muestran
   "✅ Confirmada desde el panel".
5. **Cambios** (hora, personas, datos, notas) y **cancelaciones** de reservas ya
   confirmadas → aviso sin botones con lo que ha cambiado. No avisa de sentar / no presentado.
6. **Recordatorio**: pg_cron cada minuto; si una reserva lleva > 15 min pendiente, reenvía
   el aviso con botones **una sola vez** (`pending_reminder_sent_at`).
7. Ajustes → Notificaciones → **Enviar notificación de prueba** (`POST /api/telegram/test`,
   solo con sesión).
8. Si alguien escribe `/start` al bot desde un chat no autorizado, el bot le responde con
   su `chat_id` para añadirlo.

### Archivos
- `supabase/migrations/20261015120000_telegram_notifications.sql` (+ `PEGAR_TELEGRAM_NOTIFICACIONES.sql`,
  `PEGAR_TELEGRAM_DESHACER.sql`)
- `app/api/webhooks/reservation/route.ts`, `app/api/telegram/webhook/route.ts`, `app/api/telegram/test/route.ts`
- `lib/notifications/telegram.ts`, `lib/supabase/admin.ts`
- `components/settings/notifications-tab.tsx` (tarjeta de prueba), `middleware.ts` (excluye webhooks)
- `scripts/telegram-setup.mjs` (`npm run telegram:setup`), `types/database.types.ts`, `.env.local.example`

### Variables de entorno (Vercel y `.env.local`, todas de servidor)
`SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_IDS`,
`TELEGRAM_WEBHOOK_SECRET`, `RESERVATION_WEBHOOK_SECRET`, `APP_URL`.

### Activación (en este orden)
1. Crear el bot con @BotFather → `TELEGRAM_BOT_TOKEN`.
2. Generar dos secretos largos → `TELEGRAM_WEBHOOK_SECRET`, `RESERVATION_WEBHOOK_SECRET`.
3. Copiar la service role key de Supabase → `SUPABASE_SERVICE_ROLE_KEY`.
4. Poner las variables en Vercel y desplegar (merge de la rama a `main`).
5. `npm run telegram:setup` (con las variables en `.env.local`).
6. Desde cada móvil/grupo, escribir `/start` al bot → anotar los `chat_id` →
   `TELEGRAM_CHAT_IDS` en Vercel → volver a desplegar.
7. Backup del esquema (ver abajo) y pegar `PEGAR_TELEGRAM_NOTIFICACIONES.sql` en el
   SQL Editor de Supabase con el secreto rellenado.
8. Ajustes → Notificaciones → "Enviar notificación de prueba". Después, una reserva de prueba en la web.

### Backup del esquema antes del SQL
Desde el ordenador (pide la contraseña de la base de datos, Supabase → Project Settings → Database):
`npx supabase db dump --db-url "postgresql://postgres:[CONTRASEÑA]@db.[PROYECTO].supabase.co:5432/postgres" -f backup-esquema-2026-10-15.sql`
El SQL de la Fase 1 solo **añade** objetos; `PEGAR_TELEGRAM_DESHACER.sql` lo quita todo.

### Probado
- En local con una API de Telegram simulada: secretos (401), nueva pendiente con botones,
  nueva confirmada sin botones, cambio de hora/personas, cancelación, recordatorio,
  decisiones sin aviso duplicado, sentar sin aviso, chat no autorizado, `/start`.
- `tsc`, `eslint` y `next build` sin errores.
- **Sin probar todavía** (necesita la service role y la base de datos real): guardar los
  mensajes, aceptar/rechazar de verdad y editar los mensajes.
