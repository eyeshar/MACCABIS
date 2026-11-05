// Grupos de la fase en Liga consolidada (D184, D186) y resultados por jornada. Utilidades puras (sin servidor), para las
// pantallas y las pruebas. Los datos por jugador y los marcadores de G3-G6 son de terceros: solo con sesion (RLS).

// Los nuestros (G1 de MdA, G2 de MdL) y los cuatro ajenos de la fase (D183).
export const GRUPOS_NUESTROS = ["G1", "G2"] as const;
export const GRUPOS_AJENOS = ["G3", "G4", "G5", "G6"] as const;
export const GRUPOS_TODOS: readonly string[] = [...GRUPOS_NUESTROS, ...GRUPOS_AJENOS];
const NOMBRE_GRUPO: Record<string, string> = { G1: "MdA", G2: "MdL", G3: "DOM MAÑ G3", G4: "DOM TAR", G5: "SAB TAR G1", G6: "SAB TAR G2" };
/** «G3 · DOM MAÑ G3», «G1 · MdA». */
export const etiquetaGrupo = (g: string) => (NOMBRE_GRUPO[g] ? `${g} · ${NOMBRE_GRUPO[g]}` : g);
export const esGrupoNuestro = (g: string) => (GRUPOS_NUESTROS as readonly string[]).includes(g);

/** Los grupos marcados, en el orden de siempre (G1, G2, G3…), sin repetir y sin los que no existen. */
export const ordenarGrupos = (gs: Iterable<string>) => GRUPOS_TODOS.filter((g) => new Set(gs).has(g));

/**
 * Grupos de la URL (D186): `?grupos=G1,G2,G4` (cualquier combinacion; como minimo uno). El enlace antiguo de D184 sigue
 * valiendo: `?grupo=G3` es solo el G3 y `?grupo=nuestros`, G1 + G2. Sin parametros, o si no queda ningun grupo valido, los
 * nuestros (G1 + G2), como siempre.
 */
export function gruposDeUrl(p: { grupos?: string | string[]; grupo?: string | string[] }): string[] {
  const lista = (v?: string | string[]) => (Array.isArray(v) ? v : v ? [v] : []).flatMap((x) => x.split(",")).map((x) => x.trim().toUpperCase());
  const pedidos = ordenarGrupos(lista(p.grupos));
  if (pedidos.length) return pedidos;
  const antiguo = ordenarGrupos(lista(p.grupo));
  if (antiguo.length) return antiguo;
  return [...GRUPOS_NUESTROS];
}

/** ¿Es la seleccion por defecto (G1 + G2)? */
export const sonLosNuestros = (gs: readonly string[]) => gs.length === 2 && gs[0] === "G1" && gs[1] === "G2";

/** Enlace a Liga consolidada con esos grupos y esa pestaña (la seleccion se mantiene al cambiar de pestaña). */
export function hrefConsolidada(gs: readonly string[], extra: { vista?: "resultados"; j?: number } = {}, ancla = "") {
  const q = new URLSearchParams();
  if (!sonLosNuestros(gs)) q.set("grupos", gs.join(","));
  if (extra.vista) q.set("vista", extra.vista);
  if (extra.j) q.set("j", String(extra.j));
  const s = q.toString().replace(/%2C/g, ",");
  return `/liga/consolidada${s ? `?${s}` : ""}${ancla}`;
}

/** «G1 y G2», «G1, G2 y G4». */
export function textoGrupos(gs: readonly string[]) {
  return gs.length <= 1 ? (gs[0] ?? "") : `${gs.slice(0, -1).join(", ")} y ${gs[gs.length - 1]}`;
}

// ---- Resultados por jornada

/** Un partido de liga_partidos (con sesion). */
export type PartidoLiga = {
  id: string; grupo: string; jornada: number | null; fecha: string | null;
  local: string; visitante: string; pts_local: number | null; pts_visitante: number | null;
};

/** Jornadas de los grupos ajenos (data/jornadas_grupos_ajenos_<temporada>.json, D186): quien descansa y los huecos. */
export type JornadasAjenas = {
  jornadas: { grupo: string; jornada: number; descansa: string | null; huecos: { local: string; visitante: string; motivo: string }[] }[];
};

export type FilaResultado =
  | { tipo: "partido"; id: string; local: string; visitante: string; pl: number | null; pv: number | null; fecha: string | null }
  | { tipo: "hueco"; local: string; visitante: string; motivo: string };

export type BloqueResultados = { grupo: string; jornada: number; filas: FilaResultado[]; descansa: string[]; sinPartidos: boolean };

/** Nombre de equipo sin tipografia: las hojas lo dan en formato titulo y el fichero de jornadas en MAYUSCULAS. */
const claveEq = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Jornadas con algun partido en esos grupos, de menor a mayor. */
export const jornadasJugadas = (partidos: PartidoLiga[], gs: readonly string[]) =>
  [...new Set(partidos.filter((p) => gs.includes(p.grupo) && p.jornada != null).map((p) => p.jornada as number))].sort((a, b) => a - b);

/**
 * Un bloque por grupo marcado (en el orden de siempre: MdA, MdL y los demas) con sus partidos de esa jornada. Los huecos
 * (sin hoja o incomparecencia) salen como tales, sin marcador. Quien descansa: el del fichero de jornadas (grupos ajenos) o,
 * si no lo hay, el unico equipo del grupo sin partido ni hueco esa jornada (si falta mas de uno, no se adivina: se dice
 * cuales no tienen partido cargado).
 */
export function resultadosDeJornada(partidos: PartidoLiga[], equiposPorGrupo: Record<string, string[]>, gs: readonly string[], jornada: number,
  ajenas: JornadasAjenas = { jornadas: [] }): BloqueResultados[] {
  return gs.map((g) => {
    const mios = partidos.filter((p) => p.grupo === g && p.jornada === jornada)
      .sort((a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? "") || a.local.localeCompare(b.local, "es"));
    const info = ajenas.jornadas.find((x) => x.grupo === g && x.jornada === jornada);
    const equipos = equiposPorGrupo[g] ?? [];
    const nombre = (n: string) => equipos.find((e) => claveEq(e) === claveEq(n)) ?? n;
    const filas: FilaResultado[] = [
      ...mios.map((p) => ({ tipo: "partido" as const, id: p.id, local: p.local, visitante: p.visitante, pl: p.pts_local, pv: p.pts_visitante, fecha: p.fecha })),
      ...(info?.huecos ?? []).map((h) => ({ tipo: "hueco" as const, local: nombre(h.local), visitante: nombre(h.visitante), motivo: h.motivo })),
    ];
    const juegan = new Set(filas.flatMap((f) => [claveEq(f.local), claveEq(f.visitante)]));
    const descansa = info?.descansa ? [nombre(info.descansa)] : equipos.filter((e) => !juegan.has(claveEq(e)));
    return { grupo: g, jornada, filas, descansa, sinPartidos: filas.length === 0 };
  });
}

/** «sin hoja» / «incomparecencia». */
export const textoHueco = (motivo: string) => (motivo === "incomparecencia" ? "incomparecencia" : motivo === "sin_hoja" ? "sin hoja" : motivo.replace(/_/g, " "));
