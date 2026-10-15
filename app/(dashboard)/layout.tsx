import { getDashboardContext } from "@/lib/dashboard/context";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { UpdateChecker } from "@/components/dashboard/update-checker";
import { autoLoginEnabled } from "@/lib/supabase/middleware";
import { PwaRegister } from "@/components/dashboard/pwa-register";
import { PendingProvider } from "@/components/dashboard/pending-provider";
import { MobileTabBar } from "@/components/dashboard/mobile-tab-bar";
import { getDayRange } from "@/lib/reservations/date";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, profile, restaurant } = await getDashboardContext();

  // Pendientes de hoy en adelante: contador de la pestaña "Hoy" (luego se mantiene con Realtime).
  const { data: pending } = await supabase
    .from("reservations")
    .select("id, start_time")
    .eq("restaurant_id", restaurant.id)
    .eq("status", "pending")
    .gte("start_time", getDayRange(new Date()).start)
    .order("start_time")
    .limit(200);

  return (
    <PendingProvider restaurantId={restaurant.id} initial={pending ?? []}>
      {/* data-panel-theme: activa los colores de El Bodegón (globals.css). */}
      <SidebarProvider data-panel-theme="">
        <AppSidebar
          restaurantName={restaurant.name}
          userName={profile.name}
          role={profile.role}
          canSignOut={!autoLoginEnabled()}
        />
        {/* min-w-0: que el contenido encoja y no se salga por la derecha (tablet). */}
        <SidebarInset className="min-w-0">
          {/* Móvil en horizontal (short): sin cabecera, para ganar altura. */}
          <header className="flex min-h-14 items-center gap-2 border-b pt-[env(safe-area-inset-top)] pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] short:hidden">
            <SidebarTrigger className="hidden md:inline-flex" />
            <Separator orientation="vertical" className="hidden h-5 md:block" />
            <span className="text-base font-semibold text-primary md:text-sm md:font-medium md:text-foreground">
              {restaurant.name}
            </span>
          </header>
          {/* Móvil: hueco abajo para el menú fijo. En horizontal, el menú va a la izquierda. */}
          <div className="flex-1 p-4 pb-[calc(9.5rem+env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] md:pb-4 short:!pb-[max(1rem,env(safe-area-inset-bottom))] short:!pl-[calc(5.5rem+env(safe-area-inset-left))]">
            {children}
          </div>
        </SidebarInset>
        <MobileTabBar />
        <UpdateChecker />
        <PwaRegister />
      </SidebarProvider>
    </PendingProvider>
  );
}
