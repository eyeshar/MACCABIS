#!/usr/bin/env node
// MdFantasy (D196): la lógica pura (src/lib/fantasy), sin base ni web. Las reglas del encargo, una a una:
// rendimiento (puntos, +/- relativo a la mitad con tope, mínimo 0, dos partidos = media + 3), compromiso (rápido / a tiempo /
// no responde, sin contar de 22:30 a 08:00; entreno, plantón, vino sin avisar), total mínimo 0, capitán y vicecapitán,
// arrastre de la alineación, valor, copias, ingresos, duelos rotatorios, el cierre de una jornada y lo que pintan las pantallas.
//   npm run pruebas:fantasy-logica
import { PARAMETROS as P, parametros, CLAVES, AJUSTES, millones, redondeo } from '../src/lib/fantasy/reglas.ts';
import { rendimientoPartido, rendimiento, horasActivas, compromisoUnidad, puntosJugador, casarNombres, masMenosRelativo, contestoATiempo } from '../src/lib/fantasy/puntos.ts';
import { puntosManager, arrastrar, valor, copiasPorJugador, ingreso, precioClausula, duelos } from '../src/lib/fantasy/manager.ts';
import { puntuarJornada } from '../src/lib/fantasy/jornada.ts';
import { cerrarJornada } from '../src/lib/fantasy/cierre.ts';
import { rankingManagers, rankingDuelos, rankingJugadores, quintetoIdeal, rivalDe, premiosDelMes, resumenWhatsapp, insignias, marcaConvocado, marcaRespuesta, CLASE_RESPUESTA, mediaValor, textoMediaValor, textoHojasPendientes, equiposDePorra } from '../src/lib/fantasy/vista.ts';
import { madrid, lunesDe, limiteDudas } from '../src/lib/avisos/horario.ts';
import { avisoClausulazo, avisosSinResponder, tocaAvisoManagers, textoSinResponder, HORA_AVISO_MANAGERS } from '../src/lib/fantasy/avisos.ts';

let fallos = 0;
const ok = (c, q, d = '') => { if (c) console.log(`  OK    ${q}`); else { fallos++; console.log(`  FALLO ${q}${d !== '' ? ` -> ${d}` : ''}`); } };
const eq = (a, b, q) => ok(JSON.stringify(a) === JSON.stringify(b), q, `${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);

console.log('\n== Rendimiento');
const L = (o) => ({ equipo: 'MdA', pts: 0, segundos: 1440, masMenos: 0, ptsFavor: 60, ptsContra: 40, segundosEquipo: 14400, ...o });
// partido de 48 min (14400/5 = 2880 s). Margen +20; 24 min en pista → le tocaba +10.
eq(masMenosRelativo(L({ masMenos: 16 })), 6, '+/- relativo = su +/- menos margen × segundos / duración real');
eq(rendimientoPartido(L({ pts: 10, masMenos: 16 }), P).total, 13, '10 puntos + la mitad de +6 = 13');
eq(rendimientoPartido(L({ pts: 10, masMenos: 15 }), P).extra, 3, 'la mitad se redondea (2,5 → 3)');
eq(rendimientoPartido(L({ pts: 10, masMenos: 5 }), P).extra, -3, '…también en negativo (−2,5 → −3)');
eq(rendimientoPartido(L({ pts: 10, masMenos: 40 }), P).extra, 5, 'tope de +5');
eq(rendimientoPartido(L({ pts: 10, masMenos: -30 }), P).extra, -5, 'tope de −5');
eq(rendimientoPartido(L({ pts: 2, masMenos: -30 }), P).total, 0, 'mínimo 0 por partido');
eq(rendimientoPartido(L({ pts: 8, masMenos: 20, ptsFavor: 50, ptsContra: 60, segundos: 2880 }), P).extra, 5, 'en una derrota, estar por encima del margen suma');
eq(rendimientoPartido(L({ pts: 8, ptsFavor: 90, ptsContra: 40, masMenos: 25 }), P).total, 8, 'sin bonus por victoria: +25 con un margen de +50 en media parte es 0');
eq(rendimiento([L({ pts: 10, masMenos: 16 }), L({ equipo: 'MdL', pts: 6, masMenos: 10 })], P).total, 13, 'dos partidos el mismo domingo: media (13 y 6 → 9,5 → 10) + 3');
eq(rendimiento([L({ pts: 10, masMenos: 16 }), L({ equipo: 'MdL', segundos: 0, pts: 0 })], P), { total: 13, partidos: [rendimientoPartido(L({ pts: 10, masMenos: 16 }), P)], doblete: false }, 'un partido sin minutos no cuenta como jugado');
eq(rendimiento([], P).total, 0, 'sin partidos: 0');

console.log('\n== Compromiso: la respuesta');
const plazo = madrid('2026-11-17', '12:00');
const U = (o) => ({ clase: 'domingo', eventos: ['e'], texto: 'Domingo 22/11', plazo, estado: 'va', origen: 'jugador', respondidoEn: null, avisoEn: null, asistencia: null, convocado: true, enHoja: true, ...o });
const aviso = madrid('2026-11-16', '10:00');
eq(horasActivas(madrid('2026-11-16', '22:00'), madrid('2026-11-17', '09:00')), 1.5, 'horas sin contar de 22:30 a 08:00: de 22:00 a 09:00 son 1,5');
eq(horasActivas(madrid('2026-10-24', '20:00'), madrid('2026-10-25', '10:00')), 4.5, '…también la noche del cambio de hora');
eq(compromisoUnidad(U({ respondidoEn: madrid('2026-11-16', '18:00'), avisoEn: aviso }), P).respuesta, 2, 'responde a las 8 h del aviso: +2');
// aviso lunes 10:00; 12,5 h activas el lunes + 3 h hasta las 11:00 del martes = 15,5 → rápido aunque hayan pasado 25 h de reloj
eq(compromisoUnidad(U({ respondidoEn: madrid('2026-11-17', '11:00'), avisoEn: aviso }), P).respuesta, 2, 'a las 25 h de reloj, 15,5 h sin el silencio: sigue siendo rápido');
eq(compromisoUnidad(U({ respondidoEn: madrid('2026-11-17', '11:00'), avisoEn: madrid('2026-11-14', '10:00') }), P).respuesta, 1, 'más de 24 h hábiles después del aviso, pero antes del plazo: +1');
eq(compromisoUnidad(U({ respondidoEn: madrid('2026-11-15', '10:00'), avisoEn: aviso }), P).respuesta, 2, 'respondió antes de que se le avisara: +2');
eq(compromisoUnidad(U({ respondidoEn: madrid('2026-11-15', '10:00') }), P).respuesta, 2, 'no hizo falta avisarle: +2');
eq(compromisoUnidad(U({ respondidoEn: madrid('2026-11-18', '10:00'), avisoEn: aviso }), P).respuesta, 0, 'fuera de plazo: 0');
eq(compromisoUnidad(U({ estado: 'sin_responder', origen: null }), P).respuesta, -2, 'no responde: −2');
eq(compromisoUnidad(U({ estado: 'no', origen: 'ausencia' }), P).respuesta, 1, 'avisó con una ausencia: +1');
eq(compromisoUnidad(U({ estado: 'va', origen: 'gestor' }), P).respuesta, 0, 'respondió un gestor por él: ni suma ni resta');
eq(compromisoUnidad(U({ estado: 'no', origen: 'sistema' }), P).respuesta, 0, 'duda que cerró el sistema: 0');
eq(compromisoUnidad(U({ estado: 'no', origen: 'defecto' }), P).respuesta, 0, '«no va» por defecto: 0');
eq(compromisoUnidad(U({ estado: 'no', respondidoEn: madrid('2026-11-16', '11:00'), avisoEn: aviso }), P).respuesta, 2, 'decir «no voy» rápido también es responder: +2');

console.log('\n== Aviso al afectado por un clausulazo');
const dCl = { precio: 13.1, jugador: 'Ana', comprador: 'Eme' };
const avDia = avisoClausulazo(dCl, 'a', 'm2', madrid('2026-11-17', '10:00'));
ok(avDia.person_id === 'm2' && avDia.tipo === 'cambio' && avDia.cuerpo === 'Eme se lleva a Ana. Cobras 13,1 M.' && avDia.url === '/mdfantasy?tab=mercado', 'va solo al mánager que pierde al jugador, con quién y cuánto cobra', JSON.stringify(avDia));
eq(avDia.programado_para.getTime(), madrid('2026-11-17', '10:00').getTime(), 'de día sale al momento');
eq(avisoClausulazo(dCl, 'a', 'm2', madrid('2026-11-17', '23:15')).programado_para.getTime(), madrid('2026-11-18', '08:00').getTime(), 'a las 23:15 (silencio): espera a las 08:00 del día siguiente');
eq(avisoClausulazo(dCl, 'a', 'm2', madrid('2026-11-18', '06:40')).programado_para.getTime(), madrid('2026-11-18', '08:00').getTime(), 'a las 06:40 (silencio): espera a las 08:00');
eq(avisoClausulazo(dCl, 'a', 'm2', madrid('2026-11-17', '22:29')).programado_para.getTime(), madrid('2026-11-17', '22:29').getTime(), 'a las 22:29 todavía sale');

console.log('\n== Convocados y la media que fija el valor');
const cv = { MdA: ['a', 'b'], MdL: ['b', 'c'] };
eq(['a', 'b', 'c', 'd'].map((id) => marcaConvocado(cv, id).texto), ['Convocado MdA', 'Convocado en los dos', 'Convocado MdL', 'No convocado'], 'la marca de cada jugador');
ok(marcaConvocado(null, 'a') === null && marcaConvocado(undefined, 'a') === null, 'sin convocatoria publicada no hay marca (se dice «Convocatoria sin publicar»)');
const pv = [['2026-10-04', 20], ['2026-10-18', 10], ['2026-10-25', 6], ['2026-11-08', 10], ['2026-11-15', 9]].map(([jornada, total]) => ({ jornada, person_id: 'a', total }));
eq(mediaValor(pv, 'a', 4), 8.8, 'media de las últimas 4 jornadas (la del valor), no la de la temporada (11)');
eq(valor(pv.map((x) => x.total).reverse(), P), 8.8, '…y es exactamente el valor de mercado');
eq([textoMediaValor(8.8, 4), textoMediaValor(null, 4), mediaValor(pv, 'z', 4)], ['8,8 pts · media últimas 4', 'sin jornadas', null], 'el texto: «8,8 pts · media últimas 4»');

console.log('\n== Partido aplazado: un equipo juega dos partidos el mismo domingo');
{
  const jug = [{ person_id: 'a', nombre_oficial: 'Uno, Ana', nombre_visible: 'Ana' }, { person_id: 'b', nombre_oficial: 'Dos, Beto', nombre_visible: 'Beto' }];
  const dd = {
    fecha: '2026-12-20', jugadores: jug, eventos: [], estados: [], avisos: [], asistencia: [], convocados: [],
    // MdA juega su partido de la jornada 9 (gana) y el aplazado de la jornada 5 (pierde), el mismo domingo.
    partidos: [{ equipo: 'MdA', partido: 905, jornada: 5, rival: 'X', pts_favor: 40, pts_contra: 60, segundos_equipo: 14400 }, { equipo: 'MdA', partido: 909, jornada: 9, rival: 'Y', pts_favor: 70, pts_contra: 50, segundos_equipo: 14400 }],
    lineas: [{ equipo: 'MdA', partido: 905, nombre: 'UNO, ANA', segundos: 1440, pts: 6, mas_menos: -10 }, { equipo: 'MdA', partido: 909, nombre: 'UNO, ANA', segundos: 1440, pts: 12, mas_menos: 10 },
      { equipo: 'MdA', partido: 909, nombre: 'DOS, BETO', segundos: 1440, pts: 8, mas_menos: 10 }],
  };
  const r = puntuarJornada(dd, P);
  const a = r.puntos.get('a'), b = r.puntos.get('b');
  const uno = rendimientoPartido(L({ pts: 6, masMenos: -10, ptsFavor: 40, ptsContra: 60 }), P).total, otro = rendimientoPartido(L({ pts: 12, masMenos: 10, ptsFavor: 70, ptsContra: 50 }), P).total;
  ok(a.doblete && a.partidos.length === 2 && a.rendimiento === redondeo((uno + otro) / 2 + P.bonusDoblete), 'quien juega los dos: la media de los dos más el extra (regla de doblar)', JSON.stringify(a.partidos));
  ok(a.partidos[0].total === uno && a.partidos[1].total === otro, 'cada hoja se puntúa con el marcador de SU partido, no con el del otro', `${a.partidos.map((x) => x.total)} / ${uno}, ${otro}`);
  ok(!b.doblete && b.partidos.length === 1 && b.rendimiento === rendimientoPartido(L({ pts: 8, masMenos: 10, ptsFavor: 70, ptsContra: 50 }), P).total, 'quien juega solo uno: lo suyo, sin extra');
  eq(r.resultados, { MdA: 'gana' }, 'la porra de ese equipo se decide con el partido de la jornada de ese día (el aplazado no cuenta)');
  eq(equiposDePorra([{ equipo: 'MdA', jornada: 5, evento: 'x' }, { equipo: 'MdL', jornada: 9, evento: 'z' }, { equipo: 'MdA', jornada: 9, evento: 'y' }]).map((x) => x.evento), ['z', 'y'], 'y en pantalla sale una sola fila de porra por equipo');
}
eq([textoHojasPendientes(['MdA']), textoHojasPendientes(['MdL', 'MdA']), textoHojasPendientes([]), textoHojasPendientes(undefined)], ['Pendiente: falta la hoja de MdA', 'Pendiente: faltan las hojas de MdA y MdL', null, null], '«Pendiente: falta la hoja de MdA»');

console.log('\n== Compromiso: la asistencia real');
const E = (o) => U({ clase: 'entreno', texto: 'Entreno 18/11', respondidoEn: madrid('2026-11-16', '11:00'), avisoEn: aviso, ...o });
eq(compromisoUnidad(E({}), P), { clase: 'entreno', texto: 'Entreno 18/11', respuesta: 2, asistencia: 2, como: 'respondió rápido' }, 'dijo «voy» y nadie ha dicho que faltara: +2 del entreno');
eq(compromisoUnidad(E({ asistencia: 'fue' }), P).asistencia, 2, 'fue de verdad: +2');
eq(compromisoUnidad(E({ asistencia: 'falto' }), P).asistencia, -5, 'plantón (dijo «voy» y no fue): −5');
ok(compromisoUnidad(E({ asistencia: 'falto' }), P).como.endsWith('no vino') && !/plant[oó]n|excusa|motivo/i.test(JSON.stringify([compromisoUnidad(E({ asistencia: 'falto' }), P), compromisoUnidad(E({ asistencia: 'excusa' }), P)])), 'lo que ven los jugadores: «no vino», texto neutro y sin motivo');
eq(compromisoUnidad(E({ asistencia: 'fue' }), P).asistencia - compromisoUnidad(E({ asistencia: 'falto' }), P).asistencia, 7, 'corregir un «no vino» mal marcado devuelve los 7 puntos (de −5 a +2)');
eq(compromisoUnidad(E({ asistencia: 'excusa' }), P).asistencia, 0, 'dijo «voy» y faltó con excusa: sin entreno y sin plantón');
eq(compromisoUnidad(E({ estado: 'sin_responder', origen: null, respondidoEn: null, asistencia: 'fue' }), P), { clase: 'entreno', texto: 'Entreno 18/11', respuesta: 0, asistencia: 2, como: 'vino sin avisar' }, 'vino sin avisar: los +2 del entreno, sin puntos (ni castigo) de respuesta');
eq(compromisoUnidad(E({ estado: 'no', asistencia: null }), P).asistencia, 0, 'dijo «no voy»: sin puntos de entreno');
eq(compromisoUnidad(U({ asistencia: 'falto', enHoja: false, respondidoEn: madrid('2026-11-16', '11:00') }), P).asistencia, -5, 'partido: convocado, dijo «voy», no sale en la hoja y un gestor confirma que faltó: plantón');
eq(compromisoUnidad(U({ asistencia: null, enHoja: false, respondidoEn: madrid('2026-11-16', '11:00') }), P).asistencia, 0, 'partido: si nadie lo confirma, no hay plantón');
eq(compromisoUnidad(U({ respondidoEn: madrid('2026-11-16', '11:00') }), P).asistencia, 0, 'ir al partido no da compromiso (ya da rendimiento)');

console.log('\n== Total del jugador');
eq(puntosJugador([L({ pts: 10, masMenos: 16 })], [E({}), U({ respondidoEn: madrid('2026-11-16', '11:00') })], true, P).total, 13 + 4 + 2, 'rendimiento + compromiso');
const nc = puntosJugador([], [E({})], false, P);
ok(nc.rendimiento === 0 && nc.total === 4 && !nc.convocado, 'no convocado: solo suma compromiso');
{
  const dom = U({ respondidoEn: madrid('2026-11-16', '11:00') });
  const tres = puntosJugador([], [E({}), E({}), E({}), dom], false, P);
  ok(tres.unidades.reduce((t, u) => t + u.respuesta + u.asistencia, 0) === 14 && tres.compromiso === 6 && tres.total === 6, 'tope semanal de compromiso: tres entrenos y el domingo sumarían 14, cuentan 6', `${tres.compromiso}`);
  eq(puntosJugador([], [E({}), dom], false, P).compromiso, 6, 'justo en el tope (4 + 2): 6');
  eq(puntosJugador([L({ pts: 10 })], [E({ asistencia: 'falto' }), U({ estado: 'sin_responder', origen: null })], true, P).compromiso, -5, 'el tope limita solo por arriba: los negativos cuentan enteros (+2 −5 −2)');
  eq(puntosJugador([], [E({}), E({}), E({}), dom], false, parametros({ topeCompromiso: 10 })).compromiso, 10, 'el tope se cambia en Ajustes');
  eq(puntosJugador([], [E({}), E({}), E({}), dom], false, parametros({ topeCompromiso: 30 })).compromiso, 14, 'con un tope alto, cuenta todo');
  ok(AJUSTES.topeCompromiso.grupo === 'Compromiso' && P.topeCompromiso === 6 && P.respuestaRapida === 2 && P.respuestaATiempo === 1 && P.entrenoAsistido === 2 && P.sinRespuesta === -2 && P.planton === -5, 'pesos de salida: rápido +2, a tiempo +1, entreno +2, no responder −2, plantón −5, tope 6');
}
eq(puntosJugador([], [E({ asistencia: 'falto' }), U({ estado: 'sin_responder', origen: null })], false, P).total, 0, 'el total nunca baja de 0 (−2 de plantón+respuesta y −2)');
eq(puntosJugador([L({ pts: 6, masMenos: 10 })], [E({ asistencia: 'falto' })], true, P).total, 3, 'un compromiso negativo resta del rendimiento (6 − 3)');

console.log('\n== Interruptor «Rendimiento a la mitad si no contestó a tiempo» (apagado de salida)');
{
  const ON = { ...P, mitadSinRespuesta: 1 };
  const { mitadSinRespuesta: _fuera, ...SIN } = P;   // los parametros de antes de existir el interruptor
  const trece = [L({ pts: 10, masMenos: 16 })];       // rendimiento 13
  const casos = {
    'respondió él a tiempo': U({ respondidoEn: madrid('2026-11-16', '11:00'), avisoEn: aviso }),
    'respondió él fuera de plazo': U({ respondidoEn: madrid('2026-11-18', '10:00'), avisoEn: aviso }),
    'respondió un gestor por él': U({ origen: 'gestor' }),
    'el sistema cerró su duda': U({ estado: 'no', origen: 'sistema' }),
    'no respondió': U({ estado: 'sin_responder', origen: null }),
  };
  ok(P.mitadSinRespuesta === 0 && AJUSTES.mitadSinRespuesta.interruptor === true && AJUSTES.mitadSinRespuesta.texto === 'Rendimiento a la mitad si no contestó a tiempo' && parametros({}).mitadSinRespuesta === 0, 'de salida está DESACTIVADO y en Ajustes es un interruptor');
  ok(parametros({ mitadSinRespuesta: 1 }).mitadSinRespuesta === 1 && parametros({ mitadSinRespuesta: 2 }).mitadSinRespuesta === 0, 'solo admite apagado (0) o encendido (1)');
  // APAGADO: nada cambia, caso a caso, respecto a como se puntuaba sin el interruptor.
  ok(Object.values(casos).every((u) => JSON.stringify(puntosJugador(trece, [u], true, P)) === JSON.stringify(puntosJugador(trece, [u], true, SIN)) && puntosJugador(trece, [u], true, P).rendimiento === 13 && !('mitad' in puntosJugador(trece, [u], true, P))),
    'APAGADO: los cinco casos puntúan exactamente igual que antes (rendimiento 13, sin marca)');
  // ENCENDIDO
  const on = Object.fromEntries(Object.entries(casos).map(([k, u]) => [k, puntosJugador(trece, [u], true, ON)]));
  eq(Object.fromEntries(Object.entries(on).map(([k, x]) => [k, [x.rendimiento, !!x.mitad]])), { 'respondió él a tiempo': [13, false], 'respondió él fuera de plazo': [7, true], 'respondió un gestor por él': [7, true], 'el sistema cerró su duda': [7, true], 'no respondió': [7, true] },
    'ENCENDIDO: solo quien respondió él mismo antes del plazo conserva su rendimiento; los demás, la mitad hacia arriba (13 → 7)');
  ok(on['no respondió'].total === 7 + P.sinRespuesta && on['no respondió'].compromiso === P.sinRespuesta && on['respondió él a tiempo'].total === puntosJugador(trece, [casos['respondió él a tiempo']], true, P).total, '…el compromiso no cambia: el total es la mitad del rendimiento más su compromiso');
  eq([8, 1, 0].map((n) => puntosJugador([L({ pts: n, masMenos: 10 })], [casos['no respondió']], true, ON).rendimiento), [4, 1, 0], 'redondeo hacia arriba: 8 → 4, 1 → 1, 0 → 0');
  const sinJugar = puntosJugador([], [casos['no respondió']], false, ON);
  ok(sinJugar.rendimiento === 0 && !sinJugar.mitad, 'si no juega no hay nada que partir (ni marca)');
  ok(puntosJugador(trece, [U({ origen: 'sin_datos', estado: 'sin_responder' })], true, ON).rendimiento === 13 && puntosJugador(trece, [], true, ON).rendimiento === 13, 'un domingo sin datos de respuestas (anterior a responder en la web) o sin invitación no penaliza');
  ok(puntosJugador(trece, [U({ clase: 'entreno', estado: 'sin_responder', origen: null }), casos['respondió él a tiempo']], true, ON).rendimiento === 13, 'cuenta la respuesta al DOMINGO, no la del entreno');
  ok(contestoATiempo([casos['respondió él a tiempo']]) && !contestoATiempo([casos['respondió un gestor por él']]), 'una respuesta puesta por un gestor no cuenta como suya');
  const dos = puntosJugador([L({ pts: 10, masMenos: 16 }), L({ equipo: 'MdL', pts: 6, masMenos: 10 })], [casos['no respondió']], true, ON);
  ok(dos.doblete && dos.rendimiento === Math.ceil(13 / 2), 'con dos partidos: la mitad de lo que le saldría (media + extra)', String(dos.rendimiento));
}

console.log('\n== Aviso a los mánagers la víspera del plazo: «no han contestado al domingo»');
{
  const sr = { fecha: '2026-11-22', evento: { tipo: 'liga', fecha: '2026-11-22', inicio: '10:15:00', oficial: true },
    managers: [{ person_id: 'm1', pendientes: ['Jon', 'Alonso'] }, { person_id: 'm2', pendientes: [] }, { person_id: 'm3', pendientes: ['Edu'] }] };
  const { limite, toca } = tocaAvisoManagers(sr.evento);
  ok(limite.getTime() === madrid('2026-11-17', '12:00').getTime() && limite.getTime() === limiteDudas(sr.evento).getTime(), 'usa el plazo de respuesta de la web (martes a las 12:00), no una hora nueva');
  ok(HORA_AVISO_MANAGERS === '20:30' && toca.getTime() === madrid('2026-11-16', '20:30').getTime(), 'toca la víspera del plazo (lunes) a las 20:30');
  ok(toca.getTime() - madrid(lunesDe(sr.fecha), '19:00').getTime() === 90 * 60000, '…hora y media después del recordatorio del lunes a las 19:00 a los jugadores: no se pisan');
  eq(avisosSinResponder(sr, madrid('2026-11-16', '19:00')).length + avisosSinResponder(sr, madrid('2026-11-16', '20:29')).length, 0, 'antes de las 20:30 no sale nada');
  const a = avisosSinResponder(sr, madrid('2026-11-16', '20:30'));
  eq(a.map((x) => [x.person_id, x.cuerpo]), [['m1', 'Jon y Alonso no han contestado al domingo y los tienes en plantilla.'], ['m3', 'Edu no ha contestado al domingo y lo tienes en plantilla.']], 'un único aviso por mánager, solo a quien tiene alguno pendiente');
  eq(textoSinResponder(['Jon', 'Alonso', 'Edu']), 'Jon, Alonso y Edu no han contestado al domingo y los tienes en plantilla.', 'con tres: «Jon, Alonso y Edu no han contestado…»');
  ok(a.every((x) => x.tipo === 'cambio' && x.url === '/mdfantasy?tab=plantilla' && x.eventos.length === 0 && x.programado_para.getTime() === madrid('2026-11-16', '20:30').getTime()), 'sale en el momento, con enlace a Plantilla');
  const tarde = avisosSinResponder(sr, madrid('2026-11-16', '22:45'));
  ok(tarde.length === 2 && tarde[0].programado_para.getTime() === madrid('2026-11-17', '08:00').getTime(), 'si la tarea pasa ya en horario de silencio (22:30–08:00), espera a las 08:00');
  ok(tarde[0].clave === a[0].clave && a[0].clave === 'fantasy-sin-responder:2026-11-22:m1', 'la clave es estable: no se repite aunque la tarea pase cada 15 minutos');
  eq(avisosSinResponder(sr, madrid('2026-11-16', '23:30')).length + avisosSinResponder(sr, madrid('2026-11-17', '09:00')).length + avisosSinResponder(sr, madrid('2026-11-15', '20:30')).length, 0, 'pasado el margen, otro día o el día del plazo: nada');
  eq(avisosSinResponder(null, madrid('2026-11-16', '20:30')).length + avisosSinResponder({ ...sr, evento: null }, madrid('2026-11-16', '20:30')).length, 0, 'sin jornada, con el juego apagado o con la convocatoria publicada (la base devuelve null): nada');
}

console.log('\n== Marca de respuesta al domingo (antes de la convocatoria)');
{
  const r = { a: 'va', b: 'no', c: 'duda', d: 'sin_responder' };
  eq(['a', 'b', 'c', 'd'].map((id) => marcaRespuesta(r, id).texto), ['Va', 'No va', 'Duda', 'Sin responder'], '«Va», «No va», «Duda» y «Sin responder»');
  ok(CLASE_RESPUESTA[marcaRespuesta(r, 'd').clase] === 'fz-resp-sin' && CLASE_RESPUESTA[marcaRespuesta(r, 'a').clase] === 'pastilla-ok', '«Sin responder» va en rojo; «Va», en verde');
  ok(marcaRespuesta(r, 'z') === null && marcaRespuesta(null, 'a') === null && marcaRespuesta(undefined, 'a') === null, 'quien no está invitado, o con la convocatoria ya publicada, no lleva marca');
}

console.log('\n== Nombres de la hoja');
const fichas = [{ person_id: 'a', nombre_oficial: 'Méndez Escandón, Fernando' }, { person_id: 'b', nombre_oficial: 'Martínez Martínez, Andrés' }, { person_id: 'c', nombre_oficial: 'Martínez Martínez, Víctor' }];
const cn = casarNombres(['MENDEZ ESCANDON, FERNANDO ANTONIO', 'MARTINEZ MARTINEZ, ANDRES', 'MARTINEZ MARTINEZ', 'PEREZ, NADIE', 'APODO RARO'], fichas, { 'Apodo Raro': 'c' });
ok(cn.mapa.get('MENDEZ ESCANDON, FERNANDO ANTONIO') === 'a' && cn.aproximados.length === 1, 'un segundo nombre de más casa (y se dice)');
ok(cn.mapa.get('MARTINEZ MARTINEZ, ANDRES') === 'b', 'sin tildes ni mayúsculas');
ok(cn.sinCasar.includes('MARTINEZ MARTINEZ') && cn.sinCasar.includes('PEREZ, NADIE'), 'ambiguo o desconocido: sin casar, no se adivina');
ok(cn.mapa.get('APODO RARO') === 'c', 'un alias puesto a mano manda');

console.log('\n== Mánager');
const pts = new Map([['a', { rendimiento: 10, compromiso: 3, total: 13, minutos: 20 }], ['b', { rendimiento: 0, compromiso: 6, total: 6, minutos: 0 }], ['c', { rendimiento: 8, compromiso: -2, total: 6, minutos: 15 }], ['d', { rendimiento: 4, compromiso: 0, total: 4, minutos: 5 }], ['e', { rendimiento: 0, compromiso: 0, total: 0, minutos: 0 }], ['f', { rendimiento: 30, compromiso: 0, total: 30, minutos: 30 }]]);
const cinco = ['a', 'b', 'c', 'd', 'e'];
eq(puntosManager({ titulares: cinco, capitan: 'a', vice: 'c' }, pts, 0, P).total, 13 + 6 + 6 + 4 + 0 + 10, 'suma los 5 y el capitán dobla SOLO su rendimiento');
const sinCap = puntosManager({ titulares: cinco, capitan: 'b', vice: 'c' }, pts, 2, P);
ok(sinCap.dobla === 'c' && sinCap.alineacion === 29 + 8 && sinCap.porra === 6 && sinCap.total === 43, 'capitán sin minutos: hereda el vicecapitán; porra +3 por acierto', JSON.stringify(sinCap));
eq(puntosManager({ titulares: cinco, capitan: 'b', vice: 'e' }, pts, 0, P).dobla, null, 'ni capitán ni vice con minutos: nadie dobla');
eq(puntosManager({ titulares: [...cinco, 'f'], capitan: 'f', vice: null }, pts, 0, P).total, 29, 'un sexto alineado no cuenta (ni como capitán)');
eq(puntosManager({ titulares: ['a', 'zz'], capitan: 'a', vice: null }, pts, 0, P).total, 23, 'alineación incompleta o alguien sin puntos: suma lo que hay');
eq(arrastrar({ titulares: cinco, capitan: 'a', vice: 'c' }, ['a', 'b', 'c', 'd', 'e', 'f']), { titulares: cinco, capitan: 'c', vice: 'a' }, 'alineación arrastrada: capitán y vice se intercambian (el capitán no repite)');
eq(arrastrar({ titulares: cinco, capitan: 'a', vice: null }, cinco).capitan, 'b', '…sin vice, pasa a ser capitán otro alineado');
eq(arrastrar({ titulares: cinco, capitan: 'a', vice: 'c' }, ['a', 'b', 'd', 'e']), { titulares: ['a', 'b', 'd', 'e'], capitan: 'b', vice: 'a' }, '…y quien ya no está en la plantilla sale');

console.log('\n== Mercado');
eq(valor([10, 20, 0, 6, 100], P), 9, 'valor = media de las últimas 4 jornadas con datos');
eq(valor([1, 2], P), 4, 'mínimo 4 M');
eq(valor([], P), 4, 'sin jornadas: el mínimo');
eq(copiasPorJugador(25, 24, P), 9, 'copias: las justas para 25 mánagers × 7 con un 15 % de margen entre 24 jugadores');
eq(copiasPorJugador(1, 24, P), 1, 'al menos una');
ok(copiasPorJugador(25, 24, P) * 24 >= 25 * 7 && copiasPorJugador(25, 24, P) * 24 < 25 * 7 * 1.3, 'llegan para todos con poco margen libre');
eq(precioClausula(8.9, P), 13.4, 'clausulazo = valor × 1,5');
eq(ingreso(52, P), 3.6, 'ingreso de una jornada media (52 puntos): 1,5 + 0,04 × 52');
ok(Math.abs(3 * ingreso(52, P) - precioClausula(7.5, P)) < 1 && P.cajaInicial === 11, 'tres jornadas medias pagan el clausulazo de un jugador medio (7,5 M → 11,3 M); caja inicial 11 M');
ok(P.cajaInicial + 6 * ingreso(60, P) < precioClausula(31.5, P), 'el del más caro no se alcanza en 6 jornadas sin vender');

console.log('\n== Duelos');
for (const n of [2, 5, 8, 13]) {
  const ids = Array.from({ length: n }, (_, i) => `m${String(i).padStart(2, '0')}`);
  const rondas = n % 2 ? n : n - 1;
  const vistos = new Set();
  let bien = true;
  for (let r = 0; r < rondas; r++) {
    const pares = duelos(ids, r);
    const usados = pares.flatMap(([a, b]) => (b ? [a, b] : [a]));
    if (new Set(usados).size !== n) bien = false;
    for (const [a, b] of pares) if (b) { if (vistos.has(`${a}|${b}`)) bien = false; vistos.add(`${a}|${b}`); }
  }
  ok(bien && vistos.size === (n * (n - 1)) / 2, `${n} mánagers: en ${rondas} jornadas todos contra todos una vez${n % 2 ? ', con un descanso por jornada' : ''}`);
}
eq(duelos(['x', 'y', 'z'], 0), duelos(['z', 'x', 'y'], 0), 'el calendario no depende del orden de alta');
eq(duelos(['a'], 0), [], 'con un solo mánager no hay duelo');

console.log('\n== Parámetros');
ok(CLAVES.every((k) => AJUSTES[k] && P[k] >= AJUSTES[k].min && P[k] <= AJUSTES[k].max), 'cada parámetro tiene su texto y sus límites, y el valor de salida está dentro');
eq(parametros({ planton: -8, cajaInicial: 'x', noexiste: 3, plantilla: 99 }).planton, -8, 'se aplica lo cambiado…');
ok(parametros({ cajaInicial: 'x', plantilla: 99 }).cajaInicial === P.cajaInicial && parametros({ plantilla: 99 }).plantilla === P.plantilla, '…y lo que no es un número dentro de los límites se ignora');
eq(parametros({ alineados: 7, plantilla: 5 }).alineados, 5, 'no se alinea a más de los que caben en la plantilla');
eq([millones(13), millones(4.45), redondeo(-2.5)], ['13,0 M', '4,5 M', -3], 'formato de millones y redondeo simétrico');

console.log('\n== Una jornada entera');
const D = {
  fecha: '2026-11-22', huella: 'h', ronda: 0, parametros: {},
  jugadores: [{ person_id: 'a', nombre_oficial: 'Uno, Ana', nombre_visible: 'Ana' }, { person_id: 'b', nombre_oficial: 'Dos, Beto', nombre_visible: 'Beto' }, { person_id: 'c', nombre_oficial: 'Tres, Caro', nombre_visible: 'Caro' }],
  partidos: [{ equipo: 'MdA', rival: 'X', pts_favor: 60, pts_contra: 40, segundos_equipo: 14400, evento: 'p1' }, { equipo: 'MdL', rival: 'Y', pts_favor: 30, pts_contra: 50, segundos_equipo: 14400, evento: 'p2' }],
  lineas: [{ equipo: 'MdA', nombre: 'UNO, ANA', segundos: 1440, pts: 10, mas_menos: 16 }, { equipo: 'MdL', nombre: 'UNO, ANA', segundos: 1440, pts: 6, mas_menos: -4 }, { equipo: 'MdA', nombre: 'DESCONOCIDO, X', segundos: 600, pts: 2, mas_menos: 0 }],
  eventos: [{ id: 'en', tipo: 'entreno', equipo: 'ambos', fecha: '2026-11-18', inicio: '20:30:00', oficial: true }, { id: 'p1', tipo: 'liga', equipo: 'MdA', fecha: '2026-11-22', inicio: '10:15:00', oficial: true }, { id: 'p2', tipo: 'liga', equipo: 'MdL', fecha: '2026-11-22', inicio: '12:45:00', oficial: true }],
  estados: [
    { evento_id: 'en', person_id: 'a', estado: 'va', por: null, origen: 'jugador', cambiado_en: '2026-11-19T09:00:00Z', primera_en: '2026-11-16T09:00:00Z' },
    { evento_id: 'p1', person_id: 'a', estado: 'va', por: null, origen: 'jugador', cambiado_en: '2026-11-16T09:00:00Z', primera_en: null },
    { evento_id: 'p2', person_id: 'a', estado: 'va', por: null, origen: 'jugador', cambiado_en: '2026-11-16T09:01:00Z', primera_en: null },
    { evento_id: 'en', person_id: 'b', estado: 'sin_responder', por: null, origen: null, cambiado_en: null, primera_en: null },
    { evento_id: 'p1', person_id: 'b', estado: 'va', por: null, origen: 'jugador', cambiado_en: '2026-11-16T09:00:00Z', primera_en: null },
    { evento_id: 'en', person_id: 'c', estado: 'no', por: 'defecto', origen: null, cambiado_en: null, primera_en: null },
  ],
  avisos: [], asistencia: [{ evento_id: 'p1', person_id: 'b', estado: 'sin_excusa' }], convocados: ['a', 'b'],
  managers: [
    { person_id: 'm1', nombre: 'Eme', plantilla: ['a', 'b', 'c'], alineacion: { titulares: ['a', 'b', 'c'], capitan: 'b', vice: 'a' }, anterior: null, porras: { MdA: 'gana', MdL: 'gana' } },
    { person_id: 'm2', nombre: 'Ene', plantilla: ['a', 'c'], alineacion: null, anterior: { titulares: ['a', 'b'], capitan: 'a', vice: null }, porras: {} },
  ],
};
const pj = puntuarJornada(D, P);
const A = pj.puntos.get('a'), B = pj.puntos.get('b'), C = pj.puntos.get('c');
ok(A.doblete && A.rendimiento === redondeo((13 + 9) / 2 + 3) && A.compromiso === 6 && A.total === 20, 'Ana: dos partidos (13 y 9 → 11 + 3), entreno (+2 +2) y domingo (+2, una sola respuesta para los dos partidos)', JSON.stringify(A));
ok(A.unidades.length === 2, 'el domingo con dos partidos es UNA respuesta');
ok(B.rendimiento === 0 && B.compromiso === -2 + 2 - 5 && B.total === 0, 'Beto: no respondió al entreno (−2), respondió al domingo (+2), convocado sin salir en la hoja y confirmado: plantón (−5); total 0', JSON.stringify(B));
ok(C.compromiso === 0 && C.unidades.length === 1, 'Caro: «no va» por defecto al entreno (0) y sin ficha en ningún partido: sin domingo');
eq([pj.sinCasar, pj.convocadosSinHoja, pj.resultados], [['DESCONOCIDO, X'], ['b'], { MdA: 'gana', MdL: 'pierde' }], 'nombres sin casar, convocados sin hoja y resultados');
const c = cerrarJornada(D);
const m1 = c.guardar.managers.find((m) => m.manager === 'm1'), m2 = c.guardar.managers.find((m) => m.manager === 'm2');
ok(m1.detalle.dobla === 'a' && m1.alineacion === 20 + 14 + 0 + 0 && m1.porra === 3 && m1.total === 37, 'm1: su capitán no jugó, dobla el vice; un acierto de porra', JSON.stringify(m1));
ok(m2.detalle.capitan !== 'a' && c.guardar.arrastradas.length === 1 && c.guardar.arrastradas[0].titulares.join() === 'a', 'm2: alineación arrastrada, sin el que vendió y sin repetir capitán', JSON.stringify(c.guardar.arrastradas));
eq(m1.ingreso, ingreso(37, P), 'ingreso según los puntos');
eq(c.guardar.duelos, [{ a: 'm1', b: 'm2', puntos_a: 37, puntos_b: m2.total }], 'duelo de la jornada');
ok(c.guardar.logros.some((l) => l.manager === 'm1' && l.logro === 'mejor_jornada') && c.guardar.logros.some((l) => l.logro === 'duelo_ganado'), 'logros');
eq(JSON.stringify(cerrarJornada(D).guardar), JSON.stringify(c.guardar), 'el mismo dato da el mismo resultado (repetible)');

console.log('\n== Lo que pintan las pantallas');
const managers = [{ person_id: 'm1', nombre: 'Eme', alta_en: '' }, { person_id: 'm2', nombre: 'Ene', alta_en: '' }, { person_id: 'm3', nombre: 'Eñe', alta_en: '' }];
const pm = [{ jornada: '2026-11-08', manager: 'm1', total: 50, porra: 3 }, { jornada: '2026-11-08', manager: 'm2', total: 60, porra: 0 }, { jornada: '2026-11-15', manager: 'm1', total: 40, porra: 0 }, { jornada: '2026-11-15', manager: 'm2', total: 30, porra: 0 }, { jornada: '2026-12-13', manager: 'm1', total: 10, porra: 0 }];
const rk = rankingManagers(managers, pm);
eq(rk.map((m) => [m.nombre, m.total, m.puesto]), [['Eme', 100, 1], ['Ene', 90, 2], ['Eñe', 0, 3]], 'clasificación general');
eq(rankingManagers(managers, pm, '2026-11-01', '2026-11-31').map((m) => m.total), [90, 90, 0], '…y de un mes');
eq(rankingManagers(managers, pm, '2026-11-01', '2026-11-31').map((m) => [m.nombre, m.puesto]).slice(0, 2), [['Ene', 1], ['Eme', 2]], 'a igualdad de puntos, la mejor jornada');
const dl = [{ jornada: '2026-11-08', manager_a: 'm1', manager_b: 'm2', puntos_a: 50, puntos_b: 60 }, { jornada: '2026-11-15', manager_a: 'm1', manager_b: 'm2', puntos_a: 40, puntos_b: 30 }, { jornada: '2026-11-15', manager_a: 'm3', manager_b: null, puntos_a: 0, puntos_b: null }];
eq(rankingDuelos(managers, dl).map((m) => [m.nombre, m.g, m.e, m.p]), [['Eme', 1, 0, 1], ['Ene', 1, 0, 1], ['Eñe', 0, 0, 0]], 'clasificación de duelos (descansar no cuenta)');
const jug = [{ person_id: 'a', nombre: 'Ana', en_mercado: true }, { person_id: 'b', nombre: 'Beto', en_mercado: true }, { person_id: 'z', nombre: 'Zeta', en_mercado: false }];
const pjs = [{ jornada: '2026-11-08', person_id: 'a', rendimiento: 20, compromiso: 3, total: 23, minutos: 20, doblete: true, detalle: { unidades: [{ respuesta: 3, asistencia: 3 }] } }, { jornada: '2026-11-08', person_id: 'b', rendimiento: 5, compromiso: 9, total: 14, minutos: 5, doblete: false, detalle: { unidades: [{ respuesta: -2, asistencia: 0 }] } }];
eq(rankingJugadores(jug, pjs, 'compromiso').map((j) => j.nombre), ['Beto', 'Ana'], 'clasificación de compromiso (solo los que están en el mercado)');
const qi = quintetoIdeal(pjs, '2026-11-08');
ok(qi.jugadores[0].person_id === 'a' && qi.capitan === 'a' && qi.total === 23 + 14 + 20, 'quinteto ideal: los de más puntos, con el mejor rendimiento de capitán');
ok(['m2', 'm3', null].includes(rivalDe('m1', managers, [])?.person_id ?? null) && rivalDe('m1', [managers[0]], []) === null, 'rival de la jornada en juego');
eq(premiosDelMes('2026-11', managers, jug, pm, pjs).map((p) => [p.premio, p.nombre]), [['Mánager del mes', 'Ene'], ['Jugador del mes', 'Ana'], ['El más comprometido', 'Beto']], 'premios del mes');
const wa = resumenWhatsapp('2026-11-08', managers, jug, pm, pjs, dl);
ok(wa.includes('*MdFantasy · jornada del 8/11*') && wa.includes('🥇 Ene · 60 pts') && wa.includes('Eme 50 - 60 Ene') && wa.includes('Ana (23)'), 'resumen para WhatsApp: jornada, quinteto, duelos y general', wa);
ok(!/motivo|nivel|plant[oó]n/i.test(wa), 'el resumen no lleva nada privado');
eq(insignias('a', pjs).map((i) => i.clave), ['mvp', 'doblete', '20', 'compromiso'], 'insignias de la carta');

console.log('\n== D200: una respuesta importada de SportEasy (sin hora) cuenta como respondida antes del plazo');
{
  // Ana responde en la web; Beto solo tiene la fila importada («va», sin hora). Vale para cualquier jornada.
  const jornadaDe = (fecha) => ({
    fecha, huella: 'h', ronda: 0, parametros: {}, partidos: [], lineas: [], avisos: [], asistencia: [], convocados: [], managers: [],
    jugadores: [{ person_id: 'a', nombre_oficial: 'Uno, Ana', nombre_visible: 'Ana' }, { person_id: 'b', nombre_oficial: 'Dos, Beto', nombre_visible: 'Beto' }],
    eventos: [{ id: 'p1', tipo: 'liga', equipo: 'MdA', fecha, inicio: '10:15:00', oficial: true }],
    estados: [
      { evento_id: 'p1', person_id: 'a', estado: 'va', por: null, origen: 'jugador', cambiado_en: `${fecha.slice(0, 8)}${String(Number(fecha.slice(8)) - 6).padStart(2, '0')}T09:00:00Z`, primera_en: null },
      { evento_id: 'p1', person_id: 'b', estado: 'va', por: null, origen: 'sporteasy', cambiado_en: null, primera_en: null },
    ],
  });
  const dom = (r, id) => r.puntos.get(id).unidades.find((u) => u.clase === 'domingo');
  for (const f of ['2026-11-22', '2026-12-13']) {
    const r = puntuarJornada(jornadaDe(f), P);
    eq([dom(r, 'b').respuesta, dom(r, 'b').como], [P.respuestaATiempo, 'respondió antes del plazo'], `${f}: la importada, +1 «antes del plazo» (nunca «rápido»)`);
    ok(dom(r, 'a').respuesta > 0, `${f}: quien respondió en la web, igual`);
  }
}

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
