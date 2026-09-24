import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BookingExperience } from "@/components/public-booking/booking-experience";
import { PublicHeader } from "@/components/public-booking/public-header";
import { getPublicRestaurant } from "@/lib/public-booking/data";

// Las franjas dependen de la hora actual: siempre render en cada petición.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

function siteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return new URL(explicit);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  return new URL(vercel ? `https://${vercel}` : "http://localhost:3000");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublicRestaurant(slug);
  if (result.status !== "ok") return { title: "Reservas", robots: { index: false } };

  const { name } = result.restaurant;
  const title = `Reserva tu mesa · ${name}`;
  const description = `Reserva en ${name} en menos de 20 segundos. Sin registro: elige día, hora y cuántos sois.`;

  return {
    metadataBase: siteUrl(),
    title,
    description,
    alternates: { canonical: `/r/${slug}` },
    openGraph: {
      type: "website",
      locale: "es_ES",
      url: `/r/${slug}`,
      siteName: name,
      title,
      description,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PublicBookingPage({ params }: Props) {
  const { slug } = await params;
  const result = await getPublicRestaurant(slug);

  if (result.status === "not_found") notFound();

  if (result.status === "error") {
    return (
      <main className="rv">
        <section className="rv-stage">
          <PublicHeader name="El Bodegón Argentino" />
        </section>
        <section className="rv-panel rv-unavailable">
          <p className="rv-success-title">Reservas no disponibles</p>
          <p className="rv-success-text">
            Las reservas online no están disponibles ahora mismo. Vuelve a intentarlo en unos minutos.
          </p>
        </section>
      </main>
    );
  }

  return <BookingExperience restaurant={result.restaurant} nowISO={new Date().toISOString()} />;
}
