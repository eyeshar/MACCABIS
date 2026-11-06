// Registro de no convocados (regla 4.3 de docs/REGLAS_CONVOCATORIA.md): funciones PURAS, sin imports de valores ni acceso a
// datos (`node` carga este fichero tal cual en las pruebas). No hay tabla: se calcula cada vez con lo que ya hay en la base
// (convocatorias aprobadas, respuestas a los partidos de liga y fichas) y las hojas de estadística. SOLO GESTORES: el
// resultado nunca va a una página, API, aviso ni mensaje que vea un jugador o alguien sin sesión (barrera (h)).
//
// Cada domingo de liga ya jugado, para cada jugador:
//   - «suma»: dijo «voy» A TIEMPO (antes del cierre del martes a las 12:00, D173) a un partido de ese domingo con un equipo
//     del que tiene ficha, y no entró en ningún equipo ese domingo;
//   - «convocado»: entró en algún equipo (convocatoria aprobada o, si no la hay, las hojas de estadística): la racha vuelve a 0;
//   - el resto no suma ni corta la racha: no dijo «voy», dijo «voy» tarde, «voy» sin ficha, «solo entreno» (los dos tipos),
//     sancionado ese domingo, o ese domingo no hay de dónde saber quién entró.
// Racha = domingos «suma» seguidos desde el más reciente hasta el último «convocado». Total = domingos «suma» de la temporada.

export type EquipoReg = "MdA" | "MdL";

/** Un domingo de liga ya jugado. `convocados`: quién entró en algún equipo; null si no hay convocatoria aprobada ni hojas. */
export type DomingoReg = {
  fecha: string;
  jornada: number | null;
  /** Fin del plazo para responder a tiempo (ISO): el martes de esa semana a las 12:00 (limiteDudas, D173). */
  cierre: string;
  convocados: string[] | null;
  /** De dónde sale quién entró: «convocatoria» (aprobada), «hojas» (de estadística) o las dos. */
  fuente: "convocatoria" | "hojas" | "convocatoria y hojas" | null;
};

/** Respuesta a un partido de liga de ese domingo. `origen` «sporteasy»: importada antes de la web, sin hora real: a tiempo. */
export type RespuestaReg = { fecha: string; equipo: EquipoReg; person_id: string; respuesta: string; cambiado_en: string | null; origen: string | null };

export type JugadorReg = {
  person_id: string;
  ficha: Record<EquipoReg, boolean>;
  /** Rol «solo entreno» o la marca privada «solo entreno: nunca a partidos» (D146): no suman nunca. */
  soloEntreno: boolean;
  /** Sancionado hasta esta jornada incluida (D51), o null. */
  sancionadoHasta: number | null;
};

export type EstadoDomingo = "suma" | "convocado" | "tarde" | "no_disponible" | "sin_ficha" | "solo_entreno" | "sancionado" | "sin_datos";
export const TEXTO_ESTADO_DOMINGO: Record<EstadoDomingo, string> = {
  suma: "dijo «voy» a tiempo y no entró: suma 1",
  convocado: "convocado: la racha vuelve a 0",
  tarde: "dijo «voy» después del cierre: no suma",
  no_disponible: "no dijo «voy»: no cuenta",
  sin_ficha: "dijo «voy» sin ficha de ese equipo: no cuenta",
  solo_entreno: "solo entreno: no suma",
  sancionado: "sancionado: no cuenta",
  sin_datos: "sin convocatoria aprobada ni hojas: no cuenta",
};

export type DomingoJugador = { fecha: string; jornada: number | null; estado: EstadoDomingo; fuente: DomingoReg["fuente"] };
export type RegistroJugador = { person_id: string; racha: number; total: number; soloEntreno: boolean; domingos: DomingoJugador[] };

/** ¿Respondió a tiempo? Las importadas (SportEasy, sin hora de respuesta) y las que no tienen hora cuentan como a tiempo. */
export const aTiempo = (r: Pick<RespuestaReg, "cambiado_en" | "origen">, cierre: string) =>
  r.origen === "sporteasy" || !r.cambiado_en || new Date(r.cambiado_en).getTime() <= new Date(cierre).getTime();

export function estadoDomingo(j: JugadorReg, d: DomingoReg, respuestas: RespuestaReg[]): EstadoDomingo {
  if (d.convocados?.includes(j.person_id)) return "convocado";
  const voy = respuestas.filter((r) => r.fecha === d.fecha && r.person_id === j.person_id && r.respuesta === "va");
  if (!voy.length) return "no_disponible";
  const conFicha = voy.filter((r) => j.ficha[r.equipo]);
  if (!conFicha.length) return "sin_ficha";
  if (j.soloEntreno) return "solo_entreno";
  if (j.sancionadoHasta != null && d.jornada != null && j.sancionadoHasta >= d.jornada) return "sancionado";
  if (d.convocados == null) return "sin_datos";
  if (!conFicha.some((r) => aTiempo(r, d.cierre))) return "tarde";
  return "suma";
}

/** El registro de todos los jugadores con los domingos dados (cualquier orden). Los domingos van del más reciente al más
 *  antiguo en cada jugador. */
export function registroNoConvocados(domingos: DomingoReg[], respuestas: RespuestaReg[], jugadores: JugadorReg[]): Map<string, RegistroJugador> {
  const orden = [...domingos].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  const out = new Map<string, RegistroJugador>();
  for (const j of jugadores) {
    const lista = orden.map((d) => ({ fecha: d.fecha, jornada: d.jornada, estado: estadoDomingo(j, d, respuestas), fuente: d.fuente }));
    let racha = 0;
    for (const x of lista) {
      if (x.estado === "convocado") break;
      if (x.estado === "suma") racha++;
    }
    out.set(j.person_id, { person_id: j.person_id, racha, total: lista.filter((x) => x.estado === "suma").length, soloEntreno: j.soloEntreno, domingos: lista });
  }
  return out;
}

/** «Quién lleva más tiempo fuera»: los que tienen racha o total, por racha, total y nombre; los «solo entreno» detrás. */
export function masTiempoFuera<T extends { person_id: string; nombre: string }>(registro: Map<string, RegistroJugador>, jugadores: T[]) {
  return jugadores
    .map((j) => ({ ...j, reg: registro.get(j.person_id) }))
    .filter((x): x is T & { reg: RegistroJugador } => !!x.reg && (x.reg.racha > 0 || x.reg.total > 0))
    .sort((a, b) => Number(a.reg.soloEntreno) - Number(b.reg.soloEntreno) || b.reg.racha - a.reg.racha || b.reg.total - a.reg.total || a.nombre.localeCompare(b.nombre, "es"));
}

/** El interruptor del desempate (regla 4.3): solo «1» lo enciende. Se lee en el servidor. */
export const desempateEncendido = (valor: string | undefined | null) => valor === "1";
