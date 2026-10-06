// Datos por jugador de la liga y utilidades puras (sin servidor ni dependencias, para usarlas desde pantallas y pruebas).
// Solo lo que trae la hoja de la FBM: puntos, 2P y 3P ANOTADOS (no hay intentos de campo), tiros libres anotados/intentados,
// faltas COMETIDAS (no hay recibidas) y minutos. Nada se estima. Son datos de terceros: solo gestores (D73).

export type JugadorLiga = {
  grupo: string; equipo: string; nombre: string; dorsal: string;
  pj: number; segundos: number; pts: number; p2a: number; p3a: number; tla: number; tli: number; faltas: number;
};

export const NUESTROS = ["MdA", "MdL"] as const;

const MINUSCULAS = new Set(["de", "del", "la", "las", "los", "y", "da", "dos", "do"]);
/** "SANDU SOTOLONGO , DARIUS" -> "Sandu Sotolongo, Darius" (de/del/la... en minuscula salvo al empezar) */
export function bonito(nombre: string) {
  return nombre.toLowerCase().replace(/\s+/g, " ").replace(/\s+,/g, ",").trim()
    .replace(/(^|[\s,.'-])(\p{L}[\p{L}]*)/gu, (_m, a: string, w: string, off: number) =>
      a + (off > 0 && MINUSCULAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)));
}

export const mmss = (seg: number) => { const t = Math.round(seg); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
export const dec = (v: number | null | undefined, n = 1) =>
  v === null || v === undefined || !Number.isFinite(v) ? "–" : v.toFixed(n).replace(".", ",");

/** Nombres de nuestros jugadores que salen con MdA y con MdL ("doblan"), segun las hojas. */
export function quienDobla(jugadores: JugadorLiga[]) {
  const mda = new Set(jugadores.filter((j) => j.equipo === "MdA").map((j) => j.nombre));
  return new Set(jugadores.filter((j) => j.equipo === "MdL" && mda.has(j.nombre)).map((j) => j.nombre));
}

/** Una persona que sale con MdA y con MdL cuenta UNA vez (suma de las dos fichas), con equipo "MdA + MdL". */
export function unirDoblan(jugadores: JugadorLiga[]): JugadorLiga[] {
  const dobla = quienDobla(jugadores);
  const salida: JugadorLiga[] = [];
  const unidos = new Map<string, JugadorLiga>();
  for (const j of jugadores) {
    if (!dobla.has(j.nombre) || !(NUESTROS as readonly string[]).includes(j.equipo)) { salida.push(j); continue; }
    const u = unidos.get(j.nombre);
    if (!u) { unidos.set(j.nombre, { ...j, equipo: "MdA + MdL", grupo: "G1+G2" }); continue; }
    for (const k of ["pj", "segundos", "pts", "p2a", "p3a", "tla", "tli", "faltas"] as const) u[k] += j[k];
  }
  return [...salida, ...unidos.values()];
}

/** Fila de la tabla "Todos los jugadores": una persona, con los equipos y grupos en que sale. */
export type FilaTabla = JugadorLiga & {
  equipos: string[];      // ["Craps"] | ["MdA", "MdL"] si dobla
  grupos: string[];       // ["G2"] | ["G1", "G2"] si dobla
  dobla: boolean;
  nuestro: boolean;       // MdA, MdL o ambos
  soloFicha?: string;     // un doblador visto con un filtro de grupo/equipo: solo la ficha de "MdA" o de "MdL"
  minPartidos: number;    // minimo "automatico" para clasificar por medias: la mitad de los partidos de su equipo (al menos 1)
};

export function filasTabla(jugadores: JugadorLiga[], pjEquipo: Map<string, number>): FilaTabla[] {
  return unirDoblan(jugadores).map((j) => {
    const dobla = j.grupo === "G1+G2";
    return {
      ...j,
      equipos: dobla ? ["MdA", "MdL"] : [j.equipo],
      grupos: dobla ? ["G1", "G2"] : [j.grupo],
      dobla,
      nuestro: (NUESTROS as readonly string[]).includes(j.equipo) || dobla,
      minPartidos: dobla ? 1 : Math.max(1, Math.ceil((pjEquipo.get(`${j.grupo}|${j.equipo}`) ?? 0) / 2)),
    };
  });
}

/**
 * Las fichas SIN sumar: una fila por (equipo, persona). Los dobladores llevan «dobla» y `soloFicha` ("MdA" o "MdL"); se usan
 * cuando la tabla esta filtrada por grupo o equipo (D73): ahi se ve solo la ficha de ese grupo o equipo.
 */
export function filasFichas(jugadores: JugadorLiga[], pjEquipo: Map<string, number>): FilaTabla[] {
  const dobla = quienDobla(jugadores);
  return jugadores.map((j) => {
    const esDobla = dobla.has(j.nombre) && (NUESTROS as readonly string[]).includes(j.equipo);
    return {
      ...j,
      equipos: [j.equipo],
      grupos: [j.grupo],
      dobla: esDobla,
      soloFicha: esDobla ? j.equipo : undefined,
      nuestro: (NUESTROS as readonly string[]).includes(j.equipo),
      minPartidos: Math.max(1, Math.ceil((pjEquipo.get(`${j.grupo}|${j.equipo}`) ?? 0) / 2)),
    };
  });
}
