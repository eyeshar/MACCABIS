#!/usr/bin/env node
// Motor de convocatoria v1 (D107) con DATOS SINTÉTICOS: ni nombres reales ni niveles reales (D39). Cubre: dos partidos
// a distinta hora, misma hora, un solo equipo, 20 o más disponibles, faltan interiores, falta base, un «No dobla»
// necesario, un sancionado, desempate por entrenos, empate de dificultad, edición manual con avisos, reglas personales,
// propuesta de dificultad y que el motor es determinista (misma entrada = misma salida, también desordenada).
//
//   npm run pruebas:convocatoria-motor

import { proponer, revisar, proponerDificultad, diferencias, recuentoDe, maximoPorEquipo } from '../src/lib/convocatoria/motor.ts';

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
    privado: o.sinDatos ? null : { posicion: pos, base_reserva: o.reserva ?? false, nivel, dobla: o.dobla ?? true, regla: o.regla ?? null },
    sancionado: o.sancion ?? false, convocados: o.conv ?? 0, doblajes: o.dobl ?? 0, entrenos4: o.ent ?? 2,
  };
}
const reset = () => { n = 0; };
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
  const fueraTope = r.sinConvocar.filter((s) => s.regla === '1.1').map((s) => jugadores.find((j) => j.person_id === s.person_id).convocados);
  ok(Math.min(...fueraTope) >= 1, 'rotación (4.1): los que salen por el tope llevan más partidos convocado', fueraTope.join(','));
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
console.log('\n== Falta base: base de reserva; si no llega, dobla un base; si no, dos de reserva con aviso');
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
  ok(a.includes('sint-01') && l.includes('sint-01'), 'un solo base puro: dobla para que los dos equipos tengan base');
  ok(r2.recuento.MdA.bases.estado !== 'mal' && r2.recuento.MdL.bases.estado !== 'mal', 'los dos equipos llegan a 2 bases contando el de reserva', `${r2.recuento.MdA.bases.texto} / ${r2.recuento.MdL.bases.texto}`);
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
  ok(ids(sinEnt.convocatoria, 'MdL').includes('sint-entrena-poco'), 'pero la rotación manda: si lleva menos partidos convocado, va antes aunque entrene menos');
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

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
