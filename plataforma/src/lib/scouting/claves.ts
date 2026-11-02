// «Claves del partido» (D174): de cada rival, 4 o 5 frases con lo que hay que saber, calculadas con reglas fijas a partir
// de los datos de la liga de esta temporada (hojas de los dos grupos, D73) y del historial de Rivales 26/27. Funcion PURA:
// sin red, sin base y sin IA; la misma entrada da siempre las mismas claves y no se inventa nada. Solo lo que traen las
// hojas: puntos, 2P y 3P ANOTADOS, tiros libres anotados/intentados, faltas COMETIDAS y minutos (nada de rebotes,
// asistencias, perdidas, intentos de campo ni parciales por cuarto de partidos ajenos).
// Son datos de terceros por jugador (D73, D162): solo se ensenan con sesion. Nunca nuestros niveles ni datos internos.
import { bonito, dec, minimoPartidos, type JugadorLiga } from "../jugadoresLiga.ts";

// ----------------------------------------------------------------------------------------------- ajustes (un solo sitio)
export const AJUSTES = {
  minPartidos: 3,            // el rival tiene que haber jugado al menos 3 partidos; si no, «Pocos datos»
  umbral: 0.2,               // una clave comparada con la media del grupo sale si se aparta un 20 % o mas
  topPagina: 5,              // claves como mucho en la pagina del rival
  topTarjeta: 2,             // y las primeras en las tarjetas (Panel y «Tu proximo partido»)
  // anotan
  dependencia1: 0.35,        // el primero mete mas del 35 % de los puntos...
  dependencia2: 0.55,        // ...o los dos primeros mas del 55 %
  triplesJugador: 0.4,       // uno mete el 40 % o mas de los triples de su equipo
  triplesMinEquipo: 5,       // ...si el equipo ha metido al menos 5 (con menos es ruido)
  // tiros libres y faltas
  tlMinEquipo: 10,           // TL% del equipo: minimo de intentos
  tlMinJugador: 6,           // TL% de un jugador: minimo de intentos
  tlDifJugador: 0.15,        // ...y 15 puntos o mas por debajo de la media del grupo
  tlMinutosJugador: 600,     // ...solo entre quienes juegan minutos (10 min por partido o mas, en segundos)
  faltasJugador: 3.5,        // un jugador importante con 3,5 faltas o mas por partido
  importantes: 3,            // «importante» = de los 3 que mas anotan o de los 3 que mas minutos juegan
  // rotacion
  venido: 2 / 3,             // el mas peligroso ha venido a menos de 2 de cada 3 partidos
  // forma y contexto
  racha: 3,                  // racha de 3 o mas
  paliza: 15,                // paliza = 15 puntos o mas de diferencia
  apretado: 5,               // partido apretado = 5 puntos o menos
  fraccionPartidos: 0.5,     // paliza o apretados: al menos la mitad de sus partidos (y 2 como minimo)
  desvMax: 2,                // tope de lo que se aparta al ordenar (una cifra disparada no tapa al resto)
  comunesDif: 10,            // rival comun: sale si el resultado es distinto o los margenes se separan 10 puntos o mas
} as const;

/** Importancia de cada regla (el orden es peso = importancia × cuanto se aparta de la media o del umbral). */
const IMPORTANCIA: Record<string, number> = {
  cruce_triples: 3, cruce_tl: 3, cruce_faltas: 2, dependencia: 3, triples_jugador: 2.5, puntos: 2, encajados: 2, triples: 2,
  triples_parte: 1.5, mezcla: 1.5, tl_equipo: 2, tl_jugadores: 2.5, faltas_equipo: 2, faltas_jugador: 2.5, tl_provocan: 2,
  rotacion: 2, minutos_concentrados: 2, peligroso_ausente: 2.5, racha: 1, paliza: 1, apretados: 1, comunes: 1,
  incomparecencias: 1, historial: 0.8,
};

// ----------------------------------------------------------------------------------------------------- tipos
export type TipoClave = "cuidado" | "aprovechar" | "ojo" | "contexto";
export const ETIQUETA: Record<TipoClave, string> = { cuidado: "Cuidado", aprovechar: "Aprovechar", ojo: "Ojo", contexto: "Contexto" };

export type Clave = {
  regla: string; tipo: TipoClave; etiqueta: string; texto: string;
  valor: number | null;       // la cifra del rival que mueve la clave
  referencia: number | null;  // con lo que se compara (media del grupo o umbral)
  peso: number;
};
export type ResultadoClaves = {
  partidos: number;           // partidos jugados por el rival (con marcador, sin incomparecencias)
  pocosDatos: string | null;  // «Pocos datos: N partidos jugados» (y entonces claves = [])
  disponibles: number;        // cuantas claves cumplian su regla, antes del tope
  claves: Clave[];
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
type Candidata = Omit<Clave, "peso" | "etiqueta"> & { desv: number };

/** Las claves de un rival, ordenadas por peso (importancia × cuanto se aparta) y con tope. `tope: 0` = sin tope. */
export function clavesRival(e: EntradaClaves, opciones: { tope?: number } = {}): ResultadoClaves {
  const tope = opciones.tope ?? AJUSTES.topPagina;
  const juegos = juegosDe(e.equipo, e.partidos);
  const n = juegos.length;
  if (n < AJUSTES.minPartidos) {
    return { partidos: n, pocosDatos: `Pocos datos: ${pl(n, "partido jugado", "partidos jugados")}`, disponibles: 0, claves: [] };
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
    comparar("encajados", M.pc, refPc, "aprovechar", "cuidado", () => `Encajan ${dec(M.pc)} puntos por partido (media del grupo: ${dec(refPc)})`);
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

  // quien tira los triples
  const triplesEq = suma(js.map((j) => j.p3a));
  if (triplesEq >= AJUSTES.triplesMinEquipo) {
    const t = js.filter((j) => j.pj >= min).sort((x, y) => y.p3a - x.p3a || x.nombre.localeCompare(y.nombre, "es"))[0];
    if (t && t.p3a / triplesEq >= AJUSTES.triplesJugador - EPS) {
      add({ regla: "triples_jugador", tipo: "cuidado", texto: `${nombreDe(t)} mete el ${pct(t.p3a / triplesEq)} de sus triples (${t.p3a} de ${triplesEq})`, valor: t.p3a / triplesEq, referencia: AJUSTES.triplesJugador, desv: Math.max(AJUSTES.umbral, t.p3a / triplesEq / AJUSTES.triplesJugador - 1) });
    }
  }

  // jugadores que tiran mal los libres: por debajo de la media del grupo, entre quienes juegan minutos
  {
    const resto = otros.flatMap(otrosJug);
    const i = suma(resto.map((j) => j.tli));
    const refTl = i ? suma(resto.map((j) => j.tla)) / i : null;
    if (refTl !== null) {
      const flojos = jm
        .filter(({ j, minP }) => j.tli >= AJUSTES.tlMinJugador && minP >= AJUSTES.tlMinutosJugador && j.pj >= min && j.tla / j.tli <= refTl - AJUSTES.tlDifJugador + EPS)
        .sort((x, y) => x.j.tla / x.j.tli - y.j.tla / y.j.tli || x.j.nombre.localeCompare(y.j.nombre, "es")).slice(0, 2);
      if (flojos.length) {
        const peor = flojos[0].j;
        add({
          regla: "tl_jugadores", tipo: "aprovechar", valor: peor.tla / peor.tli, referencia: refTl,
          texto: `${flojos.map(({ j }) => `${nombreDe(j)}: ${j.tla} de ${j.tli} en libres`).join("; ")} (media del grupo: ${pct(refTl)})`,
          desv: Math.max(AJUSTES.umbral, (refTl - peor.tla / peor.tli) / refTl),
        });
      }
    }
  }

  // faltas de un jugador importante
  {
    const porPuntos = [...jm].filter(({ j }) => j.pj >= min).sort((x, y) => y.media - x.media || x.j.nombre.localeCompare(y.j.nombre, "es")).slice(0, AJUSTES.importantes);
    const porMinutos = [...jm].filter(({ j }) => j.pj >= min).sort((x, y) => y.minP - x.minP || x.j.nombre.localeCompare(y.j.nombre, "es")).slice(0, AJUSTES.importantes);
    const imp = [...new Set([...porPuntos, ...porMinutos])]
      .filter(({ j }) => j.faltas / j.pj >= AJUSTES.faltasJugador - EPS)
      .sort((x, y) => y.j.faltas / y.j.pj - x.j.faltas / x.j.pj || x.j.nombre.localeCompare(y.j.nombre, "es")).slice(0, 2);
    if (imp.length) {
      const fpp = (j: JugadorLiga) => j.faltas / j.pj;
      add({
        regla: "faltas_jugador", tipo: "aprovechar", valor: fpp(imp[0].j), referencia: AJUSTES.faltasJugador,
        texto: imp.map(({ j }) => `${nombreDe(j)}: ${dec(fpp(j))} faltas por partido`).join("; "),
        desv: Math.max(AJUSTES.umbral, fpp(imp[0].j) / AJUSTES.faltasJugador - 1),
      });
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
        desv: Math.max(AJUSTES.umbral, Math.abs(mejor.suyo - mejor.nuestro) / AJUSTES.comunesDif - 1),
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

  const claves: Clave[] = out
    .map(({ desv, ...c }) => ({ ...c, etiqueta: ETIQUETA[c.tipo], peso: Math.round((IMPORTANCIA[c.regla] ?? 1) * Math.min(desv, AJUSTES.desvMax) * 1000) / 1000 }))
    .sort((a, b) => b.peso - a.peso || a.regla.localeCompare(b.regla));
  return { partidos: n, pocosDatos: null, disponibles: claves.length, claves: tope > 0 ? claves.slice(0, tope) : claves };
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
    regla: "historial", tipo: "contexto", valor: dif, referencia: null, desv: Math.max(AJUSTES.umbral, Math.abs(dif) / 20),
    texto: `Contra ellos en temporadas anteriores: ${pl(g, "victoria", "victorias")} y ${pl(d, "derrota", "derrotas")}${ultimo}; diferencia media: ${dif > 0 ? "+" : ""}${dec(dif)}`,
  };
}

/** Las primeras claves (tarjetas del Panel y de «Tu proximo partido»). */
export const primerasClaves = (r: ResultadoClaves, n: number = AJUSTES.topTarjeta) => r.claves.slice(0, n);
/** «Cuidado: …» en una sola linea. */
export const lineaClave = (c: Pick<Clave, "etiqueta" | "texto">) => `${c.etiqueta}: ${c.texto}`;
