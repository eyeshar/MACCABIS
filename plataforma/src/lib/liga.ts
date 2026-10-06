import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Liga 26/27 en la zona de gestion (D73). Los datos por jugador de otros equipos son de terceros: solo los lee un
// gestor (RLS) y nunca se muestran fuera de /gestion.

export const TEMPORADA = "2026-27";

import type { JugadorLiga } from "./jugadoresLiga";
export type { JugadorLiga } from "./jugadoresLiga";
export { NUESTROS, bonito, dec, mmss, quienDobla, unirDoblan } from "./jugadoresLiga";

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

export const codigoNuestro = (grupo: string) => (grupo === "G1" ? "MDA" : "MDL");
export const nombreNuestro = (grupo: string) => (grupo === "G1" ? "MdA" : "MdL");
export const fechaCorta = (f: string) => { const [, m, d] = f.split("-"); return `${+d}/${+m}`; };

/** Proximo partido (desde hoy) de MdA o MdL contra un equipo, o el proximo rival de nuestro equipo si no se dice rival. */
export function proximoPartido(cal: PartidoCalendario[], hoy: string, equipo: "MDA" | "MDL", rival?: string) {
  return cal
    .filter((p) => p.equipo === equipo && !p.descansa && p.fecha && p.fecha >= hoy && (!rival || p.rival === rival))
    .sort((a, b) => (a.fecha! < b.fecha! ? -1 : 1))[0] ?? null;
}
