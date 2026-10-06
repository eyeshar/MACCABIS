import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Liga 26/27 en la zona de gestion (D73). Los datos por jugador de otros equipos son de terceros: solo los lee un
// gestor (RLS) y nunca se muestran fuera de /gestion.

export const TEMPORADA = "2026-27";

export type JugadorLiga = {
  grupo: string; equipo: string; nombre: string; dorsal: string;
  pj: number; segundos: number; pts: number; p2a: number; p3a: number; tla: number; tli: number; faltas: number;
};
export type FilaClasificacion = {
  grupo: string; pos: number; equipo: string; nuestro: boolean;
  pj: number; g: number; p: number; pf: number; pc: number; pts: number | null; pts_fuente: string | null;
};
export type PartidoCalendario = {
  equipo: "MDA" | "MDL"; jornada: number; fecha: string | null; hora: string | null; local: boolean | null;
  descansa: boolean; rival: string | null; campo: string | null;
};

export type DatosLiga = {
  jugadores: JugadorLiga[];
  clasificacion: FilaClasificacion[];
  calendario: PartidoCalendario[];
  hoy: string;
};

export async function cargarLiga(supabase: SupabaseClient): Promise<DatosLiga> {
  const [j, c, k] = await Promise.all([
    supabase.from("v_liga_jugadores").select("grupo, equipo, nombre, dorsal, pj, segundos, pts, p2a, p3a, tla, tli, faltas").eq("temporada", TEMPORADA).range(0, 4999),
    supabase.from("liga_clasificacion").select("grupo, pos, equipo, nuestro, pj, g, p, pf, pc, pts, pts_fuente").eq("temporada", TEMPORADA).order("grupo").order("pos"),
    supabase.from("liga_calendario").select("equipo, jornada, fecha, hora, local, descansa, rival, campo").eq("temporada", TEMPORADA).order("jornada"),
  ]);
  for (const r of [j, c, k]) if (r.error) throw new Error(r.error.message);
  return {
    jugadores: (j.data ?? []) as JugadorLiga[],
    clasificacion: (c.data ?? []) as FilaClasificacion[],
    calendario: (k.data ?? []) as PartidoCalendario[],
    hoy: new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }),
  };
}

export const NUESTROS = ["MdA", "MdL"] as const;
export const codigoNuestro = (grupo: string) => (grupo === "G1" ? "MDA" : "MDL");
export const nombreNuestro = (grupo: string) => (grupo === "G1" ? "MdA" : "MdL");

const MINUSCULAS = new Set(["de", "del", "la", "las", "los", "y", "da", "dos", "do"]);
/** "SANDU SOTOLONGO , DARIUS" -> "Sandu Sotolongo, Darius" (de/del/la... en minuscula salvo al empezar) */
export function bonito(nombre: string) {
  return nombre.toLowerCase().replace(/\s+/g, " ").replace(/\s+,/g, ",").trim()
    .replace(/(^|[\s,.'-])(\p{L}[\p{L}]*)/gu, (_m, a: string, w: string, off: number) =>
      a + (off > 0 && MINUSCULAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)));
}

/** Una persona que sale con MdA y con MdL cuenta UNA vez en los lideres de la liga (suma de las dos fichas). */
export function unirDoblan(jugadores: JugadorLiga[]): JugadorLiga[] {
  const dobla = quienDobla(jugadores);
  const salida: JugadorLiga[] = [];
  const unidos = new Map<string, JugadorLiga>();
  for (const j of jugadores) {
    if (!dobla.has(j.nombre) || !(NUESTROS as readonly string[]).includes(j.equipo)) { salida.push(j); continue; }
    const u = unidos.get(j.nombre);
    if (!u) { unidos.set(j.nombre, { ...j, equipo: "MdA + MdL", grupo: "G1+G2" }); continue; }
    for (const k of ["pj", "segundos", "pts", "p2a", "p3a", "tla", "tli", "faltas"] as const) u[k] += j[k];
  }
  return [...salida, ...unidos.values()];
}

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
export const dec = (v: number | null | undefined, n = 1) =>
  v === null || v === undefined || !Number.isFinite(v) ? "–" : v.toFixed(n).replace(".", ",");
export const fechaCorta = (f: string) => { const [, m, d] = f.split("-"); return `${+d}/${+m}`; };

/** Proximo partido (desde hoy) de MdA o MdL contra un equipo, o el proximo rival de nuestro equipo si no se dice rival. */
export function proximoPartido(cal: PartidoCalendario[], hoy: string, equipo: "MDA" | "MDL", rival?: string) {
  return cal
    .filter((p) => p.equipo === equipo && !p.descansa && p.fecha && p.fecha >= hoy && (!rival || p.rival === rival))
    .sort((a, b) => (a.fecha! < b.fecha! ? -1 : 1))[0] ?? null;
}

/** Nombres de nuestros jugadores que salen con MdA y con MdL ("doblan"), segun las hojas. */
export function quienDobla(jugadores: JugadorLiga[]) {
  const mda = new Set(jugadores.filter((j) => j.equipo === "MdA").map((j) => j.nombre));
  return new Set(jugadores.filter((j) => j.equipo === "MdL" && mda.has(j.nombre)).map((j) => j.nombre));
}
