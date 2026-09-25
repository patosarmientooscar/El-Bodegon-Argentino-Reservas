import { getDashboardContext } from "@/lib/dashboard/context";
import { getDayRange, isoDate } from "@/lib/reservations/date";
import { HomeClient } from "@/components/dashboard/home-client";
import { ReservationsClient } from "@/components/reservations/reservations-client";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; id?: string }>;
}) {
  const params = await searchParams;
  const { supabase, restaurant, settings } = await getDashboardContext();

  // Plano, KPIs y próximas llegadas: siempre hoy. Reservas (debajo): el día elegido.
  const today = getDayRange(new Date());
  const selectedDate = params.date ? new Date(`${params.date}T00:00:00`) : new Date();
  const selected = getDayRange(selectedDate);
  const selectedIsToday = selected.start === today.start;

  const dayQuery = (range: { start: string; end: string }) =>
    supabase
      .from("reservations")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .gte("start_time", range.start)
      .lt("start_time", range.end)
      .order("start_time");

  const [{ data: tables }, { data: todayReservations }, selectedResult, { data: serviceHours }] = await Promise.all([
    supabase.from("tables").select("*").eq("restaurant_id", restaurant.id).order("number"),
    dayQuery(today),
    selectedIsToday ? null : dayQuery(selected),
    supabase.from("service_hours").select("*").eq("restaurant_id", restaurant.id),
  ]);
  const selectedReservations = selectedIsToday ? todayReservations : selectedResult?.data;

  return (
    <div className="flex flex-col gap-6">
      <HomeClient
        restaurantId={restaurant.id}
        tables={tables ?? []}
        initialReservations={todayReservations ?? []}
        bufferMinutes={settings.reservation_buffer_minutes}
        maxPartySize={settings.max_party_size}
        defaultDurationMinutes={settings.default_reservation_duration_minutes}
        dayStart={today.start}
        dayEnd={today.end}
      />

      <section id="reservas" className="flex scroll-mt-4 flex-col gap-3 border-t pt-6">
        <h2 className="text-lg font-semibold">Reservas</h2>
        <ReservationsClient
          restaurantId={restaurant.id}
          tables={tables ?? []}
          initialReservations={selectedReservations ?? []}
          serviceHours={serviceHours ?? []}
          maxPartySize={settings.max_party_size}
          defaultDurationMinutes={settings.default_reservation_duration_minutes}
          defaultView={settings.default_view}
          selectedDateIso={isoDate(selectedDate)}
          dayStart={selected.start}
          dayEnd={selected.end}
          highlightId={params.id ?? null}
        />
      </section>
    </div>
  );
}
