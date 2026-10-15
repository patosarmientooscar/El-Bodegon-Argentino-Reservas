# Plan — Mejoras del panel y notificaciones (El Bodegón Argentino)

Producción: https://el-bodegon-argentino-reservas.vercel.app (Vercel despliega `main`).
Ramas: `mejoras-panel-notificaciones` (Fase 1) · `fase-2-push` y `fix-avisos-movil` (Fase 2), todas ya en `main` · `fase-3-hoy` (Fase 3), ya en `main` · `fase-4-login` (Fase 4), ya en `main` · `fase-5-ajustes` (Fase 5).

## Cómo está montado (resumen)

- **Datos** (Supabase, `supabase/migrations/`): `restaurants` (con `slug`), `restaurant_settings`
  (1:1; `web_max_party_size` = 4), `tables` (plano), `reservations`, `service_hours`,
  `special_dates` y `users` (perfil enlazado a `auth.users`, rol admin/staff).
- **Reservas**: estados `pending · confirmed · cancelled · no_show · seated`;
  origen `web · phone · walk_in · whatsapp`. Un trigger asigna mesa al insertar.
- **Seguridad**: RLS en todas las tablas, filtrada por el restaurante del usuario
  (`current_restaurant_id()`). La web pública y el bot usan funciones `security definer`
  con la clave pública, que nunca devuelven datos de otros clientes.
- **Panel**: Next.js 15 App Router; Hoy (`/home`), Reservas (`/reservations`), Ajustes. Tema carbón + latón.
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
| 2. App en el móvil + notificaciones push | ✅ En producción |
| 3. Home "Hoy" mobile-first | ✅ En producción |
| 4. Login | ✅ En producción (plantilla de email: necesita SMTP propio) |
| 5. Ajustes | ✅ Hecha · ⏳ pegar `PEGAR_AJUSTES.sql` en Supabase |

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

## Fase 3 — Pantalla "Hoy" (móvil primero)

### Qué hace
- **Hoy** (`/home`, `components/today/`): selector Hoy / Mañana / Elegir fecha (`?date=`);
  3 contadores (Pendientes —en ámbar si hay—, Confirmadas, Comensales); aviso si hay
  pendientes **otros días** con enlace al primero.
- **Lista**: primero las pendientes con **Aceptar** / **Rechazar** (pide confirmación); luego el
  resto por hora; canceladas y "no vino" plegadas al final. Tarjeta: hora grande, nombre,
  personas, mesa, estado (texto + icono + color), origen con icono, notas destacadas,
  **Llamar** (tel:) y **WhatsApp** (wa.me), **Ha llegado** (seated) y **No vino** (no_show).
  Tocar la tarjeta abre el detalle (el mismo que abre la notificación: `/home?date=…&id=…`).
- **Cambios al momento** (optimista): se ven antes de que conteste el servidor; si falla,
  vuelven atrás con aviso. Solo cambia si la reserva sigue en el estado que se ve
  (`.eq("status", anterior)`), por si otro móvil la tocó. Aviso con **Deshacer**.
- **Realtime**: entradas, cambios y cancelaciones aparecen solas (aviso en pantalla).
- **Plano** (`floor-plan.tsx`, `computeServiceTableStatus`): verde libre · ámbar reservada en
  las próximas 2 h o pendiente · rojo ocupada (solo si está "Ha llegado"). Número + icono en
  cada mesa y hora de llegada debajo; al tocarla, quién viene, a qué hora y cuántos. En móvil va
  debajo de la lista (enlace "Ver plano"); en ordenador, a la derecha. Solo para hoy.
- **Navegación móvil**: menú fijo abajo Hoy / Reservas / Ajustes con contador de pendientes
  (de hoy en adelante, Realtime, `pending-provider.tsx`). En ordenador, barra lateral con lo mismo.
- **Reservas** (`/reservations`): la lista/rejilla con filtros que antes iba debajo de Home.
- **Personal (staff)**: Ajustes muestra solo "Avisos en el móvil" (RLS de `push_subscriptions`
  ya lo permitía).
- **Tema**: colores de El Bodegón solo en el panel (`[data-panel-theme]` en `globals.css`);
  login y reserva pública sin cambios. Zonas táctiles ≥ 44 px, texto principal ≥ 16 px,
  zona segura del iPhone (`viewportFit: "cover"`).
- Sin cambios de base de datos. Se quitaron `home-client`, `kpi-card`, `next-arrivals`,
  `notifications-bell` y `lib/reservations/kpis.ts` (sustituidos por la pantalla nueva).

### Probado (en local, con datos de ejemplo y Supabase simulado; sin tocar la base real)
- 375 px y 1440 px: sin scroll lateral, ningún botón < 44 px, menú de abajo solo en móvil.
- Aceptar se ve al instante; con la red fallando vuelve atrás y avisa; Rechazar pide confirmación.
- Realtime: reserva nueva aparece sola en pendientes; cancelación desde otro móvil la quita.
- Plano, detalle, vacío, Reservas (lista/rejilla), Ajustes (admin y staff) con el tema nuevo.
- `tsc`, `eslint` y `next build` sin errores.
- **Falta en real** (necesita la sesión del panel): aceptar/rechazar con datos reales y ver
  el contador de la pestaña con Realtime real.

## Fase 4 — Login con la marca y cómodo en el móvil

### Qué hace
- **Letra**: `--font-sans` en `globals.css` se apuntaba a sí misma (`var(--font-sans)`) y todo
  caía en Times. Ahora apunta a Geist (`--font-geist-sans`) en toda la app. La reserva pública
  sigue con sus fuentes (Montserrat/Playfair).
- **Login** (`app/login`, `components/auth/`): "B" dorada + "El Bodegón Argentino", "Panel de
  reservas", colores del panel, "Hecho por Evimes". Campos y botón de 48 px con texto de 16 px
  (el iPhone no hace zoom), `autocomplete`/`inputmode` para que el móvil rellene solo, ojo para
  ver la contraseña, botón "Entrando…" bloqueado, errores en español (`lib/auth/errors.ts`).
- **Sesión**: ya duraba. Las cookies de `@supabase/ssr` duran 400 días y el middleware renueva la
  sesión en cada visita; el token de refresco de Supabase no caduca salvo que se active
  "Time-box"/"Inactivity timeout" (no está). Con sesión, `/login` lleva a "Hoy". Sin sesión, el
  panel manda a `/login?next=…` y, al entrar, vuelve a donde iba (p. ej. la reserva de un aviso).
  Cuenta sin restaurante: aviso claro en vez de un bucle de redirecciones.
- **"Mantener la sesión iniciada": no se ha puesto**. La sesión ya se mantiene siempre; desmarcarla
  obligaría a reescribir cómo se guardan las cookies en el navegador, el servidor y el
  middleware, y en la app instalada del iPhone una cookie "de sesión" se borra al cerrar la app.
  Para salir basta "Cerrar sesión".
- **¿Has olvidado la contraseña?** (`/recuperar` → email → `/auth/confirm` → `/nueva-contrasena`).
  Mismo mensaje exista o no la cuenta. La plantilla en español y con la marca está en
  `supabase/email-templates/recuperar-contrasena.html`; usa `token_hash`, así el enlace funciona
  aunque se abra en otro navegador. (No hay Resend en el proyecto: el email sale de Supabase.)
- Nota: en el iPhone, la app instalada guarda su sesión aparte de Safari: hay que entrar una vez
  dentro de la app.

### Configurar en Supabase (una vez)
1. Authentication → URL Configuration: **Site URL** = `https://el-bodegon-argentino-reservas.vercel.app`;
   en **Redirect URLs** añadir `https://el-bodegon-argentino-reservas.vercel.app/**`.
2. Authentication → Emails → **Reset Password**: asunto "Cambia tu contraseña · El Bodegón
   Argentino" y pegar el HTML de `supabase/email-templates/recuperar-contrasena.html`.
3. Límite: el correo integrado de Supabase envía pocos emails por hora y **solo a emails del
   equipo del proyecto de Supabase**. Para el personal hace falta un SMTP propio
   (Authentication → Emails → SMTP Settings; p. ej. Resend) — pendiente de decidir.

### Probado (en local, sin sesión real ni emails reales)
- 375 px y 1440 px; letra Geist (antes Times); campos 48 px y 16 px; atributos de autocompletar.
- Ojo, "Entrando…" bloqueado, "Email o contraseña incorrectos." (intento real fallido),
  "Sin conexión…", cuenta sin restaurante, `/home?…` sin sesión → `/login?next=…`.
- Recuperar (envío simulado): mensaje de enviado, `redirect_to` correcto; enlace falso →
  "Ese enlace ha caducado…"; `/nueva-contrasena` sin enlace → "Enlace caducado".
- `tsc`, `eslint`, `next build` sin errores.
- **Falta en real**: entrar con tu cuenta y recibir el email de recuperación.

## Fase 5 — Ajustes (sin tocar código)

### Qué hace (solo admin; staff solo ve "Avisos en el móvil")
Ajustes tiene ahora estas secciones (en móvil, fila de botones deslizable; `?tab=` abre una):
- **Reservas online** (`online-tab.tsx`): interruptor grande Activadas / En pausa, con "Solo hoy"
  (se reactiva sola a las 00:00 de Madrid) o "Hasta que las vuelva a activar". Reglas: máximo
  de personas online (`web_max_party_size`), teléfono del restaurante (`restaurants.phone`, el que
  ven los grupos grandes), antelación mínima y máxima, duración media (ya la usaban la web, el bot
  y el cálculo de mesas) y máximo para WhatsApp/panel (`max_party_size`). Vista previa del texto
  "Para más de N personas, llámanos al …".
- **Horarios** (`hours-tab.tsx`): cada día, comida y cena con interruptor y horas; valida horas.
- **Días especiales** (`blocks-tab.tsx`): "Cerrado todo el día" u "Horario especial" (desde/hasta),
  lista de próximos con borrar.
- **Equipo** (`users-tab.tsx`, `app/api/team/route.ts`): lista con rol; "Dar acceso" crea la cuenta
  como staff con contraseña provisional (service role solo en el servidor, comprobando que quien
  lo pide es admin) y se la pasas tú; sin email, porque el correo de Supabase sin SMTP propio no
  llega al personal. "Quitar" le saca del restaurante y borra sus avisos del móvil.
- **Avisos** (Fase 2, sin cambios), **Mesas** y **Perfil** como estaban. "Reglas" desaparece: sus
  campos útiles están en Reservas online (buffer y depósito no los usaba nada).
- Cada sección: "Guardar" → "Guardado ✓" y errores claros en español (`save-bar.tsx`).
- **Hoy**: aviso "Reservas online en pausa…" con enlace a Ajustes.
- **Web** (`/r/…` y la web estática `reservas page/`): mensaje "Ahora mismo no aceptamos reservas
  online, llámanos al …", horario especial por día y teléfono de Ajustes (si está vacío, el de
  siempre). Copia de los archivos estáticos anteriores en `reservas page/backups/antes-fase5-ajustes/`.

### Base de datos — `PEGAR_AJUSTES.sql` (deshacer: `PEGAR_AJUSTES_DESHACER.sql`)
Copia de `supabase/migrations/20261020120000_ajustes_reservas_online.sql`. Sin secretos.
- `restaurant_settings.online_paused_until`; `special_dates.open_time/close_time` y tipo `hours`.
- `online_booking_paused()` y `online_paused_dates()` (internas).
- `public_booking_get_config` (+ `online_paused`, `special_hours`; días en pausa en `closed_dates`),
  `public_booking_create` (error `online_paused`, horario especial).
- **Bot v1 sin tocar su código**: `bot_get_config` añade los días en pausa a `closed_dates` (el bot
  dice que ese día está cerrado) y `bot_create_reservation` devuelve `slot_unavailable` si está
  en pausa, el día está cerrado o la hora cae fuera del horario especial. Límite: el bot no conoce
  el horario especial, así que puede proponer horas de su horario normal ese día y luego decir
  que no hay hueco; y no puede decir "llámanos" porque ese texto está en su código.
- Permisos (RLS): mesas solo admin; avisos: cada uno los suyos (admin, todos). Los demás ajustes
  ya eran solo admin.
- **Seguridad**: `handle_new_user` ya no acepta el restaurante/rol que mande quien se registra
  (`raw_user_meta_data`); solo `raw_app_meta_data`, que pone el servidor.
- **Sin el SQL** la app funciona como antes: Ajustes muestra "Falta activar esta opción" en la
  pausa y el horario especial; web, bot, Hoy y login no cambian.

### Probado
- Ajustes con Supabase simulado (375 px y 1280 px): pausa hoy (00:00 Madrid), reactivar, reglas y
  teléfono, error de permiso en español, horarios (validación + 14 filas), día especial, borrar,
  dar acceso, quitar acceso (+ borra avisos), "Falta activar" sin SQL, aviso en Hoy.
- Web estática con la config real (igual que antes) y simulada: pausa, teléfono de Ajustes,
  horario especial. `/r/…` con datos reales. `/api/team` sin sesión → 401.
- SQL: sintaxis comprobada con el parser oficial de PostgreSQL (libpg-query); no se ha podido
  ejecutar contra la base real (lo pega el dueño).
- `tsc`, `eslint`, `next build` sin errores.

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
