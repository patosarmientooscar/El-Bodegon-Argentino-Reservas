import { z } from "zod";

import { getPublicRestaurant } from "@/lib/public-booking/data";
import { buildIcs } from "@/lib/public-booking/ics";
import { zonedToUtc } from "@/lib/public-booking/time";

const querySchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  personas: z.coerce.number().int().min(1).max(50),
  nombre: z.string().trim().min(1).max(80),
  id: z.string().uuid().optional(),
});

/** GET /r/[slug]/calendario?fecha=2026-09-25&hora=21:00&personas=2&nombre=Ana → .ics */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return new Response("Enlace de calendario no válido", { status: 400 });

  const result = await getPublicRestaurant(slug);
  if (result.status !== "ok") return new Response("Restaurante no encontrado", { status: 404 });
  const { restaurant } = result;
  const { fecha, hora, personas, nombre, id } = query.data;

  const start = zonedToUtc(restaurant.rules.timeZone, fecha, hora);
  const end = new Date(start.getTime() + restaurant.durationMinutes * 60_000);

  const ics = buildIcs({
    uid: `${id ?? `${slug}-${fecha}-${hora}`}@reservas.evimes`,
    start,
    end,
    summary: `Mesa para ${personas} · ${restaurant.name}`,
    description: `Reserva a nombre de ${nombre}. Pendiente de confirmación por el restaurante.`,
    location: restaurant.address,
  });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="reserva-${slug}-${fecha}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
