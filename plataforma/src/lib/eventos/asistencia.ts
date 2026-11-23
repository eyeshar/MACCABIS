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
export type AsistenciaEvento = {
  person_id: string; ambito: "partidos" | "entrenos"; fue: boolean; motivo: string | null;
  /** Para la pantalla rediseñada (D170): el evento, su fecha, equipo y título, y el estado en los cinco de la tabla nueva. */
  evento_id: string; fecha: string; equipo: "MdA" | "MdL" | null; titulo: string | null;
  estado: "fue" | "con_excusa" | "sin_excusa" | "lesion" | "no_convocado";
  /** Partido de liga sin hoja de la FBM ni convocatoria aprobada: manda la respuesta, a falta de confirmar (D197). */
  provisional: boolean;
};
export type EventoAsistencia = { id: string; fecha: string; tipo: string; oficial?: boolean; equipo?: string | null; titulo?: string | null };
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

/** Quién estuvo en cada partido de liga (D72, D197), por «fecha|MdA»: quién sale en la hoja de la FBM (`hojas`: solo los
 *  partidos que ya tienen hoja) y quién estaba en la convocatoria aprobada de ese equipo (`convocados`: solo los domingos
 *  con convocatoria aprobada). */
export type QuienPartido = { hojas: Map<string, Set<string>>; convocados: Map<string, Set<string>> };
export const clavePartido = (fecha: string, equipo: string | null | undefined) => `${fecha}|${equipo}`;
const EQUIPO: Record<string, "MdA" | "MdL" | undefined> = { MDA: "MdA", MDL: "MdL", MdA: "MdA", MdL: "MdL" };

/** Las hojas de una temporada (`season_<t>.json`, público): por partido, quién sale en ella. */
export function hojasDeTemporada(season: { partidos: { pn: number; equipo: string; fecha: string }[]; players: { person_id?: string; games?: { pn: number; eq: string }[] }[] }): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const fechaDe = new Map<string, string>();
  for (const p of season.partidos) {
    const eq = EQUIPO[p.equipo];
    if (!eq) continue;
    fechaDe.set(`${p.pn}|${eq}`, p.fecha);
    out.set(clavePartido(p.fecha, eq), new Set());
  }
  for (const j of season.players) {
    if (!j.person_id) continue;
    for (const g of j.games ?? []) {
      const eq = EQUIPO[g.eq];
      const f = eq && fechaDe.get(`${g.pn}|${eq}`);
      if (f) out.get(clavePartido(f, eq))!.add(j.person_id);
    }
  }
  return out;
}

/** Las convocatorias aprobadas (`convocatorias.equipos`): por partido, quién estaba convocado en ese equipo. */
export function convocadosDeAprobadas(aprobadas: { fecha: string; equipos: Record<string, { person_id: string }[] | null | undefined> | null }[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const c of aprobadas) for (const [k, lista] of Object.entries(c.equipos ?? {})) {
    const eq = EQUIPO[k];
    if (eq) out.set(clavePartido(c.fecha, eq), new Set((lista ?? []).map((x) => x.person_id)));
  }
  return out;
}

/** Asistencia de la plataforma (D161): partidos de liga y entrenos YA PASADOS (fecha < hoy) desde DESDE_PLATAFORMA. Por
 *  cada respuesta, la efectiva (D146/D150): «va» = fue; «no» = no fue, con su motivo (el de la respuesta, el de la
 *  ausencia por periodo o «no suele entrenar»); «duda» o «sin responder» en un evento pasado = «sin responder». Quien
 *  queda fuera (solo entreno en un partido, sin responder) no cuenta. Amistosos y torneos no cuentan, como en SportEasy.
 *
 *  En los partidos de liga mandan la hoja de la FBM y la convocatoria aprobada (D72, D197), cada partido por separado
 *  (también el del doblado):
 *   - sale en la hoja → fue, responda lo que responda (o aunque no respondiera);
 *   - no sale en la hoja (o el partido aún no la tiene y no dijo «voy») pero estaba en la convocatoria aprobada de ese
 *     equipo → falta: «con excusa» si tiene un «no» con motivo o una ausencia por periodo; «sin excusa» si no (aunque
 *     dijera «voy»). La lesión sigue siendo lesión (no cuenta);
 *   - dijo «voy» y no sale ni en la hoja ni en la convocatoria aprobada → no convocado (no cuenta);
 *   - «no», «duda» o «sin responder» fuera de las dos → como siempre (con excusa / sin excusa); «nunca a partidos» sin
 *     responder sigue sin contar.
 *  Un partido sin hoja ni convocatoria aprobada se cuenta con la respuesta, marcado `provisional`. Sin `partidos`, todos
 *  los partidos son provisionales (la regla de D161). */
export function asistenciaPlataforma(eventos: EventoAsistencia[], respuestas: RespuestaEvento[], defecto: Defecto | null, hoy: string, partidos: QuienPartido | null = null): AsistenciaEvento[] {
  const ev = new Map(eventos.filter((e) => e.fecha >= DESDE_PLATAFORMA && e.fecha < hoy && (esEntreno(e) || (e.tipo === "liga" && e.oficial !== false))).map((e) => [e.id, e]));
  const res: AsistenciaEvento[] = [];
  const base = (e: EventoAsistencia, person_id: string): Pick<AsistenciaEvento, "person_id" | "ambito" | "evento_id" | "fecha" | "equipo" | "titulo"> => ({
    person_id, ambito: esEntreno(e) ? "entrenos" as const : "partidos" as const, evento_id: e.id, fecha: e.fecha,
    equipo: e.equipo === "MdA" || e.equipo === "MdL" ? e.equipo : null, titulo: e.titulo ?? null,
  });
  const quien = (e: EventoAsistencia) => {
    if (esEntreno(e)) return null;
    const k = clavePartido(e.fecha, e.equipo);
    return { hoja: partidos?.hojas.get(k) ?? null, conv: partidos?.convocados.get(k) ?? null };
  };
  const vistos = new Set<string>();
  for (const r of respuestas) {
    const e = ev.get(r.evento_id);
    if (!e) continue;
    vistos.add(`${e.id}|${r.person_id}`);
    const b = base(e, r.person_id);
    const q = quien(e);
    const provisional = !!q && !q.hoja && !q.conv;
    if (q?.hoja?.has(r.person_id)) { res.push({ ...b, fue: true, motivo: null, estado: "fue", provisional }); continue; }
    const enConv = !!q?.conv?.has(r.person_id);
    const ef = efectivaEn(e, r.person_id, r.respuesta, defecto);
    if (ef.fuera && !enConv) continue;
    const va = ef.respuesta === "va";
    // «Voy»: fue en un entreno, en un partido provisional o convocado en un partido aún sin hoja; si no, no convocado.
    if (va && (!q || provisional || (!q.hoja && enConv))) { res.push({ ...b, fue: true, motivo: null, estado: "fue", provisional }); continue; }
    if (va && !enConv) { res.push({ ...b, fue: false, motivo: null, estado: "no_convocado", provisional }); continue; }
    const motivo = va ? "convocado, no fue"
      : ef.respuesta !== "no" ? "sin responder"
      : r.motivo ? TEXTO_NUEVO[r.motivo]
      : ef.por === "ausencia" ? (TEXTO_NUEVO[ef.ausencia?.motivo as Motivo] ?? "ausencia")
      : ef.por === "defecto" ? "no suele entrenar" : "no va, sin motivo";
    // Estado en la tabla nueva: lesión si el motivo (o la ausencia) lo es; «no» con cualquier otro motivo = con excusa
    // (avisó); «sin responder» o «duda» en un evento ya pasado = sin excusa. Convocado y no fue (D197): con excusa solo con
    // un «no» con motivo o una ausencia por periodo.
    const estado = motivo === "lesión" && ef.respuesta === "no" ? "lesion"
      : enConv ? (ef.respuesta === "no" && (r.motivo || ef.por === "ausencia") ? "con_excusa" : "sin_excusa")
      : ef.respuesta !== "no" ? "sin_excusa" : "con_excusa";
    res.push({ ...b, fue: false, motivo, estado, provisional });
  }
  // Quien sale en la hoja o en la convocatoria aprobada sin respuesta guardada: fue (hoja) o sin excusa (convocado).
  for (const e of ev.values()) {
    const q = quien(e);
    if (!q) continue;
    for (const p of new Set([...(q.hoja ?? []), ...(q.conv ?? [])])) {
      if (vistos.has(`${e.id}|${p}`)) continue;
      const fue = !!q.hoja?.has(p);
      res.push({ ...base(e, p), fue, motivo: fue ? null : "sin responder", estado: fue ? "fue" : "sin_excusa", provisional: false });
    }
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
    if (x.estado === "no_convocado") continue; // no cuenta (D170, D197)
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
