/**
 * build_personas.js
 *
 * Genera data/personas.json: el REGISTRO ÚNICO DE IDENTIDADES del club, fuente de
 * verdad de los person_id. Lo referencian los dos lados del proyecto:
 *
 *   - data/historia_club.json   -> pertenencia al club por temporada (quién estuvo cada año)
 *   - data/season_*.json        -> rendimiento deportivo (qué hizo en la cancha)
 *
 * El registro NO guarda ni temporadas ni estadísticas: sólo identidad (person_id
 * canónico, nombre formal, display) y las dos banderas de negocio (es_entrenador,
 * solo_mote). La pertenencia vive en la Historia y el rendimiento en las stats;
 * ambos apuntan al mismo person_id.
 *
 * Además estampa el person_id canónico en data/season_2025-26.json, que venía del
 * pipeline antiguo y era la única temporada sin él. Es idempotente y aditivo: no
 * modifica ningún dato deportivo, sólo añade el campo de identidad.
 *
 * USO:  node scripts/build_personas.js [--check]
 *   --check  no escribe nada; sólo valida y devuelve código 1 si hay incoherencias.
 */
const fs = require('fs');
const path = require('path');
const { slug } = require('./parse_diccionario.js');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const CHECK = process.argv.includes('--check');

/**
 * Identidades reconciliadas a mano el 04/08/2026: la misma persona escrita de dos
 * formas distintas según la fuente. La clave es el id que hay que retirar y el
 * valor el canónico. Cada una está justificada por coincidencia de apellidos Y de
 * temporadas; ninguna se ha deducido por parecido de nombre.
 */
const ALIAS = {
  // La matriz escribía "Robert"; el diccionario de nombres (fichas FBM/JDM) dice
  // "Roberto". Sus 3 temporadas (2018-2020) coinciden con sus 3 fichas de stats.
  'ballesteros-fuentes-robert': 'ballesteros-fuentes-roberto',
  // Cabo suelto del BACKLOG: la tabla de 21/22 lo escribía sin el segundo apellido.
  'martinez-victor': 'martinez-martinez-victor',
  // El acta de 25/26 recoge el nombre legal completo ("Fernando Antonio").
  'mendez-escandon-fernando-antonio': 'mendez-escandon-fernando',
};
const canon = id => ALIAS[id] || id;

const problemas = [];
const avisos = [];

function main() {
  const dicc = JSON.parse(fs.readFileSync(path.join(DATA, 'diccionario_nombres.json'), 'utf8'));
  const hist = JSON.parse(fs.readFileSync(path.join(DATA, 'historia_club.json'), 'utf8'));
  const seasons = JSON.parse(fs.readFileSync(path.join(DATA, 'index.json'), 'utf8')).seasons;

  const reg = new Map();   // person_id canónico -> persona
  const upsert = (id, datos, origen) => {
    id = canon(id);
    const p = reg.get(id) || { person_id: id, formal: null, display: null, es_entrenador: false, solo_mote: false, alias_ids: [], en_historia: false, en_estadisticas: false };
    for (const k of ['formal', 'display']) if (datos[k] && !p[k]) p[k] = datos[k];
    if (datos.es_entrenador) p.es_entrenador = true;
    if (datos.solo_mote) p.solo_mote = true;
    p[origen] = true;
    reg.set(id, p);
    return p;
  };

  // --- identidades con estadísticas (derivadas del diccionario de nombres)
  for (const p of dicc.personas) {
    upsert(p.person_id, { formal: p.formal || p.nombre, display: p.display }, 'en_estadisticas');
  }
  // --- identidades de la matriz de historia
  for (const p of hist.personas) {
    upsert(p.person_id, { formal: p.formal, display: p.display, es_entrenador: p.es_entrenador, solo_mote: p.solo_mote }, 'en_historia');
  }
  // --- alias registrados en la persona canónica
  for (const [viejo, nuevo] of Object.entries(ALIAS)) {
    const p = reg.get(nuevo);
    if (p && !p.alias_ids.includes(viejo)) p.alias_ids.push(viejo);
    if (reg.has(viejo)) problemas.push(`El id retirado "${viejo}" sigue presente como identidad propia.`);
  }

  // --- índice derivado: en qué temporadas tiene ficha de estadísticas cada persona
  const indice = {};
  const stamp25 = [];
  for (const s of seasons) {
    const file = path.join(DATA, `season_${s.id}.json`);
    const d = JSON.parse(fs.readFileSync(file, 'utf8'));
    const anota = id => {
      id = canon(id);
      if (!reg.has(id)) { problemas.push(`${s.id}: person_id "${id}" no está en el registro de personas.`); return; }
      (indice[id] || (indice[id] = [])).push(s.id);
    };
    for (const pl of d.players || []) {
      let id = pl.person_id;
      if (!id) {
        // 25/26 viene del pipeline antiguo y no trae person_id: se deriva del nombre
        // del acta con la misma regla de slug que el resto y se estampa.
        id = canon(slug(pl.nombre));
        if (!reg.has(id)) { problemas.push(`${s.id}: "${pl.nombre}" -> "${id}" no está en el registro; NO se estampa.`); continue; }
        stamp25.push({ file, season: s.id, nombre: pl.nombre, id });
      }
      anota(id);
    }
    // el MdA agregado también identifica personas
    for (const j of (d.mda_resumen ? d.mda_resumen.jugadores : [])) {
      if (!j.person_id) continue;
      const id = canon(j.person_id);
      if (!reg.has(id)) { problemas.push(`${s.id} (MdA): person_id "${id}" no está en el registro.`); continue; }
      if (!(indice[id] || []).includes(s.id)) (indice[id] || (indice[id] = [])).push(s.id);
    }
  }

  // --- validaciones de las reglas de negocio de la Historia (bloque _meta)
  const vistos = new Set();
  for (const p of hist.personas) {
    if (vistos.has(p.person_id)) problemas.push(`Historia: person_id duplicado "${p.person_id}".`);
    vistos.add(p.person_id);
    // n_temporadas = años jugados reales 2013-2025 (la columna del Excel se descartó)
    const reales = p.temporadas_jugadas.filter(y => +y >= 2013 && +y <= 2025).length;
    if (reales !== p.n_temporadas) problemas.push(`Historia: "${p.person_id}" declara n_temporadas=${p.n_temporadas} pero tiene ${reales} años jugados entre 2013 y 2025.`);
    // 2026 es la temporada 26/27 PREVISTA: nunca cuenta como jugada
    if (p.temporadas_jugadas.includes('2026')) problemas.push(`Historia: "${p.person_id}" tiene 2026 en temporadas_jugadas; 26/27 no ha empezado y va en previsto_2627.`);
    if (p.solo_mote && !/^\[SOLO MOTE/.test(p.formal)) avisos.push(`Historia: "${p.person_id}" es solo_mote pero tiene nombre formal "${p.formal}".`);
  }

  // --- validaciones de coherencia
  for (const p of reg.values()) {
    if (!p.formal || !p.display) problemas.push(`"${p.person_id}" sin nombre formal o display.`);
    if (p.es_entrenador && indice[p.person_id]) problemas.push(`"${p.person_id}" está marcado como entrenador pero tiene fichas de estadísticas: ${indice[p.person_id].join(', ')}.`);
    if (p.solo_mote && indice[p.person_id]) problemas.push(`"${p.person_id}" es solo_mote pero tiene fichas de estadísticas: ${indice[p.person_id].join(', ')}.`);
    if (p.en_estadisticas && !p.en_historia) avisos.push(`"${p.person_id}" (${p.display}) tiene estadísticas pero NO aparece en la matriz de historia.`);
  }

  const personas = [...reg.values()].sort((a, b) => a.person_id.localeCompare(b.person_id));
  const salida = {
    _meta: {
      descripcion: 'Registro único de identidades del club. Fuente de verdad de los person_id que comparten la Historia y las estadísticas.',
      generado_por: 'scripts/build_personas.js',
      fuentes: ['data/diccionario_nombres.json', 'data/historia_club.json', 'data/season_*.json'],
      regla_person_id: 'slug del nombre formal: normalización NFD sin diacríticos, minúsculas, todo lo no alfanumérico a "-".',
      contrato: [
        'Este fichero NO guarda temporadas ni estadísticas: sólo identidad y flags.',
        'La pertenencia al club por temporada vive en data/historia_club.json.',
        'El rendimiento deportivo vive en data/season_*.json.',
        'Ambos referencian el person_id de aquí.',
        'alias_ids recoge escrituras antiguas del mismo id, ya retiradas de los datos; sirve para no repetir la reconciliación.',
      ],
      indice_stats: 'Índice DERIVADO (no es fuente): en qué temporadas tiene ficha de estadísticas cada persona.',
    },
    personas,
    indice_stats: indice,
  };

  if (CHECK) {
    console.log(`[check] ${personas.length} identidades, ${problemas.length} problema(s)`);
  } else {
    fs.writeFileSync(path.join(DATA, 'personas.json'), JSON.stringify(salida, null, 1) + '\n', 'utf8');
    // estampar person_id en la 25/26
    if (stamp25.length) {
      const file = stamp25[0].file;
      const d = JSON.parse(fs.readFileSync(file, 'utf8'));
      const porNombre = new Map(stamp25.map(x => [x.nombre, x.id]));
      let nP = 0, nB = 0;
      for (const pl of d.players) if (!pl.person_id && porNombre.has(pl.nombre)) { pl.person_id = porNombre.get(pl.nombre); nP++; }
      for (const k of Object.keys(d.box || {})) for (const f of d.box[k]) {
        if (!f.person_id && !f.no_jugador && porNombre.has(f.nombre)) { f.person_id = porNombre.get(f.nombre); nB++; }
      }
      fs.writeFileSync(file, JSON.stringify(d) + '\n', 'utf8');
      console.log(`season_2025-26.json: person_id estampado en ${nP} jugadores y ${nB} filas de boxscore.`);
    }
    console.log(`data/personas.json: ${personas.length} identidades ` +
      `(${personas.filter(p => p.en_historia && p.en_estadisticas).length} en ambos lados, ` +
      `${personas.filter(p => p.en_historia && !p.en_estadisticas).length} sólo historia, ` +
      `${personas.filter(p => !p.en_historia && p.en_estadisticas).length} sólo estadísticas)`);
  }

  if (avisos.length) { console.log('\nAvisos (no bloquean, requieren mirada humana):'); avisos.forEach(a => console.log('  ! ' + a)); }
  if (problemas.length) { console.log('\nPROBLEMAS:'); problemas.forEach(p => console.log('  X ' + p)); process.exitCode = 1; }
  else console.log('\nCoherencia OK: todos los person_id de la Historia y de las estadísticas existen en el registro.');
}

main();
