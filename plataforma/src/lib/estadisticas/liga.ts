import "server-only";
import ligaJson from "@/data/liga.json";
import equipJson from "@/data/equipaciones.json";
import rivalesJson from "@/data/estadisticas/rivales.json";
import { equipoPorNombre, type Aviso, type Equipaciones } from "@/data/avisosEquipacion";
import { avisoDe, coloresDe, proximoConAviso } from "@/lib/equipacion";
import { partidosCalendario } from "@/lib/publico";

// Liga 26/27 publica (migrada de GitHub Pages): clasificacion calculada, resultados por jornada y ficha por equipo.
// SOLO datos por equipo (D73): nada por jugador de otros equipos, que vive en la zona de gestion (Liga consolidada).
// Fuente: data/liga_2026-27.json (npm run jornada) y data/rivales_2026-27_web.json (npm run build:rivales).

export type Grupo = "G1" | "G2";
export type FilaClasificacion = { pos: number; id: string; equipo: string; nuestro: boolean; pj: number; g: number; p: number; pf: number; pc: number; dif: number; pts: number | null; incomparecencias?: number };
/** Totales de un equipo en un partido (fila TOTALES de la hoja; en 2P y 3P la hoja solo registra los acertados). */
export type EstEquipo = { pts: number; t2: number; t3: number; tl: number; tl_int: number; faltas: number };
export type ResultadoLiga = {
  id: string; jornada: number; fecha: string | null; local: string; local_id: string; visitante: string; visitante_id: string;
  pl: number | null; pv: number | null; incomparecencia?: boolean; no_presentado?: string; est?: { local: EstEquipo; visitante: EstEquipo };
};
export type Bloque = { pj: number; g: number; p: number; pf: number; pc: number; media_pf: number | null; media_pc: number | null };
export type EquipoLiga = {
  id: string; nombre: string; nuestro: boolean; media_pf: number | null; media_pc: number | null; media_dif: number | null;
  ultimos: ("G" | "P")[]; racha: { tipo: "G" | "P"; n: number } | null;
  // casa/fuera siguen en el JSON (la web anterior los lee), pero la web ya no los enseña (D129: todos juegan en Moratalaz).
  casa?: Bloque; fuera?: Bloque;
};
export type GrupoLiga = {
  nombre: string; nuestro: "MDA" | "MDL"; jornadas_cargadas: number[]; orden_provisional?: boolean;
  clasificacion: FilaClasificacion[]; resultados: ResultadoLiga[]; descansan: Record<string, string[]>; equipos: Record<string, EquipoLiga>;
};
export const LIGA = ligaJson as unknown as { temporada: string; generado: string; grupos: Record<Grupo, GrupoLiga> };
export const TEMPORADA_LIGA = LIGA.temporada;
export const NUESTRO_DE: Record<Grupo, "MdA" | "MdL"> = { G1: "MdA", G2: "MdL" };

// ------------------------------------------------------------------------------------------- enlaces (D129)
/** Ficha de un equipo de la liga: la de Rivales 26/27 o, para MdA y MdL, su pestaña Equipo de la temporada. */
export function hrefEquipo(g: Grupo, id: string) {
  const G = LIGA.grupos[g];
  if (G.equipos[id]?.nuestro) return `/liga/${TEMPORADA_LIGA}/equipo?eq=${G.nuestro}`;
  return `/liga/rivales?g=${NUESTRO_DE[g]}&r=${encodeURIComponent(id)}`;
}
export const hrefPartido = (id: string) => `/liga/${TEMPORADA_LIGA}/partido/${encodeURIComponent(id)}`;

/** Ficha de cada equipo por nombre ("G1|Chavalitros" -> href), para las pantallas que solo tienen el nombre. */
export function fichasPorNombre(): Record<string, string> {
  const r: Record<string, string> = {};
  for (const g of ["G1", "G2"] as const) for (const [id, e] of Object.entries(LIGA.grupos[g].equipos)) r[`${g}|${e.nombre}`] = hrefEquipo(g, id);
  return r;
}

/** Busca un partido por su id en los dos grupos. */
export function partidoPorId(id: string): { grupo: Grupo; r: ResultadoLiga } | null {
  for (const g of ["G1", "G2"] as const) {
    const r = LIGA.grupos[g].resultados.find((x) => x.id === id);
    if (r) return { grupo: g, r };
  }
  return null;
}

/** Partido de la liga de MdA o MdL en una fecha (para enlazar desde la portada, el inicio y la pestaña Equipo). */
export function partidoNuestro(equipo: "MDA" | "MDL", fecha: string | null) {
  if (!fecha) return null;
  const g: Grupo = equipo === "MDA" ? "G1" : "G2";
  const G = LIGA.grupos[g];
  const nos = Object.entries(G.equipos).find(([, e]) => e.nuestro)?.[0];
  return G.resultados.find((x) => x.fecha === fecha && (x.local_id === nos || x.visitante_id === nos)) ?? null;
}

/** Lo que las pantallas publicas reciben de un grupo: sin casa/fuera (D129). */
export function grupoParaPantalla(G: GrupoLiga): GrupoLiga {
  return { ...G, equipos: Object.fromEntries(Object.entries(G.equipos).map(([k, e]) => [k, { id: e.id, nombre: e.nombre, nuestro: e.nuestro, media_pf: e.media_pf, media_pc: e.media_pc, media_dif: e.media_dif, ultimos: e.ultimos, racha: e.racha }])) };
}

export type Color = { camiseta: string; pantalon: string; css: string };
export type ProximoLiga = {
  equipo: "MDA" | "MDL"; jornada: number; local: boolean | null; rival: string; fecha: string | null; hora: string | null; campo: string | null; color: Color | null; aviso: Aviso | null;
};
export type ContraNosotros = { jornada: number; fecha: string; aviso: Aviso | null };

/** Todo lo que la pantalla de Liga necesita ya calculado en el servidor (colores, avisos de equipacion, proximos partidos). */
export function datosLiga(hoy: string) {
  const equip = equipJson as unknown as Equipaciones;
  const colores: Record<string, Color | null> = {};
  const contra: Record<string, ContraNosotros | null> = {};
  for (const g of ["G1", "G2"] as const) {
    const G = LIGA.grupos[g];
    const eq = G.nuestro;
    for (const e of Object.values(G.equipos)) {
      colores[`${g}:${e.id}`] = coloresDe(e.nombre);
      if (e.nuestro) { contra[`${g}:${e.id}`] = null; continue; }
      // Proximo partido de nuestro equipo contra ese rival (desde hoy), con su aviso de equipacion.
      const ref = equipoPorNombre(equip, e.nombre);
      const p = partidosCalendario()
        .filter((x) => x.equipo === eq && !x.descansa && x.fecha && x.fecha >= hoy && x.rival && equipoPorNombre(equip, x.rival) === ref)
        .sort((a, b) => (a.fecha! < b.fecha! ? -1 : 1))[0];
      contra[`${g}:${e.id}`] = p ? { jornada: p.jornada, fecha: p.fecha!, aviso: avisoDe(p) } : null;
    }
  }
  const proximos: (ProximoLiga | null)[] = (["MDA", "MDL"] as const).map((eq) => {
    const x = proximoConAviso(eq, hoy);
    if (!x) return null;
    const rival = x.partido.rival ?? "";
    return {
      equipo: eq, jornada: x.partido.jornada, local: x.partido.local, rival: equipoPorNombre(equip, rival)?.nombre ?? rival,
      fecha: x.partido.fecha, hora: x.partido.hora, campo: x.partido.campo, color: coloresDe(rival), aviso: x.aviso,
    };
  });
  return { liga: LIGA, colores, contra, proximos };
}

// ------------------------------------------------------------------------------------------------ Rivales 26/27
export type Rival = {
  id: string; nombre: string; grupo: "MdA" | "MdL"; antes: string[]; sin_rastro: boolean; temporadas_jdm: number; temporadas_disponibles: number; mejor: string;
  t2526?: { nombre: string; distrito: string; grupo: string; pos: number; n: number; g: number; p: number; pf: number; pc: number; rel: number; pct: number; extra: string[]; incomparecencias?: number; aviso?: string } | null;
  h2h: { g: number; p: number; pf: number; pc: number; partidos: { t: string; fecha: string | null; ficha: string; rival: string; fase?: string; pf: number; pc: number; res: "G" | "P"; nota?: string }[] };
  trayectoria: { t: string; nombre: string; distrito: string; fase: string; grupo: string; pos: number | null; n: number | null; pj: number | null; g: number | null; p: number | null; pf: number | null; pc: number | null; hasta: string | null; calculado?: boolean; aviso?: string; incomparecencias?: number }[];
  homonimos: { t: string; aviso: string }[];
  grafico: { t: string; pos?: number | null; n?: number; rel?: number; nombre?: string; grupo?: string; varias?: boolean; aviso?: string }[];
};
export type DatosRivales = { generado: string; fuente: string; lo_esencial: Record<"MdA" | "MdL", string[]>; rivales: Rival[] };
export const RIVALES = rivalesJson as unknown as DatosRivales;

/** Color de camiseta y pantalon de cada rival (para su ficha). */
export function coloresRivales() {
  return Object.fromEntries(RIVALES.rivales.map((r) => [r.id, coloresDe(r.nombre)])) as Record<string, Color | null>;
}

/** Lo de esta temporada de cada rival para su ficha de Rivales 26/27 (D129): puesto, balance, racha y sus partidos,
 *  con los enlaces a las fichas de los equipos y a la pagina de cada partido. Solo datos por equipo (D73). */
export type PartidoFicha = {
  id: string; href: string; jornada: number; fecha: string | null; local: string; visitante: string; hrefLocal: string; hrefVisitante: string;
  pl: number | null; pv: number | null; incomparecencia: boolean;
};
export type TemporadaRival = {
  grupo: Grupo; pos: number | null; equipos: number; pj: number; g: number; p: number; pts: number | null;
  racha: { tipo: "G" | "P"; n: number } | null; ultimos: ("G" | "P")[]; partidos: PartidoFicha[];
};
export function temporadaRivales(): Record<string, TemporadaRival> {
  const r: Record<string, TemporadaRival> = {};
  for (const g of ["G1", "G2"] as const) {
    const G = LIGA.grupos[g];
    for (const [id, e] of Object.entries(G.equipos)) {
      if (e.nuestro) continue;
      const c = G.clasificacion.find((x) => x.id === id);
      r[id] = {
        grupo: g, pos: c?.pos ?? null, equipos: G.clasificacion.length, pj: c?.pj ?? 0, g: c?.g ?? 0, p: c?.p ?? 0, pts: c?.pts ?? null,
        racha: e.racha, ultimos: e.ultimos,
        partidos: G.resultados.filter((x) => x.local_id === id || x.visitante_id === id).map((x) => ({
          id: x.id, href: hrefPartido(x.id), jornada: x.jornada, fecha: x.fecha, local: x.local, visitante: x.visitante,
          hrefLocal: hrefEquipo(g, x.local_id), hrefVisitante: hrefEquipo(g, x.visitante_id), pl: x.pl, pv: x.pv, incomparecencia: !!x.incomparecencia,
        })),
      };
    }
  }
  return r;
}

/** Enlaces de los partidos de MdA y MdL de la temporada de la liga (pestaña Equipo, D129): "<pn>_<EQ>" -> pagina del
 *  partido y ficha del rival. Solo para la temporada en curso (las anteriores no tienen paginas de partido). */
export function enlacesPartidosNuestros(partidos: { pn: number; equipo: "MDA" | "MDL"; fecha: string | null }[]) {
  const r: Record<string, { partido: string; rival: string | null }> = {};
  for (const p of partidos) {
    const x = partidoNuestro(p.equipo, p.fecha);
    if (!x) continue;
    const g: Grupo = p.equipo === "MDA" ? "G1" : "G2";
    const rival = LIGA.grupos[g].equipos[x.local_id]?.nuestro ? x.visitante_id : x.local_id;
    r[`${p.pn}_${p.equipo}`] = { partido: hrefPartido(x.id), rival: hrefEquipo(g, rival) };
  }
  return r;
}

const normalNombre = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
/** Ficha de un equipo por su nombre (los nombres de la liga no se repiten entre grupos). Admite el nombre del
 *  calendario o de las equipaciones ("MEJORADA 2012 C.B..", "Mejorada 2012 C.B."): se compara sin tildes ni puntuacion. */
export function fichaPorNombre(nombre: string | null | undefined, grupo?: Grupo): string | null {
  if (!nombre) return null;
  const n = normalNombre(nombre);
  for (const g of grupo ? [grupo] : (["G1", "G2"] as const)) {
    const e = Object.entries(LIGA.grupos[g].equipos).find(([, x]) => normalNombre(x.nombre) === n);
    if (e) return hrefEquipo(g, e[0]);
  }
  return null;
}
/** Ficha de cada equipo de la liga por su nombre ("Chavalitros" -> href), para pantallas de cliente. */
export function fichasPorNombreSolo(): Record<string, string> {
  const r: Record<string, string> = {};
  for (const g of ["G1", "G2"] as const) for (const [id, e] of Object.entries(LIGA.grupos[g].equipos)) r[e.nombre] = hrefEquipo(g, id);
  return r;
}
