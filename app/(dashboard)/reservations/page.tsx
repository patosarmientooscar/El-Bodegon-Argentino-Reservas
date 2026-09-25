import { redirect } from "next/navigation";

// Reservas vive ahora dentro de Home (debajo del plano). Esta ruta solo
// redirige, para que los enlaces antiguos (?date=, ?id=) sigan funcionando.
export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; id?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.date) query.set("date", params.date);
  if (params.id) query.set("id", params.id);
  const qs = query.toString();
  redirect(qs ? `/home?${qs}` : "/home#reservas");
}
