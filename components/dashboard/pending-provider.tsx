"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export type PendingItem = { id: string; start_time: string };

const PendingContext = createContext<PendingItem[]>([]);

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Reservas pendientes de aceptar de hoy en adelante, siempre al día
 * (Realtime). Las usan el contador de la pestaña "Hoy" y el aviso de
 * "pendientes otros días" de Home. Se vuelven a pedir al volver a la app.
 */
export function PendingProvider({
  restaurantId,
  initial,
  children,
}: {
  restaurantId: string;
  initial: PendingItem[];
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<PendingItem[]>(initial);

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function load() {
      const { data, error } = await supabase
        .from("reservations")
        .select("id, start_time")
        .eq("restaurant_id", restaurantId)
        .eq("status", "pending")
        .gte("start_time", startOfTodayIso())
        .order("start_time")
        .limit(200);
      if (!error && data) setItems(data);
    }
    // Varios cambios seguidos (p. ej. aceptar 3 reservas) = una sola consulta.
    function scheduleLoad() {
      clearTimeout(timer);
      timer = setTimeout(load, 400);
    }
    function onVisible() {
      if (document.visibilityState === "visible") scheduleLoad();
    }

    load();
    const channel = supabase
      .channel(`pending-${restaurantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservations", filter: `restaurant_id=eq.${restaurantId}` },
        scheduleLoad,
      )
      .subscribe();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  return <PendingContext.Provider value={items}>{children}</PendingContext.Provider>;
}

export function usePendingReservations(): PendingItem[] {
  return useContext(PendingContext);
}
