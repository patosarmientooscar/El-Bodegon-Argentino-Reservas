import type { Viewport } from "next";
import { Great_Vibes, Montserrat, Playfair_Display } from "next/font/google";

import "./reservar.css";

// Mismas fuentes que la web del restaurante.
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});
const greatVibes = Great_Vibes({ subsets: ["latin"], weight: "400", variable: "--font-great-vibes", display: "swap" });
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-montserrat",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#e8e6e1",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function PublicBookingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`rv-root ${playfair.variable} ${greatVibes.variable} ${montserrat.variable}`}>
      {/* El body global es el del panel: aquí lo igualamos al lienzo para
          que el rebote de scroll en iOS no muestre otro color. */}
      <style>{`html,body{background:#e8e6e1}`}</style>
      {children}
    </div>
  );
}
