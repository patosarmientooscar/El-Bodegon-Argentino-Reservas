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
    <Card className="gap-2 py-3 sm:gap-3 sm:py-4">
      <CardHeader className="px-3 sm:px-4">
        <CardTitle className="text-sm font-semibold">Próximas llegadas</CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-4">
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin más llegadas previstas hoy.</p>
        ) : (
          <ul className="divide-y">
            {upcoming.map((reservation) => (
              <li key={reservation.id}>
                {/* En móvil la columna es estrecha: hora + nombre arriba, personas y mesa debajo. */}
                <Link
                  href={`/home?id=${reservation.id}`}
                  scroll={false}
                  className="-mx-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 rounded px-1 py-2 text-sm hover:bg-accent/50 sm:flex sm:items-center sm:gap-3"
                >
                  <span className="font-medium tabular-nums sm:w-12 sm:shrink-0">
                    {formatTime(reservation.start_time)}
                  </span>
                  <span className="truncate sm:flex-1">{reservation.customer_name}</span>
                  <span className="col-span-2 text-xs text-muted-foreground sm:shrink-0 sm:text-sm">
                    {reservation.party_size}p
                    {reservation.table_id ? ` · M${tableByNumber.get(reservation.table_id) ?? "—"}` : " · sin mesa"}
                  </span>
                  <span className="hidden sm:inline-flex">
                    <SourceIcon source={reservation.source} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
