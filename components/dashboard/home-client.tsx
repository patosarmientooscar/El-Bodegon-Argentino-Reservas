"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { FloorPlanCanvas } from "@/components/dashboard/floor-plan";
import { NextArrivals } from "@/components/dashboard/next-arrivals";
import { ReservationFormDialog } from "@/components/dashboard/reservation-form-dialog";
import { NotificationsBell, type NotificationEvent } from "@/components/dashboard/notifications-bell";
import { useRealtimeReservations } from "@/hooks/use-realtime-reservations";
import { computeDailyKpis } from "@/lib/reservations/kpis";
import { formatDateLong, formatTime } from "@/lib/reservations/date";
import type { ReservationRow, TableRow } from "@/lib/reservations/status";

const TICK_MS = 30_000;
const MAX_EVENTS = 10;

export function HomeClient({
  restaurantId,
  tables,
  initialReservations,
  bufferMinutes,
  maxPartySize,
  defaultDurationMinutes,
  dayStart,
  dayEnd,
}: {
  restaurantId: string;
  tables: TableRow[];
  initialReservations: ReservationRow[];
  bufferMinutes: number;
  maxPartySize: number;
  defaultDurationMinutes: number;
  dayStart: string;
  dayEnd: string;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const eventIdRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const reservations = useRealtimeReservations({
    restaurantId,
    initial: initialReservations,
    isInRange: (row) => row.start_time >= dayStart && row.start_time < dayEnd,
    onChange: (event) => {
      eventIdRef.current += 1;
      const id = `evt-${eventIdRef.current}`;

      if (event.type === "insert") {
        setEvents((current) =>
          [
            { id, kind: "new" as const, message: `Nueva reserva: ${event.row.customer_name} a las ${formatTime(event.row.start_time)}`, time: new Date() },
            ...current,
          ].slice(0, MAX_EVENTS),
        );
      } else if (event.type === "update") {
        if (event.previous.status !== "cancelled" && event.row.status === "cancelled") {
          setEvents((current) =>
            [
              { id, kind: "cancelled" as const, message: `Cancelación: ${event.row.customer_name} (${formatTime(event.row.start_time)})`, time: new Date() },
              ...current,
            ].slice(0, MAX_EVENTS),
          );
        } else if (event.previous.status !== "no_show" && event.row.status === "no_show") {
          setEvents((current) =>
            [
              { id, kind: "cancelled" as const, message: `No-show: ${event.row.customer_name}`, time: new Date() },
              ...current,
            ].slice(0, MAX_EVENTS),
          );
        }
      }
    },
  });

  const kpis = computeDailyKpis(reservations, tables, bufferMinutes, now);
  const pendingCount = reservations.filter((r) => r.status === "pending").length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold capitalize">{formatDateLong(now)}</h1>
          <p className="text-sm text-muted-foreground tabular-nums">
            {now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NotificationsBell events={events} pendingCount={pendingCount} />
          <ReservationFormDialog
            restaurantId={restaurantId}
            tables={tables}
            maxPartySize={maxPartySize}
            defaultDurationMinutes={defaultDurationMinutes}
            onCreated={() => router.refresh()}
            trigger={
              <Button className="hidden sm:inline-flex">
                <Plus className="size-4" />
                Nueva reserva
              </Button>
            }
          />
        </div>
      </div>

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0">
        <KpiCard label="Reservas hoy" value={kpis.totalReservations} />
        <KpiCard label="Comensales hoy" value={kpis.totalGuests} />
        <KpiCard label="Ocupación ahora" value={kpis.occupancyRate} suffix="%" />
        <KpiCard label="Cancelaciones / no-shows" value={kpis.cancellations} />
      </div>

      {/* Plano a la izquierda y próximas llegadas a la derecha, también en móvil. */}
      <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start gap-2 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <FloorPlanCanvas tables={tables} reservations={reservations} bufferMinutes={bufferMinutes} now={now} />
        <NextArrivals reservations={reservations} tables={tables} now={now} />
      </div>

      <ReservationFormDialog
        restaurantId={restaurantId}
        tables={tables}
        maxPartySize={maxPartySize}
        defaultDurationMinutes={defaultDurationMinutes}
        onCreated={() => router.refresh()}
        trigger={
          <Button size="icon" className="fixed bottom-4 right-4 size-12 rounded-full shadow-lg sm:hidden">
            <Plus className="size-5" />
          </Button>
        }
      />
    </div>
  );
}
