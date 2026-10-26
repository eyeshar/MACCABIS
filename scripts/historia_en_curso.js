/**
 * historia_en_curso.js
 *
 * La temporada en curso (2026/27) en data/historia_club.json (D137). Quién está en el club esta temporada no se
 * apunta a mano: es exactamente
 *
 *   - la plantilla con ficha MdA y/o MdL de data/season_<temporada>.json (`plantilla`, que sale de las hojas de
 *     inscripción y se regenera en cada npm run jornada; altas y bajas de ficha llegan así en la siguiente jornada),
 *   - más el cuerpo técnico de CUERPO_TECNICO.
 *
 * Los «solo entreno» sin ficha (Edimil, Nicolás Yamín, Ignacio Mateos…) no están en las hojas: no cuentan. Si
 * alguien de la plantilla no está en data/personas.json, PARA y lo lista: nadie se inventa.
 *
 * A cada persona de la matriz le pone o le quita el año en curso en temporadas_jugadas y recalcula n_temporadas
 * (años 2013 → en curso). Quién lleva el naranja (temporada con estadísticas) no se decide aquí: es el índice de
 * personas.json (build_personas.js), que solo cuenta a quien ya tiene algún partido.
 *
 * USO:  node scripts/historia_en_curso.js [--check]
 *   --check  no escribe nada; código 1 si historia_club.json no coincide con lo que saldría.
 * Lo llama npm run jornada (y con ella la rutina A) antes de build_personas.js y de datos:sync.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const TEMPORADA = '2026-27';
const ANIO = TEMPORADA.slice(0, 4);
/** Cuerpo técnico de la temporada en curso (no figura en las hojas como deportista). Iván, 26/10/2026. */
const CUERPO_TECNICO = ['barreiro-carballal-carlos-jose'];

/** Años que cuentan en n_temporadas: de 2013 a la temporada en curso, incluida. */
const nTemporadas = anios => anios.filter(y => +y >= 2013 && +y <= +ANIO).length;

/** Calcula la historia con la temporada en curso. No escribe nada. */
function calcular() {
  const hist = JSON.parse(fs.readFileSync(path.join(DATA, 'historia_club.json'), 'utf8'));
  const reg = JSON.parse(fs.readFileSync(path.join(DATA, 'personas.json'), 'utf8'));
  const temp = JSON.parse(fs.readFileSync(path.join(DATA, `season_${TEMPORADA}.json`), 'utf8'));
  const alias = new Map(reg.personas.flatMap(p => (p.alias_ids || []).map(a => [a, p.person_id])));
  const canon = id => alias.get(id) || id;
  const regPorId = new Map(reg.personas.map(p => [p.person_id, p]));

  const conFicha = (temp.plantilla || []).filter(o => (o.fichas || []).length).map(o => canon(o.person_id));
  const errores = [];
  if (!conFicha.length) errores.push(`season_${TEMPORADA}.json no trae plantilla con ficha: no se toca la historia.`);
  const faltan = [...conFicha, ...CUERPO_TECNICO].filter(id => !regPorId.has(id));
  if (faltan.length) errores.push(`No están en data/personas.json (no se inventa a nadie): ${faltan.join(', ')}.`);
  if (errores.length) return { errores };

  const miembros = new Set([...conFicha, ...CUERPO_TECNICO]);
  const porId = new Map(hist.personas.map(p => [p.person_id, p]));
  const nuevas = [];
  for (const id of miembros) {
    if (porId.has(id)) continue;
    const r = regPorId.get(id);
    const p = { person_id: id, formal: r.formal, display: r.display, temporadas_jugadas: [], n_temporadas: 0,
      solo_mote: !!r.solo_mote, es_entrenador: !!r.es_entrenador, nota: `Añadida a la matriz al entrar en la plantilla con ficha de ${TEMPORADA}.` };
    hist.personas.push(p); porId.set(id, p); nuevas.push(id);
  }
  for (const p of hist.personas) {
    const anios = p.temporadas_jugadas.filter(y => y !== ANIO);
    if (miembros.has(p.person_id)) anios.push(ANIO);
    p.temporadas_jugadas = [...new Set(anios)].sort();
    p.n_temporadas = nTemporadas(p.temporadas_jugadas);
    delete p.previsto_2627;          // 26/27 ya no es «prevista» (D137): la pertenencia va en temporadas_jugadas
  }
  hist.personas.sort((a, b) => b.n_temporadas - a.n_temporadas || a.display.localeCompare(b.display));
  hist._meta.en_curso = {
    temporada: TEMPORADA, anio: ANIO, script: 'scripts/historia_en_curso.js',
    regla: `En ${TEMPORADA} (en curso) cuentan la plantilla con ficha MdA y/o MdL de data/season_${TEMPORADA}.json y el cuerpo técnico; ` +
      'los «solo entreno» sin ficha no. Se recalcula en cada npm run jornada (D137).',
    jugadores_con_ficha: conFicha.length, cuerpo_tecnico: CUERPO_TECNICO.length,
  };
  hist._meta.reglas = (hist._meta.reglas || []).map(r =>
    /^n_temporadas=/.test(r) ? `n_temporadas=años en el club de 2013 a la temporada en curso (${TEMPORADA}), incluida.`
      : /^2026=/.test(r) ? `${ANIO}=temporada EN CURSO ${TEMPORADA}: la plantilla con ficha y el cuerpo técnico (scripts/historia_en_curso.js, D137).` : r);
  return { errores: [], hist, miembros, nuevas };
}

if (require.main === module) {
  const r = calcular();
  if (r.errores.length) { r.errores.forEach(e => console.error('X ' + e)); process.exit(1); }
  const fichero = path.join(DATA, 'historia_club.json');
  const texto = JSON.stringify(r.hist, null, 1) + '\n';
  const igual = fs.readFileSync(fichero, 'utf8').replace(/\r\n/g, '\n') === texto;
  if (process.argv.includes('--check')) {
    if (!igual) { console.error(`historia_club.json no está al día con la plantilla de ${TEMPORADA} (node scripts/historia_en_curso.js).`); process.exit(1); }
    console.log(`Historia ${TEMPORADA} al día: ${r.miembros.size} personas en la temporada en curso.`);
  } else {
    if (!igual) fs.writeFileSync(fichero, texto, 'utf8');
    console.log(`Historia ${TEMPORADA}: ${r.miembros.size} personas en la temporada en curso${r.nuevas.length ? ` (nuevas en la matriz: ${r.nuevas.join(', ')})` : ''}${igual ? ', sin cambios' : ''}.`);
  }
}
module.exports = { calcular, TEMPORADA, ANIO, CUERPO_TECNICO };
