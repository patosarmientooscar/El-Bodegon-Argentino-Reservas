"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SaveBar, settingsErrorMessage, useSave } from "@/components/settings/save-bar";
import type { ServiceHourRow } from "@/lib/reservations/service-hours";
import type { Turno } from "@/lib/reservations/service-hours";

const DAYS: { value: number; label: string }[] = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

const TURNOS: { value: Turno; label: string }[] = [
  { value: "lunch", label: "Comida" },
  { value: "dinner", label: "Cena" },
];

interface Cell {
  open_time: string;
  close_time: string;
  closed: boolean;
}

function key(day: number, turno: Turno) {
  return `${day}-${turno}`;
}

function buildInitial(rows: ServiceHourRow[]): Record<string, Cell> {
  const map: Record<string, Cell> = {};
  for (const day of DAYS) {
    for (const turno of TURNOS) {
      const existing = rows.find((r) => r.day_of_week === day.value && r.turno === turno.value);
      map[key(day.value, turno.value)] = {
        open_time: existing?.open_time?.slice(0, 5) ?? "",
        close_time: existing?.close_time?.slice(0, 5) ?? "",
        // Sin fila = nunca configurado: se ve cerrado hasta que se abra.
        closed: existing ? existing.closed : rows.length > 0,
      };
    }
  }
  return map;
}

/** Horario semanal: cada día, comida y cena con interruptor abierto/cerrado y horas. */
export function HoursTab({
  restaurantId,
  initialServiceHours,
}: {
  restaurantId: string;
  initialServiceHours: ServiceHourRow[];
}) {
  const [cells, setCells] = useState<Record<string, Cell>>(() => buildInitial(initialServiceHours));
  const save = useSave();

  function updateCell(day: number, turno: Turno, patch: Partial<Cell>) {
    setCells((current) => ({ ...current, [key(day, turno)]: { ...current[key(day, turno)], ...patch } }));
  }

  async function handleSave() {
    await save.run(async () => {
      for (const day of DAYS) {
        for (const turno of TURNOS) {
          const cell = cells[key(day.value, turno.value)];
          if (cell.closed) continue;
          if (!cell.open_time || !cell.close_time) return `${day.label}, ${turno.label.toLowerCase()}: pon la hora de inicio y la de fin.`;
          if (cell.close_time <= cell.open_time) return `${day.label}, ${turno.label.toLowerCase()}: la hora de fin tiene que ser después de la de inicio.`;
        }
      }
      const rows = DAYS.flatMap((day) =>
        TURNOS.map((turno) => {
          const cell = cells[key(day.value, turno.value)];
          return {
            restaurant_id: restaurantId,
            day_of_week: day.value,
            turno: turno.value,
            open_time: cell.closed ? null : cell.open_time,
            close_time: cell.closed ? null : cell.close_time,
            closed: cell.closed,
          };
        }),
      );
      const { error } = await createClient()
        .from("service_hours")
        .upsert(rows, { onConflict: "restaurant_id,day_of_week,turno" });
      return error ? settingsErrorMessage(error) : null;
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Horarios</CardTitle>
        <CardDescription className="text-base">
          Horas en las que se puede reservar cada día. La última hora que se ofrece en la web es 1 h antes del cierre.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {DAYS.map((day) => (
          <section key={day.value} className="rounded-xl border p-3">
            <h3 className="mb-2 text-base font-semibold">{day.label}</h3>
            <div className="flex flex-col gap-2">
              {TURNOS.map((turno) => {
                const cell = cells[key(day.value, turno.value)];
                const id = `h-${day.value}-${turno.value}`;
                return (
                  <div key={turno.value} className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <label htmlFor={`${id}-sw`} className="flex min-h-11 w-40 cursor-pointer items-center gap-3">
                      <Switch
                        id={`${id}-sw`}
                        checked={!cell.closed}
                        onCheckedChange={(checked) => updateCell(day.value, turno.value, { closed: !checked })}
                        className="scale-125"
                      />
                      <span className="text-base">
                        {turno.label}{" "}
                        <span className={cn("text-sm", cell.closed ? "text-muted-foreground" : "text-green-300")}>
                          {cell.closed ? "cerrado" : "abierto"}
                        </span>
                      </span>
                    </label>
                    {!cell.closed && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          aria-label={`${day.label} ${turno.label} desde`}
                          value={cell.open_time}
                          onChange={(e) => updateCell(day.value, turno.value, { open_time: e.target.value })}
                          className="h-11 w-28 text-base"
                        />
                        <span className="text-muted-foreground">a</span>
                        <Input
                          type="time"
                          aria-label={`${day.label} ${turno.label} hasta`}
                          value={cell.close_time}
                          onChange={(e) => updateCell(day.value, turno.value, { close_time: e.target.value })}
                          className="h-11 w-28 text-base"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        <SaveBar status={save.status} error={save.error} onClick={handleSave} label="Guardar horarios" className="mt-1" />
      </CardContent>
    </Card>
  );
}
