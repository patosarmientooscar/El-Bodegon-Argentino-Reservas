/**
 * Pausa de reservas online (restaurant_settings.online_paused_until).
 * null = activas · fecha futura = en pausa hasta entonces · año 2999 = hasta reactivarla.
 * La BD (online_booking_paused) es quien decide; esto solo calcula y explica.
 */

export const PAUSE_FOREVER = "2999-12-31T00:00:00.000Z";
const TIME_ZONE = "Europe/Madrid";

function madridDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Mañana a las 00:00 en Madrid (fin de "pausar solo hoy"), en ISO UTC. */
export function madridTomorrowMidnight(now = new Date()): string {
  const tomorrow = new Date(`${madridDate(now)}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const day = tomorrow.toISOString().slice(0, 10);
  // Medianoche de Madrid = 22:00 o 23:00 UTC del día anterior (verano / invierno).
  for (const offset of ["+02:00", "+01:00"]) {
    const candidate = new Date(`${day}T00:00:00${offset}`);
    if (madridDate(candidate) === day && madridDate(new Date(candidate.getTime() - 1)) !== day) {
      return candidate.toISOString();
    }
  }
  return new Date(`${day}T00:00:00+01:00`).toISOString();
}

export interface PauseState {
  paused: boolean;
  /** Hasta que alguien la reactive. */
  forever: boolean;
  /** "hasta mañana" / "hasta que la actives" / "hasta el sáb 25 oct, 00:00" */
  label: string;
}

export function pauseState(until: string | null | undefined, now = new Date()): PauseState {
  if (!until) return { paused: false, forever: false, label: "" };
  const end = new Date(until);
  if (Number.isNaN(end.getTime()) || end <= now) return { paused: false, forever: false, label: "" };
  if (end.getUTCFullYear() >= 2999) return { paused: true, forever: true, label: "hasta que la vuelvas a activar" };
  if (end.getTime() === new Date(madridTomorrowMidnight(now)).getTime()) return { paused: true, forever: false, label: "solo hoy (mañana se activa sola)" };
  return {
    paused: true,
    forever: false,
    label: `hasta el ${end.toLocaleString("es-ES", { timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`,
  };
}

/** "+34618025580" → "+34 618 02 55 80" (solo para mostrar). */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const compact = phone.replace(/[^\d+]/g, "");
  const m = compact.match(/^\+34(\d{3})(\d{2})(\d{2})(\d{2})$/);
  return m ? `+34 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone;
}
