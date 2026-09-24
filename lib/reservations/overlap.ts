import type { ReservationRow, TableRow } from "./status";

const BLOCKING_STATUSES = new Set(["pending", "confirmed", "seated"]);

export interface ReservationRange {
  id?: string;
  table_id: string | null;
  start_time: string;
  duration_minutes: number;
}

function toRange(reservation: ReservationRange) {
  const start = new Date(reservation.start_time).getTime();
  return { start, end: start + reservation.duration_minutes * 60_000 };
}

/**
 * True si `candidate` se solapa con alguna reserva activa ya existente en la
 * misma mesa. Se usa tanto en el cliente (feedback visual inmediato al
 * arrastrar) como en el servidor (última palabra antes de guardar).
 */
export function hasTableOverlap(
  candidate: ReservationRange,
  existing: ReservationRow[],
): boolean {
  if (!candidate.table_id) return false;

  const candidateRange = toRange(candidate);

  return existing.some((reservation) => {
    if (reservation.id === candidate.id) return false;
    if (reservation.table_id !== candidate.table_id) return false;
    if (!BLOCKING_STATUSES.has(reservation.status)) return false;

    const range = toRange(reservation);
    return candidateRange.start < range.end && range.start < candidateRange.end;
  });
}

/**
 * Mejor mesa libre para una reserva nueva: la más pequeña donde quepa el
 * grupo (capacidad ≥ personas; a igual capacidad, la de número más bajo),
 * libre en ese horario y no bloqueada. Misma regla que el trigger
 * `reservations_auto_assign_table` de la BD. Null si ninguna cabe.
 */
export function pickBestAvailableTable(
  tables: TableRow[],
  existing: ReservationRow[],
  partySize: number,
  startTime: string,
  durationMinutes: number,
): TableRow | null {
  const candidates = tables
    .filter((t) => t.status_override !== "blocked" && t.capacity >= partySize)
    .filter((t) => !hasTableOverlap({ table_id: t.id, start_time: startTime, duration_minutes: durationMinutes }, existing))
    .sort((a, b) => a.capacity - b.capacity || a.number - b.number);

  return candidates[0] ?? null;
}
