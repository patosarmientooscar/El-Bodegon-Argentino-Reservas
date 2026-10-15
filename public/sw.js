/*
 * Service worker de "Reservas El Bodegón".
 * Muestra las notificaciones push de reservas y abre el panel al tocarlas.
 * En Android/escritorio, las pendientes llevan botones Aceptar / Rechazar que
 * llaman a /api/reservations/[id]/decision con la sesión del usuario (cookies).
 * No guarda nada en caché: el panel siempre muestra datos en vivo.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const ICON = "/icons/icon-192.png";
const BADGE = "/icons/badge-96.png";

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Reservas El Bodegón", body: event.data ? event.data.text() : "" };
  }

  const options = {
    body: data.body || "",
    icon: ICON,
    badge: BADGE,
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: { url: data.url || "/home", reservationId: data.reservationId || null },
    actions: data.decision
      ? [
          { action: "accept", title: "✅ Aceptar" },
          { action: "reject", title: "❌ Rechazar" },
        ]
      : [],
  };
  event.waitUntil(self.registration.showNotification(data.title || "Reservas El Bodegón", options));
});

async function openPanel(url) {
  const target = new URL(url, self.location.origin).href;
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of windows) {
    if (new URL(client.url).origin === self.location.origin && "focus" in client) {
      await client.focus();
      if ("navigate" in client) return client.navigate(target);
      return client;
    }
  }
  return self.clients.openWindow(target);
}

async function decide(reservationId, decision, url) {
  try {
    const res = await fetch(`/api/reservations/${reservationId}/decision`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    const result = await res.json().catch(() => ({}));
    if (res.ok && result.ok) {
      const name = result.customerName ? ` · ${result.customerName}` : "";
      return self.registration.showNotification(decision === "accept" ? `✅ Reserva aceptada${name}` : `❌ Reserva rechazada${name}`, {
        icon: ICON,
        badge: BADGE,
        tag: `decision-${reservationId}`,
        data: { url },
      });
    }
    // Sin sesión o ya decidida: se abre el panel para verla.
    if (result.error) {
      await self.registration.showNotification("No se pudo cambiar la reserva", {
        body: result.error,
        icon: ICON,
        badge: BADGE,
        tag: `decision-${reservationId}`,
        data: { url },
      });
    }
  } catch {
    return openPanel(url);
  }
}

self.addEventListener("notificationclick", (event) => {
  const { url = "/home", reservationId } = event.notification.data || {};
  event.notification.close();

  if ((event.action === "accept" || event.action === "reject") && reservationId) {
    event.waitUntil(decide(reservationId, event.action, url));
    return;
  }
  event.waitUntil(openPanel(url));
});
