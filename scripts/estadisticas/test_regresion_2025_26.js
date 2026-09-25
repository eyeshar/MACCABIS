/**
 * test_regresion_2025_26.js
 *
 * Comprueba que el pipeline nuevo reproduce data/season_2025-26.json (el publicado, generado
 * en su día con parse_stats.py + consolidate.py en el chat de Claude).
 *
 * De las fuentes de 2025/26 hay en el equipo de Iván las 42 actas, la asistencia y UNA sola
 * hoja XLSX (estadisticaPartido_21_mda.xlsx): las otras 40 se subieron al chat y no quedan
 * copias. Por eso el test tiene tres partes:
 *
 *   A. REAL: las 42 actas + la hoja real + calendario abierto + asistencia -> partidos, parciales
 *      medios y el boxscore de la jornada 21 del MdA, comparados con lo publicado.
 *   B. HOJA REAL: la fila de cada jugador de la hoja 21 MdA, campo a campo.
 *   C. CONSOLIDACIÓN COMPLETA: las 41 hojas se reconstruyen a partir del boxscore publicado
 *      (que es copia fiel de cada hoja: mismas filas y mismos números) y se pasa TODO el
 *      pipeline. Compara el JSON entero. Así se prueba la lógica de enlazado, jugadores,
 *      medias, porcentajes, redondeos, asistencia y orden.
 *
 * Cada diferencia se lista con su ruta. Las diferencias ESPERADAS (correcciones de errores
 * del pipeline antiguo y datos nuevos) están declaradas abajo con su explicación; cualquier
 * otra hace fallar el test.
 *
 * USO:  node scripts/estadisticas/test_regresion_2025_26.js
 */
const fs = require('fs');
const path = require('path');
const { construir, leerFuentes } = require('./generar_temporada');
const CONFIG = require('./temporadas.json');

const ROOT = path.resolve(__dirname, '..', '..');
const PUB = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'season_2025-26.json'), 'utf8'));
const personas = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'personas.json'), 'utf8')).personas;
const cfg = CONFIG['2025-26'];

/** Diferencias que se esperan y por qué. Clave: ruta con comodines (*). */
const ESPERADAS = [
  { ruta: 'partidos[*].hora', motivo: 'Dato NUEVO: hora del partido, leída del acta (la pide D33 para la regla de doblaje).' },
  { ruta: 'partidos[*].pista', motivo: 'Dato NUEVO: pista del partido, leída del acta.' },
  { ruta: 'partidos[num=329781].pn', motivo: 'CORRECCIÓN: la incomparecencia de Pelota Naranja es la jornada 16 del MdL (su hoja es estadisticaPartido_16_mdl, y así lo dice el calendario abierto); el pipeline antiguo la dejó sin jornada (null).' },
  { ruta: 'partidos[num=329814].pn', motivo: 'CORRECCIÓN: MdL-Chavalitros del 10/05/2026 es la jornada 22 (calendario abierto); el pipeline antiguo le puso la 11, que es la de la ida (25/01/2026). No tiene hoja de estadística.' },
  { ruta: 'box.1_MDA[*].person_id', motivo: 'CORRECCIÓN: la fila con la errata del acta "DE CARVLHO, JULIO CESAR" no llevaba person_id en el boxscore; ahora sí (de-carvalho-rodrigues-julio-cesar).' },
];

function comparar(a, b, ruta, out, ctx = {}) {
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  if (a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b)) {
    if (Array.isArray(a)) {
      if (a.length !== b.length) { out.push({ ruta: ruta + '.length', pub: a.length, nuevo: b.length }); return; }
      a.forEach((x, i) => comparar(x, b[i], ruta + '[' + (x && x.num && /partidos$/.test(ruta) ? 'num=' + x.num : i) + ']', out));
      return;
    }
    const ka = Object.keys(a), kb = Object.keys(b);
    for (const k of new Set([...ka, ...kb])) {
      if (!(k in a)) out.push({ ruta: ruta + '.' + k, pub: '(no existe)', nuevo: b[k] });
      else if (!(k in b)) out.push({ ruta: ruta + '.' + k, pub: a[k], nuevo: '(no existe)' });
      else comparar(a[k], b[k], ruta + '.' + k, out);
    }
    if (ka.filter(k => k in b).join() !== kb.filter(k => k in a).join()) out.push({ ruta: ruta + ' (orden de claves)', pub: ka.join(','), nuevo: kb.join(',') });
    return;
  }
  out.push({ ruta, pub: a, nuevo: b });
}

const patron = r => new RegExp('^' + r.replace(/[.[\]]/g, m => '\\' + m).replace(/\\\[\*\\\]/g, '\\[[^\\]]+\\]') + '$');
function clasificar(difs) {
  const esperadas = [], inesperadas = [];
  for (const d of difs) {
    const e = ESPERADAS.find(x => patron(x.ruta).test(d.ruta.replace(/\[(\d+)\]/g, (m, i) => m)));
    (e ? esperadas : inesperadas).push({ ...d, motivo: e && e.motivo });
  }
  return { esperadas, inesperadas };
}

/** Reconstruye cada hoja a partir del boxscore publicado (mismas filas y números). */
function hojasDesdePublicado() {
  const info = {};
  for (const p of PUB.players) for (const g of p.games) info[g.pn + '_' + g.eq] = g;
  return Object.entries(PUB.box).map(([k, filas]) => {
    const [pn, eq] = k.split('_');
    const g = info[k];
    const rival = g.rival.replace(/ \(PO\)$/, '');
    const playoff = +pn > cfg.jornadas_liga;
    return { fichero: `(reconstruida) estadisticaPartido_${playoff ? 'PO' + (pn - cfg.jornadas_liga) : pn}_${eq.toLowerCase()}.xlsx`,
      jornada: playoff ? pn - cfg.jornadas_liga : +pn, playoff, equipo: eq,
      local: g.local ? eq : rival, visitante: g.local ? rival : eq,
      jugadores: filas.map(f => ({ num: f.num, nombre: f.nombre, sec: f.sec, pts: f.pts, p2a: f.p2a, p2i: f.p2i, p3a: f.p3a, p3i: f.p3i, tla: f.tla, tli: f.tli, fc: f.fc, val: f.val, pm: f.pm })),
      totales: { pts: filas.reduce((s, f) => s + f.pts, 0) } };
  });
}

function informe(titulo, difs) {
  const { esperadas, inesperadas } = clasificar(difs);
  console.log(`\n=== ${titulo} ===`);
  console.log(`  diferencias: ${difs.length} (esperadas ${esperadas.length}, INESPERADAS ${inesperadas.length})`);
  const porMotivo = new Map();
  esperadas.forEach(d => porMotivo.set(d.motivo, (porMotivo.get(d.motivo) || 0) + 1));
  for (const [m, n] of porMotivo) console.log(`  · ${n} × ${m}`);
  inesperadas.slice(0, 40).forEach(d => console.log(`  X ${d.ruta}: publicado ${JSON.stringify(d.pub)} -> nuevo ${JSON.stringify(d.nuevo)}`));
  if (inesperadas.length > 40) console.log(`  ... y ${inesperadas.length - 40} más`);
  return inesperadas.length;
}

(async () => {
  const f = await leerFuentes('2025-26', cfg);
  console.log(`Fuentes: ${f.actas.length} actas, ${f.hojas.length} hoja(s) real(es), ${f.calendario.length} partidos en el calendario abierto, asistencia de ${Object.keys(f.asistencia.part).length} jugadores.`);
  let fallos = 0;

  // A + B: fuentes reales
  const A = construir({ temporada: '2025-26', cfg, ...f, personas });
  if (A.errores.length) { console.log('ERRORES:'); A.errores.forEach(e => console.log('  X ' + e)); fallos += A.errores.length; }
  const difA = [];
  comparar(PUB.partidos, A.json.partidos, 'partidos', difA);
  comparar(PUB.qstats, A.json.qstats, 'qstats', difA);
  fallos += informe('A. Partidos y parciales desde las 42 actas reales', difA);
  const difB = [];
  comparar(PUB.box['21_MDA'], A.json.box['21_MDA'], 'box.21_MDA', difB);
  fallos += informe('B. Boxscore de la hoja real (jornada 21 MdA)', difB);
  console.log('  enlace hoja -> acta: ' + A.enlaces.map(e => `${e.hoja} -> ${e.acta} (jornada ${e.pn}, ${e.validado})`).join('; '));

  // C: todo el pipeline con las 41 hojas reconstruidas
  const hojas = hojasDesdePublicado();
  const C = construir({ temporada: '2025-26', cfg, ...f, hojas, personas });
  if (C.errores.length) { console.log('ERRORES:'); C.errores.forEach(e => console.log('  X ' + e)); fallos += C.errores.length; }
  const difC = [];
  comparar(PUB, C.json, '', difC);
  difC.forEach(d => { d.ruta = d.ruta.replace(/^\./, ''); });
  fallos += informe(`C. JSON completo con las ${hojas.length} hojas reconstruidas`, difC);
  console.log('  avisos del pipeline: ' + (C.avisos.length ? '\n    ! ' + C.avisos.join('\n    ! ') : 'ninguno'));

  console.log(fallos ? `\nRESULTADO: ${fallos} diferencia(s) o error(es) sin explicar.` : '\nRESULTADO: OK. Todas las diferencias están explicadas.');
  process.exitCode = fallos ? 1 : 0;
})();
