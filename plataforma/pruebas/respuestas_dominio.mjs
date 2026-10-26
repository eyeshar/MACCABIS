#!/usr/bin/env node
// Estado de un domingo con dos partidos para el jugador (lib/respuestas/dominio.ts), sin base de datos: manda la
// respuesta de CADA partido (importada de SportEasy o puesta por un gestor), no solo la del domingo.
// Caso real (J3, 25/10/2026): «va» al MdA y «no» al MdL salía «Vas a los dos» en el inicio. Y el resumen por evento
// tras importar respuestas (para cotejar con SportEasy antes de activar las respuestas en la web).
//
//   npm run pruebas:respuestas-dominio

import * as D from '../src/lib/respuestas/dominio.ts';
import { resumenCotejo, textoCotejo } from '../src/lib/eventos/dominio.ts';

let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };

const ev = (id, equipo, inicio, extra = {}) => ({
  id, tipo: 'liga', equipo, titulo: null, jornada: 3, rival: 'Rival', es_local: true, fecha: '2026-10-25', inicio, fin: null,
  quedada: null, notas: null, estado: 'programado', cambio_visible: null, cambio_visible_en: null, pista_nombre: null,
  pista_nombre_corto: null, pista_direccion: null, numero_pista: null, pista_por_confirmar: false, pista_motivo: null, ...extra,
});
const mda = ev('mda3', 'MdA', '09:00:00'), mdl = ev('mdl3', 'MdL', '14:00:00');
const r = (evento_id, respuesta, extra = {}) => ({ evento_id, respuesta, motivo: null, detalle: null, ausencia_id: null, origen: 'sporteasy', ...extra });
const [dom] = D.unidades([mda, mdl]);

console.log('Domingo con dos partidos a horas distintas');
ok(dom.tipo === 'domingo' && dom.modo === 'distintas', 'J3: un domingo, horas distintas');
const est = (rs, aus = []) => D.estadoDe(dom, rs, aus);
ok(est([r('mda3', 'va'), r('mdl3', 'va')]).texto === 'Vas a los dos', '«va» a los dos: «Vas a los dos»');
const t1 = est([r('mda3', 'va'), r('mdl3', 'no')]);
ok(t1.clase === 'vas' && t1.texto === 'Vas al MdA · no al MdL', '«va» al MdA y «no» al MdL (importado): «Vas al MdA · no al MdL»', t1.texto);
ok(!/los dos/.test(t1.texto), '... y nunca «a los dos»');
const t2 = est([r('mda3', 'no'), r('mdl3', 'va', { origen: 'gestor', puesto_por_nombre: 'Iván' })]);
ok(t2.texto === 'Vas al MdL · no al MdA', '«no» al MdA y «va» al MdL puesto por un gestor: «Vas al MdL · no al MdA»', t2.texto);
ok(est([r('mda3', 'va'), r('mdl3', 'duda')]).texto === 'Vas al MdA · duda en el MdL', '«va» y «duda»: «Vas al MdA · duda en el MdL»');
ok(est([r('mda3', 'no'), r('mdl3', 'no')]).clase === 'novas', '«no» a los dos: No vas');
ok(est([r('mda3', 'va')]).pendiente, 'falta un partido: pendiente');

console.log('\nTu próximo partido: solo los partidos a los que no ha dicho que no');
const ids = (rs) => D.partidosQueVa(dom, rs).map((e) => e.id).join(',');
ok(ids([r('mda3', 'va'), r('mdl3', 'no')]) === 'mda3', '«va» MdA / «no» MdL: solo el MdA (no el de las 14:00)');
ok(ids([r('mda3', 'va'), r('mdl3', 'va')]) === 'mda3,mdl3', '«va» a los dos: los dos');
ok(ids([r('mda3', 'va'), r('mdl3', 'duda')]) === 'mda3,mdl3', 'con duda en uno: los dos');
ok(ids([]) === 'mda3,mdl3', 'sin responder: los dos');
ok(ids([r('mda3', 'no'), r('mdl3', 'no')]) === 'mda3,mdl3', '«no» a los dos: los dos (la pastilla dice «No vas»)');

console.log('\nMisma hora (no se puede doblar)');
const [mismo] = D.unidades([ev('a', 'MdA', '10:15:00'), ev('b', 'MdL', '10:15:00')]);
ok(D.estadoDe(mismo, [r('a', 'va'), r('b', 'no')], []).texto === 'Vas al MdA · no al MdL', '«va» al MdA y «no» al MdL: «Vas al MdA · no al MdL»');
ok(D.estadoDe(mismo, [r('a', 'va'), r('b', 'va')], []).texto === 'Vas', '«va» a los dos a la misma hora: «Vas»');

console.log('\nResumen por evento tras importar (cotejo con SportEasy)');
{
  const J = (person_id, o = {}) => ({ person_id, nombre_visible: person_id, ficha_mda: true, ficha_mdl: false, entrena: true, activo: true, rol: 'jugador', ...o });
  const jug = [J('a'), J('b'), J('c'), J('d', { ficha_mda: false, ficha_mdl: true }), J('e', { ficha_mda: false, rol: 'solo_entreno' })];
  const entreno = { ...ev('ent', 'ambos', '20:30:00'), tipo: 'entreno', fecha: '2026-10-28', oficial: true };
  const partido = { ...ev('p', 'MdA', '10:15:00'), fecha: '2026-11-01', oficial: true };
  const rs = [
    { evento_id: 'p', person_id: 'a', respuesta: 'va', motivo: null },
    { evento_id: 'p', person_id: 'b', respuesta: 'no', motivo: 'trabajo' },
    { evento_id: 'p', person_id: 'd', respuesta: 'va', motivo: null },
    { evento_id: 'ent', person_id: 'e', respuesta: 'no', motivo: 'lesion' },
    { evento_id: 'ent', person_id: 'a', respuesta: 'duda', motivo: null },
  ];
  const [f1, f2] = resumenCotejo([partido, entreno], jug, rs);
  ok(f1.id === 'ent' && f2.id === 'p', 'ordenado por fecha (el entreno del 28/10 antes que el partido del 1/11)');
  ok(f2.va === 1 && f2.no === 1 && f2.sin_responder === 1 && f2.conMotivo === 1 && f2.fuera === 1, 'partido del MdA: 1 va · 1 no · 1 sin responder, 1 con motivo y 1 respuesta de alguien sin ficha del MdA (aparte)', JSON.stringify(f2));
  ok(textoCotejo(f2) === '1 va · 1 no · 1 sin responder', `texto «${textoCotejo(f2)}»`);
  ok(f1.va === 0 && f1.duda === 1 && f1.no === 1 && f1.sin_responder === 3 && f1.conMotivo === 1 && textoCotejo(f1) === '0 van · 1 no · 1 duda · 3 sin responder', `entreno (todos responden): «${textoCotejo(f1)}»`);
  ok(!JSON.stringify([f1, f2]).includes('trabajo') && !JSON.stringify([f1, f2]).includes('lesion'), 'el resumen no lleva motivos, solo cuántos llevan motivo');
}

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
