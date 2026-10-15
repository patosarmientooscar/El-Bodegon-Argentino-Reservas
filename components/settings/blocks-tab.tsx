"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, CalendarX2, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { isoDate } from "@/lib/reservations/date";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MissingFeature, SaveBar, settingsErrorMessage, useSave } from "@/components/settings/save-bar";
import type { Database } from "@/types/database.types";

type SpecialDateRow = Database["public"]["Tables"]["special_dates"]["Row"];
type SpecialDateInsert = Database["public"]["Tables"]["special_dates"]["Insert"];

function dayLabel(iso: string): string {
  const label = new Date(`${iso}T00:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Días especiales: cerrado todo el día u horario distinto (special_dates). */
export function BlocksTab({
  restaurantId,
  initialSpecialDates,
  specialHoursSupported,
}: {
  restaurantId: string;
  initialSpecialDates: SpecialDateRow[];
  /** false = falta pegar PEGAR_AJUSTES.sql (no existe el tipo "hours"). */
  specialHoursSupported: boolean;
}) {
  const today = isoDate(new Date());
  const [dates, setDates] = useState(initialSpecialDates);
  const [date, setDate] = useState(today);
  const [kind, setKind] = useState<"closed" | "hours">("closed");
  const [open, setOpen] = useState("13:00");
  const [close, setClose] = useState("16:00");
  const [note, setNote] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const save = useSave();

  const upcoming = dates.filter((d) => d.date >= today).sort((a, b) => a.date.localeCompare(b.date));

  async function handleAdd() {
    await save.run(async () => {
      if (!date || date < today) return "Elige una fecha de hoy en adelante.";
      if (kind === "hours" && (!open || !close || close <= open)) return "La hora de fin tiene que ser después de la de inicio.";
      if (kind === "closed" && dates.some((d) => d.date === date && d.type !== "hours")) return "Ese día ya está cerrado.";
      const row: SpecialDateInsert =
        kind === "closed"
          ? { restaurant_id: restaurantId, date, type: "closed", note: note.trim() || null }
          : { restaurant_id: restaurantId, date, type: "hours", open_time: open, close_time: close, note: note.trim() || null };
      const { data, error } = await createClient().from("special_dates").insert(row).select().single();
      if (error || !data) return settingsErrorMessage(error);
      setDates((current) => [...current, data]);
      setNote("");
      return null;
    });
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    const { error } = await createClient().from("special_dates").delete().eq("id", id);
    setDeleting(null);
    if (error) {
      toast.error(settingsErrorMessage(error));
      return;
    }
    setDates((current) => current.filter((d) => d.id !== id));
    toast.success("Día especial borrado");
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Añadir día especial</CardTitle>
          <CardDescription className="text-base">Vacaciones, festivos o un día con otro horario. Afecta a la web y a WhatsApp.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="sd-date" className="text-base">
              Fecha
            </Label>
            <Input id="sd-date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} className="h-12 text-base sm:w-56" />
          </div>

          <div role="radiogroup" aria-label="Tipo" className="grid gap-2 sm:grid-cols-2">
            {(
              [
                { value: "closed", icon: CalendarX2, title: "Cerrado todo el día", text: "No se puede reservar." },
                { value: "hours", icon: CalendarClock, title: "Horario especial", text: "Solo se reserva en estas horas." },
              ] as const
            ).map((option) => {
              const disabled = option.value === "hours" && !specialHoursSupported;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={kind === option.value}
                  disabled={disabled}
                  onClick={() => setKind(option.value)}
                  className={cn(
                    "flex min-h-14 items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-colors disabled:opacity-50",
                    kind === option.value ? "border-primary bg-primary/10" : "border-border hover:bg-accent/40",
                  )}
                >
                  <option.icon className="size-6 shrink-0 text-primary" />
                  <span>
                    <span className="block text-base font-semibold">{option.title}</span>
                    <span className="block text-sm text-muted-foreground">{option.text}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {!specialHoursSupported && <MissingFeature>El horario especial necesita PEGAR_AJUSTES.sql. Cerrar un día ya funciona.</MissingFeature>}

          {kind === "hours" && (
            <div className="flex items-center gap-2">
              <Input type="time" aria-label="Desde" value={open} onChange={(e) => setOpen(e.target.value)} className="h-12 w-32 text-base" />
              <span className="text-muted-foreground">a</span>
              <Input type="time" aria-label="Hasta" value={close} onChange={(e) => setClose(e.target.value)} className="h-12 w-32 text-base" />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="sd-note" className="text-base">
              Nota (opcional)
            </Label>
            <Input id="sd-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Vacaciones, festivo, evento privado…" className="h-12 text-base" />
          </div>

          <SaveBar status={save.status} error={save.error} onClick={handleAdd} label="Añadir" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Próximos días especiales</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-base text-muted-foreground">No hay ninguno. Todos los días siguen el horario normal.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {upcoming.map((d) => (
                <li key={d.id} className="flex items-center gap-3 rounded-xl border px-3 py-2">
                  {d.type === "hours" ? (
                    <CalendarClock className="size-5 shrink-0 text-primary" />
                  ) : (
                    <CalendarX2 className="size-5 shrink-0 text-red-300" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold">{dayLabel(d.date)}</p>
                    <p className="text-sm text-muted-foreground">
                      {d.type === "hours" ? `Horario especial ${d.open_time?.slice(0, 5)}–${d.close_time?.slice(0, 5)}` : "Cerrado"}
                      {d.note ? ` · ${d.note}` : ""}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Borrar ${dayLabel(d.date)}`}
                    disabled={deleting === d.id}
                    onClick={() => handleDelete(d.id)}
                    className="size-11 text-red-300 hover:text-red-200"
                  >
                    <Trash2 className="size-5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
