// Conecta el bot de Telegram con el panel (una sola vez, o al cambiar de URL).
//
//   npm run telegram:setup
//
// Lee TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET y APP_URL de .env.local.
// Le dice a Telegram que envíe los botones y mensajes a APP_URL/api/telegram/webhook
// con el header secreto.

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const appUrl = (process.env.APP_URL || "https://el-bodegon-argentino-reservas.vercel.app").replace(/\/$/, "");

if (!token || !secret) {
  console.error("Faltan TELEGRAM_BOT_TOKEN o TELEGRAM_WEBHOOK_SECRET en .env.local");
  process.exit(1);
}

async function call(method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload ?? {}),
  });
  return res.json();
}

const me = await call("getMe");
if (!me.ok) {
  console.error("El token no es válido:", me.description);
  process.exit(1);
}
console.log(`Bot: @${me.result.username}`);

const url = `${appUrl}/api/telegram/webhook`;
const set = await call("setWebhook", {
  url,
  secret_token: secret,
  allowed_updates: ["message", "callback_query"],
  drop_pending_updates: true,
});
if (!set.ok) {
  console.error("No se pudo configurar el webhook:", set.description);
  process.exit(1);
}

const info = await call("getWebhookInfo");
console.log(`Webhook: ${info.result.url}`);
if (info.result.last_error_message) console.log(`Último error: ${info.result.last_error_message}`);
console.log("Listo. Escribe /start al bot desde cada móvil o grupo para ver su chat_id.");
