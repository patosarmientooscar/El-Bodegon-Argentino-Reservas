import { getDashboardContext } from "@/lib/dashboard/context";
import { SettingsClient, type SettingsTab } from "@/components/settings/settings-client";
import { PushNotificationsCard } from "@/components/settings/push-notifications-card";

const TABS: SettingsTab[] = ["online", "hours", "special", "team", "notifications", "tables", "profile"];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
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
          El resto de Ajustes (horarios, reservas online, equipo…) es solo para administradores.
        </p>
      </div>
    );
  }

  const { tab } = await searchParams;
  const initialTab = TABS.includes(tab as SettingsTab) ? (tab as SettingsTab) : "online";

  const [{ data: tables }, { data: serviceHours }, { data: specialDates }, { data: users }, pauseProbe, hoursProbe] =
    await Promise.all([
      supabase.from("tables").select("*").eq("restaurant_id", restaurant.id).order("number"),
      supabase.from("service_hours").select("*").eq("restaurant_id", restaurant.id),
      supabase.from("special_dates").select("*").eq("restaurant_id", restaurant.id).order("date"),
      supabase.from("users").select("*").eq("restaurant_id", restaurant.id).order("name"),
      // ¿Está pegado PEGAR_AJUSTES.sql? Si falta la columna, la consulta da error.
      supabase.from("restaurant_settings").select("online_paused_until").limit(1),
      supabase.from("special_dates").select("open_time").limit(1),
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
      initialTab={initialTab}
      features={{ pause: !pauseProbe.error, specialHours: !hoursProbe.error }}
    />
  );
}
