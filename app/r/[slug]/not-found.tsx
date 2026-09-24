import { PublicHeader } from "@/components/public-booking/public-header";

export default function PublicBookingNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-10">
      <PublicHeader name="Reservas" />
      <p className="mt-10 text-center text-base text-[#f3ead8]/75">
        No encontramos este restaurante. Revisa el enlace que te han pasado.
      </p>
    </main>
  );
}
