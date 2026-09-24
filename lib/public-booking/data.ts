/**
 * Lectura de la configuración pública de un restaurante por slug. Solo
 * servidor. Usa la clave anónima sin cookies: la página es pública y RLS
 * cierra las tablas, así que pasa por public_booking_get_config (security
 * definer), que devuelve únicamente datos de ese restaurante.
 */
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/types/database.types";

import { getPublicBookingConfig } from "./config";
import { toTelHref } from "./phone";
import type { BookingRules, ServiceWindow } from "./schedule";

const configSchema = z.object({
  name: z.string(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  settings: z.object({
    web_max_party_size: z.number().int(),
    max_advance_days: z.number().int(),
    min_lead_time_minutes: z.number().int(),
    duration_minutes: z.number().int(),
  }),
  service_hours: z.array(
    z.object({
      day_of_week: z.number().int(),
      turno: z.enum(["lunch", "dinner"]),
      open_time: z.string().nullable(),
      close_time: z.string().nullable(),
      closed: z.boolean(),
    }),
  ),
  closed_dates: z.array(z.string()),
});

/** Todo lo que necesita la página. Serializable: se pasa tal cual al cliente. */
export interface PublicRestaurant {
  slug: string;
  name: string;
  address: string | null;
  durationMinutes: number;
  telHref: string | null;
  whatsappHref: string | null;
  rules: BookingRules;
}

export type PublicRestaurantResult =
  | { status: "ok"; restaurant: PublicRestaurant }
  | { status: "not_found" }
  | { status: "error" };

function anonClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const getPublicRestaurant = cache(async (slug: string): Promise<PublicRestaurantResult> => {
  if (!SLUG_PATTERN.test(slug) || slug.length > 80) return { status: "not_found" };

  const { data, error } = await anonClient().rpc("public_booking_get_config", { p_slug: slug });
  if (error) {
    // PGRST202 = la función no existe: falta pegar PEGAR_RESERVA_PUBLICA.sql
    console.error("[reserva pública] public_booking_get_config:", error.code, error.message);
    return { status: "error" };
  }
  if (!data) return { status: "not_found" };

  const parsed = configSchema.safeParse(data);
  if (!parsed.success) {
    console.error("[reserva pública] respuesta inesperada:", parsed.error.message);
    return { status: "error" };
  }

  const db = parsed.data;
  const config = getPublicBookingConfig(slug);

  let weeklyHours: Record<string, ServiceWindow[]> = {};
  if (db.service_hours.length === 0) {
    for (let dow = 0; dow < 7; dow++) weeklyHours[String(dow)] = config.fallbackHours;
  } else {
    weeklyHours = {};
    for (const row of db.service_hours) {
      if (row.closed || !row.open_time || !row.close_time) continue;
      const key = String(row.day_of_week);
      (weeklyHours[key] ??= []).push({
        turno: row.turno,
        open: row.open_time.slice(0, 5),
        close: row.close_time.slice(0, 5),
      });
    }
  }

  const phone = config.phone ?? db.phone;

  return {
    status: "ok",
    restaurant: {
      slug,
      name: db.name,
      address: db.address,
      durationMinutes: db.settings.duration_minutes,
      telHref: phone ? toTelHref(phone) : null,
      whatsappHref: config.whatsapp
        ? `https://wa.me/${config.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
            `Hola, queremos reservar en ${db.name} para un grupo de más de ${db.settings.web_max_party_size} personas.`,
          )}`
        : null,
      rules: {
        timeZone: config.timeZone,
        slotStepMinutes: config.slotStepMinutes,
        lastSeatingBeforeCloseMinutes: config.lastSeatingBeforeCloseMinutes,
        minLeadTimeMinutes: db.settings.min_lead_time_minutes,
        maxAdvanceDays: db.settings.max_advance_days,
        maxPartySize: db.settings.web_max_party_size,
        daysShown: config.daysShown,
        weeklyHours,
        closedDates: db.closed_dates,
      },
    },
  };
});

export async function createPublicReservation(args: {
  slug: string;
  name: string;
  phone: string;
  partySize: number;
  startTime: Date;
}): Promise<{ ok: true; id: string } | { ok: false; code: string }> {
  const { data, error } = await anonClient().rpc("public_booking_create", {
    p_slug: args.slug,
    p_customer_name: args.name,
    p_customer_phone: args.phone,
    p_party_size: args.partySize,
    p_start_time: args.startTime.toISOString(),
  });
  if (error) {
    console.error("[reserva pública] public_booking_create:", error.code, error.message);
    return { ok: false, code: "db_error" };
  }
  const result = z
    .union([z.object({ id: z.string() }), z.object({ error: z.string() })])
    .safeParse(data);
  if (!result.success) return { ok: false, code: "db_error" };
  return "id" in result.data ? { ok: true, id: result.data.id } : { ok: false, code: result.data.error };
}
