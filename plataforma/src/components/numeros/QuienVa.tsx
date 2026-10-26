import Numeros, { type GrupoNum } from "./Numeros";
import type { QuienVa } from "@/lib/respuestas/jugador";

/** «Quién va» del jugador (D139, D46): van / dudan / no van desplegables con SOLO el nombre; «sin responder» es una cifra sin
 *  nombres. Nunca motivos ni detalles: esta pieza ni siquiera los recibe. */
export default function QuienVaJugador({ quien, plazas }: { quien: QuienVa; plazas?: number | null }) {
  const lista = (nombres: string[]) => nombres.map((nombre) => ({ nombre }));
  const grupos: GrupoNum[] = [
    { k: "va", etiqueta: plazas ? `van de ${plazas}` : "van", n: quien.va.length, tono: "ok", personas: lista(quien.va) },
    { k: "duda", etiqueta: "dudan", n: quien.duda.length, tono: "duda", personas: lista(quien.duda) },
    { k: "no", etiqueta: "no van", n: quien.no.length, tono: "no", personas: lista(quien.no) },
    { k: "sin", etiqueta: "sin responder", n: quien.sin_responder, tono: "sin", personas: [], soloNumero: true },
  ];
  return <Numeros prueba="quien-va-numeros" etiqueta="Quién va" grupos={grupos} />;
}
