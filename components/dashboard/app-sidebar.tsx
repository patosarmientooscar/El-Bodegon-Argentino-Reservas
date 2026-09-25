"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Settings, LogOut } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { RoleBadge } from "@/components/dashboard/role-badge";

const NAV_ITEMS = [
  { href: "/home", label: "Home", icon: LayoutDashboard },
  { href: "/settings", label: "Ajustes", icon: Settings },
];

export function AppSidebar({
  restaurantName,
  userName,
  role,
}: {
  restaurantName: string;
  userName: string | null;
  role: "admin" | "staff";
}) {
  const pathname = usePathname();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <Sidebar>
      <SidebarHeader className="gap-1 px-3 py-3">
        <span className="text-sm font-semibold">{restaurantName}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{userName ?? "Usuario"}</span>
          <RoleBadge role={role} className="text-[10px]" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleSignOut}>
              <LogOut />
              <span>Cerrar sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
