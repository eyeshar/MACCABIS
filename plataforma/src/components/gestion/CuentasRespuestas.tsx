import Link from "next/link";
import Numeros, { type GrupoNum } from "@/components/numeros/Numeros";

/** Celda «Respuestas» de un evento (Eventos y Panel): los cuatro contadores desplegables EN LA FILA (D139: van, dudan, sin
 *  responder y no van, con sus nombres y motivos) y, debajo, el enlace a las respuestas del evento (/gestion/eventos/<id>/respuestas).
 *  La celda que lo contiene lleva `ev-celda-resp`: el enlace cubre el resto de la celda y los botones quedan por encima. */
export default function CuentasRespuestas({ id, grupos, nombre, barra = true, dudas }: { id: string; grupos: GrupoNum[]; nombre: string; barra?: boolean; dudas?: string | null }) {
  const n = (k: string) => grupos.find((g) => g.k === k)?.n ?? 0;
  const va = n("va"), duda = n("duda"), sin = n("sin"), no = n("no");
  return (
    <>
      <Numeros variante="linea" prueba={`respuestas-${id}`} etiqueta={`Respuestas de ${nombre}`} grupos={grupos} />
      {dudas && <span className="pequeno suave" data-testid="linea-dudas" style={{ display: "block" }}>{dudas}</span>}
      <Link href={`/gestion/eventos/${id}/respuestas`} className="ev-resp-enlace ev-resp-ver" aria-label={`Respuestas de ${nombre}: ${va} van, ${duda} dudan, ${sin} sin responder, ${no} no van`} data-testid="enlace-respuestas">
        {barra && (
          <div className="ev-barra" aria-hidden="true">
            <i style={{ flex: `${va} 1 0`, background: "var(--c-verde)" }} /><i style={{ flex: `${duda + sin} 1 0`, background: "var(--c-amarillo)" }} /><i style={{ flex: `${no} 1 0`, background: "var(--error)" }} />
          </div>
        )}
        <span className="pequeno">Ver respuestas y motivos →</span>
      </Link>
    </>
  );
}
