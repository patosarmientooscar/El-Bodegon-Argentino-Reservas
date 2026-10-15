"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BellRing, Smartphone, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Device = { id: string; device: string | null; created_at: string; endpoint: string };
type Support = "checking" | "ios-install" | "ios-old" | "unsupported" | "ready";

/** Clave VAPID pública (base64url) → bytes, como la pide pushManager.subscribe. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function iosVersion(): number | null {
  const m = /OS (\d+)_(\d+)/.exec(navigator.userAgent);
  return m ? Number(m[1]) + Number(m[2]) / 100 : null;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Nombre legible del dispositivo para la lista ("iPhone · Safari"). */
function deviceLabel() {
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Mac/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : "Otro";
  const browser = /SamsungBrowser/.test(ua)
    ? "Samsung Internet"
    : /Edg\//.test(ua)
      ? "Edge"
      : /Firefox|FxiOS/.test(ua)
        ? "Firefox"
        : /Chrome|CriOS/.test(ua)
          ? "Chrome"
          : /Safari/.test(ua)
            ? "Safari"
            : "Navegador";
  return `${os} · ${isStandalone() ? "app" : browser}`;
}

function formatDay(iso: string) {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

export function PushNotificationsCard({
  restaurantId,
  currentUserId,
  vapidPublicKey,
}: {
  restaurantId: string;
  currentUserId: string;
  vapidPublicKey: string | null;
}) {
  const [support, setSupport] = useState<Support>("checking");
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [myEndpoint, setMyEndpoint] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [busy, setBusy] = useState<"on" | "off" | "test" | string | null>(null);

  const loadDevices = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("push_subscriptions")
      .select("id, device, created_at, endpoint")
      .eq("restaurant_id", restaurantId)
      .order("created_at");
    setDevices(data ?? []);
  }, [restaurantId]);

  useEffect(() => {
    void loadDevices();
    const ios = isIOS();
    if (ios && !isStandalone()) {
      const v = iosVersion();
      setSupport(v !== null && v < 16.04 ? "ios-old" : "ios-install");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setSupport("unsupported");
      return;
    }
    setPermission(Notification.permission);
    setSupport("ready");
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setMyEndpoint(sub?.endpoint ?? null))
      .catch(() => setMyEndpoint(null));
  }, [loadDevices]);

  async function activate() {
    if (!vapidPublicKey) return;
    setBusy("on");
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        toast.error("No se han permitido las notificaciones en este móvil.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) }));
      const json = sub.toJSON();
      const supabase = createClient();
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: currentUserId,
          restaurant_id: restaurantId,
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
          device: deviceLabel(),
        },
        { onConflict: "endpoint" },
      );
      if (error) throw new Error(error.message);
      setMyEndpoint(sub.endpoint);
      await loadDevices();
      toast.success("Notificaciones activadas en este móvil.");
    } catch (error) {
      toast.error("No se pudieron activar las notificaciones.", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  }

  async function removeDevice(device: Device) {
    setBusy(device.id);
    try {
      if (device.endpoint === myEndpoint) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        await sub?.unsubscribe();
        setMyEndpoint(null);
      }
      const supabase = createClient();
      const { error } = await supabase.from("push_subscriptions").delete().eq("id", device.id);
      if (error) throw new Error(error.message);
      await loadDevices();
      toast.success("Dispositivo quitado. Ya no recibirá avisos.");
    } catch (error) {
      toast.error("No se pudo quitar el dispositivo.", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  }

  async function sendTest() {
    setBusy("test");
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = (await res.json()) as { ok: boolean; sent?: number; total?: number; error?: string };
      if (data.ok) toast.success(`Notificación de prueba enviada a ${data.sent} de ${data.total} dispositivos.`);
      else toast.error("No llegó la notificación de prueba.", { description: data.error ?? "No hay móviles activados." });
    } catch {
      toast.error("No se pudo enviar la notificación de prueba.");
    } finally {
      setBusy(null);
    }
  }

  const activeHere = Boolean(myEndpoint && devices.some((d) => d.endpoint === myEndpoint));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="size-5" /> Avisos en el móvil
        </CardTitle>
        <CardDescription>
          Recibe un aviso al momento cuando entra una reserva, cambia o lleva 15 minutos sin aceptar.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {!vapidPublicKey && (
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            Las notificaciones aún no están configuradas en el servidor (faltan las claves VAPID).
          </p>
        )}

        {vapidPublicKey && support === "ios-install" && <IosInstallSteps />}

        {vapidPublicKey && support === "ios-old" && (
          <p className="rounded-md border p-3 text-sm">
            Este iPhone necesita <b>iOS 16.4 o superior</b> para recibir avisos. Actualízalo en Ajustes → General →
            Actualización de software.
          </p>
        )}

        {vapidPublicKey && support === "unsupported" && (
          <p className="rounded-md border p-3 text-sm">
            Este navegador no admite notificaciones. Abre el panel con Chrome (Android) o Safari (iPhone).
          </p>
        )}

        {vapidPublicKey && support === "ready" && permission === "denied" && (
          <p className="rounded-md border border-destructive/40 p-3 text-sm">
            Las notificaciones están <b>bloqueadas</b> en este móvil. En iPhone: Ajustes → Notificaciones → El Bodegón →
            Permitir. En Android: toca el candado junto a la dirección (o mantén pulsado el icono de la app) →
            Notificaciones → Permitir. Después vuelve aquí.
          </p>
        )}

        {vapidPublicKey && support === "ready" && permission !== "denied" &&
          (activeHere ? (
            <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-3 text-sm font-medium">
              <span className="inline-block size-2.5 rounded-full bg-emerald-500" aria-hidden />
              Activadas en este móvil
            </p>
          ) : (
            <Button onClick={activate} disabled={busy === "on"} size="lg" className="h-14 text-base">
              <BellRing className="size-5" />
              {busy === "on" ? "Activando…" : "Activar notificaciones en este móvil"}
            </Button>
          ))}

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Dispositivos que reciben avisos</p>
          {devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía ninguno.</p>
          ) : (
            <ul className="flex flex-col divide-y rounded-md border">
              {devices.map((d) => (
                <li key={d.id} className="flex min-h-14 items-center gap-3 px-3 py-2">
                  <Smartphone className="size-5 shrink-0 text-muted-foreground" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      {d.device ?? "Dispositivo"}
                      {d.endpoint === myEndpoint && <span className="ml-2 text-xs text-muted-foreground">(este)</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">Desde el {formatDay(d.created_at)}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-11"
                    onClick={() => removeDevice(d)}
                    disabled={busy === d.id}
                    aria-label={`Quitar ${d.device ?? "dispositivo"}`}
                  >
                    <Trash2 className="size-4" /> Quitar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Button
          variant="outline"
          onClick={sendTest}
          disabled={busy === "test" || devices.length === 0 || !vapidPublicKey}
          className="h-11 self-start"
        >
          {busy === "test" ? "Enviando…" : "Enviar notificación de prueba"}
        </Button>
      </CardContent>
    </Card>
  );
}

/** iPhone sin instalar: pasos con dibujo de "Compartir → Añadir a pantalla de inicio". */
function IosInstallSteps() {
  return (
    <div className="flex flex-col gap-4 rounded-md border p-4">
      <p className="text-sm">
        En iPhone, los avisos solo funcionan si el panel está <b>instalado como app</b>. Es un momento:
      </p>
      <div className="flex items-start gap-4">
        <PhoneDrawing />
        <ol className="flex flex-col gap-3 text-sm">
          <li>
            <b>1.</b> Abre esta página en <b>Safari</b>.
          </li>
          <li className="flex flex-wrap items-center gap-1">
            <b>2.</b> Toca el botón <b>Compartir</b> <ShareIcon className="inline size-5" /> (abajo, en el centro).
          </li>
          <li className="flex flex-wrap items-center gap-1">
            <b>3.</b> Baja y toca <b>«Añadir a pantalla de inicio»</b> <AddIcon className="inline size-5" />.
          </li>
          <li>
            <b>4.</b> Toca <b>Añadir</b>. Abre la app <b>«El Bodegón»</b> desde el icono nuevo y vuelve a Ajustes →
            Notificaciones para activarlas.
          </li>
        </ol>
      </div>
    </div>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M12 15V3M8 7l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2" strokeLinecap="round" />
    </svg>
  );
}

function AddIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="M12 8v8M8 12h8" strokeLinecap="round" />
    </svg>
  );
}

/** Dibujo de un iPhone con la barra de Safari y el botón Compartir señalado. */
function PhoneDrawing() {
  return (
    <svg viewBox="0 0 90 170" className="h-40 w-auto shrink-0" aria-hidden>
      <rect x="3" y="3" width="84" height="164" rx="14" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <rect x="33" y="9" width="24" height="6" rx="3" fill="currentColor" opacity=".35" />
      <rect x="12" y="24" width="66" height="8" rx="4" fill="currentColor" opacity=".15" />
      <rect x="12" y="40" width="66" height="96" rx="4" fill="currentColor" opacity=".07" />
      <line x1="3" y1="144" x2="87" y2="144" stroke="currentColor" strokeWidth="1" opacity=".3" />
      <path d="M17 156l-4-4 4-4M27 148l4 4-4 4" stroke="currentColor" strokeWidth="1.6" fill="none" opacity=".4" />
      <g transform="translate(35 145) scale(.85)" className="text-[#B08D57]">
        <circle cx="12" cy="11" r="14" fill="#B08D57" opacity=".18" />
        <path d="M12 15V3M8 7l4-4 4 4" stroke="#B08D57" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M8 10H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-2" stroke="#B08D57" strokeWidth="2" fill="none" />
      </g>
      <rect x="61" y="148" width="9" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" opacity=".4" />
      <path d="M45 128v-8M41 124l4 4 4-4" stroke="#B08D57" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}
