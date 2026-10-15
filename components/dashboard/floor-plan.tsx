"use client";

import { useState } from "react";

import { TableShape } from "@/components/dashboard/table-shape";
import { ReservationStatusBadge } from "@/components/dashboard/status-badges";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { computeServiceTableStatus, type ReservationRow, type TableRow } from "@/lib/reservations/status";
import { formatTime } from "@/lib/reservations/date";
import type { TableShape as TableShapeKind } from "@/types/database.types";

const SHAPE_ORDER: TableShapeKind[] = ["round", "square", "rectangular"];

/** Etiqueta encima de cada grupo: redondas = altas (3), cuadradas = para 2, rectangulares = para 4. */
function groupLabel(shape: TableShapeKind, group: TableRow[]): string {
  const capacities = [...new Set(group.map((t) => t.capacity))].sort((a, b) => a - b).join(" y ");
  return shape === "round" ? `Mesas altas · ${capacities} pers.` : `Mesas para ${capacities} pers.`;
}

// Margen lateral (en %) que queda libre a cada lado del plano.
const FIT_MARGIN_X = 12;

/**
 * Estira horizontalmente las posiciones guardadas para que las mesas ocupen
 * todo el ancho del plano, sin franja vacía a un lado. Solo afecta al dibujo
 * de Home: las posiciones de Ajustes → Mesas no cambian. La altura se respeta.
 */
function fitX(tables: TableRow[]): (x: number) => number {
  const xs = tables.map((t) => t.pos_x);
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  if (max === min) return () => 50;
  return (x) => FIT_MARGIN_X + ((x - min) / (max - min)) * (100 - 2 * FIT_MARGIN_X);
}

function minutesUntil(iso: string, now: Date): number {
  return Math.round((new Date(iso).getTime() - now.getTime()) / 60_000);
}

function endMs(r: ReservationRow): number {
  return new Date(r.start_time).getTime() + r.duration_minutes * 60_000;
}

function statusLine(result: ReturnType<typeof computeServiceTableStatus>, now: Date): string {
  if (result.status === "occupied" && result.activeReservation) {
    return `Ocupada · libera sobre las ${formatTime(new Date(endMs(result.activeReservation)).toISOString())}`;
  }
  if (result.status === "reserved" && result.upcomingReservation) {
    const mins = minutesUntil(result.upcomingReservation.start_time, now);
    return mins >= 0 ? `Reservada · llegan en ${mins} min` : `Reservada · debían llegar hace ${-mins} min`;
  }
  if (result.status === "blocked") return "Bloqueada desde Ajustes.";
  return "Libre ahora mismo.";
}

const LEGEND = [
  { label: "Libre", className: "bg-table-available" },
  { label: "Reservada (2 h) o pendiente", className: "bg-table-reserved" },
  { label: "Ocupada", className: "bg-table-occupied" },
];

/**
 * Plano del servicio (Home). Verde libre · ámbar reservada en las próximas 2 h
 * o pendiente · rojo ocupada (marcada "Ha llegado"). Cada mesa lleva número e
 * icono de estado; al tocarla se ve quién viene, a qué hora y cuántos son.
 */
export function FloorPlanCanvas({
  tables,
  reservations,
  now,
  onSelectReservation,
}: {
  tables: TableRow[];
  reservations: ReservationRow[];
  now: Date;
  onSelectReservation?: (id: string) => void;
}) {
  const [openTableId, setOpenTableId] = useState<string | null>(null);

  if (tables.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center text-sm text-muted-foreground">
        <p>Todavía no hay mesas configuradas.</p>
        <p>Añádelas desde Ajustes → Mesas.</p>
      </div>
    );
  }

  const toX = fitX(tables);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg border bg-muted/30 [--label-gap:2.25rem] sm:aspect-16/9 sm:[--label-gap:3rem]">
        {SHAPE_ORDER.map((shape) => {
          const group = tables.filter((t) => t.shape === shape);
          if (group.length === 0) return null;
          const xs = group.map((t) => toX(t.pos_x));
          const top = Math.min(...group.map((t) => t.pos_y));
          const center = (Math.min(...xs) + Math.max(...xs)) / 2;
          return (
            <span
              key={shape}
              className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap text-xs font-medium text-muted-foreground"
              // clamp: que la etiqueta de un grupo pegado al borde no se corte.
              style={{ left: `clamp(4.5rem, ${center}%, calc(100% - 4.5rem))`, top: `calc(${top}% - var(--label-gap))` }}
            >
              {groupLabel(shape, group)}
            </span>
          );
        })}
        {tables.map((table) => {
          const result = computeServiceTableStatus(table, reservations, now);
          const coming = reservations
            .filter(
              (r) =>
                r.table_id === table.id &&
                (r.status === "pending" || r.status === "confirmed" || r.status === "seated") &&
                now.getTime() < endMs(r),
            )
            .sort((a, b) => a.start_time.localeCompare(b.start_time));
          return (
            <Popover
              key={table.id}
              open={openTableId === table.id}
              onOpenChange={(open) => setOpenTableId(open ? table.id : null)}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={`Mesa ${table.number}`}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer p-1"
                  style={{ left: `${toX(table.pos_x)}%`, top: `${table.pos_y}%` }}
                >
                  <TableShape
                    number={table.number}
                    shape={table.shape}
                    responsive
                    statusIcon
                    status={result.status}
                    selected={openTableId === table.id}
                    caption={result.upcomingReservation ? formatTime(result.upcomingReservation.start_time) : undefined}
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 text-sm" side="top">
                <p className="text-base font-semibold">
                  Mesa {table.number} · {table.capacity} pers.
                </p>
                <p className="text-muted-foreground">{statusLine(result, now)}</p>
                {coming.length > 0 ? (
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {coming.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenTableId(null);
                            onSelectReservation?.(r.id);
                          }}
                          className="flex min-h-11 w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left hover:bg-accent"
                        >
                          <span className="text-base font-semibold tabular-nums">{formatTime(r.start_time)}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{r.customer_name}</span>
                            <span className="block text-xs text-muted-foreground">{r.party_size} personas</span>
                          </span>
                          <ReservationStatusBadge status={r.status} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  result.status !== "blocked" && <p className="mt-1 text-muted-foreground">Nadie más hoy en esta mesa.</p>
                )}
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {LEGEND.map((item) => (
          <li key={item.label} className="flex items-center gap-1.5">
            <span aria-hidden className={`inline-block size-3 rounded-full ${item.className}`} />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
