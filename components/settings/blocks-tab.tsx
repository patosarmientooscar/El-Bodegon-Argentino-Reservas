"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { isoDate } from "@/lib/reservations/date";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Database } from "@/types/database.types";

type SpecialDateRow = Database["public"]["Tables"]["special_dates"]["Row"];
type SpecialDateType = SpecialDateRow["type"];

export function BlocksTab({
  restaurantId,
  initialSpecialDates,
}: {
  restaurantId: string;
  initialSpecialDates: SpecialDateRow[];
}) {
  const [dates, setDates] = useState(initialSpecialDates);
  const [date, setDate] = useState(isoDate(new Date()));
  const [type, setType] = useState<SpecialDateType>("closed");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("special_dates")
      .insert({ restaurant_id: restaurantId, date, type, note: note || null })
      .select()
      .single();
    setSaving(false);

    if (error || !data) {
      toast.error("No se pudo añadir.", { description: error?.message });
      return;
    }
    setDates((current) => [...current, data].sort((a, b) => a.date.localeCompare(b.date)));
    setNote("");
    toast.success("Añadido.");
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("special_dates").delete().eq("id", id);
    if (error) {
      toast.error("No se pudo eliminar.", { description: error.message });
      return;
    }
    setDates((current) => current.filter((d) => d.id !== id));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fechas especiales y bloqueos</CardTitle>
        <CardDescription>
          Días cerrados o festivos. Para bloquear una mesa concreta, hazlo desde Mesas.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Fecha</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as SpecialDateType)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="closed">Cerrado</SelectItem>
                <SelectItem value="blocked">Bloqueado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-1 min-w-[10rem] flex-col gap-1.5">
            <Label>Nota</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Festivo local, reforma…" />
          </div>
          <Button onClick={handleAdd} disabled={saving}>
            Añadir
          </Button>
        </div>

        {dates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin fechas especiales todavía.</p>
        ) : (
          <ul className="divide-y">
            {dates.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium tabular-nums">{d.date}</span>
                  <Badge variant="outline" className="font-normal">
                    {d.type === "closed" ? "Cerrado" : "Bloqueado"}
                  </Badge>
                  {d.note && <span className="text-muted-foreground">{d.note}</span>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
