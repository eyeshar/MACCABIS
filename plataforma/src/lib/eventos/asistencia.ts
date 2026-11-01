// Resumen de asistencia de la temporada por jugador (paso 2, pista E, D94): entrenos y partidos asistidos / total / % y
// motivos mas frecuentes. Solo para gestores (D46, D82). Funciones PURAS.
// Dos fuentes que no se pisan (D161): hasta el 23/10/2026, el export de SportEasy (asistencia_motivos); desde el
// 24/10/2026, la plataforma (respuestas de los eventos ya pasados, con la regla unica de disponibilidad, D146/D150).
import type { Motivo } from "./dominio";
import { efectivaEn, esEntreno, type Defecto } from "../disponibilidad/porDefecto.ts";

export type FilaResumen = {
  temporada: string; person_id: string; nombre: string; ambito: "partidos" | "entrenos";
  fueron: number; total: number; con_excusa: number; sin_excusa: number; no_convocado: number; lesion: number;
};
/** Lo que cuenta de un evento pasado de la plataforma para una persona: si fue y, si no, por que. */
export type AsistenciaEvento = { person_id: string; ambito: "partidos" | "entrenos"; fue: boolean; motivo: string | null };
export type EventoAsistencia = { id: string; fecha: string; tipo: string; oficial?: boolean };
export type RespuestaEvento = { evento_id: string; person_id: string; respuesta: "va" | "duda" | "no" | "sin_responder"; motivo: Motivo | null };

/** Primer dia que cuenta la plataforma; lo anterior sale del export de SportEasy (D161). */
export const DESDE_PLATAFORMA = "2026-10-24";

export type MotivoFrecuente = { texto: string; veces: number };
export type Ambito = { fueron: number; total: number; pct: number | null };
export type ResumenJugador = {
  person_id: string; nombre: string; entrenos: Ambito; partidos: Ambito; motivos: MotivoFrecuente[];
};

const pct = (f: number, t: number) => (t > 0 ? f / t : null);
const TEXTO_NUEVO: Record<Motivo, string> = { lesion: "lesión", trabajo: "trabajo", viaje: "viaje", familia: "familia", otro: "otro" };

/** Asistencia de la plataforma (D161): partidos de liga y entrenos YA PASADOS (fecha < hoy) desde DESDE_PLATAFORMA. Por
 *  cada respuesta, la efectiva (D146/D150): «va» = fue; «no» = no fue, con su motivo (el de la respuesta, el de la
 *  ausencia por periodo o «no suele entrenar»); «duda» o «sin responder» en un evento pasado = «sin responder». Quien
 *  queda fuera (solo entreno en un partido, sin responder) no cuenta. Amistosos y torneos no cuentan, como en SportEasy. */
export function asistenciaPlataforma(eventos: EventoAsistencia[], respuestas: RespuestaEvento[], defecto: Defecto | null, hoy: string): AsistenciaEvento[] {
  const ev = new Map(eventos.filter((e) => e.fecha >= DESDE_PLATAFORMA && e.fecha < hoy && (esEntreno(e) || (e.tipo === "liga" && e.oficial !== false))).map((e) => [e.id, e]));
  const res: AsistenciaEvento[] = [];
  for (const r of respuestas) {
    const e = ev.get(r.evento_id);
    if (!e) continue;
    const ef = efectivaEn(e, r.person_id, r.respuesta, defecto);
    if (ef.fuera) continue;
    const ambito = esEntreno(e) ? "entrenos" : "partidos";
    if (ef.respuesta === "va") { res.push({ person_id: r.person_id, ambito, fue: true, motivo: null }); continue; }
    const motivo = ef.respuesta !== "no" ? "sin responder"
      : r.motivo ? TEXTO_NUEVO[r.motivo]
      : ef.por === "ausencia" ? (TEXTO_NUEVO[ef.ausencia?.motivo as Motivo] ?? "ausencia")
      : ef.por === "defecto" ? "no suele entrenar" : "no va, sin motivo";
    res.push({ person_id: r.person_id, ambito, fue: false, motivo });
  }
  return res;
}

/** Una fila por persona: lo del export de SportEasy (asistidos/total y motivos con excusa, sin excusa, no convocado,
 *  lesión) más lo de la plataforma (`asistenciaPlataforma`: cada evento suma al total, a asistidos si fue y, si no, a
 *  su motivo: lesión, trabajo, viaje, familia, otro…). */
export function resumenTemporada(filas: FilaResumen[], plataforma: AsistenciaEvento[] = [], maxMotivos = 3, nombres: Record<string, string> = {}): ResumenJugador[] {
  const por = new Map<string, ResumenJugador & { _m: Map<string, number> }>();
  const get = (id: string, nombre: string) => {
    let r = por.get(id);
    if (!r) { r = { person_id: id, nombre, entrenos: { fueron: 0, total: 0, pct: null }, partidos: { fueron: 0, total: 0, pct: null }, motivos: [], _m: new Map() }; por.set(id, r); }
    return r;
  };
  const suma = (r: { _m: Map<string, number> }, k: string, v: number) => { if (v > 0) r._m.set(k, (r._m.get(k) ?? 0) + v); };
  for (const f of filas) {
    const r = get(f.person_id, f.nombre);
    r[f.ambito] = { fueron: f.fueron, total: f.total, pct: pct(f.fueron, f.total) };
    suma(r, "con excusa", f.con_excusa); suma(r, "sin excusa", f.sin_excusa); suma(r, "no convocado", f.no_convocado); suma(r, "lesión", f.lesion);
  }
  for (const x of plataforma) {
    const r = get(x.person_id, nombres[x.person_id] ?? x.person_id);
    const a = r[x.ambito];
    r[x.ambito] = { ...a, fueron: a.fueron + (x.fue ? 1 : 0), total: a.total + 1 };
    if (!x.fue && x.motivo) suma(r, x.motivo, 1);
  }
  return [...por.values()].map(({ _m, ...r }) => ({
    ...r,
    entrenos: { ...r.entrenos, pct: pct(r.entrenos.fueron, r.entrenos.total) },
    partidos: { ...r.partidos, pct: pct(r.partidos.fueron, r.partidos.total) },
    motivos: [..._m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es")).slice(0, maxMotivos).map(([texto, veces]) => ({ texto, veces })),
  })).sort((a, b) => (b.entrenos.fueron + b.partidos.fueron) - (a.entrenos.fueron + a.partidos.fueron) || a.nombre.localeCompare(b.nombre, "es"));
}

export const textoPct = (p: number | null) => (p == null ? "—" : `${Math.round(p * 100)} %`);
