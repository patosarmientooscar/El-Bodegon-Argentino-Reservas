"use client";

import type { DayOption } from "@/lib/public-booking/schedule";

import { CHOICE_BASE, CHOICE_DISABLED, CHOICE_IDLE, CHOICE_SELECTED, SECTION_LABEL } from "./ui";

export function DateChips({
  days,
  value,
  onChange,
}: {
  days: DayOption[];
  value: string | null;
  onChange: (date: string) => void;
}) {
  return (
    <section aria-labelledby="pb-date-label">
      <h2 id="pb-date-label" className={SECTION_LABEL}>
        Día
      </h2>
      <div
        role="group"
        aria-labelledby="pb-date-label"
        className="-mx-5 mt-1 flex snap-x snap-mandatory scroll-px-5 gap-2 overflow-x-auto px-5 pt-2 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {days.map((day) => {
          const selected = day.date === value;
          const state = day.disabled ? CHOICE_DISABLED : selected ? CHOICE_SELECTED : CHOICE_IDLE;
          return (
            <button
              key={day.date}
              type="button"
              disabled={day.disabled}
              aria-pressed={selected}
              aria-label={`${day.fullLabel}${day.reason === "closed" ? ", cerrado" : day.reason === "full" ? ", sin horas libres" : ""}`}
              onClick={() => onChange(day.date)}
              className={`flex h-[4.5rem] min-w-[4.4rem] shrink-0 snap-start flex-col items-center justify-center rounded-2xl px-3 ${CHOICE_BASE} ${state}`}
            >
              <span className="text-[0.8rem] font-medium">{day.label}</span>
              <span className={`text-xl leading-tight font-semibold ${day.disabled ? "line-through" : ""}`}>
                {day.dayNumber}
              </span>
              {day.reason === "closed" && <span className="text-[0.6rem] tracking-wide uppercase">Cerrado</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
