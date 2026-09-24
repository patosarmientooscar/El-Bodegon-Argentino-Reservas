import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type RestaurantSettings = Database["public"]["Tables"]["restaurant_settings"]["Row"];

export const DEFAULT_SETTINGS: Omit<RestaurantSettings, "id" | "restaurant_id"> = {
  reservation_buffer_minutes: 30,
  min_lead_time_minutes: 60,
  max_advance_days: 30,
  max_party_size: 12,
  default_reservation_duration_minutes: 90,
  default_view: "list",
  deposit_policy: null,
  notification_settings: null,
  web_max_party_size: 4,
};

/**
 * Carga sesión + perfil + restaurante + ajustes una sola vez por request
 * (memoizado con React cache) — layout.tsx y cada page.tsx la llaman sin
 * duplicar la consulta a Supabase.
 */
export const getDashboardContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Una sola consulta anidada (en vez de perfil + ajustes por separado) — se
  // ejecuta en cada navegación dentro del panel, así que cada viaje de ida y
  // vuelta a Supabase que se evita aquí se nota en todas las páginas.
  const { data: profile } = await supabase
    .from("users")
    .select(
      "id, name, role, restaurant_id, restaurants(id, name, logo_url, address, phone, slug, created_at, restaurant_settings(*))",
    )
    .eq("id", user.id)
    .single();

  if (!profile || !profile.restaurant_id || !profile.restaurants) {
    redirect("/login");
  }

  const { restaurant_settings: settingsRow, ...restaurant } = profile.restaurants;
  const settings: RestaurantSettings =
    settingsRow ?? { id: "", restaurant_id: profile.restaurant_id, ...DEFAULT_SETTINGS };

  return {
    supabase,
    userId: user.id,
    profile: {
      id: profile.id,
      name: profile.name,
      role: profile.role,
      restaurantId: profile.restaurant_id,
    },
    restaurant,
    settings,
  };
});
