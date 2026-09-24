"use client";

import { useState } from "react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { getDayRange, isoDate } from "@/lib/reservations/date";
import { pickBestAvailableTable } from "@/lib/reservations/overlap";
import type { TableRow } from "@/lib/reservations/status";
import type { ReservationSource, ReservationStatus } from "@/types/database.types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SOURCE_OPTIONS: { value: ReservationSource; label: string }[] = [
  { value: "phone", label: "Teléfono" },
  { value: "walk_in", label: "Walk-in" },
  { value: "web", label: "Web" },
  { value: "whatsapp", label: "WhatsApp" },
];

export function ReservationFormDialog({
  restaurantId,
  tables,
  maxPartySize,
  defaultDurationMinutes,
  trigger,
  defaultTableId,
  defaultDate,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  onCreated,
}: {
  restaurantId: string;
  tables: TableRow[];
  maxPartySize: number;
  defaultDurationMinutes: number;
  trigger?: React.ReactNode;
  defaultTableId?: string | null;
  defaultDate?: Date;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = controlledOnOpenChange ?? setUncontrolledOpen;

  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [tableId, setTableId] = useState<string>(defaultTableId ?? "auto");
  const [date, setDate] = useState(isoDate(defaultDate ?? new Date()));
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(defaultDurationMinutes);
  const [source, setSource] = useState<ReservationSource>("phone");
  const [notes, setNotes] = useState("");

  function resetForm() {
    setName("");
    setPhone("");
    setPartySize(2);
    setTableId(defaultTableId ?? "auto");
    setDate(isoDate(defaultDate ?? new Date()));
    setTime("");
    setDuration(defaultDurationMinutes);
    setSource("phone");
    setNotes("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!time) {
      toast.error("Indica la hora de la reserva.");
      return;
    }

    const startTime = new Date(`${date}T${time}:00`);
    if (Number.isNaN(startTime.getTime())) {
      toast.error("Fecha u hora no válidas.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    let finalTableId: string | null;
    let status: ReservationStatus;
    let autoAssignFailed = false;

    if (tableId === "auto") {
      const { start, end } = getDayRange(startTime);
      const { data: dayReservations } = await supabase
        .from("reservations")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .gte("start_time", start)
        .lt("start_time", end);

      const best = pickBestAvailableTable(
        tables,
        dayReservations ?? [],
        partySize,
        startTime.toISOString(),
        duration,
      );
      finalTableId = best?.id ?? null;
      status = best ? "confirmed" : "pending";
      autoAssignFailed = !best;
    } else if (tableId === "none") {
      finalTableId = null;
      status = "pending";
    } else {
      finalTableId = tableId;
      status = "confirmed";
    }

    const { error } = await supabase.from("reservations").insert({
      restaurant_id: restaurantId,
      table_id: finalTableId,
      customer_name: name,
      customer_phone: phone || null,
      party_size: partySize,
      start_time: startTime.toISOString(),
      duration_minutes: duration,
      status,
      source,
      notes: notes || null,
    });
    setSubmitting(false);

    if (error) {
      if (error.code === "23P01") {
        toast.error("Esa mesa ya tiene una reserva en ese horario.");
      } else {
        toast.error("No se pudo crear la reserva.", { description: error.message });
      }
      return;
    }

    if (autoAssignFailed) {
      toast.warning("Reserva guardada como pendiente — no hay mesa libre de esa capacidad a esa hora.");
    } else {
      toast.success("Reserva guardada.");
    }
    resetForm();
    setOpen(false);
    onCreated?.();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva reserva</DialogTitle>
          <DialogDescription>Reserva manual o walk-in.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="customer_name">Nombre</Label>
            <Input id="customer_name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="customer_phone">Teléfono</Label>
            <Input id="customer_phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="date">Fecha</Label>
              <Input id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="time">Hora</Label>
              <Input id="time" type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="party_size">Personas</Label>
              <Input
                id="party_size"
                type="number"
                min={1}
                max={maxPartySize}
                required
                value={partySize}
                onChange={(e) => setPartySize(Number(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="duration">Duración (min)</Label>
              <Input
                id="duration"
                type="number"
                min={15}
                step={15}
                required
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Mesa</Label>
              <Select value={tableId} onValueChange={setTableId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automática (recomendado)</SelectItem>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {tables.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      Mesa {t.number} ({t.capacity}p)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tableId === "auto" && (
                <p className="text-xs text-muted-foreground">
                  Busca una mesa de {partySize} exactas libre a esa hora. Si no hay, queda pendiente.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Origen</Label>
              <Select value={source} onValueChange={(v) => setSource(v as ReservationSource)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notas / alergias</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Guardando…" : "Guardar reserva"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
