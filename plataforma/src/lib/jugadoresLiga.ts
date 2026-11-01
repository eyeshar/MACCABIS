// Datos por jugador de la liga y utilidades puras (sin servidor ni dependencias, para usarlas desde pantallas y pruebas).
// Solo lo que trae la hoja de la FBM: puntos, 2P y 3P ANOTADOS (no hay intentos de campo), tiros libres anotados/intentados,
// faltas COMETIDAS (no hay recibidas) y minutos. Nada se estima. Son datos de terceros: solo gestores (D73).

export type JugadorLiga = {
  grupo: string; equipo: string; nombre: string; dorsal: string;
  pj: number; segundos: number; pts: number; p2a: number; p3a: number; tla: number; tli: number; faltas: number;
  dorsales?: string[];    // todos los dorsales que ha llevado, de menor a mayor (D168)
};

export const NUESTROS = ["MdA", "MdL"] as const;

/** Una fila de la hoja de un partido (liga_estadisticas_jugador con el grupo y la jornada de su partido). */
export type FilaHoja = {
  partido_id: string; grupo: string; jornada: number; equipo: string; dorsal: string; nombre: string;
  segundos: number; pts: number; p2a: number; p3a: number; tla: number; tli: number; faltas: number;
};

/** Dos jugadores con el mismo nombre normalizado y dorsales distintos en el MISMO partido: son dos personas (D168). */
export type Conflicto = { grupo: string; equipo: string; jornada: number; nombre: string; dorsales: string[] };

/** Nombre sin tildes, en minusculas y con espacios y puntuacion colapsados: «MIRAGAYA GONZÁLEZ, ALBERTO» y
 *  «Miragaya Gonzalez , Alberto» dan lo mismo. Es la identidad de un jugador dentro de su equipo (D168). */
export const claveNombre = (n: string) => n.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** De varias escrituras del mismo nombre, la mas completa: la que trae mas tildes y, a igualdad, la primera. */
function masCompleto(variantes: string[]) {
  const tildes = (n: string) => n.normalize("NFD").length - n.normalize("NFD").replace(/\p{Diacritic}/gu, "").length;
  return variantes.reduce((a, b) => (tildes(b) > tildes(a) ? b : a));
}

/**
 * Acumulado por jugador (D168): identidad = grupo + equipo + nombre normalizado; el dorsal NO cuenta (puede cambiar de un
 * partido a otro y dos personas distintas pueden llevar el mismo). Suma PJ (partidos con minutos), minutos, puntos, 2P, 3P,
 * TL y faltas; guarda todos los dorsales usados y el nombre en su forma mas completa. Si el mismo nombre sale dos veces en un
 * partido con dorsales distintos, son dos personas: ese nombre se separa por dorsal y se avisa. Quien figura en las hojas sin
 * haber jugado ningun minuto no sale.
 */
export function agruparJugadores(filas: FilaHoja[]): { jugadores: JugadorLiga[]; conflictos: Conflicto[] } {
  const base = (f: FilaHoja) => `${f.grupo}|${f.equipo}|${claveNombre(f.nombre)}`;
  const enPartido = new Map<string, FilaHoja[]>();
  for (const f of filas) { const k = `${base(f)}|${f.partido_id}`; enPartido.set(k, [...(enPartido.get(k) ?? []), f]); }
  const conflictos: Conflicto[] = [];
  const separar = new Set<string>();
  for (const v of enPartido.values()) {
    const dorsales = [...new Set(v.map((f) => f.dorsal))].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
    if (dorsales.length < 2) continue;
    separar.add(base(v[0]));
    conflictos.push({ grupo: v[0].grupo, equipo: v[0].equipo, jornada: v[0].jornada, nombre: v[0].nombre, dorsales });
  }
  const grupos = new Map<string, FilaHoja[]>();
  for (const f of [...filas].sort((a, b) => a.jornada - b.jornada)) {
    const k = separar.has(base(f)) ? `${base(f)}|#${f.dorsal}` : base(f);
    grupos.set(k, [...(grupos.get(k) ?? []), f]);
  }
  const jugadores: JugadorLiga[] = [];
  for (const v of grupos.values()) {
    const suma = (k: "segundos" | "pts" | "p2a" | "p3a" | "tla" | "tli" | "faltas") => v.reduce((s, f) => s + f[k], 0);
    const pj = new Set(v.filter((f) => f.segundos > 0).map((f) => f.partido_id)).size;
    if (!pj) continue;
    const dorsales = [...new Set(v.map((f) => f.dorsal))].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
    jugadores.push({
      grupo: v[0].grupo, equipo: v[0].equipo, nombre: masCompleto(v.map((f) => f.nombre)), dorsal: dorsales[0], dorsales,
      pj, segundos: suma("segundos"), pts: suma("pts"), p2a: suma("p2a"), p3a: suma("p3a"), tla: suma("tla"), tli: suma("tli"), faltas: suma("faltas"),
    });
  }
  return { jugadores, conflictos };
}

/** «#9 / #16» (o el unico dorsal). */
export const textoDorsales = (j: Pick<JugadorLiga, "dorsal" | "dorsales">) => (j.dorsales?.length ? j.dorsales : [j.dorsal]).map((d) => `#${d}`).join(" / ");

/**
 * Minimo de partidos para las medias (D169): la mitad de los partidos de su equipo, redondeando hacia arriba, o 2 partidos,
 * lo que sea menor (y al menos 1). Asi quien jugo un solo partido no lidera por suerte.
 */
export const minimoPartidos = (pjEquipo: number) => Math.max(1, Math.min(Math.ceil(pjEquipo / 2), 2));

const mediaPts = (j: JugadorLiga) => (j.pj ? j.pts / j.pj : 0);
/** Orden por media de puntos por partido; a igualdad, mas puntos, menos partidos y el nombre. */
export const porMediaPts = (a: JugadorLiga, b: JugadorLiga) =>
  mediaPts(b) - mediaPts(a) || b.pts - a.pts || a.pj - b.pj || a.nombre.localeCompare(b.nombre, "es");

/** «Más peligrosos» de un equipo (D169): los que llegan al minimo de partidos, por media de puntos por partido. */
export function masPeligrosos(jugadores: JugadorLiga[], pjEquipo: number, n = 3) {
  const min = minimoPartidos(pjEquipo);
  return jugadores.filter((j) => j.pj >= min).sort(porMediaPts).slice(0, n);
}

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
  const mda = new Set(jugadores.filter((j) => j.equipo === "MdA").map((j) => claveNombre(j.nombre)));
  const mdl = new Set(jugadores.filter((j) => j.equipo === "MdL").map((j) => claveNombre(j.nombre)));
  // las escrituras de los dos lados (pueden diferir en tildes)
  return new Set(jugadores.filter((j) => (NUESTROS as readonly string[]).includes(j.equipo) && mda.has(claveNombre(j.nombre)) && mdl.has(claveNombre(j.nombre))).map((j) => j.nombre));
}

/** Una persona que sale con MdA y con MdL cuenta UNA vez (suma de las dos fichas), con equipo "MdA + MdL". */
export function unirDoblan(jugadores: JugadorLiga[]): JugadorLiga[] {
  const dobla = quienDobla(jugadores);
  const salida: JugadorLiga[] = [];
  const unidos = new Map<string, JugadorLiga>();
  for (const j of jugadores) {
    if (!dobla.has(j.nombre) || !(NUESTROS as readonly string[]).includes(j.equipo)) { salida.push(j); continue; }
    const u = unidos.get(claveNombre(j.nombre));
    if (!u) { unidos.set(claveNombre(j.nombre), { ...j, equipo: "MdA + MdL", grupo: "G1+G2" }); continue; }
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
  minPartidos: number;    // minimo "automatico" para clasificar por medias (minimoPartidos, D169)
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
      minPartidos: dobla ? 1 : minimoPartidos(pjEquipo.get(`${j.grupo}|${j.equipo}`) ?? 0),
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
      minPartidos: minimoPartidos(pjEquipo.get(`${j.grupo}|${j.equipo}`) ?? 0),
    };
  });
}
