/**
 * parse_diccionario.js
 *
 * Convierte docs/DICCIONARIO_NOMBRES_maccabis.md (fuente de verdad, cerrada por Iván)
 * en data/diccionario_nombres.json, con la forma:
 *
 *   {
 *     personas: [ { person_id, nombre, display } ],
 *     resolucion_por_temporada: { "2013-14": { "<mote>": { tipo, person_id? } } }
 *   }
 *
 * Claves de temporada:
 *   "2023-24"      -> sección "### 2023/24"        (estadísticas MdL)
 *   "2023-24-MdA"  -> sección "### 2023/24 (MdA)"  (estadísticas MdA)
 * Un mismo mote puede ser dos personas distintas según la ficha (p.ej. en 23/24
 * "Iván" es Villaescusa en ambas, pero "Santi" o "Jorge" sólo existen en el MdA),
 * por eso cada ficha tiene su propia tabla y NUNCA se usa una como respaldo de la otra.
 *
 * tipo:
 *   - "jugador"        -> tiene ficha individual y entra en rankings
 *   - "ruido"          -> NS / "No sabemos" / "(coach)". Sus puntos cuentan en el
 *                         total de equipo, pero NO genera ficha ni entra en rankings.
 *   - "sin_catalogar"  -> persona real de paso sin apellido/ficha (Eric, Lonchas).
 *                         Sus puntos cuentan en el total de equipo; sin ficha individual.
 *
 * El tipo se deriva EXCLUSIVAMENTE del texto del .md:
 *   "[NO IDENTIFICADO]"        -> ruido
 *   "[NO IDENTIFICADO — ...]"  -> sin_catalogar
 * No se deduce ninguna correspondencia de nombres fuera de ese archivo.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MD = path.join(ROOT, 'docs', 'DICCIONARIO_NOMBRES_maccabis.md');
const OUT = path.join(ROOT, 'data', 'diccionario_nombres.json');

function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// "Suárez Cobos, Alejandro" -> "Alejandro Suárez Cobos"
function toDisplay(formal) {
  const i = formal.indexOf(',');
  if (i < 0) return formal;
  const apellidos = formal.slice(0, i).trim();
  const nombre = formal.slice(i + 1).trim();
  return `${nombre} ${apellidos}`.replace(/\s+/g, ' ').trim();
}

function parse() {
  const lines = fs.readFileSync(MD, 'utf8').split(/\r?\n/);
  const personas = new Map();          // person_id -> {person_id, nombre, display}
  const resolucion = {};               // "2013-14" -> { mote: {...} }
  let temporada = null;

  for (const line of lines) {
    // "### 2023/24" o "### 2023/24 (MdA)"
    const h = line.match(/^###\s+(\d{4})\/(\d{2})(?:\s*\(\s*(MdA|MdL)\s*\))?\s*$/i);
    if (h) {
      const ficha = h[3] ? h[3].toUpperCase() : null;
      temporada = `${h[1]}-${h[2]}` + (ficha === 'MDA' ? '-MdA' : '');
      resolucion[temporada] = resolucion[temporada] || {};
      continue;
    }
    if (!temporada) continue;
    if (!line.trim().startsWith('|')) continue;

    // | `Mote` | Nombre formal |
    const m = line.match(/^\|\s*`([^`]+)`\s*\|\s*(.+?)\s*\|\s*$/);
    if (!m) continue;
    const mote = m[1].trim();
    const formal = m[2].trim();

    if (/^\[NO IDENTIFICADO\]$/.test(formal)) {
      resolucion[temporada][mote] = { tipo: 'ruido', nota: formal };
      continue;
    }
    if (/^\[NO IDENTIFICADO/.test(formal)) {
      resolucion[temporada][mote] = { tipo: 'sin_catalogar', nota: formal };
      continue;
    }
    const person_id = slug(formal);
    if (!personas.has(person_id)) {
      personas.set(person_id, {
        person_id,
        nombre: formal.toUpperCase(),
        display: toDisplay(formal),
        formal,
      });
    }
    resolucion[temporada][mote] = { tipo: 'jugador', person_id };
  }

  return {
    _fuente: 'docs/DICCIONARIO_NOMBRES_maccabis.md (cerrado por Iván, 03/08/2026)',
    _generado_por: 'scripts/parse_diccionario.js',
    _nota_mda: 'El diccionario cubre las estadísticas MdL 2013–2025. Los motes de las hojas MdA (23/24 y 24/25) que no aparezcan en la temporada correspondiente quedan SIN CATALOGAR: no se les asigna nombre.',
    personas: [...personas.values()].sort((a, b) => a.person_id.localeCompare(b.person_id)),
    resolucion_por_temporada: resolucion,
  };
}

if (require.main === module) {
  const d = parse();
  fs.writeFileSync(OUT, JSON.stringify(d, null, 2) + '\n', 'utf8');
  const temps = Object.keys(d.resolucion_por_temporada);
  console.log(`diccionario_nombres.json: ${d.personas.length} personas, ${temps.length} temporadas (${temps.join(', ')})`);
  for (const t of temps) {
    const e = Object.values(d.resolucion_por_temporada[t]);
    const c = { jugador: 0, ruido: 0, sin_catalogar: 0 };
    e.forEach(x => c[x.tipo]++);
    console.log(`  ${t}: ${e.length} motes -> ${c.jugador} jugador, ${c.ruido} ruido, ${c.sin_catalogar} sin_catalogar`);
  }
}

module.exports = { parse, slug, toDisplay };
