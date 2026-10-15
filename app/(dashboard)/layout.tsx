import { getDashboardContext } from "@/lib/dashboard/context";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { UpdateChecker } from "@/components/dashboard/update-checker";
import { autoLoginEnabled } from "@/lib/supabase/middleware";
import { PwaRegister } from "@/components/dashboard/pwa-register";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, restaurant } = await getDashboardContext();

  return (
    <SidebarProvider>
      <AppSidebar
        restaurantName={restaurant.name}
        userName={profile.name}
        role={profile.role}
        canSignOut={!autoLoginEnabled()}
      />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <span className="text-sm font-medium">{restaurant.name}</span>
        </header>
        <div className="flex-1 p-4">{children}</div>
      </SidebarInset>
      <UpdateChecker />
      <PwaRegister />
    </SidebarProvider>
  );
}
