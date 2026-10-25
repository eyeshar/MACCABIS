#!/usr/bin/env node
// Estado de un domingo con dos partidos para el jugador (lib/respuestas/dominio.ts), sin base de datos: manda la
// respuesta de CADA partido (importada de SportEasy o puesta por un gestor), no solo la del domingo.
// Caso real (J3, 25/10/2026): «va» al MdA y «no» al MdL salía «Vas a los dos» en el inicio.
//
//   npm run pruebas:respuestas-dominio

import * as D from '../src/lib/respuestas/dominio.ts';

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

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
