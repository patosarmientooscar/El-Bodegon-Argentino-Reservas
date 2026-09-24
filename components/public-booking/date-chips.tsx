"use client";

import type { DayOption } from "@/lib/public-booking/schedule";

export function DateChips({
  days,
  value,
  onChange,
  error,
}: {
  days: DayOption[];
  value: string | null;
  onChange: (date: string) => void;
  error?: string;
}) {
  return (
    <div className="rv-field">
      <h2 id="pb-date-label" className="rv-label">
        Día
      </h2>
      <div className="rv-days" role="group" aria-labelledby="pb-date-label">
        {days.map((day) => (
          <button
            key={day.date}
            type="button"
            className="rv-choice rv-day"
            disabled={day.disabled}
            aria-pressed={day.date === value}
            aria-label={`${day.fullLabel}${day.reason === "closed" ? ", cerrado" : day.reason === "full" ? ", sin horas libres" : ""}`}
            onClick={() => onChange(day.date)}
          >
            <span className="rv-day-week">{day.label}</span>
            <span className="rv-day-num">{day.dayNumber}</span>
            {day.reason === "closed" && <span className="rv-day-note">Cerrado</span>}
          </button>
        ))}
      </div>
      {error && <p className="rv-error">{error}</p>}
    </div>
  );
}
