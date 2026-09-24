"use client";

import { useState } from "react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { formatTime } from "@/lib/reservations/date";
import { ReservationStatusBadge, SOURCE_LABEL } from "@/components/dashboard/status-badges";
import type { ReservationRow, TableRow } from "@/lib/reservations/status";
import type { ReservationStatus } from "@/types/database.types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const STATUS_OPTIONS: { value: ReservationStatus; label: string }[] = [
  { value: "pending", label: "Pendiente" },
  { value: "confirmed", label: "Confirmada" },
  { value: "seated", label: "Sentada" },
  { value: "cancelled", label: "Cancelada" },
  { value: "no_show", label: "No-show" },
];

export function ReservationDetailSheet({
  reservation,
  tables,
  open,
  onOpenChange,
}: {
  reservation: ReservationRow | null;
  tables: TableRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [saving, setSaving] = useState(false);

  async function updateReservation(patch: Partial<ReservationRow>) {
    if (!reservation) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("reservations").update(patch).eq("id", reservation.id);
    setSaving(false);

    if (error) {
      if (error.code === "23P01") {
        toast.error("Esa mesa ya tiene una reserva en ese horario.");
      } else {
        toast.error("No se pudo actualizar la reserva.", { description: error.message });
      }
      return;
    }
    toast.success("Reserva actualizada.");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-4 overflow-y-auto px-4">
        {reservation && (
          <>
            <SheetHeader className="px-0">
              <SheetTitle>{reservation.customer_name}</SheetTitle>
              <SheetDescription>
                {formatTime(reservation.start_time)} · {reservation.party_size} personas · {SOURCE_LABEL[reservation.source]}
              </SheetDescription>
            </SheetHeader>

            <div className="flex items-center gap-2">
              <ReservationStatusBadge status={reservation.status} />
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Teléfono</dt>
              <dd>{reservation.customer_phone || "—"}</dd>
              <dt className="text-muted-foreground">Creada</dt>
              <dd>{new Date(reservation.created_at).toLocaleString("es-ES")}</dd>
              <dt className="text-muted-foreground">Última actualización</dt>
              <dd>{new Date(reservation.updated_at).toLocaleString("es-ES")}</dd>
            </dl>

            {reservation.notes && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Notas / alergias</p>
                <p>{reservation.notes}</p>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label>Mesa</Label>
              <Select
                disabled={saving}
                value={reservation.table_id ?? "none"}
                onValueChange={(value) => updateReservation({ table_id: value === "none" ? null : value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {tables.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      Mesa {t.number} ({t.capacity}p)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Estado</Label>
              <Select
                disabled={saving}
                value={reservation.status}
                onValueChange={(value) => updateReservation({ status: value as ReservationStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <SheetFooter className="mt-auto flex-row gap-2 px-0">
              <Button
                variant="outline"
                className="flex-1"
                disabled={saving}
                onClick={() =>
                  toast.info("Reenvío de confirmación pendiente de conectar con un proveedor de WhatsApp/email.")
                }
              >
                Reenviar confirmación
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    disabled={saving || reservation.status === "cancelled"}
                  >
                    Cancelar reserva
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Cancelar esta reserva?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {reservation.customer_name} · {formatTime(reservation.start_time)}. Esta acción se puede revertir cambiando el estado manualmente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Volver</AlertDialogCancel>
                    <AlertDialogAction onClick={() => updateReservation({ status: "cancelled" })}>
                      Cancelar reserva
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
