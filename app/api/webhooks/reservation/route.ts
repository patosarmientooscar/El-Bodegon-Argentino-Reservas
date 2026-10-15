import { createAdminClient } from "@/lib/supabase/admin";
import { changeList, isCancellation, nowTimeLabel, shouldNotifyChange, statusLabel } from "@/lib/notifications/format";
import { changePush, newReservationPush, sendPushToRestaurant } from "@/lib/notifications/push";
import {
  decisionKeyboard,
  describeChanges,
  editMessage,
  newReservationText,
  reservationDetails,
  safeEqual,
  sendToAll,
  telegramEnabled,
} from "@/lib/notifications/telegram";
import type { ReservationRow } from "@/lib/reservations/status";

/**
 * POST /api/webhooks/reservation — sistema general de avisos de reservas.
 * Lo llama Supabase (pg_net) en cada INSERT y UPDATE relevante de reservations,
 * y pg_cron con type "REMINDER". Header obligatorio: x-webhook-secret =
 * RESERVATION_WEBHOOK_SECRET.
 *
 * Canales: notificaciones push (si hay claves VAPID) y Telegram (solo si existe
 * TELEGRAM_BOT_TOKEN). Siempre responde 200 salvo auth: un fallo de envío no
 * debe reintentar ni afectar a la reserva.
 */
export const dynamic = "force-dynamic";

type EventBody = {
  type: "INSERT" | "UPDATE" | "REMINDER";
  record: ReservationRow;
  old_record: ReservationRow | null;
};

export async function POST(request: Request) {
  if (!safeEqual(request.headers.get("x-webhook-secret"), process.env.RESERVATION_WEBHOOK_SECRET)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: EventBody;
  try {
    body = (await request.json()) as EventBody;
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  if (!body?.record?.id) return Response.json({ ok: false, error: "missing record" }, { status: 400 });

  try {
    if (body.type === "INSERT") await onNew(body.record, false);
    else if (body.type === "REMINDER") await onReminder(body.record);
    else if (body.type === "UPDATE" && body.old_record) await onUpdate(body.old_record, body.record);
  } catch (error) {
    console.error("[avisos]", body.type, body.record.id, error);
  }
  return Response.json({ ok: true });
}

/** Cada canal por separado: si uno falla, el otro se envía igual. */
async function safely(channel: string, task: () => Promise<unknown>) {
  try {
    await task();
  } catch (error) {
    console.error(`[avisos] ${channel}:`, error);
  }
}

async function onNew(r: ReservationRow, reminder: boolean) {
  await Promise.all([
    safely("push", () => sendPushToRestaurant(r.restaurant_id, newReservationPush(r, reminder))),
    telegramEnabled() && safely("telegram", () => telegramNew(r, reminder)),
  ]);
}

async function onReminder(r: ReservationRow) {
  // Se vuelve a leer: si alguien la aceptó justo ahora, no se recuerda.
  let current: ReservationRow | null = r;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("reservations").select("*").eq("id", r.id).maybeSingle();
    current = data;
  } catch (error) {
    console.error("[avisos] releer reserva:", error);
  }
  if (current?.status === "pending") await onNew(current, true);
}

async function onUpdate(oldR: ReservationRow, r: ReservationRow) {
  const changes = changeList(oldR, r);
  const notify = shouldNotifyChange(oldR, r, changes);
  await Promise.all([
    notify && safely("push", () => sendPushToRestaurant(r.restaurant_id, changePush(oldR, r))),
    telegramEnabled() && safely("telegram", () => telegramUpdate(oldR, r, notify)),
  ]);
}

/* ── Telegram (apagado salvo TELEGRAM_BOT_TOKEN) ─────────────────────────── */

async function telegramNew(r: ReservationRow, reminder: boolean) {
  const keyboard = r.status === "pending" ? decisionKeyboard(r.id) : undefined;
  const sent = await sendToAll(newReservationText(r, reminder), keyboard);
  if (!sent.length) return;
  const admin = createAdminClient();
  const { error } = await admin.from("telegram_notifications").insert(
    sent.map((s) => ({ reservation_id: r.id, chat_id: s.chatId, message_id: s.messageId, kind: reminder ? "reminder" : "new" })),
  );
  if (error) console.error("[avisos] telegram guardar mensajes:", error.message);
}

async function telegramUpdate(oldR: ReservationRow, r: ReservationRow, notify: boolean) {
  // Si se decidió fuera de Telegram (panel, móvil), los mensajes originales
  // pierden los botones para que nadie la vuelva a decidir.
  if (oldR.status === "pending" && r.status !== "pending") {
    const admin = createAdminClient();
    const { data: msgs } = await admin
      .from("telegram_notifications")
      .select("chat_id, message_id, kind, decided_by")
      .eq("reservation_id", r.id);
    if (msgs?.length && !msgs.some((m) => m.decided_by)) {
      const icon = r.status === "confirmed" ? "✅" : r.status === "cancelled" ? "❌" : "ℹ️";
      const label = statusLabel(r.status);
      const footer = `\n\n${icon} <b>${label.charAt(0).toUpperCase() + label.slice(1)}</b> desde el panel · ${nowTimeLabel()}`;
      await Promise.all(
        msgs.map((m) =>
          editMessage(m.chat_id, m.message_id, newReservationText({ ...r, status: "pending" }, m.kind === "reminder") + footer),
        ),
      );
    }
  }
  if (!notify) return;
  const title = isCancellation(oldR, r) ? "❌ <b>Reserva cancelada</b>" : "✏️ <b>Cambio en una reserva</b>";
  await sendToAll(`${title}\n\n${describeChanges(oldR, r).map((c) => `• ${c}`).join("\n")}\n\n${reservationDetails(r)}`);
}
