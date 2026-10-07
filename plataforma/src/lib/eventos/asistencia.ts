// Resumen de asistencia de la temporada por jugador (paso 2, pista E, D94): entrenos y partidos asistidos / total / % y
// motivos mas frecuentes. Solo para gestores (D46, D82). Funciones PURAS.
import type { Motivo } from "./dominio";

export type FilaResumen = {
  temporada: string; person_id: string; nombre: string; ambito: "partidos" | "entrenos";
  fueron: number; total: number; con_excusa: number; sin_excusa: number; no_convocado: number; lesion: number;
};
export type RespuestaMotivo = { person_id: string; fecha: string; respuesta: string; motivo: Motivo | null };

export type MotivoFrecuente = { texto: string; veces: number };
export type Ambito = { fueron: number; total: number; pct: number | null };
export type ResumenJugador = {
  person_id: string; nombre: string; entrenos: Ambito; partidos: Ambito; motivos: MotivoFrecuente[];
};

const pct = (f: number, t: number) => (t > 0 ? f / t : null);
const TEXTO_NUEVO: Record<Motivo, string> = { lesion: "lesión", trabajo: "trabajo", viaje: "viaje", familia: "familia", otro: "otro" };

/** Una fila por persona. Motivos: los del historico (con excusa, sin excusa, no convocado, lesión) y los «no voy» con
 *  motivo registrados en la plataforma desde las respuestas de SportEasy (lesión, trabajo, viaje, familia, otro). */
export function resumenTemporada(filas: FilaResumen[], respuestas: RespuestaMotivo[] = [], maxMotivos = 3, nombres: Record<string, string> = {}): ResumenJugador[] {
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
  for (const x of respuestas) if (x.respuesta === "no" && x.motivo) suma(get(x.person_id, nombres[x.person_id] ?? x.person_id), TEXTO_NUEVO[x.motivo], 1);
  return [...por.values()].map(({ _m, ...r }) => ({
    ...r,
    motivos: [..._m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es")).slice(0, maxMotivos).map(([texto, veces]) => ({ texto, veces })),
  })).sort((a, b) => (b.entrenos.fueron + b.partidos.fueron) - (a.entrenos.fueron + a.partidos.fueron) || a.nombre.localeCompare(b.nombre, "es"));
}

export const textoPct = (p: number | null) => (p == null ? "—" : `${Math.round(p * 100)} %`);
