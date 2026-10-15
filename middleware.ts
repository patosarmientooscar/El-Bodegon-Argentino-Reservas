import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

// /r/* es la página pública de reservas: sin sesión, no necesita refrescarla.
// Los webhooks (Supabase y Telegram) se autentican con su propio secreto.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|r/|api/webhooks/|api/telegram/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
