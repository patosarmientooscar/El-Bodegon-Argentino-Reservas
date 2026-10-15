"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RecoverForm({ initialEmail, linkExpired }: { initialEmail: string; linkExpired: boolean }) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(
    linkExpired ? "Ese enlace ha caducado o ya se usó. Pide uno nuevo aquí." : null,
  );
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const { error: sendError } = await createClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/confirm?next=/nueva-contrasena`,
      });
      if (sendError) {
        setError(authErrorMessage(sendError));
        return;
      }
      setSent(true);
    } catch (err) {
      setError(authErrorMessage(err as Error));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    // Mismo mensaje exista o no la cuenta: así no se puede averiguar qué emails están dados de alta.
    return (
      <div className="flex flex-col gap-5">
        <div role="status" className="flex gap-3 rounded-lg border border-green-400/40 bg-green-400/10 px-3 py-3 text-base text-green-100">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-green-300" />
          <p>
            Si <strong>{email.trim()}</strong> tiene cuenta, te llegará un email en unos minutos. Ábrelo y pulsa el
            enlace. Mira también en «Spam».
          </p>
        </div>
        <Button asChild variant="outline" className="h-12 text-base">
          <Link href="/login">Volver a entrar</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email" className="text-base">
          Email de tu cuenta
        </Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-12 text-base"
        />
      </div>
      {error && (
        <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2.5 text-base text-red-200">
          {error}
        </p>
      )}
      <Button type="submit" disabled={loading} aria-busy={loading} className="h-12 w-full text-base font-semibold">
        {loading ? (
          <>
            <Loader2 className="size-5 animate-spin" /> Enviando…
          </>
        ) : (
          "Enviar enlace"
        )}
      </Button>
      <Link href="/login" className="flex min-h-11 items-center justify-center text-base text-primary underline-offset-4 hover:underline">
        Volver a entrar
      </Link>
    </form>
  );
}
