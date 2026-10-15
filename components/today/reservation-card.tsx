"use client";

import { Armchair, Check, MessageCircle, NotebookPen, Phone, UserX, Users, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ReservationStatusBadge, SOURCE_LABEL, SourceIcon } from "@/components/dashboard/status-badges";
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
import { formatTime } from "@/lib/reservations/date";
import { toTelHref } from "@/lib/public-booking/phone";
import type { ReservationRow } from "@/lib/reservations/status";
import type { ReservationStatus } from "@/types/database.types";

/** "612 34 56 78" / "+34 612…" / "0034…" → enlace de WhatsApp (España por defecto). */
function whatsappHref(phone: string): string | null {
  let digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.length === 9) digits = `34${digits}`;
  return /^\d{8,15}$/.test(digits) ? `https://wa.me/${digits}` : null;
}

export function ReservationCard({
  reservation,
  tableNumber,
  busy,
  highlighted,
  onOpen,
  onSetStatus,
}: {
  reservation: ReservationRow;
  tableNumber: number | null;
  /** Hay un cambio de estado en curso: botones desactivados. */
  busy: boolean;
  highlighted?: boolean;
  onOpen: () => void;
  onSetStatus: (next: ReservationStatus) => void;
}) {
  const r = reservation;
  const closed = r.status === "cancelled" || r.status === "no_show";
  const wa = r.customer_phone ? whatsappHref(r.customer_phone) : null;

  return (
    <article
      id={`reserva-${r.id}`}
      className={cn(
        "scroll-mt-20 overflow-hidden rounded-xl border bg-card transition-shadow",
        r.status === "pending" && "border-amber-400/60 bg-amber-400/[0.04]",
        closed && "opacity-60",
        highlighted && "ring-2 ring-primary",
      )}
    >
      {/* Toda la parte de arriba abre el detalle. */}
      <button type="button" onClick={onOpen} className="flex w-full gap-3 p-3 text-left hover:bg-accent/40">
        <div className="flex w-16 shrink-0 flex-col items-center pt-0.5">
          <span className={cn("text-2xl font-bold leading-none tabular-nums", closed && "line-through decoration-2")}>
            {formatTime(r.start_time)}
          </span>
          <span className="mt-1.5 text-center text-xs text-muted-foreground">
            {tableNumber ? `Mesa ${tableNumber}` : "Sin mesa"}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-lg font-semibold leading-tight">{r.customer_name}</p>
            <ReservationStatusBadge status={r.status} className="h-6 shrink-0 text-[13px]" />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Users className="size-4" aria-hidden />
              {r.party_size} {r.party_size === 1 ? "persona" : "personas"}
            </span>
            <span className="flex items-center gap-1.5">
              <SourceIcon source={r.source} className="size-4" />
              {SOURCE_LABEL[r.source]}
            </span>
          </p>
          {r.notes && (
            <p className="mt-2 flex gap-2 rounded-md border border-amber-400/40 bg-amber-400/10 px-2.5 py-1.5 text-[15px] leading-snug text-amber-100">
              <NotebookPen className="mt-0.5 size-4 shrink-0 text-amber-300" aria-label="Nota" />
              <span className="min-w-0 break-words">{r.notes}</span>
            </p>
          )}
        </div>
      </button>

      {(r.status === "pending" || r.status === "confirmed" || (r.customer_phone && !closed)) && (
        <div className="flex flex-col gap-2 px-3 pb-3">
          {r.status === "pending" && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                disabled={busy}
                onClick={() => onSetStatus("confirmed")}
                className="h-12 bg-green-600 text-base text-white hover:bg-green-500"
              >
                <Check className="size-5" /> Aceptar
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    disabled={busy}
                    variant="outline"
                    className="h-12 border-red-400/50 text-base text-red-300 hover:bg-red-400/10 hover:text-red-200"
                  >
                    <X className="size-5" /> Rechazar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Rechazar esta reserva?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {r.customer_name} · {r.party_size} pers. · {formatTime(r.start_time)}. Pasará a «Cancelada». El
                      cliente no recibe ningún aviso automático: si hace falta, llámale o escríbele.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="h-11">Volver</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      className="h-11"
                      onClick={() => onSetStatus("cancelled")}
                    >
                      Sí, rechazar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
          {r.status === "confirmed" && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                disabled={busy}
                onClick={() => onSetStatus("seated")}
                className="h-12 bg-sky-600 text-base text-white hover:bg-sky-500"
              >
                <Armchair className="size-5" /> Ha llegado
              </Button>
              <Button disabled={busy} variant="outline" onClick={() => onSetStatus("no_show")} className="h-12 text-base">
                <UserX className="size-5" /> No vino
              </Button>
            </div>
          )}
          {r.customer_phone && !closed && (
            <div className="grid grid-cols-2 gap-2">
              <Button asChild variant="outline" className="h-11 text-base">
                <a href={toTelHref(r.customer_phone)}>
                  <Phone className="size-5" /> Llamar
                </a>
              </Button>
              {wa ? (
                <Button asChild variant="outline" className="h-11 text-base">
                  <a href={wa} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="size-5" /> WhatsApp
                  </a>
                </Button>
              ) : (
                <span />
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
