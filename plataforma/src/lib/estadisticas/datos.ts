import "server-only";
import { cache } from "react";
import indiceJson from "@/data/estadisticas/index.json";
import { metricasDe, type FilaBox, type JugadorEst, type Metricas, type PartidoEst, type QStats } from "./calculo";

// Datos de las estadisticas por temporada (migracion de GitHub Pages). La fuente unica sigue siendo data/season_<t>.json
// (npm run jornada / build:datos); aqui se leen las copias de src/data/estadisticas/ que hace npm run datos:sync.
// Nada de un segundo pipeline. Cada fichero se importa de forma dinamica: solo se carga la temporada que se pide.

export type TemporadaIndice = { id: string; label: string; file: string };
export const INDICE = indiceJson as unknown as { seasons: TemporadaIndice[]; default: string };
export const TEMPORADAS = INDICE.seasons;
export const TEMPORADA_POR_DEFECTO = INDICE.default;
export const esTemporada = (id: string) => TEMPORADAS.some((s) => s.id === id);

export type MdaResumen = {
  nota: string;
  metrics: { pts?: boolean; tl?: boolean; p3?: boolean; min?: boolean; asistencia?: boolean; cuartos?: boolean; fc?: boolean; val?: boolean; pm?: boolean };
  jugadores: {
    mote?: string; display: string; nombre?: string; person_id?: string; no_jugador?: boolean; catalogado?: boolean; sospechoso?: string[];
    pts?: number | null; avg_pts?: number | null; p3?: number | null; tl?: number | null; tl_pct?: number | null; min?: number | null;
    pts_min?: number | null; avg_pm?: number | null; asist_partidos?: number | null; asist_entrenos?: number | null;
  }[];
  cuartos?: { q: (number | null)[] }[];
  anomalias?: unknown[];
};

export type Temporada = {
  season: string;
  label: string;
  fuente?: string;
  metrics?: Partial<Metricas>;
  partidos: PartidoEst[];
  players: (JugadorEst & { asist_part?: Asistencia | null; asist_entr?: Asistencia | null; games?: JuegoJugador[] })[];
  box: Record<string, FilaBox[]>;
  qstats?: Record<string, QStats> | null;
  mda_resumen?: MdaResumen | null;
};
export type Asistencia = { fueron: number | null; total: number | null; pct: number | null };
export type JuegoJugador = {
  pn: number; eq: "MDA" | "MDL"; rival: string | null; local?: boolean; sec: number | null; played: boolean; pts: number | null;
  p2a: number | null; p2i: number | null; p3a: number | null; p3i: number | null; tla: number | null; tli: number | null;
  fc: number | null; val: number | null; pm: number | null;
};

const CARGAS: Record<string, () => Promise<{ default: unknown }>> = {
  "2013-14": () => import("@/data/estadisticas/season_2013-14.json"),
  "2014-15": () => import("@/data/estadisticas/season_2014-15.json"),
  "2015-16": () => import("@/data/estadisticas/season_2015-16.json"),
  "2017-18": () => import("@/data/estadisticas/season_2017-18.json"),
  "2018-19": () => import("@/data/estadisticas/season_2018-19.json"),
  "2019-20": () => import("@/data/estadisticas/season_2019-20.json"),
  "2020-21": () => import("@/data/estadisticas/season_2020-21.json"),
  "2021-22": () => import("@/data/estadisticas/season_2021-22.json"),
  "2023-24": () => import("@/data/estadisticas/season_2023-24.json"),
  "2024-25": () => import("@/data/estadisticas/season_2024-25.json"),
  "2025-26": () => import("@/data/estadisticas/season_2025-26.json"),
  "2026-27": () => import("@/data/estadisticas/season_2026-27.json"),
};

/** Una temporada completa (null si no existe). Se guarda en cache durante la peticion. */
export const cargarTemporada = cache(async (id: string): Promise<Temporada | null> => {
  const carga = CARGAS[id];
  if (!carga || !esTemporada(id)) return null;
  return (await carga()).default as unknown as Temporada;
});

/** Pestañas de estadisticas de una temporada, segun lo que recogia la liga (igual que applySeasonUI de la web anterior). */
export const PESTANAS = ["equipo", "jugadores", "rankings", "cuartos", "asistencia", "mda"] as const;
export type Pestana = (typeof PESTANAS)[number];
export const TEXTO_PESTANA: Record<Pestana, string> = {
  equipo: "Equipo", jugadores: "Jugadores", rankings: "Rankings", cuartos: "Por cuartos", asistencia: "Asistencia", mda: "MdA",
};

export function pestanasDe(t: Temporada): Pestana[] {
  const M = metricasDe(t.metrics);
  return PESTANAS.filter((p) => (p === "cuartos" ? !!t.qstats : p === "asistencia" ? M.asistencia : p === "mda" ? !!t.mda_resumen : true));
}

/** Equipos que juegan esa temporada (con doble ficha se ofrece el selector Combinado / MdA / MdL). */
export const equiposDe = (t: Temporada) => [...new Set(t.partidos.map((p) => p.equipo))];

/** Temporadas en las que aparece cada persona (por person_id), con estadisticas de jugador. Se calcula una vez por proceso. */
let INDICE_PERSONAS: Promise<Map<string, string[]>> | null = null;
export function temporadasDePersona(personId: string): Promise<string[]> {
  INDICE_PERSONAS ??= (async () => {
    const m = new Map<string, string[]>();
    for (const s of TEMPORADAS) {
      const t = await cargarTemporada(s.id);
      for (const p of t?.players ?? []) m.set(p.person_id, [...(m.get(p.person_id) ?? []), s.id]);
    }
    return m;
  })();
  return INDICE_PERSONAS.then((m) => m.get(personId) ?? []);
}
