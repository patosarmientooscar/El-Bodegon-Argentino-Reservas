import type { MetadataRoute } from "next";

/** Manifest de la app instalable (Android y "Añadir a pantalla de inicio" en iPhone). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Reservas El Bodegón",
    short_name: "El Bodegón",
    description: "Panel de reservas de El Bodegón Argentino",
    lang: "es",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    // Gira con el móvil o la tablet (antes solo vertical).
    orientation: "any",
    background_color: "#1A1714",
    theme_color: "#1A1714",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
