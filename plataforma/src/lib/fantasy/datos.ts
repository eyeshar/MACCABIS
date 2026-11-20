import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parametros, type Parametros } from "./reglas";
import type { AlineacionF, Copia, Duelo, JornadaF, Jugador, LogroF, Manager, Movimiento, Porra, PuntoJ, PuntoM } from "./vista";

// MdFantasy (D196): todo lo que pintan las pantallas, leido con la sesion de quien mira (la RLS decide: apagado no llega
// nada; la alineacion y la porra de los demas, solo desde el cierre).

export type EstadoFantasy = {
  acceso: boolean; modo: string | null; person_id: string | null; es_gestor: boolean; es_manager: boolean; elegible: boolean;
  jornada: string | null; primer_partido: string | null; cerrado: boolean; clausulas_cerradas: boolean; gestor_bloqueado: boolean;
  caja: number; equipos: { equipo: string; rival: string | null; inicio: string | null; evento: string }[]; parametros: unknown; ahora: string;
};

export type Fantasy = {
  estado: EstadoFantasy; P: Parametros;
  managers: Manager[]; jugadores: Jugador[]; copias: Copia[]; movimientos: Movimiento[]; jornadas: JornadaF[];
  alineaciones: AlineacionF[]; porras: Porra[]; duelos: Duelo[]; puntosJ: PuntoJ[]; puntosM: PuntoM[]; logros: LogroF[];
  nombreJ: Map<string, string>; nombreM: Map<string, string>;
};

/** null = el juego no existe en esta base (migracion sin aplicar). `estado.acceso === false` = apagado para quien mira. */
export async function cargarFantasy(supabase: SupabaseClient): Promise<Fantasy | { estado: EstadoFantasy } | null> {
  const { data, error } = await supabase.rpc("fantasy_estado");
  if (error) return null;
  const estado = { ...(data as EstadoFantasy), caja: Number((data as EstadoFantasy).caja ?? 0) };
  if (!estado.acceso) return { estado };
  const t = <T,>(tabla: string, orden?: string, asc = true) => {
    const q = supabase.from(tabla).select("*");
    return (orden ? q.order(orden, { ascending: asc }) : q).limit(5000).then((r) => (r.data ?? []) as T[]);
  };
  const [managers, jugadores, copias, movimientos, jornadas, alineaciones, porras, duelos, puntosJ, puntosM, logros] = await Promise.all([
    t<Manager>("fantasy_managers", "alta_en"), t<Jugador>("fantasy_jugadores", "nombre"), t<Copia>("fantasy_copias"),
    t<Movimiento>("fantasy_movimientos", "creado_en", false), t<JornadaF>("fantasy_jornadas", "fecha"),
    t<AlineacionF>("fantasy_alineaciones", "jornada"), t<Porra>("fantasy_porras"), t<Duelo>("fantasy_duelos", "jornada"),
    t<PuntoJ>("fantasy_puntos_jugador", "jornada"), t<PuntoM>("fantasy_puntos_manager", "jornada"), t<LogroF>("fantasy_logros", "jornada", false),
  ]);
  const num = <T extends object>(filas: T[], claves: (keyof T)[]) => filas.map((f) => { const x = { ...f }; for (const k of claves) (x[k] as unknown) = Number(f[k] ?? 0); return x; });
  return {
    estado, P: parametros(estado.parametros),
    managers, jugadores: num(jugadores, ["valor", "media"]), copias: num(copias, ["precio"]), movimientos: num(movimientos, ["importe"]),
    jornadas: jornadas.filter((j) => j.puntuada_en), alineaciones, porras,
    duelos, puntosJ: num(puntosJ, ["rendimiento", "compromiso", "total"]), puntosM: num(puntosM, ["alineacion", "porra", "total", "ingreso"]), logros,
    nombreJ: new Map(jugadores.map((j) => [j.person_id, j.nombre])), nombreM: new Map(managers.map((m) => [m.person_id, m.nombre])),
  };
}

export const esFantasy = (f: Awaited<ReturnType<typeof cargarFantasy>>): f is Fantasy => !!f && "managers" in f;
