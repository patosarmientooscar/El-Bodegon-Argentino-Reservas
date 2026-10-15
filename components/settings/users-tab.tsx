"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, KeyRound, UserPlus } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleBadge } from "@/components/dashboard/role-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SaveBar, settingsErrorMessage, useSave } from "@/components/settings/save-bar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Database, UserRole } from "@/types/database.types";

type UserRow = Database["public"]["Tables"]["users"]["Row"];

/** Contraseña provisional fácil de dictar (sin 0/O ni 1/l). */
function randomPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(values, (v) => chars[v % chars.length]).join("");
}

export function UsersTab({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const [list, setList] = useState(users);

  async function handleRoleChange(userId: string, role: UserRole) {
    const { error } = await createClient().from("users").update({ role }).eq("id", userId);
    if (error) {
      toast.error(settingsErrorMessage(error));
      return;
    }
    setList((current) => current.map((u) => (u.id === userId ? { ...u, role } : u)));
    toast.success(role === "admin" ? "Ahora es administrador" : "Ahora es personal (staff)");
  }

  async function handleRemove(userId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("users").update({ restaurant_id: null }).eq("id", userId);
    if (error) {
      toast.error(settingsErrorMessage(error));
      return;
    }
    // Sus móviles dejan de recibir avisos de reservas.
    await supabase.from("push_subscriptions").delete().eq("user_id", userId);
    setList((current) => current.filter((u) => u.id !== userId));
    toast.success("Acceso quitado");
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Equipo</CardTitle>
          <CardDescription className="text-base">
            Admin: puede cambiar todo. Personal (staff): ve y gestiona las reservas y activa sus avisos, pero no cambia
            Ajustes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="text-base text-muted-foreground">Todavía no hay nadie en el equipo.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {list.map((user) => {
                const self = user.id === currentUserId;
                const name = user.name || user.email || "Sin nombre";
                return (
                  <li key={user.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-base font-semibold">
                        <span className="truncate">{name}</span>
                        {self && <span className="text-sm font-normal text-muted-foreground">(tú)</span>}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {self ? (
                        <RoleBadge role={user.role} />
                      ) : (
                        <select
                          aria-label={`Rol de ${name}`}
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                          className="h-11 rounded-md border border-input bg-transparent px-2 text-base [&>option]:bg-popover"
                        >
                          <option value="staff">Staff</option>
                          <option value="admin">Admin</option>
                        </select>
                      )}
                      {!self && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" className="h-11 border-red-400/50 text-base text-red-300 hover:bg-red-400/10">
                              Quitar
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Quitar el acceso a {name}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Ya no podrá entrar en el panel y su móvil dejará de recibir avisos. Se le puede volver a
                                dar acceso más tarde con el mismo email.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="h-11">Volver</AlertDialogCancel>
                              <AlertDialogAction variant="destructive" className="h-11" onClick={() => handleRemove(user.id)}>
                                Sí, quitar acceso
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <AddMemberCard onAdded={(user) => setList((current) => [...current.filter((u) => u.id !== user.id), user])} />
    </div>
  );
}

function AddMemberCard({ onAdded }: { onAdded: (user: UserRow) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(randomPassword);
  const [done, setDone] = useState<{ name: string; email: string; password: string | null } | null>(null);
  const save = useSave();

  async function handleAdd() {
    await save.run(async () => {
      let res: Response;
      try {
        res = await fetch("/api/team", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
      } catch {
        return "Sin conexión. Revisa internet e inténtalo otra vez.";
      }
      const result = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        existing?: boolean;
        user?: { id: string; name: string; email: string; role: UserRole };
      };
      if (!res.ok || !result.ok || !result.user) return result.error ?? "No se pudo dar acceso. Inténtalo otra vez.";
      onAdded({ ...result.user, restaurant_id: null } as UserRow);
      setDone({ name: result.user.name, email: result.user.email, password: result.existing ? null : password });
      setName("");
      setEmail("");
      setPassword(randomPassword());
      return null;
    });
  }

  async function copyDetails() {
    if (!done) return;
    const text = [
      "Panel de reservas de El Bodegón",
      `${window.location.origin}/login`,
      `Email: ${done.email}`,
      done.password ? `Contraseña: ${done.password}` : "Contraseña: la de siempre",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Datos copiados");
    } catch {
      toast.error("No se pudo copiar. Cópialos a mano.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserPlus className="size-5 text-primary" /> Dar acceso a alguien
        </CardTitle>
        <CardDescription className="text-base">
          Entra como personal (staff). Luego le pasas el email y la contraseña por WhatsApp o en persona.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {done && (
          <div role="status" className="flex flex-col gap-2 rounded-xl border border-green-400/40 bg-green-400/10 p-3 text-base">
            <p className="font-semibold text-green-200">Listo: {done.name} ya puede entrar.</p>
            <p>
              Email: <strong>{done.email}</strong>
              <br />
              {done.password ? (
                <>
                  Contraseña: <strong className="font-mono tracking-wide">{done.password}</strong>
                </>
              ) : (
                "Ya tenía cuenta: entra con su contraseña de siempre."
              )}
            </p>
            <Button variant="outline" onClick={copyDetails} className="h-11 self-start text-base">
              <Copy className="size-5" /> Copiar para enviárselo
            </Button>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="member-name" className="text-base">
              Nombre
            </Label>
            <Input id="member-name" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} className="h-12 text-base" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="member-email" className="text-base">
              Email
            </Label>
            <Input
              id="member-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 text-base"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="member-password" className="text-base">
            Contraseña provisional
          </Label>
          <div className="flex gap-2">
            <Input
              id="member-password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 font-mono text-base tracking-wide"
            />
            <Button type="button" variant="outline" aria-label="Generar otra" onClick={() => setPassword(randomPassword())} className="size-12 shrink-0">
              <KeyRound className="size-5" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Mínimo 8 caracteres. Apúntala: después no se vuelve a mostrar.</p>
        </div>
        <SaveBar status={save.status} error={save.error} onClick={handleAdd} label="Dar acceso" />
      </CardContent>
    </Card>
  );
}
