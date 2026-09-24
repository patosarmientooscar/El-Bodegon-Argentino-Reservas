"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { List, LayoutGrid, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateNav } from "@/components/reservations/date-nav";
import { FilterBar, EMPTY_FILTERS, type ReservationFilters } from "@/components/reservations/filter-bar";
import { ReservationsList } from "@/components/reservations/reservations-list";
import { ReservationsGrid } from "@/components/reservations/reservations-grid";
import { ReservationDetailSheet } from "@/components/reservations/reservation-detail-sheet";
import { ReservationFormDialog } from "@/components/dashboard/reservation-form-dialog";
import { useRealtimeReservations } from "@/hooks/use-realtime-reservations";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { getTurnoWindow, classifyTurno, type ServiceHourRow } from "@/lib/reservations/service-hours";
import type { ReservationRow, TableRow } from "@/lib/reservations/status";
import type { DefaultView } from "@/types/database.types";

const VIEW_STORAGE_KEY = "reservas:reservations-view";

export function ReservationsClient({
  restaurantId,
  tables,
  initialReservations,
  serviceHours,
  maxPartySize,
  defaultDurationMinutes,
  defaultView,
  selectedDateIso,
  dayStart,
  dayEnd,
  highlightId,
}: {
  restaurantId: string;
  tables: TableRow[];
  initialReservations: ReservationRow[];
  serviceHours: ServiceHourRow[];
  maxPartySize: number;
  defaultDurationMinutes: number;
  defaultView: DefaultView;
  selectedDateIso: string;
  dayStart: string;
  dayEnd: string;
  highlightId: string | null;
}) {
  const router = useRouter();
  const [view, setView] = useState<DefaultView>(defaultView);
  const [filters, setFilters] = useState<ReservationFilters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(highlightId);

  useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "list" || stored === "grid") setView(stored);
  }, []);

  function changeView(next: DefaultView) {
    setView(next);
    window.localStorage.setItem(VIEW_STORAGE_KEY, next);
  }

  const reservations = useRealtimeReservations({
    restaurantId,
    initial: initialReservations,
    isInRange: (row) => row.start_time >= dayStart && row.start_time < dayEnd,
  });

  const dayOfWeek = useMemo(() => new Date(`${selectedDateIso}T00:00:00`).getDay(), [selectedDateIso]);

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return reservations.filter((r) => {
      if (search && !r.customer_name.toLowerCase().includes(search) && !(r.customer_phone ?? "").includes(search)) {
        return false;
      }
      if (filters.statuses.length > 0 && !filters.statuses.includes(r.status)) return false;
      if (filters.turnos.length > 0 && !filters.turnos.includes(classifyTurno(r, serviceHours, dayOfWeek))) {
        return false;
      }
      if (filters.tableFilter === "unassigned" && r.table_id) return false;
      return true;
    });
  }, [reservations, filters, serviceHours, dayOfWeek]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()),
    [filtered],
  );

  const lunchReservations = useMemo(
    () => sorted.filter((r) => classifyTurno(r, serviceHours, dayOfWeek) === "lunch"),
    [sorted, serviceHours, dayOfWeek],
  );
  const dinnerReservations = useMemo(
    () => sorted.filter((r) => classifyTurno(r, serviceHours, dayOfWeek) === "dinner"),
    [sorted, serviceHours, dayOfWeek],
  );

  const lunchWindow = useMemo(
    () => getTurnoWindow(serviceHours, dayOfWeek, "lunch", reservations),
    [serviceHours, dayOfWeek, reservations],
  );
  const dinnerWindow = useMemo(
    () => getTurnoWindow(serviceHours, dayOfWeek, "dinner", reservations),
    [serviceHours, dayOfWeek, reservations],
  );

  const selectedReservation = reservations.find((r) => r.id === selectedId) ?? null;

  async function handleMove(reservationId: string, tableId: string, newStartIso: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("reservations")
      .update({ table_id: tableId, start_time: newStartIso })
      .eq("id", reservationId);

    if (error) {
      if (error.code === "23P01") {
        toast.error("Esa mesa ya tiene una reserva en ese horario.");
      } else {
        toast.error("No se pudo mover la reserva.", { description: error.message });
      }
      return;
    }
    toast.success("Reserva reasignada.");
  }

  return (
    <div className="flex flex-col gap-4 pb-20 sm:pb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <DateNav
          selectedDateIso={selectedDateIso}
          onChange={(iso) => router.push(`/reservations?date=${iso}`)}
        />
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => changeView(v as DefaultView)}>
            <TabsList>
              <TabsTrigger value="list">
                <List className="size-4" /> Lista
              </TabsTrigger>
              <TabsTrigger value="grid">
                <LayoutGrid className="size-4" /> Rejilla
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <ReservationFormDialog
            restaurantId={restaurantId}
            tables={tables}
            maxPartySize={maxPartySize}
            defaultDurationMinutes={defaultDurationMinutes}
            defaultDate={new Date(`${selectedDateIso}T00:00:00`)}
            trigger={
              <Button className="hidden sm:inline-flex">
                <Plus className="size-4" /> Nueva reserva
              </Button>
            }
          />
        </div>
      </div>

      <FilterBar filters={filters} onChange={setFilters} />

      {view === "list" ? (
        <ReservationsList reservations={sorted} tables={tables} onSelect={setSelectedId} />
      ) : (
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground">Comida</h2>
            {lunchWindow ? (
              <ReservationsGrid
                tables={tables}
                reservations={lunchReservations}
                windowStart={lunchWindow.startMinutes}
                windowEnd={lunchWindow.endMinutes}
                selectedDateIso={selectedDateIso}
                onSelect={setSelectedId}
                onMove={handleMove}
              />
            ) : (
              <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                Cerrado este día.
              </p>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground">Cena</h2>
            {dinnerWindow ? (
              <ReservationsGrid
                tables={tables}
                reservations={dinnerReservations}
                windowStart={dinnerWindow.startMinutes}
                windowEnd={dinnerWindow.endMinutes}
                selectedDateIso={selectedDateIso}
                onSelect={setSelectedId}
                onMove={handleMove}
              />
            ) : (
              <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                Cerrado este día.
              </p>
            )}
          </section>
        </div>
      )}

      <ReservationDetailSheet
        reservation={selectedReservation}
        tables={tables}
        open={selectedId !== null}
        onOpenChange={(open) => !open && setSelectedId(null)}
      />

      <ReservationFormDialog
        restaurantId={restaurantId}
        tables={tables}
        maxPartySize={maxPartySize}
        defaultDurationMinutes={defaultDurationMinutes}
        defaultDate={new Date(`${selectedDateIso}T00:00:00`)}
        trigger={
          <Button size="icon" className="fixed bottom-4 right-4 size-12 rounded-full shadow-lg sm:hidden">
            <Plus className="size-5" />
          </Button>
        }
      />
    </div>
  );
}
