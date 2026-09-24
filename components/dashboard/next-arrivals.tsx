import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SourceIcon } from "@/components/dashboard/status-badges";
import { formatTime } from "@/lib/reservations/date";
import type { ReservationRow, TableRow } from "@/lib/reservations/status";

export function NextArrivals({
  reservations,
  tables,
  now,
}: {
  reservations: ReservationRow[];
  tables: TableRow[];
  now: Date;
}) {
  const tableByNumber = new Map(tables.map((t) => [t.id, t.number]));
  const upcoming = reservations
    .filter((r) => (r.status === "pending" || r.status === "confirmed") && new Date(r.start_time) >= now)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .slice(0, 5);

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-sm font-semibold">Próximas llegadas</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin más llegadas previstas hoy.</p>
        ) : (
          <ul className="divide-y">
            {upcoming.map((reservation) => (
              <li key={reservation.id}>
                <Link
                  href={`/reservations?id=${reservation.id}`}
                  className="flex items-center gap-3 py-2 text-sm hover:bg-accent/50 -mx-1 px-1 rounded"
                >
                  <span className="w-12 shrink-0 font-medium tabular-nums">
                    {formatTime(reservation.start_time)}
                  </span>
                  <span className="flex-1 truncate">{reservation.customer_name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {reservation.party_size}p
                    {reservation.table_id ? ` · M${tableByNumber.get(reservation.table_id) ?? "—"}` : " · sin mesa"}
                  </span>
                  <SourceIcon source={reservation.source} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
