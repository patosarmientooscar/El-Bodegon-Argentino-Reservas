"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { hasTableOverlap } from "@/lib/reservations/overlap";
import type { ReservationRow, TableRow } from "@/lib/reservations/status";

const PX_PER_MINUTE = 1.6;
const SNAP_MINUTES = 15;
const ROW_HEIGHT = 44;
const LABEL_WIDTH = 88;

function minutesToLabel(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function reservationMinutes(reservation: ReservationRow): { start: number; end: number } {
  const d = new Date(reservation.start_time);
  const start = d.getHours() * 60 + d.getMinutes();
  return { start, end: start + reservation.duration_minutes };
}

function overlapsAny(reservation: ReservationRow, sameTable: ReservationRow[]): boolean {
  const range = reservationMinutes(reservation);
  return sameTable.some((other) => {
    if (other.id === reservation.id) return false;
    const otherRange = reservationMinutes(other);
    return range.start < otherRange.end && otherRange.start < range.end;
  });
}

export function ReservationsGrid({
  tables,
  reservations,
  windowStart,
  windowEnd,
  selectedDateIso,
  onSelect,
  onMove,
}: {
  tables: TableRow[];
  reservations: ReservationRow[];
  windowStart: number;
  windowEnd: number;
  selectedDateIso: string;
  onSelect: (id: string) => void;
  onMove: (reservationId: string, tableId: string, newStartIso: string) => Promise<void>;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const totalWidth = (windowEnd - windowStart) * PX_PER_MINUTE;

  const ticks = useMemo(() => {
    const result: number[] = [];
    const first = Math.ceil(windowStart / 30) * 30;
    for (let m = first; m <= windowEnd; m += 30) result.push(m);
    return result;
  }, [windowStart, windowEnd]);

  const unassigned = reservations.filter((r) => !r.table_id);
  const byTable = new Map<string, ReservationRow[]>();
  for (const table of tables) byTable.set(table.id, []);
  for (const r of reservations) {
    if (r.table_id && byTable.has(r.table_id)) byTable.get(r.table_id)!.push(r);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>, tableId: string) {
    event.preventDefault();
    const reservationId = event.dataTransfer.getData("text/plain");
    const reservation = reservations.find((r) => r.id === reservationId);
    setDraggingId(null);
    if (!reservation) return;

    const rowEl = event.currentTarget;
    const rect = rowEl.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const rawMinutes = windowStart + offsetX / PX_PER_MINUTE;
    const snapped = Math.round(rawMinutes / SNAP_MINUTES) * SNAP_MINUTES;

    const newStart = new Date(`${selectedDateIso}T00:00:00`);
    newStart.setMinutes(snapped);

    const candidate = {
      id: reservation.id,
      table_id: tableId,
      start_time: newStart.toISOString(),
      duration_minutes: reservation.duration_minutes,
    };

    if (hasTableOverlap(candidate, reservations)) {
      toast.error("Esa mesa ya tiene una reserva en ese horario.");
      return;
    }

    void onMove(reservation.id, tableId, newStart.toISOString());
  }

  function renderBlock(reservation: ReservationRow, sameRowReservations: ReservationRow[]) {
    const { start, end } = reservationMinutes(reservation);
    const left = (start - windowStart) * PX_PER_MINUTE;
    const width = Math.max((end - start) * PX_PER_MINUTE, 24);
    const overlapping = overlapsAny(reservation, sameRowReservations);

    return (
      <div
        key={reservation.id}
        draggable
        onDragStart={(e) => {
          setDraggingId(reservation.id);
          e.dataTransfer.setData("text/plain", reservation.id);
        }}
        onDragEnd={() => setDraggingId(null)}
        onClick={() => onSelect(reservation.id)}
        className={cn(
          "absolute top-1 bottom-1 flex cursor-grab flex-col justify-center overflow-hidden rounded-md border bg-card px-2 text-xs shadow-sm active:cursor-grabbing",
          overlapping ? "border-2 border-destructive" : "border-border",
          draggingId === reservation.id && "opacity-50",
        )}
        style={{ left, width }}
        title={`${reservation.customer_name} · ${reservation.party_size}p`}
      >
        <span className="truncate font-medium">{reservation.customer_name}</span>
        <span className="truncate text-muted-foreground">{reservation.party_size}p</span>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <div style={{ width: totalWidth + LABEL_WIDTH }}>
        {/* Cabecera de horas */}
        <div className="sticky top-0 z-10 flex border-b bg-card" style={{ height: 32 }}>
          <div style={{ width: LABEL_WIDTH }} className="shrink-0 border-r" />
          <div className="relative flex-1" style={{ width: totalWidth }}>
            {ticks.map((m) => (
              <span
                key={m}
                className="absolute top-1.5 text-[11px] text-muted-foreground tabular-nums"
                style={{ left: (m - windowStart) * PX_PER_MINUTE }}
              >
                {minutesToLabel(m)}
              </span>
            ))}
          </div>
        </div>

        {unassigned.length > 0 && (
          <div className="flex border-b bg-amber-50/40" style={{ height: ROW_HEIGHT }}>
            <div style={{ width: LABEL_WIDTH }} className="flex shrink-0 items-center border-r px-2 text-xs font-medium text-muted-foreground">
              Sin mesa
            </div>
            <div
              className="relative flex-1"
              style={{ width: totalWidth }}
              onDragOver={(e) => e.preventDefault()}
            >
              {unassigned.map((r) => renderBlock(r, unassigned))}
            </div>
          </div>
        )}

        {tables.map((table) => {
          const rowReservations = byTable.get(table.id) ?? [];
          return (
            <div key={table.id} className="flex border-b last:border-b-0" style={{ height: ROW_HEIGHT }}>
              <div style={{ width: LABEL_WIDTH }} className="flex shrink-0 items-center border-r px-2 text-xs font-medium">
                Mesa {table.number} <span className="ml-1 text-muted-foreground">({table.capacity}p)</span>
              </div>
              <div
                className="relative flex-1"
                style={{ width: totalWidth }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, table.id)}
              >
                {ticks.map((m) => (
                  <span
                    key={m}
                    className="absolute top-0 bottom-0 border-l border-dashed border-border/60"
                    style={{ left: (m - windowStart) * PX_PER_MINUTE }}
                  />
                ))}
                {rowReservations.map((r) => renderBlock(r, rowReservations))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
