// Proyeccion de anotacion de un equipo convocado (D124, recalibrada en D133; REGLAS_CONVOCATORIA.md §9). Funciones PURAS
// y deterministas, sin imports (las usan la pantalla de convocatoria y el tablero, que recalculan al momento, el script
// de calibracion, el de validacion y las pruebas, que cargan este fichero con `node`). SOLO GESTORES: lleva la letra de
// ataque de cada jugador (D39).
//
//   a) Puntos por minuto de cada convocado: con 60 minutos o mas esta temporada, solo esta temporada (D133); si no, la
//      actual pesa el doble que la anterior. Con menos de 60 minutos sumados (las dos temporadas), lo que falta hasta 60
//      se completa con la tasa media de su letra de Ataque, calibrada con los que si tienen datos, y «pocos datos».
//   b) Minutos esperados: 240 por partido, repartidos segun los minutos medios por partido de cada uno (20 sin datos),
//      con un maximo de 40 por jugador (lo que sobra se reparte entre los demas).
//   c) Factor rival (D133): media geometrica ponderada de las fuentes que haya, con un previo de 1 (peso 1): la
//      dificultad que marca el gestor (Alta 0,85 · Media 1 · Baja 1,15; peso 2), lo que encaja el rival esta temporada
//      frente a la media de su grupo (peso = sus partidos) y su historial de temporadas anteriores frente a la media de
//      su grupo de entonces (peso 3 la temporada pasada, la mitad por cada temporada mas atras).
//   d) Correccion de sesgo (D133): mediana de real / proyectado de los partidos ya jugados; a medio camino de 1 con
//      menos de 8 partidos, completa desde ahi. Se recalcula sola con cada jornada publicada.
//   e) Margen: ±15 % con menos de 5 jornadas jugadas en la temporada; ±10 % despues.

export type Letra = "A" | "B" | "C" | "D" | "E";
export const LETRAS: Letra[] = ["A", "B", "C", "D", "E"];

export const PROYECCION = {
  minutosPartido: 240,
  maximoJugador: 40,
  minutosSinDatos: 20,
  minutosSuficientes: 60,
  pesoActual: 2,
  pesoAnterior: 1,
  partidosRival: 2,
  jornadasMargen: 5,
  margenPronto: 0.15,
  margenDespues: 0.1,
  dificultad: { alta: 0.85, media: 1, baja: 1.15 } as Record<DificultadRival, number>,
  pesoPrevio: 1,
  pesoDificultad: 2,
  pesoHistorial: 3,
  partidosCorreccion: 8,
  /** D133: con 60 minutos o mas esta temporada, solo cuenta esta temporada (la validacion lo apaga para comparar). */
  soloActual: true,
};
export type DificultadRival = "alta" | "media" | "baja";
/** Temporada en curso de la proyeccion (la del historial de rivales se mide contra ella). */
export const TEMPORADA_PROYECCION = "2026-27";
/** Anotacion minima (puntos esperados) de la hoja de Ivan, pestaña «Parametros». Provisional: recalibrar tras la J6. */
export const ANOTACION_MINIMA = 45;

/** Lo jugado por un jugador en una temporada (solo partidos en que salio a pista). */
export type Tramo = { pts: number; min: number; partidos: number };
export type Historial = { actual: Tramo; anterior: Tramo };
export type RivalStats = { pj: number; pf: number; pc: number };
export type Grupo = { pj: number; pc: number };
/** Historial de un rival en una temporada anterior (D133): lo que encajaba frente a la media de su grupo de entonces. */
export type HistorialRival = { temporada: string; factor: number; pj: number };

const VACIO: Tramo = { pts: 0, min: 0, partidos: 0 };
const red1 = (x: number) => Math.round(x * 10) / 10;

/** Puntos y minutos con los pesos de la regla a): con 60 minutos esta temporada, solo ella; si no, la actual cuenta dos
 *  veces. */
function ponderado(h: Historial) {
  const { pesoActual: wa } = PROYECCION;
  const wp = PROYECCION.soloActual && h.actual.min >= PROYECCION.minutosSuficientes ? 0 : PROYECCION.pesoAnterior;
  return {
    pts: wa * h.actual.pts + wp * h.anterior.pts,
    min: wa * h.actual.min + wp * h.anterior.min,
    partidos: wa * h.actual.partidos + wp * h.anterior.partidos,
    minSumados: h.actual.min + (wp ? h.anterior.min : 0),
  };
}

/** Tasa media de cada letra de Ataque con los que tienen 60 minutos o mas (puntos / minutos ponderados de todos ellos).
 *  Una letra sin nadie calibrado toma la media de todos los calibrados (y, sin ninguno, 0,15). */
export function tasasPorLetra(jugadores: { letra: Letra | null; hist: Historial }[]) {
  const suma: Record<string, { pts: number; min: number }> = {};
  let tp = 0, tm = 0;
  for (const j of jugadores) {
    const p = ponderado(j.hist);
    if (p.minSumados < PROYECCION.minutosSuficientes || p.min <= 0) continue;
    tp += p.pts; tm += p.min;
    if (!j.letra) continue;
    suma[j.letra] = { pts: (suma[j.letra]?.pts ?? 0) + p.pts, min: (suma[j.letra]?.min ?? 0) + p.min };
  }
  const media = tm > 0 ? tp / tm : 0.15;
  const tasas = Object.fromEntries(LETRAS.map((l) => [l, suma[l]?.min ? suma[l].pts / suma[l].min : media])) as Record<Letra, number>;
  return { tasas, media, calibradas: LETRAS.filter((l) => !!suma[l]?.min) };
}

/** Puntos por minuto de un jugador (regla a) y si tiene «pocos datos». */
export function tasaDe(hist: Historial, letra: Letra | null, t: { tasas: Record<Letra, number>; media: number }) {
  const p = ponderado(hist);
  const relleno = letra ? t.tasas[letra] : t.media;
  if (p.minSumados >= PROYECCION.minutosSuficientes && p.min > 0) return { ppm: p.pts / p.min, pocosDatos: false };
  const falta = PROYECCION.minutosSuficientes - p.minSumados;
  return { ppm: (p.pts + relleno * falta) / (p.min + falta), pocosDatos: true };
}

/** Minutos medios por partido (ponderados como la tasa); sin partidos, los 20 por defecto. */
export function minutosMedios(hist: Historial) {
  const p = ponderado(hist);
  return p.partidos > 0 && p.min > 0 ? p.min / p.partidos : PROYECCION.minutosSinDatos;
}

/** Reparte los 240 minutos segun los pesos, con tope de 40: quien pasaria del tope se queda en 40 y lo suyo se reparte
 *  entre los demas. Con 6 o menos jugadores, todos 40. */
export function repartirMinutos(pesos: number[]) {
  const { minutosPartido: total, maximoJugador: tope } = PROYECCION;
  const out = pesos.map(() => 0);
  let abiertos = pesos.map((_, i) => i);
  let resto = total;
  for (;;) {
    const w = abiertos.reduce((s, i) => s + pesos[i], 0);
    if (!abiertos.length || w <= 0) break;
    const topados = abiertos.filter((i) => (resto * pesos[i]) / w > tope);
    if (!topados.length) { for (const i of abiertos) out[i] = (resto * pesos[i]) / w; break; }
    for (const i of topados) { out[i] = tope; resto -= tope; }
    abiertos = abiertos.filter((i) => !topados.includes(i));
  }
  return out;
}

const NOMBRE_DIFICULTAD: Record<DificultadRival, string> = { alta: "Alta", media: "Media", baja: "Baja" };
const temporadaCorta = (t: string) => t.replace("-", "/");

/** Factor rival (regla c, D133): media geometrica ponderada de la dificultad marcada, lo que encaja esta temporada frente
 *  a su grupo y su historial, con un previo de 1. `fuentes` dice de donde sale («dificultad marcada: Baja · 1 partido del
 *  rival · historial 2025/26»). Con menos de 2 partidos esta temporada y sin historial, la nota «rival con pocos datos». */
export function factorRival(rival: RivalStats | null, grupo: Grupo | null, extra: { dificultad?: DificultadRival | null; historial?: HistorialRival | null; temporada?: string } = {}) {
  const P = PROYECCION;
  const encaja = rival && rival.pj ? rival.pc / rival.pj : null, anota = rival && rival.pj ? rival.pf / rival.pj : null;
  const pesos: [number, number][] = [[1, P.pesoPrevio]];
  const fuentes: string[] = [];
  if (extra.dificultad) { pesos.push([P.dificultad[extra.dificultad], P.pesoDificultad]); fuentes.push(`dificultad marcada: ${NOMBRE_DIFICULTAD[extra.dificultad]}`); }
  if (rival && rival.pj > 0 && rival.pc > 0 && grupo && grupo.pj > 0 && grupo.pc > 0) {
    pesos.push([(rival.pc / rival.pj) / (grupo.pc / grupo.pj), rival.pj]);
    fuentes.push(`${rival.pj} ${rival.pj === 1 ? "partido" : "partidos"} del rival`);
  } else fuentes.push("sin partidos del rival");
  const h = extra.historial;
  if (h && h.factor > 0) {
    const atras = Math.max(0, +(extra.temporada ?? TEMPORADA_PROYECCION).slice(0, 4) - 1 - +h.temporada.slice(0, 4));
    pesos.push([h.factor, P.pesoHistorial / 2 ** atras]);
    fuentes.push(`historial ${temporadaCorta(h.temporada)}`);
  }
  const w = pesos.reduce((x, [, p]) => x + p, 0);
  const factor = Math.exp(pesos.reduce((x, [f, p]) => x + p * Math.log(f), 0) / w);
  const pocos = (!rival || rival.pj < P.partidosRival) && !h;
  return { factor, nota: pocos ? "rival con pocos datos" as string | null : null, encaja, anota, fuentes };
}

/** Correccion de sesgo (regla d, D133): mediana de real / proyectado (sin corregir) de los partidos ya jugados; a medio
 *  camino de 1 con menos de 8 partidos. Sin partidos, 1. */
export function correccionSesgo(puntos: { sinCorreccion: number; real: number }[]) {
  const r = puntos.filter((x) => x.sinCorreccion > 0).map((x) => x.real / x.sinCorreccion).sort((a, b) => a - b);
  if (!r.length) return 1;
  const med = r.length % 2 ? r[(r.length - 1) / 2] : (r[r.length / 2 - 1] + r[r.length / 2]) / 2;
  return r.length < PROYECCION.partidosCorreccion ? (1 + med) / 2 : med;
}

export const margenDe = (jornadasJugadas: number) => (jornadasJugadas < PROYECCION.jornadasMargen ? PROYECCION.margenPronto : PROYECCION.margenDespues);

export type Aporte = { person_id: string; nombre: string; minutos: number; ppm: number; puntos: number; pocosDatos: boolean };
export type Proyeccion = {
  puntos: number; desde: number; hasta: number; exacta: number; margen: number;
  sinFactor: number; factor: number; notaRival: string | null; fuentesRival: string[]; correccion: number;
  rival: { encaja: number | null; anota: number | null };
  aportes: Aporte[]; pocosDatos: number;
  bajoMinimo: boolean;
};

/** La proyeccion de un equipo con sus convocados. */
export function proyectar(e: {
  convocados: { person_id: string; nombre: string; letra: Letra | null; hist: Historial }[];
  tasas: { tasas: Record<Letra, number>; media: number };
  rival: RivalStats | null; grupo: Grupo | null; jornadasJugadas: number;
  dificultad?: DificultadRival | null; historial?: HistorialRival | null; temporada?: string; correccion?: number;
}): Proyeccion {
  const minutos = repartirMinutos(e.convocados.map((c) => minutosMedios(c.hist)));
  const aportes: Aporte[] = e.convocados.map((c, i) => {
    const t = tasaDe(c.hist, c.letra, e.tasas);
    return { person_id: c.person_id, nombre: c.nombre, minutos: minutos[i], ppm: t.ppm, puntos: t.ppm * minutos[i], pocosDatos: t.pocosDatos };
  });
  const sinFactor = aportes.reduce((s, a) => s + a.puntos, 0);
  const f = factorRival(e.rival, e.grupo, { dificultad: e.dificultad, historial: e.historial, temporada: e.temporada });
  const correccion = e.correccion ?? 1;
  const exacta = sinFactor * f.factor * correccion;
  const margen = margenDe(e.jornadasJugadas);
  for (const a of aportes) a.puntos = a.puntos * f.factor * correccion;
  aportes.sort((a, b) => b.puntos - a.puntos || a.nombre.localeCompare(b.nombre, "es"));
  return {
    puntos: Math.round(exacta), desde: Math.round(exacta * (1 - margen)), hasta: Math.round(exacta * (1 + margen)), exacta, margen,
    sinFactor, factor: f.factor, notaRival: f.nota, fuentesRival: f.fuentes, correccion, rival: { encaja: f.encaja, anota: f.anota },
    aportes: aportes.map((a) => ({ ...a, minutos: red1(a.minutos), ppm: Math.round(a.ppm * 1000) / 1000, puntos: red1(a.puntos) })),
    pocosDatos: aportes.filter((a) => a.pocosDatos).length,
    bajoMinimo: e.convocados.length > 0 && Math.round(exacta) < ANOTACION_MINIMA,
  };
}

/** «Proyección ≈ 52 puntos (entre 44 y 60)» */
export const textoProyeccion = (p: Proyeccion) => `Proyección ≈ ${p.puntos} puntos (entre ${p.desde} y ${p.hasta})`;
export const textoRival = (p: Proyeccion) => (p.rival.encaja == null ? "Sin partidos del rival todavía" : `El rival encaja de media ${red1(p.rival.encaja).toLocaleString("es-ES")} y anota ${red1(p.rival.anota ?? 0).toLocaleString("es-ES")}`);
const dos = (x: number) => x.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** «Factor rival 1,04: dificultad marcada: Baja · 1 partido del rival · historial 2025/26» (la linea de «Quién aporta»). */
export const textoFactor = (p: Proyeccion) => `Factor rival ${dos(p.factor)}: ${p.fuentesRival.join(" · ")}`;
/** «Corrección de sesgo ×1,04» (o null si no hay). */
export const textoCorreccion = (p: Proyeccion) => (Math.abs(p.correccion - 1) < 0.005 ? null : `Corrección de sesgo ×${dos(p.correccion)}`);

// ---------------------------------------------------------------- de los ficheros de estadisticas y de la liga
type JuegoSeason = { pn: number; eq: string; sec?: number; played?: boolean; pts?: number };
export type SeasonJson = { partidos: { pn: number; equipo: string; fecha: string; pf: number; rival: string }[]; players: { person_id?: string; games?: JuegoSeason[] }[] };
export type LigaJson = { grupos: Record<string, { nuestro: string; jornadas_cargadas: number[]; resultados: { jornada: number; local: string; visitante: string; pl: number | null; pv: number | null }[] }> };

/** Historial de cada persona con la temporada actual (solo las jornadas anteriores a `antesDe`, si se pide) y la anterior. */
export function historiales(actual: SeasonJson, anterior: SeasonJson | null, antesDe?: number) {
  const tramo = (s: SeasonJson | null, filtro: (g: JuegoSeason) => boolean) => {
    const m = new Map<string, Tramo>();
    for (const p of s?.players ?? []) {
      if (!p.person_id) continue;
      const t = { ...VACIO };
      for (const g of p.games ?? []) {
        if (!g.played || !filtro(g)) continue;
        t.pts += g.pts ?? 0; t.min += (g.sec ?? 0) / 60; t.partidos += 1;
      }
      m.set(p.person_id, t);
    }
    return m;
  };
  const a = tramo(actual, (g) => antesDe == null || g.pn < antesDe), b = tramo(anterior, () => true);
  return (id: string): Historial => ({ actual: a.get(id) ?? VACIO, anterior: b.get(id) ?? VACIO });
}

/** Partidos, puntos a favor y en contra de cada equipo de un grupo (antes de la jornada `antesDe`, si se pide), y la
 *  media del grupo. `clave` normaliza los nombres (los de la liga y los del calendario no se escriben igual). */
export function estadisticasGrupo(liga: LigaJson, grupo: string, clave: (n: string) => string, antesDe?: number) {
  const g = liga.grupos[grupo];
  const equipos = new Map<string, RivalStats>();
  const sumar = (n: string, pf: number, pc: number) => { const k = clave(n); const x = equipos.get(k) ?? { pj: 0, pf: 0, pc: 0 }; equipos.set(k, { pj: x.pj + 1, pf: x.pf + pf, pc: x.pc + pc }); };
  for (const r of g?.resultados ?? []) {
    if (r.pl == null || r.pv == null || (antesDe != null && r.jornada >= antesDe)) continue;
    sumar(r.local, r.pl, r.pv); sumar(r.visitante, r.pv, r.pl);
  }
  const todos = [...equipos.values()];
  const grupoStats: Grupo = { pj: todos.reduce((s, x) => s + x.pj, 0), pc: todos.reduce((s, x) => s + x.pc, 0) };
  const jornadas = new Set((g?.resultados ?? []).filter((r) => r.pl != null && (antesDe == null || r.jornada < antesDe)).map((r) => r.jornada)).size;
  return { rival: (n: string | null) => (n ? equipos.get(clave(n)) ?? null : null), grupo: grupoStats, jornadas };
}

export type PuntoCalibracion = { jornada: number; equipo: string; fecha: string; rival: string; proyeccion: number; desde: number; hasta: number; real: number; error: number; diferencia: number; sinCorreccion: number };

/** Calibracion (D124, D133): para cada partido nuestro ya cargado, la proyeccion con lo que se sabia ANTES de esa jornada
 *  (historial y liga hasta la jornada anterior, la dificultad que se marco y el historial del rival) y los que salen en
 *  la hoja de ese partido (los que de verdad fueron convocados), frente al resultado real. La correccion de sesgo de
 *  cada partido se aprende con los DEMAS (dejando uno fuera), para no usarse a si mismo. */
export function calibrar(o: {
  actual: SeasonJson; anterior: SeasonJson | null; liga: LigaJson; clave: (n: string) => string;
  letra: (id: string) => Letra | null; nombre: (id: string) => string; plantilla: string[];
  dificultad?: (fecha: string, equipo: string) => DificultadRival | null; historial?: (rival: string) => HistorialRival | null;
}): PuntoCalibracion[] {
  const base: { p: SeasonJson["partidos"][number]; r: Proyeccion }[] = [];
  const grupoDe = (eq: string) => Object.keys(o.liga.grupos).find((k) => o.liga.grupos[k].nuestro.toUpperCase() === eq.toUpperCase()) ?? null;
  for (const p of [...o.actual.partidos].sort((a, b) => a.pn - b.pn || a.equipo.localeCompare(b.equipo))) {
    const hist = historiales(o.actual, o.anterior, p.pn);
    const tasas = tasasPorLetra(o.plantilla.map((id) => ({ letra: o.letra(id), hist: hist(id) })));
    const ids = o.actual.players.filter((j) => j.person_id && (j.games ?? []).some((g) => g.pn === p.pn && g.eq.toUpperCase() === p.equipo.toUpperCase())).map((j) => j.person_id!);
    const g = grupoDe(p.equipo);
    const est = g ? estadisticasGrupo(o.liga, g, o.clave, p.pn) : null;
    base.push({ p, r: proyectar({
      convocados: ids.map((id) => ({ person_id: id, nombre: o.nombre(id), letra: o.letra(id), hist: hist(id) })),
      tasas, rival: est?.rival(p.rival) ?? null, grupo: est?.grupo ?? null, jornadasJugadas: est?.jornadas ?? p.pn - 1,
      dificultad: o.dificultad?.(p.fecha, p.equipo) ?? null, historial: o.historial?.(p.rival) ?? null,
    }) });
  }
  return base.map(({ p, r }) => {
    const c = correccionSesgo(base.filter((x) => x.p !== p).map((x) => ({ sinCorreccion: x.r.exacta, real: x.p.pf })));
    const exacta = r.exacta * c, puntos = Math.round(exacta);
    return { jornada: p.pn, equipo: p.equipo, fecha: p.fecha, rival: p.rival, proyeccion: puntos, desde: Math.round(exacta * (1 - r.margen)), hasta: Math.round(exacta * (1 + r.margen)),
      real: p.pf, error: Math.abs(puntos - p.pf), diferencia: puntos - p.pf, sinCorreccion: r.exacta };
  });
}

/** «Acierto de la proyección: error medio N puntos en M partidos · se queda corta en S puntos de media» (o «se pasa en
 *  S puntos de media» o «sin sesgo» si redondea a 0). */
export function resumenCalibracion(puntos: PuntoCalibracion[]) {
  if (!puntos.length) return null;
  const media = puntos.reduce((s, x) => s + x.error, 0) / puntos.length;
  const sesgo = puntos.reduce((s, x) => s + x.diferencia, 0) / puntos.length;
  const r = (x: number) => Math.round(x * 10) / 10, es = (x: number) => r(x).toLocaleString("es-ES");
  const textoSesgo = r(sesgo) === 0 ? "sin sesgo" : sesgo < 0 ? `se queda corta en ${es(-sesgo)} puntos de media` : `se pasa en ${es(sesgo)} puntos de media`;
  return { error: r(media), sesgo: r(sesgo), partidos: puntos.length, texto: `Acierto de la proyección: error medio ${es(media)} puntos en ${puntos.length} ${puntos.length === 1 ? "partido" : "partidos"} · ${textoSesgo}` };
}

// ---------------------------------------------------------------- lo que llega a la pantalla (solo gestores)
export type EquipoProy = "MdA" | "MdL";
export type DatosProyeccion = {
  hist: Record<string, Historial>;
  letras: Record<string, Letra | null>;
  tasas: { tasas: Record<Letra, number>; media: number };
  partidos: Partial<Record<EquipoProy, { rival: RivalStats | null; grupo: Grupo | null; jornadas: number; historial?: HistorialRival | null }>>;
  calibracion: { texto: string; error: number; sesgo: number; partidos: number; puntos: PuntoCalibracion[] } | null;
  /** Correccion de sesgo aprendida con todos los partidos jugados (regla d). */
  correccion?: number;
  temporada?: string;
};

/** La proyeccion de un equipo del domingo con los convocados que tenga ahora y la dificultad marcada (se recalcula con
 *  cada cambio). */
export function proyeccionDe(d: DatosProyeccion, equipo: EquipoProy, convocados: { person_id: string; nombre: string }[], dificultad?: DificultadRival | null): Proyeccion | null {
  const p = d.partidos[equipo];
  if (!p) return null;
  const sinHist: Historial = { actual: VACIO, anterior: VACIO };
  return proyectar({
    convocados: convocados.map((c) => ({ ...c, letra: d.letras[c.person_id] ?? null, hist: d.hist[c.person_id] ?? sinHist })),
    tasas: d.tasas, rival: p.rival, grupo: p.grupo, jornadasJugadas: p.jornadas,
    dificultad: dificultad ?? null, historial: p.historial ?? null, temporada: d.temporada, correccion: d.correccion ?? 1,
  });
}

/** El aviso de la anotacion minima, con el texto de los demas avisos. */
export const textoBajoMinimo = (p: Proyeccion) => `Proyección ≈ ${p.puntos} puntos: por debajo de la anotación mínima (${ANOTACION_MINIMA}).`;
