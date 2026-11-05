import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cargarFuente } from "./eventos/fuente";
import type { FuenteCalendario } from "./publico";

// Liga 26/27 con sesion (D73, D162): Scouting rivales y Liga consolidada. Los datos por jugador de otros equipos son de
// terceros: solo los lee quien tiene sesion de jugador o de gestor (RLS, puede_ver_liga()); nunca sin login.
// El calendario (fecha, hora, pista y rival de cada partido) sale SOLO de la tabla de eventos (D151, D162), nunca de la
// copia liga_calendario ni de los ficheros del repo: si la tabla no responde, no hay «proximo partido».

export const TEMPORADA = "2026-27";

// Grupos de la fase (D183, D184, D186): los nuestros (G1 de MdA, G2 de MdL) y los cuatro ajenos. Se carga solo lo de los grupos
// marcados en Liga consolidada; en el ranking cada grupo va en su propia clasificacion (nunca se mezclan).
export { GRUPOS_AJENOS, GRUPOS_NUESTROS, GRUPOS_TODOS, esGrupoNuestro, etiquetaGrupo } from "./gruposLiga";
import { GRUPOS_NUESTROS, type PartidoLiga } from "./gruposLiga";

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
  filas: FilaHoja[];            // las hojas partido a partido (los picos de las claves, D174)
  clasificacion: FilaClasificacion[];
  calendario: PartidoCalendario[];
  hoy: string;
};

type FilaCruda = Omit<FilaHoja, "grupo" | "jornada"> & { id: string; liga_partidos: { grupo: string; jornada: number | null } };

/** Filas de las hojas de la temporada, partido a partido (la API da como mucho 1000 por consulta: se pide por paginas).
 *  D175: la primera pagina trae tambien el total y las demas se piden a la vez, no una tras otra. */
async function filasHojas(supabase: SupabaseClient, grupos: readonly string[]): Promise<FilaHoja[]> {
  const PAGINA = 1000;
  const pagina = async (desde: number) => {
    let q = supabase.from("liga_estadisticas_jugador")
      .select("id, partido_id, equipo, dorsal, nombre, segundos, pts, p2a, p3a, tla, tli, faltas, liga_partidos!inner(temporada, grupo, jornada)", desde === 0 ? { count: "exact" } : undefined)
      .eq("liga_partidos.temporada", TEMPORADA);
    q = q.in("liga_partidos.grupo", grupos);
    const { data, error, count } = await q.order("id").range(desde, desde + PAGINA - 1);
    if (error) throw new Error(error.message);
    return { filas: (data ?? []) as unknown as FilaCruda[], count };
  };
  const primera = await pagina(0);
  const paginas = [primera];
  if (primera.count != null) {
    paginas.push(...(await Promise.all(Array.from({ length: Math.max(0, Math.ceil(primera.count / PAGINA) - 1) }, (_, i) => pagina((i + 1) * PAGINA)))));
  } else {
    // Sin total (no deberia pasar): de una en una hasta que una venga corta, como antes.
    for (let ultima = primera; ultima.filas.length === PAGINA; ) paginas.push((ultima = await pagina(paginas.length * PAGINA)));
  }
  // jornada 0 = sin jornada: los grupos ajenos (D184), cuya hoja no la trae.
  return paginas.flatMap((p) => p.filas).map(({ liga_partidos: p, id: _id, ...f }) => ({ ...f, grupo: p.grupo, jornada: p.jornada ?? 0 }));
}

/** Clasificacion calculada de esos grupos (solo datos por equipo). */
export async function cargarClasificacion(supabase: SupabaseClient, grupos: readonly string[]): Promise<FilaClasificacion[]> {
  const c = await supabase.from("liga_clasificacion").select("grupo, pos, equipo, nuestro, pj, g, p, pf, pc, pts, pts_fuente")
    .eq("temporada", TEMPORADA).in("grupo", grupos).order("grupo").order("pos");
  if (c.error) throw new Error(c.error.message);
  return (c.data ?? []) as FilaClasificacion[];
}

/** Partidos de esos grupos (liga_partidos, con sesion: RLS), con marcador, jornada y fecha si se conoce (D186). */
export async function cargarPartidos(supabase: SupabaseClient, grupos: readonly string[]): Promise<PartidoLiga[]> {
  const r = await supabase.from("liga_partidos").select("id, grupo, jornada, fecha, local, visitante, pts_local, pts_visitante")
    .eq("temporada", TEMPORADA).in("grupo", grupos).order("grupo").order("jornada").order("local");
  if (r.error) throw new Error(r.error.message);
  return (r.data ?? []) as PartidoLiga[];
}

/** `grupos`: solo las hojas y la clasificacion de esos grupos; por defecto, los nuestros (G1 y G2): los ajenos (D184) solo
 *  cuando se piden. `clasificacion`: la ya leida (Scouting la lee de todos los grupos para el selector). */
export async function cargarLiga(supabase: SupabaseClient, grupos: readonly string[] = GRUPOS_NUESTROS,
  opciones: { clasificacion?: FilaClasificacion[] } = {}): Promise<DatosLiga> {
  const [filas, clasificacion, fuente] = await Promise.all([
    filasHojas(supabase, grupos),
    opciones.clasificacion ?? cargarClasificacion(supabase, grupos),
    cargarFuente(),
  ]);
  return {
    // D168: un jugador por equipo y nombre normalizado (el dorsal no es identidad); quien no ha jugado ningun minuto no sale.
    jugadores: agruparJugadores(filas).jugadores,
    filas,
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
