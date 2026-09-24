import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

// /r/* es la página pública de reservas: sin sesión, no necesita refrescarla.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|r/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
