/**
 * Utilidades de fecha/hora en la zona del restaurante. El servidor (Vercel)
 * corre en UTC y el móvil del cliente puede estar en cualquier zona, así que
 * todo se calcula en la zona del restaurante, nunca en la del dispositivo.
 * Fechas como "YYYY-MM-DD" y horas como "HH:MM" (hora de pared local).
 */

function wallClockParts(timeZone: string, instant: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/** Fecha de hoy ("YYYY-MM-DD") en la zona del restaurante. */
export function zonedToday(timeZone: string, now: Date): string {
  return wallClockParts(timeZone, now).date;
}

/** "2026-09-25" + "21:00" en la zona del restaurante → instante real (UTC). */
export function zonedToUtc(timeZone: string, date: string, time: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const target = Date.UTC(y, mo - 1, d, h, mi);

  // Dos pasadas: la segunda corrige el caso en que la primera cae al otro
  // lado de un cambio de hora (último domingo de marzo/octubre).
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const wall = wallClockParts(timeZone, new Date(guess));
    const [wy, wmo, wd] = wall.date.split("-").map(Number);
    const wallMs = Date.UTC(wy, wmo - 1, wd, Math.floor(wall.minutes / 60), wall.minutes % 60);
    guess += target - wallMs;
  }
  return new Date(guess);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = domingo … 6 = sábado (igual que service_hours.day_of_week). */
export function dayOfWeek(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "Jue" */
export function shortWeekday(date: string): string {
  const label = new Date(`${date}T12:00:00Z`).toLocaleDateString("es-ES", { weekday: "short", timeZone: "UTC" });
  return capitalize(label.replace(".", ""));
}

/** "jueves, 25 de septiembre" */
export function longDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}
