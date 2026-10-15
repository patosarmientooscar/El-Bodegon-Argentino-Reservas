import { timingSafeEqual } from "node:crypto";

import type { ReservationRow } from "@/lib/reservations/status";
import { changeList, formatDate, formatTime, sourceLabel, statusLabel } from "@/lib/notifications/format";

export { nowTimeLabel, statusLabel } from "@/lib/notifications/format";

/**
 * Avisos de reservas por Telegram — APAGADO salvo que exista TELEGRAM_BOT_TOKEN
 * (ver PLAN.md → Futuro / opcional). Sin token no envía nada ni escribe en los logs.
 * Nunca lanza: si Telegram falla se registra el error y se sigue.
 */

export function telegramEnabled(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

export type InlineKeyboard = { text: string; callback_data: string }[][];

/** Chats autorizados (TELEGRAM_CHAT_IDS="123,-100456"). */
export function authorizedChatIds(): number[] {
  return (process.env.TELEGRAM_CHAT_IDS ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n !== 0);
}

/** Comparación en tiempo constante de secretos de cabecera. */
export function safeEqual(received: string | null, expected: string | undefined): boolean {
  if (!received || !expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Cuerpo común de los mensajes de una reserva (HTML de Telegram). */
export function reservationDetails(r: ReservationRow): string {
  const lines = [
    `👤 ${escapeHtml(r.customer_name)}`,
    `📅 ${formatDate(r.start_time)} · 🕘 ${formatTime(r.start_time)}`,
    `👥 ${r.party_size} ${r.party_size === 1 ? "persona" : "personas"}`,
  ];
  if (r.customer_phone) lines.push(`📞 ${escapeHtml(r.customer_phone)}`);
  if (r.notes) lines.push(`📝 ${escapeHtml(r.notes)}`);
  lines.push(`🌐 Origen: ${sourceLabel(r.source)}`);
  return lines.join("\n");
}

export function newReservationText(r: ReservationRow, reminder = false): string {
  const title = reminder
    ? "⏰ <b>Sigue pendiente</b> (más de 15 min)"
    : r.status === "pending"
      ? "🆕 <b>Nueva reserva</b> · pendiente"
      : `🆕 <b>Nueva reserva</b> · ${statusLabel(r.status)}`;
  return `${title}\n\n${reservationDetails(r)}`;
}

export function decisionKeyboard(reservationId: string): InlineKeyboard {
  return [
    [
      { text: "✅ Aceptar", callback_data: `acc:${reservationId}` },
      { text: "❌ Rechazar", callback_data: `rej:${reservationId}` },
    ],
  ];
}

/** Lista legible (HTML) de lo que ha cambiado entre dos versiones de la reserva. */
export function describeChanges(oldR: ReservationRow, newR: ReservationRow): string[] {
  return changeList(oldR, newR).map(
    (c) => `${c.label}: ${escapeHtml(c.from)} → <b>${escapeHtml(c.to)}</b>`,
  );
}

type TelegramResult<T> = { ok: true; result: T } | { ok: false; description?: string };

/** Llamada a la API de Telegram. Devuelve null si falla (y lo registra). */
export async function telegram<T = unknown>(method: string, payload: Record<string, unknown>): Promise<T | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null; // Telegram apagado
  try {
    // TELEGRAM_API_BASE solo para pruebas locales (servidor falso); en producción no se define.
    const base = process.env.TELEGRAM_API_BASE ?? "https://api.telegram.org";
    const res = await fetch(`${base}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as TelegramResult<T>;
    if (!data.ok) {
      console.error(`[telegram] ${method} falló:`, data.description);
      return null;
    }
    return data.result;
  } catch (error) {
    console.error(`[telegram] ${method} error:`, error);
    return null;
  }
}

/** Envía un mensaje a todos los chats autorizados. Devuelve los enviados. */
export async function sendToAll(
  text: string,
  keyboard?: InlineKeyboard,
): Promise<{ chatId: number; messageId: number }[]> {
  const sent: { chatId: number; messageId: number }[] = [];
  await Promise.all(
    authorizedChatIds().map(async (chatId) => {
      const msg = await telegram<{ message_id: number }>("sendMessage", {
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
      });
      if (msg) sent.push({ chatId, messageId: msg.message_id });
    }),
  );
  return sent;
}

/** Reescribe un mensaje ya enviado y le quita los botones. */
export async function editMessage(chatId: number, messageId: number, text: string) {
  return telegram("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: [] },
  });
}
