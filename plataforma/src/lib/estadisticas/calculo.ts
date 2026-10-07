// Calculo de las pestañas de estadisticas por temporada (migracion de GitHub Pages, paso 2 del rediseño). Funciones puras
// y sin dependencias para poder probarlas con node: son las mismas reglas que tenia index.html (medias solo sobre
// partidos con minutos, DNP fuera de las medias, null donde no hay dato, criterios de orden de cada tabla).

export type Eq = "MDA" | "MDL";
export type FiltroEq = "ALL" | Eq;

/** Lo que recogia la liga cada temporada (data/season_<t>.json -> metrics). Sin "metrics" (25/26) se asume todo. */
export type Metricas = {
  pts: boolean; p2: boolean; p2_intentos: boolean; p3: boolean; p3_intentos: boolean; tl: boolean; fc: boolean;
  min: boolean; val: boolean; pm: boolean; asistencia: boolean; cuartos: boolean; fecha: boolean; dorsal: boolean;
};
export const METRICAS_TODAS: Metricas = {
  pts: true, p2: true, p2_intentos: true, p3: true, p3_intentos: true, tl: true, fc: true,
  min: true, val: true, pm: true, asistencia: true, cuartos: true, fecha: true, dorsal: true,
};
export const metricasDe = (m?: Partial<Metricas> | null): Metricas => ({ ...METRICAS_TODAS, ...(m ?? {}) });

export type PartidoEst = {
  num: string | null; equipo: Eq; fecha: string | null; rival: string | null; pf: number; pc: number; incomp: boolean;
  res: "G" | "P"; pn: number; sin_stats?: boolean; pendiente_acta?: boolean; fase?: string;
};

export type Totales = { pts: number; p2a: number; p2i: number | null; p3a: number; p3i: number | null; tla: number; tli: number; fc: number | null; val: number | null; pm?: number | null };
export type JugadorEst = {
  person_id: string; nombre: string; display?: string; dorsales?: string[]; equipos: Eq[]; pj: number; conv: number; min_tot: number | null;
  tot: Totales; avg?: { pts: number; min: number | null; val: number | null; pm: number | null; fc: number | null } | null;
  tl_pct: number | null; p2_pct: number | null; p3_pct: number | null; pm_total: number | null; ppm: number | null;
};

export type FilaBox = {
  num: string | null; nombre: string; display?: string; sec: number | null; pts: number | null; p2a: number | null; p2i: number | null;
  p3a: number | null; p3i: number | null; tla: number | null; tli: number | null; fc: number | null; val: number | null; pm: number | null;
  no_jugador?: boolean; mote?: string; person_id?: string;
};

export const esPO = (p: { rival: string | null }) => !!p.rival && p.rival.includes("(PO)");
export const sinPO = (rival: string | null) => (rival ?? "—").replace(" (PO)", "");

/** "ESTEBAN, JON" -> "Jon Esteban" (solo primer apellido y primer nombre). */
export function nombreCorto(n: string) {
  const parts = n.split(",");
  const ap = parts[0].trim().split(" ")[0];
  const no = (parts[1] || "").trim().split(" ")[0];
  return (no ? no + " " : "") + ap.charAt(0) + ap.slice(1).toLowerCase();
}
export const nombrePropio = (n: string) => n.split(" ").map((w) => (w.length > 2 ? w.charAt(0) + w.slice(1).toLowerCase() : w)).join(" ");
export const nombreDe = (p: { display?: string; nombre: string }) => p.display || nombreCorto(p.nombre);

/** Numero de valor o null -> texto (null/NaN/Infinity = null, que la pantalla pinta como "—"). */
export const esNum = (v: unknown): v is number => typeof v === "number" && isFinite(v);

// ------------------------------------------------------------------------------------------------ Equipo
export type FiltrosEquipo = { equipo: FiltroEq; comp: "ALL" | "LIGA" | "PO" };

/** Partidos del filtro, en orden de calendario (por fecha; sin fecha, por numero de jornada). */
export function partidosFiltrados(partidos: PartidoEst[], f: FiltrosEquipo, hayFecha: boolean) {
  let a = partidos.slice();
  if (f.equipo !== "ALL") a = a.filter((p) => p.equipo === f.equipo);
  if (f.comp === "LIGA") a = a.filter((p) => !esPO(p));
  if (f.comp === "PO") a = a.filter((p) => esPO(p));
  if (hayFecha) a.sort((x, y) => ((x.fecha ?? "") < (y.fecha ?? "") ? -1 : 1));
  else a.sort((x, y) => x.pn - y.pn);
  return a;
}

/** Balance, puntos y mejor victoria. Las medias solo cuentan partidos con marcador (sin incomparecencias). */
export function resumenEquipo(a: PartidoEst[]) {
  const g = a.filter((p) => p.res === "G").length, l = a.filter((p) => p.res === "P").length;
  const pf = a.reduce((s, p) => s + p.pf, 0), pc = a.reduce((s, p) => s + p.pc, 0);
  const sc = a.filter((p) => !p.incomp);
  const af = sc.length ? pf / sc.length : 0, ac = sc.length ? pc / sc.length : 0;
  const pct = a.length ? Math.round((g / a.length) * 100) : 0;
  const mejor = sc.slice().sort((x, y) => y.pf - y.pc - (x.pf - x.pc))[0] ?? null;
  return { g, l, pf, pc, af, ac, pct, mejor };
}

export type ClavePartido = "fecha" | "equipo" | "rival" | "pf" | "res" | "dif";
export function ordenarPartidos(a: PartidoEst[], k: ClavePartido, d: 1 | -1, hayFecha: boolean) {
  const rows = a.slice();
  rows.sort((x, y) => {
    let vx: number | string | null, vy: number | string | null;
    if (k === "dif") { vx = x.pf - x.pc; vy = y.pf - y.pc; }
    else if (k === "pf") { vx = x.pf; vy = y.pf; }
    else if (k === "fecha" && !hayFecha) { vx = x.pn; vy = y.pn; }
    else { vx = x[k]; vy = y[k]; }
    return (vx as number) < (vy as number) ? -d : (vx as number) > (vy as number) ? d : 0;
  });
  return rows;
}

// ------------------------------------------------------------------------------------------------ Jugadores
export type ClaveJugador = "rank" | "nombre" | "pj" | "pts" | "ppg" | "min" | "ppm" | "p2" | "p3" | "tl" | "fc" | "val" | "pmt" | "pm";

export function valorJugador(p: JugadorEst, k: ClaveJugador, M: Metricas): number | string {
  const a = p.avg || { pts: 0, min: 0, val: 0, pm: 0, fc: 0 };
  switch (k) {
    case "nombre": return p.nombre;
    case "pj": return p.pj;
    case "pts": return p.tot.pts;
    case "ppg": return a.pts as number;
    case "min": return a.min as number;
    case "ppm": return p.ppm as number;
    case "p2": return M.p2_intentos ? (p.p2_pct == null ? -1 : p.p2_pct) : (p.tot.p2a == null ? -1 : p.tot.p2a);
    case "p3": return M.p3_intentos ? (p.p3_pct == null ? -1 : p.p3_pct) : (p.tot.p3a == null ? -1 : p.tot.p3a);
    case "tl": return p.tl_pct == null ? -1 : p.tl_pct;
    case "fc": return p.tot.fc as number;
    case "val": return p.tot.val as number;
    case "pmt": return p.pm_total as number;
    case "pm": return a.pm as number;
    default: return 0;
  }
}

export function jugadoresFiltrados(todos: JugadorEst[], f: { equipo: FiltroEq; minpj: number; k: ClaveJugador; d: 1 | -1 }, M: Metricas) {
  let a = todos.filter((p) => p.pj >= f.minpj);
  if (f.equipo !== "ALL") a = a.filter((p) => p.equipos.includes(f.equipo as Eq));
  return a.slice().sort((x, y) => {
    const vx = valorJugador(x, f.k, M), vy = valorJugador(y, f.k, M);
    if (typeof vx === "string") return f.d * vx.localeCompare(vy as string);
    return vx < (vy as number) ? -f.d : vx > (vy as number) ? f.d : 0;
  });
}

// ------------------------------------------------------------------------------------------------ Rankings
export type MetricaRanking = { lab: string; req?: keyof Metricas; fmt: (v: number) => string; get: (p: JugadorEst) => number | null };
const signo = (v: number) => (v >= 0 ? "+" : "");
export const METRICAS_RANKING: MetricaRanking[] = [
  { lab: "Puntos totales", fmt: (v) => String(v), get: (p) => p.tot.pts },
  { lab: "Minutos jugados", req: "min", fmt: (v) => v + "'", get: (p) => p.min_tot },
  { lab: "Puntos por minuto", req: "min", fmt: (v) => v.toFixed(2), get: (p) => p.ppm },
  { lab: "Canastas de 2", req: "p2", fmt: (v) => String(v), get: (p) => p.tot.p2a },
  { lab: "Canastas de 3", req: "p3", fmt: (v) => String(v), get: (p) => p.tot.p3a },
  { lab: "Tiros libres metidos", req: "tl", fmt: (v) => String(v), get: (p) => p.tot.tla },
  { lab: "Valoración total", req: "val", fmt: (v) => String(v), get: (p) => p.tot.val },
  { lab: "+/- acumulado", req: "pm", fmt: (v) => signo(v) + v, get: (p) => p.pm_total },
  { lab: "+/- medio", req: "pm", fmt: (v) => signo(v) + v.toFixed(1), get: (p) => (p.avg ? p.avg.pm : 0) },
  { lab: "Puntos por partido", fmt: (v) => v.toFixed(1), get: (p) => (p.avg ? p.avg.pts : 0) },
  { lab: "Faltas cometidas", req: "fc", fmt: (v) => String(v), get: (p) => p.tot.fc },
];

/** Las metricas que existian esa temporada. */
export const metricasDeRanking = (M: Metricas) => METRICAS_RANKING.filter((m) => !m.req || M[m.req]);

export function topRanking(jugadores: JugadorEst[], m: MetricaRanking, equipo: FiltroEq, n: number) {
  let pool = jugadores.filter((p) => p.pj > 0);
  if (equipo !== "ALL") pool = pool.filter((p) => p.equipos.includes(equipo));
  const orden = pool.filter((p) => m.get(p) != null).sort((a, b) => (m.get(b) as number) - (m.get(a) as number)).slice(0, n);
  const max = Math.max(...orden.map((p) => Math.abs(m.get(p) as number)), 1);
  return orden.map((p, i) => {
    const v = m.get(p) as number;
    return { jugador: p, pos: i + 1, valor: v, texto: m.fmt(v), ancho: Math.max(4, Math.round((Math.abs(v) / max) * 100)) };
  });
}

// ------------------------------------------------------------------------------------------------ Asistencia
export type Asis = { fueron: number | null; total: number | null; pct: number | null };
export type ClaveAsis = "fueron" | "total" | "pct";
/** Orden por columna (por defecto, % de asistencia, de mayor a menor). Sin dato cuenta 0, como en la web anterior. */
export function ordenarAsistencia<T>(pool: T[], src: (p: T) => Asis, k: ClaveAsis | null, d: 1 | -1) {
  const sk = k || "pct";
  return pool.slice().sort((a, b) => d * ((src(a)[sk] || 0) - (src(b)[sk] || 0)));
}
export const pctAsistencia = (v: number | null) => (v == null ? "—" : Math.round(v * 100) + "%");

// ------------------------------------------------------------------------------------------------ Cuartos
export type QStats = { us: number[]; them: number[]; n: number };
export function resumenCuartos(d: QStats) {
  const mejor = d.us.indexOf(Math.max(...d.us)) + 1;
  const peorDef = d.them.indexOf(Math.max(...d.them)) + 1;
  const maxv = Math.max(...d.us, ...d.them);
  return { mejor, peorDef, maxv, ancho: (v: number) => Math.round((v / maxv) * 100) };
}

// ------------------------------------------------------------------------------------------------ Formato comun
export const minutos = (sec: number) => Math.floor(sec / 60) + "'";
export const temporadaCorta = (id: string) => id.slice(2, 4) + "/" + id.slice(5, 7);
export const fechaCorta = (f: string) => f.slice(8, 10) + "/" + f.slice(5, 7) + "/" + f.slice(0, 4);
