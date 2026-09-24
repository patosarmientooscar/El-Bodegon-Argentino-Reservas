/** Aviso "¿Sois más de 4? Llámanos" (cristal esmerilado, se despliega con altura animada). */
export function GroupNotice({
  open,
  max,
  telHref,
  whatsappHref,
}: {
  open: boolean;
  max: number;
  telHref: string | null;
  whatsappHref: string | null;
}) {
  return (
    <div className="rv-collapse" data-open={open ? "true" : "false"} inert={!open}>
      <div className="rv-collapse-inner">
        <div className="rv-glass rv-group" role="status">
          <p className="rv-group-title">
            ¿Sois más de {max}? <span className="rv-script">Llámanos</span>
          </p>
          <p className="rv-group-text">Para grupos preparamos la mesa contigo, por teléfono o WhatsApp.</p>
          <div className="rv-group-actions">
            {telHref && (
              <a className="rv-btn rv-btn-gold" href={telHref}>
                Llamar
              </a>
            )}
            {whatsappHref && (
              <a
                className="rv-btn rv-btn-line"
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                style={telHref ? undefined : { gridColumn: "1 / -1" }}
              >
                WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
