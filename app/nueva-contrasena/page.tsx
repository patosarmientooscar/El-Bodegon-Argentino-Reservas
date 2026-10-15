import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { NewPasswordForm } from "@/components/auth/new-password-form";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Nueva contraseña · El Bodegón" };

// Se llega desde el enlace del email (/auth/confirm deja la sesión iniciada).
export default async function NewPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <AuthShell title="Enlace caducado" subtitle="Ese enlace ya no sirve. Pide uno nuevo y ábrelo enseguida.">
        <Button asChild className="h-12 text-base font-semibold">
          <Link href="/recuperar">Pedir otro enlace</Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Nueva contraseña" subtitle={`Para ${user.email}. Elige una que puedas recordar.`}>
      <NewPasswordForm email={user.email ?? ""} />
    </AuthShell>
  );
}
