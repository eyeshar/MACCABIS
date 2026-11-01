#!/usr/bin/env node
// Asistencia histórica de SportEasy (D166; scripts/estadisticas/asistencia_historica.js y
// scripts/vincular_asistencia_historica.mjs): identidad por id de perfil, casado, propuestas temporada a temporada,
// recuento y vínculos aceptados. Datos sintéticos; sin base de datos ni navegador.
//
//   npm run pruebas:asistencia-historica
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { cambios } from '../scripts/vincular_asistencia_historica.mjs';

const PLAT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const H = createRequire(import.meta.url)(path.join(PLAT, '..', 'scripts', 'estadisticas', 'asistencia_historica.js'));
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };

// ---------------------------------------------------------------- datos sintéticos
const persona = (person_id, formal, anios) => ({ person_id, formal, display: formal.split(', ').reverse().join(' '), temporadas_jugadas: anios });
const historia = [
  persona('sint-uno', 'Zeta Alfa, Ana', ['2018', '2019']),
  persona('sint-dos', 'Beta Gama, Bruno', ['2018', '2019', '2020']),
  persona('sint-tres', 'Delta, Carla', ['2019']),
  persona('sint-cuatro', 'Omega Pi, Dario', ['2020']),
  persona('sint-cinco', 'Omega Ro, Dario', ['2020']),
  persona('sint-seis', 'Épsilon Mu, Elena', ['2018']),
  persona('sint-siete', 'Sigma Tau, Federico', ['2019']),
];
const personas = historia.map(({ temporadas_jugadas, ...p }) => p);
const dicc = {
  personas: [{ person_id: 'sint-seis', display: 'Elena Épsilon Mu' }],
  resolucion_por_temporada: { '2019-20': { Fede: { tipo: 'jugador', person_id: 'sint-siete' } } },
};
const perfil = (id, first_name, last_name) => ({ id, first_name, last_name });
const fila = (p, played, presence = 'on_time') => ({ profile: p, group: { slug_name: played ? 'played' : 'not_played' }, presence: { slug_name: presence } });
const evento = (id, type, filas, extra = {}) => ({ lista: { id, category: { type }, is_cancelled: false, is_past: true, ...extra }, detalle: { attendees: [{ results: filas }] } });

const P = {
  dic: perfil(1, 'Ana', 'Zeta'),             // en el diccionario de SportEasy
  exacto: perfil(2, 'elena', 'Epsilon Mu'),  // nombre completo del histórico, sin tildes ni mayúsculas
  bruno: perfil(3, 'Bruno', 'Beta'),         // nombre + primer apellido, dos temporadas
  carla: perfil(4, 'Carla', 'Delta'),        // nombre + apellido, una temporada
  dario: perfil(5, 'Dario', 'Omega'),        // dos candidatos: no se propone
  fuera: perfil(6, 'Carla', 'Delta'),        // misma persona pero en una temporada en la que no estaba: no se propone
  mote: perfil(7, 'Fede', 'Sigma'),          // mote registrado + primer apellido
  nadie: perfil(8, 'Zacarías', 'Nadie'),
  dic2: perfil(9, 'Ana', 'Zeta'),            // segundo perfil de la misma persona (mismo nombre en el diccionario)
};
const exp = {
  'temporada_2018-2019': { eventos: [
    evento(101, 'training', [fila(P.dic, true), fila(P.exacto, false, 'excused'), fila(P.bruno, false, 'not_excused'), fila(P.dic2, false, 'excused'), fila(P.fuera, true)]),
    evento(102, 'championship_match', [fila(P.dic, false, 'injured'), fila(P.bruno, true), fila(P.nadie, true)]),
    evento(103, 'friendly_match', [fila(P.dic, true)]),
    evento(104, 'training', [fila(P.dic, true)], { is_cancelled: true }),
    evento(105, 'training', [fila(P.dic, true)], { is_past: false }),
  ] },
  'temporada_2019-2020': { eventos: [
    evento(201, 'training', [fila(P.bruno, true), fila(P.carla, true), fila(P.mote, false, 'excused')]),
  ] },
  'temporada_2020-2021': { eventos: [evento(301, 'championship_match', [fila(P.dario, true)])] },
  'temporada_2025-2026': { eventos: [evento(901, 'training', [fila(P.dic, true)])] },
};
const entradas = { exp, personas, historia, dicc, sporteasyPorNombre: new Map([['Ana Zeta', 'sint-uno']]), vinculos: {} };

console.log('\n== Qué cuenta');
ok(H.claseEvento({ category: { type: 'training' }, is_past: true }) === 'entrenos' && H.claseEvento({ category: { type: 'championship_match' }, is_past: true }) === 'partidos', 'entrenos y partidos de campeonato');
ok([H.claseEvento({ category: { type: 'friendly_match' }, is_past: true }), H.claseEvento({ category: { type: 'challenge_match' }, is_past: true }), H.claseEvento({ category: { type: 'training' }, is_past: true, is_cancelled: true }), H.claseEvento({ category: { type: 'training' }, is_past: false })].every((x) => x === null), 'amistosos, «entre nosotros», cancelados y futuros no');
ok(H.estado(fila(P.dic, true)) === 'fueron' && H.estado(fila(P.dic, false, 'excused')) === 'excusa' && H.estado(fila(P.dic, false, 'injured')) === 'lesion' && H.estado(fila(P.dic, false, 'not_excused')) === 'sin_excusa' && H.estado({ group: { slug_name: 'not_played' } }) === 'sin_excusa', 'presente, con excusa, lesionado, sin excusa y sin responder');
ok(Object.keys(H.leerExport(exp)).join() === '2018-19,2019-20,2020-21', 'solo 2018/19–2024/25 (2025/26 no se toca)');

console.log('\n== Casar y proponer');
const c = H.calcular(entradas);
const res = (id) => c.resolucion.get(id)?.person_id;
ok(res(1) === 'sint-uno' && res(9) === 'sint-uno', 'diccionario de SportEasy por nombre exacto (dos perfiles, la misma persona)');
ok(res(2) === 'sint-seis', 'nombre completo del diccionario del histórico, sin tildes ni mayúsculas');
const prop = Object.fromEntries(c.propuestas.map((p) => [p.id, p]));
ok(prop[3]?.person_id === 'sint-dos' && prop[3].coinciden.join() === '2018-19,2019-20', 'nombre + primer apellido, con las dos temporadas como confianza', JSON.stringify(prop[3]));
ok(prop[4]?.person_id === 'sint-tres', 'nombre + apellido en su temporada');
ok(prop[7]?.person_id === 'sint-siete', 'mote registrado esa temporada + primer apellido');
const sin = Object.fromEntries(c.sinPropuesta.map((p) => [p.id, p]));
ok(sin[5] && /más de un candidato/.test(sin[5].motivo), 'dos candidatos en la temporada: sin propuesta', JSON.stringify(sin[5]));
ok(sin[6] && /ningún candidato/.test(sin[6].motivo), 'la persona no estaba en el club esa temporada: sin propuesta');
ok(sin[8], 'nombre que no está en el club: sin propuesta');
ok(!c.resolucion.has(3) && !c.resolucion.has(4), 'una propuesta no se aplica sola');

console.log('\n== Recuento');
const t18 = Object.fromEntries(c.porTemporada['2018-19'].jugadores.map((j) => [j.person_id, j]));
ok(JSON.stringify(t18['sint-uno'].entrenos) === JSON.stringify({ fueron: 1, excusa: 0, sin_excusa: 0, no_conv: 0, lesion: 0, total: 1 }), 'dos perfiles en el mismo evento: cuenta una vez, con el mejor estado', JSON.stringify(t18['sint-uno'].entrenos));
ok(t18['sint-uno'].partidos.lesion === 1 && t18['sint-uno'].partidos.total === 1, 'lesionado en un partido');
ok(t18['sporteasy-3']?.entrenos.sin_excusa === 1 && t18['sporteasy-3'].partidos.fueron === 1, 'sin casar: persona histórica «sporteasy-<id>»');
ok(t18['sporteasy-3'].display === 'Bruno Beta', 'la persona histórica lleva el nombre de SportEasy');
ok(t18['sint-seis'].display === 'Elena Épsilon Mu', 'la casada lleva el nombre del club');
ok(!Object.values(t18).some((j) => (j.entrenos?.total ?? 0) > 1), 'amistoso, cancelado y futuro no suman');

console.log('\n== Vínculos aceptados');
const md = H.informe(c, c.displayDe);
ok(md.includes('`3`') && md.includes('(`sint-dos`)') && /Sin propuesta \(3\)/.test(md), 'el informe tiene una línea por perfil y los que no tienen propuesta aparte', md);
const marcado = md.split('\n').map((l) => (l.includes('`3`') ? l.replace('- [ ]', 'OK - [ ]') : l.includes('`4`') ? l.replace('- [ ]', 'NO - [ ]') : l)).join('\n');
ok(JSON.stringify(H.leerAceptadas(marcado)) === JSON.stringify({ 3: 'sint-dos' }), 'solo las marcadas OK; NO y sin marcar, no', JSON.stringify(H.leerAceptadas(marcado)));
const v = H.calcular({ ...entradas, vinculos: { 3: 'sint-dos' } });
const v18 = Object.fromEntries(v.porTemporada['2018-19'].jugadores.map((j) => [j.person_id, j]));
ok(!v18['sporteasy-3'] && v18['sint-dos']?.partidos.fueron === 1 && v18['sint-dos'].display === 'Bruno Beta Gama', 'vinculada: la histórica desaparece y sus eventos pasan a la persona del club');
ok(!v.propuestas.some((p) => p.id === 3), 'una vinculada ya no sale en las propuestas');
ok(typeof cambios === 'function', 'el vínculo en la base solo reescribe las personas afectadas (cambios por temporada)');

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
