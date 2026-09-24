import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReservationStatusBadge, SourceIcon } from "@/components/dashboard/status-badges";
import { formatTime } from "@/lib/reservations/date";
import type { ReservationRow, TableRow as TableRowModel } from "@/lib/reservations/status";

export function ReservationsList({
  reservations,
  tables,
  onSelect,
}: {
  reservations: ReservationRow[];
  tables: TableRowModel[];
  onSelect: (id: string) => void;
}) {
  const tableByNumber = new Map(tables.map((t) => [t.id, t.number]));

  if (reservations.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-center text-sm text-muted-foreground">
        <p>Sin reservas para este día con estos filtros.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Hora</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Personas</TableHead>
            <TableHead>Mesa</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Origen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reservations.map((reservation) => (
            <TableRow
              key={reservation.id}
              className="cursor-pointer"
              onClick={() => onSelect(reservation.id)}
            >
              <TableCell className="font-medium tabular-nums">{formatTime(reservation.start_time)}</TableCell>
              <TableCell>{reservation.customer_name}</TableCell>
              <TableCell className="tabular-nums">{reservation.party_size}</TableCell>
              <TableCell>
                {reservation.table_id ? `Mesa ${tableByNumber.get(reservation.table_id) ?? "—"}` : "Sin asignar"}
              </TableCell>
              <TableCell>
                <ReservationStatusBadge status={reservation.status} />
              </TableCell>
              <TableCell>
                <SourceIcon source={reservation.source} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
