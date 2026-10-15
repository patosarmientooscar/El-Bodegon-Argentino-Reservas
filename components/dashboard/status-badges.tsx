import { Globe, Phone, Footprints, MessageCircle, Clock, Check, Armchair, X, UserX } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { TableStatusDot } from "@/components/dashboard/table-status-dot";
import { TABLE_STATUS_LABEL, type TableStatus } from "@/lib/reservations/status";
import type { ReservationStatus, ReservationSource } from "@/types/database.types";

export function TableStatusBadge({ status, className }: { status: TableStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-normal", className)}>
      <TableStatusDot status={status} />
      {TABLE_STATUS_LABEL[status]}
    </Badge>
  );
}

// Texto + icono + color: el estado se lee aunque no se distinga el color.
const RESERVATION_STATUS_STYLE: Record<ReservationStatus, { label: string; icon: typeof Clock; className: string }> = {
  pending: { label: "Pendiente", icon: Clock, className: "bg-amber-400/15 text-amber-300 border-amber-400/40" },
  confirmed: { label: "Confirmada", icon: Check, className: "bg-green-400/15 text-green-300 border-green-400/40" },
  seated: { label: "Ha llegado", icon: Armchair, className: "bg-sky-400/15 text-sky-300 border-sky-400/40" },
  cancelled: { label: "Cancelada", icon: X, className: "bg-stone-400/10 text-stone-400 border-stone-400/30" },
  no_show: { label: "No vino", icon: UserX, className: "bg-red-400/15 text-red-300 border-red-400/40" },
};

export const RESERVATION_STATUS_LABEL = Object.fromEntries(
  Object.entries(RESERVATION_STATUS_STYLE).map(([status, style]) => [status, style.label]),
) as Record<ReservationStatus, string>;

export function ReservationStatusBadge({
  status,
  className,
}: {
  status: ReservationStatus;
  className?: string;
}) {
  const style = RESERVATION_STATUS_STYLE[status];
  return (
    <Badge variant="outline" className={cn("gap-1 font-medium", style.className, className)}>
      <style.icon aria-hidden />
      {style.label}
    </Badge>
  );
}

const SOURCE_ICON: Record<ReservationSource, typeof Globe> = {
  web: Globe,
  phone: Phone,
  walk_in: Footprints,
  whatsapp: MessageCircle,
};

const SOURCE_LABEL: Record<ReservationSource, string> = {
  web: "Web",
  phone: "Teléfono",
  walk_in: "Sin reserva",
  whatsapp: "WhatsApp",
};

export function SourceIcon({ source, className }: { source: ReservationSource; className?: string }) {
  const Icon = SOURCE_ICON[source];
  return <Icon aria-label={SOURCE_LABEL[source]} className={cn("size-3.5 text-muted-foreground", className)} />;
}

export { SOURCE_LABEL };
