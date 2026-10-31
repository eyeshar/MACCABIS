// Disponibilidad por defecto (D146): funciones PURAS, una sola definicion para el Panel, Eventos, las respuestas del
// evento, la convocatoria y los recordatorios (`node` carga este fichero tal cual en las pruebas).
//
// Dos marcas privadas por jugador (jugadores_privado, solo gestores; D39). Nunca llegan a una pantalla de jugador: alli
// todo sigue igual (quien no ha respondido sale como «sin responder»).
//   - «No suele entrenar»: en un ENTRENO, si no ha respondido cuenta como «no va (por defecto)». Si responde, manda su
//     respuesta. Un gestor puede quitarlo para un entreno concreto (vuelve a «sin responder»). Nunca cuenta en partidos.
//   - «Solo entreno: nunca a partidos»: en un PARTIDO, si no ha respondido no cuenta como pendiente ni recibe
//     recordatorios. El motor no lo propone nunca (regla 1.7 de REGLAS_CONVOCATORIA.md). En entrenos, como cualquiera.
// Y la ausencia por periodo (D150): sin respuesta y con una ausencia que cubre el dia, cuenta como «no va» en cualquier
// evento (el motivo, solo para gestores) y no recibe recordatorios. Si responde, manda su respuesta.
// `respuestaEfectiva` junta las tres: la usan el Panel, Eventos, el tablero, los grupos, la convocatoria y los avisos.

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

/** Una ausencia por periodo (ausencias_periodo). `motivo` solo lo leen las pantallas de gestion. */
export type AusenciaDisp = { person_id: string; desde: string; hasta: string | null; motivo?: string | null; borrada_en?: string | null };
export const cubreElDia = (a: Pick<AusenciaDisp, "desde" | "hasta" | "borrada_en">, fecha: string) => !a.borrada_en && a.desde <= fecha && (a.hasta == null || a.hasta >= fecha);
/** La ausencia de esta persona que cubre el dia (la mas reciente si hay varias), o null. */
export function ausenciaQueCubre<A extends AusenciaDisp>(personId: string, fecha: string, ausencias: A[]): A | null {
  return ausencias.filter((a) => a.person_id === personId && cubreElDia(a, fecha)).sort((a, b) => (a.desde < b.desde ? 1 : -1))[0] ?? null;
}

/** La regla unica (D146 + D150) de lo que cuenta en un evento para quien tiene esta respuesta:
 *  1. Si respondio (va, duda o no), su respuesta.
 *  2. Si no, en un partido y «nunca a partidos»: fuera (ni invitado ni pendiente).
 *  3. Si no, con una ausencia que cubre el dia: «no» (`por: "ausencia"`).
 *  4. Si no, en un entreno y «no suele entrenar» (sin quitar para ese entreno): «no» (`por: "defecto"`).
 *  5. Si no, «sin responder». */
export type Efectiva = { respuesta: Resp; fuera: boolean; por: "ausencia" | "defecto" | null; ausencia: AusenciaDisp | null };
export function respuestaEfectiva(e: EventoTipo, m: Partial<MarcasDisponibilidad> | null | undefined, respuesta: Resp, o: { quitado?: boolean; ausencia?: AusenciaDisp | null } = {}): Efectiva {
  if (respuesta !== "sin_responder") return { respuesta, fuera: false, por: null, ausencia: null };
  if (fueraDelPartido(e, m, respuesta)) return { respuesta, fuera: true, por: null, ausencia: null };
  if (o.ausencia) return { respuesta: "no", fuera: false, por: "ausencia", ausencia: o.ausencia };
  if (noVaPorDefecto(e, m, respuesta, !!o.quitado)) return { respuesta: "no", fuera: false, por: "defecto", ausencia: null };
  return { respuesta, fuera: false, por: null, ausencia: null };
}

/** ¿Está pendiente de responder (cuenta en «sin responder» y recibe recordatorios)? */
export function pendiente(e: EventoTipo, m: Partial<MarcasDisponibilidad> | null | undefined, respuesta: Resp, quitado = false, ausencia: AusenciaDisp | null = null) {
  const r = respuestaEfectiva(e, m, respuesta, { quitado, ausencia });
  return !r.fuera && r.respuesta === "sin_responder";
}

export const TEXTO_POR_DEFECTO = "No va (por defecto)";
export const NOTA_POR_DEFECTO = "Por defecto: no suele entrenar";

/** Lo que leen las pantallas de gestion: las marcas por persona, a quien se le quito el defecto en cada entreno
 *  (`claveQuitado(evento, persona)`) y las ausencias por periodo vigentes (D150). */
export type Defecto = { marcas: Map<string, MarcasDisponibilidad>; quitados: Set<string>; ausencias: AusenciaDisp[] };
export const claveQuitado = (eventoId: string, personId: string) => `${eventoId}|${personId}`;
export const SIN_DEFECTO: Defecto = { marcas: new Map(), quitados: new Set(), ausencias: [] };

/** `respuestaEfectiva` con lo que lee una pantalla de gestion (`Defecto`) para un evento con id y fecha. */
export function efectivaEn(e: EventoTipo & { id?: string; fecha: string }, personId: string, respuesta: Resp, d: Defecto | null | undefined): Efectiva {
  return respuestaEfectiva(e, d?.marcas.get(personId), respuesta, {
    quitado: !!e.id && !!d?.quitados.has(claveQuitado(e.id, personId)),
    ausencia: d ? ausenciaQueCubre(personId, e.fecha, d.ausencias) : null,
  });
}

/** Filas de la base -> Defecto. */
export function defectoDe(marcas: ({ person_id: string } & Partial<MarcasDisponibilidad>)[], quitados: { evento_id: string; person_id: string }[], ausencias: AusenciaDisp[] = []): Defecto {
  return {
    ausencias: ausencias.filter((a) => !a.borrada_en),
    marcas: new Map(marcas.filter((m) => m.no_suele_entrenar || m.nunca_partidos).map((m) => [m.person_id, { no_suele_entrenar: !!m.no_suele_entrenar, nunca_partidos: !!m.nunca_partidos }])),
    quitados: new Set(quitados.map((q) => claveQuitado(q.evento_id, q.person_id))),
  };
}

/** Zona del jugador (D151): lo SUYO, de `mi_disponibilidad_defecto()` (su marca y los entrenos en que se le quito). */
export type MiDefecto = { no_suele_entrenar: boolean; quitados: string[] };
/** ¿Le sale a el mismo este entreno como «No vas (puesto por defecto)»? `respuestaEfectiva` con sus datos: solo
 *  `por: "defecto"` (si respondio o tiene una ausencia que cubre el dia, no). */
export function porDefectoMio(e: EventoTipo & { id: string; fecha: string }, respuesta: Resp, mio: MiDefecto | null | undefined, ausencias: Pick<AusenciaDisp, "desde" | "hasta" | "borrada_en">[]) {
  if (!mio?.no_suele_entrenar) return false;
  return respuestaEfectiva(e, { no_suele_entrenar: true, nunca_partidos: false }, respuesta, {
    quitado: mio.quitados.includes(e.id),
    ausencia: ausenciaQueCubre("yo", e.fecha, ausencias.map((a) => ({ ...a, person_id: "yo" }))),
  }).por === "defecto";
}
export const TEXTO_POR_DEFECTO_JUGADOR = "No vas (puesto por defecto)";
