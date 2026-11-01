import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cargarFuente } from "./eventos/fuente";
import type { FuenteCalendario } from "./publico";

// Liga 26/27 con sesion (D73, D162): Scouting rivales y Liga consolidada. Los datos por jugador de otros equipos son de
// terceros: solo los lee quien tiene sesion de jugador o de gestor (RLS, puede_ver_liga()); nunca sin login.
// El calendario (fecha, hora, pista y rival de cada partido) sale SOLO de la tabla de eventos (D151, D162), nunca de la
// copia liga_calendario ni de los ficheros del repo: si la tabla no responde, no hay «proximo partido».

export const TEMPORADA = "2026-27";

import { agruparJugadores, type FilaHoja, type JugadorLiga } from "./jugadoresLiga";
export type { JugadorLiga } from "./jugadoresLiga";
export { NUESTROS, bonito, dec, masPeligrosos, minimoPartidos, mmss, porMediaPts, quienDobla, textoDorsales, unirDoblan } from "./jugadoresLiga";

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

/** Filas de las hojas de la temporada, partido a partido (la API da como mucho 1000 por consulta: se pide por paginas). */
async function filasHojas(supabase: SupabaseClient): Promise<FilaHoja[]> {
  const PAGINA = 1000;
  const out: FilaHoja[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await supabase.from("liga_estadisticas_jugador")
      .select("id, partido_id, equipo, dorsal, nombre, segundos, pts, p2a, p3a, tla, tli, faltas, liga_partidos!inner(temporada, grupo, jornada)")
      .eq("liga_partidos.temporada", TEMPORADA).order("id").range(desde, desde + PAGINA - 1);
    if (error) throw new Error(error.message);
    for (const { liga_partidos: p, id: _id, ...f } of (data ?? []) as unknown as (Omit<FilaHoja, "grupo" | "jornada"> & { id: string; liga_partidos: { grupo: string; jornada: number } })[]) {
      out.push({ ...f, grupo: p.grupo, jornada: p.jornada });
    }
    if ((data ?? []).length < PAGINA) return out;
  }
}

export async function cargarLiga(supabase: SupabaseClient): Promise<DatosLiga> {
  const [filas, c, fuente] = await Promise.all([
    filasHojas(supabase),
    supabase.from("liga_clasificacion").select("grupo, pos, equipo, nuestro, pj, g, p, pf, pc, pts, pts_fuente").eq("temporada", TEMPORADA).order("grupo").order("pos"),
    cargarFuente(),
  ]);
  if (c.error) throw new Error(c.error.message);
  const clasificacion = (c.data ?? []) as FilaClasificacion[];
  return {
    // D168: un jugador por equipo y nombre normalizado (el dorsal no es identidad); quien no ha jugado ningun minuto no sale.
    jugadores: agruparJugadores(filas).jugadores,
    clasificacion,
    calendario: calendarioDeEventos(fuente, clasificacion),
    hoy: new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }),
  };
}

/** Nombre de equipo sin tipografia: el calendario lo da en MAYUSCULAS («MEJORADA 2012 C.B..») y las hojas de la FBM en
 *  formato titulo («Mejorada 2012 C.B.»). */
export const claveEquipo = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Partidos de MdA y MdL de la tabla de eventos (D162), con el rival escrito como en la clasificacion (para cruzarlos). */
export function calendarioDeEventos(fuente: FuenteCalendario | undefined, clasificacion: Pick<FilaClasificacion, "grupo" | "equipo">[]): PartidoCalendario[] {
  if (!fuente) return [];
  return fuente.partidos.map((p) => {
    const grupo = p.equipo === "MDA" ? "G1" : "G2";
    const rival = p.rival ? clasificacion.find((x) => x.grupo === grupo && claveEquipo(x.equipo) === claveEquipo(p.rival!))?.equipo ?? p.rival : null;
    return { equipo: p.equipo, jornada: p.jornada, fecha: p.fecha, hora: p.hora, local: p.local, descansa: !!p.descansa, rival, campo: p.campo };
  });
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
