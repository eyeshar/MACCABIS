#!/usr/bin/env node
// Proyección de anotación (D124), sin base de datos y con datos SINTÉTICOS: pesos de las dos temporadas, relleno por la
// letra de Ataque con menos de 60 minutos, reparto de 240 minutos con tope de 40, factor rival, margen y calibración. Y
// los movimientos del modo rápido de la convocatoria (D125): mover, quitar, añadir, fichas y «no voy».
//
//   npm run pruebas:proyeccion

import * as P from '../src/lib/convocatoria/proyeccion.ts';
import * as V from '../src/lib/convocatoria/vista.ts';

let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };
const cerca = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const T = (pts, min, partidos) => ({ pts, min, partidos });
const H = (a, b = T(0, 0, 0)) => ({ actual: a, anterior: b });
const SIN = H(T(0, 0, 0));

console.log('\n== a) Puntos por minuto: la temporada actual pesa el doble');
const tasasVacias = { tasas: { A: 0.4, B: 0.3, C: 0.2, D: 0.1, E: 0.05 }, media: 0.2 };
let t = P.tasaDe(H(T(30, 100, 4), T(10, 100, 4)), 'C', tasasVacias);
ok(cerca(t.ppm, (2 * 30 + 10) / (2 * 100 + 100)) && !t.pocosDatos, `actual 30/100 y anterior 10/100 → (2·30+10)/(2·100+100) = ${(70 / 300).toFixed(4)}`, String(t.ppm));
t = P.tasaDe(H(T(0, 0, 0), T(50, 200, 8)), 'C', tasasVacias);
ok(cerca(t.ppm, 0.25) && !t.pocosDatos, 'solo la anterior: su tasa tal cual (0,25)');
console.log('\n== a) Con menos de 60 minutos: se completa con la tasa de su letra y «pocos datos»');
t = P.tasaDe(H(T(10, 20, 1)), 'A', tasasVacias);
ok(t.pocosDatos && cerca(t.ppm, (2 * 10 + 0.4 * 40) / (2 * 20 + 40)), '20 minutos con letra A: faltan 40 al 0,40 → (20+16)/(40+40) = 0,45', String(t.ppm));
t = P.tasaDe(SIN, 'D', tasasVacias);
ok(t.pocosDatos && cerca(t.ppm, 0.1), 'sin datos: la tasa de su letra (D = 0,10)');
t = P.tasaDe(SIN, null, tasasVacias);
ok(t.pocosDatos && cerca(t.ppm, 0.2), 'sin datos ni letra: la media de los calibrados (0,20)');
t = P.tasaDe(H(T(30, 59, 2)), 'B', tasasVacias);
ok(t.pocosDatos, '59 minutos: aún «pocos datos»');
t = P.tasaDe(H(T(30, 60, 2)), 'E', tasasVacias);
ok(!t.pocosDatos && cerca(t.ppm, 0.5), '60 minutos: ya manda su dato (0,50), no la letra');

console.log('\n== a) Tasa de cada letra, calibrada con los que tienen datos');
const cal = P.tasasPorLetra([
  { letra: 'A', hist: H(T(40, 100, 4)) }, { letra: 'A', hist: H(T(20, 100, 4)) },
  { letra: 'C', hist: H(T(15, 100, 4)) }, { letra: 'B', hist: H(T(50, 30, 1)) }, { letra: null, hist: H(T(25, 100, 4)) },
]);
ok(cerca(cal.tasas.A, (80 + 40) / 400), 'A = puntos/minutos ponderados de sus dos jugadores (0,30)', String(cal.tasas.A));
ok(cerca(cal.tasas.C, 0.15), 'C = 0,15');
ok(cerca(cal.tasas.B, cal.media) && !cal.calibradas.includes('B'), 'B (solo uno con 30 minutos) no se calibra: toma la media', JSON.stringify(cal.calibradas));
ok(cerca(cal.media, (80 + 40 + 30 + 50) / 800), 'la media cuenta también a quien no tiene letra (0,25)', String(cal.media));

console.log('\n== b) Minutos: 240 por partido, según sus medias, con tope de 40');
let m = P.repartirMinutos([20, 20, 20, 20, 20, 20, 20, 20, 20, 20]);
ok(m.every((x) => cerca(x, 24)) && cerca(m.reduce((a, b) => a + b), 240), '10 iguales → 24 minutos cada uno, 240 en total');
m = P.repartirMinutos([38, 30, 10, 10, 10, 10, 10, 10]);
ok(cerca(m[0], 40) && m.every((x) => x <= 40 + 1e-9) && cerca(m.reduce((a, b) => a + b), 240), 'quien pasaría de 40 se queda en 40 y lo suyo se reparte (siguen sumando 240)', m.map((x) => x.toFixed(1)).join(' '));
m = P.repartirMinutos([20, 20, 20, 20, 20]);
ok(m.every((x) => x === 40), 'con 5 jugadores, todos 40 (no se puede llegar a 240)');
ok(P.minutosMedios(SIN) === 20, 'sin partidos: 20 minutos de media');
ok(cerca(P.minutosMedios(H(T(0, 60, 2), T(0, 90, 3))), (120 + 90) / (4 + 3)), 'media ponderada como la tasa: (2·60+90)/(2·2+3) = 30');

console.log('\n== c) Factor rival');
let f = P.factorRival({ pj: 2, pf: 100, pc: 120 }, { pj: 20, pc: 800 });
ok(cerca(f.factor, 60 / 40) && f.nota === null && f.encaja === 60 && f.anota === 50, 'encaja 60 por partido con el grupo a 40 → factor 1,5; «encaja 60 y anota 50»');
f = P.factorRival({ pj: 1, pf: 44, pc: 49 }, { pj: 20, pc: 800 });
ok(f.factor === 1 && f.nota === 'rival con pocos datos' && f.encaja === 49, 'con 1 partido: factor 1 y «rival con pocos datos» (pero se dice cuánto encaja)');
f = P.factorRival(null, { pj: 20, pc: 800 });
ok(f.factor === 1 && f.nota === 'rival con pocos datos' && f.encaja === null, 'sin partidos del rival: factor 1');

console.log('\n== d) Margen');
ok(P.margenDe(0) === 0.15 && P.margenDe(4) === 0.15 && P.margenDe(5) === 0.1 && P.margenDe(12) === 0.1, '±15 % con menos de 5 jornadas; ±10 % desde la 5.ª');

console.log('\n== Proyección completa (10 convocados sintéticos)');
const conv = Array.from({ length: 10 }, (_, i) => ({ person_id: `sint-${i + 1}`, nombre: `Sint ${String(i + 1).padStart(2, '0')}`, letra: 'C', hist: H(T(48, 240, 10)) }));
let pr = P.proyectar({ convocados: conv, tasas: tasasVacias, rival: { pj: 2, pf: 80, pc: 100 }, grupo: { pj: 20, pc: 800 }, jornadasJugadas: 2 });
ok(pr.puntos === Math.round(240 * 0.2 * 1.25) && pr.puntos === 60, '10 a 0,20 pts/min × 240 min × factor 1,25 = 60', String(pr.puntos));
ok(pr.desde === 51 && pr.hasta === 69, 'entre 51 y 69 (±15 %, J2)', `${pr.desde}-${pr.hasta}`);
ok(P.textoProyeccion(pr) === 'Proyección ≈ 60 puntos (entre 51 y 69)', '«Proyección ≈ 60 puntos (entre 51 y 69)»', P.textoProyeccion(pr));
ok(P.textoRival(pr) === 'El rival encaja de media 50 y anota 40', '«El rival encaja de media 50 y anota 40»', P.textoRival(pr));
ok(pr.aportes.length === 10 && cerca(pr.aportes.reduce((s, a) => s + a.puntos, 0), 60, 0.1) && pr.aportes.every((a) => a.puntos === 6), '«Quién aporta»: 6 puntos cada uno, suman la proyección');
ok(!pr.bajoMinimo, '60 no baja de la anotación mínima (45)');
pr = P.proyectar({ convocados: conv.slice(0, 7).map((c, i) => (i < 2 ? { ...c, hist: SIN, letra: 'E' } : c)), tasas: tasasVacias, rival: null, grupo: null, jornadasJugadas: 6 });
ok(pr.pocosDatos === 2 && pr.aportes.filter((a) => a.pocosDatos).length === 2, '«pocos datos» en los 2 sin minutos');
ok(pr.bajoMinimo && P.textoBajoMinimo(pr) === `Proyección ≈ ${pr.puntos} puntos: por debajo de la anotación mínima (45).`, `por debajo de 45 → aviso (${pr.puntos})`);
ok(pr.margen === 0.1 && pr.notaRival === 'rival con pocos datos', 'J6: ±10 %; sin rival, la nota');
const datos = { hist: Object.fromEntries(conv.map((c) => [c.person_id, c.hist])), letras: Object.fromEntries(conv.map((c) => [c.person_id, 'C'])), tasas: tasasVacias, partidos: { MdA: { rival: null, grupo: null, jornadas: 3 } }, calibracion: null };
ok(P.proyeccionDe(datos, 'MdA', conv.slice(0, 8)).puntos === 48 && P.proyeccionDe(datos, 'MdL', conv) === null, 'proyeccionDe: recalcula con los convocados de ahora (8 → 48); sin partido del MdL, nada');

console.log('\n== Calibración con temporadas sintéticas');
const jugador = (id, games) => ({ person_id: id, games });
const juego = (pn, eq, pts, min) => ({ pn, eq, pts, sec: min * 60, played: true });
const actual = {
  partidos: [{ pn: 1, equipo: 'MDA', fecha: '2026-10-04', pf: 50, rival: 'Rival Uno' }, { pn: 2, equipo: 'MDA', fecha: '2026-10-18', pf: 70, rival: 'Rival Dos' }],
  players: Array.from({ length: 8 }, (_, i) => jugador(`sint-${i + 1}`, [juego(1, 'MDA', 6, 30), juego(2, 'MDA', i < 4 ? 12 : 6, 30)])),
};
const anterior = { partidos: [], players: Array.from({ length: 8 }, (_, i) => jugador(`sint-${i + 1}`, [juego(5, 'MDA', 4, 30), juego(6, 'MDA', 4, 30)])) };
const liga = { grupos: { G1: { nuestro: 'MDA', jornadas_cargadas: [1, 2], resultados: [
  { jornada: 1, local: 'MdA', visitante: 'Rival Uno', pl: 50, pv: 30 }, { jornada: 1, local: 'Rival Dos', visitante: 'Otro', pl: 40, pv: 40 },
  { jornada: 2, local: 'MdA', visitante: 'Rival Dos', pl: 70, pv: 20 }, { jornada: 2, local: 'Rival Uno', visitante: 'Otro', pl: 30, pv: 60 },
] } } };
const clave = (n) => n.toLowerCase();
const h1 = P.historiales(actual, anterior, 1);
ok(h1('sint-1').actual.partidos === 0 && h1('sint-1').anterior.partidos === 2, 'antes de la J1 solo cuenta la temporada anterior');
const g2 = P.estadisticasGrupo(liga, 'G1', clave, 2);
ok(g2.jornadas === 1 && g2.rival('Rival Dos').pj === 1 && g2.rival('RIVAL DOS').pc === 40, 'la liga antes de la J2: solo la J1 (y los nombres se comparan con su clave)');
const puntos = P.calibrar({ actual, anterior, liga, clave, letra: () => 'C', nombre: (id) => id, plantilla: actual.players.map((p) => p.person_id) });
ok(puntos.length === 2 && puntos[0].jornada === 1 && puntos[0].real === 50, 'un punto por partido nuestro cargado, con el resultado real');
ok(puntos[0].proyeccion === Math.round(240 * (4 + 4) / 60), `J1: con la temporada anterior (8 por 60 min → ${Math.round(240 * 8 / 60)})`, String(puntos[0].proyeccion));
ok(puntos.every((x) => x.error === Math.abs(x.proyeccion - x.real)), 'el error es |proyección − real|');
const r = P.resumenCalibracion(puntos);
ok(r.partidos === 2 && r.texto === `Acierto de la proyección: error medio ${String(r.error).replace('.', ',')} puntos en 2 partidos`, `«${r.texto}»`);
ok(P.resumenCalibracion([]) === null, 'sin partidos, sin línea de acierto');

console.log('\n== Modo rápido (D125): mover entre equipos y «sin convocar»');
const C = { MdA: [{ person_id: 'a' }, { person_id: 'b' }], MdL: [{ person_id: 'c' }] };
let mv = V.moverRapido(C, ['a'], 'MdA', 'MdL', ['MdA', 'MdL']);
ok(mv.accion === 'mover' && mv.conv.MdA.map((x) => x.person_id).join() === 'b' && mv.conv.MdL.map((x) => x.person_id).join() === 'c,a', 'del MdA al MdL: sale de uno y entra en el otro');
mv = V.moverRapido(C, ['c'], 'MdL', 'sin', ['MdA', 'MdL']);
ok(mv.accion === 'quitar' && mv.conv.MdL.length === 0 && mv.conv.MdA.length === 2, 'a «sin convocar»: sale de su equipo');
mv = V.moverRapido(C, ['z'], 'sin', 'MdA', ['MdA', 'MdL']);
ok(mv.accion === 'anadir' && mv.conv.MdA.some((x) => x.person_id === 'z'), 'de «sin convocar» al MdA: entra');
mv = V.moverRapido({ MdA: [{ person_id: 'd' }], MdL: [{ person_id: 'd' }] }, ['d'], 'MdA', 'sin', ['MdA', 'MdL']);
ok(mv.conv.MdA.length === 0 && mv.conv.MdL.length === 1, 'quien dobla y se suelta en «sin convocar» desde el MdA sigue en el MdL');
mv = V.moverRapido(C, ['a', 'c'], null, 'MdL', ['MdA', 'MdL']);
ok(mv.conv.MdL.map((x) => x.person_id).sort().join() === 'a,c' && !mv.conv.MdA.some((x) => x.person_id === 'a'), '«Mover a… MdL» con una selección de los dos equipos');
const J = [
  { person_id: 'a', nombre: 'Sint A', ficha: { MdA: true, MdL: false }, respuesta: { MdA: 'va', MdL: 'va' } },
  { person_id: 'c', nombre: 'Sint C', ficha: { MdA: true, MdL: true }, respuesta: { MdA: 'no', MdL: 'va' } },
];
let v = V.validarDestino(['a'], 'MdL', J);
ok(!v.valido && v.motivo === 'Sin ficha del MdL: Sint A', 'zona no válida: sin ficha del MdL (regla 1.5)', v.motivo);
v = V.validarDestino(['c'], 'MdA', J);
ok(v.valido && v.avisos[0] === 'Sint C dijo «no voy» a este partido.', 'quien dijo «no voy» se puede soltar, con aviso');
ok(V.validarDestino(['a', 'c'], 'sin', J).valido, '«sin convocar» siempre vale');

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
