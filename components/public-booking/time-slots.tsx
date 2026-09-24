"use client";

import type { SlotOption, Turno } from "@/lib/public-booking/schedule";

import { CHOICE_BASE, CHOICE_DISABLED, CHOICE_IDLE, CHOICE_SELECTED, ERROR_TEXT, SECTION_LABEL } from "./ui";

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
  const showTurnoHeadings = turnos.length > 1;

  return (
    <section aria-labelledby="pb-time-label">
      <h2 id="pb-time-label" className={SECTION_LABEL}>
        Hora
      </h2>

      {slots.length === 0 && (
        <p className="mt-3 text-sm text-[#f3ead8]/60">Elige un día abierto para ver las horas.</p>
      )}

      {turnos.map((turno) => (
        <div key={turno} className="mt-3">
          {showTurnoHeadings && <p className="mb-2 text-xs text-[#f3ead8]/45">{TURNO_LABEL[turno]}</p>}
          <div
            role="group"
            aria-labelledby="pb-time-label"
            aria-describedby={error ? "pb-time-error" : undefined}
            className="grid grid-cols-4 gap-2"
          >
            {slots
              .filter((s) => s.turno === turno)
              .map((slot) => {
                const selected = slot.time === value;
                const state = !slot.available ? CHOICE_DISABLED : selected ? CHOICE_SELECTED : CHOICE_IDLE;
                return (
                  <button
                    key={slot.time}
                    id={`pb-slot-${slot.time.replace(":", "")}`}
                    type="button"
                    disabled={!slot.available}
                    aria-pressed={selected}
                    aria-label={slot.available ? slot.time : `${slot.time}, no disponible`}
                    onClick={() => onChange(slot.time)}
                    className={`h-12 rounded-xl text-[0.95rem] font-semibold tabular-nums ${CHOICE_BASE} ${state} ${
                      slot.available ? "" : "line-through"
                    }`}
                  >
                    {slot.time}
                  </button>
                );
              })}
          </div>
        </div>
      ))}

      {slots.length > 0 && slots.every((s) => !s.available) && (
        <p className="mt-3 text-sm text-[#f3ead8]/60">Ya no quedan horas para este día. Prueba con otro.</p>
      )}

      {error && (
        <p id="pb-time-error" className={`mt-2 ${ERROR_TEXT}`}>
          {error}
        </p>
      )}
    </section>
  );
}
