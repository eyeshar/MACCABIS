// Cálculo de «Asistencia y motivos» rediseñada (D170). Funciones PURAS: sin base de datos.
// Cómo se cuenta (decisión de Iván): un evento cuenta si el jugador estaba invitado/convocado; «no convocado» y «lesión»
// se excluyen. Faltas = con excusa + sin excusa. Asistencia = fue / (fue + faltas). TOTAL = entrenos + partidos SUMANDO fue
// y faltas (no la media de los porcentajes). Mínimo de 5 eventos contables para el ranking.
// Fuentes: asistencia_eventos (SportEasy hasta el 23/10/2026) + la plataforma en vivo desde el 24/10 (D161); y, solo para
// 2025/26, los totales corregidos a mano de asistencia_motivos (D72), que mandan sobre el detalle de SportEasy.
import { sumarDias } from "../dias.ts";

export type Estado = "fue" | "con_excusa" | "sin_excusa" | "no_convocado" | "lesion";
export type Ambito = "entrenos" | "partidos";
export type FilaEvento = {
  person_id: string; nombre: string; temporada: string; evento_ref: string; fecha: string; ambito: Ambito;
  equipo: "MdA" | "MdL" | null; titulo: string | null; estado: Estado; motivo: string | null; origen: "sporteasy" | "plataforma";
};
/** Fila de asistencia_motivos (totales por temporada, persona y ámbito). */
export type TotalTemporada = {
  temporada: string; person_id: string; nombre: string; ambito: Ambito;
  fueron: number; con_excusa: number; sin_excusa: number; no_convocado: number; lesion: number; total: number;
};
export type Filtros = { temporadas: string[]; ver: "actual" | "todos"; equipo: "todos" | "MdA" | "MdL"; periodo: "temporada" | "4s" };
export type Cuenta = { fue: number; faltas: number; sin: number };
export type Tendencia = { dir: "sube" | "baja" | "igual" | null; pct4: number | null; dif: number | null };
export type FilaJugador = {
  person_id: string; nombre: string; entrenos: Cuenta; partidos: Cuenta; total: Cuenta;
  pctEntrenos: number | null; pctPartidos: number | null; pctTotal: number | null; sin: number;
  aprox: boolean; segunSportEasy: boolean; tendencia: Tendencia;
};
export type Columna = "jugador" | "total" | "entrenos" | "partidos" | "sin" | "tendencia";
export const COLUMNAS: Columna[] = ["jugador", "total", "entrenos", "partidos", "sin", "tendencia"];

/** Temporada cuyos totales manda asistencia_motivos (corregidos a mano, D72). */
export const TEMPORADA_CORREGIDA = "2025-26";
/** Desde esta temporada el detalle trae lesiones; antes, los porcentajes son aproximados. */
export const PRIMERA_PRECISA = "2025-26";
/** Primera temporada con detalle por evento (asistencia_eventos, D170). */
export const PRIMERA_GUARDADA = "2018-19";
/** «2018-19» … «2026-27»: todas las temporadas entre dos. */
export function temporadasDesde(primera: string, ultima: string): string[] {
  const out: string[] = [];
  for (let a = Number(primera.slice(0, 4)); a <= Number(ultima.slice(0, 4)); a++) out.push(`${a}-${String(a + 1).slice(2)}`);
  return out;
}
export const MINIMO_EVENTOS = 5;
export const UMBRAL_TENDENCIA = 0.1;
export const SEMANAS_RECIENTE = 4;

export const cuentaVacia = (): Cuenta => ({ fue: 0, faltas: 0, sin: 0 });
export const eventosDe = (c: Cuenta) => c.fue + c.faltas;
export const pct = (c: Cuenta): number | null => (eventosDe(c) > 0 ? c.fue / eventosDe(c) : null);
const sumaC = (a: Cuenta, b: Cuenta): Cuenta => ({ fue: a.fue + b.fue, faltas: a.faltas + b.faltas, sin: a.sin + b.sin });
export const contable = (e: Estado) => e === "fue" || e === "con_excusa" || e === "sin_excusa";
const sumarFila = (c: Cuenta, e: Estado) => { if (e === "fue") c.fue++; else if (e === "con_excusa") c.faltas++; else if (e === "sin_excusa") { c.faltas++; c.sin++; } };

/** Color de la barrita: verde ≥ 75, ámbar 50–74, rojo < 50 (sobre el número que se ve, redondeado). */
export function colorPct(p: number | null): "verde" | "ambar" | "rojo" | null {
  if (p == null) return null;
  const n = Math.round(p * 100);
  return n >= 75 ? "verde" : n >= 50 ? "ambar" : "rojo";
}
export const textoPct = (p: number | null) => (p == null ? "—" : `${Math.round(p * 100)} %`);

/** Filas de la plataforma (`asistenciaPlataforma`) con la forma de la tabla. */
export function filasDePlataforma(
  a: { person_id: string; ambito: Ambito; evento_id: string; fecha: string; equipo: "MdA" | "MdL" | null; titulo: string | null; motivo: string | null; estado: "fue" | "con_excusa" | "sin_excusa" | "lesion" }[],
  nombres: Record<string, string>,
): FilaEvento[] {
  return a.map((x) => ({
    person_id: x.person_id, nombre: nombres[x.person_id] ?? x.person_id, temporada: "2026-27", evento_ref: x.evento_id, fecha: x.fecha, ambito: x.ambito,
    equipo: x.ambito === "partidos" ? x.equipo : null, titulo: x.titulo, estado: x.estado, motivo: x.motivo, origen: "plataforma" as const,
  }));
}

/** Las dos fuentes sin contar dos veces (D192): lo guardado en asistencia_eventos (SportEasy y, desde D192, el pase de
 *  lista: origen «plataforma», evento_ref = id del evento) y la plataforma en vivo (las respuestas de los eventos pasados,
 *  evento_ref = id del evento). Para una persona y un evento con pase de lista, manda el pase. */
export function unirAsistencia(guardadas: FilaEvento[], enVivo: FilaEvento[]): FilaEvento[] {
  const pase = new Set(guardadas.filter((f) => f.origen === "plataforma").map((f) => `${f.person_id}|${f.evento_ref}`));
  return [...guardadas, ...enVivo.filter((f) => !pase.has(`${f.person_id}|${f.evento_ref}`))];
}

type Ctx = { filas: FilaEvento[]; totales: TotalTemporada[]; hoy: string };
type Acum = { nombre: string; entrenos: Cuenta; partidos: Cuenta; aprox: boolean; segunSportEasy: boolean };

/** Suma, por persona, las filas que pasan los filtros (sin periodo) en el tramo [desde, hasta). Aplica los totales corregidos
 *  de 2025/26 solo cuando el tramo es toda la temporada (`usarCorregidos`). */
function acumular(c: Ctx, f: { temporadas: string[]; equipo: Filtros["equipo"] }, tramo: { desde: string | null; hasta: string | null }, usarCorregidos: boolean) {
  const por = new Map<string, Acum>();
  const get = (id: string, nombre: string) => {
    let a = por.get(id);
    if (!a) { a = { nombre, entrenos: cuentaVacia(), partidos: cuentaVacia(), aprox: false, segunSportEasy: false }; por.set(id, a); }
    return a;
  };
  const corregidos = new Map<string, TotalTemporada>();
  if (usarCorregidos && f.temporadas.includes(TEMPORADA_CORREGIDA)) for (const t of c.totales) if (t.temporada === TEMPORADA_CORREGIDA) corregidos.set(`${t.person_id}|${t.ambito}`, t);
  const conTotalesCorregidos = new Set([...corregidos.values()].map((t) => t.person_id));
  // Totales corregidos de 2025/26: entrenos siempre; partidos solo con «Todos» los equipos (no traen equipo).
  for (const t of corregidos.values()) {
    if (t.ambito === "partidos" && f.equipo !== "todos") continue;
    const a = get(t.person_id, t.nombre);
    const x = a[t.ambito];
    x.fue += t.fueron; x.faltas += t.con_excusa + t.sin_excusa; x.sin += t.sin_excusa;
  }
  for (const e of c.filas) {
    if (!f.temporadas.includes(e.temporada) || !contable(e.estado)) continue;
    if (tramo.desde && e.fecha < tramo.desde) continue;
    if (tramo.hasta && e.fecha >= tramo.hasta) continue;
    if (e.ambito === "partidos" && f.equipo !== "todos" && e.equipo !== f.equipo) continue;
    let segun = false;
    if (e.temporada === TEMPORADA_CORREGIDA && usarCorregidos) {
      // Mandan los totales corregidos. Quien no está en ellos no cuenta en 2025/26; los partidos por equipo no tienen
      // total corregido y salen del detalle de SportEasy (marcado).
      if (!conTotalesCorregidos.has(e.person_id) || e.ambito === "entrenos" || f.equipo === "todos") continue;
      segun = true;
    }
    const a = get(e.person_id, e.nombre);
    sumarFila(a[e.ambito], e.estado);
    if (e.temporada < PRIMERA_PRECISA) a.aprox = true;
    if (segun) { a.segunSportEasy = true; a.aprox = true; }
  }
  return por;
}

const tendenciaDe = (pct4: number | null, base: number | null): Tendencia => {
  if (pct4 == null || base == null) return { dir: null, pct4, dif: null };
  const dif = pct4 - base;
  return { dir: dif >= UMBRAL_TENDENCIA - 1e-9 ? "sube" : dif <= -UMBRAL_TENDENCIA + 1e-9 ? "baja" : "igual", pct4, dif };
};

/** Todas las personas de la tabla con sus cuentas, sin ordenar ni separar. `actuales`: plantilla actual (null = todos). */
export function calcularJugadores(c: Ctx, f: Filtros, actuales: Set<string> | null): FilaJugador[] {
  const desde4 = sumarDias(c.hoy, -SEMANAS_RECIENTE * 7);
  const base = { temporadas: f.temporadas, equipo: f.equipo };
  const periodo = f.periodo === "4s"
    ? acumular(c, base, { desde: desde4, hasta: c.hoy }, false)
    : acumular(c, base, { desde: null, hasta: null }, true);
  const temporada = f.periodo === "4s" ? acumular(c, base, { desde: null, hasta: null }, true) : periodo;
  const reciente = f.periodo === "4s" ? periodo : acumular(c, base, { desde: desde4, hasta: c.hoy }, false);
  const out: FilaJugador[] = [];
  for (const [id, a] of periodo) {
    if (f.ver === "actual" && actuales && !actuales.has(id)) continue;
    const total = sumaC(a.entrenos, a.partidos);
    const r = reciente.get(id);
    const t = temporada.get(id);
    const pct4 = r ? pct(sumaC(r.entrenos, r.partidos)) : null;
    const baseT = t ? pct(sumaC(t.entrenos, t.partidos)) : null;
    out.push({
      person_id: id, nombre: a.nombre, entrenos: a.entrenos, partidos: a.partidos, total,
      pctEntrenos: pct(a.entrenos), pctPartidos: pct(a.partidos), pctTotal: pct(total), sin: total.sin,
      aprox: a.aprox, segunSportEasy: a.segunSportEasy, tendencia: tendenciaDe(pct4, baseT),
    });
  }
  return out;
}

const valor = (j: FilaJugador, col: Exclude<Columna, "jugador">): number | null =>
  col === "total" ? j.pctTotal : col === "entrenos" ? j.pctEntrenos : col === "partidos" ? j.pctPartidos : col === "sin" ? j.sin : j.tendencia.dif;

/** Ordena por una columna. Los vacíos (—) van siempre al final; a igualdad, por nombre. */
export function ordenar(js: FilaJugador[], col: Columna, dir: "asc" | "desc"): FilaJugador[] {
  const s = dir === "asc" ? 1 : -1;
  const porNombre = (a: FilaJugador, b: FilaJugador) => a.nombre.localeCompare(b.nombre, "es");
  return [...js].sort((a, b) => {
    if (col === "jugador") return s * porNombre(a, b);
    const x = valor(a, col), y = valor(b, col);
    if (x == null && y == null) return porNombre(a, b);
    if (x == null) return 1;
    if (y == null) return -1;
    return x === y ? porNombre(a, b) : s * (x - y);
  });
}

/** Ranking (≥ 5 eventos contables) y, debajo, «Menos de 5 eventos». */
export function separar(js: FilaJugador[]): { ranking: FilaJugador[]; pocos: FilaJugador[] } {
  return { ranking: js.filter((j) => eventosDe(j.total) >= MINIMO_EVENTOS), pocos: js.filter((j) => eventosDe(j.total) < MINIMO_EVENTOS) };
}

export const DIR_DEFECTO: Record<Columna, "asc" | "desc"> = { jugador: "asc", total: "desc", entrenos: "desc", partidos: "desc", sin: "desc", tendencia: "desc" };

// ---------------------------------------------------------------- ficha del jugador
export type TemporadaFicha = { temporada: string; entrenos: Cuenta; partidos: Cuenta; total: Cuenta; aprox: boolean; corregida: boolean };
export type Ficha = {
  person_id: string; nombre: string; temporadas: TemporadaFicha[]; motivos: { texto: string; veces: number }[];
  ultimos: (FilaEvento & { segunSportEasy: boolean })[];
};
const ETIQUETA_ESTADO: Record<Exclude<Estado, "fue">, string> = { con_excusa: "con excusa", sin_excusa: "sin excusa", no_convocado: "no convocado", lesion: "lesión" };
export const textoEstado = (e: Estado) => (e === "fue" ? "fue" : ETIQUETA_ESTADO[e]);

/** Ficha de una persona: % por temporada, motivos más frecuentes y sus últimos 10 eventos (con todos los estados). */
export function fichaJugador(c: { filas: FilaEvento[]; totales: TotalTemporada[]; hoy: string }, personId: string, { maxMotivos = 6, ultimos = 10 } = {}): Ficha | null {
  const suyas = c.filas.filter((e) => e.person_id === personId && e.fecha < c.hoy);
  const totales = c.totales.filter((t) => t.person_id === personId);
  if (!suyas.length && !totales.length) return null;
  const nombre = suyas[0]?.nombre ?? totales[0].nombre;
  const por = new Map<string, TemporadaFicha>();
  const get = (t: string) => {
    let x = por.get(t);
    if (!x) { x = { temporada: t, entrenos: cuentaVacia(), partidos: cuentaVacia(), total: cuentaVacia(), aprox: t < PRIMERA_PRECISA, corregida: t === TEMPORADA_CORREGIDA }; por.set(t, x); }
    return x;
  };
  for (const e of suyas) {
    if (e.temporada === TEMPORADA_CORREGIDA && totales.some((t) => t.temporada === TEMPORADA_CORREGIDA)) continue; // mandan los totales corregidos
    if (contable(e.estado)) sumarFila(get(e.temporada)[e.ambito], e.estado);
  }
  for (const t of totales) {
    if (t.temporada !== TEMPORADA_CORREGIDA) continue;
    const x = get(t.temporada)[t.ambito];
    x.fue += t.fueron; x.faltas += t.con_excusa + t.sin_excusa; x.sin += t.sin_excusa;
  }
  const temporadas = [...por.values()].map((x) => ({ ...x, total: sumaC(x.entrenos, x.partidos) })).sort((a, b) => b.temporada.localeCompare(a.temporada));
  const m = new Map<string, number>();
  const suma = (k: string, v = 1) => { if (v > 0) m.set(k, (m.get(k) ?? 0) + v); };
  for (const e of suyas) {
    if (e.estado === "fue" || (e.temporada === TEMPORADA_CORREGIDA && totales.some((t) => t.temporada === TEMPORADA_CORREGIDA))) continue;
    suma(e.motivo ?? textoEstado(e.estado));
  }
  for (const t of totales) {
    if (t.temporada !== TEMPORADA_CORREGIDA) continue;
    suma("con excusa", t.con_excusa); suma("sin excusa", t.sin_excusa); suma("no convocado", t.no_convocado); suma("lesión", t.lesion);
  }
  const motivos = [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es")).slice(0, maxMotivos).map(([texto, veces]) => ({ texto, veces }));
  const recientes = [...suyas].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.evento_ref.localeCompare(a.evento_ref)).slice(0, ultimos)
    .map((e) => ({ ...e, segunSportEasy: e.origen === "sporteasy" && e.temporada === TEMPORADA_CORREGIDA }));
  return { person_id: personId, nombre, temporadas, motivos, ultimos: recientes };
}
