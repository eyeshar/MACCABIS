#!/usr/bin/env node
// Registro de no convocados y desempate del motor (regla 4.3 de docs/REGLAS_CONVOCATORIA.md), con DATOS SINTÉTICOS (D39:
// ni nombres ni niveles reales). Sin base de datos ni navegador: funciones puras.
//   - Registro: disponible a tiempo y fuera = +1; convocado = la racha vuelve a 0; «solo entreno» no suma; «voy» tardío no
//     suma (ni corta la racha); sin ficha, sancionado o sin datos de ese domingo, no cuenta; total de la temporada.
//   - Motor: con el interruptor APAGADO la propuesta es idéntica con y sin registro (la de siempre); ENCENDIDO solo desempata
//     a igual línea y nivel (entra antes quien más racha lleva), nunca por encima del nivel ni entre líneas distintas.
//   - El interruptor: solo «1» lo enciende; entradaDe pasa el del contexto (apagado si no viene).
//
//   npm run pruebas:no-convocados

import { registroNoConvocados, estadoDomingo, masTiempoFuera, desempateEncendido, aTiempo } from '../src/lib/convocatoria/noConvocados.ts';
import { proponer } from '../src/lib/convocatoria/motor.ts';
import { entradaDe } from '../src/lib/convocatoria/vista.ts';

let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };

// ---------------------------------------------------------------- registro
console.log('\n== Registro de no convocados');
// Cuatro domingos ya jugados (J1-J4); el cierre de cada uno, el martes anterior a las 12:00 (hora de Madrid, +02:00 en octubre).
const D = (fecha, jornada, cierre, convocados, fuente = 'convocatoria') => ({ fecha, jornada, cierre, convocados, fuente: convocados ? fuente : null });
const domingos = [
  D('2026-09-27', 1, '2026-09-22T12:00:00+02:00', ['sint-b'], 'hojas'),
  D('2026-10-04', 2, '2026-09-29T12:00:00+02:00', ['sint-c']),
  D('2026-10-11', 3, '2026-10-06T12:00:00+02:00', ['sint-b']),
  D('2026-10-18', 4, '2026-10-13T12:00:00+02:00', ['sint-c']),
];
const voy = (fecha, person_id, equipo = 'MdA', cambiado_en = null, origen = 'jugador') => ({ fecha, equipo, person_id, respuesta: 'va', cambiado_en, origen });
const J = (person_id, o = {}) => ({ person_id, ficha: o.ficha ?? { MdA: true, MdL: true }, soloEntreno: !!o.solo, sancionadoHasta: o.sancion ?? null });
const respuestas = [
  // A: «voy» a tiempo los cuatro domingos y nunca entra: racha 4, total 4.
  ...domingos.map((d) => voy(d.fecha, 'sint-a', 'MdA', '2026-09-01T10:00:00+02:00')),
  // B: «voy» los cuatro; entra en J1 y J3: racha 1 (J4), total 2 (J2 y J4).
  ...domingos.map((d) => voy(d.fecha, 'sint-b')),
  // C: solo entreno (rol), «voy» todos: nunca suma.
  ...domingos.map((d) => voy(d.fecha, 'sint-c')),
  // T: «voy» en J4 DESPUÉS del cierre (martes 13:00) y en J3 a tiempo: J4 no suma ni corta: racha 1, total 1.
  voy('2026-10-11', 'sint-t', 'MdL', '2026-10-05T20:00:00+02:00'),
  voy('2026-10-18', 'sint-t', 'MdL', '2026-10-13T13:00:00+02:00'),
  // F: «voy» al MdL sin ficha del MdL: no cuenta.
  voy('2026-10-18', 'sint-f', 'MdL'),
  // S: sancionado hasta la J4: «voy» en la J4 no cuenta.
  voy('2026-10-18', 'sint-s'),
  // I: importada de SportEasy (sin hora real): a tiempo.
  voy('2026-10-04', 'sint-i', 'MdA', '2026-10-24T09:54:00+02:00', 'sporteasy'),
];
const jugadores = [J('sint-a'), J('sint-b'), J('sint-c', { solo: true }), J('sint-t'), J('sint-f', { ficha: { MdA: true, MdL: false } }), J('sint-s', { sancion: 4 }), J('sint-i'), J('sint-n')];
const reg = registroNoConvocados(domingos, respuestas, jugadores);
const R = (id) => reg.get(id);
ok(R('sint-a').racha === 4 && R('sint-a').total === 4, 'disponible a tiempo y fuera = +1 cada domingo (racha 4, total 4)', JSON.stringify(R('sint-a')));
ok(R('sint-b').racha === 1 && R('sint-b').total === 2, 'convocado = la racha vuelve a 0 (B: entra en J1 y J3; racha 1, total 2)', `${R('sint-b').racha}/${R('sint-b').total}`);
ok(R('sint-b').domingos[0].estado === 'suma' && R('sint-b').domingos[1].estado === 'convocado', 'el más reciente primero: J4 suma, J3 convocado');
ok(R('sint-c').racha === 0 && R('sint-c').total === 0 && R('sint-c').domingos.every((d) => ['solo_entreno', 'convocado'].includes(d.estado)), '«solo entreno» no suma nunca', JSON.stringify(R('sint-c').domingos.map((d) => d.estado)));
ok(R('sint-t').racha === 1 && R('sint-t').total === 1 && R('sint-t').domingos[0].estado === 'tarde', '«voy» tardío no suma ni corta la racha (racha 1 de la J3)', JSON.stringify(R('sint-t')));
ok(R('sint-f').total === 0 && R('sint-f').domingos[0].estado === 'sin_ficha', '«voy» sin ficha de ese equipo: no cuenta');
ok(R('sint-s').total === 0 && R('sint-s').domingos[0].estado === 'sancionado', 'sancionado ese domingo: no cuenta');
ok(R('sint-i').total === 1, 'respuesta importada de SportEasy (sin hora real): a tiempo');
ok(R('sint-n').total === 0 && R('sint-n').domingos.every((d) => d.estado === 'no_disponible'), 'sin «voy»: no cuenta');
{
  const sinDatos = registroNoConvocados([D('2026-10-18', 4, '2026-10-13T12:00:00+02:00', null)], [voy('2026-10-18', 'sint-a')], [J('sint-a')]);
  ok(sinDatos.get('sint-a').total === 0 && sinDatos.get('sint-a').domingos[0].estado === 'sin_datos', 'domingo sin convocatoria aprobada ni hojas: no cuenta');
  ok(estadoDomingo(J('sint-a'), domingos[3], [voy('2026-10-18', 'sint-a', 'MdA', '2026-10-13T12:00:00+02:00')]) === 'suma', 'responder justo a la hora del cierre (12:00) es a tiempo');
  ok(!aTiempo({ cambiado_en: '2026-10-13T12:00:01+02:00', origen: 'jugador' }, '2026-10-13T12:00:00+02:00'), 'un segundo después, tarde');
  ok(R('sint-a').domingos.every((d, i) => d.fuente === domingos[3 - i].fuente), 'cada domingo dice de dónde sale quién entró (convocatoria u hojas)');
}
{
  const lista = masTiempoFuera(reg, jugadores.map((j) => ({ person_id: j.person_id, nombre: j.person_id })));
  ok(lista[0].person_id === 'sint-a' && lista.every((x) => x.reg.racha > 0 || x.reg.total > 0) && !lista.some((x) => x.person_id === 'sint-c'), '«Quién lleva más tiempo fuera»: por racha, sin quien no suma', lista.map((x) => `${x.person_id}:${x.reg.racha}/${x.reg.total}`).join(' '));
}

// ---------------------------------------------------------------- motor: desempate detrás del interruptor
console.log('\n== Motor: desempate por no convocados (interruptor)');
let n = 0;
const JM = (pos, nivel, o = {}) => {
  n++;
  return {
    person_id: o.id ?? `sint-${String(n).padStart(2, '0')}`, nombre: `Sintético ${n}`, ficha: { MdA: true, MdL: true }, solo_entreno: !!o.solo,
    respuesta: { MdA: 'va' }, privado: { posicion: pos, base_reserva: false, nivel, dobla: true, regla: null },
    sancionado: false, convocados: o.conv ?? 0, doblajes: 0, entrenos4: o.ent ?? 2, domingosFuera: 0, ...(o.racha != null ? { rachaFuera: o.racha } : {}),
  };
};
/** Un domingo con un solo equipo y 11 disponibles (máximo 10): 2 bases, 5 exteriores (sobra uno) y 4 interiores. */
function once(rachas = {}, niveles = {}) {
  n = 0;
  return {
    partidos: [{ evento_id: 'ev-MdA', equipo: 'MdA', inicio: '09:00', dificultad: 'media' }],
    jugadores: [
      JM('base', 'A'), JM('base', 'B'),
      JM('escolta', 'A'), JM('alero', 'B'), JM('escolta', 'C'),
      JM('alero', niveles.x1 ?? 'D', { id: 'sint-x1', racha: rachas.x1 }), JM('escolta', niveles.x2 ?? 'D', { id: 'sint-x2', racha: rachas.x2 }),
      JM('pivot', 'A'), JM('ala_pivot', 'B'), JM('pivot', 'C', { racha: rachas.int }), JM('ala_pivot', 'D'),
    ],
  };
}
const fuera = (r) => r.sinConvocar.filter((s) => s.regla === '1.1').map((s) => s.person_id);
{
  const base = proponer(once());
  ok(JSON.stringify(fuera(base)) === JSON.stringify(['sint-x2']), 'sin registro: sobra un exterior; a igual nivel sale el último por identificador (x2)', fuera(base).join());
  const conRegistroApagado = proponer({ ...once({ x2: 3, x1: 0, int: 5 }), desempateNoConvocados: false });
  ok(JSON.stringify(conRegistroApagado) === JSON.stringify(proponer(once({ x2: 3, x1: 0, int: 5 }))), 'apagado: dar el interruptor a false = no darlo');
  const sinRacha = { ...base }, conRacha = { ...conRegistroApagado };
  ok(JSON.stringify(sinRacha) === JSON.stringify(conRacha), 'APAGADO: la misma propuesta con y sin el registro (convocados, avisos, fuera)');
  const enc = proponer({ ...once({ x2: 3, x1: 0 }), desempateNoConvocados: true });
  ok(JSON.stringify(fuera(enc)) === JSON.stringify(['sint-x1']), 'ENCENDIDO: a igual línea y nivel entra antes quien más racha lleva (x2 con 3 entra, sale x1)', fuera(enc).join());
  const nivel = proponer({ ...once({ x2: 5 }, { x1: 'D', x2: 'E' }), desempateNoConvocados: true });
  ok(JSON.stringify(fuera(nivel)) === JSON.stringify(['sint-x2']), 'ENCENDIDO: la racha no pasa por encima del nivel (x2 nivel E con racha 5 sigue fuera)', fuera(nivel).join());
  const otraLinea = proponer({ ...once({ int: 9 }), desempateNoConvocados: true });
  ok(JSON.stringify(fuera(otraLinea)) === JSON.stringify(['sint-x2']), 'ENCENDIDO: la racha de un interior no cambia quién sale de los exteriores', fuera(otraLinea).join());
  const iguales = proponer({ ...once({ x1: 2, x2: 2 }), desempateNoConvocados: true });
  ok(JSON.stringify(fuera(iguales)) === JSON.stringify(['sint-x2']), 'ENCENDIDO con la misma racha: el orden de siempre (convocados, entrenos, identificador)', fuera(iguales).join());
  const desordenada = proponer({ ...once({ x2: 3 }), jugadores: [...once({ x2: 3 }).jugadores].reverse(), desempateNoConvocados: true });
  ok(JSON.stringify(desordenada.convocatoria.MdA.map((c) => c.person_id).sort()) === JSON.stringify(enc.convocatoria.MdA.map((c) => c.person_id).sort()), 'ENCENDIDO y determinista: con la plantilla desordenada, los mismos convocados');
}
{
  // Dos partidos (rivales parejos) con 24 disponibles: el registro no cambia nada apagado.
  n = 0;
  const pos = ['base', 'base', 'base', 'base', 'escolta', 'alero', 'escolta', 'alero', 'escolta', 'alero', 'escolta', 'alero', 'pivot', 'ala_pivot', 'pivot', 'ala_pivot', 'pivot', 'ala_pivot', 'escolta', 'alero', 'pivot', 'base', 'alero', 'pivot'];
  const nv = ['A', 'B', 'C', 'D', 'E'];
  const mk = (conRacha) => { n = 0; return { partidos: [{ evento_id: 'a', equipo: 'MdA', inicio: '09:00', dificultad: 'media' }, { evento_id: 'l', equipo: 'MdL', inicio: '11:00', dificultad: 'media' }], jugadores: pos.map((p, i) => ({ ...JM(p, nv[i % 5], { racha: conRacha ? (i * 7) % 4 : undefined }), respuesta: { MdA: 'va', MdL: 'va' } })) }; };
  ok(JSON.stringify(proponer(mk(false))) === JSON.stringify(proponer(mk(true))), 'APAGADO con dos partidos y 24 disponibles: idéntica con y sin registro');
  const e1 = proponer({ ...mk(true), desempateNoConvocados: true });
  ok(e1.convocatoria.MdA.length + e1.convocatoria.MdL.length > 0 && e1.convocatoria.MdA.length <= 12, 'ENCENDIDO: sigue respetando los límites duros');
}

// ---------------------------------------------------------------- interruptor
console.log('\n== Interruptor CONVOCATORIA_DESEMPATE_NO_CONVOCADOS');
ok(desempateEncendido('1') && !desempateEncendido('0') && !desempateEncendido('true') && !desempateEncendido(undefined) && !desempateEncendido(''), 'solo «1» lo enciende (vacío, «0», «true» o sin variable: apagado)');
{
  const ctx = { partidos: [{ evento_id: 'e', equipo: 'MdA', inicio: '09:00', dificultad: { valor: 'media' } }], jugadores: [{ ...JM('base', 'A', { racha: 2 }), invitado: true, invitadoA: ['MdA'], motivoNo: {}, sancionHasta: null, fuera: { racha: 2, total: 3, soloEntreno: false } }] };
  ok(entradaDe(ctx).desempateNoConvocados === false && !('fuera' in entradaDe(ctx).jugadores[0]), 'entradaDe sin interruptor: apagado y sin el detalle del registro');
  ok(entradaDe({ ...ctx, desempateNoConvocados: true }).desempateNoConvocados === true && entradaDe(ctx).jugadores[0].rachaFuera === 2, 'entradaDe con el interruptor del contexto: encendido, con la racha');
}

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
