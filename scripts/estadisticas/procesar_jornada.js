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
 *   npm run jornada -- --no-interactivo  (para la rutina A automática, D66: ante cualquier duda PARA con código
 *                                        distinto de 0, deshace las copias y no escribe nada; sin ficheros
 *                                        nuevos dice «Nada nuevo» y sale con 0 sin regenerar)
 *   npm run jornada -- --resumen <f.json> (deja el resultado en un JSON: estado, jornada, texto, motivo)
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
 * @param o { temporada, desde, base, jornadaForzada, sinAsistencia, hoy, log, estricto }
 *   estricto: (--no-interactivo) lo que de normal solo se avisa y se deja pasar (un fichero que no se puede
 *   leer, una hoja de liga sin jornada, una hoja nuestra con varios partidos posibles) también lanza un Error.
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
  const duda = msg => { if (o.estricto) throw new Error(msg); log(`  ! ${msg}`); };
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
    try { a = await leerActa(path.join(DESDE, f)); } catch (e) { duda(`${f}: no se puede leer (${e.message})`); continue; }
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
      if (!jor) { duda(`${f}: no sé de qué jornada es (usa --jornada N).`); continue; }
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
    try { h = leerHoja(path.join(DESDE, f)); } catch (e) { duda(`${f}: no se puede leer (${e.message})`); continue; }
    if (!h.titulo.includes(cfg.etiqueta_fbm)) continue;
    const rival = h.esLocal ? h.visitante : h.local;
    const que = `hoja ${h.titulo.replace(/^Estadísticas - /, '').replace(/ - SenMas.*$/, '')}`;
    if (repetido(f, que)) continue;
    const cal = calendario.filter(c => c.equipo === h.equipo && !c.descansa && c.local === h.esLocal && normEquipo(c.rival) === normEquipo(rival));
    if (cal.length !== 1) duda(`${f}: ${h.equipo} ${h.esLocal ? 'en casa' : 'fuera'} contra ${rival}: ${cal.length} partidos posibles en el calendario (se copia igualmente; el pipeline decidirá).`);
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

/**
 * Copia el plan con copia segura. Devuelve cuántos ficheros nuevos ha copiado. Si algo choca, lanza un Error.
 * Si se pasa o.copiados (array), anota ahí la ruta de cada copia nueva (para deshacerlas con --no-interactivo).
 */
function copiar(plan, o) {
  const log = o.log || console.log;
  let nuevos = 0;
  for (const p of plan) {
    if (o.dry) { log(`  [dry] ${p.que}: ${p.origen} -> ${path.basename(o.base)}/${p.destino}/${p.nombre}`); continue; }
    const r = copiaSegura(path.join(o.desde, p.origen), path.join(o.base, p.destino), p.nombre);
    if (r.copiado) { nuevos++; log(`  + ${p.que}  (${p.nombre})`); if (o.copiados) o.copiados.push(r.destino); }
  }
  return nuevos;
}

module.exports = { recoger, copiar, hashesCargados, hojasPorJornada };

if (require.main === module) {
  const args = process.argv.slice(2);
  const argVal = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const TEMPORADA = args.find(a => /^\d{4}-\d{2}$/.test(a)) || '2026-27';
  const DESDE = argVal('--desde', path.join(os.homedir(), 'Downloads'));
  const DRY = args.includes('--dry');
  const NOINT = args.includes('--no-interactivo');          // rutina A automática (D66): ante cualquier duda, para
  const RESUMEN = argVal('--resumen', null);
  const JORNADA_FORZADA = +argVal('--jornada', 0) || null;   // jornada de las hojas de liga donde no jugamos (si no, la última con fecha <= hoy)
  const copiados = [];                                       // copias nuevas de esta ejecución (se deshacen si para)
  // estado: 'nada' (sin ficheros nuevos), 'dry', 'lista' (escrita y lista para publicar) o 'parada' (con motivo).
  const resumen = { temporada: TEMPORADA, dry: DRY, estado: null, nuevos: 0, jornada: null, texto: null, motivo: null, copiados };
  const escribeResumen = () => { if (RESUMEN) fs.writeFileSync(RESUMEN, JSON.stringify(resumen, null, 1) + '\n', 'utf8'); };
  /**
   * Para con código 1. Con --no-interactivo deshace las copias de esta ejecución en fuentes_fbm/, para que la siguiente
   * vuelva a verlas como nuevas. Lo que ya se hubiera escrito en data/ lo limpia quien llama (git, rutina_a_publicar.ps1).
   */
  const para = (motivo, texto = `\nERROR: ${motivo}`) => {
    if (texto) console.error(texto);
    if (NOINT) for (const f of copiados.splice(0)) {
      try { fs.unlinkSync(f); console.error(`  (deshecha la copia ${path.relative(ROOT, f)})`); } catch (e) { console.error(`  NO se ha podido deshacer ${f}: ${e.message}`); }
    }
    Object.assign(resumen, { estado: 'parada', motivo }); escribeResumen();
    process.exit(1);
  };

  (async () => {
    const { generar } = require('./generar_temporada');
    const cfg = CONFIG[TEMPORADA];
    if (!cfg) para(`No hay configuración para ${TEMPORADA}.`);
    const BASE = path.join(ROOT, cfg.carpeta);

    console.log(`Procesar jornada ${TEMPORADA}: buscando ficheros en ${DESDE}${NOINT ? ' (no interactivo)' : ''}`);
    let plan, descartes;
    try {
      ({ plan, descartes } = await recoger({ temporada: TEMPORADA, desde: DESDE, base: BASE, jornadaForzada: JORNADA_FORZADA, sinAsistencia: args.includes('--sin-asistencia'), estricto: NOINT }));
    } catch (e) { para(e.message, `\nERROR: ${e.message}\nNo se ha copiado nada.`); }
    if (descartes.length) console.log(`${descartes.length} fichero(s) descartado(s) por estar ya cargados.`);
    resumen.nuevos = plan.length;
    if (NOINT && !plan.length) {
      console.log('\nNada nuevo: no hay ficheros nuevos de la temporada; no se regenera nada.');
      resumen.estado = 'nada'; escribeResumen(); return;
    }
    let nuevos = 0;
    try { nuevos = copiar(plan, { desde: DESDE, base: BASE, dry: DRY, copiados }); }
    catch (e) { para(e.message, `\nERROR: ${e.message}\nNo se ha tocado nada más.`); }
    if (!DRY) console.log(nuevos ? `${nuevos} fichero(s) nuevo(s) copiados a ${cfg.carpeta}/.` : 'No hay ficheros nuevos (ya estaban todos copiados).');

    const antes = fs.existsSync(path.join(ROOT, 'data', `season_${TEMPORADA}.json`))
      ? JSON.parse(fs.readFileSync(path.join(ROOT, 'data', `season_${TEMPORADA}.json`), 'utf8')) : { partidos: [], box: {} };
    // Con --no-interactivo se genera primero en seco: las dudas se miran antes de escribir nada.
    let r = await generar(TEMPORADA, { dry: DRY || NOINT });
    console.log(`\n${TEMPORADA}: ${r.fuentes.actas} actas y ${r.fuentes.hojas} hojas -> ${r.json.partidos.length} partidos, ${r.json.players.length} jugadores con estadísticas.`);
    r.avisos.forEach(a => console.log('  ! ' + a));
    if (r.errores.length) {
      console.log('\nERRORES — no se ha escrito nada:'); r.errores.forEach(e => console.log('  X ' + e));
      para(r.errores[0] + (r.errores.length > 1 ? ` (y ${r.errores.length - 1} error(es) más)` : ''), '');
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

    // Partidos que cambian con esta ejecución (nuevos, o completados: el acta de un partido provisional, una hoja nueva).
    const clave = p => p.pn + '_' + p.equipo;
    const huella = (p, box) => JSON.stringify(p) + JSON.stringify((box || {})[clave(p)] || []);
    const previo = new Map(antes.partidos.map(p => [clave(p), huella(p, antes.box)]));
    const tocados = r.json.partidos.filter(p => previo.get(clave(p)) !== huella(p, r.json.box));
    if (NOINT) {
      const dudas = r.avisos.filter(a => /jornada desconocida|son nuestros|sin ganador conocido/.test(a));
      for (const p of tocados) if (!p.incomp && !(r.json.box[clave(p)] || []).length)
        dudas.push(`${p.equipo} ${p.fecha} contra ${p.rival}: falta la hoja de estadística (Afición FBM).`);
      // D66 exige el cuadre contra el acta: publicar solo con la hoja (D71) fue una excepción puntual, no automática.
      for (const p of tocados) if (p.pendiente_acta)
        dudas.push(`${p.equipo} contra ${p.rival} (jornada ${p.pn}): falta el acta (gesdeportiva.fbm.es).`);
      if (dudas.length) {
        console.log('\nDUDAS — con --no-interactivo no se publica:'); dudas.forEach(d => console.log('  ? ' + d));
        para(dudas[0] + (dudas.length > 1 ? ` (y ${dudas.length - 1} duda(s) más)` : ''), '');
      }
    }
    // Texto del aviso: «Jornada N publicada: MdA x–y Rival · Rival x–y MdL» (el local primero, según el calendario).
    const calendario = cfg.calendario.filter(c => c.formato === 'json' && fs.existsSync(path.join(ROOT, c.fichero)))
      .flatMap(c => JSON.parse(fs.readFileSync(path.join(ROOT, c.fichero), 'utf8')).partidos);
    const corto = eq => (cfg.nombres_club[eq] || []).find(n => n !== n.toUpperCase()) || eq;
    if (tocados.length) {
      resumen.jornada = Math.max(...tocados.map(p => p.pn));
      const partes = tocados.filter(p => p.pn === resumen.jornada).map(p => {
        const c = calendario.find(c => c.equipo === p.equipo && c.jornada === p.pn && !c.descansa);
        return c && !c.local ? `${p.rival} ${p.pc}–${p.pf} ${corto(p.equipo)}` : `${corto(p.equipo)} ${p.pf}–${p.pc} ${p.rival}`;
      });
      resumen.texto = `Jornada ${resumen.jornada} publicada: ${partes.join(' · ')}`;
    } else resumen.texto = `Liga actualizada (${plan.length} fichero(s) nuevo(s), sin partidos nuestros nuevos)`;

    if (DRY) { console.log('\n[dry] no se ha escrito nada.'); resumen.estado = 'dry'; escribeResumen(); return; }
    if (NOINT) {
      r = await generar(TEMPORADA);
      if (r.errores.length) para(r.errores[0]);
    }

    // Liga completa de los dos grupos: data/liga_<temporada>.json (sólo datos por equipo; el detalle por jugador va a Supabase).
    if (cfg.liga) {
      const l = liga.construir(TEMPORADA);
      l.avisos.forEach(a => console.log('  ! ' + a));
      if (l.errores.length) { console.log(`\nERRORES DE LIGA — no se ha escrito data/liga_${TEMPORADA}.json:`); l.errores.forEach(e => console.log('  X ' + e)); para(`Liga: ${l.errores[0]}`, ''); }
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
    catch (e) { para('identidades: problemas en check:personas.', 'Identidades: PROBLEMAS\n' + e.stdout); }

    // Privacidad de la asistencia (D82): ningún JSON público puede llevar motivos de ausencia.
    const { comprobarPublicos } = require('./asistencia_privacidad');
    const conMotivos = comprobarPublicos();
    if (conMotivos.length) {
      console.log('\nERROR: motivos de ausencia en ficheros públicos (D82):');
      conMotivos.forEach(m => console.log(`  X ${m.fichero}: ${m.rutas.slice(0, 3).join(', ')}`));
      para(`motivos de ausencia en ficheros públicos (${conMotivos[0].fichero}).`, '');
    }
    if (r.ficheroAsistencia) console.log(`Asistencia con motivos (solo gestores): ${path.relative(ROOT, r.ficheroAsistencia)} -> Supabase con "npm run db:asistencia" en plataforma/.`);

    // Portada de la web (D84): copias de data/ en plataforma/src/data/. Solo se llega aquí si la jornada cuadra.
    try {
      const salida = execFileSync(process.execPath, [path.join(ROOT, 'plataforma', 'scripts', 'sincronizar_equipacion.mjs')], { stdio: 'pipe' }).toString().trim();
      console.log(`Plataforma: ${salida} (npm run datos:sync)`);
    } catch (e) { para('no se han podido sincronizar las copias de plataforma/src/data/.', 'Plataforma: NO se han podido sincronizar las copias de plataforma/src/data/:\n' + (e.stderr || e.message)); }

    // Calibración de la proyección de anotación (D124): proyección y resultado de cada partido nuestro, a privado/ (fuera
    // de git). Nunca para la jornada: si falla (sin conexión, sin plataforma), solo se avisa.
    try {
      const salida = execFileSync(process.execPath, [path.join(ROOT, 'plataforma', 'scripts', 'calibrar_proyeccion.mjs')], { stdio: 'pipe', cwd: path.join(ROOT, 'plataforma') }).toString().trim();
      console.log(salida.split('\n')[0]);
    } catch (e) { console.log('Proyección: no se ha podido calibrar (' + String(e.stderr || e.message).split('\n')[0] + '). No afecta a la jornada.'); }

    resumen.estado = 'lista'; escribeResumen();
    console.log('\nListo para revisar. Publicar = commit y push de data/season_' + TEMPORADA + '.json, data/liga_' + TEMPORADA + '.json, data/index.json y plataforma/src/data/.');
  })().catch(e => para(e.message, 'ERROR: ' + e.message));
}
