/** Aviso "¿Sois más de 4? Llámanos" (cristal esmerilado, se despliega con altura animada). */
export function GroupNotice({
  open,
  max,
  telHref,
}: {
  open: boolean;
  max: number;
  telHref: string | null;
}) {
  return (
    <div className="rv-collapse" data-open={open ? "true" : "false"} inert={!open}>
      <div className="rv-collapse-inner">
        <div className="rv-glass rv-group" role="status">
          <p className="rv-group-title">
            ¿Sois más de {max}? <span className="rv-script">Llámanos</span>
          </p>
          <p className="rv-group-text">Para grupos preparamos la mesa contigo, por teléfono al +34 618 02 55 80.</p>
          <div className="rv-group-actions">
            {telHref && (
              <a className="rv-btn rv-btn-gold" href={telHref}>
                Llamar
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
