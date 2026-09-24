import { getDashboardContext } from "@/lib/dashboard/context";
import { getDayRange, isoDate } from "@/lib/reservations/date";
import { ReservationsClient } from "@/components/reservations/reservations-client";

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; id?: string }>;
}) {
  const params = await searchParams;
  const { supabase, restaurant, settings } = await getDashboardContext();

  const selectedDate = params.date ? new Date(`${params.date}T00:00:00`) : new Date();
  const { start, end } = getDayRange(selectedDate);

  const [{ data: tables }, { data: reservations }, { data: serviceHours }] = await Promise.all([
    supabase.from("tables").select("*").eq("restaurant_id", restaurant.id).order("number"),
    supabase
      .from("reservations")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .gte("start_time", start)
      .lt("start_time", end)
      .order("start_time"),
    supabase.from("service_hours").select("*").eq("restaurant_id", restaurant.id),
  ]);

  return (
    <ReservationsClient
      restaurantId={restaurant.id}
      tables={tables ?? []}
      initialReservations={reservations ?? []}
      serviceHours={serviceHours ?? []}
      maxPartySize={settings.max_party_size}
      defaultDurationMinutes={settings.default_reservation_duration_minutes}
      defaultView={settings.default_view}
      selectedDateIso={isoDate(selectedDate)}
      dayStart={start}
      dayEnd={end}
      highlightId={params.id ?? null}
    />
  );
}
