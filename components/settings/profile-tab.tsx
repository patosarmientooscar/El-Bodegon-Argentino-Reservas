"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Database } from "@/types/database.types";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

export function ProfileTab({ restaurant }: { restaurant: Restaurant }) {
  const [name, setName] = useState(restaurant.name);
  const [address, setAddress] = useState(restaurant.address ?? "");
  const [phone, setPhone] = useState(restaurant.phone ?? "");
  const [logoUrl, setLogoUrl] = useState(restaurant.logo_url ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("restaurants")
      .update({ name, address: address || null, phone: phone || null })
      .eq("id", restaurant.id);
    setSaving(false);

    if (error) {
      toast.error("No se pudo guardar el perfil.", { description: error.message });
      return;
    }
    toast.success("Perfil actualizado.");
  }

  async function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const supabase = createClient();
    const path = `${restaurant.id}/logo-${Date.now()}.${file.name.split(".").pop()}`;
    const { error: uploadError } = await supabase.storage.from("restaurant-logos").upload(path, file, {
      upsert: true,
    });

    if (uploadError) {
      setUploading(false);
      toast.error("No se pudo subir el logo.", { description: uploadError.message });
      return;
    }

    const { data } = supabase.storage.from("restaurant-logos").getPublicUrl(path);
    const { error: updateError } = await supabase
      .from("restaurants")
      .update({ logo_url: data.publicUrl })
      .eq("id", restaurant.id);
    setUploading(false);

    if (updateError) {
      toast.error("No se pudo guardar el logo.", { description: updateError.message });
      return;
    }

    setLogoUrl(data.publicUrl);
    toast.success("Logo actualizado.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Perfil del restaurante</CardTitle>
        <CardDescription>Nombre, logo y datos de contacto.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-16 rounded-lg">
              <AvatarImage src={logoUrl} alt={name} />
              <AvatarFallback className="rounded-lg">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4" />
              {uploading ? "Subiendo…" : "Cambiar logo"}
            </Button>
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleLogoChange} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="address">Dirección</Label>
            <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Teléfono</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <Button type="submit" disabled={saving} className="self-start">
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
