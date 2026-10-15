import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

/**
 * Cliente con la service role: salta RLS. SOLO para route handlers del
 * servidor que no tienen usuario (webhooks de Supabase y Telegram).
 * SUPABASE_SERVICE_ROLE_KEY no lleva NEXT_PUBLIC_, así que Next nunca la
 * incluye en el bundle del navegador.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient solo puede usarse en el servidor.");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
