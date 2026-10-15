import { getDashboardContext } from "@/lib/dashboard/context";
import { getDayRange, isoDate } from "@/lib/reservations/date";
import { TodayClient } from "@/components/today/today-client";

// Pantalla "Hoy". ?date= cambia de día; ?id= abre una reserva (lo usan las notificaciones push).
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; id?: string }>;
}) {
  const params = await searchParams;
  const { supabase, restaurant, settings } = await getDashboardContext();

  const validDate = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : null;
  const selectedDate = validDate ? new Date(`${validDate}T00:00:00`) : new Date();
  const selected = getDayRange(selectedDate);
  const selectedIso = isoDate(selectedDate);

  const [{ data: tables }, { data: reservations }] = await Promise.all([
    supabase.from("tables").select("*").eq("restaurant_id", restaurant.id).order("number"),
    supabase
      .from("reservations")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .gte("start_time", selected.start)
      .lt("start_time", selected.end)
      .order("start_time"),
  ]);

  return (
    <TodayClient
      key={selectedIso}
      restaurantId={restaurant.id}
      tables={tables ?? []}
      initialReservations={reservations ?? []}
      selectedDateIso={selectedIso}
      serverTodayIso={isoDate(new Date())}
      dayStart={selected.start}
      dayEnd={selected.end}
      highlightId={params.id ?? null}
      maxPartySize={settings.max_party_size}
      defaultDurationMinutes={settings.default_reservation_duration_minutes}
    />
  );
}
