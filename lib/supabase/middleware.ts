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

  if (!autoLoginEnabled()) return supabaseResponse;

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
    const redirect = NextResponse.redirect(new URL("/home", request.url));
    supabaseResponse.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return supabaseResponse;
}
