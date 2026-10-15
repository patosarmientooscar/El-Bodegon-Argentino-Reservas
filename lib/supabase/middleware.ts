import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Acceso directo sin login: si AUTO_LOGIN_EMAIL y AUTO_LOGIN_PASSWORD están en
 * .env.local, el panel inicia sesión solo con esa cuenta y nunca muestra
 * /login. Son variables de servidor (sin NEXT_PUBLIC_): la contraseña no llega
 * al navegador. Vacías = la app vuelve a pedir login.
 *
 * Con esto activo, cualquiera que llegue a la URL del panel entra con esa cuenta.
 */
export function autoLoginEnabled() {
  return Boolean(process.env.AUTO_LOGIN_EMAIL && process.env.AUTO_LOGIN_PASSWORD);
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresca la sesión si el access token expiró. No quitar: sin este
  // getUser(), las Server Components pierden la sesión de forma intermitente.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!autoLoginEnabled()) {
    const { pathname, search, searchParams } = request.nextUrl;
    // Ya hay sesión: /login lleva directo a "Hoy" (salvo el aviso de cuenta sin restaurante).
    if (user && pathname === "/login" && !searchParams.has("error")) {
      return redirectWithCookies(request, "/home", supabaseResponse);
    }
    // Sin sesión en el panel: a /login, y después de entrar se vuelve a donde iba
    // (p. ej. la reserva que abrió una notificación).
    if (!user && PANEL_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      return redirectWithCookies(request, `/login?next=${encodeURIComponent(pathname + search)}`, supabaseResponse);
    }
    return supabaseResponse;
  }

  if (!user) {
    const { error } = await supabase.auth.signInWithPassword({
      email: process.env.AUTO_LOGIN_EMAIL!,
      password: process.env.AUTO_LOGIN_PASSWORD!,
    });
    if (error) {
      console.error("[auto-login] No se pudo iniciar sesión:", error.message);
      return supabaseResponse;
    }
  }

  // Sin pantalla de login: / y /login llevan directamente al panel.
  const { pathname } = request.nextUrl;
  if (pathname === "/" || pathname === "/login") {
    return redirectWithCookies(request, "/home", supabaseResponse);
  }

  return supabaseResponse;
}

/** Páginas del panel que necesitan sesión. */
const PANEL_PATHS = ["/home", "/reservations", "/settings"];

/** Redirección que conserva las cookies de sesión recién refrescadas. */
function redirectWithCookies(request: NextRequest, to: string, from: NextResponse) {
  const redirect = NextResponse.redirect(new URL(to, request.url));
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
