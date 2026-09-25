/**
 * generar_temporada.js
 *
 * Genera data/season_<temporada>.json a partir de los ficheros de la FBM que Iván deja en
 * fuentes_fbm/<temporada>/ (carpeta local, FUERA de git):
 *
 *   fuentes_fbm/<temporada>/actas/Acta-Partido-<nº>.pdf          (acta digital, una por partido)
 *   fuentes_fbm/<temporada>/hojas/estadisticaPartido_<j>_<eq>.xlsx  (app Afición FBM)
 *   fuentes_fbm/<temporada>/asistencia/...                        (SportEasy, opcional)
 *
 * Sustituye al pipeline de 2025/26 (parse_stats.py + consolidate.py, que leían de una carpeta
 * del chat de Claude) y reproduce su salida: ver test_regresion_2025_26.js.
 *
 * REGLAS DE NEGOCIO (ESTADO.md, "Reglas de negocio ya establecidas"):
 *  - Puntos por jugador SÓLO de la hoja XLSX; del acta salen fecha, hora, pista, marcador y
 *    parciales. La suma de puntos de la hoja TIENE que dar el marcador del acta, y la suma de
 *    parciales también: si no, el script se para (no publica nada).
 *  - Medias SÓLO sobre partidos jugados (minutos > 0). Los DNP cuentan como convocatoria.
 *  - El entrenador (Carlos Barreiro, es_entrenador en personas.json) nunca cuenta como jugador.
 *  - Identidad por person_id del registro. Un nombre que no esté en el registro PARA el
 *    proceso: una persona nueva la confirma Iván, no el script.
 *  - Columnas que la liga no registra (rebotes, asistencias, robos...) se descartan.
 *
 * USO:  node scripts/estadisticas/generar_temporada.js <temporada> [--dry]
 */
const fs = require('fs');
const path = require('path');
const { pyRound, pyTitle, limpia, normEquipo } = require('./util');
const { leerActa } = require('./leer_acta');
const { leerHoja } = require('./leer_hoja');
const { leerAsistencia } = require('./asistencia');
const { partidosDelClub } = require('./calendario_abierto');
const { slug } = require('../parse_diccionario.js');
const { ALIAS } = require('../build_personas.js');

const ROOT = path.resolve(__dirname, '..', '..');
const CONFIG = require('./temporadas.json');

/** "MARTIN-ORTEGA RICO, EDUARDO" -> "Eduardo Martin-Ortega Rico" (mismo criterio que 25/26). */
const displayDe = nombre => { const [ap, no] = nombre.split(',').map(limpia); return pyTitle(no ? no + ' ' + ap : ap); };

/**
 * Núcleo puro (sin ficheros): recibe lo ya leído y devuelve el JSON de la temporada.
 * @returns {{ json, errores: string[], avisos: string[], enlaces: object[] }}
 */
function construir({ temporada, cfg, actas, hojas, asistencia, calendario, personas, fichas }) {
  const errores = [], avisos = [];
  const club = cfg.nombres_club;                       // { MDA: ['MDA'], MDL: ['MDL'] }
  const esNuestro = (nombre, eq) => club[eq].some(x => normEquipo(x) === normEquipo(nombre));
  const reg = new Map(personas.map(p => [p.person_id, p]));
  const canon = id => ALIAS[id] || id;
  const aliasNombre = cfg.alias_nombres || {};
  const pidDe = nombre => canon(slug(aliasNombre[nombre] || nombre));

  // ---------------------------------------------------------------- actas
  const partidos = [];
  for (const a of actas) {
    const eq = Object.keys(club).find(e => esNuestro(a.equipoA, e) || esNuestro(a.equipoB, e));
    if (!eq) { avisos.push(`${a.fichero}: ni ${a.equipoA} ni ${a.equipoB} son nuestros; se ignora.`); continue; }
    const somosA = esNuestro(a.equipoA, eq);
    const pf = somosA ? a.tanteoA : a.tanteoB, pc = somosA ? a.tanteoB : a.tanteoA;
    const incomp = pf === 0 && pc === 0;
    const sumaUs = a.cuartos.reduce((s, c) => s + (somosA ? c.a : c.b), 0);
    const sumaThem = a.cuartos.reduce((s, c) => s + (somosA ? c.b : c.a), 0);
    if (!incomp && (sumaUs !== pf || sumaThem !== pc))
      errores.push(`${a.fichero}: los parciales (${sumaUs}-${sumaThem}) no suman el marcador (${pf}-${pc}).`);
    partidos.push({ acta: a, eq, somosA, pf, pc, incomp, rivalActa: somosA ? a.equipoB : a.equipoA });
  }

  // ---------------------------------------------------------------- hojas <-> actas
  // Se enlazan por equipo + rival + marcador (la hoja no trae nº de partido). Nunca por orden.
  const enlaces = [];
  for (const h of hojas) {
    const sumaHoja = h.jugadores.reduce((s, j) => s + j.pts, 0);
    const esLocal = club[h.equipo].some(x => normEquipo(x) === normEquipo(h.local));
    const rivalHoja = esLocal ? h.visitante : h.local;
    const cands = partidos.filter(p => p.eq === h.equipo && normEquipo(p.rivalActa) === normEquipo(rivalHoja) && p.pf === sumaHoja);
    let p = cands.length === 1 ? cands[0] : cands.find(c => c.somosA === esLocal && cands.filter(d => d.somosA === esLocal).length === 1);
    if (!p) { errores.push(`${h.fichero}: no encuentro un acta única de ${h.equipo} contra "${rivalHoja}" con ${sumaHoja} puntos (${cands.length} candidatas).`); continue; }
    if (p.hoja) { errores.push(`${h.fichero}: el acta ${p.acta.num} ya está enlazada con ${p.hoja.fichero}.`); continue; }
    if (h.totales && h.totales.pts !== sumaHoja) errores.push(`${h.fichero}: la fila TOTALES (${h.totales.pts}) no coincide con la suma de jugadores (${sumaHoja}).`);
    p.hoja = h; p.rivalHoja = rivalHoja; p.localHoja = esLocal;
    // La jornada sale del nombre del fichero; si no la trae, del calendario (más abajo).
    if (h.jornada !== undefined) p.pn = h.playoff ? cfg.jornadas_liga + h.jornada : h.jornada;
    enlaces.push({ hoja: h.fichero, acta: p.acta.num, validado: `${sumaHoja} = ${p.pf}`, p });
  }

  // Cada acta con su partido del calendario abierto (mismo equipo y fecha), si lo hay.
  for (const p of partidos) p.calendario = (calendario || []).find(c => c.equipo === p.eq && c.fecha === p.acta.fecha && !c.descansa);

  // Jornada de las actas sin hoja: primero lo fijado a mano, después el calendario abierto.
  for (const p of partidos) {
    if (p.pn !== undefined) continue;
    const manual = (cfg.jornadas_manuales || {})[p.acta.num];
    const cal = p.calendario;
    if (manual !== undefined) p.pn = manual;
    else if (cal && cal.jornada !== null) p.pn = /DISTRITO|FINAL|PLAY/i.test(cal.fase) ? cfg.jornadas_liga + cal.jornada : cal.jornada;
    else { p.pn = null; avisos.push(`Acta ${p.acta.num} (${p.eq} ${p.acta.fecha}): sin hoja y sin calendario: jornada desconocida.`); }
    if (!p.incomp && !p.hoja) avisos.push(`Acta ${p.acta.num} (${p.eq} ${p.acta.fecha} vs ${p.rivalActa}, ${p.pf}-${p.pc}): no hay hoja de estadística; el partido cuenta, pero sin boxscore.`);
  }

  // Resultado de las incomparecencias: el acta sale 0-0 y sin vencedor.
  for (const p of partidos) {
    if (!p.incomp) { p.res = p.pf > p.pc ? 'G' : 'P'; continue; }
    const manual = (cfg.resultados_manuales || {})[p.acta.num];
    if (manual) p.res = manual;
    else if (p.calendario && p.calendario.pf !== null && p.calendario.pf !== p.calendario.pc) p.res = p.calendario.pf > p.calendario.pc ? 'G' : 'P';
    else { p.res = null; avisos.push(`Acta ${p.acta.num}: incomparecencia sin ganador conocido (ponlo en resultados_manuales).`); }
  }

  // ---------------------------------------------------------------- partidos
  partidos.sort((x, y) => x.acta.fecha.localeCompare(y.acta.fecha) || x.eq.localeCompare(y.eq));
  const esPO = p => (p.hoja && p.hoja.jornada !== undefined ? p.hoja.playoff : p.pn > cfg.jornadas_liga);
  enlaces.forEach(e => { e.pn = e.p.pn; delete e.p; });
  const outPartidos = partidos.map(p => ({
    num: p.acta.num, equipo: p.eq, fecha: p.acta.fecha,
    rival: pyTitle(p.rivalActa) + (esPO(p) ? ' (PO)' : ''),
    pf: p.pf, pc: p.pc, incomp: p.incomp, res: p.res, convocados: [], pn: p.pn,
    q_us: p.incomp ? null : p.acta.cuartos.map(c => p.somosA ? c.a : c.b),
    q_them: p.incomp ? null : p.acta.cuartos.map(c => p.somosA ? c.b : c.a),
    hora: p.acta.hora, pista: p.acta.pista,
  }));

  // ---------------------------------------------------------------- jugadores (hojas)
  for (const p of partidos) if (p.hoja && p.pn === null) errores.push(`${p.hoja.fichero}: no sé de qué jornada es (ni el nombre del fichero ni el calendario lo dicen). Ponla en jornadas_manuales para el acta ${p.acta.num}.`);
  const conHoja = partidos.filter(p => p.hoja && p.pn !== null).sort((x, y) => x.pn - y.pn || x.eq.localeCompare(y.eq));
  const box = {}, jug = new Map();
  for (const p of conHoja) {
    const filas = [];
    for (const j of p.hoja.jugadores) {
      const pid = pidDe(j.nombre);
      const persona = reg.get(pid);
      if (!persona) { errores.push(`${p.hoja.fichero}: "${j.nombre}" (${pid}) no está en data/personas.json. Si es una persona nueva, confírmala antes.`); continue; }
      if (persona.es_entrenador) { avisos.push(`${p.hoja.fichero}: "${j.nombre}" es el entrenador: fuera de las estadísticas de jugadores.`); continue; }
      const fila = { num: j.num, nombre: j.nombre, sec: j.sec, pts: j.pts, p2a: j.p2a, p2i: j.p2i, p3a: j.p3a, p3i: j.p3i,
        tla: j.tla, tli: j.tli, fc: j.fc, val: j.val, pm: j.pm, display: displayDe(aliasNombre[j.nombre] || j.nombre), person_id: pid };
      filas.push(fila);
      const r = jug.get(pid) || { nombres: [], num: new Set(), equipos: new Set(), games: new Map() };
      r.nombres.push(j.nombre); r.num.add(j.num); r.equipos.add(p.eq);
      r.games.set(p.pn + '_' + p.eq, { pn: p.pn, eq: p.eq, rival: limpia(p.rivalHoja) + (esPO(p) ? ' (PO)' : ''),
        local: p.localHoja, sec: j.sec, played: j.sec > 0, pts: j.pts, p2a: j.p2a, p2i: j.p2i, p3a: j.p3a, p3i: j.p3i,
        tla: j.tla, tli: j.tli, fc: j.fc, val: j.val, pm: j.pm });
      jug.set(pid, r);
    }
    box[p.pn + '_' + p.eq] = filas.map((f, i) => [f, i]).sort((a, b) => b[0].pts - a[0].pts || a[1] - b[1]).map(x => x[0]);
  }

  const CAMPOS = ['pts', 'p2a', 'p2i', 'p3a', 'p3i', 'tla', 'tli', 'fc', 'val', 'pm'];
  const players = [];
  for (const [pid, r] of jug) {
    const games = [...r.games.values()].sort((a, b) => a.pn - b.pn);
    const pj = games.filter(g => g.played), njug = pj.length;
    const S = f => pj.reduce((s, g) => s + g[f], 0);
    const tot = Object.fromEntries(CAMPOS.map(f => [f, S(f)]));
    const secs = S('sec');
    const nombre = r.nombres.reduce((m, x) => (x.length > m.length ? x : m), '');
    const rec = { nombre, dorsales: [...r.num].sort(), equipos: [...r.equipos].sort(), conv: games.length, pj: njug,
      min_tot: pyRound(secs / 60), tot, games };
    if (njug > 0) {
      rec.avg = { pts: pyRound(tot.pts / njug, 1), min: pyRound(secs / 60 / njug, 1), val: pyRound(tot.val / njug, 1),
        pm: pyRound(tot.pm / njug, 1), fc: pyRound(tot.fc / njug, 1) };
      rec.tl_pct = tot.tli ? pyRound(tot.tla / tot.tli * 100) : null;
      rec.p2_pct = tot.p2i ? pyRound(tot.p2a / tot.p2i * 100) : null;
      rec.p3_pct = tot.p3i ? pyRound(tot.p3a / tot.p3i * 100) : null;
    } else { rec.avg = null; rec.tl_pct = rec.p2_pct = rec.p3_pct = null; }
    rec.pm_total = tot.pm;
    rec.ppm = rec.min_tot ? pyRound(tot.pts / rec.min_tot, 2) : null;
    rec.display = displayDe(nombre);
    rec.asist_part = (asistencia.part || {})[pid] || null;
    rec.asist_entr = (asistencia.entr || {})[pid] || null;
    rec.person_id = pid;
    players.push(rec);
  }
  players.sort((a, b) => b.tot.pts - a.tot.pts);    // estable: a igualdad, orden de aparición

  // ---------------------------------------------------------------- parciales medios
  const qstats = {};
  for (const [k, filtro] of [['ALL', () => true], ['MDA', p => p.equipo === 'MDA'], ['MDL', p => p.equipo === 'MDL']]) {
    const ps = outPartidos.filter(p => p.q_us && filtro(p));
    const media = (arr, i) => pyRound(ps.reduce((s, p) => s + (arr(p)[i] || 0), 0) / ps.length, 1);
    qstats[k] = ps.length ? { us: [0, 1, 2, 3].map(i => media(p => p.q_us, i)), them: [0, 1, 2, 3].map(i => media(p => p.q_them, i)), n: ps.length } : { us: [0, 0, 0, 0], them: [0, 0, 0, 0], n: 0 };
  }

  const json = { season: temporada, label: cfg.label, partidos: outPartidos, players, box, qstats };

  // Plantilla oficial de la temporada (hojas de inscripción): quién puede jugar en cada ficha.
  if (cfg.plantilla_fichas && fichas) {
    const porId = new Map();
    for (const f of fichas.fichas.filter(x => x.anio === cfg.plantilla_fichas)) {
      for (const p of f.personas) {
        if (!p.person_id) { errores.push(`Plantilla: "${p.nombre}" (${f.equipo}) sin person_id en fichas_inscripcion.json.`); continue; }
        const o = porId.get(p.person_id) || { person_id: p.person_id, display: (reg.get(p.person_id) || {}).display || p.nombre, fichas: [] };
        o.fichas.push(f.equipo.toUpperCase());
        porId.set(p.person_id, o);
      }
    }
    json.plantilla = [...porId.values()].map(o => ({ ...o, fichas: o.fichas.sort() }))
      .sort((a, b) => a.display.localeCompare(b.display, 'es'));
  }
  return { json, errores, avisos, enlaces };
}

// ---------------------------------------------------------------------- lectura de ficheros
const listar = (dir, re) => fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => re.test(f)).sort().map(f => path.join(dir, f)) : [];

async function leerFuentes(temporada, cfg) {
  const base = path.join(ROOT, cfg.carpeta);
  const actas = [];
  for (const f of listar(path.join(base, 'actas'), /^Acta-Partido-\d+\.pdf$/i)) actas.push(await leerActa(f));
  const hojas = listar(path.join(base, 'hojas'), /^[^~].*\.xlsx$/i).map(f => leerHoja(f));
  const avisos = [];
  const asistencia = leerAsistencia(cfg.asistencia, base, avisos, temporada);
  let calendario = [];
  for (const c of cfg.calendario || []) {
    const f = path.join(ROOT, c.fichero);
    if (fs.existsSync(f)) calendario = calendario.concat(c.formato === 'json' ? JSON.parse(fs.readFileSync(f, 'utf8')).partidos : partidosDelClub(f, cfg.codigos_equipo || {}));
  }
  const fichas = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fichas_inscripcion.json'), 'utf8'));
  return { actas, hojas, asistencia, calendario, avisos, fichas };
}

async function generar(temporada, { dry = false } = {}) {
  const cfg = CONFIG[temporada];
  if (!cfg) throw new Error(`No hay configuración para ${temporada} en scripts/estadisticas/temporadas.json`);
  const fuentes = await leerFuentes(temporada, cfg);
  const personas = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'personas.json'), 'utf8')).personas;
  const r = construir({ temporada, cfg, ...fuentes, personas });
  r.avisos = fuentes.avisos.concat(r.avisos);
  r.fuentes = { actas: fuentes.actas.length, hojas: fuentes.hojas.length };
  // Protección: nunca se pisa una temporada con MENOS partidos de los que ya tiene (p. ej. en
  // un equipo donde no están los ficheros de la FBM).
  const destino = path.join(ROOT, 'data', `season_${temporada}.json`);
  if (fs.existsSync(destino)) {
    const previo = JSON.parse(fs.readFileSync(destino, 'utf8'));
    if ((previo.partidos || []).length > r.json.partidos.length)
      r.errores.push(`data/season_${temporada}.json tiene ${previo.partidos.length} partidos y con las fuentes de ${cfg.carpeta} salen ${r.json.partidos.length}: faltan ficheros; no se sobrescribe.`);
    const nb = o => Object.keys(o.box || {}).length;
    if (nb(previo) > nb(r.json))
      r.errores.push(`data/season_${temporada}.json tiene ${nb(previo)} boxscores y con las fuentes de ${cfg.carpeta} salen ${nb(r.json)}: faltan hojas; no se sobrescribe.`);
  }
  if (!dry && !r.errores.length) fs.writeFileSync(destino, JSON.stringify(r.json) + '\n', 'utf8');
  return r;
}

module.exports = { construir, generar, leerFuentes, displayDe };

if (require.main === module && process.argv.includes('--build')) {
  // Paso de "npm run build:datos": regenera sólo las temporadas marcadas regenerar_en_build y
  // sólo si su carpeta de fuentes está en este equipo. La 2025/26 NO se regenera (de sus 41
  // hojas sólo queda una: ver test_regresion_2025_26.js).
  (async () => {
    for (const [t, c] of Object.entries(CONFIG).filter(([k, c]) => !k.startsWith('_') && c.regenerar_en_build)) {
      if (!fs.existsSync(path.join(ROOT, c.carpeta))) { console.log(`${t}: no está ${c.carpeta} en este equipo; se deja data/season_${t}.json como está.`); continue; }
      const r = await generar(t);
      console.log(`${t}: ${r.fuentes.actas} actas, ${r.fuentes.hojas} hojas -> ${r.json.partidos.length} partidos` + (r.errores.length ? ' — ERRORES, no se escribe:' : ''));
      r.errores.forEach(e => console.log('  X ' + e));
      if (r.errores.length) process.exitCode = 1;
    }
  })();
} else if (require.main === module) {
  const [temporada] = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const dry = process.argv.includes('--dry');
  generar(temporada, { dry }).then(r => {
    console.log(`${temporada}: ${r.fuentes.actas} actas, ${r.fuentes.hojas} hojas -> ${r.json.partidos.length} partidos, ${r.json.players.length} jugadores`);
    r.avisos.forEach(a => console.log('  ! ' + a));
    if (r.errores.length) { console.log('\nERRORES (no se ha escrito nada):'); r.errores.forEach(e => console.log('  X ' + e)); process.exitCode = 1; }
    else console.log(dry ? '[dry] no se ha escrito nada' : `data/season_${temporada}.json escrito.`);
  }).catch(e => { console.error('ERROR: ' + e.message); process.exitCode = 1; });
}
