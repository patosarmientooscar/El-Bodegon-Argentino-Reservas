"use client";

import { useEffect, useId, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { ReservationRow } from "@/lib/reservations/status";

export type ReservationChangeEvent =
  | { type: "insert"; row: ReservationRow }
  | { type: "update"; row: ReservationRow; previous: ReservationRow }
  | { type: "delete"; row: ReservationRow };

/**
 * Suscripción única (por restaurante) a cambios en reservations vía Supabase
 * Realtime. `isInRange` decide qué filas del evento entran en la lista que
 * se muestra (p.ej. "hoy", o el día seleccionado en Reservations) — se lee
 * por ref para no tener que recrear el canal cada vez que cambia el rango.
 */
export function useRealtimeReservations({
  restaurantId,
  initial,
  isInRange,
  onChange,
}: {
  restaurantId: string;
  initial: ReservationRow[];
  isInRange: (row: ReservationRow) => boolean;
  onChange?: (event: ReservationChangeEvent) => void;
}): ReservationRow[] {
  const [reservations, setReservations] = useState<ReservationRow[]>(initial);
  const isInRangeRef = useRef(isInRange);
  const onChangeRef = useRef(onChange);
  const byIdRef = useRef(new Map<string, ReservationRow>());
  // Home monta dos suscripciones a la vez (hoy + día de la rejilla): cada una
  // necesita su propio nombre de canal o Realtime cierra una de las dos.
  const channelSuffix = useId().replace(/[^a-zA-Z0-9]/g, "");

  isInRangeRef.current = isInRange;
  onChangeRef.current = onChange;

  useEffect(() => {
    setReservations(initial);
    byIdRef.current = new Map(initial.map((r) => [r.id, r]));
  }, [initial]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`reservations-${restaurantId}-${channelSuffix}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reservations",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as ReservationRow;
            byIdRef.current.delete(old.id);
            setReservations((current) => current.filter((r) => r.id !== old.id));
            onChangeRef.current?.({ type: "delete", row: old });
            return;
          }

          const row = payload.new as ReservationRow;
          const previous = byIdRef.current.get(row.id) ?? null;
          const belongs = isInRangeRef.current(row);

          if (belongs) {
            byIdRef.current.set(row.id, row);
          } else {
            byIdRef.current.delete(row.id);
          }

          setReservations(() => {
            const next = Array.from(byIdRef.current.values());
            next.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
            return next;
          });

          if (payload.eventType === "INSERT") {
            onChangeRef.current?.({ type: "insert", row });
          } else if (previous) {
            onChangeRef.current?.({ type: "update", row, previous });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, channelSuffix]);

  return reservations;
}
