import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/errors";

/**
 * GET /auth/confirm — destino del enlace del email "Recuperar contraseña".
 * - ?token_hash=…&type=recovery (plantilla de email recomendada): funciona aunque el
 *   enlace se abra en otro navegador o en otro móvil.
 * - ?code=… (plantilla por defecto de Supabase): solo en el mismo navegador que lo pidió.
 * Deja la sesión iniciada y lleva a ?next= (la página de contraseña nueva).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"), "/nueva-contrasena");

  const supabase = await createClient();
  let ok = false;
  if (tokenHash && type === "recovery") {
    ok = !(await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash })).error;
  } else if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  }

  return NextResponse.redirect(new URL(ok ? next : "/recuperar?error=enlace", request.url));
}
