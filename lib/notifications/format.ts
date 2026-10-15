import type { ReservationRow } from "@/lib/reservations/status";

/** Formato común de los avisos de reservas (push y Telegram). Hora de Madrid. */

const TIME_ZONE = "Europe/Madrid";

const SOURCE_LABEL: Record<ReservationRow["source"], string> = {
  web: "Web",
  whatsapp: "WhatsApp",
  phone: "Teléfono",
  walk_in: "Sin reserva",
};

const STATUS_LABEL: Record<ReservationRow["status"], string> = {
  pending: "pendiente",
  confirmed: "confirmada",
  cancelled: "cancelada",
  no_show: "no se presentó",
  seated: "sentada",
};

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/** Fecha del día en Madrid (AAAA-MM-DD), para enlazar al panel. */
export function isoDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date(iso));
}

export function nowTimeLabel(): string {
  return formatTime(new Date().toISOString());
}

export function statusLabel(status: ReservationRow["status"]): string {
  return STATUS_LABEL[status] ?? status;
}

export function sourceLabel(source: ReservationRow["source"]): string {
  return SOURCE_LABEL[source] ?? source;
}

export type Change = { label: string; from: string; to: string };

/** Qué ha cambiado entre dos versiones de la reserva (texto plano). */
export function changeList(oldR: ReservationRow, newR: ReservationRow): Change[] {
  const changes: Change[] = [];
  if (oldR.status !== newR.status) {
    changes.push({ label: "Estado", from: statusLabel(oldR.status), to: statusLabel(newR.status) });
  }
  if (oldR.start_time !== newR.start_time) {
    changes.push({
      label: "Fecha y hora",
      from: `${formatDate(oldR.start_time)} ${formatTime(oldR.start_time)}`,
      to: `${formatDate(newR.start_time)} ${formatTime(newR.start_time)}`,
    });
  }
  if (oldR.party_size !== newR.party_size) {
    changes.push({ label: "Personas", from: String(oldR.party_size), to: String(newR.party_size) });
  }
  if (oldR.customer_name !== newR.customer_name) {
    changes.push({ label: "Nombre", from: oldR.customer_name, to: newR.customer_name });
  }
  if (oldR.customer_phone !== newR.customer_phone) {
    changes.push({ label: "Teléfono", from: oldR.customer_phone ?? "—", to: newR.customer_phone ?? "—" });
  }
  if (oldR.notes !== newR.notes) {
    changes.push({ label: "Notas", from: oldR.notes ?? "—", to: newR.notes ?? "—" });
  }
  return changes;
}

/**
 * ¿Merece aviso este cambio? No se avisa de:
 * - decisiones sobre una pendiente (aceptar/rechazar): las toma el propio restaurante;
 * - sentar / no presentado: son movimientos del servicio.
 */
export function shouldNotifyChange(oldR: ReservationRow, newR: ReservationRow, changes: Change[]): boolean {
  const statusChanged = oldR.status !== newR.status;
  const onlyStatus = statusChanged && changes.length === 1;
  const decision = onlyStatus && oldR.status === "pending" && (newR.status === "confirmed" || newR.status === "cancelled");
  const operational = onlyStatus && (newR.status === "seated" || newR.status === "no_show");
  return changes.length > 0 && !decision && !operational;
}

export function isCancellation(oldR: ReservationRow, newR: ReservationRow): boolean {
  return oldR.status !== newR.status && newR.status === "cancelled";
}
