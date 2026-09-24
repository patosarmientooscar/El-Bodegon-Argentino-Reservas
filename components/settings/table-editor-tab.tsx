"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { computeTableStatus } from "@/lib/reservations/status";
import { TableShape } from "@/components/dashboard/table-shape";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TableRow } from "@/lib/reservations/status";
import type { TableShape as TableShapeKind } from "@/types/database.types";

const SHAPE_OPTIONS: { value: TableShapeKind; label: string }[] = [
  { value: "round", label: "Redonda" },
  { value: "square", label: "Cuadrada" },
  { value: "rectangular", label: "Rectangular" },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function TableEditorTab({
  restaurantId,
  initialTables,
}: {
  restaurantId: string;
  initialTables: TableRow[];
}) {
  const [tables, setTables] = useState(initialTables);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ id: string; moved: boolean } | null>(null);

  const editingTable = tables.find((t) => t.id === editingId) ?? null;

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>, tableId: string) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = { id: tableId, moved: false };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const state = dragState.current;
    if (!state || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const xPct = clamp(((event.clientX - rect.left) / rect.width) * 100, 3, 97);
    const yPct = clamp(((event.clientY - rect.top) / rect.height) * 100, 3, 97);
    state.moved = true;
    setTables((current) => current.map((t) => (t.id === state.id ? { ...t, pos_x: xPct, pos_y: yPct } : t)));
  }

  async function handlePointerUp(tableId: string) {
    const state = dragState.current;
    dragState.current = null;
    if (!state) return;

    if (!state.moved) {
      setEditingId(tableId);
      return;
    }

    const table = tables.find((t) => t.id === tableId);
    if (!table) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("tables")
      .update({ pos_x: table.pos_x, pos_y: table.pos_y })
      .eq("id", table.id);
    if (error) toast.error("No se pudo guardar la posición.", { description: error.message });
  }

  async function handleAddTable() {
    setAdding(true);
    const nextNumber = tables.length > 0 ? Math.max(...tables.map((t) => t.number)) + 1 : 1;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("tables")
      .insert({ restaurant_id: restaurantId, number: nextNumber, capacity: 2, shape: "round", pos_x: 50, pos_y: 50 })
      .select()
      .single();
    setAdding(false);

    if (error || !data) {
      toast.error("No se pudo añadir la mesa.", { description: error?.message });
      return;
    }
    setTables((current) => [...current, data]);
    setEditingId(data.id);
  }

  function handleEditSave(patch: Partial<TableRow>) {
    if (!editingTable) return;
    setTables((current) => current.map((t) => (t.id === editingTable.id ? { ...t, ...patch } : t)));
  }

  async function persistEdit() {
    if (!editingTable) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("tables")
      .update({
        number: editingTable.number,
        capacity: editingTable.capacity,
        shape: editingTable.shape,
        status_override: editingTable.status_override,
      })
      .eq("id", editingTable.id);

    if (error) {
      toast.error("No se pudo guardar la mesa.", { description: error.message });
      return;
    }
    toast.success("Mesa actualizada.");
    setEditingId(null);
  }

  async function handleDelete() {
    if (!editingTable) return;
    const supabase = createClient();
    const { error } = await supabase.from("tables").delete().eq("id", editingTable.id);
    if (error) {
      toast.error("No se pudo eliminar la mesa.", { description: error.message });
      return;
    }
    setTables((current) => current.filter((t) => t.id !== editingTable.id));
    setEditingId(null);
    toast.success("Mesa eliminada.");
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle>Plano de mesas</CardTitle>
          <CardDescription>Arrastra para posicionar, haz clic para editar. Esto alimenta el plano de Home.</CardDescription>
        </div>
        <Button size="sm" onClick={handleAddTable} disabled={adding}>
          <Plus className="size-4" /> Añadir mesa
        </Button>
      </CardHeader>
      <CardContent>
        <div
          ref={containerRef}
          className="relative aspect-4/3 w-full touch-none overflow-hidden rounded-lg border bg-muted/30 sm:aspect-16/9"
        >
          <div className="pointer-events-none absolute inset-y-0 left-[63%] w-px bg-border" aria-hidden />
          {tables.map((table) => (
            <button
              key={table.id}
              type="button"
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none active:cursor-grabbing"
              style={{ left: `${table.pos_x}%`, top: `${table.pos_y}%` }}
              onPointerDown={(e) => handlePointerDown(e, table.id)}
              onPointerMove={handlePointerMove}
              onPointerUp={() => handlePointerUp(table.id)}
            >
              <TableShape
                number={table.number}
                shape={table.shape}
                status={computeTableStatus(table, [], 30, new Date()).status}
                selected={editingId === table.id}
              />
            </button>
          ))}
          {tables.length === 0 && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Añade tu primera mesa para empezar a dibujar el plano.
            </p>
          )}
        </div>
      </CardContent>

      <Dialog open={editingTable !== null} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent className="sm:max-w-sm">
          {editingTable && (
            <>
              <DialogHeader>
                <DialogTitle>Mesa {editingTable.number}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>Número</Label>
                    <Input
                      type="number"
                      min={1}
                      value={editingTable.number}
                      onChange={(e) => handleEditSave({ number: Number(e.target.value) })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Capacidad</Label>
                    <Input
                      type="number"
                      min={1}
                      value={editingTable.capacity}
                      onChange={(e) => handleEditSave({ capacity: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Forma</Label>
                  <Select
                    value={editingTable.shape}
                    onValueChange={(v) => handleEditSave({ shape: v as TableShapeKind })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SHAPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">Bloqueada</p>
                    <p className="text-xs text-muted-foreground">Mantenimiento o evento privado</p>
                  </div>
                  <Switch
                    checked={editingTable.status_override === "blocked"}
                    onCheckedChange={(checked) => handleEditSave({ status_override: checked ? "blocked" : null })}
                  />
                </div>
              </div>
              <DialogFooter className="flex-row justify-between sm:justify-between">
                <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={handleDelete}>
                  <Trash2 className="size-4" /> Eliminar
                </Button>
                <Button onClick={persistEdit}>Guardar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
