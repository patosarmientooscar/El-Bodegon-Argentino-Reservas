"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, CirclePause, Clock, Map as MapIcon, Plus } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FloorPlanCanvas } from "@/components/dashboard/floor-plan";
import { ReservationFormDialog } from "@/components/dashboard/reservation-form-dialog";
import { usePendingReservations } from "@/components/dashboard/pending-provider";
import { ReservationDetailSheet } from "@/components/reservations/reservation-detail-sheet";
import { DaySwitcher } from "@/components/today/day-switcher";
import { ReservationCard } from "@/components/today/reservation-card";
import { useRealtimeReservations } from "@/hooks/use-realtime-reservations";
import { createClient } from "@/lib/supabase/client";
import { formatDateLong, formatTime, isoDate } from "@/lib/reservations/date";
import { pauseState } from "@/lib/settings/online";
import type { ReservationRow, TableRow } from "@/lib/reservations/status";
import type { ReservationStatus } from "@/types/database.types";

const TICK_MS = 30_000;
/** Durante este tiempo, los avisos en pantalla ignoran los cambios hechos desde este móvil. */
const SELF_CHANGE_MS = 10_000;

const DONE_MESSAGE: Partial<Record<ReservationStatus, string>> = {
  confirmed: "Reserva aceptada",
  cancelled: "Reserva rechazada",
  seated: "Marcada: ha llegado",
  no_show: "Marcada: no vino",
};

const byTime = (a: ReservationRow, b: ReservationRow) => a.start_time.localeCompare(b.start_time);

/**
 * Pantalla "Hoy" (Home): contadores, pendientes primero con Aceptar/Rechazar,
 * el resto por hora, canceladas plegadas al final y plano de mesas. Todo se
 * actualiza solo con Realtime; los cambios de estado se ven al momento
 * (optimista) y, si fallan, vuelven atrás con un aviso.
 */
export function TodayClient({
  restaurantId,
  tables,
  initialReservations,
  selectedDateIso,
  serverTodayIso,
  dayStart,
  dayEnd,
  highlightId,
  maxPartySize,
  defaultDurationMinutes,
  onlinePausedUntil,
}: {
  restaurantId: string;
  tables: TableRow[];
  initialReservations: ReservationRow[];
  selectedDateIso: string;
  serverTodayIso: string;
  dayStart: string;
  dayEnd: string;
  highlightId: string | null;
  maxPartySize: number;
  defaultDurationMinutes: number;
  /** restaurant_settings.online_paused_until (null si activas o sin el SQL de la Fase 5). */
  onlinePausedUntil: string | null;
}) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const [now, setNow] = useState(() => new Date());
  // "Hoy" según el reloj del móvil (el servidor puede ir en otra zona horaria).
  const [todayIso, setTodayIso] = useState(serverTodayIso);
  const [selectedId, setSelectedId] = useState<string | null>(highlightId);
  const [overrides, setOverrides] = useState<Record<string, ReservationStatus>>({});
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());
  const [showClosed, setShowClosed] = useState(false);
  const selfChangesRef = useRef(new Map<string, number>());

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(d);
      setTodayIso(isoDate(d));
    };
    tick();
    const interval = setInterval(tick, TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const inRange = (row: ReservationRow) => row.start_time >= dayStart && row.start_time < dayEnd;
  const isSelfChange = (id: string) => Date.now() - (selfChangesRef.current.get(id) ?? 0) < SELF_CHANGE_MS;

  const reservations = useRealtimeReservations({
    restaurantId,
    initial: initialReservations,
    isInRange: inRange,
    onChange: (event) => {
      if (event.type === "insert" && inRange(event.row)) {
        toast.info(`Nueva reserva: ${event.row.customer_name}`, {
          description: `${event.row.party_size} pers. · ${formatTime(event.row.start_time)}`,
        });
      } else if (
        event.type === "update" &&
        event.previous.status !== "cancelled" &&
        event.row.status === "cancelled" &&
        !isSelfChange(event.row.id)
      ) {
        toast.warning(`Cancelada: ${event.row.customer_name}`, { description: formatTime(event.row.start_time) });
      }
    },
  });

  // Cuando Realtime trae el estado nuevo, el cambio optimista ya no hace falta.
  useEffect(() => {
    setOverrides((current) => {
      let changed = false;
      const next = { ...current };
      for (const r of reservations) {
        if (next[r.id] && next[r.id] === r.status) {
          delete next[r.id];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [reservations]);

  const view = useMemo(
    () => reservations.map((r) => (overrides[r.id] ? { ...r, status: overrides[r.id] } : r)),
    [reservations, overrides],
  );

  const pending = view.filter((r) => r.status === "pending").sort(byTime);
  const active = view.filter((r) => r.status === "confirmed" || r.status === "seated").sort(byTime);
  const closed = view.filter((r) => r.status === "cancelled" || r.status === "no_show").sort(byTime);
  const guests = [...pending, ...active].reduce((sum, r) => sum + r.party_size, 0);
  const arrived = active.filter((r) => r.status === "seated").length;

  const isToday = selectedDateIso === todayIso;
  const pause = pauseState(onlinePausedUntil, now);
  const tableNumber = useMemo(() => new Map(tables.map((t) => [t.id, t.number])), [tables]);

  // Pendientes de otros días (para no dejarse ninguna sin aceptar).
  const pendingElsewhere = usePendingReservations().filter(
    (p) => !(p.start_time >= dayStart && p.start_time < dayEnd),
  );

  // Desde una notificación (/home?id=…): abre el detalle y lleva a su tarjeta.
  useEffect(() => {
    if (!highlightId) return;
    setSelectedId(highlightId);
    document.getElementById(`reserva-${highlightId}`)?.scrollIntoView({ block: "center" });
  }, [highlightId]);

  function goTo(iso: string) {
    startNavigation(() => router.push(iso === todayIso ? "/home" : `/home?date=${iso}`, { scroll: false }));
  }

  function setBusy(id: string, on: boolean) {
    setBusyIds((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function changeStatus(r: ReservationRow, next: ReservationStatus, isUndo = false) {
    const from = r.status;
    setBusy(r.id, true);
    setOverrides((current) => ({ ...current, [r.id]: next }));
    selfChangesRef.current.set(r.id, Date.now());

    // Solo si sigue en el estado que se ve en pantalla (otro móvil podría haberla cambiado).
    const { data, error } = await createClient()
      .from("reservations")
      .update({ status: next })
      .eq("id", r.id)
      .eq("status", from)
      .select("id")
      .maybeSingle();
    setBusy(r.id, false);

    if (error || !data) {
      setOverrides((current) => {
        const rest = { ...current };
        delete rest[r.id];
        return rest;
      });
      if (error) {
        toast.error("No se pudo guardar el cambio. Inténtalo otra vez.", { description: error.message });
      } else {
        toast.error("Esta reserva ya había cambiado desde otro dispositivo.", { description: "Se ha actualizado la lista." });
        router.refresh();
      }
      return;
    }

    if (isUndo) {
      toast.success("Cambio deshecho");
    } else {
      toast.success(`${DONE_MESSAGE[next] ?? "Reserva actualizada"} · ${r.customer_name}`, {
        action: { label: "Deshacer", onClick: () => changeStatus({ ...r, status: next }, from, true) },
      });
    }
  }

  const selectedReservation = view.find((r) => r.id === selectedId) ?? null;

  const card = (r: ReservationRow) => (
    <ReservationCard
      key={r.id}
      reservation={r}
      tableNumber={r.table_id ? (tableNumber.get(r.table_id) ?? null) : null}
      busy={busyIds.has(r.id)}
      highlighted={r.id === highlightId}
      onOpen={() => setSelectedId(r.id)}
      onSetStatus={(next) => changeStatus(r, next)}
    />
  );

  const newReservationDialog = (trigger: React.ReactNode) => (
    <ReservationFormDialog
      restaurantId={restaurantId}
      tables={tables}
      maxPartySize={maxPartySize}
      defaultDurationMinutes={defaultDurationMinutes}
      defaultDate={new Date(`${selectedDateIso}T00:00:00`)}
      onCreated={() => router.refresh()}
      trigger={trigger}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{isToday ? "Hoy" : "Reservas del día"}</h1>
          <p className="text-base text-muted-foreground first-letter:uppercase">
            {formatDateLong(new Date(`${selectedDateIso}T00:00:00`))}
            {isToday && (
              <span className="tabular-nums">
                {" "}
                · {now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <DaySwitcher selectedDateIso={selectedDateIso} todayIso={todayIso} onChange={goTo} />
          {newReservationDialog(
            <Button className="hidden h-11 text-base md:inline-flex">
              <Plus className="size-5" /> Nueva reserva
            </Button>,
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <a
          href="#pendientes"
          className={cn(
            "flex flex-col rounded-xl border bg-card p-3 sm:p-4",
            pending.length > 0 && "border-amber-400/70 bg-amber-400/15 text-amber-200",
          )}
        >
          <span className="flex items-center gap-1.5 text-3xl font-bold tabular-nums leading-none">
            {pending.length}
            {pending.length > 0 && <span aria-hidden className="size-2.5 animate-pulse rounded-full bg-amber-400" />}
          </span>
          <span className={cn("mt-1.5 text-sm font-medium", pending.length > 0 ? "text-amber-200" : "text-muted-foreground")}>
            Pendientes
          </span>
        </a>
        <div className="flex flex-col rounded-xl border bg-card p-3 sm:p-4">
          <span className="text-3xl font-bold tabular-nums leading-none">{active.length}</span>
          <span className="mt-1.5 text-sm font-medium text-muted-foreground">
            Confirmadas
            {arrived > 0 && <span className="block text-xs font-normal">{arrived} ya {arrived === 1 ? "ha" : "han"} llegado</span>}
          </span>
        </div>
        <div className="flex flex-col rounded-xl border bg-card p-3 sm:p-4">
          <span className="text-3xl font-bold tabular-nums leading-none">{guests}</span>
          <span className="mt-1.5 text-sm font-medium text-muted-foreground">{isToday ? "Comensales hoy" : "Comensales"}</span>
        </div>
      </div>

      {pause.paused && (
        <div
          role="status"
          className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border-2 border-amber-400/60 bg-amber-400/10 px-3 py-2 text-[15px] text-amber-100"
        >
          <CirclePause className="size-5 shrink-0 text-amber-300" />
          <span className="flex-1">
            <strong className="font-semibold">Reservas online en pausa</strong> {pause.label}. Web y WhatsApp no aceptan reservas.
          </span>
          <Link href="/settings?tab=online" className="flex min-h-11 items-center font-semibold text-amber-300 underline-offset-4 hover:underline">
            Cambiar
          </Link>
        </div>
      )}

      {pendingElsewhere.length > 0 && (
        <button
          type="button"
          onClick={() => goTo(isoDate(new Date(pendingElsewhere[0].start_time)))}
          className="flex min-h-12 items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-left text-[15px] text-amber-100"
        >
          <Clock className="size-5 shrink-0 text-amber-300" />
          <span className="flex-1">
            {pendingElsewhere.length === 1
              ? "Hay 1 reserva pendiente de aceptar otro día"
              : `Hay ${pendingElsewhere.length} reservas pendientes de aceptar otros días`}
          </span>
          <span className="shrink-0 font-semibold capitalize text-amber-300">
            Ver{" "}
            {new Date(pendingElsewhere[0].start_time).toLocaleDateString("es-ES", { weekday: "short", day: "numeric" })} →
          </span>
        </button>
      )}

      <div
        className={cn(
          "grid items-start gap-6 transition-opacity lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
          navigating && "opacity-50",
        )}
      >
        <div className="flex flex-col gap-5">
          {pending.length > 0 && (
            <section id="pendientes" className="flex scroll-mt-4 flex-col gap-2">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-amber-300">
                <Clock className="size-5" /> Pendientes de aceptar ({pending.length})
              </h2>
              {pending.map(card)}
            </section>
          )}

          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">
                {pending.length > 0 ? "Resto de reservas" : "Reservas"} ({active.length})
              </h2>
              {isToday && tables.length > 0 && (
                <a href="#plano" className="flex min-h-11 items-center gap-1.5 px-1 text-base text-primary lg:hidden">
                  <MapIcon className="size-4" /> Ver plano
                </a>
              )}
            </div>
            {active.length > 0 ? (
              active.map(card)
            ) : (
              <p className="rounded-xl border border-dashed px-4 py-8 text-center text-base text-muted-foreground">
                {pending.length > 0 ? "No hay más reservas confirmadas." : "No hay reservas para este día."}
              </p>
            )}
          </section>

          {closed.length > 0 && (
            <section className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowClosed((v) => !v)}
                aria-expanded={showClosed}
                className="flex min-h-11 items-center gap-1.5 self-start text-base font-medium text-muted-foreground hover:text-foreground"
              >
                <ChevronDown className={cn("size-5 transition-transform", !showClosed && "-rotate-90")} />
                Canceladas y no vinieron ({closed.length})
              </button>
              {showClosed && closed.map(card)}
            </section>
          )}
        </div>

        <section id="plano" className="flex scroll-mt-4 flex-col gap-2 lg:sticky lg:top-4">
          <h2 className="text-lg font-semibold">
            Plano de mesas
            {isToday && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ahora, {now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </h2>
          {isToday ? (
            <FloorPlanCanvas tables={tables} reservations={view} now={now} onSelectReservation={setSelectedId} />
          ) : (
            <p className="rounded-xl border border-dashed px-4 py-6 text-center text-base text-muted-foreground">
              El plano en vivo solo se muestra para hoy.
            </p>
          )}
        </section>
      </div>

      {newReservationDialog(
        <Button
          size="icon"
          aria-label="Nueva reserva"
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-30 size-14 rounded-full shadow-lg md:hidden"
        >
          <Plus className="size-7" />
        </Button>,
      )}

      <ReservationDetailSheet
        reservation={selectedReservation}
        tables={tables}
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (open) return;
          setSelectedId(null);
          // Quita ?id= de la URL para que la misma reserva se pueda volver a abrir.
          if (highlightId) router.replace(isToday ? "/home" : `/home?date=${selectedDateIso}`, { scroll: false });
        }}
      />
    </div>
  );
}
