import { cn } from "@/lib/utils";
import type { TableStatus } from "@/lib/reservations/status";

const STATUS_VAR: Record<TableStatus, string> = {
  available: "var(--table-available)",
  reserved: "var(--table-reserved)",
  occupied: "var(--table-occupied)",
  blocked: "var(--table-blocked)",
};

/**
 * Nunca solo color: cada estado tiene también una forma distinta (relleno
 * sólido, anillo, hueco o rayado diagonal) para que se lea igual con
 * daltonismo o con mala luz en sala.
 */
export function TableStatusDot({ status, className }: { status: TableStatus; className?: string }) {
  const color = STATUS_VAR[status];

  if (status === "occupied") {
    return (
      <span
        aria-hidden
        className={cn("inline-block size-2.5 rounded-full", className)}
        style={{ backgroundColor: color }}
      />
    );
  }

  if (status === "reserved") {
    return (
      <span
        aria-hidden
        className={cn("inline-block size-2.5 rounded-full ring-2 ring-offset-1 ring-offset-background", className)}
        style={{ backgroundColor: color, ["--tw-ring-color" as string]: color }}
      />
    );
  }

  if (status === "blocked") {
    return (
      <span
        aria-hidden
        className={cn("inline-block size-2.5 rounded-full border", className)}
        style={{
          borderColor: color,
          backgroundImage: `repeating-linear-gradient(45deg, ${color}, ${color} 1.5px, transparent 1.5px, transparent 3px)`,
        }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn("inline-block size-2.5 rounded-full border-2 bg-transparent", className)}
      style={{ borderColor: color }}
    />
  );
}
