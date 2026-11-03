#!/usr/bin/env node
// WhatsApp a quien no ha respondido e Importar teléfonos (D178): lógica pura, sin base ni web.
//   - mensaje al grupo con @ + MOTE (nunca el nombre de contacto) y el plazo de la plataforma;
//   - mensaje individual y enlace wa.me (sin + ni espacios); sin teléfono, sin enlace («Falta teléfono»);
//   - CSV: cabecera, comas o punto y coma, comillas; cruce por contacto y, si no, por mote; lo dudoso sin asignar;
//     teléfono enmascarado; estados nuevo / igual / distinto / sin coincidencia; quién se queda sin teléfono;
//   - ningún texto de error o de motivo lleva un teléfono.
// Teléfonos FALSOS (rango de ficción +34 600 00x xxx), nunca reales.
//
//   npm run pruebas:whatsapp-logica
import * as W from '../src/lib/whatsapp/sinResponder.ts';
import * as I from '../src/lib/whatsapp/importar.ts';
import { limiteDudas } from '../src/lib/avisos/horario.ts';

let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };

console.log('\n== Mensaje al grupo y mensaje individual (entreno del miércoles 04/11, martes 03/11 por la tarde)');
const ent = { tipo: 'entreno', fecha: '2026-11-04', inicio: '20:30:00', oficial: true };
const ev = { tipo: 'entreno', fecha: '2026-11-04', horas: ['20:30'], lugar: 'Valdebernardo', url: 'https://maccabis.example/mi-zona/evento/abc', limite: limiteDudas(ent) };
const martes = new Date('2026-11-03T18:00:00Z');
const grupo = W.mensajeGrupo(['Edu', 'Fernando M.'], ev, martes);
ok(grupo === '@Edu @Fernando M. aún no habéis respondido al entreno del miércoles 4/11 (20:30, Valdebernardo). Responded en la web antes de las 12:00 de mañana: https://maccabis.example/mi-zona/evento/abc', 'grupo: el texto del ejemplo de Iván', grupo);
ok(!/Baloncesto|Amigo/.test(grupo), 'grupo: con el mote, nunca el nombre de contacto');
ok(W.mensajeGrupo(['Edu'], ev, martes).startsWith('@Edu aún no has respondido') && /Responde en la web/.test(W.mensajeGrupo(['Edu'], ev, martes)), 'grupo con uno solo: en singular');
ok(/Responded en la web antes de las 12:00 de hoy/.test(W.mensajeGrupo(['A', 'B'], ev, new Date('2026-11-04T07:00:00Z'))), 'el mismo miércoles por la mañana: «antes de las 12:00 de hoy»');
ok(/Responded en la web cuanto antes/.test(W.mensajeGrupo(['A', 'B'], ev, new Date('2026-11-04T12:00:00Z'))), 'pasado el plazo: «cuanto antes» (sin inventar otro)');
const ind = W.mensajeIndividual('Edu', ev, martes);
ok(ind === 'Hola Edu, aún no has respondido al entreno del miércoles 4/11 (20:30, Valdebernardo). Responde aquí: https://maccabis.example/mi-zona/evento/abc. Tienes hasta mañana a las 12:00.', 'individual: el texto pedido', ind);
const dom = { tipo: 'liga', fecha: '2026-11-08', inicio: '09:00:00', oficial: true };
const evDom = { tipo: 'liga', fecha: '2026-11-08', horas: ['09:00', '11:00'], lugar: 'Antonio Díaz Miguel', url: 'https://maccabis.example/mi-zona/domingo/2026-11-08', limite: limiteDudas(dom) };
const g2 = W.mensajeGrupo(['Jon', 'Wall'], evDom, new Date('2026-11-02T18:00:00Z'));
ok(/al partido del domingo 8\/11 \(09:00 y 11:00, Antonio Díaz Miguel\)/.test(g2) && /antes de las 12:00 de mañana/.test(g2), 'partido: domingo con dos horas; plazo el martes a las 12:00 (D173)', g2);
ok(/antes del martes a las 12:00/.test(W.mensajeGrupo(['Jon'], evDom, new Date('2026-11-01T18:00:00Z'))), 'partido visto el domingo anterior: «antes del martes a las 12:00»');

console.log('\n== Enlace wa.me');
const wa = W.enlaceWa('+34 600 000 001', ind);
ok(wa?.startsWith('https://wa.me/34600000001?text=') && decodeURIComponent(wa.split('text=')[1]) === ind, 'wa.me/<teléfono sin + ni espacios>?text=<mensaje codificado>', wa);
ok(W.enlaceWa('600000001', 'x') === 'https://wa.me/34600000001?text=x' && W.enlaceWa('0054 9 11 0000 0001', 'x') === 'https://wa.me/5491100000001?text=x', 'móvil español sin prefijo y prefijo 00, también');
ok(W.enlaceWa(null, 'x') === null && W.enlaceWa('', 'x') === null && W.enlaceWa('123', 'x') === null, 'sin teléfono (o roto): sin enlace, el botón dice «Falta teléfono»');

console.log('\n== Teléfono internacional y enmascarado');
ok(I.telefonoInternacional('+34 600 000 123') === '+34600000123' && I.telefonoInternacional('0054 9 11 0000-0001') === '+5491100000001', 'normaliza espacios, guiones y 00');
ok(I.telefonoInternacional('600000123') === null && I.telefonoInternacional('+34 abc') === null, 'sin prefijo de país o con letras: no válido');
ok(I.enmascarar('+34 600 000 123') === '+34 6** *** 123', '+34 6** *** 123', I.enmascarar('+34 600 000 123'));
ok(I.enmascarar('+54 9 11 0000 0001') === '+54 9* *** *** 001' && I.enmascarar('basura') === '—', 'otro país y un teléfono roto', I.enmascarar('+54 9 11 0000 0001'));

console.log('\n== CSV y cruce');
const jugadores = [
  { person_id: 'p-edu', nombre_visible: 'Edu', whatsapp_contacto: 'Edu Baloncesto', telefono: null, activo: true },
  { person_id: 'p-fm', nombre_visible: 'Fernando M.', whatsapp_contacto: 'Fernando (Amigo De julio)', telefono: '+34600000002', activo: true },
  { person_id: 'p-jon', nombre_visible: 'Jon', whatsapp_contacto: 'jon Baloncesto', telefono: '+34600000003', activo: true },
  { person_id: 'p-sin', nombre_visible: 'Nuevo', whatsapp_contacto: null, telefono: null, activo: true },
  { person_id: 'p-c1', nombre_visible: 'Carlos', whatsapp_contacto: null, telefono: null, activo: true },
  { person_id: 'p-c2', nombre_visible: 'carlos', whatsapp_contacto: null, telefono: null, activo: true },
  { person_id: 'p-wall', nombre_visible: 'Wall', whatsapp_contacto: 'Víctor Hermano De Raúl Baloncesto', telefono: null, activo: true },
  { person_id: 'p-baja', nombre_visible: 'Baja', whatsapp_contacto: null, telefono: null, activo: false },
  { person_id: 'p-ivan', nombre_visible: 'Iván', whatsapp_contacto: null, telefono: null, activo: true },
];
const csv = [
  'mote;whatsapp_contacto;teléfono;estado',
  'Edu;edu baloncesto;+34 600 000 001;ok',                         // por contacto (sin tildes ni mayúsculas): nuevo
  '"Fernando M.";"Fernando (Amigo De julio)";+34600000009;ok',      // por contacto: distinto al actual
  'Jon;jon Baloncesto;+34 600 000 003;',                            // igual
  'Nuevo;Nuevo Contacto;+34600000004;',                             // por mote: nuevo (y se guarda el contacto)
  'Carlos;Carlos X;+34600000005;',                                  // mote de dos jugadores: dudosa
  'Fantasma;Nadie;+34600000006;',                                   // sin coincidencia
  'Wall;Otro Contacto Distinto;+34600000007;',                      // encaja por mote pero ya tiene otro contacto: dudosa
  'Edu;Edu Baloncesto;+34600000008;repetido',                       // Edu otra vez: las dos filas, sin asignar
  'Roto;Roto;612345678;',                                           // sin prefijo: no válido
].join('\r\n');
const { filas, error } = I.leerCsv('﻿' + csv);
ok(!error && filas.length === 9 && filas[1].mote === 'Fernando M.' && filas[0].estado === 'ok', 'lee el CSV (BOM, punto y coma, comillas, «teléfono» con tilde)', error ?? JSON.stringify(filas[1]));
ok(I.leerCsv('mote,telefono\nEdu,+34600000001').error?.includes('whatsapp_contacto'), 'sin una columna: dice cuál falta');
const rev = I.revisar(filas, jugadores);
const de = (linea) => rev.find((r) => r.linea === linea);
ok(de(3).person_id === 'p-fm' && de(3).estado === 'distinto' && de(3).por === 'contacto', 'Fernando M.: por contacto, «Distinto al actual»');
ok(de(4).person_id === 'p-jon' && de(4).estado === 'igual', 'Jon: «Igual»');
ok(de(5).person_id === 'p-sin' && de(5).estado === 'nuevo' && de(5).por === 'mote' && de(5).contacto === 'Nuevo Contacto', 'Nuevo: por mote, «Nuevo», con su contacto');
ok(!de(6).person_id && /dudosa/.test(de(6).motivo), 'Carlos (dos jugadores con ese mote): dudosa, sin asignar');
ok(!de(7).person_id && de(7).estado === 'sin_coincidencia', 'Fantasma: «Sin coincidencia»');
ok(!de(8).person_id && /otro contacto/.test(de(8).motivo), 'Wall por mote pero con otro contacto guardado: dudosa, sin asignar');
ok(!de(2).person_id && !de(9).person_id && /varias filas/.test(de(2).motivo), 'Edu en dos filas: ninguna se asigna');
ok(!de(10).person_id && /no válido/.test(de(10).motivo), 'sin prefijo de país: no válido, sin asignar');
ok(de(3).enmascarado === '+34 6** *** 009' && rev.every((r) => !/\d{6,}/.test(JSON.stringify({ ...r, enmascarado: '' }))), 'la revisión solo lleva el teléfono enmascarado (ningún otro campo con un número largo)');
const guardar = I.aGuardar(filas, jugadores);
ok(JSON.stringify(guardar.map((g) => g.person_id).sort()) === JSON.stringify(['p-fm', 'p-sin']), 'se guardarían solo Fernando M. (distinto) y Nuevo (nuevo): ni las «Igual» ni las dudosas', JSON.stringify(guardar.map((g) => g.person_id)));
ok(guardar.find((g) => g.person_id === 'p-sin').telefono === '+34600000004', 'y en formato internacional, sin espacios');
const sin = I.quedanSinTelefono(filas, jugadores);
ok(JSON.stringify(sin) === JSON.stringify(['Edu', 'Carlos', 'carlos', 'Wall', 'Iván']), 'se quedan sin teléfono: los activos sin teléfono ni fila asignada (no los de baja)', JSON.stringify(sin));

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTODO OK');
process.exit(fallos ? 1 : 0);
