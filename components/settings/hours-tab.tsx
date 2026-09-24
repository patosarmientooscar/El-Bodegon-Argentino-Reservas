"use client";

import { useState } from "react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
        closed: existing?.closed ?? false,
      };
    }
  }
  return map;
}

export function HoursTab({
  restaurantId,
  initialServiceHours,
}: {
  restaurantId: string;
  initialServiceHours: ServiceHourRow[];
}) {
  const [cells, setCells] = useState<Record<string, Cell>>(() => buildInitial(initialServiceHours));
  const [saving, setSaving] = useState(false);

  function updateCell(day: number, turno: Turno, patch: Partial<Cell>) {
    setCells((current) => ({ ...current, [key(day, turno)]: { ...current[key(day, turno)], ...patch } }));
  }

  async function handleSave() {
    setSaving(true);
    const rows = DAYS.flatMap((day) =>
      TURNOS.map((turno) => {
        const cell = cells[key(day.value, turno.value)];
        return {
          restaurant_id: restaurantId,
          day_of_week: day.value,
          turno: turno.value,
          open_time: cell.closed || !cell.open_time ? null : cell.open_time,
          close_time: cell.closed || !cell.close_time ? null : cell.close_time,
          closed: cell.closed,
        };
      }),
    );

    const supabase = createClient();
    const { error } = await supabase
      .from("service_hours")
      .upsert(rows, { onConflict: "restaurant_id,day_of_week,turno" });
    setSaving(false);

    if (error) {
      toast.error("No se pudieron guardar los horarios.", { description: error.message });
      return;
    }
    toast.success("Horarios guardados.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Turnos y horarios de servicio</CardTitle>
        <CardDescription>Comida y cena por día de la semana. Desmarca un turno para cerrarlo ese día.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-24 pb-2 text-left font-medium text-muted-foreground">Día</th>
                {TURNOS.map((turno) => (
                  <th key={turno.value} className="pb-2 text-left font-medium text-muted-foreground">
                    {turno.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day) => (
                <tr key={day.value} className="border-t">
                  <td className="py-2 pr-2 font-medium">{day.label}</td>
                  {TURNOS.map((turno) => {
                    const cell = cells[key(day.value, turno.value)];
                    return (
                      <td key={turno.value} className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={!cell.closed}
                            onCheckedChange={(checked) => updateCell(day.value, turno.value, { closed: !checked })}
                          />
                          <Input
                            type="time"
                            className="w-28"
                            disabled={cell.closed}
                            value={cell.open_time}
                            onChange={(e) => updateCell(day.value, turno.value, { open_time: e.target.value })}
                          />
                          <span className="text-muted-foreground">–</span>
                          <Input
                            type="time"
                            className="w-28"
                            disabled={cell.closed}
                            value={cell.close_time}
                            onChange={(e) => updateCell(day.value, turno.value, { close_time: e.target.value })}
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button className="mt-4" onClick={handleSave} disabled={saving}>
          {saving ? "Guardando…" : "Guardar horarios"}
        </Button>
      </CardContent>
    </Card>
  );
}
