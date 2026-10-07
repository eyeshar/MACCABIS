import "server-only";
import ligaJson from "@/data/liga.json";
import temporadaJson from "@/data/temporada.json";
import entrenosJson from "@/data/entrenos.json";
import resumenJson from "@/data/historia_resumen.json";
import calJson from "@/data/calendario.json";
import { avisoDe, nombreRival, type Aviso, type Partido } from "@/lib/equipacion";
import { NOMBRE_EQUIPO } from "@/lib/web";
import { diaDeLaSemana, sumarDias, sumarMinutos } from "@/lib/dias";

// Datos PUBLICOS de la web (D76): todo sale de copias de data/ (npm run datos:sync), que ya se publican en GitHub
// Pages. Solo datos por equipo y estadisticas de jugadores de Maccabis; nada por jugador de otros equipos (D73), ni
// correos, ni niveles (D39). Sin fecha "de hoy" implicita: entra por parametro, asi se prueba con fechas fijas.

export type Equipo = "MDA" | "MDL";

// ---------------------------------------------------------------- calendario: partidos + entrenos
export type Evento = {
  id: string;
  tipo: "partido" | "entreno";
  fecha: string;
  inicio: string | null;
  fin: string | null;
  titulo: string;
  lugar: string;
  pistaPorConfirmar: boolean;
  nota: string | null;
  equipo?: Equipo;
  jornada?: number;
  rival?: string;
  local?: boolean | null;
  aviso?: Aviso | null;
  partido?: Partido;
};

type Entrenos = {
  pistas: Record<string, { nombre: string; habitual: boolean; estado: string; nota?: string }>;
  series: { id: string; titulo: string; dia_semana: number; inicio: string; fin: string; pista: string; desde: string; hasta: string | null }[];
  excepciones: { serie: string; fecha: string; inicio?: string; fin?: string; pista?: string; nota?: string; cancelado?: boolean }[];
};
const ENTRENOS = entrenosJson as unknown as Entrenos;
type PartidoCal = Partido & { fase?: string };
const CALENDARIO = calJson as unknown as { partidos: PartidoCal[] };

/** Origen del calendario publico. Por defecto, los ficheros del repo (la fuente de siempre). Desde el paso 2 (D94) las
 *  paginas pueden pasar la fuente leida de la tabla de eventos (vistas publicas de Supabase, `cargarFuente`). */
export type FuenteCalendario = {
  partidos: PartidoCal[];
  /** Entrenos ya expandidos (uno por miercoles). null = salen de data/entrenos_2026-27.json. */
  entrenos: Evento[] | null;
  habitual: { inicio: string; fin: string; pista: string; enObras: boolean } | null;
};
const FUENTE_FICHEROS: FuenteCalendario = { partidos: CALENDARIO.partidos, entrenos: null, habitual: null };

export const partidosCalendario = (f: FuenteCalendario = FUENTE_FICHEROS) => f.partidos;

/** Ultimo dia con partido de liga: la serie de entrenos sin fecha de fin se corta ahi. */
export const finTemporada = (f: FuenteCalendario = FUENTE_FICHEROS) => f.partidos.map((p) => p.fecha).filter(Boolean).sort().at(-1) as string;

/** "Pista 2" / "Moratalaz · Pista 2" */
const pista = (campo: string | null) => (campo ? `Pista ${campo}` : "Pista por confirmar");

export function eventosPartidos(f: FuenteCalendario = FUENTE_FICHEROS): Evento[] {
  return f.partidos
    .filter((p) => !p.descansa && p.rival && p.fecha)
    .map((p) => {
      const nuestro = NOMBRE_EQUIPO[p.equipo], rival = nombreRival(p.rival);
      return {
        id: `${p.equipo.toLowerCase()}-j${p.jornada}`,
        tipo: "partido",
        fecha: p.fecha!,
        inicio: p.hora,
        fin: p.hora ? sumarMinutos(p.hora, 75) : null,
        titulo: `J${p.jornada} · ${p.local ? `${nuestro} – ${rival}` : `${rival} – ${nuestro}`}`,
        lugar: `Moratalaz · ${pista(p.campo)}`,
        pistaPorConfirmar: !p.campo,
        nota: p.hora ? null : "Hora por confirmar",
        equipo: p.equipo,
        jornada: p.jornada,
        rival,
        local: p.local,
        aviso: avisoDe(p),
        partido: p,
      } satisfies Evento;
    });
}

/** Una fila por miercoles de entreno, con las excepciones aplicadas. Valdebernardo en obras: "Pista por confirmar". */
export function eventosEntrenos(f: FuenteCalendario = FUENTE_FICHEROS, hasta = finTemporada(f)): Evento[] {
  if (f.entrenos) return f.entrenos;
  const fuera: Evento[] = [];
  for (const s of ENTRENOS.series) {
    const fin = s.hasta ?? hasta;
    let f = s.desde;
    while (diaDeLaSemana(f) !== s.dia_semana % 7) f = sumarDias(f, 1);
    for (; f <= fin; f = sumarDias(f, 7)) {
      const ex = ENTRENOS.excepciones.find((x) => x.serie === s.id && x.fecha === f);
      if (ex?.cancelado) continue;
      const p = ENTRENOS.pistas[ex?.pista ?? s.pista];
      const enObras = p?.estado === "en_obras";
      fuera.push({
        id: `${s.id}-${f}`,
        tipo: "entreno",
        fecha: f,
        inicio: ex?.inicio ?? s.inicio,
        fin: ex?.fin ?? s.fin,
        titulo: s.titulo,
        lugar: enObras || !p ? "Pista por confirmar" : p.nombre,
        pistaPorConfirmar: enObras || !p,
        nota: enObras ? `${p.nombre.split(" (")[0]} en obras` : ex?.nota ?? null,
      });
    }
  }
  return fuera;
}

/** La serie habitual, para el texto "lo habitual: miercoles 20:30–22:30 en Valdebernardo". */
export function entrenoHabitual(f: FuenteCalendario = FUENTE_FICHEROS) {
  if (f.habitual) return f.habitual;
  const s = ENTRENOS.series[0];
  const p = ENTRENOS.pistas[s.pista];
  return { inicio: s.inicio, fin: s.fin, pista: p.nombre, enObras: p.estado === "en_obras" };
}

/** Todos los eventos de la temporada, por fecha y hora. */
export function eventosTemporada(f: FuenteCalendario = FUENTE_FICHEROS): Evento[] {
  return [...eventosPartidos(f), ...eventosEntrenos(f)].sort((a, b) =>
    a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : (a.inicio ?? "99") < (b.inicio ?? "99") ? -1 : (a.inicio ?? "99") > (b.inicio ?? "99") ? 1 : a.id < b.id ? -1 : 1);
}

/** Chip corto de equipacion para listas: null si no hay choque. */
export function chipEquipacion(a: Aviso | null | undefined) {
  if (!a?.hay) return null;
  if (a.tipo === "nos_toca") return { tipo: a.tipo, texto: "⚠ Nos toca: amarilla" };
  if (a.tipo === "cambian_ellos") return { tipo: a.tipo, texto: "Cambian ellos" };
  return { tipo: a.tipo, texto: "Lleva la amarilla" };
}

// ---------------------------------------------------------------- proxima jornada
export type Proximo = { equipo: Equipo; evento: Evento; descansaAntes: number[] };

/** Proximo partido de cada equipo desde hoy (inclusive), con las jornadas que descansa antes. */
export function proximosPartidos(hoy: string, equipos: Equipo[] = ["MDA", "MDL"], f: FuenteCalendario = FUENTE_FICHEROS): Proximo[] {
  const partidos = eventosPartidos(f);
  return equipos.flatMap((e) => {
    const evento = partidos.filter((p) => p.equipo === e && p.fecha >= hoy).sort((a, b) => (a.fecha < b.fecha ? -1 : 1))[0];
    if (!evento) return [];
    const descansaAntes = f.partidos.filter((p) => p.equipo === e && p.descansa && p.fecha && p.fecha >= hoy && p.fecha < evento.fecha).map((p) => p.jornada);
    return [{ equipo: e, evento, descansaAntes }];
  });
}

/** Jornadas del calendario en las que descansa un equipo en una fecha dada (para "MdA descansa"). */
export const descansaEl = (fecha: string, f: FuenteCalendario = FUENTE_FICHEROS) => f.partidos.filter((p) => p.descansa && p.fecha === fecha).map((p) => p.equipo);

// ---------------------------------------------------------------- resultados (temporada en curso, por equipo)
type PartidoTemporada = { equipo: Equipo; fecha: string; rival: string; pf: number | null; pc: number | null; res: string | null; incomp: boolean; hora?: string; pista?: string; pendiente_acta?: boolean };
type Jugador = {
  person_id: string; display: string; dorsales: string[]; equipos: Equipo[]; pj: number; min_tot: number | null;
  tot: { pts: number; p2a: number; p2i: number; p3a: number; p3i: number; tla: number; tli: number; fc: number };
  games: { pn: number; eq: Equipo; rival: string; local: boolean; sec: number | null; played: boolean; pts: number; p2a: number; p3a: number; tla: number; tli: number }[];
};
const TEMPORADA = temporadaJson as unknown as { season: string; partidos: PartidoTemporada[]; players: Jugador[]; plantilla: { person_id: string; display: string; fichas: Equipo[] }[] };

export type Resultado = { equipo: Equipo; fecha: string; jornada: number | null; rival: string; local: boolean | null; pf: number; pc: number; gano: boolean; pendienteActa: boolean };

export function resultados(): Resultado[] {
  return TEMPORADA.partidos
    .filter((p) => p.pf != null && p.pc != null)
    .map((p) => {
      const cal = CALENDARIO.partidos.find((c) => c.equipo === p.equipo && c.fecha === p.fecha);
      return { equipo: p.equipo, fecha: p.fecha, jornada: cal?.jornada ?? null, rival: nombreRival(cal?.rival ?? p.rival), local: cal?.local ?? null, pf: p.pf!, pc: p.pc!, gano: p.pf! > p.pc!, pendienteActa: !!p.pendiente_acta };
    })
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : a.equipo < b.equipo ? -1 : 1));
}

/** Resultados del ultimo domingo jugado hasta hoy. */
export function ultimosResultados(hoy: string) {
  const todos = resultados().filter((r) => r.fecha <= hoy);
  const fecha = todos[0]?.fecha;
  return fecha ? todos.filter((r) => r.fecha === fecha).sort((a, b) => (a.equipo < b.equipo ? -1 : 1)) : [];
}

// ---------------------------------------------------------------- clasificacion (publica por equipo, D73)
type FilaClas = { pos: number; id: string; equipo: string; nuestro: boolean; pj: number; g: number; p: number; pf: number; pc: number; dif: number; pts: number | null };
const LIGA = ligaJson as unknown as { clasificacion_estado: string; grupos: Record<"G1" | "G2", { nuestro: Equipo; jornadas_cargadas: number[]; clasificacion: FilaClas[] }> };

export function clasificaciones() {
  return (["G1", "G2"] as const).map((g) => {
    const G = LIGA.grupos[g];
    return { grupo: g, equipo: G.nuestro, tras: G.jornadas_cargadas.length ? Math.max(...G.jornadas_cargadas) : null, filas: G.clasificacion };
  });
}
export const estadoClasificacion = () => LIGA.clasificacion_estado;

/** Las 5 primeras y, si nuestro equipo va mas abajo, su fila aparte. */
export function top(filas: FilaClas[], n = 5) {
  const arriba = filas.slice(0, n);
  const nuestro = filas.find((f) => f.nuestro);
  return { arriba, nuestroAbajo: nuestro && !arriba.includes(nuestro) ? nuestro : null, total: filas.length };
}

// ---------------------------------------------------------------- lideres de Maccabis (temporada en curso)
export type Lider = { clave: string; titulo: string; valor: string; nombre: string; detalle: string };
const dec1 = (x: number) => x.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const equiposDe = (j: Jugador) => j.equipos.map((e) => NOMBRE_EQUIPO[e]).join(" + ");

/** Mayor valor; desempate: menos partidos, luego nombre (determinista). */
function mejor<T extends Jugador>(lista: T[], valor: (j: T) => number, desempate?: (j: T) => number) {
  return [...lista].filter((j) => valor(j) > 0)
    .sort((a, b) => valor(b) - valor(a) || (desempate ? desempate(b) - desempate(a) : 0) || a.pj - b.pj || a.display.localeCompare(b.display, "es"))[0] ?? null;
}

/** Nombre con tildes de la plantilla (la hoja de la FBM los trae sin tildes). */
const nombreDe = (j: Jugador) => TEMPORADA.plantilla.find((p) => p.person_id === j.person_id)?.display ?? j.display;

export function lideres(): Lider[] {
  const js = TEMPORADA.players.filter((j) => j.pj > 0).map((j) => ({ ...j, display: nombreDe(j) }));
  const fuera: Lider[] = [];
  const pts = mejor(js, (j) => j.tot.pts);
  if (pts) fuera.push({ clave: "puntos", titulo: "Puntos", valor: String(pts.tot.pts), nombre: pts.display, detalle: `${dec1(pts.tot.pts / pts.pj)} por partido · ${equiposDe(pts)}` });
  const tri = mejor(js, (j) => j.tot.p3a);
  if (tri) fuera.push({ clave: "triples", titulo: "Triples", valor: String(tri.tot.p3a), nombre: tri.display, detalle: `${dec1(tri.tot.p3a / tri.pj)} por partido · ${equiposDe(tri)}` });
  const tl = mejor(js, (j) => j.tot.tla, (j) => (j.tot.tli ? j.tot.tla / j.tot.tli : 0));
  if (tl) fuera.push({ clave: "tiros-libres", titulo: "Tiros libres", valor: `${tl.tot.tla}/${tl.tot.tli}`, nombre: tl.display, detalle: `${Math.round((100 * tl.tot.tla) / tl.tot.tli)} % · ${equiposDe(tl)}` });
  const partidos = js.flatMap((j) => j.games.filter((g) => g.played).map((g) => ({ j, g })));
  const max = partidos.sort((a, b) => b.g.pts - a.g.pts || a.j.display.localeCompare(b.j.display, "es"))[0];
  if (max && max.g.pts > 0) fuera.push({ clave: "partido", titulo: "En un partido", valor: String(max.g.pts), nombre: max.j.display, detalle: `${NOMBRE_EQUIPO[max.g.eq]} ante ${nombreRival(max.g.rival)}` });
  return fuera;
}

export const jornadasJugadas = () => TEMPORADA.partidos.filter((p) => p.pf != null).length;

// ---------------------------------------------------------------- un jugador de Maccabis (Mi zona; sus propios datos, ya publicos)
export function temporadaDe(personId: string) {
  const j = TEMPORADA.players.find((x) => x.person_id === personId);
  if (!j) return null;
  const partidos = j.games.filter((g) => g.played).map((g) => {
    const r = TEMPORADA.partidos.find((p) => p.equipo === g.eq && (p.rival === g.rival || p.rival.toLowerCase() === g.rival.toLowerCase()));
    const cal = r ? CALENDARIO.partidos.find((c) => c.equipo === g.eq && c.fecha === r.fecha) : undefined;
    return { equipo: g.eq, rival: nombreRival(cal?.rival ?? g.rival), local: g.local, pts: g.pts, fecha: r?.fecha ?? null, jornada: cal?.jornada ?? null, pf: r?.pf ?? null, pc: r?.pc ?? null };
  });
  return { display: j.display, dorsales: j.dorsales, pj: j.pj, minutos: j.min_tot, tot: j.tot, partidos };
}

export const enPlantilla = (personId: string) => TEMPORADA.plantilla.find((p) => p.person_id === personId) ?? null;

// ---------------------------------------------------------------- historia
export const resumenHistoria = () => resumenJson as { temporadas_con_datos: number; partidos_con_estadisticas: number; victorias: number; jugadores_en_la_historia: number };
