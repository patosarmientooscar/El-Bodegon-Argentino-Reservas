import type { Database } from "@/types/database.types";
import type { ReservationRow } from "./status";

export type ServiceHourRow = Database["public"]["Tables"]["service_hours"]["Row"];

const FALLBACK_LUNCH_END_HOUR = 17;

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export type Turno = "lunch" | "dinner";

/**
 * Ventana horaria (minutos desde medianoche) de un turno concreto en un día
 * concreto — null si ese turno está cerrado ese día y no hay ninguna reserva
 * suelta que obligue a mostrarlo igualmente. Cada turno tiene su propia
 * rejilla en Reservations, así que no arrastra el horario de todo el día.
 */
export function getTurnoWindow(
  serviceHours: ServiceHourRow[],
  dayOfWeek: number,
  turno: Turno,
  reservations: ReservationRow[],
): { startMinutes: number; endMinutes: number } | null {
  const row = serviceHours.find((h) => h.day_of_week === dayOfWeek && h.turno === turno);
  const isOpen = Boolean(row && !row.closed && row.open_time && row.close_time);

  let startMinutes = isOpen ? timeToMinutes(row!.open_time!) : null;
  let endMinutes = isOpen ? timeToMinutes(row!.close_time!) : null;

  const turnoReservations = reservations.filter((r) => classifyTurno(r, serviceHours, dayOfWeek) === turno);
  for (const reservation of turnoReservations) {
    const start = new Date(reservation.start_time);
    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMin = startMin + reservation.duration_minutes;
    startMinutes = startMinutes === null ? startMin : Math.min(startMinutes, startMin);
    endMinutes = endMinutes === null ? endMin : Math.max(endMinutes, endMin);
  }

  if (startMinutes === null || endMinutes === null) return null;
  return { startMinutes, endMinutes };
}

/** Clasifica una reserva en comida/cena a partir de service_hours; si no hay datos, usa las 17:00 como corte. */
export function classifyTurno(
  reservation: ReservationRow,
  serviceHours: ServiceHourRow[],
  dayOfWeek: number,
): Turno {
  const start = new Date(reservation.start_time);
  const minutes = start.getHours() * 60 + start.getMinutes();

  const dayRows = serviceHours.filter((h) => h.day_of_week === dayOfWeek && !h.closed && h.open_time && h.close_time);
  const lunch = dayRows.find((h) => h.turno === "lunch");
  const dinner = dayRows.find((h) => h.turno === "dinner");

  if (lunch && minutes >= timeToMinutes(lunch.open_time!) && minutes <= timeToMinutes(lunch.close_time!)) {
    return "lunch";
  }
  if (dinner && minutes >= timeToMinutes(dinner.open_time!) && minutes <= timeToMinutes(dinner.close_time!)) {
    return "dinner";
  }

  return start.getHours() < FALLBACK_LUNCH_END_HOUR ? "lunch" : "dinner";
}
