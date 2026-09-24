"use client";

import { useState } from "react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleBadge } from "@/components/dashboard/role-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
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
import type { Database } from "@/types/database.types";
import type { UserRole } from "@/types/database.types";

type UserRow = Database["public"]["Tables"]["users"]["Row"];

export function UsersTab({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const [list, setList] = useState(users);

  async function handleRoleChange(userId: string, role: UserRole) {
    const supabase = createClient();
    const { error } = await supabase.from("users").update({ role }).eq("id", userId);
    if (error) {
      toast.error("No se pudo cambiar el rol.", { description: error.message });
      return;
    }
    setList((current) => current.map((u) => (u.id === userId ? { ...u, role } : u)));
    toast.success("Rol actualizado.");
  }

  async function handleRemove(userId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("users").update({ restaurant_id: null }).eq("id", userId);
    if (error) {
      toast.error("No se pudo quitar el acceso.", { description: error.message });
      return;
    }
    setList((current) => current.filter((u) => u.id !== userId));
    toast.success("Usuario retirado del restaurante.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usuarios y roles</CardTitle>
        <CardDescription>
          Admin: acceso completo. Staff: Home y Reservations, sin acceso a Ajustes. Para dar de alta un usuario nuevo,
          créalo en Supabase Auth (o vía un flujo de invitación futuro) — esta pantalla gestiona los que ya existen.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay usuarios en este restaurante.</p>
        ) : (
          <ul className="divide-y">
            {list.map((user) => (
              <li key={user.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-medium">{user.name || user.email || "Sin nombre"}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <RoleBadge role={user.role} />
                  <Select
                    value={user.role}
                    onValueChange={(value) => handleRoleChange(user.id, value as UserRole)}
                    disabled={user.id === currentUserId}
                  >
                    <SelectTrigger size="sm" className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={user.id === currentUserId}>
                        Quitar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Quitar a {user.name || user.email} del restaurante?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Perderá acceso a este panel. Su cuenta de acceso no se elimina.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleRemove(user.id)}>Quitar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
