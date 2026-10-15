import webpush from "web-push";

import { createAdminClient } from "@/lib/supabase/admin";
import { changeList, formatDate, formatTime, isoDay, sourceLabel } from "@/lib/notifications/format";
import type { ReservationRow } from "@/lib/reservations/status";

/**
 * Notificaciones push al móvil (Fase 2). Se activan con VAPID_PUBLIC_KEY y
 * VAPID_PRIVATE_KEY; sin ellas no envían nada. Nunca lanzan: si el envío falla
 * se registra y se sigue. Las suscripciones caducadas (404/410) se borran.
 */

/** Lo que recibe public/sw.js en el evento "push". */
export type PushPayload = {
  title: string;
  body: string;
  /** Página del panel que se abre al tocar la notificación. */
  url: string;
  /** Misma etiqueta = la notificación nueva sustituye a la anterior de esa reserva. */
  tag: string;
  reservationId?: string;
  /** true: botones Aceptar / Rechazar (Android y escritorio; iPhone no los muestra). */
  decision?: boolean;
};

export function pushEnabled(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let vapidReady = false;
function setupVapid() {
  if (vapidReady) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:elbodegonargentino.es@gmail.com",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  vapidReady = true;
}

/** Envía a todos los dispositivos del restaurante. Devuelve cuántos lo recibieron. */
export async function sendPushToRestaurant(restaurantId: string, payload: PushPayload): Promise<{ sent: number; total: number }> {
  if (!pushEnabled()) return { sent: 0, total: 0 };
  setupVapid();

  const admin = createAdminClient();
  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("restaurant_id", restaurantId);
  if (error) {
    console.error("[push] leer suscripciones:", error.message);
    return { sent: 0, total: 0 };
  }

  let sent = 0;
  const expired: string[] = [];
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60, urgency: "high" },
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) expired.push(s.id);
        else console.error("[push] envío fallido:", status ?? err);
      }
    }),
  );

  if (expired.length) {
    const { error: delError } = await admin.from("push_subscriptions").delete().in("id", expired);
    if (delError) console.error("[push] borrar caducadas:", delError.message);
  }
  return { sent, total: subs?.length ?? 0 };
}

function shortLine(r: ReservationRow): string {
  return `${r.customer_name} · ${r.party_size} pers · ${formatDate(r.start_time)} ${formatTime(r.start_time)}`;
}

function panelUrl(r: ReservationRow): string {
  return `/home?date=${isoDay(r.start_time)}&id=${r.id}`;
}

export function newReservationPush(r: ReservationRow, reminder = false): PushPayload {
  const pending = r.status === "pending";
  const title = reminder
    ? "⏰ Sigue pendiente (15 min)"
    : pending
      ? "Nueva reserva"
      : "Nueva reserva confirmada";
  const extra = [r.notes ? `📝 ${r.notes}` : "", pending ? "" : `Origen: ${sourceLabel(r.source)}`].filter(Boolean);
  return {
    title,
    body: [shortLine(r), ...extra].join("\n"),
    url: panelUrl(r),
    tag: `reserva-${r.id}`,
    reservationId: r.id,
    decision: pending,
  };
}

export function changePush(oldR: ReservationRow, r: ReservationRow): PushPayload {
  const cancelled = oldR.status !== r.status && r.status === "cancelled";
  const changes = changeList(oldR, r).filter((c) => !(cancelled && c.label === "Estado"));
  return {
    title: cancelled ? "Reserva cancelada" : "Cambio en una reserva",
    body: [shortLine(r), ...changes.map((c) => `${c.label}: ${c.from} → ${c.to}`)].join("\n"),
    url: panelUrl(r),
    tag: `reserva-${r.id}`,
    reservationId: r.id,
  };
}
