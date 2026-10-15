import { timingSafeEqual } from "node:crypto";

import type { ReservationRow } from "@/lib/reservations/status";

/**
 * Avisos de reservas por Telegram (Fase 1). Todo lo que se envía pasa por
 * aquí: formato de mensajes, botones y llamadas a la API de Telegram.
 * Nunca lanza: si Telegram falla se registra el error y se sigue.
 */

const TIME_ZONE = "Europe/Madrid";

const SOURCE_LABEL: Record<ReservationRow["source"], string> = {
  web: "Web",
  whatsapp: "WhatsApp",
  phone: "Teléfono",
  walk_in: "Sin reserva",
};

const STATUS_LABEL: Record<ReservationRow["status"], string> = {
  pending: "pendiente",
  confirmed: "confirmada",
  cancelled: "cancelada",
  no_show: "no se presentó",
  seated: "sentada",
};

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

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function statusLabel(status: ReservationRow["status"]): string {
  return STATUS_LABEL[status] ?? status;
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
  lines.push(`🌐 Origen: ${SOURCE_LABEL[r.source] ?? r.source}`);
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

/** Lista legible de lo que ha cambiado entre dos versiones de la reserva. */
export function describeChanges(oldR: ReservationRow, newR: ReservationRow): string[] {
  const changes: string[] = [];
  if (oldR.status !== newR.status) {
    changes.push(`Estado: ${statusLabel(oldR.status)} → <b>${statusLabel(newR.status)}</b>`);
  }
  if (oldR.start_time !== newR.start_time) {
    changes.push(
      `Fecha y hora: ${formatDate(oldR.start_time)} ${formatTime(oldR.start_time)} → <b>${formatDate(newR.start_time)} ${formatTime(newR.start_time)}</b>`,
    );
  }
  if (oldR.party_size !== newR.party_size) {
    changes.push(`Personas: ${oldR.party_size} → <b>${newR.party_size}</b>`);
  }
  if (oldR.customer_name !== newR.customer_name) {
    changes.push(`Nombre: ${escapeHtml(oldR.customer_name)} → <b>${escapeHtml(newR.customer_name)}</b>`);
  }
  if (oldR.customer_phone !== newR.customer_phone) {
    changes.push(`Teléfono: ${escapeHtml(oldR.customer_phone ?? "—")} → <b>${escapeHtml(newR.customer_phone ?? "—")}</b>`);
  }
  if (oldR.notes !== newR.notes) {
    changes.push(`Notas: ${escapeHtml(oldR.notes ?? "—")} → <b>${escapeHtml(newR.notes ?? "—")}</b>`);
  }
  return changes;
}

type TelegramResult<T> = { ok: true; result: T } | { ok: false; description?: string };

/** Llamada a la API de Telegram. Devuelve null si falla (y lo registra). */
export async function telegram<T = unknown>(method: string, payload: Record<string, unknown>): Promise<T | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("[telegram] Falta TELEGRAM_BOT_TOKEN");
    return null;
  }
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

export function nowTimeLabel(): string {
  return formatTime(new Date().toISOString());
}
