import { getDashboardContext } from "@/lib/dashboard/context";
import { SettingsClient } from "@/components/settings/settings-client";

export default async function SettingsPage() {
  const { supabase, profile, restaurant, settings } = await getDashboardContext();

  if (profile.role !== "admin") {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Ajustes es solo para administradores.</p>
        <p>Habla con un admin del restaurante si necesitas cambiar algo aquí.</p>
      </div>
    );
  }

  const [{ data: tables }, { data: serviceHours }, { data: specialDates }, { data: users }] = await Promise.all([
    supabase.from("tables").select("*").eq("restaurant_id", restaurant.id).order("number"),
    supabase.from("service_hours").select("*").eq("restaurant_id", restaurant.id),
    supabase.from("special_dates").select("*").eq("restaurant_id", restaurant.id).order("date"),
    supabase.from("users").select("*").eq("restaurant_id", restaurant.id).order("name"),
  ]);

  return (
    <SettingsClient
      restaurant={restaurant}
      settings={settings}
      tables={tables ?? []}
      serviceHours={serviceHours ?? []}
      specialDates={specialDates ?? []}
      users={users ?? []}
      currentUserId={profile.id}
    />
  );
}
