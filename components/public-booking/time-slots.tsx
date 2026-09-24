"use client";

import type { SlotOption, Turno } from "@/lib/public-booking/schedule";

const TURNO_LABEL: Record<Turno, string> = { lunch: "Comida", dinner: "Cena" };

export function TimeSlots({
  slots,
  value,
  onChange,
  error,
}: {
  slots: SlotOption[];
  value: string | null;
  onChange: (time: string) => void;
  error?: string;
}) {
  const turnos = (["lunch", "dinner"] as const).filter((t) => slots.some((s) => s.turno === t));

  return (
    <div className="rv-field">
      <h2 id="pb-time-label" className="rv-label">
        Hora
      </h2>

      {slots.length === 0 && <p className="rv-hint">Elige un día abierto para ver las horas.</p>}

      {turnos.map((turno) => (
        <div key={turno}>
          {turnos.length > 1 && <p className="rv-turno">{TURNO_LABEL[turno]}</p>}
          <div
            className="rv-slots"
            role="group"
            aria-labelledby="pb-time-label"
            aria-describedby={error ? "pb-time-error" : undefined}
          >
            {slots
              .filter((s) => s.turno === turno)
              .map((slot) => (
                <button
                  key={slot.time}
                  type="button"
                  className="rv-choice rv-slot"
                  disabled={!slot.available}
                  aria-pressed={slot.time === value}
                  aria-label={
                    slot.available ? slot.time : `${slot.time}, ${slot.reason === "full" ? "completo" : "no disponible"}`
                  }
                  title={slot.reason === "full" ? "Completo" : undefined}
                  onClick={() => onChange(slot.time)}
                >
                  {slot.time}
                </button>
              ))}
          </div>
        </div>
      ))}

      {slots.length > 0 && slots.every((s) => !s.available) && (
        <p className="rv-hint" style={{ marginTop: 12 }}>
          Ya no quedan horas para este día. Prueba con otro.
        </p>
      )}

      {error && (
        <p id="pb-time-error" className="rv-error">
          {error}
        </p>
      )}
    </div>
  );
}
