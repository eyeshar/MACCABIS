/**
 * procesar_jornada.js — el comando semanal ("procesar jornada").
 *
 * Iván descarga las actas (Acta-Partido-<nº>.pdf, desde la web gesdeportiva.fbm.es, D106) y las hojas de
 * estadística (estadisticaPartido*.xlsx, desde la app Afición FBM) de la jornada, y opcionalmente el export
 * de asistencia de SportEasy (bilan_presence*.xlsx). Sin renombrar nada. Después:
 *
 *   npm run jornada                      (busca en ~/Downloads)
 *   npm run jornada -- --desde <carpeta> (busca en otra carpeta)
 *   npm run jornada -- --jornada N       (las hojas de liga donde no jugamos son de la jornada N)
 *   npm run jornada -- --dry             (sólo dice qué haría)
 *
 * Qué hace:
 *   1. Localiza los ficheros NUEVOS de la temporada (las actas por su fecha, las hojas por la
 *      etiqueta "26/27" de su título) y los COPIA a fuentes_fbm/<temporada>/ con copia segura
 *      (nunca sobrescribe; si choca un nombre con contenido distinto, para y avisa). Los
 *      originales se quedan donde estaban. fuentes_fbm/ está fuera de git: los ficheros de la
 *      FBM nunca van al repositorio.
 *      - Un fichero cuyo CONTENIDO ya está en fuentes_fbm/<temporada>/ (mismo hash, en cualquier
 *        subcarpeta: hojas/, liga/, actas/, asistencia/) se DESCARTA y se dice cuál y por qué: las
 *        hojas de jornadas anteriores que siguen en Descargas no se vuelven a cargar como si fueran
 *        de la jornada pedida (23/10/2026).
 *      - Si una hoja no puede ser de la jornada a la que iría (la nuestra, por el calendario; las de
 *        liga, porque uno de sus equipos juega contra nosotros esa jornada, ya tiene hoja de esa
 *        jornada o la hoja se descargó antes de que se jugara), PARA sin copiar nada y avisa.
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
const { leerHoja } = require('./leer_hoja');
const liga = require('./liga');
const { normEquipo } = require('./util');
const CONFIG = require('./temporadas.json');

const ROOT = path.resolve(__dirname, '..', '..');
const md5 = f => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
const slug = x => normEquipo(x).replace(/ /g, '-').toLowerCase();
const J = j => 'J' + String(j).padStart(2, '0');

/** Hash de todos los ficheros ya cargados en la carpeta de la temporada (todas las subcarpetas). */
function hashesCargados(base) {
  const res = new Map();                                   // md5 -> ruta relativa a base
  const anda = dir => {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) anda(p);
      else if (f.isFile() && !f.name.startsWith('~$')) res.set(md5(p), path.relative(base, p).replace(/\\/g, '/'));
    }
  };
  anda(base);
  return res;
}

/** Equipos (slug) que ya tienen hoja de cada jornada en fuentes_fbm/<temporada>/ (liga/ y hojas/), con el fichero. */
function hojasPorJornada(base, cfg) {
  const res = {};                                          // J02 -> Map(slug equipo -> fichero)
  const anota = (jor, equipo, f) => { (res[jor] || (res[jor] = new Map())).set(equipo, f); };
  for (const f of fs.existsSync(path.join(base, 'liga')) ? fs.readdirSync(path.join(base, 'liga')) : []) {
    const m = f.match(/^liga_(J\d+)_G\d+_(.+)_vs_(.+)_[0-9a-f]{8}\.xlsx$/i);
    if (m) { anota(m[1].toUpperCase(), m[2].toLowerCase(), 'liga/' + f); anota(m[1].toUpperCase(), m[3].toLowerCase(), 'liga/' + f); }
  }
  for (const f of fs.existsSync(path.join(base, 'hojas')) ? fs.readdirSync(path.join(base, 'hojas')) : []) {
    const m = f.match(/^estadisticaPartido_(J\d+)_([A-Z]+)_vs_(.+)_[0-9a-f]{8}\.xlsx$/i);
    if (m) { anota(m[1].toUpperCase(), slug(m[2]), 'hojas/' + f); anota(m[1].toUpperCase(), m[3].toLowerCase(), 'hojas/' + f); }
  }
  return res;
}

/**
 * Planifica qué copiar. Devuelve { plan, descartes }. Lanza un Error (sin haber copiado nada) si una hoja
 * no puede ser de la jornada a la que iría.
 *
 * @param o { temporada, desde, base, jornadaForzada, sinAsistencia, hoy, log }
 */
async function recoger(o) {
  const cfg = CONFIG[o.temporada];
  if (!cfg) throw new Error(`No hay configuración para ${o.temporada}.`);
  const DESDE = o.desde, BASE = o.base || path.join(ROOT, cfg.carpeta);
  const log = o.log || console.log;
  const esNuestro = n => Object.values(cfg.nombres_club).flat().some(x => normEquipo(x) === normEquipo(n));
  if (!fs.existsSync(DESDE)) throw new Error(`No existe la carpeta ${DESDE}`);
  const todos = fs.readdirSync(DESDE);
  const plan = [], descartes = [];
  const cargados = hashesCargados(BASE);
  const yaEnJornada = hojasPorJornada(BASE, cfg);
  const enPlan = new Map();                                // md5 -> origen (duplicados dentro de la propia carpeta)
  const descarta = (origen, motivo) => { descartes.push({ origen, motivo }); log(`  = ${origen}: ${motivo}`); };
  /** true si el fichero ya está cargado (o ya va en el plan) y se ha descartado. */
  const repetido = (f, que) => {
    const h = md5(path.join(DESDE, f));
    if (cargados.has(h)) { descarta(f, `${que} ya cargada como ${cfg.carpeta}/${cargados.get(h)} (mismo contenido): no se vuelve a copiar.`); return true; }
    if (enPlan.has(h)) { descarta(f, `${que} es idéntica a "${enPlan.get(h)}" de la misma carpeta: se copia una sola vez.`); return true; }
    enPlan.set(h, f);
    return false;
  };

  // Actas: por su fecha (dentro de la temporada) y porque juegue uno de nuestros equipos.
  for (const f of todos.filter(f => /^Acta-Partido-\d+( \(\d+\))?\.pdf$/i.test(f))) {
    let a;
    try { a = await leerActa(path.join(DESDE, f)); } catch (e) { log(`  ! ${f}: no se puede leer (${e.message})`); continue; }
    if (!a.fecha || a.fecha < cfg.inicio) continue;
    if (!esNuestro(a.equipoA) && !esNuestro(a.equipoB)) continue;
    if (repetido(f, `acta ${a.num} (${a.fecha})`)) continue;
    plan.push({ origen: f, destino: 'actas', nombre: `Acta-Partido-${a.num}.pdf`, que: `acta ${a.num} (${a.fecha})` });
  }

  // Hojas: por la etiqueta de temporada del título ("... - FBM - 26/27"). El NOMBRE del fichero no
  // cuenta (la FBM lo llama estadisticaPartido_<fechaDeDescarga>.xlsx, con sufijos " 1", "_1", " (1)"):
  // equipo, rival y local/visitante salen de la cabecera y el partido, del calendario.
  const calendario = cfg.calendario.filter(c => c.formato === 'json' && fs.existsSync(path.join(ROOT, c.fichero)))
    .flatMap(c => JSON.parse(fs.readFileSync(path.join(ROOT, c.fichero), 'utf8')).partidos);
  const fechaDescarga = f => fs.statSync(path.join(DESDE, f)).mtime.toISOString().slice(0, 10);
  const yaTiene = (jor, equipo) => (yaEnJornada[jor] || new Map()).get(slug(equipo));
  const reserva = (jor, equipo, f) => { (yaEnJornada[jor] || (yaEnJornada[jor] = new Map())).set(slug(equipo), f + ' (en esta misma carpeta)'); };

  for (const f of todos.filter(f => /^estadisticaPartido.*\.xlsx$/i.test(f) && !f.startsWith('~$'))) {
    // Partidos de liga donde NO jugamos (D73): copia segura a liga/, con la jornada y el grupo en el nombre.
    // Los datos por jugador de esas hojas son de terceros: sólo van a Supabase, nunca al repositorio.
    let id;
    try { id = liga.identificarHoja(o.temporada, path.join(DESDE, f)); } catch (e) { id = null; }
    if (id && id.etiquetaOk && !id.nuestro) {
      const que = `hoja de liga ${id.grupo.clave} ${id.hoja.local} - ${id.hoja.visitante}`;
      if (repetido(f, que)) continue;
      const jor = o.jornadaForzada || liga.jornadaPorFecha(id.grupo, o.hoy);
      if (!jor) { log(`  ! ${f}: no sé de qué jornada es (usa --jornada N).`); continue; }
      const como = o.jornadaForzada ? `--jornada ${jor}` : `la jornada ${jor}, la última jugada del ${id.grupo.clave}`;
      // La hoja no puede ser de esa jornada si: uno de los dos juega contra nosotros esa jornada (calendario),
      // uno de los dos ya tiene hoja de esa jornada, o se descargó antes de que se jugara.
      const nuestroDia = calendario.find(c => c.equipo === id.grupo.nuestro && c.fase === 'liga' && c.jornada === jor && !c.descansa);
      for (const eq of [id.hoja.local, id.hoja.visitante]) {
        if (nuestroDia && nuestroDia.rival && normEquipo(nuestroDia.rival) === normEquipo(eq))
          throw new Error(`${f} (${id.hoja.local} - ${id.hoja.visitante}) no puede ser de la ${J(jor)}: según el calendario, ${eq} juega contra ${id.grupo.nuestro} en la ${J(jor)} (${como}). ¿Es de otra jornada? Indícala con --jornada N o quítala de la carpeta.`);
        const ya = yaTiene(J(jor), eq);
        if (ya) throw new Error(`${f} (${id.hoja.local} - ${id.hoja.visitante}) no puede ser de la ${J(jor)}: ${eq} ya tiene hoja de esa jornada (${ya}) (${como}). ¿Es de otra jornada? Indícala con --jornada N o quítala de la carpeta.`);
      }
      const fechaJ = id.grupo.fechas[jor];
      if (fechaJ && fechaDescarga(f) < fechaJ)
        throw new Error(`${f} (${id.hoja.local} - ${id.hoja.visitante}) no puede ser de la ${J(jor)}: se descargó el ${fechaDescarga(f)} y esa jornada se jugó el ${fechaJ} (${como}). ¿Es de otra jornada? Indícala con --jornada N o quítala de la carpeta.`);
      reserva(J(jor), id.hoja.local, f); reserva(J(jor), id.hoja.visitante, f);
      const nombre = `liga_${J(jor)}_${id.grupo.clave}_${slug(id.hoja.local)}_vs_${slug(id.hoja.visitante)}_${md5(path.join(DESDE, f)).slice(0, 8)}.xlsx`;
      plan.push({ origen: f, destino: 'liga', nombre, que: `liga ${id.grupo.clave} ${J(jor)}${o.jornadaForzada ? '' : ' (inferida por fecha)'}: ${id.hoja.local} - ${id.hoja.visitante}` });
      continue;
    }
    let h;
    try { h = leerHoja(path.join(DESDE, f)); } catch (e) { log(`  ! ${f}: no se puede leer (${e.message})`); continue; }
    if (!h.titulo.includes(cfg.etiqueta_fbm)) continue;
    const rival = h.esLocal ? h.visitante : h.local;
    const que = `hoja ${h.titulo.replace(/^Estadísticas - /, '').replace(/ - SenMas.*$/, '')}`;
    if (repetido(f, que)) continue;
    const cal = calendario.filter(c => c.equipo === h.equipo && !c.descansa && c.local === h.esLocal && normEquipo(c.rival) === normEquipo(rival));
    if (cal.length !== 1) log(`  ! ${f}: ${h.equipo} ${h.esLocal ? 'en casa' : 'fuera'} contra ${rival}: ${cal.length} partidos posibles en el calendario (se copia igualmente; el pipeline decidirá).`);
    if (cal.length === 1 && o.jornadaForzada && cal[0].jornada !== o.jornadaForzada)
      throw new Error(`${f} (${h.equipo} contra ${rival}) es de la ${J(cal[0].jornada)} según el calendario, no de la ${J(o.jornadaForzada)} pedida con --jornada. Quítala de la carpeta o procesa esa jornada aparte.`);
    if (cal.length === 1) {
      const ya = yaTiene(J(cal[0].jornada), h.equipo);
      if (ya) throw new Error(`${f} (${h.equipo} contra ${rival}, ${J(cal[0].jornada)}): ${h.equipo} ya tiene hoja de esa jornada (${ya}) y esta es distinta. Decide cuál vale; no se copia nada.`);
      reserva(J(cal[0].jornada), h.equipo, f);
    }
    const jor = cal.length === 1 ? J(cal[0].jornada) : 'J--';
    const nombre = `estadisticaPartido_${jor}_${h.equipo}_vs_${slug(rival)}_${md5(path.join(DESDE, f)).slice(0, 8)}.xlsx`;
    plan.push({ origen: f, destino: 'hojas', nombre, que });
  }

  // Asistencia: el export de SportEasy más reciente modificado desde el inicio de temporada.
  const bilan = o.sinAsistencia ? undefined : todos.filter(f => /^bilan_presence.*\.xlsx$/i.test(f) && !f.startsWith('~$'))
    .map(f => ({ f, t: fs.statSync(path.join(DESDE, f)).mtime })).filter(x => x.t.toISOString().slice(0, 10) >= cfg.inicio)
    .sort((a, b) => b.t - a.t)[0];
  if (bilan && !repetido(bilan.f, 'asistencia de SportEasy'))
    plan.push({ origen: bilan.f, destino: 'asistencia', nombre: `bilan_presence_${bilan.t.toISOString().slice(0, 10)}_${md5(path.join(DESDE, bilan.f)).slice(0, 8)}.xlsx`, que: 'asistencia de SportEasy' });
  return { plan, descartes, cfg, base: BASE };
}

/** Copia el plan con copia segura. Devuelve cuántos ficheros nuevos ha copiado. Si algo choca, lanza un Error. */
function copiar(plan, o) {
  const log = o.log || console.log;
  let nuevos = 0;
  for (const p of plan) {
    if (o.dry) { log(`  [dry] ${p.que}: ${p.origen} -> ${path.basename(o.base)}/${p.destino}/${p.nombre}`); continue; }
    const r = copiaSegura(path.join(o.desde, p.origen), path.join(o.base, p.destino), p.nombre);
    if (r.copiado) { nuevos++; log(`  + ${p.que}  (${p.nombre})`); }
  }
  return nuevos;
}

module.exports = { recoger, copiar, hashesCargados, hojasPorJornada };

if (require.main === module) (async () => {
  const { generar } = require('./generar_temporada');
  const args = process.argv.slice(2);
  const argVal = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const TEMPORADA = args.find(a => /^\d{4}-\d{2}$/.test(a)) || '2026-27';
  const DESDE = argVal('--desde', path.join(os.homedir(), 'Downloads'));
  const DRY = args.includes('--dry');
  const JORNADA_FORZADA = +argVal('--jornada', 0) || null;   // jornada de las hojas de liga donde no jugamos (si no, la última con fecha <= hoy)
  const cfg = CONFIG[TEMPORADA];
  if (!cfg) { console.error(`No hay configuración para ${TEMPORADA}.`); process.exit(1); }
  const BASE = path.join(ROOT, cfg.carpeta);

  console.log(`Procesar jornada ${TEMPORADA}: buscando ficheros en ${DESDE}`);
  let plan, descartes;
  try {
    ({ plan, descartes } = await recoger({ temporada: TEMPORADA, desde: DESDE, base: BASE, jornadaForzada: JORNADA_FORZADA, sinAsistencia: args.includes('--sin-asistencia') }));
  } catch (e) { console.error(`\nERROR: ${e.message}\nNo se ha copiado nada.`); process.exit(1); }
  if (descartes.length) console.log(`${descartes.length} fichero(s) descartado(s) por estar ya cargados.`);
  let nuevos = 0;
  try { nuevos = copiar(plan, { desde: DESDE, base: BASE, dry: DRY }); }
  catch (e) { console.error(`\nERROR: ${e.message}\nNo se ha tocado nada más.`); process.exit(1); }
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
  r.enlaces.forEach(e => console.log(`  ✓ ${e.hoja} -> acta ${e.acta}, jornada ${e.pn}: ${e.acta === "PENDIENTE" ? "provisional" : "puntos de la hoja = marcador"} (${e.validado})`));

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

  // Liga completa de los dos grupos: data/liga_<temporada>.json (sólo datos por equipo; el detalle por jugador va a Supabase).
  if (cfg.liga) {
    const l = liga.construir(TEMPORADA);
    l.avisos.forEach(a => console.log('  ! ' + a));
    if (l.errores.length) { console.log(`\nERRORES DE LIGA — no se ha escrito data/liga_${TEMPORADA}.json:`); l.errores.forEach(e => console.log('  X ' + e)); process.exit(1); }
    fs.writeFileSync(path.join(ROOT, 'data', `liga_${TEMPORADA}.json`), JSON.stringify(l.publico, null, 1) + '\n', 'utf8');
    console.log(`\nLiga: ${l.fuentes} hojas -> data/liga_${TEMPORADA}.json (clasificación calculada, pendiente de contrastar con la oficial).`);
  }

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

  // Privacidad de la asistencia (D82): ningún JSON público puede llevar motivos de ausencia.
  const { comprobarPublicos } = require('./asistencia_privacidad');
  const conMotivos = comprobarPublicos();
  if (conMotivos.length) {
    console.log('\nERROR: motivos de ausencia en ficheros públicos (D82):');
    conMotivos.forEach(m => console.log(`  X ${m.fichero}: ${m.rutas.slice(0, 3).join(', ')}`));
    process.exit(1);
  }
  if (r.ficheroAsistencia) console.log(`Asistencia con motivos (solo gestores): ${path.relative(ROOT, r.ficheroAsistencia)} -> Supabase con "npm run db:asistencia" en plataforma/.`);

  // Portada de la web (D84): copias de data/ en plataforma/src/data/. Solo se llega aquí si la jornada cuadra.
  try {
    const salida = execFileSync(process.execPath, [path.join(ROOT, 'plataforma', 'scripts', 'sincronizar_equipacion.mjs')], { stdio: 'pipe' }).toString().trim();
    console.log(`Plataforma: ${salida} (npm run datos:sync)`);
  } catch (e) { console.log('Plataforma: NO se han podido sincronizar las copias de plataforma/src/data/:\n' + (e.stderr || e.message)); process.exit(1); }

  console.log('\nListo para revisar. Publicar = commit y push de data/season_' + TEMPORADA + '.json, data/liga_' + TEMPORADA + '.json, data/index.json y plataforma/src/data/.');
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
