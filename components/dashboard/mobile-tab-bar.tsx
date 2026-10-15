"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Settings, Sun } from "lucide-react";

import { cn } from "@/lib/utils";
import { usePendingReservations } from "@/components/dashboard/pending-provider";

const TABS = [
  { href: "/home", label: "Hoy", icon: Sun },
  { href: "/reservations", label: "Reservas", icon: CalendarDays },
  { href: "/settings", label: "Ajustes", icon: Settings },
];

/** Menú fijo abajo, solo en móvil (en ordenador sigue la barra lateral). */
export function MobileTabBar() {
  const pathname = usePathname();
  const pendingCount = usePendingReservations().length;

  return (
    <nav
      aria-label="Menú principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-3">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const showBadge = tab.href === "/home" && pendingCount > 0;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-16 flex-col items-center justify-center gap-1 text-[13px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && <span aria-hidden className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-primary" />}
                <span className="relative">
                  <tab.icon className="size-6" />
                  {showBadge && (
                    <span className="absolute -right-3 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-xs font-bold text-[#1a1714]">
                      {pendingCount > 9 ? "9+" : pendingCount}
                    </span>
                  )}
                </span>
                {tab.label}
                {showBadge && <span className="sr-only">, {pendingCount} pendientes</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
