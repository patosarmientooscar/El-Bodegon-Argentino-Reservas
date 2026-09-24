"use client";

import { useState } from "react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { RestaurantSettings } from "@/lib/dashboard/context";
import type { Json } from "@/types/database.types";

interface NotificationConfig {
  confirmationMessage: string;
  reminderMessage: string;
  reminderHoursBefore: number;
  whatsappEnabled: boolean;
  emailEnabled: boolean;
}

const DEFAULT_CONFIG: NotificationConfig = {
  confirmationMessage: "Hola {nombre}, tu mesa para {personas} está confirmada para las {hora}. ¡Te esperamos!",
  reminderMessage: "Recordatorio: tu reserva es hoy a las {hora}. Responde para confirmar.",
  reminderHoursBefore: 2,
  whatsappEnabled: false,
  emailEnabled: false,
};

function parseConfig(value: unknown): NotificationConfig {
  if (value && typeof value === "object") {
    const v = value as Partial<{
      confirmationMessage: string;
      reminderMessage: string;
      reminderHoursBefore: number;
      whatsappEnabled: boolean;
      emailEnabled: boolean;
    }>;
    return { ...DEFAULT_CONFIG, ...v };
  }
  return DEFAULT_CONFIG;
}

export function NotificationsTab({ settings }: { settings: RestaurantSettings }) {
  const [config, setConfig] = useState<NotificationConfig>(() => parseConfig(settings.notification_settings));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("restaurant_settings").upsert(
      {
        restaurant_id: settings.restaurant_id,
        notification_settings: config as unknown as Json,
      },
      { onConflict: "restaurant_id" },
    );
    setSaving(false);

    if (error) {
      toast.error("No se pudo guardar.", { description: error.message });
      return;
    }
    toast.success("Notificaciones guardadas.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notificaciones</CardTitle>
        <CardDescription>
          Plantillas y timing de confirmación/recordatorio. El envío real por WhatsApp/email requiere conectar un
          proveedor — esto solo guarda la configuración.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Mensaje de confirmación</Label>
          <Textarea
            rows={3}
            value={config.confirmationMessage}
            onChange={(e) => setConfig({ ...config, confirmationMessage: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Mensaje de recordatorio</Label>
          <Textarea
            rows={3}
            value={config.reminderMessage}
            onChange={(e) => setConfig({ ...config, reminderMessage: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5 max-w-xs">
          <Label>Enviar recordatorio (horas antes)</Label>
          <Input
            type="number"
            min={0}
            value={config.reminderHoursBefore}
            onChange={(e) => setConfig({ ...config, reminderHoursBefore: Number(e.target.value) })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <p className="text-sm font-medium">WhatsApp</p>
            <Switch
              checked={config.whatsappEnabled}
              onCheckedChange={(checked) => setConfig({ ...config, whatsappEnabled: checked })}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <p className="text-sm font-medium">Email</p>
            <Switch
              checked={config.emailEnabled}
              onCheckedChange={(checked) => setConfig({ ...config, emailEnabled: checked })}
            />
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="self-start">
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </CardContent>
    </Card>
  );
}
