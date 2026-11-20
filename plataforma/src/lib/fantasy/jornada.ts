// MdFantasy (D196): de las filas de la base a los puntos de cada jugador en una jornada (un domingo con partido).
// Logica pura. Las filas las da _fantasy_datos_jornada(fecha) (solo el rol de servicio) o, en la simulacion, la misma
// consulta en solo lectura. No entra ningun nivel, posicion ni motivo: solo la hoja, el estado visible de cada respuesta
// (el de v_quien_va), cuando respondio, cuando se le aviso, la convocatoria aprobada y la asistencia real.
import { limiteDudas } from "../avisos/horario.ts";
import { casarNombres, puntosJugador, type LineaPartido, type PuntosJugador, type Unidad } from "./puntos.ts";
import type { Parametros } from "./reglas.ts";

export type DatosJornada = {
  fecha: string;
  jugadores: { person_id: string; nombre_oficial: string; nombre_visible: string }[];   // elegibles: rol jugador y activos
  partidos: { equipo: string; rival: string; pts_favor: number; pts_contra: number; segundos_equipo: number }[];
  lineas: { equipo: string; nombre: string; segundos: number; pts: number; mas_menos: number }[];
  eventos: { id: string; tipo: string; equipo: string; fecha: string; inicio: string | null; oficial: boolean | null }[];
  /** Una fila por evento e invitado: su estado visible y de donde sale. */
  estados: { evento_id: string; person_id: string; estado: string; por: string | null; origen: string | null; cambiado_en: string | null; primera_en: string | null }[];
  avisos: { person_id: string; eventos: string[]; enviado_en: string }[];
  asistencia: { evento_id: string; person_id: string; estado: string }[];
  convocados: string[];
  alias?: Record<string, string>;
};

const dia = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
const ORDEN_ORIGEN = ["jugador", "ausencia", "gestor", "sistema", "defecto"] as const;

function origenDe(e: DatosJornada["estados"][number]): Unidad["origen"] {
  if (e.por === "ausencia") return "ausencia";
  if (e.por === "defecto") return "defecto";
  if (e.estado === "sin_responder") return null;
  if (e.origen === "jugador") return "jugador";
  if (e.origen === "sistema") return "sistema";
  if (e.origen === "gestor") return "gestor";
  // respuestas antiguas importadas (SportEasy): respondio el, pero no se sabe cuando
  return e.origen ? "jugador" : null;
}

function asistenciaDe(estados: string[]): Unidad["asistencia"] {
  if (estados.includes("fue")) return "fue";
  if (estados.includes("sin_excusa")) return "falto";
  if (estados.some((x) => x === "con_excusa" || x === "lesion")) return "excusa";
  return null;
}

/** Las unidades de compromiso de una persona: cada entreno oficial de la semana y el domingo (una sola respuesta). */
export function unidadesDe(personId: string, d: DatosJornada, enHoja: boolean): Unidad[] {
  const mias = d.estados.filter((e) => e.person_id === personId);
  const grupos: { clase: Unidad["clase"]; evs: DatosJornada["eventos"] }[] = [];
  for (const ev of d.eventos.filter((e) => e.tipo === "entreno")) grupos.push({ clase: "entreno", evs: [ev] });
  const liga = d.eventos.filter((e) => e.tipo === "liga" && e.fecha === d.fecha);
  if (liga.length) grupos.push({ clase: "domingo", evs: liga });
  // Un evento sin ninguna respuesta de nadie (los anteriores a responder en la web) no tiene datos: no se puntua la
  // respuesta, ni para bien ni para mal; la asistencia si.
  const conDatos = new Set(d.estados.filter((e) => e.estado !== "sin_responder" || e.por).map((e) => e.evento_id));
  const salida: Unidad[] = [];
  for (const g of grupos) {
    const filas = mias.filter((e) => g.evs.some((ev) => ev.id === e.evento_id));
    if (!filas.length) continue; // no esta invitado
    const ids = filas.map((f) => f.evento_id);
    const conOrigen = filas.map((f) => ({ f, o: origenDe(f) }));
    const sinDatos = !ids.some((id) => conDatos.has(id));
    const origen = sinDatos ? "sin_datos" : ORDEN_ORIGEN.find((o) => conOrigen.some((x) => x.o === o)) ?? null;
    const estado = filas.some((f) => f.estado === "va") ? "va" : filas.find((f) => f.estado !== "sin_responder")?.estado ?? "sin_responder";
    const tiempos = conOrigen.filter((x) => x.o === "jugador").map((x) => x.f.primera_en ?? x.f.cambiado_en).filter(Boolean).map((t) => new Date(t as string).getTime());
    const avisos = d.avisos.filter((a) => a.person_id === personId && a.eventos.some((x) => ids.includes(x))).map((a) => new Date(a.enviado_en).getTime());
    const primero = g.evs.find((ev) => ids.includes(ev.id)) ?? g.evs[0];
    salida.push({
      clase: g.clase, eventos: ids,
      texto: g.clase === "entreno" ? `Entreno ${dia(primero.fecha)}` : `Domingo ${dia(d.fecha)}`,
      plazo: limiteDudas({ tipo: primero.tipo, fecha: primero.fecha, inicio: primero.inicio, oficial: primero.oficial ?? true }),
      estado, origen,
      // sin hora (respuesta importada): cuenta como respondida a tiempo, nunca como rapida
      respondidoEn: origen === "jugador" ? new Date(tiempos.length ? Math.min(...tiempos) : 0) : null,
      avisoEn: avisos.length ? new Date(Math.min(...avisos)) : null,
      asistencia: asistenciaDe(d.asistencia.filter((a) => a.person_id === personId && ids.includes(a.evento_id)).map((a) => a.estado)),
      convocado: d.convocados.includes(personId), enHoja,
    });
  }
  return salida;
}

export type ResultadoJornada = {
  puntos: Map<string, PuntosJugador>;
  sinCasar: string[]; aproximados: string[];
  /** Para la porra: por equipo, si gano. */
  resultados: Record<string, "gana" | "pierde">;
  /** Convocados (convocatoria aprobada) que no salen en la hoja: se pregunta a los gestores. */
  convocadosSinHoja: string[];
};

export function puntuarJornada(d: DatosJornada, P: Parametros): ResultadoJornada {
  const { mapa, sinCasar, aproximados } = casarNombres(d.lineas.map((l) => l.nombre), d.jugadores, d.alias ?? {});
  const lineasDe = new Map<string, LineaPartido[]>();
  for (const l of d.lineas) {
    const id = mapa.get(l.nombre);
    const p = d.partidos.find((x) => x.equipo === l.equipo);
    if (!id || !p) continue;
    lineasDe.set(id, [...(lineasDe.get(id) ?? []), { equipo: l.equipo, pts: l.pts, segundos: l.segundos, masMenos: l.mas_menos, ptsFavor: p.pts_favor, ptsContra: p.pts_contra, segundosEquipo: p.segundos_equipo }]);
  }
  const puntos = new Map<string, PuntosJugador>();
  const convocadosSinHoja: string[] = [];
  for (const j of d.jugadores) {
    const lineas = lineasDe.get(j.person_id) ?? [];
    const enHoja = lineas.some((l) => l.segundos > 0);
    const convocado = d.convocados.includes(j.person_id);
    if (convocado && !enHoja) convocadosSinHoja.push(j.person_id);
    const unidades = unidadesDe(j.person_id, d, enHoja).map((u) => (u.respondidoEn && u.respondidoEn.getTime() === 0 ? { ...u, respondidoEn: u.plazo, avisoEn: new Date(u.plazo.getTime() - 1e12) } : u));
    puntos.set(j.person_id, puntosJugador(lineas, unidades, convocado, P));
  }
  const resultados: ResultadoJornada["resultados"] = {};
  for (const p of d.partidos) resultados[p.equipo] = p.pts_favor > p.pts_contra ? "gana" : "pierde";
  return { puntos, sinCasar, aproximados, resultados, convocadosSinHoja };
}
