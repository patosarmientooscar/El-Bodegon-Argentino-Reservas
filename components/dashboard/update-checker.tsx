"use client";

import { useEffect } from "react";

const CHECK_INTERVAL_MS = 5 * 60_000;
const RELOADED_KEY = "reservas:reloaded-for";

/**
 * iOS congela las apps de la pantalla de inicio y al reabrirlas no recarga:
 * se quedaba la versión vieja tras cada deploy. Al volver a primer plano (y
 * cada 5 min) compara el commit con el que se compiló esta página con el que
 * está publicado; si hay uno nuevo, recarga. En local (sin Vercel) no hace nada.
 */
export function UpdateChecker() {
  useEffect(() => {
    const current = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
    if (!current) return;

    let checking = false;
    async function check() {
      if (checking || document.visibilityState !== "visible") return;
      checking = true;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { sha } = (await res.json()) as { sha: string | null };
        if (!sha || sha === current) return;
        // Evita un bucle de recargas si el deploy nuevo aún se está propagando.
        let alreadyTried = false;
        try {
          alreadyTried = sessionStorage.getItem(RELOADED_KEY) === sha;
          sessionStorage.setItem(RELOADED_KEY, sha);
        } catch {}
        if (!alreadyTried) window.location.reload();
      } catch {
        // Sin conexión: se vuelve a intentar en la próxima comprobación.
      } finally {
        checking = false;
      }
    }

    void check();
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
      clearInterval(interval);
    };
  }, []);

  return null;
}
