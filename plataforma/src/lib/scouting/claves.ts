// «Claves del partido» (D174): de cada rival, 4 o 5 frases con lo que hay que saber, calculadas con reglas fijas a partir
// de los datos de la liga de esta temporada (hojas de los dos grupos, D73) y del historial de Rivales 26/27. Funcion PURA:
// sin red, sin base y sin IA; la misma entrada da siempre las mismas claves y no se inventa nada. Solo lo que traen las
// hojas: puntos, 2P y 3P ANOTADOS, tiros libres anotados/intentados, faltas COMETIDAS y minutos (nada de rebotes,
// asistencias, perdidas, intentos de campo ni parciales por cuarto de partidos ajenos).
// Son datos de terceros por jugador (D73, D162): solo se ensenan con sesion. Nunca nuestros niveles ni datos internos.
import { bonito, claveNombre, dec, minimoPartidos, type FilaHoja, type JugadorLiga } from "../jugadoresLiga.ts";

// ----------------------------------------------------------------------------------------------- ajustes (un solo sitio)
export const AJUSTES = {
  minPartidos: 3,            // el rival tiene que haber jugado al menos 3 partidos; si no, «Pocos datos»
  umbral: 0.2,               // vía A: una clave comparada con la media de los equipos del grupo sale si se aparta un 20 % o más
  topEquipo: 3,              // vía A «Del equipo»: claves como mucho en la página del rival
  topJugadores: 3,           // vía B «Jugadores a vigilar»: líneas como mucho en la página del rival
  topTarjeta: 1,             // en las tarjetas (Panel y «Tu próximo partido»): la primera de cada vía
  desvMax: 2,                // tope de lo que se aparta al ordenar (una cifra disparada no tapa al resto)
  // vía A
  dependencia1: 0.35,        // el primero mete más del 35 % de los puntos...
  dependencia2: 0.55,        // ...o los dos primeros más del 55 %
  tlMinEquipo: 10,           // TL% del equipo: mínimo de intentos
  venido: 2 / 3,             // el más peligroso ha venido a menos de 2 de cada 3 partidos
  racha: 3,                  // racha de 3 o más
  paliza: 15,                // paliza = 15 puntos o más de diferencia
  apretado: 5,               // partido apretado = 5 puntos o menos
  fraccionPartidos: 0.5,     // paliza o apretados: al menos la mitad de sus partidos (y 2 como mínimo)
  comunesDif: 10,            // rival común: sale si el resultado es distinto o los márgenes se separan 10 puntos o más
  // vía B: cada jugador frente a los JUGADORES del grupo (con el mínimo de partidos de D169)
  puestoGrupo: 5,            // entre los 5 primeros del grupo por partido (puntos, triples, tiros libres intentados, faltas)
  picoTriples: 4,            // pico en un partido: 4 triples o más...
  picoPuntos: 20,            // ...o 20 puntos o más
  tlMinJugador: 6,           // libres: al menos 6 intentos...
  tlDifJugador: 0.15,        // ...y 15 puntos o más por debajo del TL% medio del grupo
  tlMinutosJugador: 600,     // ...solo entre quienes juegan minutos (10 min por partido o más, en segundos)
  importantes: 3,            // faltas: solo si es de los 3 de su equipo con más minutos o con más puntos por partido (y una línea por rival)
} as const;

/** Tema de cada regla de la vía A: de cada tema solo se queda la clave de más peso. */
const TEMA: Record<string, string> = {
  puntos: "anotacion", dependencia: "anotacion", encajados: "encajados", triples: "triples", triples_parte: "triples",
  tl_equipo: "libres", tl_provocan: "libres", mezcla: "libres", faltas_equipo: "faltas",
  rotacion: "rotacion", minutos_concentrados: "rotacion", peligroso_ausente: "rotacion",
  racha: "forma", paliza: "forma", apretados: "forma", comunes: "comunes",
  cruce_triples: "cruce", cruce_tl: "cruce", cruce_faltas: "cruce", historial: "historial", incomparecencias: "incomparecencias",
};

// ----------------------------------------------------------------------------------------------------- tipos
export type TipoClave = "cuidado" | "aprovechar" | "ojo" | "contexto" | "vigilar";
export const ETIQUETA: Record<TipoClave, string> = { cuidado: "Cuidado", aprovechar: "Aprovechar", ojo: "Ojo", contexto: "Contexto", vigilar: "Vigilar" };

export type Clave = {
  regla: string; tipo: TipoClave; etiqueta: string; texto: string;
  bloque: "equipo" | "jugadores";
  tema: string;
  valor: number | null;       // la cifra del rival que mueve la clave (en la vía B, su mejor puesto)
  referencia: number | null;  // con lo que se compara (media del grupo o umbral)
  peso: number;
};
export type ResultadoClaves = {
  partidos: number;           // partidos jugados por el rival (con marcador, sin incomparecencias)
  pocosDatos: string | null;  // «Pocos datos: N partidos jugados» (y entonces no hay claves)
  equipo: Clave[];            // vía A «Del equipo» (una por tema), como mucho `topEquipo`
  jugadores: Clave[];         // vía B «Jugadores a vigilar» (una línea por jugador), como mucho `topJugadores`
  disponiblesEquipo: number;      // cuántas cumplían su regla (una por tema), antes del tope
  disponiblesJugadores: number;   // cuántos jugadores cumplían alguna condición, antes del tope
  candidatas: Clave[];        // todas las reglas de la vía A que se cumplen, antes de quedarse con una por tema
};

/** Totales de un equipo en un partido (fila TOTALES de la hoja). */
export type EstEquipo = { pts: number; t2: number; t3: number; tl: number; tl_int: number; faltas: number };
export type PartidoClaves = {
  id?: string; jornada: number; local: string; visitante: string; pl: number | null; pv: number | null;
  incomparecencia?: boolean; no_presentado?: string; est?: { local: EstEquipo; visitante: EstEquipo };
};
/** Cara a cara con el club en temporadas anteriores (Rivales 26/27). Solo vale si el rival se identifica con seguridad. */
export type HistorialEntrada = {
  partidos: { fecha: string | null; pf: number; pc: number; nota?: string }[];   // pf: los nuestros; pc: los suyos
  homonimos: number;      // temporadas con el mismo nombre en otros distritos (no se sabe cual es)
  sinRastro: boolean;
};
export type EntradaClaves = {
  equipo: string;                  // el rival, como figura en los partidos y en las hojas
  nuestro: string;                 // nuestro equipo del grupo («MdA» o «MdL»)
  partidos: PartidoClaves[];       // todos los del grupo (resultados con la hoja por equipo)
  jugadores: JugadorLiga[];        // todos los jugadores de los equipos del grupo (hojas, D168)
  filas?: FilaHoja[];              // las hojas partido a partido (para los picos de un jugador); sin ellas no hay picos
  historial?: HistorialEntrada | null;
};

// ------------------------------------------------------------------------------------------------- utilidades
const norm = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const mismo = (a: string, b: string) => norm(a) === norm(b);
const EPS = 1e-9;
const pl = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const pct = (x: number) => `${Math.round(100 * x)} %`;
const media = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const suma = (v: number[]) => v.reduce((a, b) => a + b, 0);
const fecha = (f: string) => { const [, m, d] = f.split("-"); return `${+d}/${+m}/${f.slice(0, 4)}`; };

/** «alto» si v supera la media un 20 % o mas, «bajo» si queda un 20 % o mas por debajo. Devuelve tambien cuanto se aparta. */
function lado(v: number, ref: number | null): { lado: "alto" | "bajo"; desv: number } | null {
  if (ref === null || !(ref > 0)) return null;
  const d = v / ref - 1;
  if (d >= AJUSTES.umbral - EPS) return { lado: "alto", desv: d };
  if (d <= -AJUSTES.umbral + EPS) return { lado: "bajo", desv: -d };
  return null;
}

// ------------------------------------------------------------------------------------------- por equipo
type Juego = { jornada: number; rival: string; pf: number; pc: number; own?: EstEquipo; opp?: EstEquipo };
/** Los partidos jugados de un equipo (con marcador y sin incomparecencias), por jornada. */
function juegosDe(equipo: string, partidos: PartidoClaves[]): Juego[] {
  const out: Juego[] = [];
  for (const p of partidos) {
    if (p.incomparecencia || p.pl == null || p.pv == null) continue;
    const local = mismo(p.local, equipo), visita = mismo(p.visitante, equipo);
    if (!local && !visita) continue;
    out.push({
      jornada: p.jornada, rival: local ? p.visitante : p.local, pf: local ? p.pl : p.pv, pc: local ? p.pv : p.pl,
      own: p.est ? (local ? p.est.local : p.est.visitante) : undefined, opp: p.est ? (local ? p.est.visitante : p.est.local) : undefined,
    });
  }
  return out.sort((a, b) => a.jornada - b.jornada);
}

type MetricasEquipo = {
  n: number;
  pf: number; pc: number; t3: number; t3Parte: number; tlParte: number; tlPct: number | null; tli: number; tlProvoca: number; faltas: number;
  t3Conc: number; tlConc: number;
};
function metricasDe(juegos: Juego[]): MetricasEquipo | null {
  const j = juegos.filter((x) => x.own && x.opp);
  if (!j.length) return null;
  const n = j.length;
  const s = (f: (x: Juego) => number) => suma(j.map(f));
  const pts = s((x) => x.own!.pts), tl = s((x) => x.own!.tl), tli = s((x) => x.own!.tl_int), t3 = s((x) => x.own!.t3);
  return {
    n, pf: s((x) => x.pf) / n, pc: s((x) => x.pc) / n, t3: t3 / n, t3Parte: pts ? (3 * t3) / pts : 0, tlParte: pts ? tl / pts : 0,
    tlPct: tli ? tl / tli : null, tli, tlProvoca: tli / n, faltas: s((x) => x.own!.faltas) / n,
    t3Conc: s((x) => x.opp!.t3) / n, tlConc: s((x) => x.opp!.tl_int) / n,
  };
}

// ------------------------------------------------------------------------------------------ por jugador
type JugEquipo = { j: JugadorLiga; media: number; minP: number };
const delEquipo = (jugadores: JugadorLiga[], equipo: string) => jugadores.filter((j) => mismo(j.equipo, equipo));
const conMedias = (js: JugadorLiga[]): JugEquipo[] => js.filter((j) => j.pj > 0).map((j) => ({ j, media: j.pts / j.pj, minP: j.segundos / j.pj }));
/** Reparto de puntos: (primero, primeros dos) del equipo sobre el total de puntos de sus jugadores, solo entre quienes llegan al minimo. */
function reparto(js: JugadorLiga[], pjEquipo: number) {
  const min = minimoPartidos(pjEquipo);
  const total = suma(js.map((j) => j.pts));
  const orden = js.filter((j) => j.pj >= min).sort((a, b) => b.pts - a.pts || a.nombre.localeCompare(b.nombre, "es"));
  if (!total || !orden.length) return null;
  return { total, orden, top1: orden[0].pts / total, top2: (orden[0].pts + (orden[1]?.pts ?? 0)) / total };
}

// ------------------------------------------------------------------------------------------------- reglas
type Candidata = Omit<Clave, "peso" | "etiqueta" | "bloque" | "tema"> & { desv: number };

/** Las claves de un rival, ordenadas por peso (importancia × cuanto se aparta) y con tope. `tope: 0` = sin tope. */
export function clavesRival(e: EntradaClaves, opciones: { topEquipo?: number; topJugadores?: number } = {}): ResultadoClaves {
  const topEquipo = opciones.topEquipo ?? AJUSTES.topEquipo, topJugadores = opciones.topJugadores ?? AJUSTES.topJugadores;
  const juegos = juegosDe(e.equipo, e.partidos);
  const n = juegos.length;
  if (n < AJUSTES.minPartidos) {
    return { partidos: n, pocosDatos: `Pocos datos: ${pl(n, "partido jugado", "partidos jugados")}`, equipo: [], jugadores: [], disponiblesEquipo: 0, disponiblesJugadores: 0, candidatas: [] };
  }

  const equipos = [...new Set(e.partidos.flatMap((p) => [p.local, p.visitante]))].sort((a, b) => a.localeCompare(b, "es"));
  const otros = equipos.filter((q) => !mismo(q, e.equipo));
  const M = metricasDe(juegos);
  // La media del grupo no cuenta al rival: ni a el ni sus partidos (lo que otros anotan o encajan contra el).
  const juegosOtro = (q: string) => juegosDe(q, e.partidos).filter((x) => !mismo(x.rival, e.equipo));
  const mOtros = otros.map((q) => metricasDe(juegosOtro(q))).filter((m): m is MetricasEquipo => !!m);
  const medG = (f: (m: MetricasEquipo) => number) => media(mOtros.map(f));
  const out: Candidata[] = [];
  const add = (c: Candidata | null) => { if (c) out.push(c); };

  // Comparacion generica con la media del grupo: `alto`/`bajo` dicen que tipo sale por cada lado (null = ese lado no se dice).
  const comparar = (regla: string, v: number, ref: number | null, alto: TipoClave | null, bajo: TipoClave | null, texto: (l: "alto" | "bajo") => string) => {
    const c = lado(v, ref);
    if (!c) return;
    const tipo = c.lado === "alto" ? alto : bajo;
    if (tipo) add({ regla, tipo, texto: texto(c.lado), valor: v, referencia: ref, desv: c.desv });
  };

  if (M) {
    // 1) Como anotan
    const refPf = medG((m) => m.pf);
    comparar("puntos", M.pf, refPf, "cuidado", "aprovechar", () => `Anotan ${dec(M.pf)} puntos por partido (media del grupo: ${dec(refPf)})`);
    const refPc = medG((m) => m.pc);
    comparar("encajados", M.pc, refPc, "aprovechar", "cuidado", (l) => `Encajan ${l === "bajo" ? "solo " : ""}${dec(M.pc)} puntos por partido (media del grupo: ${dec(refPc)})`);
    const refT3 = medG((m) => m.t3);
    comparar("triples", M.t3, refT3, "cuidado", "aprovechar", () => `Meten ${dec(M.t3)} triples por partido (media del grupo: ${dec(refT3)})`);
    const refT3p = medG((m) => m.t3Parte);
    comparar("triples_parte", M.t3Parte, refT3p, "cuidado", null, () => `El ${pct(M.t3Parte)} de sus puntos son de triple (media del grupo: ${pct(refT3p ?? 0)})`);
    const refTlp = medG((m) => m.tlParte);
    comparar("mezcla", M.tlParte, refTlp, "ojo", null, () => `El ${pct(M.tlParte)} de sus puntos son de tiro libre (media del grupo: ${pct(refTlp ?? 0)})`);

    // 2) Tiros libres y faltas (equipo)
    if (M.tlPct !== null && M.tli >= AJUSTES.tlMinEquipo) {
      const intentos = suma(juegos.map((x) => x.own?.tl_int ?? 0)), anotados = suma(juegos.map((x) => x.own?.tl ?? 0));
      const pooled = (() => {
        const t = otros.flatMap(juegosOtro).filter((x) => x.own);
        const i = suma(t.map((x) => x.own!.tl_int));
        return i ? suma(t.map((x) => x.own!.tl)) / i : null;
      })();
      comparar("tl_equipo", M.tlPct, pooled, "ojo", "aprovechar", () => `Meten ${anotados} de ${intentos} en libres, el ${pct(M.tlPct!)} (media del grupo: ${pct(pooled ?? 0)})`);
    }
    const refFal = medG((m) => m.faltas);
    comparar("faltas_equipo", M.faltas, refFal, "aprovechar", "contexto", () => `Cometen ${dec(M.faltas)} faltas por partido (media del grupo: ${dec(refFal)})`);
    const refTlProv = medG((m) => m.tlProvoca);
    comparar("tl_provocan", M.tlProvoca, refTlProv, "cuidado", null, () => `Provocan ${dec(M.tlProvoca)} tiros libres por partido (media del grupo: ${dec(refTlProv)})`);

    // 5) Cruce con nosotros: su punto fuerte contra lo que encajamos nosotros
    const mNos = metricasDe(juegosDe(e.nuestro, e.partidos));
    if (mNos && mNos.n >= AJUSTES.minPartidos) {
      const cruce = (regla: string, suyo: number, nuestro: number, refSuyo: number | null, refNuestro: number | null, tipo: TipoClave, texto: (ref: number) => string) => {
        const a = lado(suyo, refSuyo), b = lado(nuestro, refNuestro);
        if (a?.lado === "alto" && b?.lado === "alto") add({ regla, tipo, texto: texto(refSuyo!), valor: suyo, referencia: refSuyo, desv: Math.min(a.desv, b.desv) + Math.abs(a.desv - b.desv) / 2 });
      };
      cruce("cruce_triples", M.t3, mNos.t3Conc, refT3, medG((m) => m.t3Conc), "cuidado",
        (r) => `Meten ${dec(M.t3)} triples por partido y nosotros encajamos ${dec(mNos.t3Conc)}; media del grupo: ${dec(r)}`);
      cruce("cruce_tl", M.tlProvoca, mNos.tlConc, refTlProv, medG((m) => m.tlConc), "cuidado",
        (r) => `Provocan ${dec(M.tlProvoca)} tiros libres por partido y nosotros concedemos ${dec(mNos.tlConc)}; media del grupo: ${dec(r)}`);
      cruce("cruce_faltas", M.faltas, mNos.faltas, refFal, refFal, "ojo",
        (r) => `Cometen ${dec(M.faltas)} faltas por partido y nosotros ${dec(mNos.faltas)}; media del grupo: ${dec(r)}`);
    }
  }

  // ---- por jugador
  const js = delEquipo(e.jugadores, e.equipo);
  const jm = conMedias(js);
  const min = minimoPartidos(n);
  const rep = reparto(js, n);
  const otrosJug = (q: string) => delEquipo(e.jugadores, q);
  // En las frases, «Nombre Apellidos» (la coma de «Apellidos, Nombre» chocaria con el resto del texto).
  const nombreDe = (j: JugadorLiga) => { const [ap, ...no] = bonito(j.nombre).split(/,\s*/); return no.length ? `${no.join(" ")} ${ap}` : ap; };

  // dependencia
  if (rep) {
    const [a, b] = rep.orden;
    const mediaTop = (k: "top1" | "top2") => media(otros.map((q) => { const jq = otrosJug(q); const r = reparto(jq, juegosDe(q, e.partidos).length); return r ? r[k] : NaN; }).filter((x) => !Number.isNaN(x)));
    if (rep.top1 >= AJUSTES.dependencia1 - EPS) {
      add({ regla: "dependencia", tipo: "cuidado", texto: `El ${pct(rep.top1)} de sus puntos los mete ${nombreDe(a)}`, valor: rep.top1, referencia: mediaTop("top1"), desv: Math.max(AJUSTES.umbral, rep.top1 / AJUSTES.dependencia1 - 1) });
    } else if (b && rep.top2 >= AJUSTES.dependencia2 - EPS) {
      add({ regla: "dependencia", tipo: "cuidado", texto: `${nombreDe(a)} y ${nombreDe(b)} meten el ${pct(rep.top2)} de sus puntos`, valor: rep.top2, referencia: mediaTop("top2"), desv: Math.max(AJUSTES.umbral, rep.top2 / AJUSTES.dependencia2 - 1) });
    }
  }

  // 3) Rotacion
  {
    const jugados = (q: string, np: number) => (np ? suma(otrosJug(q).map((j) => j.pj)) / np : null);
    const v = jugados(e.equipo, n);
    const ref = media(otros.map((q) => jugados(q, juegosDe(q, e.partidos).length)).filter((x): x is number => x !== null && x > 0));
    if (v !== null && v > 0) {
      comparar("rotacion", v, ref, "contexto", "ojo", (l) => `${l === "bajo" ? "Banquillo corto" : "Rotación amplia"}: ${dec(v)} jugadores de media (media del grupo: ${dec(ref)})`);
    }
    const concentrado = (js2: JugadorLiga[]) => {
      const tot = suma(js2.map((j) => j.segundos));
      return tot ? suma([...js2].sort((x, y) => y.segundos - x.segundos).slice(0, 5).map((j) => j.segundos)) / tot : null;
    };
    const c = concentrado(js);
    const refC = media(otros.map((q) => concentrado(otrosJug(q))).filter((x): x is number => x !== null));
    if (c !== null) comparar("minutos_concentrados", c, refC, "ojo", null, () => `Sus 5 primeros juegan el ${pct(c)} de los minutos (media del grupo: ${pct(refC ?? 0)})`);
  }
  // su jugador mas peligroso (D169) ha venido a menos de 2 de cada 3 partidos
  {
    const top = [...jm].filter(({ j }) => j.pj >= min).sort((x, y) => y.media - x.media || y.j.pts - x.j.pts || x.j.nombre.localeCompare(y.j.nombre, "es"))[0];
    if (top && top.j.pj / n < AJUSTES.venido - EPS) {
      add({
        regla: "peligroso_ausente", tipo: "ojo", valor: top.j.pj / n, referencia: AJUSTES.venido,
        texto: `${nombreDe(top.j)} (${dec(top.media)} puntos por partido) ha venido a ${top.j.pj} de ${n} partidos`,
        desv: Math.max(AJUSTES.umbral, 1 - top.j.pj / n / AJUSTES.venido),
      });
    }
  }

  // 4) Forma y contexto
  {
    const res = juegos.map((x) => (x.pf > x.pc ? "G" : "P"));
    let r = 0;
    while (r < res.length && res[res.length - 1 - r] === res[res.length - 1]) r++;
    if (r >= AJUSTES.racha) {
      const g = res[res.length - 1] === "G";
      add({ regla: "racha", tipo: "contexto", texto: `Llevan ${r} ${g ? "victorias" : "derrotas"} seguidas`, valor: r, referencia: AJUSTES.racha, desv: Math.max(AJUSTES.umbral, r / AJUSTES.racha - 1) });
    }
    const dif = juegos.map((x) => x.pf - x.pc);
    const falta = Math.max(2, Math.ceil(AJUSTES.fraccionPartidos * n - EPS));
    const gana = dif.filter((d) => d >= AJUSTES.paliza).length, pierde = dif.filter((d) => d <= -AJUSTES.paliza).length;
    if (Math.max(gana, pierde) >= falta) {
      const g = gana >= pierde, k = g ? gana : pierde;
      add({ regla: "paliza", tipo: "contexto", texto: `${g ? "Ganan" : "Pierden"} por ${AJUSTES.paliza} o más en ${k} de ${n} partidos`, valor: k / n, referencia: AJUSTES.fraccionPartidos, desv: Math.max(AJUSTES.umbral, k / n / AJUSTES.fraccionPartidos - 1) });
    }
    const ap = dif.filter((d) => Math.abs(d) <= AJUSTES.apretado).length;
    if (ap >= falta) add({ regla: "apretados", tipo: "contexto", texto: `${ap} de sus ${n} partidos se han decidido por ${AJUSTES.apretado} puntos o menos`, valor: ap / n, referencia: AJUSTES.fraccionPartidos, desv: Math.max(AJUSTES.umbral, ap / n / AJUSTES.fraccionPartidos - 1) });
  }
  // rivales comunes del grupo
  {
    const nuestros = juegosDe(e.nuestro, e.partidos);
    const comunes = juegos.flatMap((suyo) => {
      const nuestro = nuestros.find((x) => mismo(x.rival, suyo.rival));
      return nuestro && !mismo(suyo.rival, e.nuestro) ? [{ rival: suyo.rival, suyo: suyo.pf - suyo.pc, nuestro: nuestro.pf - nuestro.pc }] : [];
    });
    const mejor = comunes
      .filter((c) => c.suyo !== 0 && c.nuestro !== 0 && (Math.sign(c.suyo) !== Math.sign(c.nuestro) || Math.abs(c.suyo - c.nuestro) >= AJUSTES.comunesDif))
      .sort((a, b) => Math.abs(b.suyo - b.nuestro) - Math.abs(a.suyo - a.nuestro) || a.rival.localeCompare(b.rival, "es"))[0];
    if (mejor) {
      const suyo = mejor.suyo > 0 ? `Ganaron a ${mejor.rival} de ${mejor.suyo}` : `Perdieron con ${mejor.rival} de ${-mejor.suyo}`;
      const nuestro = mejor.nuestro > 0 ? `nosotros ganamos de ${mejor.nuestro}` : `nosotros perdimos de ${-mejor.nuestro}`;
      add({
        regla: "comunes", tipo: "contexto", texto: `${suyo}; ${nuestro}`, valor: mejor.suyo - mejor.nuestro, referencia: AJUSTES.comunesDif,
        desv: Math.max(AJUSTES.umbral, Math.abs(mejor.suyo - mejor.nuestro) / 50),
      });
    }
  }
  // incomparecencias (clasificacion oficial, D74)
  {
    const faltas = e.partidos.filter((p) => p.incomparecencia && p.no_presentado && mismo(p.no_presentado, e.equipo)).sort((a, b) => a.jornada - b.jornada);
    if (faltas.length) {
      add({
        regla: "incomparecencias", tipo: "contexto", valor: faltas.length, referencia: 0, desv: Math.max(AJUSTES.umbral, faltas.length),
        texto: `No se presentó a ${pl(faltas.length, "partido", "partidos")} (${faltas.map((p) => `J${p.jornada}`).join(", ")}); sus puntos salen de la clasificación oficial`,
      });
    }
  }

  // 5) Historial contra nosotros, SOLO si el rival se identifica con seguridad
  add(historial(e.historial));

  // Vía A: peso = cuanto se aparta de lo normal (con tope); una sola clave por tema (la de más peso); lo que no cambia el
  // partido, al final.
  const candidatas: (Clave & { alFinal: boolean })[] = out
    .map(({ desv, ...c }) => ({
      ...c, bloque: "equipo" as const, tema: TEMA[c.regla] ?? c.regla, etiqueta: ETIQUETA[c.tipo], peso: Math.round(Math.min(desv, AJUSTES.desvMax) * 1000) / 1000,
      alFinal: (c.regla === "faltas_equipo" || c.regla === "rotacion") && c.tipo === "contexto",
    }))
    .sort((a, b) => b.peso - a.peso || a.regla.localeCompare(b.regla));
  const porTema = new Map<string, Clave & { alFinal: boolean }>();
  for (const c of candidatas) if (!porTema.has(c.tema)) porTema.set(c.tema, c);
  // Primero lo que cambia el partido, luego los «Contexto» (racha, comunes, historial…) y, al final, lo que no lo cambia.
  const escalon = (c: Clave & { alFinal: boolean }) => (c.alFinal ? 2 : c.tipo === "contexto" ? 1 : 0);
  const ordenadas = [...porTema.values()].sort((a, b) => escalon(a) - escalon(b) || b.peso - a.peso || a.regla.localeCompare(b.regla));
  const quitar = ({ alFinal: _f, ...c }: Clave & { alFinal: boolean }): Clave => c;
  const jugadores = vigilar(e, n, nombreDe);
  return {
    partidos: n, pocosDatos: null, disponiblesEquipo: ordenadas.length, disponiblesJugadores: jugadores.length,
    equipo: (topEquipo > 0 ? ordenadas.slice(0, topEquipo) : ordenadas).map(quitar),
    jugadores: topJugadores > 0 ? jugadores.slice(0, topJugadores) : jugadores,
    candidatas: candidatas.map(quitar),
  };
}

/** Vía B «Jugadores a vigilar»: cada jugador del rival frente a los JUGADORES del grupo (con el mínimo de partidos de D169).
 *  Sale si es de los 5 primeros del grupo por partido en puntos, triples, tiros libres intentados o faltas, si tuvo un pico
 *  en un partido (4 triples o más, o 20 puntos o más) o si tira mal los libres. Una línea por jugador, con su puesto. */
function vigilar(e: EntradaClaves, n: number, nombreDe: (j: JugadorLiga) => string): Clave[] {
  const pjEq = new Map<string, number>();
  const pjDe = (q: string) => { const k = norm(q); if (!pjEq.has(k)) pjEq.set(k, juegosDe(q, e.partidos).length); return pjEq.get(k)!; };
  const pool = e.jugadores.filter((j) => j.pj > 0 && j.pj >= minimoPartidos(pjDe(j.equipo)));
  const suyos = pool.filter((j) => mismo(j.equipo, e.equipo));
  // media de tiros libres del grupo (los jugadores de los demás equipos)
  const resto = pool.filter((j) => !mismo(j.equipo, e.equipo));
  const intentosResto = suma(resto.map((j) => j.tli));
  const refTl = intentosResto ? suma(resto.map((j) => j.tla)) / intentosResto : null;

  const STATS = [
    { k: "pts", valor: (j: JugadorLiga) => j.pts / j.pj, texto: (v: number, primero: boolean) => (primero ? `${dec(v)} pts por partido` : `${dec(v)} pts`) },
    { k: "p3a", valor: (j: JugadorLiga) => j.p3a / j.pj, texto: (v: number, primero: boolean) => (primero ? `${dec(v)} triples por partido` : `${dec(v)} triples`) },
    { k: "tli", valor: (j: JugadorLiga) => j.tli / j.pj, texto: (v: number, primero: boolean) => (primero ? `${dec(v)} tiros libres intentados por partido` : `${dec(v)} tiros libres intentados`) },
    { k: "faltas", valor: (j: JugadorLiga) => j.faltas / j.pj, texto: (v: number, primero: boolean) => (primero ? `${dec(v)} faltas por partido` : `${dec(v)} faltas`) },
  ] as const;
  const puesto = (j: JugadorLiga, f: (x: JugadorLiga) => number) => 1 + pool.filter((x) => f(x) > f(j) + EPS).length;

  // picos: de las hojas partido a partido
  const rival = (jornada: number) => {
    const p = e.partidos.find((x) => x.jornada === jornada && (mismo(x.local, e.equipo) || mismo(x.visitante, e.equipo)));
    return p ? (mismo(p.local, e.equipo) ? p.visitante : p.local) : null;
  };
  const filasDe = (j: JugadorLiga) => (e.filas ?? []).filter((f) => mismo(f.equipo, e.equipo) && f.grupo === j.grupo && claveNombre(f.nombre) === claveNombre(j.nombre) && f.segundos > 0);

  // Faltas: solo de un jugador importante (de los 3 de su equipo con más minutos o con más puntos por partido) y como mucho una línea
  // de faltas por rival: la del mejor puesto.
  const importantes = new Set([
    ...[...suyos].sort((a, b) => b.segundos / b.pj - a.segundos / a.pj || a.nombre.localeCompare(b.nombre, "es")).slice(0, AJUSTES.importantes),
    ...[...suyos].sort((a, b) => b.pts / b.pj - a.pts / a.pj || a.nombre.localeCompare(b.nombre, "es")).slice(0, AJUSTES.importantes),
  ]);
  const fFaltas = STATS[3].valor;
  const conFaltas = [...importantes].filter((j) => fFaltas(j) > 0 && puesto(j, fFaltas) <= AJUSTES.puestoGrupo)
    .sort((a, b) => puesto(a, fFaltas) - puesto(b, fFaltas) || fFaltas(b) - fFaltas(a) || a.nombre.localeCompare(b.nombre, "es"))[0];

  const lineas: (Clave & { mejor: number; criterios: number })[] = [];
  for (const j of suyos) {
    const rank = STATS.map((s) => ({ s, v: s.valor(j), p: puesto(j, s.valor) })).filter((x) => x.v > 0 && x.p <= AJUSTES.puestoGrupo && (x.s.k !== "faltas" || j === conFaltas)).sort((a, b) => a.p - b.p || STATS.indexOf(a.s) - STATS.indexOf(b.s));
    const partes = rank.map((x, i) => `${x.s.texto(x.v, i === 0)} (${x.p}.º${i === 0 ? " del grupo" : ""})`);
    const segmentos: string[] = [];
    if (partes.length) segmentos.push(partes.length > 1 ? `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}` : partes[0]);

    // pico en un partido
    const filas = filasDe(j);
    const duplicado = new Set(filas.map((f) => f.partido_id)).size !== filas.length;
    let pico = "";
    if (filas.length && !duplicado) {
      const mejorPts = [...filas].sort((a, b) => b.pts - a.pts || b.jornada - a.jornada)[0];
      const mejorT3 = [...filas].sort((a, b) => b.p3a - a.p3a || b.jornada - a.jornada)[0];
      const hayPts = mejorPts.pts >= AJUSTES.picoPuntos, hayT3 = mejorT3.p3a >= AJUSTES.picoTriples;
      const contra = (f: FilaHoja) => { const r = rival(f.jornada); return r ? ` contra ${r}` : ""; };
      if (hayPts && hayT3 && mejorPts.partido_id === mejorT3.partido_id) pico = `metió ${mejorPts.pts} puntos y ${mejorPts.p3a} triples${contra(mejorPts)}`;
      else {
        const cl = [hayPts ? `${mejorPts.pts} puntos${contra(mejorPts)}` : "", hayT3 ? `${mejorT3.p3a} triples${contra(mejorT3)}` : ""].filter(Boolean);
        if (cl.length) pico = `metió ${cl.join(" y ")}`;
      }
    }
    if (pico) segmentos.push(pico);

    // libres: lo que tira mal, con su recuento y de que
    let tlMal = false;
    if (refTl !== null && j.tli >= AJUSTES.tlMinJugador && j.segundos / j.pj >= AJUSTES.tlMinutosJugador && j.tla / j.tli <= refTl - AJUSTES.tlDifJugador + EPS) {
      tlMal = true;
      segmentos.push(`${j.tla} de ${j.tli} en libres (media del grupo: ${pct(refTl)})`);
    }
    if (!segmentos.length) continue;
    const mejor = rank.length ? rank[0].p : 99;
    const vigila = rank.some((x) => x.s.k !== "faltas") || !!pico;
    lineas.push({
      regla: "jugador", bloque: "jugadores", tema: "jugador", tipo: vigila ? "vigilar" : "aprovechar", etiqueta: ETIQUETA[vigila ? "vigilar" : "aprovechar"],
      texto: `${nombreDe(j)}: ${segmentos.join("; ")}`, valor: rank.length ? mejor : null, referencia: AJUSTES.puestoGrupo,
      peso: rank.length ? Math.round((1 - (mejor - 1) / (AJUSTES.puestoGrupo + 1)) * 1000) / 1000 : pico ? 0.1 : 0.05,
      mejor, criterios: segmentos.length,
    });
  }
  void n;
  return lineas
    .sort((a, b) => a.mejor - b.mejor || b.criterios - a.criterios || a.texto.localeCompare(b.texto, "es"))
    .map(({ mejor: _m, criterios: _c, ...c }) => c);
}

/** Historial contra nosotros en temporadas anteriores. Sin rastro, con homonimos en otros distritos o con algun partido que
 *  solo figura por el nombre (sin codigo de equipo, nota de Rivales 26/27), no sale: si hay duda, nada (D174). */
function historial(h: HistorialEntrada | null | undefined): Candidata | null {
  if (!h || h.sinRastro || h.homonimos > 0 || !h.partidos.length || h.partidos.some((p) => p.nota)) return null;
  const ps = h.partidos;
  const g = ps.filter((p) => p.pf > p.pc).length, d = ps.length - g;
  const dif = suma(ps.map((p) => p.pf - p.pc)) / ps.length;
  const ult = [...ps].filter((p) => p.fecha).sort((a, b) => (a.fecha! < b.fecha! ? 1 : -1))[0];
  const ultimo = ult ? `; último: ${ult.pf > ult.pc ? "ganamos" : "perdimos"} ${ult.pf}-${ult.pc} (${fecha(ult.fecha!)})` : "";
  return {
    regla: "historial", tipo: "contexto", valor: dif, referencia: null, desv: Math.max(AJUSTES.umbral, Math.abs(dif) / 50),
    texto: `Contra ellos en temporadas anteriores: ${pl(g, "victoria", "victorias")} y ${pl(d, "derrota", "derrotas")}${ultimo}; diferencia media: ${dif > 0 ? "+" : ""}${dec(dif)}`,
  };
}

/** Las de las tarjetas (Panel y «Tu proximo partido»): la primera de cada via. */
export const primerasClaves = (r: ResultadoClaves, n: number = AJUSTES.topTarjeta) => [...r.equipo.slice(0, n), ...r.jugadores.slice(0, n)];
/** «Cuidado: …» en una sola linea. */
export const lineaClave = (c: Pick<Clave, "etiqueta" | "texto">) => `${c.etiqueta}: ${c.texto}`;
