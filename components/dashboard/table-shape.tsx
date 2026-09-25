import { cn } from "@/lib/utils";
import { TableStatusDot } from "@/components/dashboard/table-status-dot";
import type { TableStatus } from "@/lib/reservations/status";
import type { TableShape as TableShapeKind } from "@/types/database.types";

const SHAPE_CLASS: Record<TableShapeKind, string> = {
  round: "rounded-full size-14",
  square: "rounded-lg size-14",
  rectangular: "rounded-lg w-20 h-12",
};

// Plano de Home en móvil: comparte ancho con las próximas llegadas, así que
// las mesas encogen por debajo de sm y recuperan su tamaño desde sm.
const RESPONSIVE_SHAPE_CLASS: Record<TableShapeKind, string> = {
  round: "rounded-full size-8 text-xs sm:size-14 sm:text-base",
  square: "rounded-md size-8 text-xs sm:rounded-lg sm:size-14 sm:text-base",
  rectangular: "rounded-md w-11 h-7 text-xs sm:rounded-lg sm:w-20 sm:h-12 sm:text-base",
};

const STATUS_CLASS: Record<TableStatus, string> = {
  available: "bg-table-available/10 border-table-available text-table-available",
  reserved: "bg-table-reserved/10 border-table-reserved text-table-reserved",
  occupied: "bg-table-occupied/10 border-table-occupied text-table-occupied",
  blocked: "bg-table-blocked/10 border-table-blocked text-table-blocked",
};

export function TableShape({
  number,
  shape,
  status,
  selected,
  responsive,
  className,
}: {
  number: number;
  shape: TableShapeKind;
  status: TableStatus;
  selected?: boolean;
  responsive?: boolean;
  className?: string;
}) {
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
      <TableStatusDot status={status} className="absolute -right-1 -top-1 border border-background" />
    </div>
  );
}
