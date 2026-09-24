/**
 * ¿Queda mesa para N personas en un intervalo? Misma regla que la función
 * public_booking_pick_table de la BD (que es quien decide al guardar):
 *
 *  1. Mesas libres = no bloqueadas y sin reservas con mesa que se solapen.
 *  2. Las reservas SIN mesa que se solapan también ocupan: junto con la
 *     nueva, de mayor a menor grupo, cada una se queda la mesa libre más
 *     pequeña donde cabe. Si la nueva no encuentra mesa → no disponible.
 *
 * Si el restaurante no tiene mesas creadas no se filtra (solo horario).
 */

export interface OccupancyTable {
  id: string;
  number: number;
  capacity: number;
}

export interface OccupancyBooking {
  table_id: string | null;
  party_size: number;
  start_time: string;
  duration_minutes: number;
}

export interface Occupancy {
  tables: OccupancyTable[];
  busy: OccupancyBooking[];
}

export function hasFreeTable(occupancy: Occupancy | null, startMs: number, endMs: number, partySize: number): boolean {
  if (!occupancy || occupancy.tables.length === 0) return true;

  const overlapping = occupancy.busy.filter((b) => {
    const s = Date.parse(b.start_time);
    return s < endMs && s + b.duration_minutes * 60_000 > startMs;
  });

  const taken = new Set(overlapping.filter((b) => b.table_id).map((b) => b.table_id));
  const free = occupancy.tables
    .filter((t) => !taken.has(t.id))
    .sort((a, b) => a.capacity - b.capacity || a.number - b.number);

  const items = overlapping
    .filter((b) => !b.table_id)
    .map((b) => ({ size: b.party_size, isNew: false }));
  items.push({ size: partySize, isNew: true });
  items.sort((a, b) => b.size - a.size || Number(a.isNew) - Number(b.isNew));

  for (const item of items) {
    const i = free.findIndex((t) => t.capacity >= item.size);
    if (i === -1) {
      if (item.isNew) return false;
      continue;
    }
    if (item.isNew) return true;
    free.splice(i, 1);
  }
  return false;
}
