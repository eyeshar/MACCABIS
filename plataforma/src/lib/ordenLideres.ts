// Orden de las listas de lideres individuales de la liga. Deterministas: ante cualquier empate el desenlace final es el
// nombre y luego el equipo, asi el mismo dato da SIEMPRE el mismo orden. Sin dependencias para poder probarlo con node.

export type Lider = {
  nombre: string; equipo: string; pj: number; pts: number; p3a: number; tla: number; tli: number; faltas: number;
};

const texto = (a: Lider, b: Lider) => a.nombre.localeCompare(b.nombre, "es") || a.equipo.localeCompare(b.equipo, "es");
const media = (j: Lider) => (j.pj ? j.pts / j.pj : 0);
const pctTL = (j: Lider) => (j.tli ? j.tla / j.tli : 0);

/** Puntos: mas puntos; a igualdad, mas media; luego nombre. */
export const porPuntos = (a: Lider, b: Lider) => b.pts - a.pts || media(b) - media(a) || texto(a, b);
/** Media: mayor media; a igualdad, mas puntos; luego nombre. */
export const porMedia = (a: Lider, b: Lider) => media(b) - media(a) || b.pts - a.pts || texto(a, b);
/** Triples: mas triples; a igualdad, mas puntos; luego nombre. */
export const porTriples = (a: Lider, b: Lider) => b.p3a - a.p3a || b.pts - a.pts || texto(a, b);
/** Tiros libres: mas anotados; a igualdad, mayor porcentaje; luego menos intentados; luego nombre. */
export const porTirosLibres = (a: Lider, b: Lider) => b.tla - a.tla || pctTL(b) - pctTL(a) || a.tli - b.tli || texto(a, b);
/**
 * Faltas: mas faltas; a igualdad, MENOS partidos jugados (las mismas faltas en menos partidos son mas faltas por partido; por eso
 * quien dobla y suma dos fichas, con 2 partidos, va detras de quien tiene las mismas en 1); luego nombre.
 * Criterio explicito, repetido en la nota al pie de la lista.
 */
export const porFaltas = (a: Lider, b: Lider) => b.faltas - a.faltas || a.pj - b.pj || texto(a, b);

// ---------------------------------------------------------------------------------------------------------------------
// Tabla "Todos los jugadores": ordenar por cualquier columna, en totales o por partido, con minimo de partidos.
// ---------------------------------------------------------------------------------------------------------------------

export type FilaOrden = Lider & { segundos: number; p2a: number; equipos: string[]; minPartidos: number };
export type Columna = "nombre" | "equipo" | "pj" | "segundos" | "pts" | "media" | "p2a" | "p3a" | "tla" | "pctTL" | "faltas" | "fpp";
/** Columnas que son una tasa: ahi un solo partido no debe liderar (se aplica el minimo). */
export const COLUMNAS_TASA: Columna[] = ["media", "pctTL", "fpp"];
const COLUMNAS_TOTAL_A_TASA: Columna[] = ["segundos", "p2a", "p3a", "tla", "faltas"];
export type Minimo = "auto" | "todos" | number;

/** Valor de una fila en una columna. En "por partido", minutos, 2P, 3P, TL anotados y faltas se dividen por PJ. */
export function valorColumna(j: FilaOrden, col: Columna, porPartido: boolean): number | string | null {
  const pp = (v: number) => (porPartido ? (j.pj ? v / j.pj : 0) : v);
  switch (col) {
    case "nombre": return j.nombre;
    case "equipo": return j.equipos.join(" + ");
    case "pj": return j.pj;
    case "pts": return j.pts;
    case "media": return j.pj ? j.pts / j.pj : null;
    case "segundos": return pp(j.segundos);
    case "p2a": return pp(j.p2a);
    case "p3a": return pp(j.p3a);
    case "tla": return pp(j.tla);
    case "pctTL": return j.tli ? j.tla / j.tli : null;
    case "faltas": return pp(j.faltas);
    case "fpp": return j.pj ? j.faltas / j.pj : null;
  }
}

/**
 * Comparador de la tabla: la columna elegida (asc o desc); los valores que no existen (p. ej. % de TL sin intentos) van
 * SIEMPRE al final; ante un empate, el desempate es fijo y no depende de la direccion: (TL%: mas anotados, menos intentados) y
 * despues puntos, media, nombre y equipo. El mismo dato da siempre el mismo orden.
 */
export function comparadorTabla(col: Columna, dir: 1 | -1, porPartido: boolean) {
  return (a: FilaOrden, b: FilaOrden) => {
    const va = valorColumna(a, col, porPartido), vb = valorColumna(b, col, porPartido);
    if (va === null || vb === null) { if (va !== vb) return va === null ? 1 : -1; }
    else if (typeof va === "string") { const c = va.localeCompare(vb as string, "es"); if (c) return dir * c; }
    else if (va !== vb) return dir * (va - (vb as number));
    if (col === "pctTL") { const t = b.tla - a.tla || a.tli - b.tli; if (t) return t; }
    return porPuntos(a, b);
  };
}

/**
 * Minimo de partidos. "todos": sin minimo. Un numero N: solo quien jugo al menos N partidos (y, ordenando por % de TL, con 3 o
 * mas tiros libres intentados). "auto" (el criterio de los lideres): al ordenar por una tasa (media, % de TL, faltas por partido o
 * cualquier columna en "por partido"), la mitad de los partidos de su equipo (al menos 1), y 3 tiros libres intentados para el % de TL.
 */
export function pasaMinimo(j: FilaOrden, col: Columna, minimo: Minimo, porPartido: boolean): boolean {
  if (minimo === "todos") return true;
  if (typeof minimo === "number") { if (j.pj < minimo) return false; }
  else if ((COLUMNAS_TASA.includes(col) || (porPartido && COLUMNAS_TOTAL_A_TASA.includes(col))) && j.pj < j.minPartidos) return false;
  if (col === "pctTL" && j.tli < 3) return false;
  return true;
}

// ---------------------------------------------------------------------------------------------------------------------
// Lideres "Por partido" de la liga (vista independiente de la tabla). Una decimal en pantalla; el orden usa el valor exacto.
// ---------------------------------------------------------------------------------------------------------------------

export type LiderPP = Lider & { segundos: number; p2a: number; minPartidos: number };
export type ClavePP = "pts" | "p2a" | "p3a" | "tla" | "pctTL" | "faltas" | "segundos";

/** Valor por partido de una lista (null si no se puede calcular: sin partidos o, en TL%, sin intentos). */
export function valorPP(j: LiderPP, k: ClavePP): number | null {
  if (!j.pj) return null;
  if (k === "pctTL") return j.tli ? j.tla / j.tli : null;
  return j[k] / j.pj;
}
/** El total que desempata despues del valor por partido (en TL%, los tiros libres anotados). */
const totalPP = (j: LiderPP, k: ClavePP) => (k === "pctTL" ? j.tla : j[k]);

/**
 * Minimo de partidos de los lideres por partido ("Automatico"): la mitad de los partidos de su equipo (al menos 1) y, en TL%,
 * 3 tiros libres intentados. Un doblador cuenta con los partidos sumados de sus dos fichas.
 */
export const cumpleMinimoPP = (j: LiderPP, k: ClavePP) => j.pj >= j.minPartidos && (k !== "pctTL" || j.tli >= 3);

/** Orden de cada lista por partido: valor por partido, luego total, luego MENOS partidos, luego nombre y equipo. */
export const porPartido = (k: ClavePP) => (a: LiderPP, b: LiderPP) => {
  const va = valorPP(a, k) ?? -1, vb = valorPP(b, k) ?? -1;
  return vb - va || totalPP(b, k) - totalPP(a, k) || a.pj - b.pj || texto(a, b);
};
