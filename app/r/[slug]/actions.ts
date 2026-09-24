"use server";

import { z } from "zod";

import { createPublicReservation, getPublicRestaurant } from "@/lib/public-booking/data";
import { normalizePhone, validateName } from "@/lib/public-booking/phone";
import { isSlotBookable } from "@/lib/public-booking/schedule";
import { zonedToUtc } from "@/lib/public-booking/time";

export type BookingField = "partySize" | "date" | "time" | "name" | "phone";

export type CreateBookingResult =
  | {
      ok: true;
      booking: { id: string; name: string; date: string; time: string; partySize: number };
    }
  | { ok: false; message: string; fieldErrors?: Partial<Record<BookingField, string>> };

const inputSchema = z.object({
  slug: z.string().max(80),
  partySize: z.number().int().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  name: z.string().trim().max(200),
  phonePrefix: z.string().regex(/^\+?\d{1,4}$/),
  phone: z.string().max(40),
});

export type CreateBookingInput = z.input<typeof inputSchema>;

const GENERIC_ERROR = "No hemos podido guardar la reserva. Inténtalo de nuevo en un momento.";

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Revisa los datos de la reserva." };
  const data = parsed.data;

  const fieldErrors: Partial<Record<BookingField, string>> = {};
  const nameError = validateName(data.name);
  if (nameError) fieldErrors.name = nameError;
  const phone = normalizePhone(data.phonePrefix, data.phone);
  if (!phone.ok) fieldErrors.phone = phone.message;

  // Relee la configuración: el servidor es quien decide, no lo que pintó el móvil.
  const result = await getPublicRestaurant(data.slug);
  if (result.status !== "ok") return { ok: false, message: GENERIC_ERROR };
  const { rules } = result.restaurant;

  if (data.partySize > rules.maxPartySize) {
    fieldErrors.partySize = `Para más de ${rules.maxPartySize} personas, llámanos o escríbenos por WhatsApp.`;
  }
  if (!isSlotBookable(rules, data.date, data.time, new Date())) {
    fieldErrors.time = "Esa hora ya no está disponible. Elige otra, por favor.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Revisa lo que te marcamos abajo.", fieldErrors };
  }

  const created = await createPublicReservation({
    slug: data.slug,
    name: data.name,
    phone: (phone as { e164: string }).e164,
    partySize: data.partySize,
    startTime: zonedToUtc(rules.timeZone, data.date, data.time),
  });

  if (!created.ok) {
    const timeCodes = ["past_time", "too_far", "closed_day", "outside_hours"];
    if (timeCodes.includes(created.code)) {
      return {
        ok: false,
        message: "Revisa lo que te marcamos abajo.",
        fieldErrors: { time: "Esa hora ya no está disponible. Elige otra, por favor." },
      };
    }
    return { ok: false, message: GENERIC_ERROR };
  }

  // Punto de enganche para la confirmación al cliente (email/WhatsApp). El
  // esquema actual no guarda email ni hay proveedor (Resend) configurado, así
  // que no se envía nada: el staff confirma desde el panel.

  return {
    ok: true,
    booking: {
      id: created.id,
      name: data.name,
      date: data.date,
      time: data.time,
      partySize: data.partySize,
    },
  };
}
