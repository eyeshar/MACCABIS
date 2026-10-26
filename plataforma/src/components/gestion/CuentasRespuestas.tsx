import Link from "next/link";

/** «N van · N ? · N no» con su barra, como ENLACE a las respuestas del evento (/gestion/eventos/<id>/respuestas).
 *  La celda que lo contiene lleva `ev-celda-resp`: el enlace cubre toda la celda (zona tactil entera en el movil). */
export default function CuentasRespuestas({ id, va, duda, no, nombre, barra = true }: { id: string; va: number; duda: number; no: number; nombre: string; barra?: boolean }) {
  return (
    <Link href={`/gestion/eventos/${id}/respuestas`} className="ev-resp-enlace" aria-label={`Respuestas de ${nombre}: ${va} van, ${duda} sin confirmar, ${no} no van`} data-testid="enlace-respuestas">
      <div className="ev-cuentas"><span className="ev-ok">{va} van</span><span className="ev-duda">{duda} ?</span><span className="ev-no">{no} no</span></div>
      {barra && (
        <div className="ev-barra" aria-hidden="true">
          <i style={{ flex: `${va} 1 0`, background: "var(--c-verde)" }} /><i style={{ flex: `${duda} 1 0`, background: "var(--c-amarillo)" }} /><i style={{ flex: `${no} 1 0`, background: "var(--error)" }} />
        </div>
      )}
    </Link>
  );
}
