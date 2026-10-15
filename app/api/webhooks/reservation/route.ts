import { createAdminClient } from "@/lib/supabase/admin";
import {
  decisionKeyboard,
  describeChanges,
  editMessage,
  newReservationText,
  nowTimeLabel,
  reservationDetails,
  safeEqual,
  sendToAll,
  statusLabel,
} from "@/lib/notifications/telegram";
import type { ReservationRow } from "@/lib/reservations/status";

/**
 * POST /api/webhooks/reservation — lo llama Supabase (pg_net) en cada INSERT y
 * UPDATE relevante de reservations, y pg_cron con type "REMINDER".
 * Header obligatorio: x-webhook-secret = RESERVATION_WEBHOOK_SECRET.
 * Siempre responde 200 salvo auth: un fallo de Telegram no debe reintentar
 * ni afectar a la reserva.
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
    console.error("[webhook reservation]", body.type, body.record.id, error);
  }
  return Response.json({ ok: true });
}

async function remember(reservationId: string, sent: { chatId: number; messageId: number }[], kind: "new" | "reminder") {
  if (!sent.length) return;
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("telegram_notifications").insert(
      sent.map((s) => ({ reservation_id: reservationId, chat_id: s.chatId, message_id: s.messageId, kind })),
    );
    if (error) console.error("[webhook reservation] guardar mensajes:", error.message);
  } catch (error) {
    console.error("[webhook reservation] guardar mensajes:", error);
  }
}

async function onNew(r: ReservationRow, reminder: boolean) {
  const keyboard = r.status === "pending" ? decisionKeyboard(r.id) : undefined;
  const sent = await sendToAll(newReservationText(r, reminder), keyboard);
  await remember(r.id, sent, reminder ? "reminder" : "new");
}

async function onReminder(r: ReservationRow) {
  // Se vuelve a leer: si alguien la aceptó justo ahora, no se recuerda.
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("reservations").select("*").eq("id", r.id).maybeSingle();
    if (!data || data.status !== "pending") return;
    await onNew(data, true);
  } catch {
    if (r.status === "pending") await onNew(r, true);
  }
}

async function onUpdate(oldR: ReservationRow, r: ReservationRow) {
  const statusChanged = oldR.status !== r.status;
  const changes = describeChanges(oldR, r);

  // 1. Si se decidió fuera de Telegram (panel, bot), los mensajes originales
  //    se actualizan y pierden los botones para que nadie la vuelva a decidir.
  if (statusChanged && oldR.status === "pending") {
    try {
      const admin = createAdminClient();
      const { data: msgs } = await admin
        .from("telegram_notifications")
        .select("chat_id, message_id, kind, decided_by")
        .eq("reservation_id", r.id);
      const decidedInTelegram = msgs?.some((m) => m.decided_by);
      if (msgs?.length && !decidedInTelegram) {
        const icon = r.status === "confirmed" ? "✅" : r.status === "cancelled" ? "❌" : "ℹ️";
        const footer = `\n\n${icon} <b>${capitalize(statusLabel(r.status))}</b> desde el panel · ${nowTimeLabel()}`;
        await Promise.all(
          msgs.map((m) =>
            editMessage(m.chat_id, m.message_id, newReservationText({ ...r, status: "pending" }, m.kind === "reminder") + footer),
          ),
        );
      }
    } catch (error) {
      console.error("[webhook reservation] editar mensajes:", error);
    }
  }

  // 2. Aviso de cambio (sin botones). No se avisa de:
  //    - decisiones sobre una pendiente (aceptar/rechazar): ya se ven en el mensaje original;
  //    - sentar / no presentado: son movimientos del propio servicio.
  const onlyStatus = statusChanged && changes.length === 1;
  const decision = onlyStatus && oldR.status === "pending" && (r.status === "confirmed" || r.status === "cancelled");
  const operational = onlyStatus && (r.status === "seated" || r.status === "no_show");
  if (!changes.length || decision || operational) return;

  const title =
    statusChanged && r.status === "cancelled" ? "❌ <b>Reserva cancelada</b>" : "✏️ <b>Cambio en una reserva</b>";
  await sendToAll(`${title}\n\n${changes.map((c) => `• ${c}`).join("\n")}\n\n${reservationDetails(r)}`);
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
