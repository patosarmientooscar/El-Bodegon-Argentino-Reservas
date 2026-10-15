import { createClient } from "@/lib/supabase/server";
import { pushEnabled, sendPushToRestaurant } from "@/lib/notifications/push";

/**
 * POST /api/push/test — envía una notificación de prueba a todos los móviles
 * activados del restaurante del usuario. Solo con sesión en el panel.
 */
export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "Inicia sesión en el panel." }, { status: 401 });

  if (!pushEnabled()) {
    return Response.json(
      { ok: false, error: "Faltan las claves VAPID (VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY) en el servidor." },
      { status: 400 },
    );
  }

  const { data: profile } = await supabase.from("users").select("restaurant_id").eq("id", user.id).single();
  if (!profile?.restaurant_id) return Response.json({ ok: false, error: "Usuario sin restaurante." }, { status: 400 });

  try {
    const result = await sendPushToRestaurant(profile.restaurant_id, {
      title: "🔔 Prueba de avisos",
      body: "Si ves esto, las notificaciones de reservas funcionan en este móvil.",
      url: "/settings",
      tag: "prueba",
    });
    return Response.json({ ok: result.sent > 0, ...result });
  } catch (error) {
    console.error("[push test]", error);
    return Response.json({ ok: false, error: "No se pudo enviar la prueba." }, { status: 500 });
  }
}
