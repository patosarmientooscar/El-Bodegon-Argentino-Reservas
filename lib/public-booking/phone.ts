/** Validación simple de teléfono, compartida por el formulario y el Server Action. */

export const DEFAULT_PHONE_PREFIX = "+34";

export type PhoneResult = { ok: true; e164: string } | { ok: false; message: string };

export function normalizePhone(prefix: string, raw: string): PhoneResult {
  const compact = raw.replace(/[\s().-]/g, "");
  if (!compact) return { ok: false, message: "Necesitamos un teléfono para confirmarte la reserva." };

  let e164: string;
  if (compact.startsWith("+")) e164 = compact;
  else if (compact.startsWith("00")) e164 = `+${compact.slice(2)}`;
  else e164 = `${prefix.replace(/[^\d+]/g, "") || DEFAULT_PHONE_PREFIX}${compact}`;

  if (!/^\+\d{8,15}$/.test(e164)) {
    return { ok: false, message: "Ese teléfono no parece válido. Revisa los números." };
  }
  if (e164.startsWith("+34") && !/^\+34[6789]\d{8}$/.test(e164)) {
    return { ok: false, message: "Revisa el teléfono: son 9 cifras, p. ej. 612 345 678." };
  }
  return { ok: true, e164 };
}

/** "91 123 45 67" / "+34911234567" → "+34911234567" (para enlaces tel:). */
export function toTelHref(phone: string): string {
  const compact = phone.replace(/[^\d+]/g, "");
  return `tel:${compact.startsWith("+") ? compact : `+34${compact}`}`;
}

export function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 2) return "¿A nombre de quién reservamos?";
  if (trimmed.length > 80) return "El nombre es demasiado largo.";
  return null;
}
