/**
 * asistencia_privacidad.js — separación de la asistencia (D82).
 *
 * Los motivos de ausencia (con excusa, sin excusa, no convocado, lesión, y los porcentajes que salen de ellos) los
 * necesitan los gestores, pero NUNCA van a un fichero público del repositorio (D46): el repositorio y GitHub Pages
 * son públicos.
 *   - Público (data/season_*.json): por jugador solo { fueron, total, pct } de partidos y de entrenos.
 *     pct = fueron / total: el porcentaje no permite deducir ningún motivo.
 *   - Privado (privado/asistencia/asistencia_<temporada>.json, fuera de git): el detalle completo, que se carga
 *     en Supabase (tabla asistencia_motivos, solo gestores) con `npm run db:asistencia` en plataforma/.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DIR_PRIVADO = path.join(ROOT, 'privado', 'asistencia');

/** Claves que delatan un motivo de ausencia. Si aparecen en un JSON público, la prueba falla. */
const CLAVES_PRIVADAS = ['excusa', 'sin_excusa', 'no_conv', 'lesion', 'pct_disp', 'pct_nosel', 'pct_jug'];

const n = v => (Number.isFinite(v) ? v : 0);
const totalDe = o => (Number.isFinite(o.total) ? o.total : n(o.fueron) + n(o.excusa) + n(o.sin_excusa) + n(o.no_conv) + n(o.lesion));

/** Lo único que se publica de un registro de asistencia (partidos o entrenos). */
function publica(o) {
  if (!o) return null;
  const total = totalDe(o);
  return { fueron: n(o.fueron), total, pct: total ? n(o.fueron) / total : null };
}

/** El detalle completo (para privado/ y Supabase), con el total explícito. */
function detalle(o) {
  if (!o) return null;
  return { fueron: n(o.fueron), excusa: n(o.excusa), sin_excusa: n(o.sin_excusa), no_conv: n(o.no_conv), lesion: n(o.lesion), total: totalDe(o) };
}

/** Rutas (a.b[3].c) de las claves privadas que haya en un objeto. Vacío = limpio. */
function buscarMotivos(obj, ruta = '') {
  const fuera = [];
  if (Array.isArray(obj)) obj.forEach((x, i) => fuera.push(...buscarMotivos(x, `${ruta}[${i}]`)));
  else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (CLAVES_PRIVADAS.includes(k)) fuera.push(`${ruta}.${k}`);
      fuera.push(...buscarMotivos(v, `${ruta}.${k}`));
    }
  }
  return fuera;
}

/** Ficheros JSON públicos que se revisan: data/*.json y las copias de la plataforma (plataforma/src/data/*.json). */
function ficherosPublicos() {
  const dirs = [path.join(ROOT, 'data'), path.join(ROOT, 'plataforma', 'src', 'data')];
  return dirs.filter(fs.existsSync).flatMap(d => fs.readdirSync(d).filter(f => f.endsWith('.json')).map(f => path.join(d, f)));
}

/** [{ fichero, rutas }] de los ficheros públicos que llevan motivos. Vacío = todo limpio. */
function comprobarPublicos() {
  return ficherosPublicos()
    .map(f => ({ fichero: path.relative(ROOT, f), rutas: buscarMotivos(JSON.parse(fs.readFileSync(f, 'utf8'))) }))
    .filter(x => x.rutas.length);
}

/** Escribe el detalle privado de una temporada: { temporada, generado, jugadores: [{ person_id, display, partidos, entrenos }] }. */
function escribirPrivado(temporada, jugadores) {
  fs.mkdirSync(DIR_PRIVADO, { recursive: true });
  const f = path.join(DIR_PRIVADO, `asistencia_${temporada}.json`);
  const cuerpo = { temporada, generado: new Date().toISOString().slice(0, 10), fuente: 'SportEasy (asistencia), separada de los JSON públicos (D82)', jugadores };
  fs.writeFileSync(f, JSON.stringify(cuerpo, null, 1) + '\n', 'utf8');
  return f;
}

module.exports = { CLAVES_PRIVADAS, DIR_PRIVADO, publica, detalle, buscarMotivos, comprobarPublicos, escribirPrivado };

if (require.main === module) {
  // node scripts/estadisticas/asistencia_privacidad.js --check : falla si un JSON público lleva motivos.
  const malos = comprobarPublicos();
  if (malos.length) {
    console.error('Motivos de ausencia en ficheros PÚBLICOS (D82):');
    malos.forEach(m => console.error(`  X ${m.fichero}: ${m.rutas.slice(0, 5).join(', ')}${m.rutas.length > 5 ? ` (+${m.rutas.length - 5})` : ''}`));
    process.exit(1);
  }
  console.log('Ningún JSON público lleva motivos de ausencia.');
}
