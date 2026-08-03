/**
 * build_historico.js
 *
 * Genera data/season_YYYY-YY.json para las 10 temporadas históricas (2013/14 – 2024/25)
 * a partir de los Excel de estadísticas de Carlos, replicando EXACTAMENTE el esquema de
 * data/season_2025-26.json (season, label, partidos, players, box, qstats) y añadiendo
 * únicamente claves nuevas donde el esquema no cubre algo (metrics, mda_resumen, validacion).
 *
 * USO:  node scripts/build_historico.js [--src <carpeta con los .xls>] [--report <fichero>]
 * Requiere: npm install  (dependencia: xlsx)
 *
 * REGLAS DE NEGOCIO (no negociables, ver docs/DECISIONS.md):
 *  - Nombres: SOLO data/diccionario_nombres.json (derivado de docs/DICCIONARIO_NOMBRES_maccabis.md).
 *  - tipo "ruido" y "sin_catalogar": sin ficha individual ni rankings, pero sus puntos
 *    permanecen en el total de equipo para que los marcadores cuadren con las actas.
 *  - Barreiro (entrenador) nunca jugó: cualquier "Carlos" es Carlos Pérez Núñez.
 *  - Minutos SOLO desde 2023/24. Sin minutos -> las medias se calculan por PARTIDO JUGADO,
 *    con denominador = partidos con participación real (los "NJ" no entran).
 *  - No se inventa ningún dato: lo que no está en la fuente queda ausente (null).
 */
const fs = require('fs');
const path = require('path');
const X = require('xlsx');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');

const args = process.argv.slice(2);
const argVal = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const SRC = argVal('--src', path.join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads'));
const REPORT_PATH = argVal('--report', path.join(ROOT, 'docs', 'INFORME_HISTORICO.md'));

// temporada -> { mdl: fichero, mda: fichero|null, label }
const SEASONS = [
  { id: '2013-14', mdl: 'Estadisticas_2013_2014.xls' },
  { id: '2014-15', mdl: 'Estadisticas_2014_2015.xls' },
  { id: '2015-16', mdl: 'Estadisticas_2015_2016.xls' },
  { id: '2017-18', mdl: 'Estadisticas_2017_2018.xls' },
  { id: '2018-19', mdl: 'Estadisticas_2018_2019.xls' },
  { id: '2019-20', mdl: 'Estadisticas_2019_2020.xls' },
  { id: '2020-21', mdl: 'Estadisticas_2020_2021.xls' },
  { id: '2021-22', mdl: 'Estadisticas_2021_2022.xls' },
  { id: '2023-24', mdl: 'Estadisticas_2023_2024_MDL.xls', mda: 'Estadisticas_2023_2024_MDA.xlsx' },
  { id: '2024-25', mdl: 'Estadisticas_2024_2025_MDL.xls', mda: 'Estadisticas_2024_2025_MDA.xlsx' },
];

const labelOf = id => `${id.slice(0, 4)} / ${id.slice(5)}`;

// ---------------------------------------------------------------- utilidades
const clean = v => (v === null || v === undefined) ? null : (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : v);
/** "NJ" = No Jugó (convocatoria sin juego). No entra en el denominador de las medias. */
const isNJ = v => typeof v === 'string' && /^N\.?J\.?$/i.test(v.trim());
/** "SD" = Sin Datos (acta o estadística perdida). No es ni jugó ni NJ: es ausencia de dato. */
const isSD = v => typeof v === 'string' && /^S\.?D\.?$/i.test(v.trim());
const r1 = n => (n === null || !isFinite(n)) ? null : Math.round(n * 10) / 10;
const r2 = n => (n === null || !isFinite(n)) ? null : Math.round(n * 100) / 100;

function aoa(wb, sheet) {
  const ws = wb.Sheets[sheet];
  if (!ws) return null;
  return X.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
}

/** "Partido 12º" / "12º" -> 12 */
function partidoNum(v) {
  if (typeof v !== 'string') return null;
  const m = v.trim().match(/^(?:Partido\s+)?(\d+)\s*º?$/i);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Localiza los bloques de una hoja "matriz" (filas = mote, columnas = partido).
 * Devuelve [{ headerRow, cols: Map(colIndex -> pn) }]
 */
function findBlocks(rows) {
  const blocks = [];
  rows.forEach((row, i) => {
    if (!row) return;
    const cols = new Map();
    for (let c = 1; c < row.length; c++) {
      const pn = partidoNum(clean(row[c]));
      if (pn) cols.set(c, pn);
    }
    // una cabecera de bloque tiene al menos 2 columnas "Partido Nº" y col0 vacía
    if (cols.size >= 2 && !clean(row[0])) blocks.push({ headerRow: i, cols });
  });
  return blocks;
}

const STOP_ROWS = new Set(['TOTAL', 'TOTALES', 'EXPULSADOS', '%', 'MEDIA', 'MEDIAS']);

/**
 * Lee una hoja matriz -> Map(mote -> Map(pn -> valorCrudo))
 * valorCrudo: número | 'NJ' | string "a/i" | null (sin dato)
 */
function readMatrix(rows) {
  const out = new Map();
  const blocks = findBlocks(rows);
  for (const b of blocks) {
    for (let i = b.headerRow + 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const mote = clean(row[0]);
      if (mote === null || mote === '') {
        // fila vacía: sólo corta si ya habíamos leído datos y viene otra cabecera
        if (blocks.some(x => x.headerRow === i)) break;
        continue;
      }
      if (STOP_ROWS.has(String(mote).toUpperCase())) break;
      if (!out.has(mote)) out.set(mote, new Map());
      const m = out.get(mote);
      for (const [c, pn] of b.cols) {
        const v = clean(row[c]);
        if (v === null || v === '') continue;
        m.set(pn, v);
      }
    }
  }
  return out;
}

/**
 * Lee la columna "TOTAL" de una hoja matriz -> Map(mote -> total)
 * Sirve como validación cruzada del parseo (suma calculada vs total de la fuente).
 */
function readTotals(rows) {
  const out = new Map();
  for (const b of findBlocks(rows)) {
    const hdr = rows[b.headerRow];
    let cTot = -1;
    for (let c = 1; c < hdr.length; c++) if (String(clean(hdr[c])).toUpperCase() === 'TOTAL') cTot = c;
    if (cTot < 0) continue;
    for (let i = b.headerRow + 1; i < rows.length; i++) {
      const mote = clean((rows[i] || [])[0]);
      if (mote === null || mote === '') continue;
      if (STOP_ROWS.has(String(mote).toUpperCase())) break;
      const v = num((rows[i] || [])[cTot]);
      if (v !== null) out.set(mote, v);
    }
  }
  return out;
}

/** "12/17" -> {a:12,i:17}; null si no aplica */
function parseAI(v) {
  if (typeof v !== 'string') return null;
  const m = v.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  return m ? { a: +m[1], i: +m[2] } : null;
}

function num(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(+v)) return +v;
  return null;
}

// ---------------------------------------------------------------- Resultados
function readResultados(rows, warn) {
  const partidos = [];
  let fase = null;
  for (const row of rows || []) {
    if (!row) continue;
    const c0 = clean(row[0]);
    const c1 = clean(row[1]);
    if (c0 && /FASE|MARCA|COPA|PLAY/i.test(String(c0))) fase = String(c0);
    const pn = partidoNum(c1);
    if (!pn) continue;
    const pf = num(row[2]), pc = num(row[3]);
    const rival = clean(row[4]);
    const vd = clean(row[5]);
    if (pf === null || pc === null) { warn(`Resultados: partido ${pn} sin marcador`); continue; }
    partidos.push({
      pn, fase,
      rival: rival ? String(rival).replace(/\s+/g, ' ').trim() : null,
      pf, pc,
      res: vd ? (String(vd).toUpperCase().startsWith('V') ? 'G' : 'P') : (pf > pc ? 'G' : 'P'),
    });
  }
  return partidos;
}

// ---------------------------------------------------------------- temporada
function buildSeason(season, dicc, warn) {
  const file = path.join(SRC, season.mdl);
  if (!fs.existsSync(file)) throw new Error(`No encuentro ${file}`);
  const wb = X.readFile(file);

  const resultados = readResultados(aoa(wb, 'Resultados'), warn);
  const totPts = readTotals(aoa(wb, 'Puntos') || []);
  const mPts = readMatrix(aoa(wb, 'Puntos') || []);
  const mFc = readMatrix(aoa(wb, 'Faltas') || []);
  const mP3 = readMatrix(aoa(wb, 'Triples') || []);
  const mTl = readMatrix(aoa(wb, 'Tiros_libres') || []);
  const sheetMin = wb.SheetNames.includes('Min') ? aoa(wb, 'Min') : null;
  const mMin = sheetMin ? readMatrix(sheetMin) : null;

  const hasMin = !!mMin;
  const pns = resultados.map(p => p.pn);
  const res = dicc.resolucion_por_temporada[season.id] || {};
  const personas = new Map(dicc.personas.map(p => [p.person_id, p]));

  // --- motes presentes en las hojas y su resolución
  const motes = new Set([...mPts.keys()]);
  for (const m of [mFc, mP3, mTl, mMin].filter(Boolean)) for (const k of m.keys()) motes.add(k);

  const noEnDiccionario = [];
  for (const mote of motes) {
    if (!res[mote]) noEnDiccionario.push(mote);
  }
  if (noEnDiccionario.length) {
    warn(`Motes en el Excel sin entrada en el diccionario (tratados como SIN CATALOGAR): ${noEnDiccionario.join(', ')}`);
  }

  // --- fila cruda por mote y partido
  const get = (m, mote, pn) => (m && m.has(mote)) ? (m.get(mote).get(pn) ?? null) : null;

  // Un partido "sin stats" es aquel del que no consta ninguna línea individual
  // (acta o estadística perdida): en la fuente aparece vacío o todo "SD".
  const conStats = new Set();
  for (const [, byPn] of mPts) {
    for (const [pn, v] of byPn) {
      if (num(v) !== null || isNJ(v)) conStats.add(pn);
    }
  }
  const sinStats = pns.filter(pn => !conStats.has(pn));
  if (sinStats.length) {
    warn(`Partidos sin estadística individual en la fuente (marcados "sin_stats", el marcador sí consta): ${sinStats.join(', ')}`);
  }

  function rawGame(mote, pn) {
    const vp = get(mPts, mote, pn);
    if (vp === null || isSD(vp)) return null;      // sin dato: ni convocado ni NJ
    if (typeof vp === 'string' && !isNJ(vp) && num(vp) === null) {
      warn(`Valor no reconocido en Puntos (${mote}, P${pn}): "${vp}" -> tratado como sin dato`);
      return null;
    }
    const played = !isNJ(vp);
    const pts = played ? (num(vp) ?? 0) : null;

    const vf = get(mFc, mote, pn), v3 = get(mP3, mote, pn), vt = get(mTl, mote, pn);
    const vm = hasMin ? get(mMin, mote, pn) : null;
    const tl = parseAI(vt);
    return {
      played,
      pts,
      fc: played ? (isNJ(vf) ? 0 : (num(vf) ?? 0)) : null,
      p3a: played ? (isNJ(v3) ? 0 : (num(v3) ?? 0)) : null,
      tla: played ? (tl ? tl.a : 0) : null,
      tli: played ? (tl ? tl.i : 0) : null,
      min: (played && hasMin) ? (isNJ(vm) ? null : num(vm)) : null,
    };
  }

  // --- agrupar motes por destino
  const porPersona = new Map();   // person_id -> [motes]
  const noJugador = [];           // { mote, tipo }
  for (const mote of motes) {
    const r = res[mote];
    if (r && r.tipo === 'jugador') {
      if (!porPersona.has(r.person_id)) porPersona.set(r.person_id, []);
      porPersona.get(r.person_id).push(mote);
    } else {
      noJugador.push({ mote, tipo: r ? r.tipo : 'sin_catalogar' });
    }
  }
  const motesFusionados = [...porPersona.entries()].filter(([, ms]) => ms.length > 1)
    .map(([pid, ms]) => `${personas.get(pid).display}: ${ms.join(' + ')}`);
  if (motesFusionados.length) warn(`Motes distintos fusionados en la misma persona: ${motesFusionados.join(' | ')}`);

  // --- jugadores
  const players = [];
  for (const [person_id, ms] of porPersona) {
    const per = personas.get(person_id);
    const games = [];
    for (const p of resultados) {
      const parts = ms.map(m => rawGame(m, p.pn)).filter(Boolean);
      if (!parts.length) continue;                       // no consta: no se inventa convocatoria
      const played = parts.some(g => g.played);
      const sum = k => parts.reduce((a, g) => a + (g[k] ?? 0), 0);
      const anyMin = parts.some(g => g.min !== null);
      const g = {
        pn: p.pn,
        eq: 'MDL',
        rival: p.rival,
        local: null,                                     // no consta en la fuente
        sec: (played && hasMin && anyMin) ? sum('min') * 60 : null,
        played,
        pts: played ? sum('pts') : null,
        p2a: null, p2i: null,
        p3a: played ? sum('p3a') : null,
        p3i: null,
        tla: played ? sum('tla') : null,
        tli: played ? sum('tli') : null,
        fc: played ? sum('fc') : null,
        val: null,
        pm: null,
      };
      if (played) {
        const resto = g.pts - 3 * g.p3a - g.tla;         // 2P anotados, derivados de la fuente
        g.p2a = (resto >= 0 && resto % 2 === 0) ? resto / 2 : null;
        if (g.p2a === null) warn(`${per.display} P${p.pn}: no se puede derivar 2P (pts=${g.pts}, 3P=${g.p3a}, TL=${g.tla})`);
      }
      games.push(g);
    }
    if (!games.length) continue;

    const jugados = games.filter(g => g.played);
    const pj = jugados.length;
    const sum = k => jugados.reduce((a, g) => a + (g[k] ?? 0), 0);
    const tot = {
      pts: sum('pts'), p2a: null, p2i: null,
      p3a: sum('p3a'), p3i: null,
      tla: sum('tla'), tli: sum('tli'),
      fc: sum('fc'), val: null, pm: null,
    };
    const resto = tot.pts - 3 * tot.p3a - tot.tla;
    tot.p2a = (resto >= 0 && resto % 2 === 0) ? resto / 2 : null;

    const minTot = hasMin ? jugados.reduce((a, g) => a + (g.sec ? g.sec / 60 : 0), 0) : null;
    const conMin = hasMin ? jugados.filter(g => g.sec !== null).length : 0;

    players.push({
      person_id,
      motes: ms.slice().sort(),
      nombre: per.nombre,
      dorsales: [],
      equipos: ['MDL'],
      conv: games.length,
      pj,
      min_tot: hasMin ? Math.round(minTot) : null,
      tot,
      games,
      avg: {
        pts: pj ? r1(tot.pts / pj) : null,
        min: (hasMin && conMin) ? r1(minTot / conMin) : null,
        val: null,
        pm: null,
        fc: pj ? r1(tot.fc / pj) : null,
        p3a: pj ? r1(tot.p3a / pj) : null,
      },
      tl_pct: tot.tli ? Math.round(tot.tla / tot.tli * 100) : null,
      p2_pct: null,
      p3_pct: null,
      pm_total: null,
      ppm: (hasMin && minTot) ? r2(tot.pts / minTot) : null,
      display: per.display,
      asist_part: null,
      asist_entr: null,
    });
  }
  players.sort((a, b) => b.tot.pts - a.tot.pts || a.display.localeCompare(b.display));

  // validación cruzada: total calculado vs columna TOTAL del Excel
  for (const pl of players) {
    const esperado = pl.motes.reduce((a, m) => a + (totPts.has(m) ? totPts.get(m) : 0), 0);
    const tieneTotal = pl.motes.some(m => totPts.has(m));
    if (tieneTotal && esperado !== pl.tot.pts) {
      warn(`${pl.display}: puntos totales calculados ${pl.tot.pts} ≠ TOTAL de la hoja ${esperado} (dif ${pl.tot.pts - esperado})`);
    }
  }

  // --- boxscores (incluye ruido y sin_catalogar para que cuadre con el acta)
  const box = {};
  const validacion = { partidos: [], ok: true };
  for (const p of resultados) {
    if (!conStats.has(p.pn)) {                       // acta/estadística perdida: no se inventa boxscore
      validacion.partidos.push({ pn: p.pn, acta: p.pf, suma: null, ok: null, sin_stats: true });
      continue;
    }
    const filas = [];
    for (const pl of players) {
      const g = pl.games.find(x => x.pn === p.pn);
      if (!g || !g.played) continue;
      filas.push({
        num: null, nombre: pl.nombre, sec: g.sec,
        pts: g.pts, p2a: g.p2a, p2i: null, p3a: g.p3a, p3i: null,
        tla: g.tla, tli: g.tli, fc: g.fc, val: null, pm: null,
        display: pl.display, person_id: pl.person_id,
      });
    }
    let ptsNoJugador = 0;
    for (const nj of noJugador) {
      const g = rawGame(nj.mote, p.pn);
      if (!g || !g.played) continue;
      ptsNoJugador += g.pts || 0;
      const restoNJ = (g.pts ?? 0) - 3 * (g.p3a ?? 0) - (g.tla ?? 0);
      filas.push({
        num: null, nombre: nj.mote, sec: g.min !== null ? g.min * 60 : null,
        pts: g.pts, p2a: (restoNJ >= 0 && restoNJ % 2 === 0) ? restoNJ / 2 : null, p2i: null, p3a: g.p3a, p3i: null,
        tla: g.tla, tli: g.tli, fc: g.fc, val: null, pm: null,
        display: nj.tipo === 'sin_catalogar' ? 'Sin catalgar' : 'No identificado',
        person_id: null, no_jugador: true, tipo: nj.tipo, mote: nj.mote,
      });
    }
    filas.sort((a, b) => (b.pts ?? 0) - (a.pts ?? 0));
    box[`${p.pn}_MDL`] = filas;

    const suma = filas.reduce((a, f) => a + (f.pts ?? 0), 0);
    const v = { pn: p.pn, acta: p.pf, suma, ok: suma === p.pf, pts_no_jugador: ptsNoJugador };
    if (!v.ok) { validacion.ok = false; warn(`Partido ${p.pn}: suma de puntos ${suma} ≠ marcador del acta ${p.pf} (dif ${suma - p.pf})`); }
    validacion.partidos.push(v);
  }

  // --- partidos (esquema 25/26)
  const partidos = resultados.map(p => ({
    num: null,
    equipo: 'MDL',
    fecha: null,
    rival: p.rival,
    pf: p.pf,
    pc: p.pc,
    incomp: false,
    res: p.res,
    convocados: [],
    pn: p.pn,
    q_us: null,
    q_them: null,
    fase: p.fase,
    sin_stats: !conStats.has(p.pn),
  }));

  const metrics = {
    pts: true,
    p3: true,
    tl: true,
    fc: true,
    p2: true,          // derivado: 2P = (PTS − 3·3P − TL anotados) / 2
    p2_intentos: false,
    p3_intentos: false,
    min: hasMin,
    val: false,
    pm: false,
    asistencia: false,
    cuartos: false,
    fecha: false,
    dorsal: false,
  };

  return {
    season: season.id,
    label: labelOf(season.id),
    equipo_principal: 'MDL',
    fuente: `Estadísticas históricas de Carlos Barreiro (${season.mdl})`,
    metrics,
    notas_metricas: [
      'Fuente: hojas de estadística históricas del club. La liga sólo registraba puntos, triples, tiros libres y faltas cometidas.',
      'Las canastas de 2 son DERIVADAS: 2P = (PTS − 3·3P − TL anotados) / 2. No hay intentos de campo en la fuente.',
      hasMin
        ? 'Minutos disponibles: las medias por minuto son válidas.'
        : 'Sin minutos en esta temporada: las medias se calculan POR PARTIDO JUGADO (los "NJ" no entran en el denominador).',
      'No hay valoración ni +/− en esta temporada.',
    ],
    partidos,
    players,
    box,
    qstats: null,
    validacion,
  };
}

// ---------------------------------------------------------------- MdA agregado
function buildMdaResumen(season, dicc, warn) {
  const file = path.join(SRC, season.mda);
  if (!fs.existsSync(file)) { warn(`No encuentro el MdA ${file}`); return null; }
  const wb = X.readFile(file);
  const rows = aoa(wb, wb.SheetNames[0]);
  const res = dicc.resolucion_por_temporada[season.id] || {};
  const personas = new Map(dicc.personas.map(p => [p.person_id, p]));

  // cabecera: fila que contiene "PARTIDOS" y "ENTRENOS"
  let hdr = -1;
  rows.forEach((r, i) => { if (r && r.some(c => clean(c) === 'PARTIDOS') && r.some(c => clean(c) === 'ENTRENOS')) hdr = i; });
  if (hdr < 0) { warn('MdA: no encuentro la fila de cabecera'); return null; }
  const H = rows[hdr].map(clean);
  const colOf = (label, from = 0) => H.findIndex((c, i) => i >= from && c === label);

  const cPart = colOf('PARTIDOS'), cEntr = colOf('ENTRENOS');
  const cNombreAsis = cPart - 1;
  const cPts = colOf('PUNTOS'), cTl = colOf('TL'), cTlPct = colOf('% TL'),
    cP3 = colOf('TRIPLES'), cMin = colOf('MINUTOS');
  const cNombreTot = cPts - 1;
  const cMedPts = colOf('PUNTOS', cMin + 1);
  const cNombreMed = cMedPts - 1;
  const cMedTl = colOf('TL', cMedPts), cMedP3 = colOf('TRIPLES', cMedPts),
    cMedMin = colOf('MIN', cMedPts), cPtsMin = colOf('PTS/MIN'), cPm = colOf('+/-');

  const byMote = new Map();
  const ensure = m => { if (!byMote.has(m)) byMote.set(m, { mote: m }); return byMote.get(m); };

  let cuartosStart = -1;
  for (let i = hdr + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    if (row.some(c => /PUNTOS POR CUARTO/i.test(String(clean(c) ?? '')))) { cuartosStart = i; break; }
    const nA = clean(row[cNombreAsis]), nT = clean(row[cNombreTot]), nM = clean(row[cNombreMed]);
    if (nA && !STOP_ROWS.has(String(nA).toUpperCase())) {
      const o = ensure(nA); o.asist_partidos = num(row[cPart]); o.asist_entrenos = num(row[cEntr]);
    }
    if (nT && !STOP_ROWS.has(String(nT).toUpperCase())) {
      const o = ensure(nT);
      o.pts = num(row[cPts]); o.tl = num(row[cTl]); o.tl_pct = r1(num(row[cTlPct]));
      o.p3 = num(row[cP3]); o.min = num(row[cMin]);
    }
    if (nM && !STOP_ROWS.has(String(nM).toUpperCase())) {
      const o = ensure(nM);
      o.avg_pts = r1(num(row[cMedPts])); o.avg_tl = r1(num(row[cMedTl]));
      o.avg_p3 = r1(num(row[cMedP3]));
      if (cMedMin > 0) o.avg_min = r1(num(row[cMedMin]));
      if (cPtsMin > 0) o.pts_min = r2(num(row[cPtsMin]));
      if (cPm > 0) o.avg_pm = r1(num(row[cPm]));
    }
  }

  // resolución de nombres: SÓLO si el mote está en el diccionario de esa temporada
  const jugadores = [];
  const sinCatalogar = [];
  for (const o of byMote.values()) {
    if (/^No presentado$/i.test(o.mote)) { o.nota = 'Partido no presentado por el rival'; o.no_jugador = true; }
    const r = res[o.mote];
    if (r && r.tipo === 'jugador') {
      const per = personas.get(r.person_id);
      o.person_id = r.person_id; o.display = per.display; o.nombre = per.nombre; o.catalogado = true;
    } else if (r) {
      o.catalogado = false; o.display = r.tipo === 'sin_catalogar' ? 'Sin catalgar' : 'No identificado'; o.tipo = r.tipo;
    } else {
      o.catalogado = false; o.display = o.mote; o.tipo = 'sin_catalogar_mda';
      if (!o.no_jugador) sinCatalogar.push(o.mote);
    }
    jugadores.push(o);
  }
  jugadores.sort((a, b) => (b.pts ?? 0) - (a.pts ?? 0));

  // El MdA 23/24 trae alguna celda con un valor decimal en columnas que son enteras
  // (puntos, TL, triples, minutos): error de la hoja de origen. No se corrige ni se
  // oculta: se transcribe tal cual y se marca para que Iván lo revise contra las actas.
  const anomalias = [];
  for (const j of jugadores) {
    for (const k of ['pts', 'tl', 'p3', 'min', 'asist_partidos', 'asist_entrenos']) {
      const v = j[k];
      if (v !== null && v !== undefined && !Number.isInteger(v)) {
        anomalias.push({ mote: j.mote, campo: k, valor: v });
        (j.sospechoso || (j.sospechoso = [])).push(k);
      }
    }
  }
  if (anomalias.length) {
    warn(`MdA ${season.id}: ${anomalias.length} celda(s) con valor decimal en una columna que debería ser entera (se transcriben tal cual, pendientes de revisar): ` +
      anomalias.map(a => `${a.mote}/${a.campo}=${a.valor}`).join(', '));
  }

  if (sinCatalogar.length) {
    warn(`MdA ${season.id}: motes sin entrada en el diccionario (el diccionario sólo cubre MdL) -> se conserva el mote sin asignar nombre: ${sinCatalogar.join(', ')}`);
  }

  // puntos por cuarto
  const cuartos = [];
  if (cuartosStart >= 0) {
    const blocks = findBlocks(rows.slice(cuartosStart)).map(b => ({ ...b, headerRow: b.headerRow + cuartosStart }));
    for (const b of blocks) {
      const byRow = {};
      for (let i = b.headerRow + 1; i < Math.min(b.headerRow + 8, rows.length); i++) {
        const lbl = clean((rows[i] || [])[1]);
        if (!lbl) continue;
        const q = String(lbl).match(/Cuarto\s+(\d)/i);
        if (String(lbl).toUpperCase() === 'TOTAL') byRow.total = rows[i];
        else if (q) byRow['q' + q[1]] = rows[i];
      }
      for (const [c, pn] of b.cols) {
        const q = [1, 2, 3, 4].map(k => byRow['q' + k] ? num(byRow['q' + k][c]) : null);
        cuartos.push({ pn, total: byRow.total ? num(byRow.total[c]) : null, q });
      }
    }
    cuartos.sort((a, b) => a.pn - b.pn);
  }

  return {
    disponible: true,
    fuente: season.mda,
    nota: 'El MdA de esta temporada sólo existe agregado (totales y medias de temporada). No hay desglose partido a partido, así que no se generan partidos.',
    metrics: { pts: true, tl: true, p3: true, min: true, asistencia: true, cuartos: cuartos.length > 0, fc: false, val: false, pm: jugadores.some(j => j.avg_pm != null) },
    jugadores,
    cuartos,
    anomalias,
  };
}

// ---------------------------------------------------------------- main
function main() {
  const dicc = JSON.parse(fs.readFileSync(path.join(DATA, 'diccionario_nombres.json'), 'utf8'));
  const report = [];
  const resumen = [];

  for (const s of SEASONS) {
    const warns = [];
    const warn = m => warns.push(m);
    const out = buildSeason(s, dicc, warn);
    if (s.mda) {
      const mda = buildMdaResumen(s, dicc, warn);
      if (mda) out.mda_resumen = mda;
    }
    fs.writeFileSync(path.join(DATA, `season_${s.id}.json`), JSON.stringify(out, null, 1) + '\n', 'utf8');

    const conStats = out.validacion.partidos.filter(p => !p.sin_stats);
    const nOk = conStats.filter(p => p.ok).length;
    resumen.push({
      id: s.id,
      partidos: out.partidos.length,
      sin_stats: out.validacion.partidos.length - conStats.length,
      jugadores: out.players.length,
      metrics: Object.entries(out.metrics).filter(([, v]) => v === true).map(([k]) => k).join(', '),
      cuadre: `${nOk}/${conStats.length}`,
      mda: out.mda_resumen ? out.mda_resumen.jugadores.filter(j => !j.no_jugador).length : null,
      warns,
    });
    console.log(`${s.id}: ${out.partidos.length} partidos, ${out.players.length} jugadores, cuadre ${nOk}/${conStats.length}` +
      (out.mda_resumen ? `, MdA agregado (${out.mda_resumen.jugadores.length} filas)` : ''));
    warns.forEach(w => console.log('   ! ' + w));
  }

  // informe
  report.push('# Informe de generación del histórico (2013/14 – 2024/25)', '',
    `_Generado por \`scripts/build_historico.js\` a partir de los Excel de estadísticas del club._`, '',
    '| Temporada | Partidos | Sin stats | Jugadores | Cuadre acta | MdA agregado | Métricas disponibles |',
    '|---|---|---|---|---|---|---|');
  for (const r of resumen) {
    report.push(`| ${labelOf(r.id)} | ${r.partidos} | ${r.sin_stats || 0} | ${r.jugadores} | ${r.cuadre} | ${r.mda ?? '—'} | ${r.metrics} |`);
  }
  report.push('', '## Incidencias por temporada', '');
  for (const r of resumen) {
    report.push(`### ${labelOf(r.id)}`, '');
    if (!r.warns.length) report.push('- Sin incidencias.', '');
    else { r.warns.forEach(w => report.push(`- ${w}`)); report.push(''); }
  }
  fs.writeFileSync(REPORT_PATH, report.join('\n') + '\n', 'utf8');
  console.log('\nInforme -> ' + path.relative(ROOT, REPORT_PATH));
}

if (require.main === module) main();
