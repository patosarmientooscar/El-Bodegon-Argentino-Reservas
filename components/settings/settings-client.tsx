"use client";

import { useState } from "react";
import { Bell, Building2, CalendarClock, Clock, Globe, LayoutGrid, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileTab } from "@/components/settings/profile-tab";
import { TableEditorTab } from "@/components/settings/table-editor-tab";
import { HoursTab } from "@/components/settings/hours-tab";
import { OnlineTab } from "@/components/settings/online-tab";
import { NotificationsTab } from "@/components/settings/notifications-tab";
import { UsersTab } from "@/components/settings/users-tab";
import { BlocksTab } from "@/components/settings/blocks-tab";
import type { RestaurantSettings } from "@/lib/dashboard/context";
import type { TableRow } from "@/lib/reservations/status";
import type { ServiceHourRow } from "@/lib/reservations/service-hours";
import type { Database } from "@/types/database.types";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];
type SpecialDateRow = Database["public"]["Tables"]["special_dates"]["Row"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];

export const SETTINGS_TABS = [
  { value: "online", label: "Reservas online", icon: Globe },
  { value: "hours", label: "Horarios", icon: Clock },
  { value: "special", label: "Días especiales", icon: CalendarClock },
  { value: "team", label: "Equipo", icon: Users },
  { value: "notifications", label: "Avisos", icon: Bell },
  { value: "tables", label: "Mesas", icon: LayoutGrid },
  { value: "profile", label: "Perfil", icon: Building2 },
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number]["value"];

export function SettingsClient({
  restaurant,
  settings,
  tables,
  serviceHours,
  specialDates,
  users,
  currentUserId,
  vapidPublicKey,
  initialTab,
  features,
}: {
  restaurant: Restaurant;
  settings: RestaurantSettings;
  tables: TableRow[];
  serviceHours: ServiceHourRow[];
  specialDates: SpecialDateRow[];
  users: UserRow[];
  currentUserId: string;
  /** Clave pública VAPID (no es secreta); null si las push no están configuradas. */
  vapidPublicKey: string | null;
  initialTab: SettingsTab;
  /** Lo que necesita PEGAR_AJUSTES.sql: false si aún no se ha pegado. */
  features: { pause: boolean; specialHours: boolean };
}) {
  const [tab, setTab] = useState<string>(initialTab);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Ajustes</h1>
      <Tabs value={tab} onValueChange={setTab} orientation="vertical" className="flex-col items-stretch gap-4 lg:flex-row lg:items-start">
        {/* Móvil y tablet en vertical: fila de botones que se desliza; pantallas anchas: columna a la izquierda. */}
        <TabsList
          variant="line"
          className="-mx-4 !h-auto w-[calc(100%+2rem)] shrink-0 !flex-row justify-start gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:w-48 lg:!flex-col lg:items-stretch lg:overflow-visible lg:px-0"
        >
          {SETTINGS_TABS.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className={cn(
                "!h-11 !w-auto shrink-0 grow-0 gap-2 rounded-full border px-4 text-base lg:!w-full data-[state=active]:border-primary data-[state=active]:bg-primary/15 data-[state=active]:text-primary",
                "lg:justify-start lg:rounded-md lg:border-transparent",
              )}
            >
              <t.icon className="size-4" />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="w-full min-w-0 flex-1 lg:max-w-3xl">
          <TabsContent value="online">
            <OnlineTab settings={settings} restaurantId={restaurant.id} phone={restaurant.phone} pauseSupported={features.pause} />
          </TabsContent>
          <TabsContent value="hours">
            <HoursTab restaurantId={restaurant.id} initialServiceHours={serviceHours} />
          </TabsContent>
          <TabsContent value="special">
            <BlocksTab restaurantId={restaurant.id} initialSpecialDates={specialDates} specialHoursSupported={features.specialHours} />
          </TabsContent>
          <TabsContent value="team">
            <UsersTab users={users} currentUserId={currentUserId} />
          </TabsContent>
          <TabsContent value="notifications">
            <NotificationsTab settings={settings} currentUserId={currentUserId} vapidPublicKey={vapidPublicKey} />
          </TabsContent>
          <TabsContent value="tables">
            <TableEditorTab restaurantId={restaurant.id} initialTables={tables} />
          </TabsContent>
          <TabsContent value="profile">
            <ProfileTab restaurant={restaurant} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
