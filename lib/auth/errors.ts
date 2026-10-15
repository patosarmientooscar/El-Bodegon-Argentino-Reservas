import type { AuthError } from "@supabase/supabase-js";

/** Ruta segura para volver tras entrar: solo rutas internas (nada de "//otro-sitio"). */
export function safeNext(next: string | null | undefined, fallback = "/home"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/login")) return fallback;
  return next;
}

/** Errores de Supabase Auth → mensaje claro en español (nunca el texto técnico en inglés). */
export function authErrorMessage(error: AuthError | Error | null | undefined): string {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "Sin conexión. Revisa internet e inténtalo otra vez.";
  const e = (error ?? {}) as { code?: string; status?: number; name?: string };
  if (e.name === "AuthRetryableFetchError" || e.status === 0) return "Sin conexión. Revisa internet e inténtalo otra vez.";
  switch (e.code) {
    case "invalid_credentials":
      return "Email o contraseña incorrectos.";
    case "email_not_confirmed":
      return "Esta cuenta aún no está confirmada. Revisa tu email.";
    case "user_banned":
      return "Esta cuenta está desactivada. Habla con el administrador.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Demasiados intentos seguidos. Espera unos minutos y vuelve a probar.";
    case "same_password":
      return "La contraseña nueva tiene que ser distinta de la anterior.";
    case "weak_password":
      return "Esa contraseña es demasiado fácil. Usa al menos 8 caracteres, mejor con números.";
    case "session_not_found":
    case "session_expired":
    case "otp_expired":
      return "El enlace ha caducado o ya se usó. Pide uno nuevo.";
    case "email_address_invalid":
      return "Ese email no parece válido.";
  }
  if (e.status === 429) return "Demasiados intentos seguidos. Espera unos minutos y vuelve a probar.";
  if (e.status === 400) return "Email o contraseña incorrectos.";
  return "Algo ha fallado. Inténtalo otra vez en unos segundos.";
}
