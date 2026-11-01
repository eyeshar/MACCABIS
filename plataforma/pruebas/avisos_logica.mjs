#!/usr/bin/env node
// Recordatorios y horas de silencio (D99.6, D99.7, D155: 22:30–08:00) con la HORA FIJA SIMULADA, sin base de datos:
//   lunes agrupado · martes a sin responder y a «duda» · miércoles del entreno · amistoso al crearlo y 24 h antes ·
//   silencio y excepción de menos de 12 h · cambio de hora del 25/10/2026 · ausencia que cuenta como respondido ·
//   «sin recordatorios» · nada con el interruptor apagado · textos de los avisos (sin motivos, niveles ni posiciones) ·
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
const datos = (ahora, extra = {}) => ({ ahora, encendidoDesde: new Date('2026-10-10T08:00:00Z'), eventos: BASE, jugadores: JUG, respuestas: [], ausencias: [], ...extra });
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

console.log('\n== Martes 10:00: solo a quien no ha respondido (las «duda» tienen su aviso de las 12:00, D141)');
const resp = [
  { evento_id: 'mda2', person_id: 'jon', respuesta: 'duda' }, { evento_id: 'mdl2', person_id: 'jon', respuesta: 'duda' },
];
a = P.planificar(datos(M('2026-10-13', '10:05'), { respuestas: resp }));
ok(!de(a, 'jon').some((x) => x.clave.startsWith('rec:martes')), 'quien tiene «duda» a los dos partidos ya no recibe el del martes a las 10:00 (le llega el de las 12:00)');
a = P.planificar(datos(M('2026-10-13', '10:05'), { respuestas: [{ evento_id: 'mda2', person_id: 'jon', respuesta: 'duda' }] }));
const jm = de(a, 'jon').find((x) => x.clave.startsWith('rec:martes'));
ok(jm && jm.titulo === 'Domingo 18: aún no has respondido' && jm.cuerpo === 'Hoy se hace la convocatoria. ¿Puedes jugar el domingo a las 10:15?', 'con un partido en «duda» y otro sin responder, sí: «Domingo 18: aún no has respondido»', JSON.stringify(jm));
const gm = de(a, 'guille').find((x) => x.clave.startsWith('rec:martes'));
ok(gm && gm.titulo === 'Domingo 18: aún no has respondido' && gm.url === '/mi-zona/evento/mda2', 'Guillermo (sin responder, una ficha): le llega y abre su partido');
ok(!de(a, 'edimil').some((x) => x.clave.startsWith('rec:martes')), 'quien no tiene ficha no recibe el del partido');
a = P.planificar(datos(M('2026-10-13', '10:05'), { respuestas: [{ evento_id: 'mda2', person_id: 'guille', respuesta: 'va' }] }));
ok(!de(a, 'guille').some((x) => x.clave.startsWith('rec:martes')), 'quien ya dijo «voy» no recibe nada');
a = P.planificar(datos(M('2026-10-20', '10:01')));
const j3 = de(a, 'jon').find((x) => x.clave.startsWith('rec:martes'));
ok(j3 && j3.cuerpo === 'Hoy se hace la convocatoria. ¿Puedes jugar el domingo a las 09:00 y a las 14:00?' && iso(j3.programado_para) === '2026-10-20T08:00:00.000Z', 'semana del cambio de hora: martes 20/10 a las 10:00 (08:00 UTC), con las dos horas del domingo', JSON.stringify(j3));

console.log('\n== Miércoles del entreno, a las 10:00');
a = P.planificar(datos(M('2026-10-14', '10:00')));
const em = de(a, 'jon').find((x) => x.clave.startsWith('rec:dia'));
ok(em && em.titulo === 'Entreno hoy: ¿vas?' && em.cuerpo === '20:00 (encuentro 19:40) en Antonio Díaz Miguel, pista 3. Aún no has respondido.', '«Entreno hoy: ¿vas?» / «20:00 (encuentro 19:40) en Antonio Díaz Miguel, pista 3. Aún no has respondido.»', JSON.stringify(em));
ok(em.url === '/mi-zona/evento/e14', 'al tocarlo abre el entreno');
a = P.planificar(datos(M('2026-10-21', '10:00')));
ok(de(a, 'jon').find((x) => x.clave.startsWith('rec:dia'))?.cuerpo === '20:30 (encuentro 20:10), pista por confirmar. Aún no has respondido.', 'con pista por confirmar, el texto lo dice (y no bloquea, D96)');
a = P.planificar(datos(M('2026-10-14', '10:00'), { respuestas: [{ evento_id: 'e14', person_id: 'jon', respuesta: 'no' }] }));
ok(!de(a, 'jon').some((x) => x.clave.startsWith('rec:dia')), 'a quien ya respondió (aunque sea «no») no le llega');
ok(!P.planificar(datos(M('2026-10-14', '20:05'))).length, 'con el entreno ya empezado no sale nada');

console.log('\n== Amistoso, torneo o «entre nosotros»: al crearlo y 24 h antes');
const amistoso = ev('am', 'amistoso', 'ambos', '2026-10-17', '11:00', '13:00', { titulo: 'Contra los de Vallecas', creado_en: M('2026-10-15', '12:00').toISOString() });
a = P.planificar(datos(M('2026-10-15', '12:05'), { eventos: [amistoso] }));
ok(a.length === 2 && a.every((x) => x.titulo === 'Nuevo amistoso «Contra los de Vallecas»: ¿vas?' && x.cuerpo === 'Sábado 17, 11:00 (encuentro 10:40) en Antonio Díaz Miguel, pista 3. Aún no has respondido.'), 'al crearlo: a los 2 invitados con ficha (un amistoso es un partido: quien solo entrena no está invitado)', JSON.stringify(a[0]));
a = P.planificar(datos(M('2026-10-16', '11:00'), { eventos: [amistoso] }));
ok(a.length === 2 && a.every((x) => x.titulo.startsWith('Mañana: amistoso') && x.clave.startsWith('rec:24h:am:')), '24 h antes: «Mañana: amistoso…»');
const delMdA = { ...amistoso, id: 'am2', equipo: 'MdA', tipo: 'torneo' };
ok(P.planificar(datos(M('2026-10-16', '11:00'), { eventos: [delMdA] })).map((x) => x.person_id).sort().join() === 'guille,jon', 'un torneo solo del MdA, solo a las fichas del MdA');
const antesDeEncender = { ...amistoso, creado_en: '2026-10-09T10:00:00Z' };
ok(!P.planificar(datos(new Date('2026-10-10T08:05:00Z'), { eventos: [antesDeEncender] })).some((x) => x.clave.startsWith('rec:creado')), 'un evento creado antes de encender el interruptor no manda el «al crearlo» atrasado');

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

console.log('\n== Ausencias, «sin recordatorios», cancelados e interruptor');
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
ok(!P.planificar(datos(M('2026-10-12', '19:05'), { encendidoDesde: null })).length && !P.planificar(datos(M('2026-10-14', '10:00'), { encendidoDesde: null })).length, 'interruptor apagado: ningún recordatorio');
const claves = P.planificar(datos(M('2026-10-12', '19:05'))).map((x) => x.clave);
ok(new Set(claves).size === claves.length && JSON.stringify(claves) === JSON.stringify(P.planificar(datos(M('2026-10-12', '19:10'))).map((x) => x.clave)), 'las claves son únicas y repetir la tarea a los 5 minutos da las mismas (el registro no duplica)');

console.log('\n== Lateral de Gestión: calendario de recordatorios');
ok(P.calendarioRecordatorios(entreno14).map((h) => h.tipo).join() === 'lunes,dia' && P.calendarioRecordatorios(mdaJ3).map((h) => H.enMadrid(h.envio).hora).join() === '19:00,10:00', 'entreno: lunes y mismo día; partido: lunes 19:00 y martes 10:00');

console.log('\n== Textos de cambios, cancelaciones, prueba y gestores');
const tc = T.textoCambio(entreno14, 'va', false);
ok(tc.titulo === 'Cambio en el entreno del miércoles 14' && tc.cuerpo === 'Antonio Díaz Miguel, pista 3, de 20:00 a 22:00 (encuentro 19:40). Sigues en «Voy»: si ya no puedes, cámbialo.', '«Cambio en el entreno del miércoles 14» / «Antonio Díaz Miguel, pista 3, de 20:00 a 22:00 (encuentro 19:40). Sigues en «Voy»: si ya no puedes, cámbialo.»', JSON.stringify(tc));
ok(T.textoCambio({ ...entreno14, fecha: '2026-10-15' }, 'sin_responder', true).cuerpo.endsWith('Vuelve a responder.'), 'cambio de día: pide responder de nuevo');
const tx = T.textoCancelacion(entreno14);
ok(tx.titulo === 'Se cancela el entreno del miércoles 14' && tx.cuerpo === 'No hace falta que hagas nada.', '«Se cancela el entreno del miércoles 14» / «No hace falta que hagas nada.»');
const tg = T.textoGestores('Jon', mdaJ3, 'va', 'no');
ok(tg.titulo === 'Jon cambia el partido del domingo 25 (MdA)' && /«Voy» a «No voy»/.test(tg.cuerpo), 'a los gestores: nombre y respuesta, sin motivo');
const todos = [
  ...P.planificar(datos(M('2026-10-12', '19:05'))), ...P.planificar(datos(M('2026-10-13', '10:05'), { respuestas: resp })),
  ...P.planificar(datos(M('2026-10-14', '10:00'))), tc, tx, tg, T.TEXTO_PRUEBA,
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

console.log('\n== Aviso de convocatoria (D127): sin depender del interruptor, a quien toca y sin dobles');
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
  ok(tc.titulo === 'Cambio en la convocatoria · domingo 25/10' && tc.cuerpo === 'Estás convocado: MdA a las 09:00 (quedada 08:40). Jugamos de negro (ellos de rojo). Llevad la amarilla por si acaso.', '«Cambio en la convocatoria · domingo 25/10»', JSON.stringify(tc));
  ok(CM.textoCambioConvocatoria('2026-10-25', PART, []).cuerpo === 'Ya no estás convocado este domingo.', 'quien sale: «Ya no estás convocado este domingo.»');
  ok(CM.firmaConvocatoria(conv) === CM.firmaConvocatoria({ MdL: [{ person_id: 'ana' }, { person_id: 'jon' }], MdA: [{ person_id: 'guille' }, { person_id: 'jon' }] }) && CM.firmaConvocatoria(conv) !== CM.firmaConvocatoria(despues), 'la firma de la clave única no depende del orden y cambia si cambia la convocatoria');
  const todos = [t1, t2, tc].map((x) => `${x.titulo} ${x.cuerpo}`).join(' ');
  ok(!/nivel|posici|motivo|exterior|interior|Dobla/i.test(todos), 'sin niveles, posiciones ni motivos en la pantalla de bloqueo');
  // Silencio (D99.7): aprobada y enviada el viernes a las 23:00, el aviso del domingo a las 09:00 espera a las 08:00 del
  // sabado; el sabado a las 23:30, con el partido a menos de 12 h reales, sale al momento.
  ok(iso(H.horaDeEnvio(M('2026-10-23', '23:00'), M('2026-10-25', '09:00'))) === iso(M('2026-10-24', '08:00')), 'respeta el silencio: el viernes a las 23:00 sale el sábado a las 08:00');
  ok(iso(H.horaDeEnvio(M('2026-10-24', '23:30'), M('2026-10-25', '09:00'))) === iso(M('2026-10-24', '23:30')), 'y con el partido a menos de 12 h, sale al momento');
}


// ---------------------------------------------------------------- D141: dudas con hora limite
console.log('\n== Hora límite de las dudas (D141): martes 20:00 para entreno del miércoles y partido del domingo; 24 h para lo demás');
const lim = (e) => H.limiteDudas(e);
ok(iso(lim(entreno14)) === '2026-10-13T18:00:00.000Z' && iso(lim(mdaJ2)) === '2026-10-13T18:00:00.000Z' && iso(lim(mdlJ2)) === iso(lim(mdaJ2)), 'entreno del miércoles 14 y partidos del domingo 18: el mismo martes 13/10 a las 20:00 (18:00 UTC)');
ok(iso(lim(mdaJ3)) === '2026-10-20T18:00:00.000Z' && iso(lim(mdlJ3)) === iso(lim(mdaJ3)), 'semana del cambio de hora: la J3 del 25/10 cierra el martes 20/10 a las 20:00 (verano)');
ok(iso(lim(entreno28)) === '2026-10-27T19:00:00.000Z', 'entreno del 28/10: martes 27/10 a las 20:00 (invierno = 19:00 UTC)');
const amis = ev('a1', 'amistoso', 'ambos', '2026-10-17', '17:00', '19:00');
ok(iso(lim(amis)) === iso(M('2026-10-16', '17:00')), 'amistoso del sábado a las 17:00: 24 h antes (viernes 17:00)');
ok(iso(lim(ev('a2', 'amistoso', 'ambos', '2026-10-25', '10:00', null))) === iso(M('2026-10-24', '11:00')), '24 h son 24 horas de reloj aunque el 25/10 vuelva atrás una hora: sábado 24/10 a las 11:00');
ok(iso(lim({ ...entreno14, oficial: false })) === iso(new Date(M('2026-10-14', '20:00').getTime() - 24 * 3600 * 1000)), 'un plan no oficial, aunque sea en miércoles: 24 h antes');
ok(iso(lim(ev('e15', 'entreno', 'ambos', '2026-10-15', '20:00', '22:00'))) === iso(M('2026-10-14', '20:00')), 'un entreno de jueves: 24 h antes');
ok(iso(lim(ev('t1', 'torneo', 'ambos', '2026-11-08', '09:00', '14:00'))) === iso(M('2026-11-07', '09:00')) && iso(lim(ev('i1', 'interno', 'ambos', '2026-10-21', '20:30', '22:30'))) === iso(M('2026-10-20', '20:30')), 'torneo y «entre nosotros»: 24 h antes');
ok(H.dudaAbierta(entreno14, M('2026-10-13', '19:59')) && !H.dudaAbierta(entreno14, M('2026-10-13', '20:00')) && !H.dudaAbierta(mdaJ2, M('2026-10-14', '09:00')), 'abierta hasta las 20:00 en punto; después, cerrada');
ok(H.textoLimite(lim(entreno14), M('2026-10-10', '12:00')) === 'el martes a las 20:00' && H.textoLimite(lim(entreno14), M('2026-10-01', '12:00')) === 'el martes 13 a las 20:00', 'texto del límite: «el martes a las 20:00» (con el número si falta más de cinco días)');
ok(H.textoLimite(lim(entreno14), M('2026-10-13', '12:05')) === 'hoy a las 20:00' && H.textoLimite(lim(entreno14), M('2026-10-12', '23:00')) === 'mañana a las 20:00' && H.textoLimite(lim(entreno14), M('2026-10-11', '12:00')) === 'el martes a las 20:00', 'texto del límite: «hoy a las 20:00» si es hoy, «mañana a las 20:00» si es mañana, «el martes a las 20:00» si no');

console.log('\n== Aviso de las 12:00 a quien siga en «duda»');
ok(iso(H.avisoDeDudas(lim(entreno14))) === iso(M('2026-10-13', '12:00')), 'límite de las 20:00: aviso a las 12:00 del mismo día');
ok(iso(H.avisoDeDudas(M('2026-10-16', '10:00'))) === iso(M('2026-10-16', '09:00')), 'límite temprano (10:00): una hora antes, a las 09:00');
ok(H.avisoDeDudas(M('2026-10-16', '08:45')) === null && iso(H.avisoDeDudas(M('2026-10-16', '09:00'))) === iso(M('2026-10-16', '08:00')) && iso(H.avisoDeDudas(M('2026-10-16', '09:45'))) === iso(M('2026-10-16', '08:45')), 'límite a las 08:45: no cabe fuera del silencio (sin aviso previo); a las 09:00, a las 08:00; a las 09:45, a las 08:45');
const duda = (ev_, p) => ({ evento_id: ev_, person_id: p, respuesta: 'duda' });
const rd = [duda('e14', 'jon'), duda('mda2', 'jon'), duda('mdl2', 'jon')];
const dd = (ahora, extra = {}) => P.conAvisosDeDudas(P.planificar(datos(ahora, extra)), datos(ahora, extra));
const claveD = (a, p) => a.find((x) => x.person_id === p && x.clave.startsWith('rec:dudas:'));
a = dd(M('2026-10-13', '12:05'), { respuestas: rd });
const d1 = claveD(a, 'jon');
ok(d1 && iso(d1.programado_para) === iso(M('2026-10-13', '12:00')) && d1.titulo === 'Tienes «duda»: confirma hasta hoy a las 20:00', 'martes 13/10 a las 12:05: a Jon le sale el aviso (de las 12:00)', JSON.stringify(d1));
ok(d1 && d1.cuerpo.startsWith('Te quedan hasta hoy a las 20:00 para confirmar; si no, contarás como «no va».') && /Entreno del miércoles 14 y partido del domingo 18\./.test(d1.cuerpo), 'texto: «Te quedan hasta las 20:00 para confirmar; si no, contarás como «no va».» y qué tiene en duda', d1?.cuerpo);
ok(a.filter((x) => x.person_id === 'jon').length === 1, 'UN solo aviso para Jon (entreno y los dos partidos juntos)');
ok(!de(dd(M('2026-10-13', '11:55'), { respuestas: rd }), 'jon').length, 'antes de las 12:00: nada');
ok(claveD(dd(M('2026-10-13', '14:55'), { respuestas: rd }), 'jon') && !claveD(dd(M('2026-10-13', '15:05'), { respuestas: rd }), 'jon'), 'si la tarea no pasa, sale hasta 3 horas después y ya no más');
ok(!de(dd(M('2026-10-13', '20:00'), { respuestas: rd }), 'jon').length, 'a las 20:00 ya no hay aviso: pasan a «no va»');
ok(claveD(dd(M('2026-10-13', '12:20'), { respuestas: rd }), 'jon').clave === d1.clave && claveD(dd(M('2026-10-13', '14:00'), { respuestas: rd }), 'jon').clave === d1.clave, 'la clave es la misma en cada pasada de la tarea (no se duplica)');
ok(!claveD(dd(M('2026-10-13', '12:05'), { respuestas: [{ evento_id: 'e14', person_id: 'jon', respuesta: 'va' }, { evento_id: 'mda2', person_id: 'jon', respuesta: 'no' }, { evento_id: 'mdl2', person_id: 'jon', respuesta: 'sin_responder' }] }), 'jon'), 'quien ya dijo «voy» o «no voy» (o no ha respondido) no recibe el de las dudas');
ok(!claveD(dd(M('2026-10-13', '12:05'), { respuestas: rd, encendidoDesde: null }), 'jon'), 'con el interruptor apagado, ningún aviso de dudas de eventos oficiales');
ok(!claveD(dd(M('2026-10-13', '12:05'), { respuestas: rd, eventos: BASE.map((e) => ({ ...e, sin_recordatorios: true })) }), 'jon'), '«Sin recordatorios»: nada');
ok(!claveD(dd(M('2026-10-13', '12:05'), { respuestas: rd, eventos: BASE.map((e) => ({ ...e, estado: 'cancelado' })) }), 'jon'), 'cancelado: nada');
ok(!claveD(dd(M('2026-10-13', '12:05'), { respuestas: [duda('mda2', 'edimil')] }), 'edimil'), 'quien no está invitado a ese evento no recibe nada');
a = dd(M('2026-10-20', '12:02'), { respuestas: [duda('mda3', 'jon'), duda('mdl3', 'jon')] });
ok(iso(claveD(a, 'jon').programado_para) === '2026-10-20T10:00:00.000Z', 'semana del cambio de hora: 12:00 de verano (10:00 UTC)');
a = dd(M('2026-10-27', '12:02'), { respuestas: [duda('e28', 'jon')] });
ok(iso(claveD(a, 'jon').programado_para) === '2026-10-27T11:00:00.000Z', 'y la del 28/10 a las 12:00 de invierno (11:00 UTC)');
// Otros eventos: 24 h antes; un plan sale aunque el interruptor esté apagado.
const amis2 = ev('a3', 'amistoso', 'ambos', '2026-10-17', '10:00', '12:00', { titulo: 'Amistoso con Vallecas', creado_en: '2026-10-01T10:00:00Z' });
a = dd(M('2026-10-16', '09:05'), { eventos: [...BASE, amis2], respuestas: [duda('a3', 'jon')] });
ok(iso(claveD(a, 'jon').programado_para) === iso(M('2026-10-16', '09:00')) && claveD(a, 'jon').titulo === 'Tienes «duda»: confirma hasta hoy a las 10:00', 'amistoso del sábado a las 10:00: límite el viernes a las 10:00, aviso a las 09:00');
const plan = ev('p1', 'quedada', 'ambos', '2026-10-17', '19:00', '21:00', { titulo: 'Cena', oficial: false, creado_en: '2026-10-01T10:00:00Z' });
a = dd(M('2026-10-16', '12:05'), { eventos: [...BASE, plan], respuestas: [duda('p1', 'jon')], encendidoDesde: null });
ok(claveD(a, 'jon') && a.filter((x) => x.person_id === 'jon').length === 1, 'un plan en «duda» recibe su aviso (viernes 12:00) aunque el interruptor esté apagado');
// Si ya sale otro recordatorio ese día, se juntan en uno.
const rj = [duda('e14', 'guille')];
a = dd(M('2026-10-13', '10:05'), { respuestas: rj });
const g1 = de(a, 'guille');
ok(g1.length === 1 && g1[0].clave.startsWith('rec:dudas:') && iso(g1[0].programado_para) === iso(M('2026-10-13', '10:00')) && /Además: Domingo 18: aún no has respondido\./.test(g1[0].cuerpo), 'martes 10:05: Guillermo (duda al entreno, sin responder al partido) recibe UN aviso que junta el de las dudas y el del martes', JSON.stringify(g1));
const g2 = de(dd(M('2026-10-13', '12:05'), { respuestas: rj }), 'guille');
ok(g2.length === 1 && g2[0].clave === g1[0].clave, 'a las 12:05 sigue siendo UN aviso, con la misma clave (la tarea no lo repite)');
const g3 = de(dd(M('2026-10-13', '13:30'), { respuestas: rj }), 'guille');
ok(g3.length === 1 && g3[0].clave === g1[0].clave, 'ya sin el del martes (pasadas las 13:00), el de las dudas sigue con la misma clave');

console.log('\n== Paso automático a «no va» y su aviso');
const sis = (ev_, p, cuando = '2026-10-13T18:00:20Z') => ({ evento_id: ev_, person_id: p, respuesta: 'no', motivo: 'no_confirmo', origen: 'sistema', cambiado_en: cuando });
const pas = P.avisosPasoNoVa({ eventos: BASE, respuestas: [sis('e14', 'jon'), sis('mda2', 'jon'), sis('mdl2', 'jon')] }, M('2026-10-13', '20:05'));
ok(pas.length === 1 && pas[0].person_id === 'jon' && pas[0].titulo === 'Tus «duda» han pasado a «no va»' && /entreno del miércoles 14 y partido del domingo 18/.test(pas[0].cuerpo), 'un aviso por persona y límite, con lo que pasó a «no va»', JSON.stringify(pas));
ok(pas[0].cuerpo.includes('Si al final puedes, entra y pon «Voy»') && !/motivo|nivel|posici/i.test(pas[0].cuerpo), 'invita a volver a decir «Voy»; sin motivos en la pantalla de bloqueo');
ok(P.avisosPasoNoVa({ eventos: BASE, respuestas: [sis('e14', 'jon')] }, M('2026-10-13', '20:30'))[0].clave === P.avisosPasoNoVa({ eventos: BASE, respuestas: [sis('e14', 'jon')] }, M('2026-10-13', '20:45'))[0].clave, 'la clave es estable: repetir la tarea no lo duplica');
ok(!P.avisosPasoNoVa({ eventos: BASE, respuestas: [{ ...sis('e14', 'jon'), respuesta: 'va', motivo: null, origen: 'jugador' }] }, M('2026-10-13', '20:05')).length, 'quien ya volvió a decir «Voy» no recibe el aviso');
ok(!P.avisosPasoNoVa({ eventos: BASE, respuestas: [sis('e14', 'jon', '2026-10-10T18:00:20Z')] }, M('2026-10-13', '20:05')).length, 'un paso de hace más de 24 h ya no se avisa');
ok(!P.avisosPasoNoVa({ eventos: BASE, respuestas: [{ ...sis('e14', 'jon'), motivo: 'trabajo', origen: 'jugador' }] }, M('2026-10-13', '20:05')).length, 'solo avisa de lo que cerró el sistema');
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
  r = P.planificar(conMarcas(M('2026-10-14', '10:05')));
  ok(de(r, 'nse').length === 0, 'entreno, el mismo día a las 10:00: a quien no suele entrenar y no ha respondido no le llega nada (por defecto, no va)');
  ok(de(r, 'nap').length === 1 && de(r, 'jon').length === 1, 'y a «nunca a partidos» y a quien no tiene marca, sí');
  r = P.planificar(conMarcas(M('2026-10-14', '10:05'), { quitados: [{ evento_id: 'e14', person_id: 'nse' }] }));
  ok(de(r, 'nse').length === 1 && de(r, 'nse')[0].clave === 'rec:dia:e14:nse', 'si un gestor se lo quita para ese entreno (vuelve a «sin responder»), le llega el recordatorio');
  r = P.planificar(conMarcas(M('2026-10-21', '10:05'), { quitados: [{ evento_id: 'e14', person_id: 'nse' }] }));
  ok(de(r, 'nse').length === 0, 'quitárselo en un entreno no vale para el siguiente');
  r = P.planificar(conMarcas(M('2026-10-13', '10:05')));
  ok(de(r, 'nse').length === 1 && de(r, 'nse')[0].clave === 'rec:martes:2026-10-18:nse', 'en un partido la marca «no suele entrenar» no cuenta: le llega el del martes');
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
  ok(pd(conMarcas(M('2026-10-14', '10:05'))).length === 0, 'el día del entreno no se repite (solo el lunes)');
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
  ok(pd({ ...conMarcas(lunes), encendidoDesde: null }).length === 0, 'con el interruptor apagado, nada');
  ok(pd(conMarcas(lunes, { eventos: [{ ...entreno14, sin_recordatorios: true }, { ...mdaJ2 }] })).length === 0, 'ni en un entreno «sin recordatorios», ni en un partido');
  ok(pd(conMarcas(lunes, { eventos: [{ ...entreno14, estado: 'cancelado' }, { ...entreno14, id: 'eplan', oficial: false }] })).length === 0, 'ni cancelado, ni en un plan no oficial');
  const base = P.planificar(conMarcas(lunes));
  ok(de(base, 'nse').length === 1 && !de(base, 'nse')[0].eventos.includes('e14') && base.every((x) => !x.clave.startsWith('rec:defecto')), 'el «te faltan» del lunes sigue sin el entreno y no lleva el aviso por defecto');
}
// ---------------------------------------------------------------- mensajes del recuadro «Respuestas en la web» (D156)
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

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
