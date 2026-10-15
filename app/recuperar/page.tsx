import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { RecoverForm } from "@/components/auth/recover-form";

export const metadata: Metadata = { title: "Recuperar contraseña · El Bodegón" };

export default async function RecoverPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthShell title="¿Has olvidado la contraseña?" subtitle="Te enviamos un email con un enlace para poner una nueva.">
      <RecoverForm initialEmail={params.email ?? ""} linkExpired={params.error === "enlace"} />
    </AuthShell>
  );
}
