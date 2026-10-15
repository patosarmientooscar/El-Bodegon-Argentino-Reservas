/* eslint-disable @next/next/no-img-element -- icono local de 192 px, no necesita next/image */

/**
 * Marco de las pantallas de acceso (login, recuperar y nueva contraseña):
 * la "B" dorada de la app instalada, el nombre y "Hecho por Evimes".
 * data-panel-theme activa los colores carbón + latón (globals.css).
 */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main
      data-panel-theme=""
      className="flex min-h-dvh flex-col items-center bg-background px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(3rem,env(safe-area-inset-top))] text-foreground"
    >
      <div className="flex w-full max-w-sm flex-1 flex-col justify-center gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src="/icons/icon-192.png" alt="" width={88} height={88} className="size-22 rounded-2xl shadow-lg" />
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">El Bodegón Argentino</p>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold">{title}</h1>
            <p className="text-base text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        {children}
      </div>
      <p className="mt-10 text-xs text-muted-foreground/70">Hecho por Evimes</p>
    </main>
  );
}
