/** Logo como en la web del restaurante + fileteado + "Reserva tu mesa". */
export function PublicHeader({ name }: { name: string }) {
  // "El Bodegón Argentino" → "El Bodegón" en mayúsculas + "Argentino" en script.
  const words = name.trim().split(/\s+/);
  const script = words.length > 1 ? words[words.length - 1] : null;
  const main = script ? words.slice(0, -1).join(" ") : name;

  return (
    <header className="rv-brand">
      <h1 id="rv-title" className="rv-logo">
        <span className="rv-logo-main">{main}</span>
        {script && <span className="rv-logo-script">{script}</span>}
      </h1>
      <svg className="rv-filete" viewBox="0 -8 440 70" aria-hidden="true" focusable="false">
        <path
          className="rv-fp rv-fp-gold"
          pathLength={1}
          d="M 32 33 C 60 18 98 18 126 33 C 154 48 192 48 220 33 C 248 18 286 18 314 33 C 342 48 380 48 408 33"
        />
        <path
          className="rv-fp rv-fp-sky"
          pathLength={1}
          d="M 32 39 C 60 24 98 24 126 39 C 154 54 192 54 220 39 C 248 24 286 24 314 39 C 342 54 380 54 408 39"
        />
        <path className="rv-fp rv-fp-gold" pathLength={1} d="M 32 33 C 10 31 0 16 8 6 C 16 -3 30 -2 34 9 C 38 19 36 31 32 33" />
        <path
          className="rv-fp rv-fp-gold"
          pathLength={1}
          d="M 408 33 C 430 31 440 16 432 6 C 424 -3 410 -2 406 9 C 402 19 404 31 408 33"
        />
      </svg>
      <p className="rv-eyebrow">Reserva tu mesa</p>
    </header>
  );
}
