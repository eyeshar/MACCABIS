/**
 * completar_historia.js
 *
 * Completa data/historia_club.json (registro manual, el que puede tener olvidos) con
 * lo que confirman las dos fuentes más fiables, siguiendo esta jerarquía:
 *
 *   1. ESTADÍSTICAS (data/season_*.json) — vienen de actas oficiales. Si alguien tiene
 *      ficha de estadísticas en una temporada, estuvo en el club esa temporada.
 *   2. FICHAS DE INSCRIPCIÓN (data/fichas_inscripcion.json) — límite inferior fiable.
 *   3. MATRIZ — se completa con 1 y 2, nunca al revés. Nunca se quita a nadie.
 *
 * De las fichas sólo se aplican las de JDM, cuyo año es inequívoco (JDM 34 = 2013/14).
 * Las de "Torneos Municipales" se ignoran: el año del torneo no identifica la temporada
 * sin ambigüedad. Tampoco se aplican los nombres que no casan con una persona conocida.
 *
 * USO:  node scripts/completar_historia.js [--dry]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const DRY = process.argv.includes('--dry');

const hist = JSON.parse(fs.readFileSync(path.join(DATA, 'historia_club.json'), 'utf8'));
const reg = JSON.parse(fs.readFileSync(path.join(DATA, 'personas.json'), 'utf8'));
const fichas = fs.existsSync(path.join(DATA, 'fichas_inscripcion.json'))
  ? JSON.parse(fs.readFileSync(path.join(DATA, 'fichas_inscripcion.json'), 'utf8')) : null;

const porId = new Map(hist.personas.map(p => [p.person_id, p]));
const regById = new Map(reg.personas.map(p => [p.person_id, p]));
const cambios = [];

/** Añade un año a una persona de la matriz; la crea si no existía. */
function confirmar(person_id, anio, fuente) {
  if (+anio >= 2026) return;                       // 26/27 es PREVISTA, nunca jugada
  let p = porId.get(person_id);
  if (!p) {
    const r = regById.get(person_id);
    if (!r) { cambios.push({ tipo: 'ERROR', person_id, anio, fuente, nota: 'no está en el registro de personas' }); return; }
    p = {
      person_id, formal: r.formal, display: r.display,
      temporadas_jugadas: [], n_temporadas: 0,
      previsto_2627: false, solo_mote: !!r.solo_mote, es_entrenador: !!r.es_entrenador,
      nota: 'Añadida a la matriz el 04/08/2026 al cruzarla con ' + fuente + '.',
    };
    hist.personas.push(p); porId.set(person_id, p);
    cambios.push({ tipo: 'PERSONA_NUEVA', person_id, display: p.display, fuente });
  }
  if (p.temporadas_jugadas.includes(anio)) return;
  p.temporadas_jugadas.push(anio);
  p.temporadas_jugadas.sort();
  cambios.push({ tipo: 'AÑO_AÑADIDO', person_id, display: p.display, anio, fuente });
}

// ---------------------------------------------------------------- 1) estadísticas
for (const [id, temporadas] of Object.entries(reg.indice_stats)) {
  for (const a of [...new Set(temporadas.map(t => t.slice(0, 4)))]) confirmar(id, a, 'estadísticas');
}

// ---------------------------------------------------------------- 2) fichas oficiales
if (fichas) {
  for (const f of fichas.fichas) {
    if (!f.aplicable) continue;                    // torneos: año ambiguo
    for (const p of f.personas) {
      if (!p.person_id) continue;                  // nombre sin identificar: no se inventa
      if (p.match === 'dudoso') continue;          // parecido insuficiente: sólo se reporta
      confirmar(p.person_id, f.anio, `ficha ${f.equipo} ${f.anio}`);
    }
  }
}

// ---------------------------------------------------------------- recalcular y guardar
for (const p of hist.personas) {
  p.temporadas_jugadas = [...new Set(p.temporadas_jugadas)].sort();
  p.n_temporadas = p.temporadas_jugadas.filter(y => +y >= 2013 && +y <= 2025).length;
}
hist.personas.sort((a, b) => b.n_temporadas - a.n_temporadas || a.display.localeCompare(b.display));
hist._meta.completado = {
  fecha: '2026-08-04',
  script: 'scripts/completar_historia.js',
  regla: 'La matriz se completa con lo que confirman las estadísticas y las hojas de inscripción; nunca se quita a nadie ni se recorta un año.',
  anios_anadidos: cambios.filter(c => c.tipo === 'AÑO_AÑADIDO').length,
  personas_anadidas: cambios.filter(c => c.tipo === 'PERSONA_NUEVA').length,
};

const porFuente = c => c.fuente.startsWith('ficha') ? 'fichas' : 'estadísticas';
console.log('=== PERSONAS AÑADIDAS A LA MATRIZ ===');
const nuevas = cambios.filter(c => c.tipo === 'PERSONA_NUEVA');
nuevas.forEach(c => console.log('  + ' + c.display + '  (' + c.person_id + ')  desde ' + porFuente(c)));
if (!nuevas.length) console.log('  ninguna');
console.log('\n=== AÑOS AÑADIDOS ===');
const porPersona = new Map();
for (const c of cambios.filter(c => c.tipo === 'AÑO_AÑADIDO')) {
  const k = c.display;
  if (!porPersona.has(k)) porPersona.set(k, { est: [], fic: [] });
  porPersona.get(k)[porFuente(c) === 'fichas' ? 'fic' : 'est'].push(c.anio);
}
[...porPersona.entries()].sort().forEach(([d, v]) => {
  const partes = [];
  if (v.est.length) partes.push('estadísticas: ' + v.est.sort().join(', '));
  if (v.fic.length) partes.push('fichas: ' + v.fic.sort().join(', '));
  console.log('  ' + d.padEnd(34) + ' ' + partes.join('  |  '));
});
console.log('\ntotal: ' + nuevas.length + ' personas nuevas, ' + cambios.filter(c => c.tipo === 'AÑO_AÑADIDO').length + ' pares persona-año');
cambios.filter(c => c.tipo === 'ERROR').forEach(c => console.log('  ERROR: ' + JSON.stringify(c)));

if (DRY) { console.log('\n[dry] no se ha escrito nada'); }
else {
  fs.writeFileSync(path.join(DATA, 'historia_club.json'), JSON.stringify(hist, null, 1) + '\n', 'utf8');
  fs.writeFileSync(path.join(ROOT, 'docs', 'INFORME_COMPLETADO_HISTORIA.json'), JSON.stringify(cambios, null, 1) + '\n', 'utf8');
  console.log('\nhistoria_club.json actualizado (' + hist.personas.length + ' personas)');
}
