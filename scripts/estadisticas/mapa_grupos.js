/**
 * mapa_grupos.js — rellena scripts/estadisticas/grupos_fase.json (equipo -> grupo) a partir de los Excel de CLASIFICACIÓN de
 * cada grupo (Afición FBM, D183). Solo nombres de equipo y grupo; nada de personas.
 *
 *   node scripts/estadisticas/mapa_grupos.js [--desde <carpeta>] [--ancla G3=<equipo>] [--escribir]
 *
 * La cabecera de la clasificación NO dice el grupo («Clasificación - Competiciones JDM - JDM Madrid - 26/27»): el grupo sale
 * de los equipos. G1 y G2 son los que traen a MDA y a MDL (se contrastan con el calendario). Los otros se reconocen por un
 * equipo ancla (ANCLAS, o --ancla G<n>=<equipo>); un grupo sin ancla se asigna al siguiente G<n> libre y se avisa.
 * Mira también las subcarpetas (respaldo_…). Varias copias de la misma clasificación cuentan una vez.
 * Avisa (y con --escribir NO escribe) si un equipo sale en dos grupos o si una clasificación no es de 26/27.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const X = require('xlsx');
const { normEquipo } = require('./util');

const ROOT = path.resolve(__dirname, '..', '..');
const TEMPORADA = '2026-27', ETIQUETA = '26/27';
const FICHERO = path.join(__dirname, 'grupos_fase.json');
/** Grupos ajenos con nombre conocido: clave, nombre y un equipo que solo está en él. */
const ANCLAS = {
  G5: { nombre: 'SAB TAR G1', equipo: 'ACCIÓN MUTANTE' },
  G6: { nombre: 'SAB TAR G2 (PRIMERA FASE)', equipo: 'ROMA BASKET' },
};
/** Nombres de los que aún no se saben distinguir entre sí (DOM MAÑ G3 y DOM TAR). */
const SIN_ASIGNAR = ['G3', 'G4'];

function leerClasificacion(f) {
  const wb = X.readFile(f);
  const filas = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
  const titulo = filas.slice(0, 8).flat().map(c => String(c).trim()).find(c => /^Clasificaci/i.test(c)) || '';
  const equipos = filas.filter(r => /^\d+$/.test(String(r[0]).trim()) && String(r[1]).trim()).map(r => String(r[1]).trim());
  return { titulo, equipos };
}

function buscar(dir, res = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!e.name.startsWith('.')) buscar(p, res); }
    else if (/^clasificacion.*\.xlsx$/i.test(e.name) && !e.name.startsWith('~$')) res.push(p);
  }
  return res;
}

function construir(carpeta, anclasExtra = {}) {
  const avisos = [], errores = [];
  const grupos = new Map();                                 // huella de equipos -> { equipos, ficheros }
  for (const f of buscar(carpeta)) {
    let c;
    try { c = leerClasificacion(f); } catch (e) { errores.push(`${path.relative(carpeta, f)}: no se puede leer (${e.message}).`); continue; }
    if (!c.titulo.includes(ETIQUETA)) { avisos.push(`${path.relative(carpeta, f)}: «${c.titulo}» no es de ${ETIQUETA}; se aparta.`); continue; }
    if (!c.equipos.length) { errores.push(`${path.relative(carpeta, f)}: sin equipos.`); continue; }
    const k = c.equipos.map(normEquipo).sort().join('|');
    const g = grupos.get(k) || grupos.set(k, { equipos: c.equipos, ficheros: [] }).get(k);
    g.ficheros.push(path.relative(carpeta, f));
  }
  const cal = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', `calendario_${TEMPORADA}.json`), 'utf8'));
  const delCalendario = codigo => new Set([codigo, ...cal.partidos.filter(p => p.equipo === codigo && p.fase === 'liga' && p.rival).map(p => normEquipo(p.rival))].map(normEquipo));
  const salida = {}, usadas = new Set(), tiene = (g, n) => g.equipos.some(e => normEquipo(e) === normEquipo(n));
  const resto = [];
  for (const g of grupos.values()) {
    const propio = ['MDA', 'MDL'].find(c => tiene(g, c));
    if (propio) {                                           // G1 / G2: se contrastan con el calendario
      const esperado = delCalendario(propio), hay = new Set(g.equipos.map(normEquipo));
      const dif = [...esperado].filter(x => !hay.has(x)).concat([...hay].filter(x => !esperado.has(x)));
      if (dif.length) errores.push(`La clasificación de ${propio} no coincide con el calendario (${dif.join(', ')}).`);
      continue;
    }
    resto.push(g);
  }
  const anclas = { ...ANCLAS };
  for (const [k, e] of Object.entries(anclasExtra)) anclas[k] = { nombre: (anclas[k] || {}).nombre || k, equipo: e };
  for (const [clave, a] of Object.entries(anclas)) {
    const g = resto.find(x => tiene(x, a.equipo));
    if (!g) { errores.push(`${clave} (${a.nombre}): ninguna clasificación trae a ${a.equipo}.`); continue; }
    salida[clave] = { nombre: a.nombre, equipos: g.equipos }; usadas.add(g);
  }
  const libres = resto.filter(g => !usadas.has(g)), claves = SIN_ASIGNAR.filter(c => !salida[c]);
  libres.forEach((g, i) => {
    const clave = claves[i];
    if (!clave) { errores.push(`Sobra una clasificación sin grupo al que asignarla: ${g.ficheros[0]}.`); return; }
    salida[clave] = { nombre: 'DOM MAÑ G3 o DOM TAR (sin asignar cuál es cuál)', sin_asignar: true, equipos: g.equipos };
    avisos.push(`${clave}: no sé si es DOM MAÑ G3 o DOM TAR (${g.ficheros[0]}); asignada provisionalmente. Usa --ancla ${clave}=<un equipo suyo> cuando se sepa.`);
  });
  // Un equipo en dos grupos (incluidos G1 y G2 del calendario)
  const visto = new Map();
  for (const [clave, g] of Object.entries({ G1: { equipos: [...delCalendario('MDA')] }, G2: { equipos: [...delCalendario('MDL')] }, ...salida }))
    for (const e of g.equipos) {
      const n = normEquipo(e);
      if (visto.has(n) && visto.get(n) !== clave) errores.push(`«${e}» sale en dos grupos: ${visto.get(n)} y ${clave}.`);
      visto.set(n, clave);
    }
  return { salida, avisos, errores, clasificaciones: grupos.size };
}

module.exports = { construir };

if (require.main === module) {
  const args = process.argv.slice(2);
  const val = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const carpeta = val('--desde') || process.env.MACCABIS_HOJAS_DRIVE || 'I:\\Mi unidad\\Descargas aficion fbm';
  const anclasExtra = {};
  args.forEach((a, i) => { if (a === '--ancla') { const [k, ...e] = args[i + 1].split('='); anclasExtra[k] = e.join('='); } });
  const r = construir(carpeta, anclasExtra);
  console.log(`${r.clasificaciones} clasificaciones distintas en ${carpeta} (más G1 y G2, que traen a MDA y MDL).`);
  for (const [k, g] of Object.entries(r.salida)) console.log(`  ${k} ${g.nombre}: ${g.equipos.length} equipos`);
  r.avisos.forEach(a => console.log('  ! ' + a));
  r.errores.forEach(e => console.log('  X ' + e));
  if (!args.includes('--escribir')) process.exit(r.errores.length ? 1 : 0);
  if (r.errores.length) { console.log('\nNo se escribe nada.'); process.exit(1); }
  const actual = JSON.parse(fs.readFileSync(FICHERO, 'utf8'));
  actual[TEMPORADA] = r.salida;
  fs.writeFileSync(FICHERO, JSON.stringify(actual, null, 1) + '\n', 'utf8');
  console.log(`\nEscrito ${path.relative(ROOT, FICHERO)}.`);
}
