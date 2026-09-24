/**
 * Configuración de la página pública de reservas que NO vive en la BD.
 *
 * Lo que ya existe en Supabase se lee de allí (horarios en service_hours,
 * días cerrados en special_dates, antelación en restaurant_settings, máximo
 * de personas web en restaurant_settings.web_max_party_size, teléfono en
 * restaurants.phone). Aquí solo queda lo que la BD no tiene.
 *
 * Solo servidor: lee variables de entorno.
 */
import type { ServiceWindow } from "./schedule";

export interface PublicBookingConfig {
  timeZone: string;
  /** Teléfono para "Llámanos". Si no hay env, se usa restaurants.phone. */
  phone: string | null;
  /** Número de WhatsApp en formato internacional sin "+" (p.ej. 34600000000). */
  whatsapp: string | null;
  slotStepMinutes: number;
  lastSeatingBeforeCloseMinutes: number;
  daysShown: number;
  /**
   * Horario de reserva si el restaurante aún no tiene filas en service_hours.
   * Placeholder: comidas 13:00–16:00 y cenas 20:00–23:30, todos los días.
   */
  fallbackHours: ServiceWindow[];
}

const DEFAULTS: PublicBookingConfig = {
  timeZone: "Europe/Madrid",
  phone: null,
  whatsapp: null,
  slotStepMinutes: 30,
  lastSeatingBeforeCloseMinutes: 60,
  daysShown: 14,
  fallbackHours: [
    { turno: "lunch", open: "13:00", close: "16:00" },
    { turno: "dinner", open: "20:00", close: "23:30" },
  ],
};

const BY_SLUG: Record<string, Partial<PublicBookingConfig>> = {
  "el-bodegon-argentino": {
    phone: process.env.BODEGON_PHONE || null,
    whatsapp: process.env.BODEGON_WHATSAPP || "34600000000",
  },
};

export function getPublicBookingConfig(slug: string): PublicBookingConfig {
  return { ...DEFAULTS, ...BY_SLUG[slug] };
}
