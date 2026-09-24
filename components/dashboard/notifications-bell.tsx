"use client";

import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatTime } from "@/lib/reservations/date";

export interface NotificationEvent {
  id: string;
  kind: "new" | "cancelled" | "pending";
  message: string;
  time: Date;
}

export function NotificationsBell({
  events,
  pendingCount,
}: {
  events: NotificationEvent[];
  pendingCount: number;
}) {
  const unread = events.length + (pendingCount > 0 ? 1 : 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-4" />
          {unread > 0 && (
            <Badge className="absolute -right-1 -top-1 size-4 justify-center rounded-full p-0 text-[10px]">
              {unread > 9 ? "9+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="border-b px-3 py-2 text-sm font-medium">Notificaciones</div>
        <div className="max-h-72 overflow-y-auto">
          {pendingCount > 0 && (
            <div className="border-b bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {pendingCount} reserva{pendingCount === 1 ? "" : "s"} pendiente{pendingCount === 1 ? "" : "s"} de confirmar hoy.
            </div>
          )}
          {events.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">Sin novedades por ahora.</p>
          ) : (
            <ul className="divide-y">
              {events.map((event) => (
                <li key={event.id} className="px-3 py-2 text-sm">
                  <p>{event.message}</p>
                  <p className="text-xs text-muted-foreground">{formatTime(event.time.toISOString())}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
