import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/team — { name, email, password }: da acceso al panel a alguien del
 * equipo como staff. Solo un admin (se comprueba con su sesión). Crea la cuenta
 * con la service role (solo servidor) ya confirmada, sin email: el correo de
 * Supabase sin SMTP propio no llega al personal. El admin le pasa los datos.
 *
 * Si el email ya tenía cuenta y no está en ningún restaurante (p. ej. se le quitó
 * el acceso), se le vuelve a dar; entra con su contraseña de siempre.
 */
export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(error: string, status = 400) {
  return Response.json({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Vuelve a entrar en el panel.", 401);

  const { data: me } = await supabase.from("users").select("role, restaurant_id").eq("id", user.id).single();
  if (!me || me.role !== "admin" || !me.restaurant_id) return fail("Solo un administrador puede dar acceso.", 403);

  let body: { name?: unknown; email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail("Petición no válida.");
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (name.length < 2 || name.length > 60) return fail("Pon su nombre (2 a 60 letras).");
  if (!EMAIL.test(email) || email.length > 120) return fail("Ese email no parece válido.");
  if (password.length < 8 || password.length > 72) return fail("La contraseña tiene que tener al menos 8 caracteres.");

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return fail("Falta configurar el servidor (SUPABASE_SERVICE_ROLE_KEY).", 500);
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
    app_metadata: { restaurant_id: me.restaurant_id, role: "staff" },
  });

  if (created?.user) {
    // Por si el trigger de la BD aún es el antiguo: la fila queda bien igualmente.
    const { error: rowError } = await admin
      .from("users")
      .upsert({ id: created.user.id, restaurant_id: me.restaurant_id, role: "staff", name, email }, { onConflict: "id" });
    if (rowError) {
      console.error("[team] fila users:", rowError.message);
      return fail("La cuenta se creó pero no se pudo asignar al restaurante. Inténtalo otra vez.", 500);
    }
    return Response.json({ ok: true, existing: false, user: { id: created.user.id, name, email, role: "staff" } });
  }

  const code = (createError as { code?: string } | null)?.code;
  if (code !== "email_exists" && !/already been registered|already exists/i.test(createError?.message ?? "")) {
    console.error("[team] createUser:", createError?.message);
    return fail("No se pudo crear la cuenta. Inténtalo otra vez.", 500);
  }

  // Ya tenía cuenta: solo se le vuelve a dar acceso si no está en otro restaurante.
  const { data: existing } = await admin.from("users").select("id, restaurant_id, role, name").eq("email", email).maybeSingle();
  if (!existing) return fail("Ese email ya tiene cuenta, pero no se encuentra. Habla con Evimes.", 409);
  if (existing.restaurant_id === me.restaurant_id) return fail("Esa persona ya está en el equipo.", 409);
  if (existing.restaurant_id) return fail("Ese email ya está en otro restaurante.", 409);

  const { error: updateError } = await admin
    .from("users")
    .update({ restaurant_id: me.restaurant_id, role: "staff", name: existing.name || name })
    .eq("id", existing.id);
  if (updateError) return fail("No se pudo dar acceso. Inténtalo otra vez.", 500);
  return Response.json({
    ok: true,
    existing: true,
    user: { id: existing.id, name: existing.name || name, email, role: "staff" },
  });
}
