import type { GrupoNum, PersonaNum } from "@/components/numeros/Numeros";
import { convocadosDe, TEXTO_MOTIVO, type EventoFila, type JugadorBasico, type Motivo, type Respuesta } from "@/lib/eventos/dominio";
import { hrefJugador } from "./enlaces";

// Los cuatro contadores de un evento (van / dudan / sin responder / no van) con sus nombres (D139). Lo usan el Panel, Eventos y
// las Respuestas del evento. `conMotivos` solo lo pasan las pantallas de gestion: el motivo y el detalle del «no» no salen nunca
// de aqui hacia una pantalla de jugador (D46, D82).
export type RespuestaPersona = { person_id: string; respuesta: Respuesta; motivo?: Motivo | "horario" | null; detalle?: string | null };

export function notaMotivo(motivo: Motivo | "horario" | null | undefined, detalle?: string | null) {
  if (!motivo) return detalle ?? null;
  return `${motivo === "horario" ? "Horario" : TEXTO_MOTIVO[motivo]}${detalle ? ` · ${detalle}` : ""}`;
}

export function gruposEvento(
  e: Pick<EventoFila, "tipo" | "equipo" | "oficial">, jugadores: JugadorBasico[], filas: RespuestaPersona[], conMotivos = true,
): GrupoNum[] {
  const porPersona = new Map(filas.map((r) => [r.person_id, r]));
  const g: Record<Respuesta, PersonaNum[]> = { va: [], duda: [], no: [], sin_responder: [] };
  for (const j of convocadosDe(e, jugadores)) {
    const r = porPersona.get(j.person_id);
    const respuesta = r?.respuesta ?? "sin_responder";
    g[respuesta].push({ nombre: j.nombre_visible, href: hrefJugador(j.person_id), nota: conMotivos && respuesta === "no" ? notaMotivo(r?.motivo, r?.detalle) : null });
  }
  for (const l of Object.values(g)) l.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return [
    { k: "va", etiqueta: "van", n: g.va.length, tono: "ok", personas: g.va },
    { k: "duda", etiqueta: "dudan", n: g.duda.length, tono: "duda", personas: g.duda },
    { k: "sin", etiqueta: "sin responder", n: g.sin_responder.length, tono: "sin", personas: g.sin_responder },
    { k: "no", etiqueta: "no van", n: g.no.length, tono: "no", personas: g.no },
  ];
}
