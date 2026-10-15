import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { safeNext } from "@/lib/auth/errors";

export const metadata: Metadata = { title: "Entrar · El Bodegón" };

// Con sesión, el middleware ya manda a /home: aquí solo llega quien tiene que entrar.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; reset?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthShell title="Panel de reservas" subtitle="Entra para ver y gestionar las reservas.">
      <LoginForm next={safeNext(params.next)} noProfile={params.error === "sin-perfil"} passwordChanged={params.reset === "ok"} />
    </AuthShell>
  );
}
