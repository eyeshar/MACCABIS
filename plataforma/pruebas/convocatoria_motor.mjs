#!/usr/bin/env node
// Motor de convocatoria v1 (D107) con DATOS SINTÉTICOS: ni nombres reales ni niveles reales (D39). Cubre: dos partidos
// a distinta hora, misma hora, un solo equipo, 20 o más disponibles, faltan interiores, falta base, un «No dobla»
// necesario, un sancionado, desempate por entrenos, empate de dificultad, edición manual con avisos, reglas personales,
// propuesta de dificultad, nivel antes que rotación con la deuda de 2 domingos fuera (D109), ningún jugador fijo (D110),
// rivales parejos con los convocados igualados aunque un equipo tenga 5 interiores solo suyos (D112, el caso de la J3),
// nadie dobla por bases (D115), que el motor es determinista (misma entrada = misma salida, también desordenada) y los
// avisos de data/avisos.json vigentes ese domingo en el mensaje de WhatsApp y las dudas (D141): no se convocan ni cuentan
// como disponibles, salen aparte como «posibles»; y «solo entreno: nunca a partidos» (D146, regla 1.7): no se propone nunca.
// Y la marca «Reserva» (D158, regla 1.8): solo entra para cubrir mínimos o el número compensado; si no, «reserva disponible».
//
//   npm run pruebas:convocatoria-motor

import fs from 'node:fs';
import { mensajeConvocatoria } from '../src/lib/convocatoria/mensajes.ts';
import { vigentes } from '../src/lib/inicio/avisosFichero.ts';
import { proponer, revisar, proponerDificultad, diferencias, recuentoDe, maximoPorEquipo, domingosFueraDe, LINEA_DE } from '../src/lib/convocatoria/motor.ts';

let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };

// ---------------------------------------------------------------- fabrica de jugadores sinteticos
let n = 0;
function J(pos, nivel, o = {}) {
  n++;
  const id = o.id ?? `sint-${String(n).padStart(2, '0')}`;
  return {
    person_id: id, nombre: o.nombre ?? `Sintético ${String(n).padStart(2, '0')}`,
    ficha: o.ficha ?? { MdA: true, MdL: true }, solo_entreno: o.solo ?? false,
    respuesta: o.resp ?? { MdA: 'va', MdL: 'va' },
    privado: o.sinDatos ? null : { posicion: pos, base_reserva: o.reserva ?? false, nivel, dobla: o.dobla ?? true, regla: o.regla ?? null, ...(o.nunca ? { nunca_partidos: true } : {}), ...(o.esReserva ? { reserva: true } : {}) },
    sancionado: o.sancion ?? false, convocados: o.conv ?? 0, doblajes: o.dobl ?? 0, entrenos4: o.ent ?? 2, domingosFuera: o.fuera ?? 0,
  };
}
const reset = () => { n = 0; };
const VAL = { A: 5, B: 4, C: 3, D: 2, E: 1 };
/** Dentro de cada línea, ningún disponible que sale por el tope tiene más nivel que un convocado (sin deuda) de esa línea. */
function nivelRespetado(r, jugadores, e) {
  const de = new Map(jugadores.map((j) => [j.person_id, j]));
  const dentro = ids(r.convocatoria, e).map((id) => de.get(id)).filter((j) => j.domingosFuera < 2);
  const fuera = r.sinConvocar.filter((s) => s.regla === '1.1').map((s) => de.get(s.person_id));
  return fuera.every((f) => dentro.filter((j) => LINEA_DE[j.privado.posicion] === LINEA_DE[f.privado.posicion]).every((j) => VAL[j.privado.nivel] >= VAL[f.privado.nivel]));
}
const P = (equipo, inicio, dificultad = 'media') => ({ evento_id: `ev-${equipo}`, equipo, inicio, dificultad });
const ids = (c, e) => (c[e] ?? []).map((x) => x.person_id);
const avisosDe = (r, regla) => r.avisos.filter((a) => a.regla === regla);
const plantilla = (lista) => lista.map(([pos, nivel, o]) => J(pos, nivel, o));

/** 18 disponibles «normales»: 4 bases, 8 exteriores (2 de reserva), 6 interiores; niveles A-E repartidos. */
function dieciocho(extra = {}) {
  reset();
  return plantilla([
    ['base', 'A'], ['base', 'B'], ['base', 'C'], ['base', 'D'],
    ['escolta', 'A'], ['escolta', 'B', { reserva: true }], ['alero', 'B'], ['alero', 'C'], ['escolta', 'C', { reserva: true }], ['alero', 'D'], ['escolta', 'D'], ['alero', 'E'],
    ['pivot', 'A'], ['ala_pivot', 'B'], ['pivot', 'C'], ['ala_pivot', 'C'], ['pivot', 'D'], ['ala_pivot', 'E'],
  ].map(([p, nv, o]) => [p, nv, { ...extra, ...o }]));
}

// ---------------------------------------------------------------- 1. dos partidos a distinta hora
console.log('\n== Dos partidos a distinta hora (18 disponibles, MdA más difícil)');
{
  const jugadores = dieciocho();
  const entrada = { partidos: [P('MdA', '09:00', 'alta'), P('MdL', '12:45', 'baja')], jugadores };
  const r = proponer(entrada);
  const a = ids(r.convocatoria, 'MdA'), l = ids(r.convocatoria, 'MdL');
  const doblan = a.filter((x) => l.includes(x));
  ok(new Set([...a, ...l]).size === 18, 'los 18 disponibles van', `${a.length}+${l.length}`);
  ok(a.length <= 10 && l.length <= 10 && a.length >= 7 && l.length >= 7, 'entre 7 y 10 por equipo', `${a.length} y ${l.length}`);
  ok(r.recuento.MdA.bases.puros === 2 && r.recuento.MdL.bases.puros === 2, '2 bases puros en cada equipo');
  ok(r.recuento.MdA.interiores.n === 3 && r.recuento.MdL.interiores.n === 3 && doblan.length === 0, '6 interiores: 3 y 3, nadie dobla (solo se dobla para mínimos, no para el ideal de 4; D108)', `${r.recuento.MdA.interiores.n}/${r.recuento.MdL.interiores.n}, doblan ${doblan.length}`);
  ok(a.length === 9 && l.length === 9 && !avisosDe(r, '5.1').length && !avisosDe(r, '5.2').length, '9 y 9, sin avisos de doblaje');
  ok(r.recuento.MdA.nivelMedio > r.recuento.MdL.nivelMedio, `el más difícil (MdA) lleva más nivel medio (${r.recuento.MdA.nivelMedio.toFixed(2)} > ${r.recuento.MdL.nivelMedio.toFixed(2)})`);
  ok(!avisosDe(r, '3.1').length, 'sin aviso 3.1 (nivel al revés)');
  ok(r.sinConvocar.length === 0, 'nadie disponible se queda fuera');
  // Determinista: misma entrada, misma salida; y con los jugadores desordenados, también.
  const r2 = proponer(structuredClone(entrada));
  const r3 = proponer({ ...entrada, jugadores: [...entrada.jugadores].reverse() });
  ok(JSON.stringify(r) === JSON.stringify(r2), 'determinista: dos llamadas con la misma entrada dan lo mismo');
  ok(JSON.stringify(r.convocatoria) === JSON.stringify(r3.convocatoria) && JSON.stringify(r.avisos) === JSON.stringify(r3.avisos), 'el orden de entrada no cambia la propuesta');
  ok(JSON.stringify(entrada.jugadores) === JSON.stringify(dieciocho()), 'sin efectos secundarios: la entrada no se toca');
}

// ---------------------------------------------------------------- 2. misma hora (J13)
console.log('\n== Misma hora: nadie dobla');
{
  reset();
  // 13 disponibles con pocos interiores: con horas distintas doblaria alguno; a la misma hora, no.
  const jugadores = plantilla([['base', 'A'], ['base', 'B'], ['base', 'C'], ['escolta', 'B'], ['alero', 'C'], ['escolta', 'C'], ['alero', 'D'], ['escolta', 'D'], ['alero', 'E'], ['pivot', 'A'], ['ala_pivot', 'B'], ['pivot', 'C'], ['ala_pivot', 'D']]);
  const r = proponer({ partidos: [P('MdA', '10:15'), P('MdL', '10:15')], jugadores });
  const a = ids(r.convocatoria, 'MdA'), l = ids(r.convocatoria, 'MdL');
  ok(r.mismaHora, 'detecta la misma hora');
  ok(!a.some((x) => l.includes(x)), 'nadie está en los dos equipos');
  ok(a.length + l.length === 13, 'los 13 van, repartidos', `${a.length}+${l.length}`);
  const manual = { MdA: r.convocatoria.MdA, MdL: [...r.convocatoria.MdL, r.convocatoria.MdA[0]] };
  const rv = revisar({ partidos: [P('MdA', '10:15'), P('MdL', '10:15')], jugadores }, manual);
  ok(avisosDe(rv, '1.4').some((x) => x.gravedad === 'error'), 'doblar a mano a la misma hora: error de la regla 1.4');
}

// ---------------------------------------------------------------- 3. un solo equipo (J4)
console.log('\n== Un solo equipo juega (el otro descansa)');
{
  const jugadores = dieciocho();
  jugadores[0].ficha = { MdA: true, MdL: false }; // un base con ficha solo del MdA
  jugadores.forEach((j, i) => { j.convocados = i % 3; });
  const r = proponer({ partidos: [P('MdL', '11:30', 'alta')], jugadores: jugadores.map((j) => ({ ...j, respuesta: { MdL: 'va' } })) });
  const l = ids(r.convocatoria, 'MdL');
  ok(!r.convocatoria.MdA, 'sin propuesta para el equipo que descansa');
  ok(l.length === 10, '10 convocados (máximo)', String(l.length));
  ok(!l.includes('sint-01') && r.sinConvocar.some((s) => s.person_id === 'sint-01' && s.regla === '1.5'), 'el de ficha solo del MdA queda fuera por la regla 1.5');
  ok(r.sinConvocar.filter((s) => s.regla === '1.1').length === 7, '17 con ficha del MdL: 7 fuera por el tope de 10 (regla 1.1)', JSON.stringify(r.sinConvocar));
  ok(r.recuento.MdL.bases.puros >= 2 && r.recuento.MdL.interiores.n === 4, 'con sobrantes, el tope respeta 2 bases y 4 interiores', JSON.stringify(r.recuento.MdL));
  ok(nivelRespetado(r, jugadores, 'MdL'), 'nivel (4.1): nadie sale por el tope con más nivel que un convocado de su línea');
}

// ---------------------------------------------------------------- 4. 20 o más disponibles
console.log('\n== 20 o más disponibles');
{
  reset();
  const base = dieciocho();
  const mas = [J('alero', 'C', { solo: true }), J('pivot', 'D'), J('escolta', 'C'), J('base', 'E'), J('ala_pivot', 'C')];
  const jugadores = [...base, ...mas];
  const r = proponer({ partidos: [P('MdA', '09:00'), P('MdL', '12:45')], jugadores });
  ok(r.disponibles === 23 && r.maximo === 12, `23 disponibles: el máximo sube a ${r.maximo} (tope 12)`);
  ok(r.sinConvocar.some((s) => s.person_id === mas[0].person_id && s.regla === '1.2'), 'el «solo entreno» no va (regla 1.2)');
  const r20 = proponer({ partidos: [P('MdA', '09:00'), P('MdL', '12:45')], jugadores: [...base, mas[0], mas[1]] });
  ok(r20.disponibles === 20 && r20.maximo === 10 && r20.sinConvocar.some((s) => s.regla === '1.2'), 'con 20 justos: máximo 10 y el «solo entreno» tampoco va');
  ok(maximoPorEquipo(30, 2) === 12 && maximoPorEquipo(21, 2) === 11 && maximoPorEquipo(19, 1) === 10, 'máximo: 30 → 12, 21 → 11, 19 → 10');
}

// ---------------------------------------------------------------- D146: «solo entreno: nunca a partidos» (regla 1.7)
console.log('\n== «Solo entreno: nunca a partidos» (D146, regla 1.7): no se propone nunca');
{
  reset();
  // 12 disponibles para dos partidos: faltan jugadores, así que un «solo entreno» (el rol) entra a cubrir el hueco…
  const pocos = plantilla([
    ['base', 'B'], ['base', 'C'], ['escolta', 'C'], ['alero', 'C'], ['escolta', 'D'], ['alero', 'D'],
    ['pivot', 'C'], ['ala_pivot', 'C'], ['pivot', 'D'], ['ala_pivot', 'D'], ['alero', 'E'],
  ]);
  const rol = J('alero', 'B', { solo: true, id: 'sint-rol' });
  // …pero quien tiene la marca «nunca a partidos» no, aunque diga «voy», tenga nivel A y las dos fichas.
  const nunca = J('alero', 'A', { nunca: true, dobla: false, id: 'sint-nunca' });
  const partidos = [P('MdA', '09:00', 'alta'), P('MdL', '12:45')];
  const r = proponer({ partidos, jugadores: [...pocos, rol, nunca] });
  const todos = [...ids(r.convocatoria, 'MdA'), ...ids(r.convocatoria, 'MdL')];
  ok(todos.includes('sint-rol'), 'con menos de 20 disponibles el «solo entreno» del rol SÍ entra a cubrir el hueco (regla 1.2, sin cambios)');
  ok(!todos.includes('sint-nunca'), 'quien es «nunca a partidos» NO se convoca, ni con huecos por cubrir');
  ok(r.sinConvocar.some((x) => x.person_id === 'sint-nunca' && x.regla === '1.7' && x.motivo === 'Solo entreno: nunca a partidos'), 'sale en «Disponibles sin convocar» con su motivo (regla 1.7)', JSON.stringify(r.sinConvocar));
  ok(r.disponibles === 12, 'y no cuenta como disponible (12, no 13)', String(r.disponibles));
  const sinEl = proponer({ partidos, jugadores: [...pocos, rol] });
  ok(JSON.stringify(sinEl.convocatoria) === JSON.stringify(r.convocatoria), 'la propuesta es la misma que si no estuviera');
  // Con 20 o más disponibles, tampoco (y no suma para el umbral de 20).
  reset();
  const base = dieciocho();
  const con20 = proponer({ partidos, jugadores: [...base, J('alero', 'C', { id: 'sint-x' }), J('pivot', 'A', { nunca: true, id: 'sint-n2' }), J('escolta', 'B', { nunca: true, id: 'sint-n3' })] });
  ok(con20.disponibles === 19 && con20.maximo === 10, 'los «nunca a partidos» no suman para el umbral de 20 ni para el máximo', `${con20.disponibles} / ${con20.maximo}`);
  ok(!Object.values(con20.convocatoria).flat().some((c) => c.person_id.startsWith('sint-n')), 'y ninguno se convoca');
  // Revisar una convocatoria hecha a mano que lo lleva: aviso 1.7.
  const rev = revisar({ partidos, jugadores: [...pocos, rol, nunca] }, { MdA: [{ person_id: 'sint-nunca' }], MdL: [] });
  ok(avisosDe(rev, '1.7').some((a) => a.person_id === 'sint-nunca' && a.gravedad === 'aviso'), 'si un gestor lo convoca a mano, la pantalla lo avisa (regla 1.7)');
  // Con «duda»: tampoco sale como «posible».
  const duda = { ...nunca, respuesta: { MdA: 'duda', MdL: 'duda' } };
  ok(!proponer({ partidos, jugadores: [...pocos, duda] }).posibles.some((x) => x.person_id === 'sint-nunca'), 'con «duda» tampoco sale entre los «posibles»');
  // Determinista con la marca.
  ok(JSON.stringify(proponer({ partidos, jugadores: [nunca, rol, ...pocos].reverse() })) === JSON.stringify(r), 'mismo resultado con los jugadores en otro orden');
}

// ---------------------------------------------------------------- 5. faltan interiores / 7. un «No dobla» necesario
console.log('\n== Faltan interiores (por debajo de 3): dobla un «Dobla»; si no hay, un «No dobla» con aviso');
{
  reset();
  const mk = (dobla) => plantilla([
    ['base', 'A'], ['base', 'B'], ['base', 'C'], ['base', 'D'],
    ['escolta', 'B'], ['alero', 'C'], ['escolta', 'C'], ['alero', 'D'], ['escolta', 'D'], ['alero', 'E'],
    ['pivot', 'A', { dobla }], ['ala_pivot', 'B', { dobla }], ['pivot', 'C', { dobla }], ['ala_pivot', 'D', { dobla }], ['pivot', 'E', { dobla }],
  ]);
  const r = proponer({ partidos: [P('MdA', '09:00', 'alta'), P('MdL', '12:45', 'media')], jugadores: mk(true) });
  const a = ids(r.convocatoria, 'MdA'), l = ids(r.convocatoria, 'MdL');
  const dobladores = a.filter((x) => l.includes(x));
  ok(dobladores.length === 1 && Math.min(r.recuento.MdA.interiores.n, r.recuento.MdL.interiores.n) === 3, '5 interiores (3 y 2): dobla uno para llegar al mínimo de 3, no al ideal de 4', `${dobladores.length} doblan · ${r.recuento.MdA.interiores.n}/${r.recuento.MdL.interiores.n}`);
  ok(avisosDe(r, '5.1').length === dobladores.length && !avisosDe(r, '5.2').length, 'avisos 5.1 (dobla un «Dobla»), ninguno 5.2');
  reset();
  const r2 = proponer({ partidos: [P('MdA', '09:00', 'alta'), P('MdL', '12:45', 'media')], jugadores: mk(false) });
  ok(avisosDe(r2, '5.2').length >= 1 && avisosDe(r2, '5.2').every((x) => x.gravedad === 'aviso'), 'sin ningún «Dobla»: dobla un «No dobla» con aviso 5.2', JSON.stringify(avisosDe(r2, '5.2')));
  reset();
  // Si los interiores solo pueden ir a un partido, nadie puede doblar: se acepta 3.
  const sinDoblar = mk(true).map((j) => (j.privado.posicion === 'pivot' || j.privado.posicion === 'ala_pivot') ? { ...j, ficha: j.person_id < 'sint-13' ? { MdA: true, MdL: false } : { MdA: false, MdL: true } } : j);
  const r3 = proponer({ partidos: [P('MdA', '09:00'), P('MdL', '12:45')], jugadores: sinDoblar });
  ok([r3.recuento.MdA.interiores.n, r3.recuento.MdL.interiores.n].sort().join() === '2,3' && avisosDe(r3, '2.3').length >= 1, 'nadie puede doblar: se queda en 2 y 3 interiores, con aviso 2.3', `${r3.recuento.MdA.interiores.n}/${r3.recuento.MdL.interiores.n}`);
}

// ---------------------------------------------------------------- 6. falta base
console.log('\n== Falta base: base de reserva; si no hay, aviso 2.1; nadie dobla por bases (D115); dos de reserva con aviso');
{
  reset();
  const tres = plantilla([
    ['base', 'A'], ['base', 'B'], ['base', 'C'],
    ['escolta', 'B', { reserva: true }], ['alero', 'C'], ['escolta', 'C'], ['alero', 'D'], ['escolta', 'D'], ['alero', 'E'], ['escolta', 'E'],
    ['pivot', 'A'], ['ala_pivot', 'B'], ['pivot', 'C'], ['ala_pivot', 'D'], ['pivot', 'E'], ['ala_pivot', 'E'],
  ]);
  const r = proponer({ partidos: [P('MdA', '09:00', 'alta'), P('MdL', '12:45', 'baja')], jugadores: tres });
  const corto = r.recuento.MdA.bases.puros === 1 ? 'MdA' : 'MdL';
  ok(r.recuento[corto].bases.texto === '1 + 1 res.' && r.recuento[corto].bases.estado === 'minimo', `3 bases: el ${corto} juega con «1 + 1 res.» (amarillo, en el mínimo)`, JSON.stringify(r.recuento[corto].bases));
  reset();
  const uno = plantilla([
    ['base', 'A'],
    ['escolta', 'B', { reserva: true }], ['alero', 'C', { reserva: true }], ['escolta', 'C'], ['alero', 'D'], ['escolta', 'D'], ['alero', 'E'], ['escolta', 'E'], ['alero', 'C'],
    ['pivot', 'A'], ['ala_pivot', 'B'], ['pivot', 'C'], ['ala_pivot', 'D'], ['pivot', 'E'], ['ala_pivot', 'E'],
  ]);
  const r2 = proponer({ partidos: [P('MdA', '09:00', 'alta'), P('MdL', '12:45', 'baja')], jugadores: uno });
  const a = ids(r2.convocatoria, 'MdA'), l = ids(r2.convocatoria, 'MdL');
  ok(!(a.includes('sint-01') && l.includes('sint-01')) && !avisosDe(r2, '5.1').length && !avisosDe(r2, '5.2').length, 'un solo base puro: nadie dobla por bases (2 bases es lo ideal, no un mínimo; D115)');
  const sinPuro = r2.recuento.MdA.bases.puros ? 'MdL' : 'MdA';
  ok(r2.recuento[sinPuro].bases.texto === '0 + 1 res.' && avisosDe(r2, '2.1').some((x) => x.equipo === sinPuro && /Solo 1 base/.test(x.texto)), `el equipo sin base puro (${sinPuro}) lleva un base de reserva y el aviso 2.1`, `${r2.recuento.MdA.bases.texto} / ${r2.recuento.MdL.bases.texto}`);
  const soloA = uno.map((j) => (j.person_id === 'sint-01' ? { ...j, ficha: { MdA: true, MdL: false } } : j));
  const r4 = proponer({ partidos: [P('MdA', '09:00', 'alta'), P('MdL', '12:45', 'baja')], jugadores: soloA });
  ok(r4.recuento.MdA.bases.texto === '1 + 1 res.' && avisosDe(r4, '2.1').some((x) => x.equipo === 'MdL' && /Solo 1 base/.test(x.texto)), 'si el único base no puede doblar: el reserva va al prioritario (MdA, «1 + 1 res.») y el MdL avisa «solo 1 base»', `${r4.recuento.MdA.bases.texto} / ${r4.recuento.MdL.bases.texto}`);
  reset();
  const ninguno = [J('base', 'A', { ficha: { MdA: true, MdL: false } }), J('base', 'B', { ficha: { MdA: true, MdL: false } }), ...uno.slice(1)];
  const r3 = proponer({ partidos: [P('MdA', '09:00', 'alta'), P('MdL', '12:45', 'baja')], jugadores: ninguno });
  ok(r3.recuento.MdL.bases.puros === 0 && r3.recuento.MdL.bases.reserva === 2 && avisosDe(r3, '5.4').some((x) => x.equipo === 'MdL'), 'sin bases puros que puedan ir al MdL: dos bases de reserva y aviso 5.4', JSON.stringify(r3.recuento.MdL.bases));
}

// ---------------------------------------------------------------- 8. sancionado
console.log('\n== Sancionado');
{
  const jugadores = dieciocho();
  jugadores[4].sancionado = true;
  const r = proponer({ partidos: [P('MdA', '09:00'), P('MdL', '12:45')], jugadores });
  ok(![...ids(r.convocatoria, 'MdA'), ...ids(r.convocatoria, 'MdL')].includes('sint-05') && r.sinConvocar.some((s) => s.person_id === 'sint-05' && s.regla === '1.6'), 'no se convoca y sale en «sin convocar» con la regla 1.6');
  const rv = revisar({ partidos: [P('MdA', '09:00'), P('MdL', '12:45')], jugadores }, { ...r.convocatoria, MdA: [...r.convocatoria.MdA, { person_id: 'sint-05' }] });
  ok(avisosDe(rv, '1.6').some((x) => x.gravedad === 'error'), 'añadirlo a mano: error 1.6');
}

// ---------------------------------------------------------------- 9. desempate por entrenos
console.log('\n== Desempate por entrenos (a igual rotación y nivel)');
{
  reset();
  const jugadores = plantilla([
    ['base', 'B'], ['base', 'C'],
    ['escolta', 'C'], ['alero', 'C'], ['escolta', 'C'], ['alero', 'C'],
    ['escolta', 'C', { id: 'sint-entrena-poco', ent: 0 }], ['escolta', 'C', { id: 'sint-entrena-mucho', ent: 4 }],
    ['pivot', 'C'], ['ala_pivot', 'C'], ['pivot', 'C'], ['ala_pivot', 'C'],
  ]).map((j) => ({ ...j, respuesta: { MdL: 'va' } }));
  // 12 disponibles para un solo partido: salen 2 exteriores (los que sobran del ideal), todos con 0 partidos y nivel C.
  const r = proponer({ partidos: [P('MdL', '11:30')], jugadores });
  const l = ids(r.convocatoria, 'MdL');
  ok(l.includes('sint-entrena-mucho') && !l.includes('sint-entrena-poco'), 'misma rotación y mismo nivel: va quien más ha entrenado en las últimas 4 semanas', l.join(','));
  const sinEnt = proponer({ partidos: [P('MdL', '11:30')], jugadores: jugadores.map((j) => (j.person_id === 'sint-entrena-poco' ? j : { ...j, convocados: 1 })) });
  ok(ids(sinEnt.convocatoria, 'MdL').includes('sint-entrena-poco'), 'a igual nivel, la rotación va antes que los entrenos: si lleva menos partidos convocado, va aunque entrene menos');
}

// ---------------------------------------------------------------- 9 bis. nivel antes que rotación y deuda de 2 domingos (D109)
console.log('\n== Nivel antes que rotación; deuda de 2 domingos fuera (D109)');
{
  // 22 disponibles para un solo partido (J4): máximo 12. Dos A llevan un partido más que el resto.
  const veintidos = (o = {}) => {
    reset();
    return plantilla([
      ['base', 'A'], ['base', 'B'], ['base', 'C'], ['base', 'D'],
      ['escolta', 'A', { id: 'sint-a1', conv: 3 }], ['alero', 'A', { id: 'sint-a2', conv: 3 }], ['escolta', 'B'], ['alero', 'B'], ['escolta', 'C'], ['alero', 'C'],
      ['escolta', 'C'], ['alero', 'D'], ['escolta', 'D'], ['alero', 'E', { id: 'sint-e', ...o.e }],
      ['pivot', 'A'], ['ala_pivot', 'B'], ['pivot', 'B'], ['ala_pivot', 'C'], ['pivot', 'C'], ['ala_pivot', 'D'], ['pivot', 'D'], ['ala_pivot', 'E'],
    ]).map((j) => ({ ...j, convocados: j.person_id.startsWith('sint-a') ? 3 : 2, respuesta: { MdL: 'va' } }));
  };
  const js = veintidos();
  const r = proponer({ partidos: [P('MdL', '11:30', 'media')], jugadores: js });
  const l = ids(r.convocatoria, 'MdL');
  ok(r.disponibles === 22 && r.maximo === 12 && l.length === 12, '22 disponibles, 12 plazas, 12 convocados', `${r.disponibles}/${r.maximo}/${l.length}`);
  ok(l.includes('sint-a1') && l.includes('sint-a2'), 'dos A con un partido más convocado NO se quedan fuera (el nivel va antes que la rotación)', l.join(','));
  ok(nivelRespetado(r, js, 'MdL'), 'con 22 disponibles y 12 plazas, el orden por nivel se respeta en cada línea');
  ok(r.recuento.MdL.bases.puros >= 2 && r.recuento.MdL.interiores.n >= 4 && r.recuento.MdL.exteriores.n >= 4, 'primero se cubren las líneas', JSON.stringify(r.recuento.MdL));
  ok(!l.includes('sint-e') && avisosDe(r, '4.2').length === 0, 'sin deuda, el E se queda fuera y no hay aviso de rotación');

  const conDeuda = veintidos({ e: { fuera: 2 } });
  const r2 = proponer({ partidos: [P('MdL', '11:30', 'media')], jugadores: conDeuda });
  const l2 = ids(r2.convocatoria, 'MdL');
  ok(l2.includes('sint-e') && l2.length === 12, 'un E que lleva 2 domingos disponible y fuera entra (por delante del nivel)', l2.join(','));
  const av = avisosDe(r2, '4.2');
  ok(av.length === 1 && av[0].person_id === 'sint-e' && /entra por rotación \(2 domingos fuera\)/.test(av[0].texto) && av[0].gravedad === 'info', `aviso «${av[0]?.texto}» (regla 4.2)`);
  ok(l2.includes('sint-a1') && l2.includes('sint-a2'), 'y los dos A siguen dentro');
  ok(proponer({ partidos: [P('MdL', '11:30', 'media')], jugadores: veintidos({ e: { fuera: 1 } }) }).convocatoria.MdL.every((c) => c.person_id !== 'sint-e'), 'con 1 domingo fuera todavía no tiene deuda');
  const soloEnt = veintidos({ e: { fuera: 3, solo: true } });
  ok(!ids(proponer({ partidos: [P('MdL', '11:30', 'media')], jugadores: soloEnt }).convocatoria, 'MdL').includes('sint-e'), 'un «solo entreno» con deuda sigue al final (20 o más disponibles: no va)');

  const H = (s) => s.split('').map((c) => ({ disponible: c !== '-', convocado: c === 'c' }));
  ok(domingosFueraDe(H('ff')) === 2, 'domingosFueraDe: fuera, fuera → 2');
  ok(domingosFueraDe(H('f-f')) === 2, 'los domingos en que no estuvo disponible no cuentan ni cortan');
  ok(domingosFueraDe(H('fcf')) === 1 && domingosFueraDe(H('cff')) === 0, 'se para en el último domingo en que fue convocado');
  ok(domingosFueraDe([]) === 0, 'sin historial → 0');
}

// ---------------------------------------------------------------- 10. empate de dificultad
console.log('\n== Empate de dificultad: equilibrio por líneas; prioridad al MdA');
{
  const jugadores = dieciocho();
  const r = proponer({ partidos: [P('MdL', '12:45', 'media'), P('MdA', '09:00', 'media')], jugadores });
  const lineaNivel = (e, pos) => r.convocatoria[e].map((c) => jugadores.find((j) => j.person_id === c.person_id)).filter((j) => pos.includes(j.privado.posicion)).map((j) => 'ABCDE'.indexOf(j.privado.nivel));
  const media = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
  ok(Math.abs(media(lineaNivel('MdA', ['base'])) - media(lineaNivel('MdL', ['base']))) <= 1, 'bases equilibrados en nivel', `${lineaNivel('MdA', ['base'])} / ${lineaNivel('MdL', ['base'])}`);
  ok(Math.abs(media(lineaNivel('MdA', ['pivot', 'ala_pivot'])) - media(lineaNivel('MdL', ['pivot', 'ala_pivot']))) < 1, 'interiores equilibrados en nivel');
  ok(Math.abs(r.recuento.MdA.nivelMedio - r.recuento.MdL.nivelMedio) < 0.5, `nivel medio parecido (${r.recuento.MdA.nivelMedio.toFixed(2)} / ${r.recuento.MdL.nivelMedio.toFixed(2)})`);
  ok(r.convocatoria.MdA.some((c) => c.person_id === 'sint-01'), 'empate: el MdA tiene prioridad y elige primero (el base A va al MdA)');
  ok(!avisosDe(r, '3.2').length, 'sin aviso 3.2 (ninguna línea desequilibrada)');
}

// ---------------------------------------------------------------- 10 bis. rivales parejos: convocados igualados (D112, la J3)
console.log('\n== Rivales parejos: el número de convocados queda igualado (D112, el caso de la J3)');
{
  // Equivalente sintético de la J3 (24/10/2026): 5 interiores solo disponibles para el MdA y 12 para los dos partidos
  // (2 bases, 8 exteriores con 2 de reserva y 2 interiores). Antes del arreglo: MdA 10 y MdL 7.
  reset();
  const soloA = { resp: { MdA: 'va', MdL: 'no' } };
  const jugadores = plantilla([
    ['pivot', 'B', soloA], ['pivot', 'C', soloA], ['ala_pivot', 'C', soloA], ['ala_pivot', 'D', soloA], ['pivot', 'E', soloA],
    ['base', 'B'], ['base', 'C'],
    ['escolta', 'A', { reserva: true }], ['alero', 'B'], ['escolta', 'B', { reserva: true }], ['alero', 'C'], ['escolta', 'C'], ['alero', 'D'], ['escolta', 'D'],
    ['alero', 'E'], ['pivot', 'B'], ['ala_pivot', 'C'],
  ]);
  const entrada = { partidos: [P('MdA', '09:00', 'media'), P('MdL', '14:00', 'media')], jugadores };
  const r = proponer(entrada);
  const a = ids(r.convocatoria, 'MdA'), l = ids(r.convocatoria, 'MdL');
  ok(Math.abs(a.length - l.length) <= 1 && a.length + l.length === 17, `convocados igualados: ${a.length} y ${l.length} (diferencia máxima de 1; antes 10 y 7)`);
  ok(a.length < 10 && l.length < 10, 'el máximo de 10 es un tope, no un objetivo: ningún equipo se llena');
  ok(['sint-01', 'sint-02', 'sint-03', 'sint-04', 'sint-05'].every((id) => a.includes(id) && !l.includes(id)), 'los 5 interiores solo disponibles para el MdA siguen en el MdA (no se mueve a nadie que no esté disponible)');
  ok(avisosDe(r, '2.3').some((x) => x.equipo === 'MdA' && /5 interiores/.test(x.texto)), 'el aviso «evitar 5» sigue saliendo en el MdA (regla 2.3)');
  ok(!a.filter((x) => l.includes(x)).length || avisosDe(r, '5.1').length + avisosDe(r, '5.2').length > 0, 'nadie dobla sin su aviso');
  ok(r.recuento.MdL.bases.puros >= 1 && r.recuento.MdA.bases.puros >= 1, 'cada equipo con al menos un base puro');
  ok(JSON.stringify(r) === JSON.stringify(proponer({ ...entrada, jugadores: [...jugadores].reverse() })), 'determinista también con la entrada desordenada');
  // Con dificultad distinta no se toca: el más difícil sigue eligiendo primero (3.1).
  const rd = proponer({ partidos: [P('MdA', '09:00', 'alta'), P('MdL', '14:00', 'baja')], jugadores });
  ok(ids(rd.convocatoria, 'MdA').length <= 10 && ids(rd.convocatoria, 'MdL').length >= 7, `dificultad distinta: dentro de los límites (${ids(rd.convocatoria, 'MdA').length} y ${ids(rd.convocatoria, 'MdL').length})`);
  // Los 18 normales con rivales parejos: 9 y 9, como antes.
  const r18 = proponer({ partidos: [P('MdA', '09:00', 'media'), P('MdL', '12:45', 'media')], jugadores: dieciocho() });
  ok(ids(r18.convocatoria, 'MdA').length === 9 && ids(r18.convocatoria, 'MdL').length === 9, '18 disponibles con rivales parejos: 9 y 9');
}

// ---------------------------------------------------------------- 10 quater. nadie dobla por bases (D115, la J3)
console.log('\n== Nadie dobla por bases: el hueco lo cubre un base de reserva (D115, el caso de la J3)');
{
  // Equivalente sintético de la J3 en la vista previa (24/10/2026): 5 interiores solo del MdA y 12 para los dos
  // partidos (2 bases puros, 3 de reserva, 5 exteriores más y 2 interiores). Antes del arreglo, el reequilibrio de D112
  // pasaba al MdL el base de reserva del MdA y después doblaba un base «para tener 2 bases»: MdA 10 / MdL 8.
  reset();
  const soloA = { resp: { MdA: 'va', MdL: 'no' } };
  const jugadores = plantilla([
    ['ala_pivot', 'D', soloA], ['pivot', 'A', soloA], ['pivot', 'A', soloA], ['ala_pivot', 'C', soloA], ['ala_pivot', 'D', soloA],
    ['base', 'D'], ['base', 'A'],
    ['alero', 'C', { reserva: true }], ['escolta', 'B', { reserva: true }], ['escolta', 'C', { reserva: true }],
    ['escolta', 'C'], ['escolta', 'B'], ['alero', 'B'], ['escolta', 'C'], ['escolta', 'C'],
    ['pivot', 'C'], ['pivot', 'E'],
  ]);
  const r = proponer({ partidos: [P('MdA', '09:00', 'media'), P('MdL', '14:00', 'media')], jugadores });
  const a = ids(r.convocatoria, 'MdA'), l = ids(r.convocatoria, 'MdL');
  const doblan = a.filter((x) => l.includes(x));
  ok(doblan.length === 0 && !avisosDe(r, '5.1').length && !avisosDe(r, '5.2').length, 'nadie dobla (tampoco «para tener 2 bases»)', doblan.join(','));
  ok(new Set([...a, ...l]).size === 17 && Math.abs(a.length - l.length) <= 1, `9 y 8 contando a cada jugador una vez (${a.length} y ${l.length}, D112)`);
  ok(['MdA', 'MdL'].every((e) => r.recuento[e].bases.puros + r.recuento[e].bases.reserva >= 2), 'cada equipo con 2 bases contando los de reserva (el reserva se queda donde cubre el hueco)', `${r.recuento.MdA.bases.texto} / ${r.recuento.MdL.bases.texto}`);
  ok(avisosDe(r, '2.3').some((x) => x.equipo === 'MdA' && /5 interiores/.test(x.texto)), 'el aviso «evitar 5» del MdA sigue saliendo');
}

// ---------------------------------------------------------------- 10 ter. ningún jugador fijo (D110)
console.log('\n== Sin ningún jugador fijo (D110: en 2026/27 no hay entrenador-jugador)');
{
  const jugadores = dieciocho();
  ok(jugadores.every((j) => j.privado.regla === null), 'ninguna regla personal');
  for (const partidos of [[P('MdA', '09:00', 'alta'), P('MdL', '12:45', 'baja')], [P('MdA', '09:00'), P('MdL', '12:45')], [P('MdL', '11:30')]]) {
    const r = proponer({ partidos, jugadores });
    const dentro = new Set(partidos.flatMap((p) => ids(r.convocatoria, p.equipo)));
    ok(!avisosDe(r, '6.1').length && !r.sinConvocar.some((s) => s.regla === '6.1') && dentro.size > 0 && r.avisos.every((a) => a.regla && a.texto),
      `${partidos.map((p) => `${p.equipo} ${p.dificultad}`).join(' / ')}: propuesta sin avisos ni motivos de «fijo» (${partidos.map((p) => ids(r.convocatoria, p.equipo).length).join(' y ')})`);
  }
}

// ---------------------------------------------------------------- 11. edicion manual con avisos
console.log('\n== Edición manual: solo recuento y avisos, sin cambiar nada');
{
  const jugadores = dieciocho();
  jugadores[6].ficha = { MdA: true, MdL: false };
  jugadores[7].respuesta = { MdA: 'va', MdL: 'no' };
  jugadores[8].privado.dobla = false;
  const partidos = [P('MdA', '09:00', 'baja'), P('MdL', '12:45', 'alta')];
  const manual = {
    MdA: ['sint-01', 'sint-02', 'sint-05', 'sint-09', 'sint-13', 'sint-14'].map((person_id) => ({ person_id })),
    MdL: ['sint-03', 'sint-04', 'sint-06', 'sint-07', 'sint-08', 'sint-09', 'sint-10', 'sint-11', 'sint-12', 'sint-15', 'sint-16', { person_id: 'sint-17', posicion: 'escolta' }].map((x) => (typeof x === 'string' ? { person_id: x } : x)),
  };
  const copia = structuredClone(manual);
  const rv = revisar({ partidos, jugadores }, manual);
  ok(JSON.stringify(manual) === JSON.stringify(copia), 'no cambia la convocatoria que recibe');
  ok(!('convocatoria' in rv), 'devuelve solo recuento y avisos (sin propuesta)');
  ok(avisosDe(rv, '1.3').some((a) => a.equipo === 'MdA' && a.gravedad === 'error'), 'MdA con 6: error 1.3 (mínimo 7)');
  ok(avisosDe(rv, '1.1').some((a) => a.equipo === 'MdL'), 'MdL con 12 y 18 disponibles: aviso 1.1 (máximo 10)');
  ok(avisosDe(rv, '1.5').some((a) => a.person_id === 'sint-07'), 'sin ficha del MdL: error 1.5');
  ok(avisosDe(rv, '0.1').some((a) => a.person_id === 'sint-08' && /no voy/.test(a.texto)), 'dijo «no voy» a ese partido: aviso 0.1');
  ok(avisosDe(rv, '5.2').some((a) => a.person_id === 'sint-09'), 'dobla un «No dobla»: aviso 5.2');
  ok(avisosDe(rv, '6.3').some((a) => a.person_id === 'sint-17'), 'posición cambiada para el partido: info 6.3');
  ok(rv.recuento.MdL.interiores.n === 2 && rv.recuento.MdL.exteriores.n >= 7, 'la posición del partido cuenta en las líneas (un interior pasa a exterior)', JSON.stringify(rv.recuento.MdL));
  ok(avisosDe(rv, '3.1').length === 1 && avisosDe(rv, '3.1')[0].equipo === 'MdL', 'el más difícil (MdL) con menos nivel medio: aviso 3.1');
  ok(rv.sinConvocar.map((s) => s.person_id).join() === 'sint-18' && rv.sinConvocar[0].motivo === 'No convocado a mano', 'el disponible que no está: «No convocado a mano»');
  ok(rv.avisos.every((a, i, xs) => i === 0 || ['error', 'aviso', 'info'].indexOf(xs[i - 1].gravedad) <= ['error', 'aviso', 'info'].indexOf(a.gravedad)), 'avisos ordenados: errores, avisos, información');
  ok(rv.avisos.every((a) => a.regla && a.texto), 'cada aviso lleva la regla que lo causa');
}

// ---------------------------------------------------------------- reglas personales y datos que faltan
console.log('\n== Reglas personales y datos que faltan');
{
  const jugadores = dieciocho();
  jugadores[12].privado.regla = { tipo: 'fijo', equipo: 'MdL' }; // el pivot A, fijo al MdL (aunque el MdA es más difícil)
  jugadores[17].privado.regla = { tipo: 'comodin' };
  jugadores[16].privado = null;
  const r = proponer({ partidos: [P('MdA', '09:00', 'alta'), P('MdL', '12:45', 'baja')], jugadores });
  ok(ids(r.convocatoria, 'MdL').includes('sint-13') && !ids(r.convocatoria, 'MdA').includes('sint-13'), 'fijo a un equipo (6.1): va con el suyo');
  const eq = ids(r.convocatoria, 'MdA').includes('sint-18') ? 'MdA' : 'MdL';
  ok(r.convocatoria[eq].length <= r.convocatoria[eq === 'MdA' ? 'MdL' : 'MdA'].length, 'comodín (6.2): va al equipo al que le falta un jugador');
  ok(avisosDe(r, '0.2').some((a) => a.person_id === 'sint-17'), 'sin datos privados: aviso 0.2 (cuenta como exterior de nivel C)');
  const fijoOtro = revisar({ partidos: [P('MdA', '09:00'), P('MdL', '12:45')], jugadores }, { MdA: [{ person_id: 'sint-13' }], MdL: [] });
  ok(avisosDe(fijoOtro, '6.1').length === 1, 'fijo del MdL puesto a mano en el MdA: aviso 6.1');
}

// ---------------------------------------------------------------- 0 disponibles
console.log('\n== Sin disponibles: un solo mensaje por equipo (D108)');
{
  const jugadores = dieciocho({ resp: { MdA: 'sin_responder', MdL: 'sin_responder' } });
  const partidos = [P('MdA', '09:00'), P('MdL', '14:00')];
  const r = proponer({ partidos, jugadores });
  ok(r.disponibles === 0 && r.avisos.length === 2 && r.avisos.every((a) => a.texto === 'Todavía no hay disponibles para este domingo.' && a.gravedad === 'info'), 'propuesta: un mensaje por equipo y ningún aviso por regla', JSON.stringify(r.avisos.map((a) => a.regla)));
  const rv = revisar({ partidos, jugadores }, { MdA: [{ person_id: 'sint-01' }], MdL: [] });
  ok(rv.avisos.some((a) => a.regla === '1.3') && rv.avisos.some((a) => a.regla === '0.1' && a.person_id === 'sint-01'), 'en cuanto hay alguien convocado a mano, vuelven los avisos por regla');
}

// ---------------------------------------------------------------- dificultad propuesta
console.log('\n== Dificultad propuesta con la clasificación');
{
  const d1 = proponerDificultad({ pos: 10, equipo: 'X', pj: 4, dif: -20 }, 11, 'G1', 4);
  ok(d1.dificultad === 'baja' && d1.porque === '10.º del G1 tras la J4 (-5 por partido)', `10.º del G1 → baja: «${d1.porque}»`);
  const d2 = proponerDificultad({ pos: 4, equipo: 'X', pj: 4, dif: 60 }, 11, 'G2', 4);
  ok(d2.dificultad === 'alta', `4.º de 11 con +15 por partido → alta («${d2.porque}»)`);
  const pocos = proponerDificultad({ pos: 10, equipo: 'X', pj: 1, dif: -5 }, 11, 'G1', 2);
  ok(pocos.dificultad === 'media' && pocos.porque === 'Pocos datos (1 partido tras la J2): media por defecto', `menos de 3 partidos → media, «${pocos.porque}» (D108)`);
  const dos = proponerDificultad({ pos: 1, equipo: 'X', pj: 2, dif: 120 }, 11, 'G1', 2);
  ok(dos.dificultad === 'media' && /Pocos datos \(2 partidos/.test(dos.porque), 'aunque vaya 1.º con +60 por partido: con 2 partidos, media');
  ok(proponerDificultad({ pos: 2, equipo: 'X', pj: 3, dif: 60 }, 11, 'G1', 3).dificultad === 'alta', 'con 3 partidos ya cuenta');
  const d3 = proponerDificultad({ pos: 6, equipo: 'X', pj: 4, dif: 0 }, 11, 'G2', 4);
  ok(d3.dificultad === 'media', '6.º con 0 → media');
  const d4 = proponerDificultad(null, 11, 'G1', null);
  ok(d4.dificultad === 'media' && /Sin partidos/.test(d4.porque), 'sin partidos → media por defecto');
}

// ---------------------------------------------------------------- diferencias (mensaje tras aprobar)
console.log('\n== Qué ha cambiado tras aprobar');
{
  const nombre = (id) => id.replace('sint-', 'S');
  const d = diferencias({ MdA: [{ person_id: 'sint-01' }, { person_id: 'sint-02' }], MdL: [{ person_id: 'sint-03' }] }, { MdA: [{ person_id: 'sint-01' }], MdL: [{ person_id: 'sint-03' }, { person_id: 'sint-02' }, { person_id: 'sint-04' }, { person_id: 'sint-01' }] }, nombre);
  ok(d.join(' | ') === 'S01 dobla (también en el MdL) | S02 pasa del MdA al MdL | entra S04 en el MdL', d.join(' | '));
  ok(diferencias(null, { MdA: [] }, nombre).length === 0, 'sin aprobar antes: nada que contar');
  const rc = recuentoDe([], new Map());
  ok(rc.total === 0 && rc.bases.estado === 'mal' && rc.nivelMedio === null, 'equipo vacío: recuento a cero');
}

// ---------------------------------------------------------------- avisos de data/avisos.json en el WhatsApp
console.log('\n== Avisos del domingo en el mensaje de WhatsApp');
{
  const avisos = JSON.parse(fs.readFileSync(new URL('../src/data/avisos.json', import.meta.url), 'utf8')).avisos;
  const P = (equipo, inicio) => ({ equipo, rival: 'Rival Sintético', es_local: true, inicio, encuentro: null, sitio: 'CDM Moratalaz, pista 2', direccion: null, lineaEquipacion: null });
  const conv = { MdA: [{ person_id: 'sint-01' }], MdL: [{ person_id: 'sint-02' }] };
  const nombre = (id) => id.replace('sint-', 'Sint ');
  const msg = (fecha, partidos) => mensajeConvocatoria(fecha, 5, partidos, conv, nombre, [], vigentes(avisos, fecha, partidos.map((p) => p.equipo)));
  const ambos = msg('2026-11-08', [P('MdA', '10:00'), P('MdL', '12:00')]);
  const lineas = ambos.split('\n');
  const mm = lineas.filter((l) => l.includes('Media Maratón'));
  ok(mm.length === 1 && mm[0].startsWith('MdL: Domingo 8: Media Maratón de Moratalaz') && mm[0].endsWith('Quedada 11:10.'), 'el 8/11 lleva el aviso de la media maratón, en una línea y con «MdL:» delante', mm.join(' / '));
  ok(lineas.indexOf(mm[0]) > lineas.findLastIndex((l) => l.startsWith('Convocados')) && lineas.at(-1) === 'Recordad: el dorsal es obligatorio.', 'va después de los partidos y antes del recordatorio del dorsal');
  ok(lineas.filter((l) => /dorsal/i.test(l)).length === 1, 'el aviso del dorsal no se repite (ya va en el recordatorio)');
  ok(!msg('2026-11-08', [P('MdA', '10:00')]).includes('Media Maratón'), 'si ese domingo solo juega el MdA, no lleva el aviso del MdL');
  ok(!msg('2026-11-15', [P('MdA', '10:00'), P('MdL', '12:00')]).includes('Media Maratón') && !msg('2026-11-01', [P('MdL', '12:00')]).includes('Media Maratón'), 'ni el domingo anterior ni el siguiente');
  ok(/\nEsta noche cambia la hora/.test(msg('2026-10-25', [P('MdA', '10:00')])), 'un aviso «para todos» va sin equipo delante (cambio de hora del 25/10)');
  ok(!/sint-|nivel|posici/i.test(lineas.filter((l) => !l.startsWith('Convocados')).join('\n')), 'sin datos personales fuera de la lista de convocados');
  const sin = mensajeConvocatoria('2026-11-08', 5, [P('MdL', '12:00')], conv, nombre);
  ok(sin.endsWith('Recordad: el dorsal es obligatorio.') && !sin.includes('Media'), 'sin avisos (como antes) el mensaje no cambia');
}

// ---------------------------------------------------------------- D141: las dudas salen aparte, como «posibles»
console.log('\n== Dudas (D141): no se convocan ni cuentan como disponibles; salen aparte como «posibles»');
{
  const base = dieciocho();
  const partidos = [P('MdA', '09:00', 'alta'), P('MdL', '14:00')];
  const sinDudas = proponer({ partidos, jugadores: base });
  ok(sinDudas.posibles.length === 0, 'sin dudas: la lista de posibles está vacía');
  // El primero y el segundo base pasan a «duda» (uno a los dos partidos, otro solo al MdL); otro «no ha respondido».
  const conDudas = base.map((j, i) => (i === 0 ? { ...j, respuesta: { MdA: 'duda', MdL: 'duda' } } : i === 1 ? { ...j, respuesta: { MdA: 'va', MdL: 'duda' } } : i === 2 ? { ...j, respuesta: { MdA: 'sin_responder', MdL: 'sin_responder' } } : j));
  const r = proponer({ partidos, jugadores: conDudas });
  const todos = [...ids(r.convocatoria, 'MdA'), ...ids(r.convocatoria, 'MdL')];
  ok(!todos.includes(base[0].person_id) && !ids(r.convocatoria, 'MdL').includes(base[1].person_id), 'quien duda NO se convoca a ese partido');
  ok(r.disponibles === sinDudas.disponibles - 2, 'y no cuenta como disponible (ni quien no ha respondido)', `${r.disponibles} frente a ${sinDudas.disponibles}`);
  ok(JSON.stringify(r.posibles) === JSON.stringify([{ person_id: base[0].person_id, equipos: ['MdA', 'MdL'] }, { person_id: base[1].person_id, equipos: ['MdL'] }]), 'los posibles son quien duda, con el partido al que duda (ni «sin responder» ni «no»)', JSON.stringify(r.posibles));
  ok(!r.sinConvocar.some((s) => s.person_id === base[0].person_id), 'y no salen en «Disponibles sin convocar»: están aparte');
  // Revisar a mano: convocar a uno que duda no lo deja en los posibles de ese partido.
  const rev = revisar({ partidos, jugadores: conDudas }, { MdA: [{ person_id: base[0].person_id }], MdL: [] });
  ok(rev.posibles.length === 2 && rev.posibles[0].equipos.join() === 'MdL' && rev.posibles[1].person_id === base[1].person_id, 'si se convoca a mano a quien duda al MdA, solo sigue de posible para el MdL', JSON.stringify(rev.posibles));
  ok(avisosDe(rev, '0.1').some((a) => a.person_id === base[0].person_id && /tiene «duda»/.test(a.texto)), 'y el aviso 0.1 sigue diciendo que tiene «duda» a ese partido');
  // Un sancionado o sin ficha de ese equipo no es posible.
  const raros = conDudas.map((j, i) => (i === 0 ? { ...j, sancionado: true } : i === 1 ? { ...j, ficha: { MdA: true, MdL: false } } : j));
  ok(proponer({ partidos, jugadores: raros }).posibles.length === 0, 'un sancionado o sin ficha de ese equipo no es «posible»');
  // Pasada la hora límite no queda nadie en duda (pasa a «no va»): el motor propone sin posibles.
  const pasado = conDudas.map((j) => ({ ...j, respuesta: Object.fromEntries(Object.entries(j.respuesta).map(([e, v]) => [e, v === 'duda' ? 'no' : v])) }));
  ok(proponer({ partidos, jugadores: pasado }).posibles.length === 0, 'tras el límite (todas las dudas pasaron a «no va»): sin posibles y la propuesta ya es la definitiva');
  // Determinista, también con las dudas desordenadas.
  ok(JSON.stringify(proponer({ partidos, jugadores: [...conDudas].reverse() }).posibles) === JSON.stringify(r.posibles), 'mismo resultado con los jugadores en otro orden');
}

// ---------------------------------------------------------------- D158: reservas (regla 1.8)
console.log('\n== Reservas (D158, regla 1.8): solo entran para cubrir mínimos o el número compensado');
{
  const conv = (r) => [...ids(r.convocatoria, 'MdA'), ...ids(r.convocatoria, 'MdL')];
  const motivo = (r, id) => r.sinConvocar.find((s) => s.person_id === id);
  // 18 disponibles; dos de ellos son reservas: un escolta D (sint-11) y un ala-pívot E (sint-18). Sin ellos quedan 5
  // interiores: un equipo se queda con 2 y el reserva interior entra para llegar a 3; el exterior no hace falta.
  const marcados = dieciocho().map((j) => (j.person_id === 'sint-11' || j.person_id === 'sint-18' ? { ...j, privado: { ...j.privado, reserva: true } } : j));
  const partidos = [P('MdA', '09:00', 'alta'), P('MdL', '12:45', 'baja')];
  const r = proponer({ partidos, jugadores: marcados });
  ok(!conv(r).includes('sint-11') && motivo(r, 'sint-11')?.motivo === 'Reserva disponible' && motivo(r, 'sint-11')?.regla === '1.8', 'el reserva exterior no hace falta: sale como «Reserva disponible» (regla 1.8)', JSON.stringify(motivo(r, 'sint-11')));
  ok(conv(r).includes('sint-18') && avisosDe(r, '1.8').some((a) => a.person_id === 'sint-18' && /entra para tener 3 interiores/.test(a.texto)), 'el reserva interior entra para tener 3 interiores, con su aviso', JSON.stringify(avisosDe(r, '1.8')));
  ok(r.recuento.MdA.interiores.n >= 3 && r.recuento.MdL.interiores.n >= 3 && !avisosDe(r, '5.1').length && !avisosDe(r, '5.2').length, 'los dos equipos con 3 interiores y nadie dobla (el reserva va antes que doblar)');
  ok(r.disponibles === 18, 'los reservas que dicen «voy» cuentan como disponibles', String(r.disponibles));
  ok(JSON.stringify(proponer({ partidos, jugadores: [...marcados].reverse() })) === JSON.stringify(r), 'determinista: mismo resultado con los jugadores en otro orden');

  // Con 20 o más disponibles, ningún reserva va por defecto (ni para cubrir).
  const veinte = [...dieciocho(), J('pivot', 'A', { id: 'sint-r1', esReserva: true }), J('base', 'A', { id: 'sint-r2', esReserva: true })];
  const r20 = proponer({ partidos, jugadores: veinte });
  ok(r20.disponibles === 20 && !conv(r20).includes('sint-r1') && !conv(r20).includes('sint-r2'), 'con 20 disponibles, los reservas no van (aunque sean nivel A)');
  ok(motivo(r20, 'sint-r1')?.motivo === 'Reserva (20 o más disponibles)' && motivo(r20, 'sint-r2')?.regla === '1.8', 'y salen como «Reserva (20 o más disponibles)»', JSON.stringify(motivo(r20, 'sint-r1')));

  // Un solo partido con 6 disponibles y dos reservas: entra uno, el que cubre la línea que falta.
  reset();
  const pocos = [...plantilla([['base', 'B'], ['base', 'C'], ['escolta', 'B'], ['alero', 'C'], ['escolta', 'D'], ['pivot', 'B'], ['ala_pivot', 'C']]).slice(0, 6), J('alero', 'A', { id: 'sint-res', esReserva: true }), J('pivot', 'A', { id: 'sint-res2', esReserva: true })];
  const r7 = proponer({ partidos: [P('MdA', '10:00')], jugadores: pocos });
  const a7 = ids(r7.convocatoria, 'MdA');
  ok(a7.length === 7, 'un solo partido con 6 y dos reservas: entra uno, hasta 7', String(a7.length));
  ok(a7.includes('sint-res2') && !a7.includes('sint-res') && motivo(r7, 'sint-res')?.motivo === 'Reserva disponible', 'entra el pívot (cubre los 3 interiores además de llegar a 7); el otro queda como «Reserva disponible»', a7.join());

  // Número compensado (rivales parejos): 10 solo del MdA y 8 solo del MdL (los dos con los mínimos cubiertos); un reserva
  // disponible para el MdL entra y quedan 10 y 9; uno que solo puede con el MdA no entra (el MdA ya tiene más).
  reset();
  const soloA = { ficha: { MdA: true, MdL: false }, resp: { MdA: 'va' } }, soloL = { ficha: { MdA: false, MdL: true }, resp: { MdL: 'va' } };
  const comp = [
    ...plantilla([['base', 'B'], ['base', 'C'], ['escolta', 'B'], ['alero', 'C'], ['escolta', 'D'], ['alero', 'D'], ['pivot', 'B'], ['ala_pivot', 'C'], ['pivot', 'D'], ['ala_pivot', 'D']].map(([p, nv]) => [p, nv, soloA])),
    ...plantilla([['base', 'B'], ['base', 'C'], ['escolta', 'B'], ['alero', 'C'], ['escolta', 'D'], ['pivot', 'B'], ['ala_pivot', 'C'], ['pivot', 'D']].map(([p, nv]) => [p, nv, soloL])),
  ];
  const parejos = [P('MdA', '09:00'), P('MdL', '12:45')];
  const rc = proponer({ partidos: parejos, jugadores: [...comp, J('alero', 'C', { id: 'sint-comp', esReserva: true, ...soloL })] });
  const nA = ids(rc.convocatoria, 'MdA').length, nL = ids(rc.convocatoria, 'MdL').length;
  ok(nA === 10 && nL === 9 && ids(rc.convocatoria, 'MdL').includes('sint-comp'), 'parejos, 10 frente a 8: el reserva del MdL entra y quedan 10 y 9', `${nA} y ${nL}`);
  ok(avisosDe(rc, '1.8').some((a) => a.person_id === 'sint-comp' && /compensar el número/.test(a.texto)), 'con el aviso «compensar el número de convocados»', JSON.stringify(avisosDe(rc, '1.8')));
  const rca = proponer({ partidos: parejos, jugadores: [...comp, J('alero', 'C', { id: 'sint-compa', esReserva: true, ...soloA })] });
  ok(!conv(rca).includes('sint-compa') && motivo(rca, 'sint-compa')?.motivo === 'Reserva disponible', 'el reserva que solo puede con el MdA no entra (el MdA ya tiene más)');
  const rcd = proponer({ partidos: [P('MdA', '09:00', 'alta'), P('MdL', '12:45', 'baja')], jugadores: [...comp, J('alero', 'C', { id: 'sint-comp', esReserva: true, ...soloL })] });
  ok(!conv(rcd).includes('sint-comp'), 'con dificultades distintas no se compensa el número (como la regla 3.2): no entra');

  // Edición a mano: subir a un reserva no es un error; el que queda fuera sigue como «Reserva disponible».
  const manual = { MdA: [...r.convocatoria.MdA, { person_id: 'sint-11' }], MdL: r.convocatoria.MdL };
  const rv = revisar({ partidos, jugadores: marcados }, manual);
  ok(!rv.avisos.some((a) => a.regla === '1.8' && a.gravedad !== 'info'), 'subirlo a mano no da aviso de la regla 1.8 (menos de 20 disponibles)');
  const rv2 = revisar({ partidos, jugadores: marcados }, r.convocatoria);
  ok(rv2.sinConvocar.find((s) => s.person_id === 'sint-11')?.motivo === 'Reserva disponible', 'en la revisión sin propuesta, el reserva fuera dice «Reserva disponible»');
  const rv20 = revisar({ partidos, jugadores: veinte }, { MdA: [...r20.convocatoria.MdA, { person_id: 'sint-r1' }], MdL: r20.convocatoria.MdL });
  ok(avisosDe(rv20, '1.8').some((a) => a.person_id === 'sint-r1' && a.gravedad === 'aviso'), 'con 20 o más disponibles, subirlo a mano da un aviso naranja');

  // Privacidad: el mensaje de WhatsApp no dice quién es reserva.
  const nombre = (id) => marcados.find((j) => j.person_id === id)?.nombre ?? id;
  const pm = [{ ...partidos[0], rival: 'Rival A', pista: 'Pista 1', hora: '09:00', fecha: '2026-11-15' }, { ...partidos[1], rival: 'Rival B', pista: 'Pista 2', hora: '12:45', fecha: '2026-11-15' }];
  const msg = mensajeConvocatoria('2026-11-15', 6, pm, r.convocatoria, nombre);
  ok(!/reserva/i.test(msg), 'el mensaje de WhatsApp no menciona la marca «Reserva»');
}

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
