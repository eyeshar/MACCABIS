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
export type ResultadoLiga = { jornada: number; fecha: string | null; local: string; visitante: string; pl: number | null; pv: number | null; incomparecencia?: boolean; no_presentado?: string };
export type Bloque = { pj: number; g: number; p: number; pf: number; pc: number; media_pf: number | null; media_pc: number | null };
export type EquipoLiga = {
  id: string; nombre: string; nuestro: boolean; media_pf: number | null; media_pc: number | null; media_dif: number | null;
  ultimos: ("G" | "P")[]; racha: { tipo: "G" | "P"; n: number } | null; casa: Bloque; fuera: Bloque;
};
export type GrupoLiga = {
  nombre: string; nuestro: "MDA" | "MDL"; jornadas_cargadas: number[]; orden_provisional?: boolean;
  clasificacion: FilaClasificacion[]; resultados: ResultadoLiga[]; descansan: Record<string, string[]>; equipos: Record<string, EquipoLiga>;
};
export const LIGA = ligaJson as unknown as { generado: string; grupos: Record<Grupo, GrupoLiga> };

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
