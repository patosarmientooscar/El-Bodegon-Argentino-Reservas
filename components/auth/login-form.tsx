"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/auth/password-input";

export function LoginForm({
  next,
  noProfile,
  passwordChanged,
}: {
  /** A dónde volver tras entrar (p. ej. la reserva de una notificación). */
  next: string;
  /** La cuenta entró pero no tiene restaurante asignado. */
  noProfile: boolean;
  passwordChanged: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    noProfile ? "Esta cuenta no tiene ningún restaurante asignado. Habla con el administrador." : null,
  );
  const [loading, setLoading] = useState(false);

  // Sin restaurante: se cierra esa sesión para poder entrar con otra cuenta.
  useEffect(() => {
    if (noProfile) void createClient().auth.signOut();
  }, [noProfile]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      const { error: signInError } = await createClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError(authErrorMessage(signInError));
        setLoading(false);
        return;
      }
    } catch (err) {
      setError(authErrorMessage(err as Error));
      setLoading(false);
      return;
    }

    // Se queda "Entrando…" hasta que carga el panel.
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {passwordChanged && !error && (
        <p role="status" className="rounded-lg border border-green-400/40 bg-green-400/10 px-3 py-2.5 text-base text-green-200">
          Contraseña cambiada. Ya puedes entrar con la nueva.
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email" className="text-base">
          Email
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
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="password" className="text-base">
            Contraseña
          </Label>
          <Link
            href={email ? `/recuperar?email=${encodeURIComponent(email.trim())}` : "/recuperar"}
            className="flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline"
          >
            ¿Has olvidado la contraseña?
          </Link>
        </div>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
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
            <Loader2 className="size-5 animate-spin" /> Entrando…
          </>
        ) : (
          "Entrar"
        )}
      </Button>
    </form>
  );
}
