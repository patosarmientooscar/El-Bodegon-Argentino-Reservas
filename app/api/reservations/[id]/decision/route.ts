import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/reservations/[id]/decision — { decision: "accept" | "reject" }
 * Lo usan los botones Aceptar / Rechazar de la notificación push (public/sw.js).
 * Va con la sesión del usuario del móvil: RLS decide si puede tocar la reserva.
 * Solo cambia reservas que siguen pendientes (rechazar = cancelled).
 */
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ ok: false, error: "Reserva no válida." }, { status: 400 });

  let decision: unknown;
  try {
    ({ decision } = (await request.json()) as { decision?: unknown });
  } catch {
    return Response.json({ ok: false, error: "Petición no válida." }, { status: 400 });
  }
  if (decision !== "accept" && decision !== "reject") {
    return Response.json({ ok: false, error: "Decisión no válida." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "Inicia sesión en el panel." }, { status: 401 });

  const { data, error } = await supabase
    .from("reservations")
    .update({ status: decision === "accept" ? "confirmed" : "cancelled" })
    .eq("id", id)
    .eq("status", "pending")
    .select("id, status, customer_name")
    .maybeSingle();

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  if (!data) {
    return Response.json({ ok: false, error: "La reserva ya no está pendiente." }, { status: 409 });
  }
  return Response.json({ ok: true, status: data.status, customerName: data.customer_name });
}
