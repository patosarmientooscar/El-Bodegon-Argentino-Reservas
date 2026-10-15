"use client";

import { useEffect } from "react";

/** Registra public/sw.js (notificaciones push y app instalable). */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      console.error("[pwa] No se pudo registrar el service worker:", error);
    });
  }, []);
  return null;
}
