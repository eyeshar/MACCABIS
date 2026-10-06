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
/** Faltas: mas faltas; a igualdad, menos partidos (mas faltas por partido); luego nombre. */
export const porFaltas = (a: Lider, b: Lider) => b.faltas - a.faltas || a.pj - b.pj || texto(a, b);
