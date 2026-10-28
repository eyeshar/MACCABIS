import Numeros, { type GrupoNum } from "./Numeros";
import type { QuienVa } from "@/lib/respuestas/jugador";

/** «Quién va» del jugador (D139, D141): van / dudan / no van / sin responder, desplegables con SOLO el nombre (D141 cambia
 *  D46 y D82: tambien se ve quien no ha contestado). Nunca motivos ni detalles: esta pieza ni siquiera los recibe. */
export default function QuienVaJugador({ quien, plazas, prueba = "quien-va-numeros" }: { quien: QuienVa; plazas?: number | null; prueba?: string }) {
  const lista = (nombres: string[]) => nombres.map((nombre) => ({ nombre }));
  const grupos: GrupoNum[] = [
    { k: "va", etiqueta: plazas ? `van de ${plazas}` : "van", n: quien.va.length, tono: "ok", personas: lista(quien.va) },
    { k: "duda", etiqueta: "dudan", n: quien.duda.length, tono: "duda", personas: lista(quien.duda) },
    { k: "no", etiqueta: "no van", n: quien.no.length, tono: "no", personas: lista(quien.no) },
    { k: "sin", etiqueta: "sin responder", n: quien.sin_responder.length, tono: "sin", personas: lista(quien.sin_responder) },
  ];
  return <Numeros prueba={prueba} etiqueta="Quién va" grupos={grupos} />;
}
