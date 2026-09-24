"use client";

import { useState } from "react";
import { Building2, LayoutGrid, Clock, SlidersHorizontal, Bell, Users, CalendarOff } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileTab } from "@/components/settings/profile-tab";
import { TableEditorTab } from "@/components/settings/table-editor-tab";
import { HoursTab } from "@/components/settings/hours-tab";
import { RulesTab } from "@/components/settings/rules-tab";
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

const TABS = [
  { value: "profile", label: "Perfil", icon: Building2 },
  { value: "tables", label: "Mesas", icon: LayoutGrid },
  { value: "hours", label: "Turnos", icon: Clock },
  { value: "rules", label: "Reglas", icon: SlidersHorizontal },
  { value: "notifications", label: "Notificaciones", icon: Bell },
  { value: "users", label: "Usuarios", icon: Users },
  { value: "blocks", label: "Bloqueos", icon: CalendarOff },
] as const;

export function SettingsClient({
  restaurant,
  settings,
  tables,
  serviceHours,
  specialDates,
  users,
  currentUserId,
}: {
  restaurant: Restaurant;
  settings: RestaurantSettings;
  tables: TableRow[];
  serviceHours: ServiceHourRow[];
  specialDates: SpecialDateRow[];
  users: UserRow[];
  currentUserId: string;
}) {
  const [tab, setTab] = useState<string>("profile");

  return (
    <Tabs value={tab} onValueChange={setTab} orientation="vertical" className="items-start gap-4 sm:flex-row">
      <TabsList variant="line" className="w-full shrink-0 sm:w-44">
        {TABS.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            <t.icon className="size-4" />
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <div className="min-w-0 flex-1">
        <TabsContent value="profile">
          <ProfileTab restaurant={restaurant} />
        </TabsContent>
        <TabsContent value="tables">
          <TableEditorTab restaurantId={restaurant.id} initialTables={tables} />
        </TabsContent>
        <TabsContent value="hours">
          <HoursTab restaurantId={restaurant.id} initialServiceHours={serviceHours} />
        </TabsContent>
        <TabsContent value="rules">
          <RulesTab settings={settings} />
        </TabsContent>
        <TabsContent value="notifications">
          <NotificationsTab settings={settings} />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab users={users} currentUserId={currentUserId} />
        </TabsContent>
        <TabsContent value="blocks">
          <BlocksTab restaurantId={restaurant.id} initialSpecialDates={specialDates} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
