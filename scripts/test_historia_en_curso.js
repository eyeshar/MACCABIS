/**
 * test_historia_en_curso.js — cuadre de la Historia con la temporada en curso (D137).
 *
 *   - En 2026 están exactamente la plantilla con ficha de data/season_2026-27.json y el cuerpo técnico.
 *   - Naranja (personas.json con 2026-27) = quien tiene algún partido en season_2026-27.json; amarillo, el resto.
 *   - La rejilla de /historia (las funciones puras de plataforma/src/lib/estadisticas/historia.ts): columna 26/27 sin
 *     «prevista», sin el tramo «Llegan en 26/27», sin quien no tiene ninguna temporada, y las cifras de cabecera.
 *
 * USO:  node scripts/test_historia_en_curso.js     (dentro de npm run check:historia)
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { TEMPORADA, ANIO, CUERPO_TECNICO } = require('./historia_en_curso.js');

const ROOT = path.resolve(__dirname, '..');
const leer = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'));
let fallos = 0;
const ok = (c, txt, det) => { console.log(`${c ? '  ok ' : '  X  '} ${txt}${!c && det ? ` — ${det}` : ''}`); if (!c) fallos++; };
const igualConj = (a, b) => a.size === b.size && [...a].every(x => b.has(x));

(async () => {
  const hist = leer('historia_club.json'), reg = leer('personas.json'), temp = leer(`season_${TEMPORADA}.json`);
  const nombre = id => (reg.personas.find(p => p.person_id === id) || {}).display || id;

  console.log(`== Temporada en curso ${TEMPORADA} en historia_club.json`);
  const conFicha = new Set((temp.plantilla || []).filter(o => (o.fichas || []).length).map(o => o.person_id));
  const en = new Set(hist.personas.filter(p => p.temporadas_jugadas.includes(ANIO)).map(p => p.person_id));
  ok(conFicha.size >= 20, `plantilla con ficha en season_${TEMPORADA}.json: ${conFicha.size}`);
  ok(igualConj(en, new Set([...conFicha, ...CUERPO_TECNICO])), `en ${ANIO} = plantilla con ficha + cuerpo técnico (${en.size})`,
    `sobran: ${[...en].filter(x => !conFicha.has(x) && !CUERPO_TECNICO.includes(x)).join(', ')}; faltan: ${[...conFicha].filter(x => !en.has(x)).join(', ')}`);
  ok(hist.personas.every(p => !('previsto_2627' in p)), 'nadie conserva previsto_2627');
  ok(hist.personas.every(p => p.n_temporadas === p.temporadas_jugadas.filter(y => +y >= 2013 && +y <= +ANIO).length), `n_temporadas cuenta de 2013 a ${ANIO}`);
  ok([...en].every(id => reg.personas.some(p => p.person_id === id)), 'todos están en personas.json');

  console.log(`\n== Naranja / amarillo en ${TEMPORADA}`);
  const conPartido = new Set(temp.players.filter(p => p.pj > 0 || p.conv > 0).map(p => p.person_id));
  const naranja = new Set(Object.entries(reg.indice_stats).filter(([, v]) => v.includes(TEMPORADA)).map(([k]) => k));
  ok(igualConj(naranja, conPartido), `naranja = quien tiene algún partido en season_${TEMPORADA}.json (${naranja.size})`);
  ok([...naranja].every(id => en.has(id)), `todo naranja está en la plantilla de ${TEMPORADA}`);
  const amarillo = [...en].filter(id => !naranja.has(id));

  console.log('\n== Rejilla de /historia (funciones de la web)');
  const H = await import(pathToFileURL(path.join(ROOT, 'plataforma', 'src', 'lib', 'estadisticas', 'historia.ts')).href);
  const fichas = new Map(), regPorId = new Map(reg.personas.map(p => [p.person_id, p]));
  for (const s of leer('index.json').seasons) fichas.set(s.id, new Set(leer(`season_${s.id}.json`).players.map(p => p.person_id)));
  // Lo mismo que plataforma/src/lib/estadisticas/historiaDatos.ts (que es server-only y no se puede importar aquí).
  const P = hist.personas.filter(p => p.temporadas_jugadas.length).map(p => {
    const r = regPorId.get(p.person_id) || {}, stats = reg.indice_stats[p.person_id] || [];
    return { ...p, display: r.display || p.display, formal: r.formal || p.formal, es_entrenador: !!p.es_entrenador, solo_mote: !!p.solo_mote, stats,
      destinos: Object.fromEntries(stats.map(s => [s, fichas.get(s) && fichas.get(s).has(p.person_id) ? 'ficha' : null])) };
  }).sort(H.ordenBase);
  ok(H.ANIOS.length === 14 && H.ANIOS[13] === ANIO && H.EN_CURSO === ANIO, `14 temporadas, 2013/14 → ${H.etiquetaAnio(ANIO)}, la última en curso`);
  const filas = H.filasRejilla(P, { buscar: '', quien: 'ALL', orden: 'veterania' });
  ok(filas.tramos.every(t => !/Llegan/.test(t.tit || '')), 'sin el tramo «Llegan en 26/27»');
  const visibles = new Set([...filas.tramos.flatMap(t => t.personas), ...filas.tecnico].map(p => p.person_id));
  ok(hist.personas.filter(p => !p.temporadas_jugadas.length).every(p => !visibles.has(p.person_id)), 'quien no tiene ninguna temporada no sale',
    hist.personas.filter(p => !p.temporadas_jugadas.length && visibles.has(p.person_id)).map(p => p.person_id).join(', '));
  ok([...en].every(id => visibles.has(id)), `toda la plantilla de ${TEMPORADA} sale en la rejilla`);
  const celda = id => { const p = P.find(x => x.person_id === id); return !p || !p.temporadas_jugadas.includes(ANIO) ? 'vacía' : p.stats.includes(TEMPORADA) ? 'naranja' : 'amarillo'; };
  ok([...naranja].every(id => celda(id) === 'naranja') && amarillo.every(id => celda(id) === 'amarillo'), 'celda 26/27: naranja quien ha jugado, amarillo el resto');
  ok([...naranja].every(id => P.find(x => x.person_id === id).destinos[TEMPORADA] === 'ficha'), 'la ficha de persona enlaza a /jugador?t=2026-27 de todo naranja');

  const k = H.kpisHistoria(P);
  const jug = P.filter(p => !p.es_entrenador && p.n_temporadas > 0);
  const media = Math.round(H.ANIOS_TERMINADOS.reduce((a, y) => a + jug.filter(p => p.temporadas_jugadas.includes(y)).length, 0) / 13);
  ok(k.personas === jug.length && k.media === media && H.ANIOS_TERMINADOS.length === 13, `cifras: ${k.personas} han vestido la camiseta · media ${k.media} por temporada (13 terminadas) · ${k.fugaces} de paso · ${k.conStats} tienen ficha`);
  ok(k.fugaces === jug.filter(p => p.n_temporadas === 1 && !p.temporadas_jugadas.includes(ANIO)).length, '«De paso» no cuenta a quien solo lleva la en curso');
  const tira = H.tiraTemporal(P);
  ok(tira.length === 14 && tira[13].jugadores === en.size - CUERPO_TECNICO.length, `tira: 26/27 con ${tira[13].jugadores} jugadores`);

  console.log(`\nNaranja (${naranja.size}): ${[...naranja].map(nombre).sort().join(', ')}`);
  console.log(`Amarillo (${amarillo.length}): ${amarillo.map(nombre).sort().join(', ')}`);
  console.log(fallos ? `\n${fallos} fallo(s).` : '\nHistoria en curso: todo cuadra.');
  process.exitCode = fallos ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });
