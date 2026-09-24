"use client";

import { useState } from "react";

import { TableShape } from "@/components/dashboard/table-shape";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { computeAllTableStatuses, type ReservationRow, type TableRow } from "@/lib/reservations/status";
import { formatTime } from "@/lib/reservations/date";
import type { TableShape as TableShapeKind } from "@/types/database.types";

const SHAPE_ORDER: TableShapeKind[] = ["round", "square", "rectangular"];

/** Etiqueta encima de cada grupo: redondas = altas (3), cuadradas = para 2, rectangulares = para 4. */
function groupLabel(shape: TableShapeKind, group: TableRow[]): string {
  const capacities = [...new Set(group.map((t) => t.capacity))].sort((a, b) => a - b);
  const people = `${capacities.join(" y ")} pers.`;
  return shape === "round" ? `Mesas altas · ${people}` : `Mesas para ${people}`;
}

function minutesUntil(iso: string, now: Date): number {
  return Math.max(0, Math.round((new Date(iso).getTime() - now.getTime()) / 60_000));
}

export function FloorPlanCanvas({
  tables,
  reservations,
  bufferMinutes,
  now,
}: {
  tables: TableRow[];
  reservations: ReservationRow[];
  bufferMinutes: number;
  now: Date;
}) {
  const [openTableId, setOpenTableId] = useState<string | null>(null);
  const statuses = computeAllTableStatuses(tables, reservations, bufferMinutes, now);

  if (tables.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center text-sm text-muted-foreground">
        <p>Todavía no hay mesas configuradas.</p>
        <p>Añádelas desde Ajustes → Mesas.</p>
      </div>
    );
  }

  return (
    <div className="relative aspect-4/3 w-full overflow-hidden rounded-lg border bg-muted/30 sm:aspect-16/9">
      <div className="pointer-events-none absolute inset-y-0 left-[63%] w-px bg-border" aria-hidden />
      {SHAPE_ORDER.map((shape) => {
        const group = tables.filter((t) => t.shape === shape);
        if (group.length === 0) return null;
        const xs = group.map((t) => t.pos_x);
        const top = Math.min(...group.map((t) => t.pos_y));
        return (
          <span
            key={shape}
            className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap text-xs font-medium text-muted-foreground"
            style={{ left: `${(Math.min(...xs) + Math.max(...xs)) / 2}%`, top: `calc(${top}% - 3rem)` }}
          >
            {groupLabel(shape, group)}
          </span>
        );
      })}
      {tables.map((table) => {
        const result = statuses.get(table.id)!;
        return (
          <Popover
            key={table.id}
            open={openTableId === table.id}
            onOpenChange={(open) => setOpenTableId(open ? table.id : null)}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                style={{ left: `${table.pos_x}%`, top: `${table.pos_y}%` }}
              >
                <TableShape
                  number={table.number}
                  shape={table.shape}
                  status={result.status}
                  selected={openTableId === table.id}
                />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 text-sm" side="top">
              <p className="font-medium">
                Mesa {table.number} · {table.capacity} pers.
              </p>
              {result.status === "occupied" && result.activeReservation && (
                <div className="mt-1.5 text-muted-foreground">
                  <p className="text-foreground">{result.activeReservation.customer_name}</p>
                  <p>{result.activeReservation.party_size} personas</p>
                  <p>Libera a las {formatTime(new Date(new Date(result.activeReservation.start_time).getTime() + result.activeReservation.duration_minutes * 60_000).toISOString())}</p>
                </div>
              )}
              {result.status === "reserved" && result.upcomingReservation && (
                <div className="mt-1.5 text-muted-foreground">
                  <p className="text-foreground">{result.upcomingReservation.customer_name}</p>
                  <p>{result.upcomingReservation.party_size} personas</p>
                  <p>
                    Llega a las {formatTime(result.upcomingReservation.start_time)} · en{" "}
                    {minutesUntil(result.upcomingReservation.start_time, now)} min
                  </p>
                </div>
              )}
              {result.status === "available" && (
                <p className="mt-1.5 text-muted-foreground">Libre ahora mismo.</p>
              )}
              {result.status === "blocked" && (
                <p className="mt-1.5 text-muted-foreground">Bloqueada manualmente desde Ajustes.</p>
              )}
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}
