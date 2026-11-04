#!/usr/bin/env node
// «Tu próximo partido» (D171): la regla de qué partido se enseña y los estados exactos de la Agenda. Lógica pura
// (src/lib/respuestas/dominio.ts), sin base de datos ni navegador.
//   - Con la convocatoria aprobada: solo si está CONVOCADO. Sin convocatoria: solo si su respuesta es va, duda o sin responder.
//   - «No va», no convocado o de baja/lesión: ese partido se salta al siguiente que cumpla; la línea de «Este domingo no juegas».
//   - Agenda: Convocado · No convocado · Vas · No vas · Duda · Sin responder · Lesión; «No convocado» y «No vas» nunca se confunden.
//
//   npm run pruebas:proximo-partido
import * as D from '../src/lib/respuestas/dominio.ts';

let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };

const HOY = '2026-11-04'; // miércoles; domingos: 08/11, 15/11, 22/11
const ev = (id, equipo, fecha) => ({ id, tipo: 'liga', equipo, titulo: null, jornada: 4, rival: 'RIVAL', es_local: true, fecha, inicio: '10:00', fin: null, quedada: null, notas: null, estado: 'programado',
  cambio_visible: null, cambio_visible_en: null, pista_nombre: null, pista_nombre_corto: null, pista_direccion: null, numero_pista: null, pista_por_confirmar: false, pista_motivo: null });
const eventos = [ev('a8', 'MdA', '2026-11-08'), ev('l8', 'MdL', '2026-11-08'), ev('a15', 'MdA', '2026-11-15'), ev('l15', 'MdL', '2026-11-15'), ev('l22', 'MdL', '2026-11-22')];
const us = D.unidades(eventos).filter((u) => u.tipo === 'domingo');
const R = (evento_id, respuesta, o = {}) => ({ evento_id, respuesta, motivo: o.motivo ?? null, detalle: null, ausencia_id: o.ausencia_id ?? null });
const prox = (conv, resp, aus = []) => D.proximoPartido(us, conv, resp, aus);
const ids = (p) => p.partidos.map((e) => e.id).join();

console.log('\n== Con convocatoria aprobada: solo si está convocado');
{
  const p = prox([{ fecha: '2026-11-08', equipos: ['MdL'] }], []);
  ok(p.unidad.fecha === '2026-11-08' && ids(p) === 'l8' && p.convocado && !p.saltado, 'convocado al MdL: sale su partido (y solo el del MdL)', ids(p));
  ok(D.pastillaProximo(p, [{ fecha: '2026-11-08', equipos: ['MdL'] }], [], []).texto === 'Convocado · MdL', 'pastilla «Convocado · MdL»');
  const p2 = prox([{ fecha: '2026-11-08', equipos: ['MdA', 'MdL'] }], []);
  ok(ids(p2) === 'a8,l8' && D.pastillaProximo(p2, [{ fecha: '2026-11-08', equipos: ['MdA', 'MdL'] }], [], []).texto === 'Convocado · MdA y MdL', 'convocado a los dos: los dos, «Convocado · MdA y MdL»');
}
console.log('\n== No convocado: se salta (aunque su respuesta sea «va» o «no»)');
{
  const conv = [{ fecha: '2026-11-08', equipos: [] }];
  for (const [nombre, resp] of [['sin responder', []], ['va', [R('a8', 'va'), R('l8', 'va')]], ['no (el caso de Víctor)', [R('l8', 'no', { motivo: 'otro' })]]]) {
    const p = prox(conv, resp);
    ok(p.unidad.fecha === '2026-11-15' && p.saltado?.fecha === '2026-11-08' && p.saltado.motivo === 'no_convocado', `no convocado con respuesta «${nombre}»: sale el 15/11 y la línea dice «no convocado»`, JSON.stringify(p.saltado));
  }
  ok(D.textoSalto({ fecha: '2026-11-08', motivo: 'no_convocado' }, HOY) === 'Este domingo no juegas (no convocado)', 'línea: «Este domingo no juegas (no convocado)»');
  const soloUno = prox([{ fecha: '2026-11-08', equipos: ['MdA'] }], [R('l8', 'va')]);
  ok(ids(soloUno) === 'a8', 'convocado al MdA pero no al MdL: solo el MdA, aunque haya dicho que va al MdL', ids(soloUno));
}
console.log('\n== Sin convocatoria aún: va, duda o sin responder');
{
  ok(ids(prox([], [R('a8', 'va'), R('l8', 'va')])) === 'a8,l8', 'va: sus partidos');
  ok(prox([], [R('a8', 'duda')]).unidad.fecha === '2026-11-08', 'duda: sale');
  const sr = prox([], []);
  ok(sr.unidad.fecha === '2026-11-08' && sr.convocatoriaPendiente && D.pastillaProximo(sr, [], [], []).texto === 'Sin responder', 'sin responder: sale, con «Sin responder» (y la web le pone el botón para responder)');
  const rv = [R('a8', 'va'), R('l8', 'va')], rd = [R('a8', 'duda'), R('l8', 'duda')];
  ok(/^Vas/.test(D.pastillaProximo(prox([], rv), [], rv, []).texto), 'va: pastilla «Vas»');
  ok(D.pastillaProximo(prox([], rd), [], rd, []).texto === 'Duda', 'duda: «Duda»');
  const parcial = prox([], [R('l8', 'no'), R('a8', 'va')]);
  ok(ids(parcial) === 'a8' && !parcial.saltado, '«no» al MdL y va al MdA: solo el MdA');
}
console.log('\n== «No va», de baja o lesionado: se salta al siguiente que cumpla');
{
  const p = prox([], [R('a8', 'no'), R('l8', 'no')]);
  ok(p.unidad.fecha === '2026-11-15' && p.saltado.motivo === 'no_va', 'no va a ninguno: sale el 15/11', JSON.stringify(p.saltado));
  ok(D.textoSalto(p.saltado, HOY) === 'Este domingo no juegas (has dicho que no vas)', 'línea: «Este domingo no juegas (has dicho que no vas)»');
  const nc = prox([], [R('a8', 'no', { motivo: 'no_confirmo' }), R('l8', 'no', { motivo: 'no_confirmo' })]);
  ok(nc.saltado.motivo === 'no_confirmo' && D.textoSalto(nc.saltado, HOY) === 'Este domingo no juegas (no confirmaste a tiempo)', 'el «no» del cierre de dudas (no_confirmo): «no confirmaste a tiempo», no «has dicho que no vas»', JSON.stringify(nc.saltado));
  const aus = [{ id: 'x', desde: '2026-11-05', hasta: '2026-11-09', motivo: 'lesion', detalle: null, borrada_en: null }];
  const b = prox([], [], aus);
  ok(b.unidad.fecha === '2026-11-15' && b.saltado.motivo === 'baja', 'de baja (ausencia por periodo) y sin responder: se salta', JSON.stringify(b.saltado));
  ok(D.textoSalto(b.saltado, HOY) === 'Este domingo no juegas (estás de baja)', 'línea de baja');
  const b2 = prox([], [R('a8', 'no', { ausencia_id: 'x' }), R('l8', 'no', { ausencia_id: 'x' })], aus);
  ok(b2.saltado.motivo === 'baja', 'el «no» que puso la ausencia cuenta como baja, no como «has dicho que no»');
  ok(D.textoSalto({ fecha: '2026-11-22', motivo: 'no_convocado' }, HOY) === 'El domingo 22 de noviembre no juegas (no convocado)', 'si el domingo saltado queda a más de una semana, con su fecha');
}
console.log('\n== Sin partidos próximos');
{
  const todo = prox([{ fecha: '2026-11-08', equipos: [] }, { fecha: '2026-11-15', equipos: [] }, { fecha: '2026-11-22', equipos: [] }], []);
  ok(todo.unidad === null && todo.partidos.length === 0 && todo.saltado?.motivo === 'no_convocado', 'sin ninguno que cumpla: unidad null (la tarjeta dice «No tienes partidos próximos») y la línea del domingo saltado');
  ok(D.pastillaProximo(todo, [], [], []) === null, 'sin pastilla');
  const vacio = D.proximoPartido([], [], [], []);
  ok(vacio.unidad === null && vacio.saltado === null, 'sin domingos en el calendario: nada');
  const sinLiga = prox([], [R('a8', 'no'), R('l8', 'no'), R('a15', 'no'), R('l15', 'no'), R('l22', 'no')]);
  ok(sinLiga.unidad === null && sinLiga.saltado.fecha === '2026-11-08', 'dijo que no a todos: «No tienes partidos próximos»');
}
console.log('\n== Agenda: el estado exacto de cada evento');
{
  const dom = us[0]; // 08/11, MdA y MdL
  const entreno = D.unidades([{ ...ev('e1', 'ambos', '2026-11-05'), tipo: 'entreno' }])[0];
  const P = (u, conv, resp, aus = [], pd) => D.pastillaAgenda(u, resp, aus, conv, pd);
  ok(P(dom, [{ fecha: '2026-11-08', equipos: ['MdA'] }], []).texto === 'Convocado · MdA', 'Convocado · MdA');
  ok(P(dom, [{ fecha: '2026-11-08', equipos: [] }], []).texto === 'No convocado', 'No convocado (convocatoria aprobada sin él)');
  ok(P(dom, [{ fecha: '2026-11-08', equipos: [] }], [R('a8', 'no'), R('l8', 'no')]).texto === 'No convocado', 'No convocado aunque haya dicho que no: nunca «No vas» en su lugar');
  ok(P(dom, [], [R('a8', 'no'), R('l8', 'no')]).texto === 'No vas', 'No vas (sin convocatoria, respondió no)');
  ok(P(dom, [], [R('a8', 'va'), R('l8', 'va')]).texto.startsWith('Vas'), 'Vas');
  ok(P(dom, [], [R('a8', 'duda'), R('l8', 'duda')]).texto === 'Duda', 'Duda');
  ok(P(dom, [], []).texto === 'Sin responder', 'Sin responder');
  ok(P(entreno, [], [R('e1', 'no', { motivo: 'lesion' })]).texto === 'Lesión', 'Lesión (respondió «no» por lesión)');
  ok(P(entreno, [], [], [{ id: 'x', desde: '2026-11-01', hasta: null, motivo: 'lesion', detalle: null, borrada_en: null }]).texto === 'Lesión', 'Lesión (ausencia por lesión)');
  ok(P(entreno, [], [R('e1', 'no', { motivo: 'trabajo' })]).texto === 'No vas', 'No vas por trabajo sigue siendo «No vas»');
  ok(P(entreno, [], [], [{ id: 'x', desde: '2026-11-01', hasta: '2026-11-30', motivo: 'viaje', detalle: null, borrada_en: null }]).texto === 'Ausente · Viaje', 'ausencia por otro motivo: «Ausente · Viaje», como siempre');
  ok(new Set(['Convocado · MdA', 'No convocado', 'No vas', 'Sin responder']).size === 4 && P(dom, [{ fecha: '2026-11-08', equipos: [] }], []).clase === 'noconv' && P(dom, [], [R('a8', 'no'), R('l8', 'no')]).clase === 'novas', '«No convocado» y «No vas» tienen texto y clase distintos');
}

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
