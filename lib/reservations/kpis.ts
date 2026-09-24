import type { ReservationRow, TableRow } from "./status";
import { computeAllTableStatuses } from "./status";

export interface DailyKpis {
  totalReservations: number;
  totalGuests: number;
  occupancyRate: number;
  cancellations: number;
}

/**
 * KPIs del día. totalReservations/totalGuests/cancellations cuentan sobre
 * todas las reservas de hoy; occupancyRate refleja la ocupación *ahora mismo*
 * (mesas ocupadas / total de mesas), coherente con el plano.
 */
export function computeDailyKpis(
  todayReservations: ReservationRow[],
  tables: TableRow[],
  bufferMinutes: number,
  now: Date,
): DailyKpis {
  const active = todayReservations.filter((r) => r.status !== "cancelled" && r.status !== "no_show");

  const totalReservations = active.length;
  const totalGuests = active.reduce((sum, r) => sum + r.party_size, 0);
  const cancellations = todayReservations.filter(
    (r) => r.status === "cancelled" || r.status === "no_show",
  ).length;

  const statuses = computeAllTableStatuses(tables, todayReservations, bufferMinutes, now);
  const occupiedCount = Array.from(statuses.values()).filter((s) => s.status === "occupied").length;
  const occupancyRate = tables.length > 0 ? Math.round((occupiedCount / tables.length) * 100) : 0;

  return { totalReservations, totalGuests, occupancyRate, cancellations };
}
