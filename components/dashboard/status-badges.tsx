import { Globe, Phone, Footprints, MessageCircle } from "lucide-react";

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

const RESERVATION_STATUS_STYLE: Record<ReservationStatus, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-amber-50 text-amber-700 border-amber-200" },
  confirmed: { label: "Confirmada", className: "bg-green-50 text-green-700 border-green-200" },
  seated: { label: "Sentada", className: "bg-blue-50 text-blue-700 border-blue-200" },
  cancelled: { label: "Cancelada", className: "bg-gray-100 text-gray-600 border-gray-200" },
  no_show: { label: "No-show", className: "bg-red-50 text-red-700 border-red-200" },
};

export function ReservationStatusBadge({
  status,
  className,
}: {
  status: ReservationStatus;
  className?: string;
}) {
  const style = RESERVATION_STATUS_STYLE[status];
  return <Badge variant="outline" className={cn("font-normal", style.className, className)}>{style.label}</Badge>;
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
  walk_in: "Walk-in",
  whatsapp: "WhatsApp",
};

export function SourceIcon({ source, className }: { source: ReservationSource; className?: string }) {
  const Icon = SOURCE_ICON[source];
  return <Icon aria-label={SOURCE_LABEL[source]} className={cn("size-3.5 text-muted-foreground", className)} />;
}

export { SOURCE_LABEL };
