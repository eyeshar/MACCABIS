// Filtros del Calendario (D189): Todo · Partidos · Entrenos · Planes, MdA o MdL, y «Pasados» aparte. Todo en la URL
// (?f=partidos&eq=MdA&pasados=1), para que «‹» y el boton atras vuelvan con el mismo filtro (norma 13.4). Puro: se prueba aparte.

export type TipoFiltro = "todo" | "partidos" | "entrenos" | "planes";
export type Filtro = { tipo: TipoFiltro; equipo: "MdA" | "MdL" | null; pasados: boolean };

export const FILTROS: { id: TipoFiltro; texto: string }[] = [
  { id: "todo", texto: "Todo" }, { id: "partidos", texto: "Partidos" }, { id: "entrenos", texto: "Entrenos" }, { id: "planes", texto: "Planes" },
];
export const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const PARTIDOS = new Set(["liga", "amistoso", "torneo", "interno"]);

export function leerFiltro(q: { f?: string; eq?: string; pasados?: string }): Filtro {
  const tipo = FILTROS.some((x) => x.id === q.f) ? (q.f as TipoFiltro) : "todo";
  const equipo = q.eq === "MdA" || q.eq === "MdL" ? q.eq : null;
  return { tipo, equipo, pasados: q.pasados === "1" };
}

/** Lo que pasa el filtro. Un plan (no oficial) solo sale en Todo y Planes; el filtro de equipo deja los partidos de ese
 *  equipo y lo que es de los dos (entrenos, planes, un domingo con los dos partidos). */
export function filtrar<T>(items: T[], f: Filtro, de: (x: T) => { tipo: string; equipo: string | null; plan: boolean }): T[] {
  return items.filter((x) => {
    const { tipo, equipo, plan } = de(x);
    if (f.tipo === "planes" && !plan) return false;
    if (f.tipo === "partidos" && (plan || !PARTIDOS.has(tipo))) return false;
    if (f.tipo === "entrenos" && (plan || tipo !== "entreno")) return false;
    if (f.equipo && equipo && equipo !== "ambos" && equipo !== f.equipo) return false;
    return true;
  });
}
