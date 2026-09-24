"use client";

import { useState } from "react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { RestaurantSettings } from "@/lib/dashboard/context";
import type { Json } from "@/types/database.types";

interface DepositPolicy {
  enabled: boolean;
  amount: number;
  description: string;
}

function parseDepositPolicy(value: unknown): DepositPolicy {
  if (value && typeof value === "object") {
    const v = value as Partial<DepositPolicy>;
    return { enabled: v.enabled ?? false, amount: v.amount ?? 0, description: v.description ?? "" };
  }
  return { enabled: false, amount: 0, description: "" };
}

export function RulesTab({ settings }: { settings: RestaurantSettings }) {
  const [maxPartySize, setMaxPartySize] = useState(settings.max_party_size);
  const [minLeadTime, setMinLeadTime] = useState(settings.min_lead_time_minutes);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(settings.max_advance_days);
  const [duration, setDuration] = useState(settings.default_reservation_duration_minutes);
  const [buffer, setBuffer] = useState(settings.reservation_buffer_minutes);
  const [deposit, setDeposit] = useState<DepositPolicy>(() => parseDepositPolicy(settings.deposit_policy));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("restaurant_settings").upsert(
      {
        restaurant_id: settings.restaurant_id,
        max_party_size: maxPartySize,
        min_lead_time_minutes: minLeadTime,
        max_advance_days: maxAdvanceDays,
        default_reservation_duration_minutes: duration,
        reservation_buffer_minutes: buffer,
        deposit_policy: deposit as unknown as Json,
      },
      { onConflict: "restaurant_id" },
    );
    setSaving(false);

    if (error) {
      toast.error("No se pudieron guardar las reglas.", { description: error.message });
      return;
    }
    toast.success("Reglas guardadas.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reglas de reserva</CardTitle>
        <CardDescription>
          El buffer de &quot;reservada&quot; es el que usa Home para pintar una mesa en ámbar antes de que llegue el cliente.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Tamaño máximo de grupo</Label>
            <Input type="number" min={1} value={maxPartySize} onChange={(e) => setMaxPartySize(Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Duración estándar (min)</Label>
            <Input type="number" min={15} step={15} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Antelación mínima (min)</Label>
            <Input type="number" min={0} value={minLeadTime} onChange={(e) => setMinLeadTime(Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Antelación máxima (días)</Label>
            <Input type="number" min={1} value={maxAdvanceDays} onChange={(e) => setMaxAdvanceDays(Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
            <Label>Buffer de &quot;reservada&quot; (min)</Label>
            <Input type="number" min={0} value={buffer} onChange={(e) => setBuffer(Number(e.target.value))} />
          </div>
        </div>

        <div className="rounded-md border p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Depósito / política de no-show</p>
              <p className="text-xs text-muted-foreground">Se pide al confirmar reservas grandes o de última hora.</p>
            </div>
            <Switch checked={deposit.enabled} onCheckedChange={(checked) => setDeposit({ ...deposit, enabled: checked })} />
          </div>
          {deposit.enabled && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Importe</Label>
                <Input
                  type="number"
                  min={0}
                  value={deposit.amount}
                  onChange={(e) => setDeposit({ ...deposit, amount: Number(e.target.value) })}
                />
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label>Notas</Label>
                <Input
                  value={deposit.description}
                  onChange={(e) => setDeposit({ ...deposit, description: e.target.value })}
                  placeholder="Se cobra si no hay cancelación con 24h de antelación"
                />
              </div>
            </div>
          )}
        </div>

        <Button onClick={handleSave} disabled={saving} className="self-start">
          {saving ? "Guardando…" : "Guardar reglas"}
        </Button>
      </CardContent>
    </Card>
  );
}
