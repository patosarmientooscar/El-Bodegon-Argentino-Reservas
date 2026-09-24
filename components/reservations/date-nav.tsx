"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isoDate, formatDateLong } from "@/lib/reservations/date";

function parseIsoDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function shiftDate(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

export function DateNav({
  selectedDateIso,
  onChange,
}: {
  selectedDateIso: string;
  onChange: (dateIso: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const date = parseIsoDate(selectedDateIso);
  const isToday = selectedDateIso === isoDate(new Date());

  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon" onClick={() => onChange(shiftDate(selectedDateIso, -1))}>
        <ChevronLeft className="size-4" />
      </Button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="min-w-[11rem] justify-start gap-2 font-normal capitalize">
            <CalendarIcon className="size-4" />
            {formatDateLong(date)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(value) => {
              if (value) {
                onChange(isoDate(value));
                setOpen(false);
              }
            }}
          />
        </PopoverContent>
      </Popover>
      <Button variant="outline" size="icon" onClick={() => onChange(shiftDate(selectedDateIso, 1))}>
        <ChevronRight className="size-4" />
      </Button>
      {!isToday && (
        <Button variant="ghost" size="sm" onClick={() => onChange(isoDate(new Date()))}>
          Hoy
        </Button>
      )}
    </div>
  );
}
