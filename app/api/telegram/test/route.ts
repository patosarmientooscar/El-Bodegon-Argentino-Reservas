import { createClient } from "@/lib/supabase/server";
import { authorizedChatIds, escapeHtml, nowTimeLabel, sendToAll } from "@/lib/notifications/telegram";

/**
 * POST /api/telegram/test — envía un aviso de prueba a todos los chats
 * autorizados. Solo para usuarios con sesión en el panel.
 */
export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "No has iniciado sesión." }, { status: 401 });

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return Response.json({ ok: false, error: "Falta TELEGRAM_BOT_TOKEN en las variables de entorno." }, { status: 400 });
  }
  const chats = authorizedChatIds();
  if (!chats.length) {
    return Response.json({ ok: false, error: "Falta TELEGRAM_CHAT_IDS en las variables de entorno." }, { status: 400 });
  }

  const sent = await sendToAll(
    "🔔 <b>Prueba de avisos</b>\n\n" +
      "Si ves este mensaje, las notificaciones de reservas de El Bodegón Argentino funcionan.\n" +
      `Enviado desde el panel por ${escapeHtml(user.email ?? "un usuario")} · ${nowTimeLabel()}`,
  );
  return Response.json({ ok: sent.length > 0, sent: sent.length, chats: chats.length });
}
