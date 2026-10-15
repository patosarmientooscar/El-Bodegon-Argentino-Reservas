"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/auth/password-input";

const MIN_LENGTH = 8;

export function NewPasswordForm({ email }: { email: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    if (password.length < MIN_LENGTH) return setError(`Usa al menos ${MIN_LENGTH} caracteres.`);
    if (password !== repeat) return setError("Las dos contraseñas no coinciden.");
    setError(null);
    setLoading(true);
    try {
      const { error: updateError } = await createClient().auth.updateUser({ password });
      if (updateError) {
        setError(authErrorMessage(updateError));
        setLoading(false);
        return;
      }
    } catch (err) {
      setError(authErrorMessage(err as Error));
      setLoading(false);
      return;
    }
    toast.success("Contraseña cambiada");
    router.replace("/home");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Para que el gestor de contraseñas guarde la nueva con el email correcto. */}
      <input type="email" name="email" autoComplete="username" value={email} readOnly hidden />
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-password" className="text-base">
          Contraseña nueva
        </Label>
        <PasswordInput
          id="new-password"
          autoComplete="new-password"
          required
          minLength={MIN_LENGTH}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <p className="text-sm text-muted-foreground">Mínimo {MIN_LENGTH} caracteres.</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="repeat-password" className="text-base">
          Repítela
        </Label>
        <PasswordInput
          id="repeat-password"
          autoComplete="new-password"
          required
          value={repeat}
          onChange={(event) => setRepeat(event.target.value)}
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
            <Loader2 className="size-5 animate-spin" /> Guardando…
          </>
        ) : (
          "Guardar y entrar"
        )}
      </Button>
    </form>
  );
}
