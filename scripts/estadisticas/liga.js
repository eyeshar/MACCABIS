/**
 * liga.js — resultados y clasificación de TODOS los equipos de nuestros dos grupos (G1 de MdA, G2 de MdL).
 *
 *   node scripts/estadisticas/liga.js [2026-27] [--dry]     (también lo llama `npm run jornada`)
 *
 * Entrada (fuera de git): fuentes_fbm/<temporada>/liga/*.xlsx (hojas de partidos donde NO jugamos; el nombre
 * lleva la jornada y el grupo: liga_J01_G1_<local>_vs_<visitante>_<hash>.xlsx) y fuentes_fbm/<temporada>/hojas/
 * (las nuestras). Cada hoja se identifica por su cabecera ("Estadísticas - A vs B - ..."), el grupo sale de
 * data/calendario_<temporada>.json (los rivales de MdA son del G1 y los de MdL del G2) y la jornada, del nombre
 * (liga/) o del calendario (nuestros partidos).
 *
 * Validaciones: la suma por jugador es igual al total de cada equipo (puntos, 2P, 3P, TL y faltas) y 2P×2 + 3P×3
 * + TL = puntos; ningún equipo juega dos veces en la misma jornada; el local/visitante de nuestros partidos
 * coincide con el calendario. Si algo no cuadra, NO se escribe nada.
 *
 * Salida PÚBLICA: data/liga_<temporada>.json, SOLO datos por equipo (resultados, clasificación, puntos a favor y en
 * contra, medias, racha, casa/fuera). Nunca nombres ni dorsales de jugadores (D73): los datos por jugador de otros
 * equipos son de terceros y sólo van a Supabase (plataforma/scripts/cargar_liga.mjs), para los gestores.
 *
 * Puntuación (Bases de los 47 JDM, deportes de equipo, 2.10.1 Baloncesto): 2 puntos por victoria y 1 por derrota; perder
 * por sanción = resultado 20-0. Desempate (2.9): puntos en los partidos entre los empatados, diferencia en ellos,
 * diferencia general, cociente y puntos a favor. Las incomparecencias no generan hoja (D29) y restan puntos, pero las
 * Bases no dicen cuántos (D74): se registran en `liga.incomparecencias` (grupo, jornada, local, visitante, no_presentado),
 * el partido se marca, cuenta como ganado para el que se presentó y perdido para el otro, sin puntos a favor ni en contra, y
 * los puntos del equipo que no se presentó se toman de la clasificación oficial de Deportes/web (rutina B de los jueves),
 * anotados en `liga.puntos_oficiales` ({ G1: { <id-equipo>: { pts, fecha } } }). Hasta entonces su casilla dice
 * "pendiente de la oficial" y el orden es provisional.
 */
const fs = require('fs');
const path = require('path');
const { leerHojaLiga, validarSumas } = require('./leer_hoja_liga');
const { normEquipo, pyRound, nombreTitulo } = require('./util');
const CONFIG = require('./temporadas.json');

const ROOT = path.resolve(__dirname, '..', '..');
const AVISO_CLASIFICACION = 'Clasificación calculada con las Bases del 47 JDM a partir de las hojas de estadística; pendiente de contrastar con la oficial (las incomparecencias restan puntos y no generan hoja, D29).';

const limpiaNombre = nombreTitulo;   // nombres en formato Título, los mismos que la pestaña Rivales 26/27
const slug = s => normEquipo(s).toLowerCase().replace(/ /g, '-');

/** Grupos y equipos desde el calendario propio. */
function contexto(temporada) {
  const cfg = CONFIG[temporada];
  if (!cfg) throw new Error(`No hay configuración para ${temporada}.`);
  const cal = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', `calendario_${temporada}.json`), 'utf8'));
  const grupos = {};
  for (const [codigo, info] of Object.entries(cal.equipos)) {
    const m = String(info.grupo).match(/\bG(\d+)\s*$/);
    const g = m ? 'G' + m[1] : info.grupo;
    const propio = cfg.nombres_club[codigo][1] || codigo;   // "MdA"
    grupos[g] = { clave: g, nombre: info.grupo, nuestro: codigo, equipos: new Map(), fechas: {}, jornadas: new Set() };
    grupos[g].equipos.set(normEquipo(codigo), { id: slug(codigo), nombre: propio, nuestro: true, codigo });
  }
  for (const p of cal.partidos.filter(p => p.fase === 'liga')) {
    const g = Object.values(grupos).find(x => x.nuestro === p.equipo);
    g.jornadas.add(p.jornada);
    if (p.fecha) g.fechas[p.jornada] = p.fecha;
    if (p.rival && !g.equipos.has(normEquipo(p.rival)))
      g.equipos.set(normEquipo(p.rival), { id: slug(p.rival), nombre: limpiaNombre(p.rival), nuestro: false });
  }
  return { cfg, cal, grupos };
}

/** Grupo de un partido a partir de los dos equipos de la hoja. */
function grupoDe(ctx, a, b) {
  const g = Object.values(ctx.grupos).filter(x => x.equipos.has(normEquipo(a)) && x.equipos.has(normEquipo(b)));
  if (g.length !== 1) throw new Error(`No sé de qué grupo es "${a}" - "${b}" (${g.length} coincidencias en el calendario).`);
  return g[0];
}

/** Jornada más reciente con fecha ≤ hoy en el grupo (para hojas nuevas de partidos donde no jugamos). */
function jornadaPorFecha(g, hoy = new Date().toISOString().slice(0, 10)) {
  const js = Object.entries(g.fechas).filter(([, f]) => f <= hoy).map(([j]) => +j);
  return js.length ? Math.max(...js) : null;
}

/** Identifica una hoja de partido en que NO jugamos (para procesar_jornada). */
function identificarHoja(temporada, fichero) {
  const ctx = contexto(temporada);
  const h = leerHojaLiga(fichero);
  const a = ctx.cfg.nombres_club;
  const propio = n => Object.values(a).flat().some(x => normEquipo(x) === normEquipo(n));
  const nuestro = propio(h.local) || propio(h.visitante);
  const g = grupoDe(ctx, h.local, h.visitante);
  return { hoja: h, ctx, grupo: g, nuestro, etiquetaOk: !!h.etiqueta && fichero && h.titulo.includes(ctx.cfg.etiqueta_fbm) };
}

function leerFuentes(temporada, ctx) {
  const base = path.join(ROOT, ctx.cfg.carpeta);
  const partidos = [], errores = [];
  const lee = (dir, fn) => fs.existsSync(path.join(base, dir))
    ? fs.readdirSync(path.join(base, dir)).filter(f => /\.xlsx$/i.test(f)).sort().forEach(f => fn(path.join(base, dir, f))) : null;

  lee('liga', f => {
    try {
      const h = leerHojaLiga(f);
      const g = grupoDe(ctx, h.local, h.visitante);
      const m = path.basename(f).match(/^liga_J(\d+)_(G\d+)_/i);
      if (!m) throw new Error(`${path.basename(f)}: el nombre no lleva jornada y grupo (liga_J01_G1_...).`);
      if (m[2].toUpperCase() !== g.clave) throw new Error(`${path.basename(f)}: el nombre dice ${m[2]} pero el calendario dice ${g.clave}.`);
      partidos.push({ grupo: g, jornada: +m[1], hoja: h, propio: false });
    } catch (e) { errores.push(e.message); }
  });
  lee('hojas', f => {
    try {
      const h = leerHojaLiga(f);
      const g = grupoDe(ctx, h.local, h.visitante);
      const esNuestro = n => normEquipo(n) === normEquipo(g.nuestro);
      const rival = esNuestro(h.local) ? h.visitante : h.local;
      const cal = ctx.cal.partidos.filter(p => p.equipo === g.nuestro && p.fase === 'liga' && !p.descansa && p.local === esNuestro(h.local) && normEquipo(p.rival) === normEquipo(rival));
      if (cal.length !== 1) throw new Error(`${path.basename(f)}: ${g.nuestro} contra ${rival} (${esNuestro(h.local) ? 'casa' : 'fuera'}): ${cal.length} partidos posibles en el calendario.`);
      partidos.push({ grupo: g, jornada: cal[0].jornada, hoja: h, propio: true });
    } catch (e) { errores.push(e.message); }
  });
  return { partidos, errores };
}

const cero = () => ({ pj: 0, g: 0, p: 0, pf: 0, pc: 0 });

function clasificar(equipos, juegos, cfgLiga, oficiales) {
  const t = new Map(equipos.map(e => [e.id, { ...e, ...cero(), pts: 0, np: 0, pts_pendiente: false, pts_fuente: null, casa: cero(), fuera: cero(), serie: [] }]));
  const sumar = (x, gana, pf, pc, donde) => {
    for (const o of [x, x[donde]]) { o.pj++; o[gana ? 'g' : 'p']++; o.pf += pf; o.pc += pc; }
  };
  for (const j of [...juegos].sort((a, b) => a.jornada - b.jornada)) {
    const L = t.get(j.local.id), V = t.get(j.visitante.id);
    if (j.incomp) {
      // Sin hoja: ganado para el que se presentó, perdido para el otro, sin puntos a favor ni en contra.
      const ganaL = j.no_presentado !== j.local.id;
      for (const [x, gana, donde] of [[L, ganaL, 'casa'], [V, !ganaL, 'fuera']]) { for (const o of [x, x[donde]]) { o.pj++; o[gana ? 'g' : 'p']++; } x.serie.push(gana ? 'G' : 'P'); }
      t.get(j.no_presentado).np++;
      continue;
    }
    sumar(L, j.pl > j.pv, j.pl, j.pv, 'casa'); sumar(V, j.pv > j.pl, j.pv, j.pl, 'fuera');
    L.serie.push(j.pl > j.pv ? 'G' : 'P'); V.serie.push(j.pv > j.pl ? 'G' : 'P');
  }
  for (const x of t.values()) {
    x.pts = x.g * cfgLiga.puntos_victoria + x.p * cfgLiga.puntos_derrota;   // para ordenar; con incomparecencias, ver abajo
    x.dif = x.pf - x.pc;
    if (x.np) {
      const of = oficiales && oficiales[x.id];
      if (of && Number.isFinite(of.pts)) { x.pts = of.pts; x.pts_fuente = 'oficial'; }
      else x.pts_pendiente = true;
    }
  }
  // Desempate (Bases 2.9): puntos y diferencia en los partidos entre empatados, diferencia general, cociente, puntos a favor.
  const entre = (x, grupo) => {
    let pts = 0, dif = 0;
    for (const j of juegos) {
      if (j.incomp) continue;
      const ids = [j.local.id, j.visitante.id];
      if (!ids.includes(x.id) || !ids.every(i => grupo.has(i))) continue;
      const mio = j.local.id === x.id ? j.pl : j.pv, suyo = j.local.id === x.id ? j.pv : j.pl;
      pts += mio > suyo ? cfgLiga.puntos_victoria : cfgLiga.puntos_derrota; dif += mio - suyo;
    }
    return { pts, dif };
  };
  const lista = [...t.values()];
  const empatados = new Map();
  for (const x of lista) (empatados.get(x.pts) || empatados.set(x.pts, new Set()).get(x.pts)).add(x.id);
  lista.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const grupo = empatados.get(a.pts);
    if (grupo.size > 1) {
      const ea = entre(a, grupo), eb = entre(b, grupo);
      if (eb.pts !== ea.pts) return eb.pts - ea.pts;
      if (eb.dif !== ea.dif) return eb.dif - ea.dif;
    }
    if (b.dif !== a.dif) return b.dif - a.dif;
    const qa = a.pc ? a.pf / a.pc : (a.pf ? Infinity : 0), qb = b.pc ? b.pf / b.pc : (b.pf ? Infinity : 0);
    if (qb !== qa) return qb - qa;
    if (b.pf !== a.pf) return b.pf - a.pf;
    return a.nombre.localeCompare(b.nombre, 'es');
  });
  return lista;
}

function estadisticasEquipo(x) {
  const m = (v, n) => (n ? pyRound(v / n, 1) : null);
  let racha = null;
  if (x.serie.length) {
    const ult = x.serie[x.serie.length - 1]; let n = 0;
    for (let i = x.serie.length - 1; i >= 0 && x.serie[i] === ult; i--) n++;
    racha = { tipo: ult, n };
  }
  const bloque = c => ({ ...c, media_pf: m(c.pf, c.pj), media_pc: m(c.pc, c.pj) });
  return {
    id: x.id, media_pf: m(x.pf, x.pj), media_pc: m(x.pc, x.pj), media_dif: m(x.pf - x.pc, x.pj),
    ultimos: x.serie.slice(-5), racha, casa: bloque(x.casa), fuera: bloque(x.fuera),
  };
}

function construir(temporada) {
  const ctx = contexto(temporada);
  const cfgLiga = ctx.cfg.liga;
  const errores = [], avisos = [];
  if (!cfgLiga) throw new Error(`temporadas.json no tiene "liga" para ${temporada}.`);

  const { partidos, errores: eLectura } = leerFuentes(temporada, ctx);
  errores.push(...eLectura);
  for (const p of partidos) errores.push(...validarSumas(p.hoja));

  // Un equipo no puede jugar dos veces en la misma jornada, ni un partido repetirse.
  const vistos = new Map();
  for (const p of partidos) for (const n of [p.hoja.local, p.hoja.visitante]) {
    const k = `${p.grupo.clave}|${p.jornada}|${normEquipo(n)}`;
    if (vistos.has(k)) errores.push(`${n} aparece dos veces en la jornada ${p.jornada} del ${p.grupo.clave} (${vistos.get(k)} y ${p.hoja.fichero}).`);
    vistos.set(k, p.hoja.fichero);
  }

  const publico = {
    temporada, generado: new Date().toISOString().slice(0, 10),
    clasificacion_estado: AVISO_CLASIFICACION,
    puntuacion: { victoria: cfgLiga.puntos_victoria, derrota: cfgLiga.puntos_derrota, incomparecencia: 'los puntos del equipo que no se presenta se toman de la clasificación oficial (D74)', perder_por_sancion: '20-0', fuente: 'Bases reguladoras de los 47 JDM, deportes de equipo, 2.10.1 Baloncesto' },
    fuente: 'Hojas de estadística de la app Afición FBM (resultado = suma de los puntos de cada equipo). Sólo datos por equipo.',
    grupos: {},
  };
  const privado = [];
  for (const g of Object.values(ctx.grupos)) {
    const mios = partidos.filter(p => p.grupo === g);
    const juegos = mios.map(p => {
      const h = p.hoja, [l, v] = h.equipos;
      const eq = n => g.equipos.get(normEquipo(n));
      const j = { jornada: p.jornada, fecha: g.fechas[p.jornada] || null, local: eq(h.local), visitante: eq(h.visitante), pl: l.totales.pts, pv: v.totales.pts, nuestro: p.propio };
      if (j.pl === j.pv) errores.push(`${h.fichero}: empate ${j.pl}-${j.pv}; en baloncesto hay prórroga, revisa la hoja.`);
      privado.push({ grupo: g.clave, jornada: p.jornada, fecha: j.fecha, local: j.local.nombre, visitante: j.visitante.nombre, pl: j.pl, pv: j.pv, fichero: h.fichero, equipos: h.equipos.map((e, i) => ({ equipo: (i ? j.visitante : j.local).nombre, jugadores: e.jugadores, totales: e.totales })) });
      return j;
    }).sort((a, b) => a.jornada - b.jornada || a.local.nombre.localeCompare(b.local.nombre, 'es'));

    for (const ic of (cfgLiga.incomparecencias || []).filter(i => i.grupo === g.clave)) {
      const eq = n => g.equipos.get(normEquipo(n));
      const L = eq(ic.local), V = eq(ic.visitante), NP = eq(ic.no_presentado);
      if (!L || !V || !NP || ![L, V].includes(NP)) { errores.push(`Incomparecencia mal anotada en ${g.clave} J${ic.jornada}: ${JSON.stringify(ic)}`); continue; }
      if (juegos.some(j => j.jornada === ic.jornada && [j.local.id, j.visitante.id].some(i => [L.id, V.id].includes(i)))) errores.push(`${g.clave} J${ic.jornada}: ${L.nombre} - ${V.nombre} figura como incomparecencia y también tiene hoja.`);
      juegos.push({ jornada: ic.jornada, fecha: g.fechas[ic.jornada] || null, local: L, visitante: V, pl: null, pv: null, incomp: true, no_presentado: NP.id });
    }
    juegos.sort((a, b) => a.jornada - b.jornada || a.local.nombre.localeCompare(b.local.nombre, 'es'));
    const equipos = [...g.equipos.values()];
    const tabla = clasificar(equipos, juegos, cfgLiga, (cfgLiga.puntos_oficiales || {})[g.clave]);
    const jornadas = [...new Set(juegos.map(j => j.jornada))].sort((a, b) => a - b);
    const descansan = {};
    for (const jn of jornadas) {
      const juegan = new Set(juegos.filter(j => j.jornada === jn).flatMap(j => [j.local.id, j.visitante.id]));
      const fuera = equipos.filter(e => !juegan.has(e.id)).map(e => e.nombre);
      if (equipos.length - fuera.length !== (Math.floor(equipos.length / 2) * 2)) avisos.push(`${g.clave} J${jn}: faltan hojas (juegan ${juegan.size} de ${Math.floor(equipos.length / 2) * 2} equipos).`);
      if (fuera.length) descansan[jn] = fuera;
    }
    publico.grupos[g.clave] = {
      nombre: g.nombre, nuestro: g.nuestro, jornadas_cargadas: jornadas,
      clasificacion: tabla.map((x, i) => ({ pos: i + 1, id: x.id, equipo: x.nombre, nuestro: x.nuestro, pj: x.pj, g: x.g, p: x.p, pf: x.pf, pc: x.pc, dif: x.dif,
        pts: x.pts_pendiente ? null : x.pts, ...(x.np ? { incomparecencias: x.np, pts_fuente: x.pts_fuente || 'pendiente de la oficial' } : {}) })),
      orden_provisional: tabla.some(x => x.pts_pendiente) || undefined,
      resultados: juegos.map(j => (j.incomp
        ? { jornada: j.jornada, fecha: j.fecha, local: j.local.nombre, visitante: j.visitante.nombre, incomparecencia: true, no_presentado: (j.no_presentado === j.local.id ? j.local : j.visitante).nombre }
        : { jornada: j.jornada, fecha: j.fecha, local: j.local.nombre, visitante: j.visitante.nombre, pl: j.pl, pv: j.pv })),
      descansan,
      equipos: Object.fromEntries(tabla.map(x => [x.id, { nombre: x.nombre, nuestro: x.nuestro, ...estadisticasEquipo(x) }])),
    };
  }
  return { publico, privado, errores, avisos, fuentes: partidos.length };
}

module.exports = { construir, contexto, identificarHoja, jornadaPorFecha, grupoDe, clasificar };

if (require.main === module) {
  const args = process.argv.slice(2);
  const temporada = args.find(a => /^\d{4}-\d{2}$/.test(a)) || '2026-27';
  const r = construir(temporada);
  console.log(`Liga ${temporada}: ${r.fuentes} hojas.`);
  r.avisos.forEach(a => console.log('  ! ' + a));
  if (r.errores.length) { console.log('\nERRORES — no se ha escrito nada:'); r.errores.forEach(e => console.log('  X ' + e)); process.exit(1); }
  for (const [k, g] of Object.entries(r.publico.grupos)) {
    console.log(`\n${k} — ${g.nombre}`);
    g.clasificacion.forEach(x => console.log(`  ${String(x.pos).padStart(2)} ${x.equipo.padEnd(22)} PJ${x.pj} G${x.g} P${x.p} ${x.pf}-${x.pc} (${x.dif >= 0 ? '+' : ''}${x.dif}) ${x.pts} pts${x.nuestro ? '  <- nosotros' : ''}`));
  }
  if (args.includes('--dry')) { console.log('\n[dry] no se ha escrito nada.'); process.exit(0); }
  const out = path.join(ROOT, 'data', `liga_${temporada}.json`);
  fs.writeFileSync(out, JSON.stringify(r.publico, null, 1) + '\n', 'utf8');
  console.log(`\nEscrito ${path.relative(ROOT, out)}.`);
}
