import "server-only";
import { LIGA, NUESTRO_DE, RIVALES, type Grupo } from "@/lib/estadisticas/liga";
import type { DatosLiga } from "@/lib/liga";
import { clavesRival, type HistorialEntrada, type ResultadoClaves } from "./claves";

// Claves del partido de un rival (D174): los partidos del grupo salen de la liga publicada (solo por equipo), los jugadores
// de las hojas (Supabase con sesion, D162) y el historial de Rivales 26/27. Solo se llama con sesion de jugador o gestor.

const norm = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

function historialDe(grupo: Grupo, equipo: string): HistorialEntrada | null {
  const r = RIVALES.rivales.find((x) => x.grupo === NUESTRO_DE[grupo] && norm(x.nombre) === norm(equipo));
  if (!r) return null;
  return { partidos: r.h2h.partidos.map((p) => ({ fecha: p.fecha, pf: p.pf, pc: p.pc, nota: p.nota })), homonimos: r.homonimos.length, sinRastro: r.sin_rastro };
}

/** Claves de un equipo del grupo (que no sea el nuestro), con los datos de la liga ya cargados. */
export function clavesDeEquipo(liga: Pick<DatosLiga, "jugadores" | "filas">, grupo: Grupo, equipo: string, opciones: { topEquipo?: number; topJugadores?: number } = {}): ResultadoClaves {
  return clavesRival({
    equipo, nuestro: NUESTRO_DE[grupo],
    partidos: LIGA.grupos[grupo].resultados,
    jugadores: liga.jugadores.filter((j) => j.grupo === grupo),
    filas: liga.filas.filter((f) => f.grupo === grupo),
    historial: historialDe(grupo, equipo),
  }, opciones);
}

/** Grupo de un equipo por su nombre (los nombres no se repiten entre grupos). */
export function grupoDe(equipo: string): Grupo | null {
  for (const g of ["G1", "G2"] as const) if (Object.values(LIGA.grupos[g].equipos).some((e) => norm(e.nombre) === norm(equipo))) return g;
  return null;
}

/** Claves de un rival escrito como en el calendario o la tabla de eventos («MEJORADA 2012 C.B..»): null si no esta en la liga o es de los nuestros. */
export function clavesPorNombre(liga: Pick<DatosLiga, "jugadores" | "filas">, grupo: Grupo, nombre: string, opciones: { topEquipo?: number; topJugadores?: number } = {}): (ResultadoClaves & { nombreEquipo: string }) | null {
  const e = Object.values(LIGA.grupos[grupo].equipos).find((x) => norm(x.nombre) === norm(nombre));
  if (!e || e.nuestro) return null;
  return { ...clavesDeEquipo(liga, grupo, e.nombre, opciones), nombreEquipo: e.nombre };
}
