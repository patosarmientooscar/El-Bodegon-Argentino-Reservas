export function PublicHeader({ name }: { name: string }) {
  return (
    <header className="text-center">
      <h1 className="font-[family-name:var(--font-playfair)] text-[1.75rem] leading-tight font-bold text-[#f3ead8]">
        {name}
      </h1>
      <p className="mt-2 flex items-center justify-center gap-3 text-[0.7rem] font-medium tracking-[0.32em] text-[#c8a24a] uppercase">
        <span aria-hidden="true" className="h-px w-8 bg-[#c8a24a]/50" />
        Reserva tu mesa
        <span aria-hidden="true" className="h-px w-8 bg-[#c8a24a]/50" />
      </p>
    </header>
  );
}
