import type { Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const viewport: Viewport = {
  themeColor: "#0f0d0b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function PublicBookingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${playfair.variable} ${inter.variable} min-h-dvh bg-[#0f0d0b] font-[family-name:var(--font-inter)] text-[#f3ead8] antialiased`}
    >
      {/* El body global es claro (panel): en esta página pública lo igualamos
          al fondo para que el rebote de scroll en iOS no muestre blanco. */}
      <style>{`html,body{background:#0f0d0b}`}</style>
      {children}
    </div>
  );
}
