import { Ban, Check, Clock, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { TableStatusDot } from "@/components/dashboard/table-status-dot";
import type { TableStatus } from "@/lib/reservations/status";
import type { TableShape as TableShapeKind } from "@/types/database.types";

const SHAPE_CLASS: Record<TableShapeKind, string> = {
  round: "rounded-full size-14",
  square: "rounded-lg size-14",
  rectangular: "rounded-lg w-20 h-12",
};

// Plano de Home: en móvil ocupa todo el ancho (debajo de la lista), así que
// las mesas son algo más pequeñas que en ordenador.
const RESPONSIVE_SHAPE_CLASS: Record<TableShapeKind, string> = {
  round: "rounded-full size-10 text-sm sm:size-14 sm:text-base",
  square: "rounded-md size-10 text-sm sm:rounded-lg sm:size-14 sm:text-base",
  rectangular: "rounded-md w-12 h-9 text-sm sm:rounded-lg sm:w-20 sm:h-12 sm:text-base",
};

const STATUS_CLASS: Record<TableStatus, string> = {
  available: "bg-table-available/10 border-table-available text-table-available",
  reserved: "bg-table-reserved/10 border-table-reserved text-table-reserved",
  occupied: "bg-table-occupied/10 border-table-occupied text-table-occupied",
  blocked: "bg-table-blocked/10 border-table-blocked text-table-blocked",
};

// Icono de estado (plano de Home): libre ✓, reservada reloj, ocupada personas, bloqueada prohibido.
const STATUS_ICON: Record<TableStatus, typeof Check> = {
  available: Check,
  reserved: Clock,
  occupied: Users,
  blocked: Ban,
};

const STATUS_ICON_BG: Record<TableStatus, string> = {
  available: "bg-table-available",
  reserved: "bg-table-reserved",
  occupied: "bg-table-occupied",
  blocked: "bg-table-blocked",
};

export function TableShape({
  number,
  shape,
  status,
  selected,
  responsive,
  statusIcon,
  caption,
  className,
}: {
  number: number;
  shape: TableShapeKind;
  status: TableStatus;
  selected?: boolean;
  responsive?: boolean;
  /** Icono de estado en la esquina (en vez del punto). */
  statusIcon?: boolean;
  /** Texto corto debajo de la mesa, p. ej. la hora de llegada. */
  caption?: string;
  className?: string;
}) {
  const Icon = STATUS_ICON[status];
  return (
    <div
      className={cn(
        "relative flex items-center justify-center border-2 bg-card font-semibold tabular-nums shadow-sm transition-colors",
        (responsive ? RESPONSIVE_SHAPE_CLASS : SHAPE_CLASS)[shape],
        STATUS_CLASS[status],
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        status === "blocked" && "bg-[repeating-linear-gradient(45deg,var(--table-blocked)_0px,var(--table-blocked)_1px,transparent_1px,transparent_6px)] bg-blend-multiply opacity-90",
        className,
      )}
    >
      <span className="text-foreground">{number}</span>
      {statusIcon ? (
        <span
          aria-hidden
          className={cn(
            "absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border-2 border-background text-background",
            STATUS_ICON_BG[status],
          )}
        >
          <Icon className="size-3" strokeWidth={3} />
        </span>
      ) : (
        <TableStatusDot status={status} className="absolute -right-1 -top-1 border border-background" />
      )}
      {caption && (
        <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-background/80 px-1 text-[11px] font-semibold leading-4 text-table-reserved">
          {caption}
        </span>
      )}
    </div>
  );
}
