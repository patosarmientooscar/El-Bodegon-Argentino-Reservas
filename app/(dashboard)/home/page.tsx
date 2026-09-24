import { getDashboardContext } from "@/lib/dashboard/context";
import { getDayRange } from "@/lib/reservations/date";
import { HomeClient } from "@/components/dashboard/home-client";

export default async function HomePage() {
  const { supabase, restaurant, settings } = await getDashboardContext();
  const { start, end } = getDayRange(new Date());

  const [{ data: tables }, { data: reservations }] = await Promise.all([
    supabase.from("tables").select("*").eq("restaurant_id", restaurant.id).order("number"),
    supabase
      .from("reservations")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .gte("start_time", start)
      .lt("start_time", end)
      .order("start_time"),
  ]);

  return (
    <HomeClient
      restaurantId={restaurant.id}
      tables={tables ?? []}
      initialReservations={reservations ?? []}
      bufferMinutes={settings.reservation_buffer_minutes}
      maxPartySize={settings.max_party_size}
      defaultDurationMinutes={settings.default_reservation_duration_minutes}
      dayStart={start}
      dayEnd={end}
    />
  );
}
