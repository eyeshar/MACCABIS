/**
 * actualizar_calendario.js
 *
 * Calendario y marcadores de MdA y MdL desde el portal de datos abiertos del Ayuntamiento de
 * Madrid (dataset 211549 "temporada en curso", CSV semanal, CC BY 4.0), más la tabla limpia
 * para la plantilla de importación de SportEasy.
 *
 * Los equipos se identifican SIEMPRE por Codigo_equipo, nunca por nombre (hay homónimos, D26).
 * Los códigos cambian cada temporada y las hojas de inscripción de 2026/27 no los traen, así que
 * se fijan UNA vez con --descubrir (busca en nuestro grupo exacto un equipo llamado MdA/MdL y
 * propone su código) y se confirman a mano en config_<temporada>.json. Sin códigos confirmados
 * el script no genera nada.
 *
 * Modos:
 *   node scripts/calendario/actualizar_calendario.js --comprobar
 *       Lee SÓLO los metadatos del dataset (.rdf, ruta permitida por robots.txt) y dice si hay
 *       una versión más nueva que la del último calendario generado. No descarga el CSV.
 *   node scripts/calendario/actualizar_calendario.js --descargar
 *       Descarga el CSV de partidos a data/raw/ (fuera de git, D25). La ruta de descarga del
 *       portal está vetada a bots en su robots.txt: este modo es para lanzarlo una persona
 *       (a mano o con el botón del workflow), nunca programado.
 *   node scripts/calendario/actualizar_calendario.js --descubrir [--csv <fichero>]
 *       Propone los códigos de nuestros equipos. No escribe nada.
 *   node scripts/calendario/actualizar_calendario.js [--csv <fichero>] [--temporada 2026-27]
 *       Genera data/calendario_<t>.json y data/sporteasy_calendario_<t>.csv con el CSV más
 *       reciente de data/raw/ y, si existe, el calendario manual data/calendario_manual_<t>.csv.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { partidosDelClub, parseCsv, leerTexto } = require('../estadisticas/calendario_abierto');
const { normEquipo, limpia } = require('../estadisticas/util');

const ROOT = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const argVal = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const TEMPORADA = argVal('--temporada', '2026-27');
const CFG_PATH = path.join(__dirname, `config_${TEMPORADA}.json`);
const cfg = JSON.parse(fs.readFileSync(CFG_PATH, 'utf8'));
const RDF = 'https://datos.madrid.es/dataset/211549-0-juegos-deportivos-actual.rdf';
const UA = 'Maccabis-calendario (github.com/eyeshar/MACCABIS; CC BY 4.0)';
const SALIDA_JSON = argVal('--salida', path.join(ROOT, 'data', `calendario_${TEMPORADA}.json`));
const SALIDA_CSV = path.join(path.dirname(SALIDA_JSON), 'sporteasy_' + path.basename(SALIDA_JSON).replace(/\.json$/, '.csv'));

function get(url, destino) {
  return new Promise((ok, ko) => {
    https.get(url, { headers: { 'User-Agent': UA } }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { r.resume(); return get(new URL(r.headers.location, url).href, destino).then(ok, ko); }
      if (r.statusCode !== 200) { r.resume(); return ko(new Error(`HTTP ${r.statusCode} en ${url}`)); }
      if (destino) { const f = fs.createWriteStream(destino, { flags: 'wx' }); r.pipe(f); f.on('finish', () => f.close(() => ok(destino))); f.on('error', ko); }
      else { let s = ''; r.setEncoding('utf8'); r.on('data', d => { s += d; }); r.on('end', () => ok(s)); }
    }).on('error', ko);
  });
}

/** Metadatos del dataset: fecha de modificación y URL del CSV de partidos (cambia de nombre). */
async function metadatos() {
  const s = await get(RDF);
  const modificado = (s.match(/<dct:modified[^>]*>([^<]*)</) || [])[1] || null;
  const dist = s.split('<dcat:Distribution').slice(1).map(p => ({
    titulo: (p.match(/<dct:description[^>]*>([^<]*)</) || [])[1] || '',
    url: (p.match(/accessURL rdf:resource="([^"]*)"/) || [])[1] || '',
    modificado: (p.match(/<dct:modified[^>]*>([^<]*)</) || [])[1] || null,
  }));
  const csv = dist.find(d => /^Partidos$/i.test(limpia(d.titulo)) && /\.csv$/i.test(d.url));
  return { modificado, csv };
}

const rawDir = path.join(ROOT, 'data', 'raw');
const ultimoRaw = () => (fs.existsSync(rawDir) ? fs.readdirSync(rawDir) : []).filter(f => /^211549_partidos_\d{8}\.csv$/.test(f)).sort().pop();

/** Filas del CSV de nuestra competición y grupos (para descubrir códigos). */
function filasDeNuestrosGrupos(fichero) {
  const grupos = Object.values(cfg.equipos).map(e => normEquipo(e.grupo));
  return parseCsv(leerTexto(fichero)).filter(r => normEquipo(r.Nombre_competicion) === normEquipo(cfg.competicion)
    && grupos.includes(normEquipo(r.Nombre_grupo)));
}

function descubrir(fichero) {
  const filas = filasDeNuestrosGrupos(fichero);
  if (!filas.length) { console.log(`El CSV (${path.basename(fichero)}) aún no trae partidos de ${cfg.competicion} en nuestros grupos.`); return 2; }
  for (const [eq, e] of Object.entries(cfg.equipos)) {
    const nombres = (cfg.nombres_para_descubrir[eq] || []).map(normEquipo);
    const cand = new Map();
    for (const r of filas.filter(r => normEquipo(r.Nombre_grupo) === normEquipo(e.grupo))) {
      for (const [c, n] of [[r.Codigo_equipo1, r.Equipo_local], [r.Codigo_equipo2, r.Equipo_visitante]])
        if (nombres.includes(normEquipo(n))) cand.set(c, n);
    }
    console.log(`${eq} (${e.grupo}): ${cand.size ? [...cand].map(([c, n]) => `código ${c} ("${n}")`).join(', ') : 'ningún candidato'}` +
      (e.codigos.length ? `  · confirmados: ${e.codigos.join(', ')}` : '  · SIN CONFIRMAR'));
  }
  console.log('\nPara confirmar: comprobar con el acta de la jornada 1 (fecha y marcador) y escribir los códigos en ' + path.relative(ROOT, CFG_PATH) + '.');
  return 0;
}

/** Calendario manual (plan B): equipo;jornada;fecha(dd/mm/aaaa);hora;local_visitante;rival;pista */
function leerManual() {
  const f = path.join(ROOT, 'data', `calendario_manual_${TEMPORADA}.csv`);
  if (!fs.existsSync(f)) return [];
  return parseCsv(leerTexto(f)).filter(r => limpia(r.equipo) && limpia(r.fecha)).map(r => {
    const [d, m, a] = limpia(r.fecha).split('/');
    return { equipo: limpia(r.equipo).toUpperCase(), fase: 'liga', grupo: cfg.equipos[limpia(r.equipo).toUpperCase()].grupo,
      jornada: r.jornada ? +r.jornada : null, fecha: `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`, hora: limpia(r.hora) || null,
      local: /^l/i.test(limpia(r.local_visitante)), descansa: /descansa/i.test(r.rival), rival: limpia(r.rival) || null, rival_codigo: null,
      campo: limpia(r.pista) || null, estado: null, pf: null, pc: null, fuente: 'manual' };
  });
}

const minutos = h => { const m = String(h || '').match(/(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : null; };
const fechaEs = f => f.split('-').reverse().join('/');

function generar(fichero, modificado) {
  const codigos = {};
  for (const [eq, e] of Object.entries(cfg.equipos)) for (const c of e.codigos) codigos[c] = eq;
  const faltan = Object.entries(cfg.equipos).filter(([, e]) => !e.codigos.length).map(([eq]) => eq);
  let abiertos = [];
  if (fichero) {
    if (faltan.length) console.log(`! Sin códigos confirmados para ${faltan.join(' y ')}: de ${path.basename(fichero)} sólo se toma lo de los equipos confirmados. Usa --descubrir.`);
    abiertos = partidosDelClub(fichero, codigos).map(p => ({ ...p, fuente: 'datos abiertos 211549' }));
  }
  const manual = leerManual();
  // Manda el dato abierto; el manual sólo rellena lo que el portal aún no publica.
  const clave = p => p.equipo + '|' + p.fecha;
  const hay = new Set(abiertos.map(clave));
  const discrepancias = [];
  for (const m of manual) {
    const a = abiertos.find(x => clave(x) === clave(m));
    if (a && ((m.hora && m.hora !== a.hora) || (m.campo && normEquipo(m.campo) !== normEquipo(a.campo))))
      discrepancias.push(`${m.equipo} ${m.fecha}: manual ${m.hora} ${m.campo} / portal ${a.hora} ${a.campo} (vale el portal)`);
  }
  const partidos = abiertos.concat(manual.filter(m => !hay.has(clave(m))))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.equipo.localeCompare(b.equipo));

  // Regla D33: el mismo domingo, ¿cuánto margen hay entre los dos partidos?
  for (const p of partidos) {
    const otro = partidos.find(q => q !== p && q.fecha === p.fecha && q.equipo !== p.equipo && !q.descansa);
    if (!otro || p.descansa) continue;
    const dif = minutos(p.hora) !== null && minutos(otro.hora) !== null ? Math.abs(minutos(p.hora) - minutos(otro.hora)) : null;
    p.mismo_dia = { equipo: otro.equipo, hora: otro.hora, campo: otro.campo, diferencia_min: dif };
  }

  const json = {
    temporada: TEMPORADA,
    fuente: { dataset: '211549 (datos.madrid.es), Ayuntamiento de Madrid, CC BY 4.0', fichero: fichero ? path.basename(fichero) : null,
      modificado_portal: modificado || null, manual: manual.length ? `data/calendario_manual_${TEMPORADA}.csv` : null },
    equipos: cfg.equipos,
    partidos,
  };
  fs.writeFileSync(SALIDA_JSON, JSON.stringify(json, null, 1) + '\n', 'utf8');

  // Tabla limpia para la plantilla de importación de SportEasy (una fila por partido).
  const cab = ['campeonato', 'tipo', 'fecha', 'hora', 'local_visitante', 'rival', 'lugar', 'jornada', 'otra_ficha_mismo_dia', 'fuente'];
  const q = v => { const s = v === null || v === undefined ? '' : String(v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const filas = partidos.filter(p => !p.descansa).map(p => [cfg.campeonato_sporteasy[p.equipo], 'Partido', fechaEs(p.fecha), p.hora || '',
    p.local ? 'Local' : 'Visitante', p.rival, p.campo || '', p.jornada === null ? '' : p.jornada,
    p.mismo_dia ? `${cfg.campeonato_sporteasy[p.mismo_dia.equipo]} a las ${p.mismo_dia.hora}` + (p.mismo_dia.diferencia_min !== null ? ` (${p.mismo_dia.diferencia_min} min de diferencia)` : '') : '',
    p.fuente]);
  fs.writeFileSync(SALIDA_CSV, '﻿' + [cab, ...filas].map(f => f.map(q).join(';')).join('\r\n') + '\r\n', 'utf8');

  console.log(`${path.relative(ROOT, SALIDA_JSON)}: ${partidos.length} filas (${abiertos.length} del portal, ${partidos.length - abiertos.length} manuales), ${partidos.filter(p => p.pf !== null).length} con marcador.`);
  console.log(`${path.relative(ROOT, SALIDA_CSV)}: ${filas.length} partidos para SportEasy.`);
  discrepancias.forEach(d => console.log('  ! ' + d));
  const juntos = partidos.filter(p => p.mismo_dia && p.equipo === 'MDA');
  if (juntos.length) console.log(`  Domingos con partido de las dos fichas: ${juntos.length} (margen mínimo: ${Math.min(...juntos.map(p => p.mismo_dia.diferencia_min ?? Infinity))} min).`);
  return 0;
}

(async () => {
  if (args.includes('--comprobar')) {
    const m = await metadatos();
    const previo = fs.existsSync(SALIDA_JSON) ? JSON.parse(fs.readFileSync(SALIDA_JSON, 'utf8')).fuente.modificado_portal : null;
    const nuevo = !!m.modificado && m.modificado !== previo;
    console.log(`Portal: modificado ${m.modificado}; CSV de partidos: ${m.csv ? path.basename(m.csv.url) : 'no encontrado'}. Último calendario generado con: ${previo || 'ninguno'}.`);
    console.log(nuevo ? 'HAY UNA VERSIÓN NUEVA en el portal.' : 'Sin cambios.');
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `nuevo=${nuevo ? 1 : 0}\nmodificado=${m.modificado}\n`);
    return;
  }
  if (args.includes('--descargar')) {
    const m = await metadatos();
    if (!m.csv) throw new Error('No encuentro el CSV de partidos en los metadatos del dataset.');
    fs.mkdirSync(rawDir, { recursive: true });
    const dia = (m.modificado || new Date().toISOString()).slice(0, 10).replace(/-/g, '');
    const destino = path.join(rawDir, `211549_partidos_${dia}.csv`);
    if (fs.existsSync(destino)) { console.log(`Ya estaba descargado: ${path.relative(ROOT, destino)}`); }
    else { await get(m.csv.url, destino); console.log(`Descargado ${path.basename(m.csv.url)} -> ${path.relative(ROOT, destino)}`); }
    fs.writeFileSync(destino + '.meta.json', JSON.stringify({ url: m.csv.url, modificado: m.modificado }) + '\n');
    return;
  }
  const csv = argVal('--csv', ultimoRaw() ? path.join(rawDir, ultimoRaw()) : null);
  if (args.includes('--descubrir')) { if (!csv) throw new Error('No hay CSV: usa --descargar o --csv.'); process.exitCode = descubrir(csv); return; }
  let modificado = null;
  if (csv && fs.existsSync(csv + '.meta.json')) modificado = JSON.parse(fs.readFileSync(csv + '.meta.json', 'utf8')).modificado;
  process.exitCode = generar(csv, modificado);
})().catch(e => { console.error('ERROR: ' + e.message); process.exitCode = 1; });
