import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import jornadasAjenas from "@/data/jornadasAjenas.json";
import { claveEquipo, cargarClasificacion, cargarPartidos } from "./liga";
import type { EquipoLiga, FilaClasificacion, GrupoLiga, ResultadoLiga } from "./estadisticas/liga";
import type { JornadasAjenas } from "./gruposLiga";

// Liga › Clasificacion de un grupo ajeno (G3-G6, fix/visibilidad-movil): la misma pantalla que G1/G2, pero SOLO con sesion
// (D184/D186): sus marcadores y su clasificacion salen de Supabase (RLS, puede_ver_liga()), nunca de data/ ni de la pagina
// publica, que sigue siendo solo de G1 y G2. Clasificacion: la calculada que carga db:liga (liga_clasificacion); resultados
// por jornada: liga_partidos, mas los huecos del fichero de jornadas (sin hoja o incomparecencia, sin marcador inventado)
// mientras no haya partido cargado de ese emparejamiento. Si un hueco se carga despues (p. ej. un marcador sacado del acta),
// sale como partido y entra en la clasificacion en cuanto lo cargue db:liga.

/** Un hueco del fichero de jornadas, como resultado sin marcador. */
export type ResultadoAjeno = ResultadoLiga & { hueco?: "sin_hoja" | "incomparecencia" | string };
export type GrupoAjeno = Omit<GrupoLiga, "nuestro" | "resultados"> & { grupo: string; resultados: ResultadoAjeno[]; sinJornada: number };

const AJENAS = jornadasAjenas as JornadasAjenas;

export async function cargarGrupoAjeno(supabase: SupabaseClient, grupo: string, nombre: string): Promise<GrupoAjeno | null> {
  const [clas, partidos] = await Promise.all([cargarClasificacion(supabase, [grupo]), cargarPartidos(supabase, [grupo])]);
  if (!clas.length) return null;
  const id = (equipo: string) => claveEquipo(equipo);
  const nombreDe = (n: string) => clas.find((c) => claveEquipo(c.equipo) === claveEquipo(n))?.equipo ?? n;
  const clasificacion: FilaClasificacion[] = clas.map((c) => ({
    pos: c.pos, id: id(c.equipo), equipo: c.equipo, nuestro: false, pj: c.pj, g: c.g, p: c.p, pf: c.pf, pc: c.pc, dif: c.pf - c.pc, pts: c.pts,
  }));
  const conJornada = partidos.filter((p) => p.jornada != null);
  const resultados: ResultadoAjeno[] = conJornada.map((p) => ({
    id: p.id, jornada: p.jornada as number, fecha: p.fecha, local: nombreDe(p.local), local_id: id(p.local), visitante: nombreDe(p.visitante), visitante_id: id(p.visitante),
    pl: p.pts_local, pv: p.pts_visitante,
  }));
  const par = (a: string, b: string) => [claveEquipo(a), claveEquipo(b)].sort().join("|");
  const cargados = new Set(resultados.map((r) => `${r.jornada}:${par(r.local, r.visitante)}`));
  const descansan: Record<string, string[]> = {};
  for (const j of AJENAS.jornadas.filter((x) => x.grupo === grupo)) {
    if (j.descansa) descansan[String(j.jornada)] = [nombreDe(j.descansa)];
    for (const h of j.huecos) {
      if (cargados.has(`${j.jornada}:${par(h.local, h.visitante)}`)) continue;   // ya cargado: sale como partido
      resultados.push({
        id: `hueco-${grupo}-${j.jornada}-${claveEquipo(h.local)}`, jornada: j.jornada, fecha: null, local: nombreDe(h.local), local_id: id(h.local),
        visitante: nombreDe(h.visitante), visitante_id: id(h.visitante), pl: null, pv: null, hueco: h.motivo, incomparecencia: h.motivo === "incomparecencia",
      });
    }
  }
  const jornadas = [...new Set(resultados.map((r) => r.jornada))].sort((a, b) => a - b);
  // Ficha por equipo: medias, racha y ultimos con los partidos con marcador (tambien los que llegaron sin jornada).
  const equipos: Record<string, EquipoLiga> = {};
  for (const c of clasificacion) {
    const suyos = partidos
      .filter((p) => p.pts_local != null && p.pts_visitante != null && (claveEquipo(p.local) === c.id || claveEquipo(p.visitante) === c.id))
      .sort((a, b) => (a.jornada ?? 99) - (b.jornada ?? 99) || (a.fecha ?? "").localeCompare(b.fecha ?? ""));
    const lineas = suyos.map((p) => (claveEquipo(p.local) === c.id ? { f: p.pts_local!, e: p.pts_visitante! } : { f: p.pts_visitante!, e: p.pts_local! }));
    const n = lineas.length;
    const media = (k: "f" | "e") => (n ? Math.round((10 * lineas.reduce((s, x) => s + x[k], 0)) / n) / 10 : null);
    const ultimos = lineas.map((x) => (x.f > x.e ? "G" : "P") as "G" | "P");
    let racha: EquipoLiga["racha"] = null;
    if (ultimos.length) {
      const tipo = ultimos[ultimos.length - 1];
      let k = 0;
      for (let i = ultimos.length - 1; i >= 0 && ultimos[i] === tipo; i--) k++;
      racha = { tipo, n: k };
    }
    const mpf = media("f"), mpc = media("e");
    equipos[c.id] = { id: c.id, nombre: c.equipo, nuestro: false, media_pf: mpf, media_pc: mpc, media_dif: mpf != null && mpc != null ? Math.round(10 * (mpf - mpc)) / 10 : null, ultimos: ultimos.slice(-5), racha };
  }
  return {
    grupo, nombre, jornadas_cargadas: jornadas, clasificacion, resultados, descansan, equipos,
    orden_provisional: clas.some((c) => c.pts == null), sinJornada: partidos.length - conJornada.length,
  };
}
