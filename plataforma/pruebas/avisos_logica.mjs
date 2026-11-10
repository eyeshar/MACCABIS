#!/usr/bin/env node
// Recordatorios y horas de silencio (D99.6, D99.7, D155: 22:30–08:00) con la HORA FIJA SIMULADA, sin base de datos:
//   lunes agrupado · día del plazo a las 09:00 (D173) · aviso del cierre · amistoso al crearlo y 24 h antes ·
//   silencio y excepción de menos de 12 h · cambio de hora del 25/10/2026 · ausencia que cuenta como respondido ·
//   «sin recordatorios» · textos de los avisos (sin motivos, niveles ni posiciones) ·
//   el aviso «no va (por defecto)» al propio jugador (D152): único, y nunca si respondió, está ausente o no está invitado.
//
//   npm run pruebas:avisos-logica

import * as H from '../src/lib/avisos/horario.ts';
import * as P from '../src/lib/avisos/planificador.ts';
import * as T from '../src/lib/avisos/textos.ts';
import * as CM from '../src/lib/convocatoria/mensajes.ts';
import * as MA from '../src/lib/gestion/mensajesActivacion.ts';

let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };
const M = (f, h) => H.madrid(f, h);
const iso = (t) => t.toISOString();

// ---------------------------------------------------------------- datos de prueba (como los reales de octubre)
const SITIO = 'Antonio Díaz Miguel, pista 3';
const ev = (id, tipo, equipo, fecha, inicio, fin, extra = {}) => ({
  id, tipo, equipo, fecha, inicio, fin, quedada: inicio ? H.enMadrid(new Date(M(fecha, inicio).getTime() - 20 * 60000)).hora : null,
  titulo: null, sitio: SITIO, estado: 'programado', sin_recordatorios: false, creado_en: '2026-10-01T10:00:00Z', ...extra,
});
const entreno14 = ev('e14', 'entreno', 'ambos', '2026-10-14', '20:00', '22:00');
const mdaJ2 = ev('mda2', 'liga', 'MdA', '2026-10-18', '10:15', null, { sitio: 'Moratalaz, pista 2' });
const mdlJ2 = ev('mdl2', 'liga', 'MdL', '2026-10-18', '10:15', null, { sitio: 'Moratalaz, pista 1' });
const entreno21 = ev('e21', 'entreno', 'ambos', '2026-10-21', '20:30', '22:30', { sitio: 'pista por confirmar' });
const mdaJ3 = ev('mda3', 'liga', 'MdA', '2026-10-25', '09:00', null);
const mdlJ3 = ev('mdl3', 'liga', 'MdL', '2026-10-25', '14:00', null);
const entreno28 = ev('e28', 'entreno', 'ambos', '2026-10-28', '20:30', '22:30');
const BASE = [entreno14, mdaJ2, mdlJ2, entreno21, mdaJ3, mdlJ3, entreno28];
const jug = (person_id, ficha_mda, ficha_mdl, entrena = true) => ({ person_id, ficha_mda, ficha_mdl, entrena, activo: true });
const JUG = [jug('jon', true, true), jug('guille', true, false), jug('edimil', false, false), { ...jug('baja', true, true), activo: false }];
const datos = (ahora, extra = {}) => ({ ahora, eventos: BASE, jugadores: JUG, respuestas: [], ausencias: [], ...extra });
const de = (avisos, p) => avisos.filter((a) => a.person_id === p);

console.log('\n== Horas de Madrid y cambio de hora del domingo 25/10/2026');
ok(iso(M('2026-10-20', '10:00')) === '2026-10-20T08:00:00.000Z', 'martes 20/10 a las 10:00 (verano) = 08:00 UTC');
ok(iso(M('2026-10-26', '19:00')) === '2026-10-26T18:00:00.000Z', 'lunes 26/10 a las 19:00 (ya en invierno) = 18:00 UTC');
ok(iso(M('2026-10-25', '09:00')) === '2026-10-25T08:00:00.000Z' && iso(M('2026-10-25', '14:00')) === '2026-10-25T13:00:00.000Z', 'domingo 25/10: 09:00 y 14:00 ya en hora de invierno');
ok(iso(M('2026-10-25', '02:30')) === '2026-10-25T00:30:00.000Z', 'las 02:30 del 25/10 ocurren dos veces: se toma la primera');
ok(H.enMadrid(new Date('2026-10-25T01:30:00Z')).hora === '02:30', 'y la segunda también existe (01:30 UTC = 02:30 de invierno)');
ok(iso(M('2027-03-28', '02:30')) === '2027-03-28T01:30:00.000Z', 'las 02:30 del 28/03/2027 no existen: se leen como las 03:30');
ok(iso(H.finDelSilencio(new Date('2026-10-24T21:00:00Z'))) === '2026-10-25T07:00:00.000Z', 'silencio del sábado 24 a las 23:00: termina el domingo a las 08:00 de invierno (07:00 UTC)');
const sabado23 = M('2026-10-24', '23:00');
ok(iso(H.horaDeEnvio(sabado23, M('2026-10-25', '10:30'))) === '2026-10-25T07:00:00.000Z', 'evento el domingo 25 a las 10:30: de reloj son 11 h 30, pero con la hora de más son 12 h 30 reales → espera a las 08:00');
ok(iso(H.horaDeEnvio(sabado23, M('2026-10-25', '09:30'))) === iso(sabado23), 'evento a las 09:30: 11 h 30 reales → sale al momento');
ok(!H.enSilencio(M('2026-10-25', '08:00')) && H.enSilencio(M('2026-10-25', '07:59')) && H.enSilencio(M('2026-10-24', '22:30')) && !H.enSilencio(M('2026-10-24', '22:29')), 'el silencio va de 22:30 a 08:00 (08:00 ya no; 22:30 ya sí)');

console.log('\n== Franja de noche (D155, Iván 31/10/2026): en el momento salvo de 22:30 a 08:00 de Madrid, que sale a las 08:00');
// Sin evento cercano (null): la regla tal cual. La hora es la de Madrid del instante, nunca la del servidor (UTC en Vercel).
const envio = (f, h) => H.horaDeEnvio(M(f, h), null);
ok(iso(envio('2026-10-31', '17:09')) === iso(M('2026-10-31', '17:09')) && iso(M('2026-10-31', '17:09')) === '2026-10-31T16:09:00.000Z', '17:09 del sábado 31/10 (el «Aplicar y avisar» de la J5 MdA) → sale ya');
ok(iso(envio('2026-10-31', '22:29')) === iso(M('2026-10-31', '22:29')), '22:29 → sale ya');
ok(iso(envio('2026-10-31', '22:31')) === iso(M('2026-11-01', '08:00')) && iso(envio('2026-10-31', '22:31')) === '2026-11-01T07:00:00.000Z', '22:31 → a las 08:00 del día siguiente (07:00 UTC en invierno)');
ok(iso(envio('2026-11-01', '07:59')) === iso(M('2026-11-01', '08:00')), '07:59 → a las 08:00 de ese mismo día');
ok(iso(envio('2026-11-01', '08:00')) === iso(M('2026-11-01', '08:00')), '08:00 → sale ya');
ok(iso(envio('2026-10-31', '00:15')) === iso(M('2026-10-31', '08:00')), '00:15 → a las 08:00 de ese día (de madrugada)');
// Si se usara la hora UTC del servidor, en invierno las 22:45 de Madrid (21:45 UTC) saldrían al momento y las 08:30 de
// Madrid (07:30 UTC) esperarían: se comprueban los dos lados.
ok(iso(H.horaDeEnvio(new Date('2026-11-02T21:45:00Z'), null)) === iso(M('2026-11-03', '08:00')), 'invierno: 21:45 UTC son las 22:45 de Madrid → espera a las 08:00');
ok(iso(H.horaDeEnvio(new Date('2026-11-03T07:30:00Z'), null)) === '2026-11-03T07:30:00.000Z', 'invierno: 07:30 UTC son las 08:30 de Madrid → sale ya');
// Cambio de hora de otoño (domingo 25/10/2026, 03:00 → 02:00): un caso a cada lado.
ok(iso(envio('2026-10-24', '22:31')) === '2026-10-25T07:00:00.000Z', 'otoño, antes del cambio: sábado 24 a las 22:31 (verano, 20:31 UTC) → domingo 25 a las 08:00 de invierno (07:00 UTC)');
ok(iso(envio('2026-10-25', '22:31')) === '2026-10-26T07:00:00.000Z' && iso(M('2026-10-25', '22:31')) === '2026-10-25T21:31:00.000Z', 'otoño, después: domingo 25 a las 22:31 (invierno, 21:31 UTC) → lunes 26 a las 08:00 (07:00 UTC)');
ok(iso(envio('2026-10-24', '22:29')) === '2026-10-24T20:29:00.000Z' && iso(envio('2026-10-26', '07:59')) === '2026-10-26T07:00:00.000Z', 'otoño: 22:29 de verano sale ya; 07:59 de invierno espera a las 08:00');
// Cambio de hora de primavera (domingo 28/03/2027, 02:00 → 03:00): un caso a cada lado.
ok(iso(envio('2027-03-27', '22:31')) === '2027-03-28T06:00:00.000Z', 'primavera, antes del cambio: sábado 27/03 a las 22:31 (invierno, 21:31 UTC) → domingo 28 a las 08:00 de verano (06:00 UTC)');
ok(iso(envio('2027-03-28', '22:31')) === '2027-03-29T06:00:00.000Z' && iso(envio('2027-03-28', '08:00')) === '2027-03-28T06:00:00.000Z', 'primavera, después: domingo 28 a las 22:31 → lunes 29 a las 08:00 (06:00 UTC); a las 08:00 de verano sale ya');
ok(H.textoSale(M('2026-11-01', '08:00')) === 'de noche: sale el 01/11 a las 08:00', 'el texto de gestión dice cuándo sale de verdad (no un 08:30 fijo)');

console.log('\n== Lunes 19:00: un solo aviso por jugador con todo lo que le falta');
let a = P.planificar(datos(M('2026-10-12', '19:05')));
const jon = de(a, 'jon');
ok(jon.length === 1 && jon[0].titulo === 'Te faltan 2 respuestas' && jon[0].cuerpo === 'Entreno del miércoles 14 y partido del domingo 18. Toca para responder.', 'Jon (dos fichas): «Te faltan 2 respuestas» / «Entreno del miércoles 14 y partido del domingo 18. Toca para responder.» (el domingo con dos partidos cuenta una vez)', JSON.stringify(jon));
ok(jon[0].url === '/' && jon[0].eventos.length === 3 && jon[0].clave === 'rec:lunes:2026-10-12:jon', 'abre su inicio (D117) y lleva los 3 eventos; clave única por lunes y jugador');
ok(de(a, 'edimil').length === 1 && de(a, 'edimil')[0].titulo === 'Te falta 1 respuesta' && de(a, 'edimil')[0].url === '/mi-zona/evento/e14', 'quien solo entrena: «Te falta 1 respuesta», abre el entreno');
ok(de(a, 'baja').length === 0, 'a quien está de baja no le llega nada');
ok(iso(jon[0].programado_para) === '2026-10-12T17:00:00.000Z', 'sale a las 19:00 de Madrid');
ok(P.planificar(datos(M('2026-10-12', '18:55'))).length === 0, 'a las 18:55 todavía nada');
ok(P.planificar(datos(M('2026-10-12', '22:05'))).filter((x) => x.clave.startsWith('rec:lunes')).length === 0, 'pasado el margen (3 h) ya no sale: no se manda un lunes atrasado');
a = P.planificar(datos(M('2026-10-12', '19:20'), { respuestas: [{ evento_id: 'e14', person_id: 'jon', respuesta: 'va' }] }));
ok(de(a, 'jon')[0].titulo === 'Te falta 1 respuesta' && de(a, 'jon')[0].url === '/mi-zona/domingo/2026-10-18', 'si ya respondió al entreno, solo le falta el domingo (y abre el domingo)');
a = P.planificar(datos(M('2026-10-12', '19:20'), { respuestas: [{ evento_id: 'mda2', person_id: 'jon', respuesta: 'va' }] }));
ok(de(a, 'jon')[0].titulo === 'Te faltan 2 respuestas', 'con un partido respondido y el otro no, el domingo sigue faltando');

console.log('\n== Día del plazo a las 09:00 (D173): UN aviso a quien no ha respondido o sigue en «duda»; ya no hay martes 10:00 ni miércoles 10:00');
const dd = (ahora, extra = {}) => P.conAvisosDeDudas(P.planificar(datos(ahora, extra)), datos(ahora, extra));
const claveD = (a, p) => a.find((x) => x.person_id === p && x.clave.startsWith('rec:dudas:'));
a = P.planificar(datos(M('2026-10-13', '10:05')));
ok(!a.some((x) => x.clave.startsWith('rec:martes')) && !P.planificar(datos(M('2026-10-14', '10:05'))).some((x) => x.clave.startsWith('rec:dia')), 'el recordatorio del martes a las 10:00 y el del miércoles a las 10:00 ya no existen');
a = dd(M('2026-10-13', '09:05'));
const gp = claveD(a, 'guille');
ok(gp && gp.titulo === 'Domingo 18: responde hasta hoy a las 12:00' && gp.cuerpo === 'Tienes hasta hoy a las 12:00 para decir si vas; si no, te quedas fuera de la convocatoria.', 'martes 13/10 a las 09:05: Guillermo (sin responder) recibe «Tienes hasta hoy a las 12:00 para decir si vas; si no, te quedas fuera de la convocatoria»', JSON.stringify(gp));
ok(gp && gp.url === '/mi-zona/evento/mda2' && iso(gp.programado_para) === iso(M('2026-10-13', '09:00')), 'sale a las 09:00 y abre su partido');
ok(de(a, 'jon').length === 1 && claveD(a, 'jon').url === '/mi-zona/domingo/2026-10-18' && claveD(a, 'jon').eventos.sort().join() === 'mda2,mdl2', 'Jon (dos fichas): UN aviso por el domingo (los dos partidos), que abre el domingo');
ok(!de(a, 'edimil').length, 'quien no tiene ficha no recibe el del partido');
a = dd(M('2026-10-13', '09:05'), { respuestas: [{ evento_id: 'mda2', person_id: 'jon', respuesta: 'duda' }, { evento_id: 'mdl2', person_id: 'jon', respuesta: 'duda' }] });
ok(de(a, 'jon').length === 1 && /Tienes hasta hoy a las 12:00 para decir si vas/.test(claveD(a, 'jon').cuerpo), 'con «duda» a los dos partidos: el mismo aviso único (sustituye al de las 12:00 de D141)');
a = dd(M('2026-10-13', '09:05'), { respuestas: [{ evento_id: 'mda2', person_id: 'guille', respuesta: 'va' }, { evento_id: 'mda2', person_id: 'jon', respuesta: 'no' }, { evento_id: 'mdl2', person_id: 'jon', respuesta: 'no' }] });
ok(!de(a, 'guille').length && !de(a, 'jon').length, 'quien ya dijo «voy» o «no voy» no recibe nada');
ok(!dd(M('2026-10-13', '08:55')).some((x) => x.clave.startsWith('rec:dudas')), 'a las 08:55 todavía nada');
ok(!dd(M('2026-10-13', '12:00')).some((x) => x.clave.startsWith('rec:dudas') && x.eventos.includes('mda2')), 'a las 12:00 (el plazo) ya no sale');
ok(claveD(dd(M('2026-10-13', '09:20')), 'guille').clave === gp.clave && claveD(dd(M('2026-10-13', '11:50')), 'guille').clave === gp.clave, 'la clave es la misma en cada pasada (la tarea no lo duplica)');
// Entreno del miércoles: su plazo es el miércoles a las 12:00 y su aviso, ese miércoles a las 09:00.
a = dd(M('2026-10-14', '09:05'));
const ej = claveD(a, 'jon');
ok(ej && ej.titulo === 'Entreno del miércoles 14: responde hasta hoy a las 12:00' && ej.cuerpo === 'Tienes hasta hoy a las 12:00 para decir si vas al entreno (20:00).' && ej.url === '/mi-zona/evento/e14', 'miércoles 14 a las 09:05: «Entreno del miércoles 14: responde hasta hoy a las 12:00» (sin hablar de convocatoria)', JSON.stringify(ej));
a = dd(M('2026-10-14', '09:05'), { respuestas: [{ evento_id: 'e14', person_id: 'jon', respuesta: 'duda' }] });
ok(/si sigues en «duda», contarás como «no va»/.test(claveD(a, 'jon').cuerpo), 'con «duda» al entreno, avisa de que pasará a «no va»');
ok(!dd(M('2026-10-13', '09:05')).some((x) => x.eventos.includes('e14')), 'el martes no se le avisa del entreno (su plazo es el miércoles)');
// Un entreno de otro día (no tiene plazo semanal): el mismo día a las 10:00 como siempre.
const juevesE = ev('e15', 'entreno', 'ambos', '2026-10-15', '20:00', '22:00');
ok(P.planificar(datos(M('2026-10-15', '10:05'), { eventos: [juevesE] })).some((x) => x.clave === 'rec:dia:e15:jon'), 'un entreno en jueves sigue con su aviso del mismo día a las 10:00');
// Se junta con cualquier otro aviso de ese día.
const amHoy = ev('amx', 'amistoso', 'ambos', '2026-10-17', '11:00', '13:00', { titulo: 'Contra los de Vallecas', creado_en: M('2026-10-13', '08:30').toISOString() });
a = dd(M('2026-10-13', '09:05'), { eventos: [...BASE, amHoy] });
const gj = de(a, 'guille');
ok(gj.length === 1 && gj[0].clave.startsWith('rec:dudas:') && iso(gj[0].programado_para) === iso(M('2026-10-13', '08:30')) && /Además: Nuevo amistoso «Contra los de Vallecas»: ¿vas\?$/.test(gj[0].cuerpo), 'si ese día ya salía otro aviso (un amistoso creado a las 08:30), sale UNO solo con «Además: …», a la hora del primero', JSON.stringify(gj));
// Cambio de hora: octubre (verano → invierno) y marzo (invierno → verano), a cada lado.
ok(iso(H.avisoDePlazo(H.limiteDudas(mdaJ3))) === '2026-10-20T07:00:00.000Z' && iso(H.avisoDePlazo(H.limiteDudas(entreno28))) === '2026-10-28T08:00:00.000Z', 'octubre: martes 20/10 a las 09:00 de verano (07:00 UTC); miércoles 28/10 a las 09:00 de invierno (08:00 UTC)');
const marzo1 = ev('m1', 'liga', 'MdA', '2027-03-28', '10:15', null), marzo2 = ev('m2', 'liga', 'MdA', '2027-04-04', '10:15', null);
ok(iso(H.limiteDudas(marzo1)) === '2027-03-23T11:00:00.000Z' && iso(H.limiteDudas(marzo2)) === '2027-03-30T10:00:00.000Z', 'marzo: la jornada del 28/03 cierra el martes 23/03 a las 12:00 de invierno (11:00 UTC); la del 04/04, el martes 30/03 a las 12:00 de verano (10:00 UTC)');
ok(iso(H.avisoDePlazo(H.limiteDudas(marzo1))) === '2027-03-23T08:00:00.000Z' && iso(H.avisoDePlazo(H.limiteDudas(marzo2))) === '2027-03-30T07:00:00.000Z', 'y sus avisos, a las 09:00 de cada lado (08:00 y 07:00 UTC)');

console.log('\n== Al cierre del partido (martes 12:00, D173): aviso a quien sigue sin responder; su respuesta no se toca');
a = P.avisosCierre(datos(M('2026-10-13', '12:05'), { respuestas: [{ evento_id: 'mda2', person_id: 'guille', respuesta: 'va' }] }));
const cj = de(a, 'jon');
ok(cj.length === 1 && cj[0].clave === 'rec:cierre:2026-10-18:jon' && cj[0].titulo === 'Domingo 18: no has respondido' && cj[0].cuerpo === 'No has respondido: no entras en la propuesta de convocatoria. Si puedes jugar, di «voy» cuanto antes.' && cj[0].url === '/mi-zona/domingo/2026-10-18', 'Jon (sin responder a ningún partido): UN aviso «No has respondido: no entras en la propuesta de convocatoria…»', JSON.stringify(cj));
ok(!de(a, 'guille').length && !de(a, 'edimil').length, 'a quien dijo «voy» o no tiene ficha, nada');
ok(!de(P.avisosCierre(datos(M('2026-10-13', '12:05'), { respuestas: [{ evento_id: 'mda2', person_id: 'jon', respuesta: 'duda' }] })), 'jon').length, 'quien estaba en «duda» no recibe este (recibe el de «tu duda ha pasado a no va»)');
ok(!P.avisosCierre(datos(M('2026-10-13', '11:55'))).length && !P.avisosCierre(datos(M('2026-10-13', '15:05'))).length, 'antes de las 12:00 nada; pasado el margen de 3 h, tampoco');
ok(!de(P.avisosCierre(datos(M('2026-10-13', '12:05'), { ausencias: [{ person_id: 'jon', desde: '2026-10-17', hasta: '2026-10-19' }] })), 'jon').length, 'con una ausencia que cubre el domingo, nada');
ok(!P.avisosCierre(datos(M('2026-10-14', '12:05'))).some((x) => x.eventos.includes('e14')), 'el entreno no tiene aviso de cierre');

console.log('\n== Lateral de Gestión: calendario de recordatorios');
ok(P.calendarioRecordatorios(entreno14).map((h) => h.tipo).join() === 'lunes,plazo' && P.calendarioRecordatorios(entreno14).map((h) => H.enMadrid(h.envio).hora).join() === '19:00,09:00', 'entreno del miércoles: lunes 19:00 y el miércoles a las 09:00');
ok(P.calendarioRecordatorios(mdaJ3).map((h) => h.tipo).join() === 'lunes,plazo,cierre' && P.calendarioRecordatorios(mdaJ3).map((h) => H.enMadrid(h.envio).hora).join() === '19:00,09:00,12:00', 'partido: lunes 19:00, martes 09:00 y el cierre del martes a las 12:00');

console.log('\n== Amistoso, torneo o «entre nosotros»: al crearlo y 24 h antes');
const amistoso = ev('am', 'amistoso', 'ambos', '2026-10-17', '11:00', '13:00', { titulo: 'Contra los de Vallecas', creado_en: M('2026-10-15', '12:00').toISOString() });
a = P.planificar(datos(M('2026-10-15', '12:05'), { eventos: [amistoso] }));
ok(a.length === 2 && a.every((x) => x.titulo === 'Nuevo amistoso «Contra los de Vallecas»: ¿vas?' && x.cuerpo === 'Sábado 17, 11:00 (encuentro 10:40) en Antonio Díaz Miguel, pista 3. Aún no has respondido.'), 'al crearlo: a los 2 invitados con ficha (un amistoso es un partido: quien solo entrena no está invitado)', JSON.stringify(a[0]));
a = P.planificar(datos(M('2026-10-16', '11:00'), { eventos: [amistoso] }));
ok(a.length === 2 && a.every((x) => x.titulo.startsWith('Mañana: amistoso') && x.clave.startsWith('rec:24h:am:')), '24 h antes: «Mañana: amistoso…»');
const delMdA = { ...amistoso, id: 'am2', equipo: 'MdA', tipo: 'torneo' };
ok(P.planificar(datos(M('2026-10-16', '11:00'), { eventos: [delMdA] })).map((x) => x.person_id).sort().join() === 'guille,jon', 'un torneo solo del MdA, solo a las fichas del MdA');
const atrasado = { ...amistoso, creado_en: '2026-10-09T10:00:00Z' };
ok(!P.planificar(datos(new Date('2026-10-10T08:05:00Z'), { eventos: [atrasado] })).some((x) => x.clave.startsWith('rec:creado')), 'un «al crearlo» que no salió en su margen (3 h) no se manda atrasado al día siguiente');

console.log('\n== Horas de silencio (22:30–8:00) y la excepción de menos de 12 horas');
const tarde = { ...amistoso, id: 'am3', creado_en: M('2026-10-15', '22:45').toISOString() };
ok(!P.planificar(datos(M('2026-10-15', '22:50'), { eventos: [tarde] })).length, 'creado a las 22:45: de noche no sale');
a = P.planificar(datos(M('2026-10-16', '08:01'), { eventos: [tarde] }));
ok(a.filter((x) => x.clave.startsWith('rec:creado')).length === 2 && iso(a[0].programado_para) === iso(M('2026-10-16', '08:00')), 'sale a las 08:00');
const urgente = { ...amistoso, id: 'am4', fecha: '2026-10-16', inicio: '09:00', creado_en: M('2026-10-15', '23:00').toISOString() };
a = P.planificar(datos(M('2026-10-15', '23:05'), { eventos: [urgente] }));
ok(a.filter((x) => x.clave.startsWith('rec:creado')).length === 2, 'creado a las 23:00 para mañana a las 09:00 (menos de 12 h): sale al momento');
const amDST = { ...amistoso, id: 'am5', fecha: '2026-10-25', inicio: '10:30', creado_en: M('2026-10-24', '23:00').toISOString() };
ok(!P.planificar(datos(M('2026-10-24', '23:05'), { eventos: [amDST] })).length, 'noche del cambio de hora: creado el sábado 24 a las 23:00 para el domingo a las 10:30 (12 h 30 reales) → espera');
a = P.planificar(datos(new Date('2026-10-25T07:01:00Z'), { eventos: [amDST] }));
ok(a.filter((x) => x.clave.startsWith('rec:creado')).length === 2 && H.enMadrid(a[0].programado_para).hora === '08:00', 'y sale a las 08:00 de invierno del domingo');
a = P.planificar(datos(M('2026-10-26', '19:02')));
ok(de(a, 'jon').some((x) => x.clave === 'rec:lunes:2026-10-26:jon' && iso(x.programado_para) === '2026-10-26T18:00:00.000Z'), 'el lunes después del cambio, a las 19:00 de invierno (18:00 UTC)');

console.log('\n== Ausencias, «sin recordatorios» y cancelados');
const aus = [{ person_id: 'jon', desde: '2026-10-13', hasta: '2026-10-19', borrada_en: null }];
a = P.planificar(datos(M('2026-10-12', '19:05'), { ausencias: aus }));
ok(!de(a, 'jon').length, 'una ausencia que cubre los dos eventos cuenta como respondido: a Jon no le llega nada');
a = P.planificar(datos(M('2026-10-12', '19:05'), { ausencias: [{ person_id: 'jon', desde: '2026-10-15', hasta: null }] }));
ok(de(a, 'jon')[0]?.titulo === 'Te falta 1 respuesta', 'una ausencia «sin fecha de vuelta» desde el jueves cubre el domingo pero no el miércoles');
a = P.planificar(datos(M('2026-10-12', '19:05'), { ausencias: [{ ...aus[0], borrada_en: '2026-10-11T10:00:00Z' }] }));
ok(de(a, 'jon')[0]?.titulo === 'Te faltan 2 respuestas', 'una ausencia borrada ya no cuenta');
a = P.planificar(datos(M('2026-10-14', '10:00'), { eventos: BASE.map((e) => (e.id === 'e14' ? { ...e, sin_recordatorios: true } : e)) }));
ok(!a.length, '«Sin recordatorios para este evento»: nada');
a = P.planificar(datos(M('2026-10-14', '10:00'), { eventos: BASE.map((e) => (e.id === 'e14' ? { ...e, estado: 'cancelado' } : e)) }));
ok(!a.length, 'evento cancelado: nada');
const claves = P.planificar(datos(M('2026-10-12', '19:05'))).map((x) => x.clave);
ok(new Set(claves).size === claves.length && JSON.stringify(claves) === JSON.stringify(P.planificar(datos(M('2026-10-12', '19:10'))).map((x) => x.clave)), 'las claves son únicas y repetir la tarea a los 5 minutos da las mismas (el registro no duplica)');

console.log('\n== Textos de cambios, cancelaciones, prueba y gestores');
const tc = T.textoCambio(entreno14, 'va', false);
ok(tc.titulo === 'Cambio en el entreno del miércoles 14' && tc.cuerpo === 'Antonio Díaz Miguel, pista 3, de 20:00 a 22:00 (encuentro 19:40). Sigues en «Voy»: si ya no puedes, cámbialo.', '«Cambio en el entreno del miércoles 14» / «Antonio Díaz Miguel, pista 3, de 20:00 a 22:00 (encuentro 19:40). Sigues en «Voy»: si ya no puedes, cámbialo.»', JSON.stringify(tc));
ok(T.textoCambio({ ...entreno14, fecha: '2026-10-15' }, 'sin_responder', true).cuerpo.endsWith('Vuelve a responder.'), 'cambio de día: pide responder de nuevo');
const tx = T.textoCancelacion(entreno14);
ok(tx.titulo === 'Se cancela el entreno del miércoles 14' && tx.cuerpo === 'No hace falta que hagas nada.', '«Se cancela el entreno del miércoles 14» / «No hace falta que hagas nada.»');
const tg = T.textoGestores('Jon', mdaJ3, 'va', 'no');
ok(tg.titulo === 'Jon cambia el partido del domingo 25 (MdA)' && /«Voy» a «No voy»/.test(tg.cuerpo), 'a los gestores: nombre y respuesta, sin motivo');
const todos = [
  ...P.planificar(datos(M('2026-10-12', '19:05'))), ...dd(M('2026-10-13', '09:05')), ...dd(M('2026-10-14', '09:05')),
  ...P.avisosCierre(datos(M('2026-10-13', '12:05'))), tc, tx, tg, T.TEXTO_PRUEBA,
];
ok(!todos.some((x) => /lesi[oó]n|trabajo|viaje|familia|horario|nivel|posici|base|alero|p[ií]vot|exterior|interior/i.test(`${x.titulo} ${x.cuerpo}`)), `ningún texto de aviso lleva motivos, niveles ni posiciones (${todos.length} revisados)`);

// ---------------------------------------------------------------- quién responde (D105): una sola definición
{
  const con = (x) => ({ ...x, rol: x.rol ?? 'jugador' });
  const carlos = con({ ...jug('carlos', false, false), rol: 'entrenador' });
  const solo = con({ ...jug('fernando', true, true), rol: 'solo_entreno' });       // «solo entreno» con ficha: nunca a partidos
  const todosJ = [...JUG.map((x) => con(x.person_id === 'edimil' ? { ...x, rol: 'solo_entreno' } : x)), carlos, solo];  // edimil: «solo entreno» sin ficha
  const ids = (e) => P.invitados(e, todosJ).map((j) => j.person_id).join();
  ok(ids(entreno14) === 'jon,guille,edimil,fernando', 'entreno: todos menos el entrenador y los de baja', ids(entreno14));
  ok(!ids(entreno14).includes('carlos') && !ids(mdaJ3).includes('carlos') && !ids(mdlJ3).includes('carlos'), 'Carlos (entrenador) no responde a nada');
  ok(ids(mdaJ3) === 'jon,guille' && ids(mdlJ3) === 'jon', 'partidos: su ficha, y sin «solo entreno» aunque tenga ficha', `${ids(mdaJ3)} / ${ids(mdlJ3)}`);
  ok(ids(entreno14).includes('fernando') && ids(entreno14).includes('edimil'), '«solo entreno» sí entra en los entrenos');
  ok(P.planificar(datos(M('2026-10-12', '19:05'), { jugadores: todosJ })).every((a) => !['carlos'].includes(a.person_id)), 'ningún recordatorio sale para Carlos');
  const lunes = P.planificar(datos(M('2026-10-12', '19:05'), { jugadores: todosJ })).find((a) => a.person_id === 'fernando');
  ok(lunes && !lunes.eventos.some((id) => ['mda2', 'mdl2', 'mda3', 'mdl3'].includes(id)), 'a un «solo entreno» el recordatorio del lunes solo le habla de entrenos');
}

console.log('\n== Aviso de convocatoria (D127): a quien toca y sin dobles');
{
  const PART = [
    { equipo: 'MdA', rival: 'Rival', es_local: true, inicio: '09:00', encuentro: '08:40', sitio: 'CDM Moratalaz, pista 2', direccion: null, lineaEquipacion: 'Jugamos de negro (ellos de rojo). Llevad la amarilla por si acaso.' },
    { equipo: 'MdL', rival: 'Otro', es_local: false, inicio: '14:00', encuentro: '13:40', sitio: 'CDM Moratalaz, pista 1', direccion: null, lineaEquipacion: 'Coinciden colores: cambiamos nosotros, de amarillo. Llevad la amarilla por si acaso.' },
  ];
  const t1 = CM.textoEstasConvocado('2026-10-25', PART, ['MdA']);
  ok(t1.titulo === 'Estás convocado · domingo 25/10' && t1.cuerpo === 'MdA a las 09:00 (quedada 08:40). Jugamos de negro (ellos de rojo). Llevad la amarilla por si acaso.', '«Estás convocado · domingo 25/10» / «MdA a las 09:00 (quedada 08:40).» + la línea de equipación (D160)', JSON.stringify(t1));
  const t2 = CM.textoEstasConvocado('2026-10-25', PART, ['MdA', 'MdL']);
  ok(t2.cuerpo === 'MdA a las 09:00 (quedada 08:40) y MdL a las 14:00 (quedada 13:40). MdA: Jugamos de negro (ellos de rojo). MdL: Coinciden colores: cambiamos nosotros, de amarillo. Llevad la amarilla por si acaso.', 'dobla: cada equipo con su línea de equipación y «Llevad la amarilla por si acaso.» una vez (D160)', t2.cuerpo);
  const conv = { MdA: [{ person_id: 'jon' }, { person_id: 'guille' }], MdL: [{ person_id: 'jon' }, { person_id: 'ana' }] };
  let d = CM.destinatariosAviso(conv, null);
  ok(!d.cambio && d.personas.map((p) => p.person_id).sort().join() === 'ana,guille,jon' && d.personas.find((p) => p.person_id === 'jon').equipos.join() === 'MdA,MdL', 'primer envío: a todos los convocados (Jon con sus dos equipos)');
  d = CM.destinatariosAviso(conv, conv);
  ok(d.cambio && d.personas.length === 0, 'sin cambios desde lo avisado: a nadie (no hay dobles)');
  const despues = { MdA: [{ person_id: 'jon' }, { person_id: 'ana' }], MdL: [{ person_id: 'jon' }, { person_id: 'luis' }] };
  d = CM.destinatariosAviso(despues, conv);
  const de = (id) => d.personas.find((p) => p.person_id === id);
  ok(d.cambio && d.personas.length === 3 && de('ana').equipos.join() === 'MdA' && de('luis').equipos.join() === 'MdL' && de('guille').equipos.length === 0 && !de('jon'), 'cambio tras enviar: a quien cambia (Ana pasa, Luis entra, Guille sale), no a Jon');
  const tc = CM.textoCambioConvocatoria('2026-10-25', PART, ['MdA']);
  ok(tc.titulo === 'Cambio en la convocatoria · domingo 25/10' && tc.cuerpo === 'Entras en la convocatoria del MdA · 09:00, quedada 08:40. Jugamos de negro (ellos de rojo). Llevad la amarilla por si acaso.', 'quien entra (D173): «Entras en la convocatoria del MdA · 09:00, quedada 08:40.» + equipación', JSON.stringify(tc));
  ok(CM.textoCambioConvocatoria('2026-10-25', PART, ['MdL'], ['MdA']).cuerpo.startsWith('Ahora vas con el MdL · 14:00, quedada 13:40.'), 'quien cambia de equipo: «Ahora vas con el MdL…»');
  ok(CM.textoCambioConvocatoria('2026-10-25', PART, []).cuerpo === 'Ya no estás convocado este domingo.', 'quien sale: «Ya no estás convocado este domingo.»');
  ok(CM.firmaConvocatoria(conv) === CM.firmaConvocatoria({ MdL: [{ person_id: 'ana' }, { person_id: 'jon' }], MdA: [{ person_id: 'guille' }, { person_id: 'jon' }] }) && CM.firmaConvocatoria(conv) !== CM.firmaConvocatoria(despues), 'la firma de la clave única no depende del orden y cambia si cambia la convocatoria');
  const todos = [t1, t2, tc].map((x) => `${x.titulo} ${x.cuerpo}`).join(' ');
  ok(!/nivel|posici|motivo|exterior|interior|Dobla/i.test(todos), 'sin niveles, posiciones ni motivos en la pantalla de bloqueo');
  // Silencio (D99.7): aprobada y enviada el viernes a las 23:00, el aviso del domingo a las 09:00 espera a las 08:00 del
  // sabado; el sabado a las 23:30, con el partido a menos de 12 h reales, sale al momento.
  ok(iso(H.horaDeEnvio(M('2026-10-23', '23:00'), M('2026-10-25', '09:00'))) === iso(M('2026-10-24', '08:00')), 'respeta el silencio: el viernes a las 23:00 sale el sábado a las 08:00');
  ok(iso(H.horaDeEnvio(M('2026-10-24', '23:30'), M('2026-10-25', '09:00'))) === iso(M('2026-10-24', '23:30')), 'y con el partido a menos de 12 h, sale al momento');
}


// ---------------------------------------------------------------- D141 + D173: plazo de respuesta y dudas
console.log('\n== Plazo (D173): martes 12:00 el partido del domingo, miércoles 12:00 el entreno del miércoles; 24 h para lo demás');
const lim = (e) => H.limiteDudas(e);
ok(iso(lim(mdaJ2)) === '2026-10-13T10:00:00.000Z' && iso(lim(mdlJ2)) === iso(lim(mdaJ2)), 'partidos del domingo 18: el martes 13/10 a las 12:00 (10:00 UTC, verano)');
ok(iso(lim(entreno14)) === '2026-10-14T10:00:00.000Z', 'entreno del miércoles 14: ese miércoles a las 12:00 (antes, el martes a las 20:00)');
ok(iso(lim(mdaJ3)) === '2026-10-20T10:00:00.000Z' && iso(lim(mdlJ3)) === iso(lim(mdaJ3)), 'semana del cambio de hora: la J3 del 25/10 cierra el martes 20/10 a las 12:00 (verano)');
ok(iso(lim(entreno28)) === '2026-10-28T11:00:00.000Z', 'entreno del 28/10: miércoles 28/10 a las 12:00 (invierno = 11:00 UTC)');
const amis = ev('a1', 'amistoso', 'ambos', '2026-10-17', '17:00', '19:00');
ok(iso(lim(amis)) === iso(M('2026-10-16', '17:00')), 'amistoso del sábado a las 17:00: 24 h antes (viernes 17:00), sin cambios');
ok(iso(lim(ev('a2', 'amistoso', 'ambos', '2026-10-25', '10:00', null))) === iso(M('2026-10-24', '11:00')), '24 h son 24 horas de reloj aunque el 25/10 vuelva atrás una hora: sábado 24/10 a las 11:00');
ok(iso(lim({ ...entreno14, oficial: false })) === iso(new Date(M('2026-10-14', '20:00').getTime() - 24 * 3600 * 1000)), 'un plan no oficial, aunque sea en miércoles: 24 h antes');
ok(iso(lim(ev('e15', 'entreno', 'ambos', '2026-10-15', '20:00', '22:00'))) === iso(M('2026-10-14', '20:00')), 'un entreno de jueves: 24 h antes');
ok(iso(lim(ev('t1', 'torneo', 'ambos', '2026-11-08', '09:00', '14:00'))) === iso(M('2026-11-07', '09:00')) && iso(lim(ev('i1', 'interno', 'ambos', '2026-10-21', '20:30', '22:30'))) === iso(M('2026-10-20', '20:30')), 'torneo y «entre nosotros»: 24 h antes');
ok(H.dudaAbierta(mdaJ2, M('2026-10-13', '11:59')) && !H.dudaAbierta(mdaJ2, M('2026-10-13', '12:00')) && H.dudaAbierta(entreno14, M('2026-10-14', '11:59')) && !H.dudaAbierta(entreno14, M('2026-10-14', '12:00')), 'abierta hasta las 12:00 en punto (martes el partido, miércoles el entreno); después, cerrada');
ok(H.textoLimite(lim(mdaJ2), M('2026-10-10', '12:00')) === 'el martes a las 12:00' && H.textoLimite(lim(mdaJ2), M('2026-10-01', '12:00')) === 'el martes 13 a las 12:00', 'texto del plazo: «el martes a las 12:00» (con el número si falta más de cinco días)');
ok(H.textoLimite(lim(mdaJ2), M('2026-10-13', '09:05')) === 'hoy a las 12:00' && H.textoLimite(lim(entreno14), M('2026-10-13', '09:05')) === 'mañana a las 12:00', '«hoy a las 12:00» / «mañana a las 12:00»');
ok(H.plazoSemanal(entreno14) === 'entreno' && H.plazoSemanal(mdaJ2) === 'partido' && H.plazoSemanal(juevesE) === null && H.plazoSemanal({ ...entreno14, oficial: false }) === null && H.plazoSemanal(amis) === null, 'qué tiene plazo semanal: entreno oficial del miércoles y partido de liga');

console.log('\n== «Duda» en los demás eventos (D141, sin cambios): aviso a las 12:00 del día del límite');
ok(iso(H.avisoDeDudas(M('2026-10-16', '20:00'))) === iso(M('2026-10-16', '12:00')), 'límite a las 20:00: aviso a las 12:00 del mismo día');
ok(iso(H.avisoDeDudas(M('2026-10-16', '10:00'))) === iso(M('2026-10-16', '09:00')), 'límite temprano (10:00): una hora antes, a las 09:00');
ok(H.avisoDeDudas(M('2026-10-16', '08:45')) === null && iso(H.avisoDeDudas(M('2026-10-16', '09:00'))) === iso(M('2026-10-16', '08:00')) && iso(H.avisoDeDudas(M('2026-10-16', '09:45'))) === iso(M('2026-10-16', '08:45')), 'límite a las 08:45: no cabe fuera del silencio (sin aviso previo); a las 09:00, a las 08:00; a las 09:45, a las 08:45');
const duda = (ev_, p) => ({ evento_id: ev_, person_id: p, respuesta: 'duda' });
ok(!claveD(dd(M('2026-10-13', '09:05'), { respuestas: [duda('mda2', 'jon'), duda('mdl2', 'jon')], eventos: BASE.map((e) => ({ ...e, sin_recordatorios: true })) }), 'jon'), '«Sin recordatorios»: nada');
ok(!claveD(dd(M('2026-10-13', '09:05'), { respuestas: [duda('mda2', 'jon')], eventos: BASE.map((e) => ({ ...e, estado: 'cancelado' })) }), 'jon'), 'cancelado: nada');
const amis2 = ev('a3', 'amistoso', 'ambos', '2026-10-17', '10:00', '12:00', { titulo: 'Amistoso con Vallecas', creado_en: '2026-10-01T10:00:00Z' });
a = dd(M('2026-10-16', '09:05'), { eventos: [...BASE, amis2], respuestas: [duda('a3', 'jon')] });
ok(iso(claveD(a, 'jon').programado_para) === iso(M('2026-10-16', '09:00')) && claveD(a, 'jon').titulo === 'Tienes «duda»: confirma hasta hoy a las 10:00', 'amistoso del sábado a las 10:00: límite el viernes a las 10:00, aviso a las 09:00');
a = dd(M('2026-10-16', '09:05'), { eventos: [...BASE, amis2], respuestas: [] });
ok(!claveD(a, 'jon'), 'en un amistoso, a quien no ha respondido no le llega este aviso (solo a las «duda»)');
const plan = ev('p1', 'quedada', 'ambos', '2026-10-17', '19:00', '21:00', { titulo: 'Cena', oficial: false, creado_en: '2026-10-01T10:00:00Z' });
a = dd(M('2026-10-16', '12:05'), { eventos: [...BASE, plan], respuestas: [duda('p1', 'jon')] });
ok(claveD(a, 'jon') && a.filter((x) => x.person_id === 'jon').length === 1, 'un plan en «duda» recibe su aviso (viernes 12:00)');
const textosPlazo = [...dd(M('2026-10-13', '09:05')), ...dd(M('2026-10-14', '09:05')), ...P.avisosCierre(datos(M('2026-10-13', '12:05')))].map((x) => `${x.titulo} ${x.cuerpo}`).join(' ');
ok(!/nivel|posici|exterior|interior|Dobla|lesi|trabajo|viaje|familia|reserva/i.test(textosPlazo), 'los avisos del plazo y del cierre no llevan motivos, niveles, posiciones ni «reserva»');

console.log('\n== Paso automático a «no va» y su aviso');
const sis = (ev_, p, cuando = '2026-10-13T10:00:20Z') => ({ evento_id: ev_, person_id: p, respuesta: 'no', motivo: 'no_confirmo', origen: 'sistema', cambiado_en: cuando });
const pas = P.avisosPasoNoVa({ eventos: BASE, respuestas: [sis('mda2', 'jon'), sis('mdl2', 'jon')] }, M('2026-10-13', '12:05'));
ok(pas.length === 1 && pas[0].person_id === 'jon' && pas[0].titulo === 'Tu «duda» ha pasado a «no va»' && /partido del domingo 18/.test(pas[0].cuerpo), 'un aviso por persona y límite (los dos partidos del domingo, juntos), con lo que pasó a «no va»', JSON.stringify(pas));
const pasE = P.avisosPasoNoVa({ eventos: BASE, respuestas: [sis('e14', 'jon', '2026-10-14T10:00:20Z'), sis('mda2', 'jon', '2026-10-13T12:00:00Z')] }, M('2026-10-14', '12:05'));
ok(pasE.length === 2, 'el entreno (plazo el miércoles) y el partido (el martes) tienen límites distintos: dos avisos, uno por límite');
ok(pas[0].cuerpo.includes('Si al final puedes, entra y pon «Voy»') && !/motivo|nivel|posici/i.test(pas[0].cuerpo), 'invita a volver a decir «Voy»; sin motivos en la pantalla de bloqueo');
ok(P.avisosPasoNoVa({ eventos: BASE, respuestas: [sis('mda2', 'jon')] }, M('2026-10-13', '12:30'))[0].clave === P.avisosPasoNoVa({ eventos: BASE, respuestas: [sis('mda2', 'jon')] }, M('2026-10-13', '12:45'))[0].clave, 'la clave es estable: repetir la tarea no lo duplica');
ok(!P.avisosPasoNoVa({ eventos: BASE, respuestas: [{ ...sis('e14', 'jon'), respuesta: 'va', motivo: null, origen: 'jugador' }] }, M('2026-10-13', '12:05')).length, 'quien ya volvió a decir «Voy» no recibe el aviso');
ok(!P.avisosPasoNoVa({ eventos: BASE, respuestas: [sis('e14', 'jon', '2026-10-10T18:00:20Z')] }, M('2026-10-13', '12:05')).length, 'un paso de hace más de 24 h ya no se avisa');
ok(!P.avisosPasoNoVa({ eventos: BASE, respuestas: [{ ...sis('e14', 'jon'), motivo: 'trabajo', origen: 'jugador' }] }, M('2026-10-13', '12:05')).length, 'solo avisa de lo que cerró el sistema');
// Silencio: el límite de un amistoso de las 23:00 cierra a las 23:00 del día anterior; el aviso espera a las 08:00.
const am23 = ev('a4', 'amistoso', 'ambos', '2026-10-18', '23:00', '23:59');
const pas2 = P.avisosPasoNoVa({ eventos: [am23], respuestas: [sis('a4', 'jon', iso(M('2026-10-17', '23:05')))] }, M('2026-10-17', '23:10'));
ok(pas2.length === 1 && iso(pas2[0].programado_para) === iso(M('2026-10-18', '08:00')), 'el paso a las 23:05 (horas de silencio) se avisa a las 08:00 del día siguiente', iso(pas2[0]?.programado_para ?? new Date(0)));
const am08 = ev('a5', 'amistoso', 'ambos', '2026-10-18', '07:30', '10:00');
const pas3 = P.avisosPasoNoVa({ eventos: [am08], respuestas: [sis('a5', 'jon', iso(M('2026-10-17', '07:35')))] }, M('2026-10-17', '07:40'));
ok(pas3.length === 1 && iso(pas3[0].programado_para) === iso(M('2026-10-17', '08:00')), 'el paso a las 07:35 (silencio, evento a 24 h) se avisa a las 08:00', iso(pas3[0]?.programado_para ?? new Date(0)));
const textosN = [T.textoDudas([{ que: 'entreno del miércoles 14', limite: lim(entreno14) }], ['Domingo 18: aún no has respondido']), T.textoPasoNoVa(['entreno del miércoles 14'])].map((x) => `${x.titulo} ${x.cuerpo}`).join(' ');
ok(!/nivel|posici|exterior|interior|Dobla|lesi|trabajo|viaje|familia/i.test(textosN), 'los textos no llevan motivos, niveles ni posiciones');

// ---------------------------------------------------------------- alarma de la tarea (dos pasadas seguidas con error)
import * as AL from '../src/lib/avisos/alarma.ts';
const t0 = M('2026-10-28', '12:50');
const pasadasT = (...c) => c.map((codigo, i) => ({ codigo, creado: new Date(t0.getTime() - i * 15 * 60000).toISOString() }));
ok(AL.problemaTarea(pasadasT(200, 200, 200), t0) === null, 'alarma: todo 200, nada');
ok(AL.problemaTarea(pasadasT(401, 200, 200), t0) === null, 'alarma: una sola pasada con error no avisa');
ok(/401 y 401/.test(AL.problemaTarea(pasadasT(401, 401, 200), t0) ?? ''), 'alarma: dos 401 seguidos, avisa y dice el codigo');
ok(/500 y sin respuesta/.test(AL.problemaTarea(pasadasT(500, null), t0) ?? ''), 'alarma: 500 y falta de respuesta, avisa');
ok(AL.problemaTarea(pasadasT(200, 200), new Date(t0.getTime() + 60 * 60000)) !== null, 'alarma: una hora sin pasar, avisa');
ok(AL.problemaTarea([], t0) === null, 'alarma: sin historial (pila local o pg_net vacio), no inventa nada');
ok(AL.estadoSalud(new Date(t0.getTime() - 10 * 60000).toISOString(), t0) === 'ok', 'salud: última pasada correcta hace 10 minutos, ok');
ok(AL.estadoSalud(new Date(t0.getTime() - 41 * 60000).toISOString(), t0) === 'fallando', 'salud: hace 41 minutos, fallando');
ok(AL.estadoSalud(null, t0) === 'fallando', 'salud: ninguna pasada correcta, fallando');
const hace10 = new Date(t0.getTime() - 10 * 60000).toISOString();
// El 04/11/2026: 500 sueltos de Vercel entre pasadas buenas (7 de 17); la regla de los 40 minutos no saltaba.
ok(AL.estadoSalud(hace10, t0, pasadasT(200, 500, 200, 500)) === 'fallando', 'salud: 2 pasadas con error en la última hora, aunque haya buenas entre medias, fallando');
ok(AL.estadoSalud(hace10, t0, pasadasT(200, 500, 200, 200)) === 'ok', 'salud: un solo error en la hora, ok');
ok(AL.estadoSalud(hace10, t0, pasadasT(200, null, 200, 401)) === 'fallando', 'salud: sin respuesta (null) y un 401 cuentan como error');
ok(AL.erroresUltimaHora(pasadasT(200, 200, 200, 200, 200, 500, 500), t0) === 0, 'salud: los errores de hace más de una hora no cuentan');
ok(AL.estadoSalud(hace10, t0, []) === 'ok', 'salud: sin las pasadas de la hora (migración sin aplicar), solo la regla de los 40 minutos');

console.log('\n== Disponibilidad por defecto (D146): «no suele entrenar» y «solo entreno: nunca a partidos»');
{
  // Sintéticos (D39): «nse» no suele entrenar (ficha del MdA), «nap» nunca a partidos (las dos fichas, rol jugador).
  const NSE = { ...jug('nse', true, false), marcas: { no_suele_entrenar: true, nunca_partidos: false } };
  const NAP = { ...jug('nap', true, true), marcas: { no_suele_entrenar: false, nunca_partidos: true } };
  const conMarcas = (ahora, extra = {}) => datos(ahora, { jugadores: [...JUG, NSE, NAP], ...extra });
  let r = P.planificar(conMarcas(M('2026-10-12', '19:05')));
  ok(de(r, 'nse').length === 1 && de(r, 'nse')[0].titulo === 'Te falta 1 respuesta' && de(r, 'nse')[0].url === '/mi-zona/domingo/2026-10-18', 'lunes: a quien no suele entrenar solo le falta el partido (el entreno no cuenta)', JSON.stringify(de(r, 'nse')));
  ok(de(r, 'nap').length === 1 && de(r, 'nap')[0].url === '/mi-zona/evento/e14' && de(r, 'nap')[0].eventos.join() === 'e14', 'lunes: a «nunca a partidos» solo le falta el entreno', JSON.stringify(de(r, 'nap')));
  ok(de(r, 'jon').length === 1 && de(r, 'jon')[0].titulo === 'Te faltan 2 respuestas', 'sin marca, todo igual que antes');
  const conDudas = (d) => P.conAvisosDeDudas(P.planificar(d), d);
  r = conDudas(conMarcas(M('2026-10-14', '09:05')));
  ok(de(r, 'nse').length === 0, 'entreno, el miércoles a las 09:00 (D173): a quien no suele entrenar y no ha respondido no le llega nada (por defecto, no va)');
  ok(de(r, 'nap').length === 1 && de(r, 'jon').length === 1, 'y a «nunca a partidos» y a quien no tiene marca, sí');
  r = conDudas(conMarcas(M('2026-10-14', '09:05'), { quitados: [{ evento_id: 'e14', person_id: 'nse' }] }));
  ok(de(r, 'nse').length === 1 && de(r, 'nse')[0].clave.startsWith('rec:dudas:') && de(r, 'nse')[0].eventos.join() === 'e14', 'si un gestor se lo quita para ese entreno (vuelve a «sin responder»), le llega el aviso del plazo');
  r = conDudas(conMarcas(M('2026-10-21', '09:05'), { quitados: [{ evento_id: 'e14', person_id: 'nse' }] }));
  ok(de(r, 'nse').length === 0, 'quitárselo en un entreno no vale para el siguiente');
  r = conDudas(conMarcas(M('2026-10-13', '09:05')));
  ok(de(r, 'nse').length === 1 && de(r, 'nse')[0].eventos.join() === 'mda2', 'en un partido la marca «no suele entrenar» no cuenta: le llega el del martes a las 09:00');
  ok(de(r, 'nap').length === 0, 'martes del partido: a «nunca a partidos» no le llega (no cuenta como pendiente)');
  const sinNada = { respuestas: [], ausencias: [] };
  ok(P.pendienteDe(NSE, entreno14, sinNada) === false && P.pendienteDe(NSE, mdaJ2, sinNada) === true, 'pendienteDe: «no suele entrenar», entreno no, partido sí');
  ok(P.pendienteDe(NSE, entreno14, { respuestas: [{ evento_id: 'e14', person_id: 'nse', respuesta: 'va' }], ausencias: [] }) === false, 'si respondió, ya no está pendiente (manda su respuesta)');
  ok(P.pendienteDe(NAP, mdaJ2, sinNada) === false && P.pendienteDe(NAP, entreno14, sinNada) === true, 'pendienteDe: «nunca a partidos», partido no, entreno sí');
  ok(P.pendienteDe({ person_id: 'jon' }, entreno14, sinNada) === true && P.pendienteDe({ person_id: 'jon' }, mdaJ2, sinNada) === true, 'pendienteDe sin marcas: como siempre');
}


console.log('\n== Aviso «no va (por defecto)» al propio jugador (D152)');
{
  // Sintéticos (D39): «nse» y «nse2» no suelen entrenar; «nsesf» tampoco y no tiene ficha (fuera de un entreno «solo con ficha»).
  const M1 = { no_suele_entrenar: true, nunca_partidos: false };
  const NSE = { ...jug('nse', true, false), marcas: M1 };
  const NSE2 = { ...jug('nse2', false, true), marcas: M1 };
  const NSESF = { ...jug('nsesf', false, false), marcas: M1 };
  const conMarcas = (ahora, extra = {}) => datos(ahora, { jugadores: [...JUG, NSE, NSE2, NSESF], ...extra });
  const lunes = M('2026-10-12', '19:05');
  const pd = (d) => P.avisosPorDefecto(d);
  let r = pd(conMarcas(lunes));
  const suyo = de(r, 'nse');
  ok(suyo.length === 1 && suyo[0].titulo === 'Entreno del miércoles 14: no vas' && suyo[0].cuerpo === 'Te hemos puesto que no vas al entreno del miércoles 14. Si vienes, cámbialo aquí.', 'lunes 19:00: UN aviso «Te hemos puesto que no vas al entreno del miércoles 14. Si vienes, cámbialo aquí.»', JSON.stringify(suyo));
  ok(suyo[0]?.clave === 'rec:defecto:e14:nse' && suyo[0].url === '/mi-zona/evento/e14' && suyo[0].eventos.join() === 'e14' && iso(suyo[0].programado_para) === '2026-10-12T17:00:00.000Z', 'clave única por entreno y persona, abre el entreno y sale a las 19:00 de Madrid');
  ok(de(r, 'jon').length === 0 && de(r, 'edimil').length === 0 && r.every((x) => x.person_id.startsWith('nse')), 'a quien no tiene la marca no le llega este aviso');
  ok(!/suele|marca|defecto/i.test(r.map((x) => x.titulo + x.cuerpo).join(' ')), 'el texto no nombra la marca (lo ve la pantalla de bloqueo)');
  ok(pd(conMarcas(M('2026-10-12', '18:55'))).length === 0 && pd(conMarcas(M('2026-10-12', '22:05'))).length === 0, 'antes de las 19:00 nada, y pasado el margen tampoco');
  ok(pd(conMarcas(M('2026-10-14', '09:05'))).length === 0, 'el día del entreno no se repite (solo el lunes)');
  const otraVez = pd(conMarcas(M('2026-10-12', '19:20')));
  ok(de(otraVez, 'nse').map((x) => x.clave).join() === 'rec:defecto:e14:nse', 'la tarea 15 minutos después da la MISMA clave: el registro (clave única) no lo vuelve a mandar');
  const movido = { ...entreno14, fecha: '2026-10-21' };
  ok(de(pd(conMarcas(M('2026-10-19', '19:05'), { eventos: [movido] })), 'nse')[0]?.clave === 'rec:defecto:e14:nse', 'si el entreno cambia de semana, la clave es la misma: nunca se repite');
  ok(de(pd(conMarcas(M('2026-10-19', '19:05'))), 'nse').map((x) => x.clave).join() === 'rec:defecto:e21:nse', 'uno por entreno: el de la semana siguiente es otro aviso');
  // Los tres casos sin aviso (y los de alrededor)
  r = pd(conMarcas(lunes, { respuestas: [{ evento_id: 'e14', person_id: 'nse', respuesta: 'va' }, { evento_id: 'e14', person_id: 'nse2', respuesta: 'no' }] }));
  ok(de(r, 'nse').length === 0 && de(r, 'nse2').length === 0, 'sin aviso si ya respondió («voy» o «no voy»)');
  r = pd(conMarcas(lunes, { respuestas: [{ evento_id: 'e14', person_id: 'nse', respuesta: 'duda' }] }));
  ok(de(r, 'nse').length === 0 && de(r, 'nse2').length === 1, 'ni con «duda»; a los demás sí');
  r = pd(conMarcas(lunes, { ausencias: [{ person_id: 'nse', desde: '2026-10-13', hasta: '2026-10-15' }, { person_id: 'nse2', desde: '2026-10-01', hasta: null }] }));
  ok(de(r, 'nse').length === 0 && de(r, 'nse2').length === 0, 'sin aviso si tiene una ausencia que cubre el día (también sin fecha de vuelta)');
  r = pd(conMarcas(lunes, { ausencias: [{ person_id: 'nse', desde: '2026-10-13', hasta: '2026-10-15', borrada_en: '2026-10-11T10:00:00Z' }] }));
  ok(de(r, 'nse').length === 1, 'una ausencia borrada no cuenta');
  const fichaE = { ...entreno14, solo_con_ficha_en: 'Valdebernardo' };
  r = pd(conMarcas(lunes, { eventos: [fichaE] }));
  ok(de(r, 'nsesf').length === 0 && de(r, 'nse').length === 1, 'sin aviso si no está invitado (entreno «solo con ficha» y sin ficha); con ficha, sí');
  ok(de(pd(conMarcas(lunes)), 'nsesf').length === 1, 'en un entreno sin esa regla, el que no tiene ficha sí lo recibe');
  r = pd(conMarcas(lunes, { quitados: [{ evento_id: 'e14', person_id: 'nse' }] }));
  ok(de(r, 'nse').length === 0 && de(P.planificar(conMarcas(lunes, { quitados: [{ evento_id: 'e14', person_id: 'nse' }] })), 'nse')[0]?.eventos.includes('e14'), 'si un gestor se lo quitó para ese entreno, no: le llega el «te falta» de siempre');
  ok(pd(conMarcas(lunes, { eventos: [{ ...entreno14, sin_recordatorios: true }, { ...mdaJ2 }] })).length === 0, 'ni en un entreno «sin recordatorios», ni en un partido');
  ok(pd(conMarcas(lunes, { eventos: [{ ...entreno14, estado: 'cancelado' }, { ...entreno14, id: 'eplan', oficial: false }] })).length === 0, 'ni cancelado, ni en un plan no oficial');
  const base = P.planificar(conMarcas(lunes));
  ok(de(base, 'nse').length === 1 && !de(base, 'nse')[0].eventos.includes('e14') && base.every((x) => !x.clave.startsWith('rec:defecto')), 'el «te faltan» del lunes sigue sin el entreno y no lleva el aviso por defecto');
}
// ---------------------------------------------------------------- mensajes de la tarjeta «Avisos y accesos» (D156)
console.log('\== Mensajes para copiar: singular / plural y la noche según D155');
{
  const W = 'https://maccabis.vercel.app';
  const a1 = MA.mensajeSinAvisos(['Fernando'], W), aN = MA.mensajeSinAvisos(['Fernando', 'Luis'], W);
  ok(/^Hola, Fernando: aún no has activado los avisos/.test(a1) && /Así te llega/.test(a1) && !/tenéis|os llega/.test(a1), 'sin avisos, una persona: singular («has activado», «te llega»)', a1);
  ok(/^Hola, Fernando, Luis: aún no tenéis activados/.test(aN) && /Así os llega/.test(aN), 'sin avisos, varias: plural');
  ok(a1.includes('(de noche solo si el partido es en pocas horas)') && aN.includes('(de noche solo si el partido es en pocas horas)') && !/nunca de noche/.test(a1 + aN), 'sin «nunca de noche»: «de noche solo si el partido es en pocas horas»');
  ok(a1.endsWith(`${W}/avisos`), 'lleva el enlace a /avisos');
  const e1 = MA.mensajeFaltanEntrar(['Fernando'], W), eN = MA.mensajeFaltanEntrar(['Fernando', 'Luis'], W);
  ok(/aún no has entrado/.test(e1) && /Entra una vez con tu correo/.test(e1) && !/habéis|Entrad/.test(e1), 'faltan por entrar, una persona: «aún no has entrado… Entra una vez»');
  ok(/aún no habéis entrado/.test(eN) && /Entrad una vez/.test(eN), 'faltan por entrar, varias: plural');
  const p1 = MA.mensajePidieronNoEntraron(['Fernando'], W), pN = MA.mensajePidieronNoEntraron(['Fernando', 'Luis'], W);
  ok(p1 === `Hola, Fernando: te llegó el correo pero no llegaste a entrar. Pide el código otra vez en ${W}/entrar y escribe los 6 números.`, 'lo pidieron y no terminaron, una persona: singular', p1);
  ok(/^Hola, Fernando, Luis: os llegó el correo pero no llegasteis a entrar\. Pedid el código otra vez en .+\/entrar y escribid los 6 números\.$/.test(pN), 'lo pidieron y no terminaron, varias: plural', pN);
}


console.log('\n== Aviso al aprobar (D173): un solo aviso por jugador, según su caso; y los avisos a gestores');
{
  const PART = [
    { equipo: 'MdA', rival: 'Rival', es_local: true, inicio: '10:15', encuentro: '09:55', sitio: 'CDM Moratalaz, pista 2', direccion: null, lineaEquipacion: 'Jugamos de negro (ellos de rojo). Llevad la amarilla por si acaso.' },
    { equipo: 'MdL', rival: 'Otro', es_local: false, inicio: '11:30', encuentro: '11:10', sitio: 'CDM Moratalaz, pista 1', direccion: null, lineaEquipacion: 'Coinciden colores: cambiamos nosotros, de amarillo. Llevad la amarilla por si acaso.' },
  ];
  const t1 = CM.textoAvisoConvocatoria('2026-11-15', PART, ['MdL'], ['MdA', 'MdL']);
  ok(t1.titulo === 'Estás convocado · domingo 15/11' && t1.cuerpo === 'Estás convocado con el MdL (no con el MdA) · 11:30, quedada 11:10. Coinciden colores: cambiamos nosotros, de amarillo. Llevad la amarilla por si acaso.', 'disponible para los dos y convocado en uno: «Estás convocado con el MdL (no con el MdA) · 11:30, quedada 11:10.» + equipación', JSON.stringify(t1));
  const t2 = CM.textoAvisoConvocatoria('2026-11-15', PART, ['MdA'], ['MdA']);
  ok(t2.cuerpo === 'MdA a las 10:15 (quedada 09:55). Jugamos de negro (ellos de rojo). Llevad la amarilla por si acaso.' && t2.titulo === 'Estás convocado · domingo 15/11', 'convocado en el único al que podía ir: el «Estás convocado» de siempre', JSON.stringify(t2));
  const t3 = CM.textoAvisoConvocatoria('2026-11-08', [PART[1]], [], ['MdL']);
  ok(t3.cuerpo === 'Esta vez no entras en la convocatoria: somos muchos para un solo partido. Gracias por estar disponible, cuenta contigo para el siguiente.', 'dijo «voy» y no entra, domingo con un solo partido: «Esta vez no entras… somos muchos para un solo partido…»', t3.cuerpo);
  ok(/somos muchos este domingo/.test(CM.textoAvisoConvocatoria('2026-11-15', PART, [], ['MdA']).cuerpo), 'con dos partidos: «somos muchos este domingo»');
  ok(CM.textoAvisoConvocatoria('2026-11-15', PART, ['MdA', 'MdL'], ['MdA', 'MdL']).cuerpo.startsWith('MdA a las 10:15 (quedada 09:55) y MdL a las 11:30'), 'dobla: el de siempre, con los dos partidos');
  const conv = { MdA: [{ person_id: 'jon' }], MdL: [{ person_id: 'ana' }] };
  const disp = new Map([['jon', ['MdA', 'MdL']], ['ana', ['MdL']], ['luis', ['MdL']]]);
  const d = CM.destinatariosAviso(conv, null, disp);
  ok(!d.cambio && d.personas.map((x) => x.person_id).join() === 'jon,ana,luis' && d.personas.find((x) => x.person_id === 'luis').equipos.length === 0, 'al aprobar: a los convocados y a quien dijo «voy» y no entra (Luis)');
  ok(CM.textoParaPersona('2026-11-15', PART, false, d.personas[0]).cuerpo.startsWith('Estás convocado con el MdA (no con el MdL)'), 'Jon, disponible para los dos: «con el MdA (no con el MdL)»');
  ok(CM.destinatariosAviso(conv, conv, disp).personas.length === 0, 'tras aprobar, sin cambios: a nadie (tampoco a Luis otra vez)');
  const avisosJug = [t1, t2, t3].map((x) => `${x.titulo} ${x.cuerpo}`).join(' ');
  ok(!/nivel|reserva|posici|exterior|interior|base|Dobla/i.test(avisosJug), 'ni niveles ni la marca «reserva» en los avisos a jugadores (F)');
  // A los gestores
  const r9 = { total: 9, bases: { puros: 2, reserva: 0, estado: 'ok' }, exteriores: { n: 4, estado: 'ok' }, interiores: { n: 3, estado: 'minimo' } };
  const rOk = { total: 9, bases: { puros: 2, reserva: 0, estado: 'ok' }, exteriores: { n: 3, estado: 'ok' }, interiores: { n: 4, estado: 'ok' } };
  const r6 = { total: 6, bases: { puros: 2, reserva: 0, estado: 'ok' }, exteriores: { n: 2, estado: 'mal' }, interiores: { n: 2, estado: 'mal' } };
  const pl = CM.textoPropuestaLista('2026-11-15', [{ equipo: 'MdA', recuento: rOk }, { equipo: 'MdL', recuento: r9 }]);
  ok(pl.titulo === 'Convocatoria del domingo 15/11 lista' && pl.cuerpo === 'MdA 9 · MdL 9 · 1 aviso (MdL con 3 interiores). Revísala y apruébala.', '«Convocatoria del domingo 15/11 lista» · «MdA 9 · MdL 9 · 1 aviso (MdL con 3 interiores)»', JSON.stringify(pl));
  const pm = CM.textoPropuestaLista('2026-11-15', [{ equipo: 'MdA', recuento: rOk }, { equipo: 'MdL', recuento: r6 }]);
  ok(pm.cuerpo === 'MdA 9 · MdL 6 · MdL: 6 de 7, faltan exteriores e interiores. Revísala y apruébala.' || pm.cuerpo === 'MdA 9 · MdL 6 · MdL: 6 de 7, faltan exteriores y interiores. Revísala y apruébala.', 'por debajo de un mínimo: «MdL: 6 de 7, faltan … interiores»', pm.cuerpo);
  const tb = CM.textoBaja('Jon', 'MdA', '2026-11-15', 'Fernando M.');
  ok(tb.cuerpo === 'Sale Jon (MdA). Propuesta: entra Fernando M. Toca para elegir.', 'baja: «Sale Jon (MdA). Propuesta: entra Fernando M.»', tb.cuerpo);
  ok(/Sin recambio propuesto/.test(CM.textoBaja('Jon', 'MdA', '2026-11-15', null).cuerpo), 'sin recambio: lo dice');
  ok(/Ana dice «voy» y el MdL: 6 de 7/.test(CM.textoVoyTardio('Ana', '2026-11-15', ['el MdL: 6 de 7']).cuerpo), '«voy» tardío con un equipo bajo mínimos');
  ok(/19:00|12:00/.test(CM.textoSinAprobar('2026-11-15', false).cuerpo) && /Cualquiera de los tres/.test(CM.textoSinAprobar('2026-11-15', true).cuerpo), 'sin aprobar: a las 19:00 a Iván y a las 21:00 a los tres');
  const gest = [pl, pm, tb, CM.textoSinAprobar('2026-11-15', true), CM.textoCalendarioRompe('2026-11-15', 'Jon dobla y ahora los dos partidos son a la misma hora', 'sale del MdL, entra Ana')].map((x) => `${x.titulo} ${x.cuerpo}`).join(' ');
  ok(!/nivel|\b[A-E][+-]?\b(?= )|«Dobla»/.test(gest.replace(/MdA|MdL/g, '')), 'los avisos a gestores llevan el aviso de línea, nunca niveles');
  const wa = CM.mensajeFaltan('2026-11-15', ['Luis', 'Ana']);
  ok(/^Hola, Luis y Ana: nos faltan jugadores para el domingo 15\/11/.test(wa) && wa.endsWith('/mi-zona/domingo/2026-11-15') && !/nivel|reserva/i.test(wa), 'WhatsApp para quien no ha respondido cuando faltan jugadores', wa);
  ok(CM.textoAvisados(14, 16) === 'Avisados 14 de 16 (los otros 2 no tienen avisos)' && CM.textoAvisados(1, 2) === 'Avisados 1 de 2 (el otro no tiene avisos)' && CM.textoAvisados(3, 3) === 'Avisados 3 de 3', '«Avisados N de M (los otros M−N no tienen avisos)»');
}


console.log('\n== Domingo con la convocatoria YA APROBADA (D173): sin aviso de las 09:00 ni del cierre para sus partidos; el entreno, sí');
{
  const ap = (ahora, extra = {}) => ({ ...datos(ahora, extra), aprobadas: ['2026-10-18'] });
  const dda = (d) => P.conAvisosDeDudas(P.planificar(d), d);
  let a = dda(ap(M('2026-10-13', '09:05')));
  ok(!a.some((x) => x.eventos.some((id) => id === 'mda2' || id === 'mdl2')), 'martes 09:05, domingo 18 aprobado: nadie recibe «Tienes hasta hoy a las 12:00… te quedas fuera de la convocatoria»', JSON.stringify(a.map((x) => x.clave)));
  a = dda(ap(M('2026-10-13', '09:05'), { respuestas: [{ evento_id: 'mda2', person_id: 'jon', respuesta: 'duda' }] }));
  ok(!a.some((x) => x.eventos.includes('mda2')), 'tampoco a quien está en «duda» a ese partido');
  ok(!P.avisosCierre(ap(M('2026-10-13', '12:05'))).length, 'martes 12:05: nadie recibe «No has respondido: no entras en la propuesta»');
  a = dda(ap(M('2026-10-14', '09:05')));
  ok(a.some((x) => x.person_id === 'jon' && x.eventos.includes('e14') && /Entreno del miércoles 14: responde hasta hoy a las 12:00/.test(x.titulo)), 'el entreno del miércoles sigue con su regla nueva (miércoles 09:00, plazo a las 12:00)');
  ok(dda({ ...datos(M('2026-10-13', '09:05')), aprobadas: ['2026-10-25'] }).some((x) => x.eventos.includes('mda2')), 'aprobada OTRA fecha: el domingo 18 sí tiene su aviso');
}

console.log('\n== «Mensaje a los que faltan» (D189): sin responder y en duda, sin quien tiene una ausencia ese día');
{
  const js = [jug('jon', true, true), jug('guille', true, false), jug('ana', true, true), jug('leo', true, true), jug('eva', true, true), { ...jug('baja', true, true), activo: false }];
  const resp = [
    { evento_id: 'e28', person_id: 'guille', respuesta: 'duda' },  // duda: le toca
    { evento_id: 'e28', person_id: 'ana', respuesta: 'duda' },     // duda con una ausencia que cubre el día: no
    { evento_id: 'e28', person_id: 'eva', respuesta: 'va' },
  ];
  const aus = [{ person_id: 'ana', desde: '2026-10-26', hasta: '2026-10-30', motivo: 'viaje' }, { person_id: 'leo', desde: '2026-10-27', hasta: null, motivo: 'lesion' }];
  const f = P.losQueFaltan(entreno28, js, { respuestas: resp, ausencias: aus, quitados: [] });
  ok(f.sinResponder.map((j) => j.person_id).join() === 'jon', 'sin responder: Jon (Leo tiene una ausencia: cuenta como «no»; Eva va)', f.sinResponder.map((j) => j.person_id).join());
  ok(f.enDuda.map((j) => j.person_id).join() === 'guille', 'en duda: Guille; Ana no (su ausencia cubre el día, aunque la duda gane en las pantallas)', f.enDuda.map((j) => j.person_id).join());
  ok(!P.enDudaDe(jug('eva', true, true), entreno28, { respuestas: resp, ausencias: [], quitados: [] }), 'quien va no está «en duda»');
}

console.log('\n== Riesgo por equipo (D173): solo gestores; nivel con dos partidos de dificultad distinta, proyección siempre');
{
  const R = await import('../src/lib/convocatoria/riesgo.ts');
  const dos = [{ equipo: 'MdA', dificultad: 'alta' }, { equipo: 'MdL', dificultad: 'media' }];
  const pr = (a, l) => ({ MdA: a == null ? null : { puntos: a }, MdL: l == null ? null : { puntos: l } });
  let r = R.riesgos(dos, { MdA: 3, MdL: 3.2 }, pr(60, 60));
  ok(r.length === 1 && r[0].gravedad === 'alto' && r[0].equipo === 'MdA' && r[0].texto === 'Riesgo alto: el MdA (rival más difícil) lleva igual o menos nivel medio que el MdL.', 'el MdA (más difícil) con menos nivel medio: rojo', JSON.stringify(r));
  ok(R.riesgos(dos, { MdA: 3, MdL: 3 }, pr(60, 60))[0]?.gravedad === 'alto', 'con el mismo nivel medio: rojo');
  r = R.riesgos(dos, { MdA: 3.2, MdL: 3 }, pr(60, 60));
  ok(r.length === 1 && r[0].gravedad === 'medio' && /^Riesgo medio/.test(r[0].texto), 'más nivel pero por menos de un cuarto de letra (0,2): ámbar');
  ok(!R.riesgos(dos, { MdA: 3.3, MdL: 3 }, pr(60, 60)).length, 'con 0,3 de diferencia o más: sin riesgo');
  ok(!R.riesgos([{ equipo: 'MdA', dificultad: 'media' }, { equipo: 'MdL', dificultad: 'media' }], { MdA: 2, MdL: 4 }, pr(60, 60)).length, 'rivales parejos: no hay riesgo de nivel (se equilibra)');
  r = R.riesgos(dos, { MdA: 4, MdL: 3 }, pr(44, 47));
  ok(r.find((x) => x.equipo === 'MdA')?.texto === 'Riesgo alto: proyección por debajo de la anotación mínima (44 de 45).' && r.find((x) => x.equipo === 'MdL')?.gravedad === 'medio', 'proyección 44: rojo; 47 (a menos de 5 de la mínima): ámbar');
  ok(!R.riesgos(dos, { MdA: 4, MdL: 3 }, pr(50, 50)).length, 'proyección 50: sin riesgo');
  const uno = R.riesgos([{ equipo: 'MdL', dificultad: 'alta' }], { MdL: 1 }, { MdL: { puntos: 40 } });
  ok(uno.length === 1 && uno[0].motivo === 'proyeccion', 'un solo partido: solo cuenta la proyección');
  ok(R.riesgos([{ equipo: 'MdL', dificultad: 'alta' }], { MdL: 1 }, { MdL: { puntos: 40 } }, { MdL: 0 }).length === 0, 'sin convocados: nada');
  ok(R.textoRiesgoPush(uno) === '1 aviso de riesgo' && R.textoRiesgoPush(R.riesgos(dos, { MdA: 3.2, MdL: 3 }, pr(60, 60))) === null, 'en el push del martes: «1 aviso de riesgo» solo si es rojo, sin niveles');
  const pl = CM.textoPropuestaLista('2026-11-15', [{ equipo: 'MdL', recuento: { total: 9, bases: { puros: 2, reserva: 0, estado: 'ok' }, exteriores: { n: 4, estado: 'ok' }, interiores: { n: 4, estado: 'ok' } } }], '1 aviso de riesgo');
  ok(pl.cuerpo === 'MdL 9 · sin avisos · 1 aviso de riesgo. Revísala y apruébala.', 'push: «MdL 9 · sin avisos · 1 aviso de riesgo»', pl.cuerpo);
  ok(R.RIESGO.margenNivel === 0.25 && R.RIESGO.margenProyeccion === 5, 'umbrales ajustables en RIESGO (0,25 de nivel; 5 puntos)');
}

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
