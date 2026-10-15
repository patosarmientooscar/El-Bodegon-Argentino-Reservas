# Plan — Mejoras del panel y notificaciones (El Bodegón Argentino)

Producción: https://el-bodegon-argentino-reservas.vercel.app (Vercel despliega `main`).
Ramas: `mejoras-panel-notificaciones` (Fase 1, ya en `main`) · `fase-2-push` (Fase 2, sin subir).

## Cómo está montado (resumen)

- **Datos** (Supabase, `supabase/migrations/`): `restaurants` (con `slug`), `restaurant_settings`
  (1:1; `web_max_party_size` = 4), `tables` (plano), `reservations`, `service_hours`,
  `special_dates` y `users` (perfil enlazado a `auth.users`, rol admin/staff).
- **Reservas**: estados `pending · confirmed · cancelled · no_show · seated`;
  origen `web · phone · walk_in · whatsapp`. Un trigger asigna mesa al insertar.
- **Seguridad**: RLS en todas las tablas, filtrada por el restaurante del usuario
  (`current_restaurant_id()`). La web pública y el bot usan funciones `security definer`
  con la clave pública, que nunca devuelven datos de otros clientes.
- **Panel**: Next.js 15 App Router; Home (plano + reservas del día con Realtime), Ajustes.
  Acceso directo opcional con `AUTO_LOGIN_EMAIL/PASSWORD` (sin pantalla de login).
- **Bot de WhatsApp** (carpeta `chatbot/`): en la base de datos está la versión 1
  (`bot_create_reservation`, `bot_busy_tables`). La v2 (`whatsapp_outbox`, `bot_v2_*`)
  **no está aplicada**.

⚠️ **Choque con las reglas de negocio:** `bot_create_reservation` (v1) guarda la reserva como
`confirmed` si encuentra mesa libre, en vez de `pending`. No se ha tocado (el bot queda fuera).

## Fases

| Fase | Estado |
| --- | --- |
| 1. Avisos por Telegram | Código en `main`, **apagado** (ver "Futuro / opcional") |
| 2. App en el móvil + notificaciones push | ✅ Hecha y probada en local (rama `fase-2-push`) · ⏳ falta activarla |
| 3. Home "Hoy" mobile-first | Pendiente |
| 4. Login | Pendiente (la fuente sale en Times y el color es el morado genérico) |
| 5. Ajustes | Pendiente |

## Sistema de avisos (común a todos los canales)

1. Un trigger en `reservations` (INSERT y UPDATE de estado, hora, personas, nombre,
   teléfono o notas) envía el evento con **pg_net** a `POST /api/webhooks/reservation`
   con el header `x-webhook-secret`. Asíncrono: si el envío falla, la reserva se guarda igual.
2. **pg_cron** cada minuto: si una reserva lleva > 15 min pendiente, reenvía el aviso
   **una sola vez** (`pending_reminder_sent_at`).
3. El endpoint reparte a los canales activos: **push** (si hay claves VAPID) y **Telegram**
   (solo si existe `TELEGRAM_BOT_TOKEN`). Un canal que falla no frena al otro.
4. No avisa de: aceptar/rechazar una pendiente (lo decide el propio restaurante),
   sentar ni "no se presentó".

SQL único: `PEGAR_AVISOS_RESERVAS.sql` (copia de
`supabase/migrations/20261016120000_reservation_events_and_push.sql` + configuración).
Deshacer: `PEGAR_AVISOS_DESHACER.sql`. Sustituye al SQL de Telegram, que nunca se aplicó.

## Fase 2 — App en el móvil + notificaciones push

### Qué hace
- **App instalable**: `app/manifest.ts` ("Reservas El Bodegón", modo standalone, colores
  carbón/latón, iconos en `public/icons/`), metadatos para iPhone en `app/layout.tsx`.
- **Service worker** `public/sw.js`: muestra la notificación; al tocarla abre la reserva en
  el panel (`/home?date=…&id=…`). En Android/escritorio las pendientes llevan
  **✅ Aceptar / ❌ Rechazar**, que llaman a `POST /api/reservations/[id]/decision` con la
  **sesión del usuario** (RLS; nunca la service role en el navegador). iPhone no muestra botones.
- **Avisos**: nueva pendiente ("Nueva reserva: Juan · 4 pers · sáb 18 oct 21:00", con botones),
  nueva ya confirmada (p. ej. WhatsApp, sin botones), cambios y cancelaciones (qué cambió),
  recordatorio único a los 15 min.
- **Tabla `push_subscriptions`** (usuario, restaurante, endpoint, claves, dispositivo, fecha)
  con RLS por restaurante. Las caducadas (404/410) se borran solas al enviar.
- **Ajustes → Notificaciones → "Avisos en el móvil"**: botón grande para activar; en iPhone
  sin instalar, pasos con dibujo (Compartir → Añadir a pantalla de inicio, iOS 16.4+);
  aviso si se bloquearon los permisos; lista de dispositivos con "Quitar"; botón de prueba
  (`POST /api/push/test`).
- Ajustes es solo para administradores: los móviles del personal (staff) aún no pueden
  activarse solos (ver Fase 5).

### Archivos
- SQL: `supabase/migrations/20261016120000_reservation_events_and_push.sql`,
  `PEGAR_AVISOS_RESERVAS.sql`, `PEGAR_AVISOS_DESHACER.sql`
- `app/manifest.ts`, `app/layout.tsx`, `public/sw.js`, `public/icons/*`,
  `components/dashboard/pwa-register.tsx`, `app/(dashboard)/layout.tsx`
- `lib/notifications/push.ts`, `lib/notifications/format.ts` (formato común),
  `lib/notifications/telegram.ts` (apagado sin token), `app/api/webhooks/reservation/route.ts`
- `app/api/push/test/route.ts`, `app/api/reservations/[id]/decision/route.ts`
- `components/settings/push-notifications-card.tsx`, `notifications-tab.tsx`,
  `settings-client.tsx`, `app/(dashboard)/settings/page.tsx`
- `middleware.ts`, `types/database.types.ts`, `package.json` (`web-push`, `npm run push:keys`),
  `.env.local.example`

### Variables de entorno (Vercel, todas de servidor)
`SUPABASE_SERVICE_ROLE_KEY`, `RESERVATION_WEBHOOK_SECRET`, `VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY` (y opcional `VAPID_SUBJECT`).

### Activación (en este orden)
1. `npm run push:keys` → copiar la clave pública y la privada.
2. Vercel → Settings → Environment Variables: las 4 variables de arriba → desplegar.
3. Supabase → SQL Editor: pegar `PEGAR_AVISOS_RESERVAS.sql` con el secreto rellenado.
4. En el móvil: instalar la app y activar los avisos en Ajustes → Notificaciones.
5. "Enviar notificación de prueba" y una reserva de prueba en la web.

### Probado (en local)
- Manifest e iconos servidos; service worker registrado.
- Push simulada con Chrome: pendiente con Aceptar/Rechazar, confirmada sin botones,
  icono, insignia y enlace a la reserva correctos.
- Endpoints: decisión sin sesión 401, id o valor no válidos 400; prueba sin sesión 401;
  webhook sin secreto 401.
- Sin service role el aviso registra el error y responde 200; con Telegram apagado no hay
  ni una línea de Telegram en los logs.
- Tarjeta de Ajustes en iPhone (instrucciones) y Android (botón activar).
- `tsc`, `eslint` y `next build` sin errores.
- **Sin probar todavía** (necesita las claves y la base de datos real): envío real a un
  móvil, Aceptar/Rechazar desde la notificación y borrado de caducadas.

## Futuro / opcional — Avisos por Telegram (apagado)

El código sigue en el proyecto pero no hace nada mientras no exista `TELEGRAM_BOT_TOKEN`
(sin errores ni logs). Ajustes no muestra nada de Telegram. La tabla
`telegram_notifications` ya va incluida en `PEGAR_AVISOS_RESERVAS.sql`.

Para activarlo:
1. @BotFather → `/newbot` → `TELEGRAM_BOT_TOKEN`.
2. Vercel: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` (texto largo aleatorio),
   `TELEGRAM_CHAT_IDS` (se rellena en el paso 4) y `APP_URL`.
3. `npm run telegram:setup` (con esas variables en `.env.local`).
4. Escribir `/start` al bot desde cada móvil/grupo → anotar los `chat_id` →
   `TELEGRAM_CHAT_IDS` → volver a desplegar.
5. Para el botón de prueba, volver a mostrar la tarjeta en Ajustes (`POST /api/telegram/test`).

Funciona así: nueva pendiente con ✅/❌ (solo chats autorizados; cambia el estado solo si
sigue pendiente y edita los mensajes "Aceptada por …"), cambios/cancelaciones sin botones,
recordatorio a los 15 min, y `/start` desde un chat no autorizado responde con su `chat_id`.
Archivos: `lib/notifications/telegram.ts`, `app/api/telegram/webhook/route.ts`,
`app/api/telegram/test/route.ts`, `scripts/telegram-setup.mjs`.

## Backup del esquema antes de pegar SQL
Desde el ordenador (pide la contraseña de la base de datos, Supabase → Project Settings → Database):
`npx supabase db dump --db-url "postgresql://postgres:[CONTRASEÑA]@db.[PROYECTO].supabase.co:5432/postgres" -f backup-esquema.sql`
El SQL de avisos solo **añade** objetos; `PEGAR_AVISOS_DESHACER.sql` lo quita todo.
