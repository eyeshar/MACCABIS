// Disponibilidad por defecto (D146): funciones PURAS, una sola definicion para el Panel, Eventos, las respuestas del
// evento, la convocatoria y los recordatorios (`node` carga este fichero tal cual en las pruebas).
//
// Dos marcas privadas por jugador (jugadores_privado, solo gestores; D39). Nunca llegan a una pantalla de jugador: alli
// todo sigue igual (quien no ha respondido sale como «sin responder»).
//   - «No suele entrenar»: en un ENTRENO, si no ha respondido cuenta como «no va (por defecto)». Si responde, manda su
//     respuesta. Un gestor puede quitarlo para un entreno concreto (vuelve a «sin responder»). Nunca cuenta en partidos.
//   - «Solo entreno: nunca a partidos»: en un PARTIDO, si no ha respondido no cuenta como pendiente ni recibe
//     recordatorios. El motor no lo propone nunca (regla 1.7 de REGLAS_CONVOCATORIA.md). En entrenos, como cualquiera.

export type MarcasDisponibilidad = { no_suele_entrenar: boolean; nunca_partidos: boolean };
type Resp = "va" | "duda" | "no" | "sin_responder";
type EventoTipo = { tipo: string; oficial?: boolean };

/** Partido = liga, amistoso o torneo («entre nosotros» y los planes no son partidos). */
export const esPartido = (e: EventoTipo) => e.oficial !== false && (e.tipo === "liga" || e.tipo === "amistoso" || e.tipo === "torneo");
export const esEntreno = (e: EventoTipo) => e.oficial !== false && e.tipo === "entreno";

/** ¿Cuenta como «no va (por defecto)» en este evento? Solo entrenos, solo sin respuesta y si no se quito para este entreno. */
export function noVaPorDefecto(e: EventoTipo, m: Partial<MarcasDisponibilidad> | null | undefined, respuesta: Resp, quitado = false) {
  return esEntreno(e) && !!m?.no_suele_entrenar && respuesta === "sin_responder" && !quitado;
}

/** ¿Queda fuera de este partido por «nunca a partidos»? Solo si no ha respondido: si respondio, se ve su respuesta. */
export function fueraDelPartido(e: EventoTipo, m: Partial<MarcasDisponibilidad> | null | undefined, respuesta: Resp) {
  return esPartido(e) && !!m?.nunca_partidos && respuesta === "sin_responder";
}

/** ¿Está pendiente de responder (cuenta en «sin responder» y recibe recordatorios)? */
export function pendiente(e: EventoTipo, m: Partial<MarcasDisponibilidad> | null | undefined, respuesta: Resp, quitado = false) {
  return respuesta === "sin_responder" && !noVaPorDefecto(e, m, respuesta, quitado) && !fueraDelPartido(e, m, respuesta);
}

export const TEXTO_POR_DEFECTO = "No va (por defecto)";
export const NOTA_POR_DEFECTO = "Por defecto: no suele entrenar";

/** Lo que leen las pantallas de gestion: las marcas por persona y a quien se le quito el defecto en cada entreno
 *  (`claveQuitado(evento, persona)`). */
export type Defecto = { marcas: Map<string, MarcasDisponibilidad>; quitados: Set<string> };
export const claveQuitado = (eventoId: string, personId: string) => `${eventoId}|${personId}`;
export const SIN_DEFECTO: Defecto = { marcas: new Map(), quitados: new Set() };

/** Filas de la base -> Defecto. */
export function defectoDe(marcas: ({ person_id: string } & Partial<MarcasDisponibilidad>)[], quitados: { evento_id: string; person_id: string }[]): Defecto {
  return {
    marcas: new Map(marcas.filter((m) => m.no_suele_entrenar || m.nunca_partidos).map((m) => [m.person_id, { no_suele_entrenar: !!m.no_suele_entrenar, nunca_partidos: !!m.nunca_partidos }])),
    quitados: new Set(quitados.map((q) => claveQuitado(q.evento_id, q.person_id))),
  };
}
