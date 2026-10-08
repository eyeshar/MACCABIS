#!/usr/bin/env node
// Recordatorios y horas de silencio (D99.6, D99.7) con la HORA FIJA SIMULADA, sin base de datos:
//   lunes agrupado · martes a sin responder y a «duda» · miércoles del entreno · amistoso al crearlo y 24 h antes ·
//   silencio y excepción de menos de 12 h · cambio de hora del 25/10/2026 · ausencia que cuenta como respondido ·
//   «sin recordatorios» · nada con el interruptor apagado · textos de los avisos (sin motivos, niveles ni posiciones).
//
//   npm run pruebas:avisos-logica

import * as H from '../src/lib/avisos/horario.ts';
import * as P from '../src/lib/avisos/planificador.ts';
import * as T from '../src/lib/avisos/textos.ts';

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
ok(iso(H.finDelSilencio(new Date('2026-10-24T21:00:00Z'))) === '2026-10-25T07:30:00.000Z', 'silencio del sábado 24 a las 23:00: termina el domingo a las 08:30 de invierno (07:30 UTC)');
const sabado23 = M('2026-10-24', '23:00');
ok(iso(H.horaDeEnvio(sabado23, M('2026-10-25', '10:30'))) === '2026-10-25T07:30:00.000Z', 'evento el domingo 25 a las 10:30: de reloj son 11 h 30, pero con la hora de más son 12 h 30 reales → espera a las 08:30');
ok(iso(H.horaDeEnvio(sabado23, M('2026-10-25', '09:30'))) === iso(sabado23), 'evento a las 09:30: 11 h 30 reales → sale al momento');
ok(!H.enSilencio(M('2026-10-25', '08:30')) && H.enSilencio(M('2026-10-25', '08:29')) && H.enSilencio(M('2026-10-24', '22:30')) && !H.enSilencio(M('2026-10-24', '22:29')), 'el silencio va de 22:30 a 08:30 (08:30 ya no; 22:30 ya sí)');

console.log('\n== Lunes 19:00: un solo aviso por jugador con todo lo que le falta');
let a = P.planificar(datos(M('2026-10-12', '19:05')));
const jon = de(a, 'jon');
ok(jon.length === 1 && jon[0].titulo === 'Te faltan 2 respuestas' && jon[0].cuerpo === 'Entreno del miércoles 14 y partido del domingo 18. Toca para responder.', 'Jon (dos fichas): «Te faltan 2 respuestas» / «Entreno del miércoles 14 y partido del domingo 18. Toca para responder.» (el domingo con dos partidos cuenta una vez)', JSON.stringify(jon));
ok(jon[0].url === '/mi-zona' && jon[0].eventos.length === 3 && jon[0].clave === 'rec:lunes:2026-10-12:jon', 'abre Mi zona y lleva los 3 eventos; clave única por lunes y jugador');
ok(de(a, 'edimil').length === 1 && de(a, 'edimil')[0].titulo === 'Te falta 1 respuesta' && de(a, 'edimil')[0].url === '/mi-zona/evento/e14', 'quien solo entrena: «Te falta 1 respuesta», abre el entreno');
ok(de(a, 'baja').length === 0, 'a quien está de baja no le llega nada');
ok(iso(jon[0].programado_para) === '2026-10-12T17:00:00.000Z', 'sale a las 19:00 de Madrid');
ok(P.planificar(datos(M('2026-10-12', '18:55'))).length === 0, 'a las 18:55 todavía nada');
ok(P.planificar(datos(M('2026-10-12', '22:05'))).filter((x) => x.clave.startsWith('rec:lunes')).length === 0, 'pasado el margen (3 h) ya no sale: no se manda un lunes atrasado');
a = P.planificar(datos(M('2026-10-12', '19:20'), { respuestas: [{ evento_id: 'e14', person_id: 'jon', respuesta: 'va' }] }));
ok(de(a, 'jon')[0].titulo === 'Te falta 1 respuesta' && de(a, 'jon')[0].url === '/mi-zona/domingo/2026-10-18', 'si ya respondió al entreno, solo le falta el domingo (y abre el domingo)');
a = P.planificar(datos(M('2026-10-12', '19:20'), { respuestas: [{ evento_id: 'mda2', person_id: 'jon', respuesta: 'va' }] }));
ok(de(a, 'jon')[0].titulo === 'Te faltan 2 respuestas', 'con un partido respondido y el otro no, el domingo sigue faltando');

console.log('\n== Martes 10:00: a quien no ha respondido y a quien tiene «duda»');
const resp = [
  { evento_id: 'mda2', person_id: 'jon', respuesta: 'duda' }, { evento_id: 'mdl2', person_id: 'jon', respuesta: 'duda' },
];
a = P.planificar(datos(M('2026-10-13', '10:05'), { respuestas: resp }));
const jm = de(a, 'jon').find((x) => x.clave.startsWith('rec:martes'));
ok(jm && jm.titulo === 'Domingo 18: tienes «duda»' && jm.cuerpo === 'Hoy se hace la convocatoria. ¿Puedes jugar el domingo a las 10:15?', '«Domingo 18: tienes «duda»» / «Hoy se hace la convocatoria. ¿Puedes jugar el domingo a las 10:15?»', JSON.stringify(jm));
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

console.log('\n== Horas de silencio (22:30–8:30) y la excepción de menos de 12 horas');
const tarde = { ...amistoso, id: 'am3', creado_en: M('2026-10-15', '22:45').toISOString() };
ok(!P.planificar(datos(M('2026-10-15', '22:50'), { eventos: [tarde] })).length, 'creado a las 22:45: de noche no sale');
a = P.planificar(datos(M('2026-10-16', '08:31'), { eventos: [tarde] }));
ok(a.filter((x) => x.clave.startsWith('rec:creado')).length === 2 && iso(a[0].programado_para) === iso(M('2026-10-16', '08:30')), 'sale a las 08:30');
const urgente = { ...amistoso, id: 'am4', fecha: '2026-10-16', inicio: '09:00', creado_en: M('2026-10-15', '23:00').toISOString() };
a = P.planificar(datos(M('2026-10-15', '23:05'), { eventos: [urgente] }));
ok(a.filter((x) => x.clave.startsWith('rec:creado')).length === 2, 'creado a las 23:00 para mañana a las 09:00 (menos de 12 h): sale al momento');
const amDST = { ...amistoso, id: 'am5', fecha: '2026-10-25', inicio: '10:30', creado_en: M('2026-10-24', '23:00').toISOString() };
ok(!P.planificar(datos(M('2026-10-24', '23:05'), { eventos: [amDST] })).length, 'noche del cambio de hora: creado el sábado 24 a las 23:00 para el domingo a las 10:30 (12 h 30 reales) → espera');
a = P.planificar(datos(new Date('2026-10-25T07:31:00Z'), { eventos: [amDST] }));
ok(a.filter((x) => x.clave.startsWith('rec:creado')).length === 2 && H.enMadrid(a[0].programado_para).hora === '08:30', 'y sale a las 08:30 de invierno del domingo');
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

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
