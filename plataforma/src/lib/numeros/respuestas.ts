import type { GrupoNum, PersonaNum } from "@/components/numeros/Numeros";
import { convocadosDe, TEXTO_MOTIVO, type EventoFila, type JugadorBasico, type Motivo, type Respuesta } from "@/lib/eventos/dominio";
import { fueraPorFicha } from "@/lib/respuestas/dominio";
import { dudaAbierta, enMadrid, limiteDudas, madrid } from "@/lib/avisos/horario";
import { hrefJugador } from "./enlaces";
import { efectivaEn, NOTA_POR_DEFECTO, type AusenciaDisp, type Defecto } from "@/lib/disponibilidad/porDefecto";

// Los cuatro contadores de un evento (van / dudan / sin responder / no van) con sus nombres (D139). Lo usan el Panel, Eventos y
// las Respuestas del evento. `conMotivos` solo lo pasan las pantallas de gestion: el motivo y el detalle del «no» no salen nunca
// de aqui hacia una pantalla de jugador (D46, D82). `defecto` (D146, marcas privadas) solo lo pasan las pantallas de
// gestion: en un entreno, quien «no suele entrenar» y no ha respondido va a «no van» con la nota «Por defecto»; en un
// partido, quien es «nunca a partidos» y no ha respondido no cuenta; y quien no ha respondido y tiene una ausencia por
// periodo que cubre el dia va a «no van» con la ausencia como nota (D150). La regla es `respuestaEfectiva`.
export type RespuestaPersona = { person_id: string; respuesta: Respuesta; motivo?: Motivo | "horario" | "no_confirmo" | null; detalle?: string | null };

export function notaMotivo(motivo: Motivo | "horario" | "no_confirmo" | null | undefined, detalle?: string | null) {
  if (!motivo) return detalle ?? null;
  return `${motivo === "horario" ? "Horario" : motivo === "no_confirmo" ? "No confirmó" : TEXTO_MOTIVO[motivo]}${detalle ? ` · ${detalle}` : ""}`;
}

/** «Ausente del 02/11 al 09/11 (Viaje)»: la nota de una ausencia por periodo. Solo gestores. */
export function notaAusencia(a: Pick<AusenciaDisp, "desde" | "hasta" | "motivo"> | null | undefined) {
  if (!a) return null;
  const dm = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
  return `Ausente del ${dm(a.desde)}${a.hasta ? ` al ${dm(a.hasta)}` : ", sin fecha de vuelta"}${a.motivo ? ` (${TEXTO_MOTIVO[a.motivo as Motivo] ?? a.motivo})` : ""}`;
}

export function gruposEvento(
  e: Pick<EventoFila, "tipo" | "equipo" | "oficial" | "solo_con_ficha_en" | "fecha"> & { id?: string }, jugadores: JugadorBasico[], filas: RespuestaPersona[], conMotivos = true, defecto?: Defecto,
): GrupoNum[] {
  const porPersona = new Map(filas.map((r) => [r.person_id, r]));
  const g: Record<Respuesta, PersonaNum[]> = { va: [], duda: [], no: [], sin_responder: [] };
  for (const j of convocadosDe(e, jugadores)) {
    const r = porPersona.get(j.person_id);
    const respuesta = r?.respuesta ?? "sin_responder";
    const ef = efectivaEn(e, j.person_id, respuesta, defecto);
    if (ef.fuera) continue;
    if (ef.por) {
      g.no.push({ nombre: j.nombre_visible, href: hrefJugador(j.person_id), nota: !conMotivos ? null : ef.por === "defecto" ? NOTA_POR_DEFECTO : notaAusencia(ef.ausencia) });
      continue;
    }
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

/** D148, solo gestores: quien no está invitado a un entreno en una pista «solo con ficha» por no tener ficha y aun así
 *  dijo «voy»: va aparte, fuera de los cuatro contadores, con el aviso `avisoSinFicha`. */
export function sinFichaQueVan(e: Pick<EventoFila, "tipo" | "equipo" | "oficial" | "solo_con_ficha_en">, jugadores: JugadorBasico[], filas: Pick<RespuestaPersona, "person_id" | "respuesta">[]): PersonaNum[] {
  const van = new Set(filas.filter((r) => r.respuesta === "va").map((r) => r.person_id));
  return jugadores.filter((j) => van.has(j.person_id) && fueraPorFicha(e, j))
    .map((j) => ({ nombre: j.nombre_visible, href: hrefJugador(j.person_id), nota: null }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/** D141, solo gestores: «Dudas: N · límite martes 27/10 20:00» y, pasado el límite, «M pasaron a "no va" por no confirmar». */
export function lineaDudas(e: Pick<EventoFila, "tipo" | "fecha" | "inicio" | "oficial">, grupos: GrupoNum[], filas: RespuestaPersona[], ahora = new Date()) {
  // Un evento que ya empezó no tiene límite que enseñar.
  if (madrid(e.fecha, e.inicio ? String(e.inicio).slice(0, 5) : "00:00").getTime() <= ahora.getTime()) return null;
  const dudas = grupos.find((g) => g.k === "duda")?.n ?? 0;
  const pasaron = filas.filter((r) => r.respuesta === "no" && r.motivo === "no_confirmo").length;
  const abierta = dudaAbierta(e, ahora);
  if (!dudas && !pasaron && !abierta) return null;
  const l = enMadrid(limiteDudas(e));
  const dia = new Date(`${l.fecha}T12:00:00Z`).toLocaleDateString("es-ES", { timeZone: "UTC", weekday: "long" });
  return `Dudas: ${dudas} · límite ${dia} ${l.fecha.slice(8)}/${l.fecha.slice(5, 7)} ${l.hora}${!abierta ? ` · ${pasaron} ${pasaron === 1 ? "pasó" : "pasaron"} a «no va» por no confirmar` : ""}`;
}
