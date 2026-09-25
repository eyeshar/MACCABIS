/**
 * procesar_jornada.js — el comando semanal ("procesar jornada").
 *
 * Iván descarga en el móvil/PC, desde la app Afición FBM, las actas (Acta-Partido-<nº>.pdf) y
 * las hojas de estadística (estadisticaPartido*.xlsx) de la jornada, y opcionalmente el export
 * de asistencia de SportEasy (bilan_presence*.xlsx). Sin renombrar nada. Después:
 *
 *   npm run jornada                      (busca en ~/Downloads)
 *   npm run jornada -- --desde <carpeta> (busca en otra carpeta)
 *   npm run jornada -- --dry             (sólo dice qué haría)
 *
 * Qué hace:
 *   1. Localiza los ficheros NUEVOS de la temporada (las actas por su fecha, las hojas por la
 *      etiqueta "26/27" de su título) y los COPIA a fuentes_fbm/<temporada>/ con copia segura
 *      (nunca sobrescribe; si choca un nombre con contenido distinto, para y avisa). Los
 *      originales se quedan donde estaban. fuentes_fbm/ está fuera de git: los ficheros de la
 *      FBM nunca van al repositorio.
 *   2. Regenera data/season_<temporada>.json con todas las validaciones (puntos de la hoja =
 *      marcador del acta, parciales = marcador). Si algo no cuadra, NO escribe nada.
 *   3. Añade la temporada a data/index.json si aún no está (sin cambiar la de por defecto) y
 *      comprueba identidades (check:personas).
 *   4. Resume la jornada: resultados, anotadores y avisos.
 *
 * Publicar (commit + push de los dos JSON) es un paso aparte y explícito.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { copiaSegura } = require('../lib/copia_segura');
const { leerActa } = require('./leer_acta');
const { leerHoja, datosDelNombre } = require('./leer_hoja');
const { generar } = require('./generar_temporada');
const { normEquipo } = require('./util');
const CONFIG = require('./temporadas.json');

const ROOT = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const argVal = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const TEMPORADA = args.find(a => /^\d{4}-\d{2}$/.test(a)) || '2026-27';
const DESDE = argVal('--desde', path.join(os.homedir(), 'Downloads'));
const DRY = args.includes('--dry');

const cfg = CONFIG[TEMPORADA];
if (!cfg) { console.error(`No hay configuración para ${TEMPORADA}.`); process.exit(1); }
const BASE = path.join(ROOT, cfg.carpeta);
const esNuestro = n => Object.values(cfg.nombres_club).flat().some(x => normEquipo(x) === normEquipo(n));
const md5 = f => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex').slice(0, 8);

async function recoger() {
  if (!fs.existsSync(DESDE)) throw new Error(`No existe la carpeta ${DESDE}`);
  const todos = fs.readdirSync(DESDE);
  const plan = [];
  // Actas: por su fecha (dentro de la temporada) y porque juegue uno de nuestros equipos.
  for (const f of todos.filter(f => /^Acta-Partido-\d+( \(\d+\))?\.pdf$/i.test(f))) {
    let a;
    try { a = await leerActa(path.join(DESDE, f)); } catch (e) { console.log(`  ! ${f}: no se puede leer (${e.message})`); continue; }
    if (!a.fecha || a.fecha < cfg.inicio) continue;
    if (!esNuestro(a.equipoA) && !esNuestro(a.equipoB)) continue;
    plan.push({ origen: f, destino: 'actas', nombre: `Acta-Partido-${a.num}.pdf`, que: `acta ${a.num} (${a.fecha})` });
  }
  // Hojas: por la etiqueta de temporada del título ("... - FBM - 26/27").
  for (const f of todos.filter(f => /^estadisticaPartido.*\.xlsx$/i.test(f))) {
    let h;
    try { h = leerHoja(path.join(DESDE, f)); } catch (e) { console.log(`  ! ${f}: no se puede leer (${e.message})`); continue; }
    if (!h.titulo.includes(cfg.etiqueta_fbm)) continue;
    // Se conserva el nombre si ya dice jornada y equipo; si no, uno único y legible.
    const nombre = datosDelNombre(f) ? f.replace(/ \(\d+\)(?=\.xlsx$)/i, '')
      : `estadisticaPartido_${h.equipo.toLowerCase()}_vs_${normEquipo(normEquipo(h.local) === h.equipo ? h.visitante : h.local).replace(/ /g, '-').toLowerCase()}_${md5(path.join(DESDE, f))}.xlsx`;
    plan.push({ origen: f, destino: 'hojas', nombre, que: `hoja ${h.titulo.replace(/^Estadísticas - /, '').replace(/ - SenMas.*$/, '')}` });
  }
  // Asistencia: el export de SportEasy más reciente modificado desde el inicio de temporada.
  const bilan = todos.filter(f => /^bilan_presence.*\.xlsx$/i.test(f))
    .map(f => ({ f, t: fs.statSync(path.join(DESDE, f)).mtime })).filter(x => x.t.toISOString().slice(0, 10) >= cfg.inicio)
    .sort((a, b) => b.t - a.t)[0];
  if (bilan) plan.push({ origen: bilan.f, destino: 'asistencia', nombre: `bilan_presence_${bilan.t.toISOString().slice(0, 10)}_${md5(path.join(DESDE, bilan.f))}.xlsx`, que: 'asistencia de SportEasy' });
  return plan;
}

(async () => {
  console.log(`Procesar jornada ${TEMPORADA}: buscando ficheros en ${DESDE}`);
  const plan = await recoger();
  let nuevos = 0;
  for (const p of plan) {
    if (DRY) { console.log(`  [dry] ${p.que}: ${p.origen} -> ${cfg.carpeta}/${p.destino}/${p.nombre}`); continue; }
    try {
      const r = copiaSegura(path.join(DESDE, p.origen), path.join(BASE, p.destino), p.nombre);
      if (r.copiado) { nuevos++; console.log(`  + ${p.que}  (${p.nombre})`); }
    } catch (e) { console.error(`\nERROR: ${e.message}\nNo se ha tocado nada más.`); process.exit(1); }
  }
  if (!DRY) console.log(nuevos ? `${nuevos} fichero(s) nuevo(s) copiados a ${cfg.carpeta}/.` : 'No hay ficheros nuevos (ya estaban todos copiados).');

  const antes = fs.existsSync(path.join(ROOT, 'data', `season_${TEMPORADA}.json`))
    ? JSON.parse(fs.readFileSync(path.join(ROOT, 'data', `season_${TEMPORADA}.json`), 'utf8')) : { partidos: [] };
  const r = await generar(TEMPORADA, { dry: DRY });
  console.log(`\n${TEMPORADA}: ${r.fuentes.actas} actas y ${r.fuentes.hojas} hojas -> ${r.json.partidos.length} partidos, ${r.json.players.length} jugadores con estadísticas.`);
  r.avisos.forEach(a => console.log('  ! ' + a));
  if (r.errores.length) {
    console.log('\nERRORES — no se ha escrito nada:'); r.errores.forEach(e => console.log('  X ' + e));
    process.exit(1);
  }
  r.enlaces.forEach(e => console.log(`  ✓ ${e.hoja} -> acta ${e.acta}, jornada ${e.pn}: puntos de la hoja = marcador (${e.validado})`));

  // Resumen de lo nuevo
  const ya = new Set(antes.partidos.map(p => p.num));
  const nuevosP = r.json.partidos.filter(p => !ya.has(p.num));
  if (nuevosP.length) console.log('\nPartidos nuevos:');
  for (const p of nuevosP) {
    const box = r.json.box[p.pn + '_' + p.equipo] || [];
    const top = box.filter(f => f.pts > 0).slice(0, 3).map(f => `${f.display} ${f.pts}`).join(', ');
    console.log(`  ${p.fecha} ${p.hora || ''} ${p.pista || ''} · ${p.equipo} ${p.res === 'G' ? 'gana' : p.res === 'P' ? 'pierde' : '?'} ${p.pf}-${p.pc} a ${p.rival} (jornada ${p.pn})${top ? ' · ' + top : ''}${box.length ? '' : ' · SIN HOJA DE ESTADÍSTICA'}`);
  }
  if (DRY) { console.log('\n[dry] no se ha escrito nada.'); return; }

  // index.json: la temporada entra en el selector en cuanto tiene partidos; la de por defecto no cambia.
  const idxPath = path.join(ROOT, 'data', 'index.json');
  const idx = JSON.parse(fs.readFileSync(idxPath, 'utf8'));
  if (r.json.partidos.length && !idx.seasons.some(s => s.id === TEMPORADA)) {
    idx.seasons.push({ id: TEMPORADA, label: cfg.label, file: `data/season_${TEMPORADA}.json` });
    fs.writeFileSync(idxPath, JSON.stringify(idx, null, 1) + '\n', 'utf8');
    console.log(`\ndata/index.json: añadida ${cfg.label} al selector (la temporada por defecto sigue siendo ${idx.default}).`);
  }
  try { execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build_personas.js'), '--check'], { stdio: 'pipe' }); console.log('Identidades: OK (check:personas).'); }
  catch (e) { console.log('Identidades: PROBLEMAS\n' + e.stdout); process.exit(1); }

  console.log('\nListo para revisar. Publicar = commit y push de data/season_' + TEMPORADA + '.json y data/index.json.');
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
