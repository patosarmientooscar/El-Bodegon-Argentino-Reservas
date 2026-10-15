"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type SaveError = { code?: string; message?: string; status?: number } | null | undefined;

/** Error de Supabase al guardar Ajustes → mensaje claro en español. */
export function settingsErrorMessage(error: SaveError): string {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "Sin conexión. Revisa internet e inténtalo otra vez.";
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  if (code === "42501" || /row-level security|permission denied/i.test(message)) {
    return "No tienes permiso para cambiar esto. Solo un administrador puede.";
  }
  if (code === "42703" || code === "PGRST204" || /column .* does not exist|Could not find the .* column/i.test(message)) {
    return "Falta activar esta opción: hay que pegar PEGAR_AJUSTES.sql en Supabase.";
  }
  if (code === "23505") return "Ya hay uno igual para ese día.";
  if (code === "23514") return "Algún dato no es válido. Revisa las horas (el cierre, después de la apertura).";
  if (/fetch|network/i.test(message)) return "Sin conexión. Revisa internet e inténtalo otra vez.";
  return "No se pudo guardar. Inténtalo otra vez en unos segundos.";
}

export type SaveStatus = "idle" | "saving" | "saved";

/**
 * Estado del botón Guardar de cada sección: "Guardando…" → "Guardado ✓" (3 s)
 * o un mensaje de error debajo. `run` recibe una función que devuelve el error
 * (o null si fue bien).
 */
export function useSave() {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function run(action: () => Promise<string | null>): Promise<boolean> {
    if (status === "saving") return false;
    clearTimeout(timer.current);
    setError(null);
    setStatus("saving");
    let message: string | null;
    try {
      message = await action();
    } catch (err) {
      message = settingsErrorMessage(err as SaveError);
    }
    if (message) {
      setError(message);
      setStatus("idle");
      return false;
    }
    setStatus("saved");
    timer.current = setTimeout(() => setStatus("idle"), 3000);
    return true;
  }

  return { status, error, setError, run };
}

export function SaveBar({
  status,
  error,
  label = "Guardar",
  disabled,
  onClick,
  className,
}: {
  status: SaveStatus;
  error: string | null;
  label?: string;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={onClick}
          disabled={disabled || status === "saving"}
          aria-busy={status === "saving"}
          className="h-12 min-w-36 text-base font-semibold"
        >
          {status === "saving" ? (
            <>
              <Loader2 className="size-5 animate-spin" /> Guardando…
            </>
          ) : (
            label
          )}
        </Button>
        {status === "saved" && (
          <span role="status" className="flex items-center gap-1.5 text-base font-medium text-green-300">
            <Check className="size-5" /> Guardado
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2.5 text-base text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}

/** Aviso para lo que necesita el SQL de la Fase 5 y aún no está pegado. */
export function MissingFeature({ children }: { children?: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-amber-400/50 bg-amber-400/10 px-3 py-2.5 text-base text-amber-100">
      <strong className="font-semibold">Falta activar esta opción.</strong>{" "}
      {children ?? "Hay que pegar PEGAR_AJUSTES.sql en Supabase (te lo explico al final)."}
    </p>
  );
}
