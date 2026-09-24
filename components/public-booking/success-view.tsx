"use client";

import { useEffect, useRef } from "react";
import { CalendarPlus } from "lucide-react";

import { longDate } from "@/lib/public-booking/time";

import { FOCUS_RING, PRESSABLE, SERIF } from "./ui";

export interface ConfirmedBooking {
  id: string;
  name: string;
  date: string;
  time: string;
  partySize: number;
}

export function SuccessView({ slug, booking }: { slug: string; booking: ConfirmedBooking }) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Lleva el foco (y el lector de pantalla) al mensaje de éxito.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const firstName = booking.name.trim().split(/\s+/)[0];
  const calendarHref = `/r/${slug}/calendario?${new URLSearchParams({
    fecha: booking.date,
    hora: booking.time,
    personas: String(booking.partySize),
    nombre: booking.name,
    id: booking.id,
  }).toString()}`;

  const rows = [
    { label: "Día", value: longDate(booking.date) },
    { label: "Hora", value: booking.time },
    { label: "Personas", value: `${booking.partySize} ${booking.partySize === 1 ? "persona" : "personas"}` },
  ];

  return (
    <div className="text-center">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className={`${SERIF} text-[2.1rem] leading-tight font-bold text-[#f3ead8] outline-none`}
      >
        ¡Reserva recibida, {firstName}!
      </h2>
      <p className="mt-2 text-[0.95rem] text-[#f3ead8]/65">El restaurante la revisará y te avisará si hay cualquier cambio.</p>

      <dl className="mt-7 divide-y divide-[#f3ead8]/10 rounded-2xl border border-[#c8a24a]/30 bg-[#f3ead8]/[0.03] text-left">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 px-5 py-4">
            <dt className="text-[0.7rem] font-semibold tracking-[0.24em] text-[#f3ead8]/50 uppercase">{row.label}</dt>
            <dd className="text-right text-base font-medium text-[#f3ead8] first-letter:uppercase">{row.value}</dd>
          </div>
        ))}
      </dl>

      <a
        href={calendarHref}
        className={`mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-[#c8a24a] text-[1.02rem] font-semibold text-[#f3ead8] hover:bg-[#c8a24a]/10 ${PRESSABLE} ${FOCUS_RING}`}
      >
        <CalendarPlus aria-hidden="true" className="size-5 text-[#c8a24a]" />
        Añadir al calendario
      </a>
    </div>
  );
}
