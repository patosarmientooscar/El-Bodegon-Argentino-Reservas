import type { Database } from "@/types/database.types";

export type TableRow = Database["public"]["Tables"]["tables"]["Row"];
export type ReservationRow = Database["public"]["Tables"]["reservations"]["Row"];

export type TableStatus = "available" | "reserved" | "occupied" | "blocked";

export interface TableStatusResult {
  status: TableStatus;
  /** Reserva que está ocupando la mesa ahora mismo (sentada o dentro de su rango horario). */
  activeReservation: ReservationRow | null;
  /** Próxima reserva dentro del buffer configurado (solo cuando status === "reserved"). */
  upcomingReservation: ReservationRow | null;
}

const ACTIVE_STATUSES = new Set(["confirmed", "seated"]);
const UPCOMING_STATUSES = new Set(["pending", "confirmed"]);

function reservationEnd(reservation: ReservationRow): number {
  return new Date(reservation.start_time).getTime() + reservation.duration_minutes * 60_000;
}

/**
 * Deriva el estado operativo de una mesa a partir de sus reservas y la hora actual.
 * Pura función de (mesa, reservas, buffer, now) — nunca un valor guardado en DB, así
 * el estado siempre sobrevive a un refresh y no depende de un toggle manual.
 */
export function computeTableStatus(
  table: TableRow,
  reservations: ReservationRow[],
  bufferMinutes: number,
  now: Date,
): TableStatusResult {
  if (table.status_override === "blocked") {
    return { status: "blocked", activeReservation: null, upcomingReservation: null };
  }

  const nowMs = now.getTime();
  const tableReservations = reservations.filter((r) => r.table_id === table.id);

  const active = tableReservations.find((r) => {
    if (!ACTIVE_STATUSES.has(r.status)) return false;
    const start = new Date(r.start_time).getTime();
    return start <= nowMs && nowMs < reservationEnd(r);
  });

  if (active) {
    return { status: "occupied", activeReservation: active, upcomingReservation: null };
  }

  const bufferMs = bufferMinutes * 60_000;
  const upcoming = tableReservations
    .filter((r) => {
      if (!UPCOMING_STATUSES.has(r.status)) return false;
      const start = new Date(r.start_time).getTime();
      return start > nowMs && start - nowMs <= bufferMs;
    })
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];

  if (upcoming) {
    return { status: "reserved", activeReservation: null, upcomingReservation: upcoming };
  }

  return { status: "available", activeReservation: null, upcomingReservation: null };
}

export function computeAllTableStatuses(
  tables: TableRow[],
  reservations: ReservationRow[],
  bufferMinutes: number,
  now: Date,
): Map<string, TableStatusResult> {
  const map = new Map<string, TableStatusResult>();
  for (const table of tables) {
    map.set(table.id, computeTableStatus(table, reservations, bufferMinutes, now));
  }
  return map;
}

export const TABLE_STATUS_LABEL: Record<TableStatus, string> = {
  available: "Disponible",
  reserved: "Reservada",
  occupied: "Ocupada",
  blocked: "Bloqueada",
};
