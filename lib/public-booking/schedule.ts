/**
 * Reglas de la página pública de reservas: qué días y qué franjas se pueden
 * reservar. Módulo puro (sin BD ni env) — lo usan igual el cliente (para
 * pintar chips y franjas) y el Server Action (para revalidar al reservar).
 */
import { addDays, dayOfWeek, longDate, minutesToTime, shortWeekday, timeToMinutes, zonedToUtc, zonedToday } from "./time";

export type Turno = "lunch" | "dinner";

export interface ServiceWindow {
  turno: Turno;
  /** "HH:MM" */
  open: string;
  /** "HH:MM" */
  close: string;
}

export interface BookingRules {
  timeZone: string;
  slotStepMinutes: number;
  /** Última franja = cierre − estos minutos (misma regla que el bot de WhatsApp). */
  lastSeatingBeforeCloseMinutes: number;
  minLeadTimeMinutes: number;
  maxAdvanceDays: number;
  maxPartySize: number;
  daysShown: number;
  /** Clave "0".."6" (0 = domingo). Día sin ventanas = cerrado. */
  weeklyHours: Record<string, ServiceWindow[]>;
  /** Fechas "YYYY-MM-DD" cerradas o bloqueadas (special_dates). */
  closedDates: string[];
}

export interface DayOption {
  date: string;
  /** "Hoy", "Mañana", "Jue" */
  label: string;
  dayNumber: number;
  /** "jueves, 25 de septiembre" */
  fullLabel: string;
  disabled: boolean;
  reason: "closed" | "full" | null;
}

export interface SlotOption {
  time: string;
  turno: Turno;
  available: boolean;
}

function windowsFor(rules: BookingRules, date: string): ServiceWindow[] {
  if (rules.closedDates.includes(date)) return [];
  return rules.weeklyHours[String(dayOfWeek(date))] ?? [];
}

export function buildSlots(rules: BookingRules, date: string, now: Date): SlotOption[] {
  const earliest = now.getTime() + rules.minLeadTimeMinutes * 60_000;
  const lastDate = addDays(zonedToday(rules.timeZone, now), rules.maxAdvanceDays);
  const slots: SlotOption[] = [];

  for (const window of windowsFor(rules, date)) {
    const first = timeToMinutes(window.open);
    const last = timeToMinutes(window.close) - rules.lastSeatingBeforeCloseMinutes;
    for (let m = first; m <= last; m += rules.slotStepMinutes) {
      const time = minutesToTime(m);
      const start = zonedToUtc(rules.timeZone, date, time).getTime();
      slots.push({ time, turno: window.turno, available: start >= earliest && date <= lastDate });
    }
  }
  return slots.sort((a, b) => a.time.localeCompare(b.time));
}

export function buildDayOptions(rules: BookingRules, now: Date): DayOption[] {
  const today = zonedToday(rules.timeZone, now);
  return Array.from({ length: rules.daysShown }, (_, i) => {
    const date = addDays(today, i);
    const slots = buildSlots(rules, date, now);
    const reason = slots.length === 0 ? "closed" : slots.some((s) => s.available) ? null : "full";
    return {
      date,
      label: i === 0 ? "Hoy" : i === 1 ? "Mañana" : shortWeekday(date),
      dayNumber: Number(date.slice(8, 10)),
      fullLabel: longDate(date),
      disabled: reason !== null,
      reason,
    };
  });
}

export function isSlotBookable(rules: BookingRules, date: string, time: string, now: Date): boolean {
  return buildSlots(rules, date, now).some((s) => s.time === time && s.available);
}
