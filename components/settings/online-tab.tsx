"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CirclePause, CirclePlay } from "lucide-react";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MissingFeature, SaveBar, settingsErrorMessage, useSave } from "@/components/settings/save-bar";
import { normalizePhone } from "@/lib/public-booking/phone";
import { formatPhone, madridTomorrowMidnight, pauseState, PAUSE_FOREVER } from "@/lib/settings/online";
import type { RestaurantSettings } from "@/lib/dashboard/context";

const LEAD_OPTIONS = [
  { value: 0, label: "Sin mínimo" },
  { value: 30, label: "30 minutos" },
  { value: 60, label: "1 hora" },
  { value: 120, label: "2 horas" },
  { value: 180, label: "3 horas" },
  { value: 360, label: "6 horas" },
  { value: 720, label: "12 horas" },
  { value: 1440, label: "1 día" },
];
const DURATION_OPTIONS = [60, 75, 90, 105, 120, 150, 180];

const selectClass =
  "h-12 w-full rounded-md border border-input bg-transparent px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&>option]:bg-popover";

/** Reservas online: pausa (web + WhatsApp) y reglas de la reserva online. */
export function OnlineTab({
  settings,
  restaurantId,
  phone,
  pauseSupported,
}: {
  settings: RestaurantSettings;
  restaurantId: string;
  phone: string | null;
  /** false = falta pegar PEGAR_AJUSTES.sql (no existe online_paused_until). */
  pauseSupported: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <PauseCard restaurantId={restaurantId} initialUntil={settings.online_paused_until ?? null} supported={pauseSupported} />
      <RulesCard settings={settings} restaurantId={restaurantId} initialPhone={phone} />
    </div>
  );
}

function PauseCard({
  restaurantId,
  initialUntil,
  supported,
}: {
  restaurantId: string;
  initialUntil: string | null;
  supported: boolean;
}) {
  const router = useRouter();
  const [until, setUntil] = useState<string | null>(initialUntil);
  const [choosing, setChoosing] = useState(false);
  const save = useSave();
  const state = pauseState(until);

  async function setPause(next: string | null) {
    const ok = await save.run(async () => {
      const { error } = await createClient()
        .from("restaurant_settings")
        .upsert({ restaurant_id: restaurantId, online_paused_until: next }, { onConflict: "restaurant_id" });
      return error ? settingsErrorMessage(error) : null;
    });
    if (ok) {
      setUntil(next);
      setChoosing(false);
      router.refresh(); // aviso de "En pausa" en Hoy
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Reservas online</CardTitle>
        <CardDescription className="text-base">
          Web y WhatsApp. Las que metéis vosotros desde el panel siempre se pueden hacer.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!supported ? (
          <MissingFeature />
        ) : (
          <>
            <div
              role="status"
              className={cn(
                "flex items-center gap-3 rounded-xl border-2 px-4 py-4",
                state.paused ? "border-amber-400/70 bg-amber-400/10" : "border-green-400/60 bg-green-400/10",
              )}
            >
              {state.paused ? (
                <CirclePause className="size-9 shrink-0 text-amber-300" />
              ) : (
                <CirclePlay className="size-9 shrink-0 text-green-300" />
              )}
              <div>
                <p className={cn("text-xl font-bold", state.paused ? "text-amber-200" : "text-green-200")}>
                  {state.paused ? "En pausa" : "Activadas"}
                </p>
                <p className="text-base text-muted-foreground">
                  {state.paused ? `No se aceptan reservas online ${state.label}.` : "Los clientes pueden reservar por la web y por WhatsApp."}
                </p>
              </div>
            </div>

            {state.paused ? (
              <Button
                onClick={() => setPause(null)}
                disabled={save.status === "saving"}
                className="h-14 bg-green-600 text-lg font-semibold text-white hover:bg-green-500"
              >
                <CirclePlay className="size-6" /> Volver a activar
              </Button>
            ) : choosing ? (
              <div className="flex flex-col gap-2">
                <p className="text-base font-medium">¿Hasta cuándo?</p>
                <Button
                  onClick={() => setPause(madridTomorrowMidnight())}
                  disabled={save.status === "saving"}
                  variant="outline"
                  className="h-auto min-h-14 flex-col items-start gap-0.5 border-amber-400/50 py-2.5 text-left"
                >
                  <span className="text-base font-semibold">Solo hoy</span>
                  <span className="text-sm font-normal text-muted-foreground">Mañana se activan solas.</span>
                </Button>
                <Button
                  onClick={() => setPause(PAUSE_FOREVER)}
                  disabled={save.status === "saving"}
                  variant="outline"
                  className="h-auto min-h-14 flex-col items-start gap-0.5 border-amber-400/50 py-2.5 text-left"
                >
                  <span className="text-base font-semibold">Hasta que las vuelva a activar</span>
                  <span className="text-sm font-normal text-muted-foreground">Por ejemplo, vacaciones o un evento privado.</span>
                </Button>
                <Button variant="ghost" onClick={() => setChoosing(false)} className="h-11 text-base">
                  No pausar
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => setChoosing(true)}
                variant="outline"
                className="h-14 border-amber-400/60 text-lg font-semibold text-amber-200 hover:bg-amber-400/10"
              >
                <CirclePause className="size-6" /> Pausar reservas online
              </Button>
            )}
            {save.status === "saved" && (
              <p role="status" className="text-base font-medium text-green-300">
                Guardado ✓
              </p>
            )}
            {save.error && (
              <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2.5 text-base text-red-200">
                {save.error}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RulesCard({
  settings,
  restaurantId,
  initialPhone,
}: {
  settings: RestaurantSettings;
  restaurantId: string;
  initialPhone: string | null;
}) {
  const [webMax, setWebMax] = useState(String(settings.web_max_party_size));
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [lead, setLead] = useState(settings.min_lead_time_minutes);
  const [advance, setAdvance] = useState(String(settings.max_advance_days));
  const [duration, setDuration] = useState(settings.default_reservation_duration_minutes);
  const [maxParty, setMaxParty] = useState(String(settings.max_party_size));
  const save = useSave();

  const webMaxNumber = Number(webMax);
  const phoneShown = formatPhone(phone.trim()) || "+34 618 02 55 80";

  async function handleSave() {
    await save.run(async () => {
      const web = Number(webMax);
      const days = Number(advance);
      const max = Number(maxParty);
      if (!Number.isInteger(web) || web < 1 || web > 50) return "El máximo online tiene que estar entre 1 y 50 personas.";
      if (!Number.isInteger(days) || days < 1 || days > 365) return "La antelación máxima tiene que estar entre 1 y 365 días.";
      if (!Number.isInteger(max) || max < 1 || max > 100) return "El máximo para WhatsApp y panel tiene que estar entre 1 y 100.";
      let e164: string | null = null;
      if (phone.trim()) {
        const result = normalizePhone("+34", phone);
        if (!result.ok) return "Revisa el teléfono: por ejemplo 618 02 55 80 o +34 618 02 55 80.";
        e164 = result.e164;
      }

      const supabase = createClient();
      const [settingsResult, phoneResult] = await Promise.all([
        supabase.from("restaurant_settings").upsert(
          {
            restaurant_id: restaurantId,
            web_max_party_size: web,
            min_lead_time_minutes: lead,
            max_advance_days: days,
            default_reservation_duration_minutes: duration,
            max_party_size: max,
          },
          { onConflict: "restaurant_id" },
        ),
        supabase.from("restaurants").update({ phone: e164 }).eq("id", restaurantId),
      ]);
      const error = settingsResult.error ?? phoneResult.error;
      if (error) return settingsErrorMessage(error);
      if (e164) setPhone(formatPhone(e164));
      return null;
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Reglas de la reserva online</CardTitle>
        <CardDescription className="text-base">Lo que puede reservar un cliente él solo.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="web-max" className="text-base">
              Máximo de personas por reserva online
            </Label>
            <Input id="web-max" type="number" inputMode="numeric" min={1} max={50} value={webMax} onChange={(e) => setWebMax(e.target.value)} className="h-12 text-base" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rest-phone" className="text-base">
              Teléfono del restaurante
            </Label>
            <Input
              id="rest-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+34 618 02 55 80"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-12 text-base"
            />
          </div>
        </div>
        <p className="rounded-lg border bg-muted/40 px-3 py-2.5 text-base">
          La web dirá: <span className="text-primary">«Para más de {Number.isFinite(webMaxNumber) && webMaxNumber > 0 ? webMaxNumber : "…"} personas, llámanos al {phoneShown}»</span>
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="lead" className="text-base">
              Antelación mínima
            </Label>
            <select id="lead" value={lead} onChange={(e) => setLead(Number(e.target.value))} className={selectClass}>
              {[...LEAD_OPTIONS, ...(LEAD_OPTIONS.some((o) => o.value === lead) ? [] : [{ value: lead, label: `${lead} minutos` }])].map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="text-sm text-muted-foreground">No se puede reservar para dentro de menos de esto.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="advance" className="text-base">
              Antelación máxima (días)
            </Label>
            <Input id="advance" type="number" inputMode="numeric" min={1} max={365} value={advance} onChange={(e) => setAdvance(e.target.value)} className="h-12 text-base" />
            <p className="text-sm text-muted-foreground">Hasta cuántos días por delante se puede reservar.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="duration" className="text-base">
              Duración media de una reserva
            </Label>
            <select id="duration" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={selectClass}>
              {[...new Set([...DURATION_OPTIONS, duration])].sort((a, b) => a - b).map((m) => (
                <option key={m} value={m}>
                  {m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`}
                </option>
              ))}
            </select>
            <p className="text-sm text-muted-foreground">Cuánto tiempo se queda ocupada la mesa (para saber cuáles quedan libres).</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="max-party" className="text-base">
              Máximo por reserva (WhatsApp y panel)
            </Label>
            <Input id="max-party" type="number" inputMode="numeric" min={1} max={100} value={maxParty} onChange={(e) => setMaxParty(e.target.value)} className="h-12 text-base" />
          </div>
        </div>

        <SaveBar status={save.status} error={save.error} onClick={handleSave} />
      </CardContent>
    </Card>
  );
}
