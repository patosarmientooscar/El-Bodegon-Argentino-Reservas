import { createAdminClient } from "@/lib/supabase/admin";
import {
  authorizedChatIds,
  editMessage,
  escapeHtml,
  newReservationText,
  nowTimeLabel,
  safeEqual,
  statusLabel,
  telegram,
} from "@/lib/notifications/telegram";

/**
 * POST /api/telegram/webhook — Telegram envía aquí los botones pulsados y los
 * mensajes al bot. Header obligatorio: X-Telegram-Bot-Api-Secret-Token =
 * TELEGRAM_WEBHOOK_SECRET (se configura con `npm run telegram:setup`).
 * Solo los chats de TELEGRAM_CHAT_IDS pueden aceptar o rechazar.
 */
export const dynamic = "force-dynamic";

type TgUser = { first_name?: string; last_name?: string; username?: string };
type TgMessage = { message_id: number; chat: { id: number }; text?: string };
type TgCallback = { id: string; from: TgUser; message?: TgMessage; data?: string };
type TgUpdate = { callback_query?: TgCallback; message?: TgMessage };

export async function POST(request: Request) {
  if (!safeEqual(request.headers.get("x-telegram-bot-api-secret-token"), process.env.TELEGRAM_WEBHOOK_SECRET)) {
    return Response.json({ ok: false }, { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = (await request.json()) as TgUpdate;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  try {
    if (update.callback_query) await onButton(update.callback_query);
    else if (update.message) await onMessage(update.message);
  } catch (error) {
    console.error("[telegram webhook]", error);
  }
  // 200 siempre: si no, Telegram reintenta el mismo update.
  return Response.json({ ok: true });
}

function answer(callbackId: string, text: string, alert = false) {
  return telegram("answerCallbackQuery", { callback_query_id: callbackId, text, show_alert: alert });
}

async function onButton(cq: TgCallback) {
  const chatId = cq.message?.chat.id;
  if (!chatId || !authorizedChatIds().includes(chatId)) {
    await answer(cq.id, "Este chat no está autorizado para gestionar reservas.", true);
    return;
  }

  const match = /^(acc|rej):([0-9a-f-]{36})$/i.exec(cq.data ?? "");
  if (!match) {
    await answer(cq.id, "Botón no reconocido.");
    return;
  }
  const accept = match[1] === "acc";
  const reservationId = match[2];
  const who = [cq.from.first_name, cq.from.last_name].filter(Boolean).join(" ") || cq.from.username || "Telegram";

  const admin = createAdminClient();
  const { data: current } = await admin.from("reservations").select("*").eq("id", reservationId).maybeSingle();
  if (!current) {
    await answer(cq.id, "La reserva ya no existe.", true);
    return;
  }

  const { data: msgs } = await admin
    .from("telegram_notifications")
    .select("chat_id, message_id, kind")
    .eq("reservation_id", reservationId);
  // El mensaje pulsado también se edita aunque no se hubiera podido guardar.
  const targets = [...(msgs ?? [])];
  if (cq.message && !targets.some((m) => m.chat_id === chatId && m.message_id === cq.message!.message_id)) {
    targets.push({ chat_id: chatId, message_id: cq.message.message_id, kind: "new" });
  }

  if (current.status !== "pending") {
    const footer = `\n\nℹ️ Ya estaba <b>${statusLabel(current.status)}</b>`;
    await Promise.all(
      targets.map((m) =>
        editMessage(m.chat_id, m.message_id, newReservationText({ ...current, status: "pending" }, m.kind === "reminder") + footer),
      ),
    );
    await answer(cq.id, `Esta reserva ya estaba ${statusLabel(current.status)}.`);
    return;
  }

  // Se marca antes de cambiar el estado: así el webhook del UPDATE sabe que la
  // decisión vino de Telegram y no reescribe los mensajes.
  const decidedAt = new Date().toISOString();
  await admin
    .from("telegram_notifications")
    .update({ decided_by: who, decided_at: decidedAt })
    .eq("reservation_id", reservationId);

  const { data: updated, error } = await admin
    .from("reservations")
    .update({ status: accept ? "confirmed" : "cancelled" })
    .eq("id", reservationId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (error || !updated) {
    await admin
      .from("telegram_notifications")
      .update({ decided_by: null, decided_at: null })
      .eq("reservation_id", reservationId)
      .eq("decided_at", decidedAt);
    await answer(cq.id, error ? `No se pudo guardar: ${error.message}` : "Otra persona la ha gestionado antes.", true);
    return;
  }

  const footer = accept
    ? `\n\n✅ <b>Aceptada</b> por ${escapeHtml(who)} · ${nowTimeLabel()}`
    : `\n\n❌ <b>Rechazada</b> por ${escapeHtml(who)} · ${nowTimeLabel()}`;
  await Promise.all(
    targets.map((m) =>
      editMessage(m.chat_id, m.message_id, newReservationText({ ...updated, status: "pending" }, m.kind === "reminder") + footer),
    ),
  );
  await answer(cq.id, accept ? "Reserva aceptada ✅" : "Reserva rechazada ❌");
}

async function onMessage(msg: TgMessage) {
  const text = msg.text?.trim() ?? "";
  if (!text.startsWith("/")) return; // solo comandos: no responde a cada mensaje de un grupo

  const chatId = msg.chat.id;
  if (authorizedChatIds().includes(chatId)) {
    await telegram("sendMessage", {
      chat_id: chatId,
      text: "✅ Este chat ya recibe los avisos de reservas de El Bodegón Argentino.",
    });
    return;
  }
  await telegram("sendMessage", {
    chat_id: chatId,
    parse_mode: "HTML",
    text:
      "Hola 👋 Este chat todavía no recibe avisos de reservas.\n\n" +
      `Su chat_id es <code>${chatId}</code>. Pásaselo a quien gestiona el panel para que lo añada a TELEGRAM_CHAT_IDS.`,
  });
}
