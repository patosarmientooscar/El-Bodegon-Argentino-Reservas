import { getDashboardContext } from "@/lib/dashboard/context";
import { SettingsClient } from "@/components/settings/settings-client";
import { PushNotificationsCard } from "@/components/settings/push-notifications-card";

export default async function SettingsPage() {
  const { supabase, profile, restaurant, settings } = await getDashboardContext();

  // Personal (staff): solo puede activar los avisos en su propio móvil.
  if (profile.role !== "admin") {
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        <h1 className="text-xl font-semibold">Ajustes</h1>
        <PushNotificationsCard
          restaurantId={restaurant.id}
          currentUserId={profile.id}
          vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? null}
        />
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
          El resto de Ajustes (mesas, turnos, reglas, usuarios…) es solo para administradores.
        </p>
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
      vapidPublicKey={process.env.VAPID_PUBLIC_KEY ?? null}
    />
  );
}
