"use client";

import { useEffect, useRef } from "react";

import { longDate } from "@/lib/public-booking/time";

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
    const id = window.setTimeout(() => headingRef.current?.focus({ preventScroll: true }), 450);
    return () => window.clearTimeout(id);
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
    <div className="rv-success">
      <p className="rv-script rv-success-script">Gracias</p>
      <h2 ref={headingRef} tabIndex={-1} className="rv-success-title">
        ¡Reserva recibida, {firstName}!
      </h2>
      <p className="rv-success-text">El restaurante la revisará y te avisará si hay cualquier cambio.</p>
      <dl className="rv-card">
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <a className="rv-btn rv-btn-line rv-btn-wide" href={calendarHref}>
        Añadir al calendario
      </a>
    </div>
  );
}
