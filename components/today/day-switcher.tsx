"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isoDate } from "@/lib/reservations/date";

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

const SEGMENT =
  "flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 text-base font-medium transition-colors";

/** Hoy / Mañana / Elegir fecha (calendario). */
export function DaySwitcher({
  selectedDateIso,
  todayIso,
  onChange,
}: {
  selectedDateIso: string;
  todayIso: string;
  onChange: (iso: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const tomorrowIso = addDays(todayIso, 1);
  const isOther = selectedDateIso !== todayIso && selectedDateIso !== tomorrowIso;
  const otherLabel = isOther
    ? new Date(`${selectedDateIso}T00:00:00`)
        .toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })
        .replace(/^./, (c) => c.toUpperCase())
    : "Elegir fecha";

  const item = (active: boolean) =>
    cn(SEGMENT, active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground");

  return (
    <div role="group" aria-label="Día" className="flex w-full gap-1 rounded-lg border bg-card p-1 sm:w-auto">
      <button type="button" className={item(selectedDateIso === todayIso)} onClick={() => onChange(todayIso)}>
        Hoy
      </button>
      <button type="button" className={item(selectedDateIso === tomorrowIso)} onClick={() => onChange(tomorrowIso)}>
        Mañana
      </button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className={cn(item(isOther), "flex-[1.6]")}>
            <CalendarIcon className="size-4 shrink-0" />
            {otherLabel}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={new Date(`${selectedDateIso}T00:00:00`)}
            onSelect={(value) => {
              if (!value) return;
              setOpen(false);
              onChange(isoDate(value));
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
