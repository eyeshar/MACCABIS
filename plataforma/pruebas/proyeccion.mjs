#!/usr/bin/env node
// Proyección de anotación (D124, recalibrada en D133), sin base de datos y con datos SINTÉTICOS: pesos de las dos
// temporadas (solo esta con 60 minutos), relleno por la letra de Ataque con menos de 60 minutos, reparto de 240 minutos
// con tope de 40, factor rival combinado (dificultad marcada, esta temporada e historial), corrección de sesgo, margen y
// calibración dejando uno fuera. Y los movimientos del modo rápido de la convocatoria (D125): mover, quitar, añadir,
// fichas y «no voy».
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

console.log('\n== a) Puntos por minuto: con 60 minutos esta temporada, solo ella (D133); si no, la actual pesa el doble');
const tasasVacias = { tasas: { A: 0.4, B: 0.3, C: 0.2, D: 0.1, E: 0.05 }, media: 0.2 };
let t = P.tasaDe(H(T(30, 100, 4), T(10, 100, 4)), 'C', tasasVacias);
ok(cerca(t.ppm, 0.3) && !t.pocosDatos, '100 minutos esta temporada (30 pts) y 100 la anterior (10): solo esta → 0,30', String(t.ppm));
t = P.tasaDe(H(T(12, 40, 2), T(10, 100, 4)), 'C', tasasVacias);
ok(cerca(t.ppm, (2 * 12 + 10) / (2 * 40 + 100)) && !t.pocosDatos, `40 minutos esta temporada: las dos, la actual el doble → (2·12+10)/(2·40+100) = ${(34 / 180).toFixed(4)}`, String(t.ppm));
P.PROYECCION.soloActual = false;
t = P.tasaDe(H(T(30, 100, 4), T(10, 100, 4)), 'C', tasasVacias);
ok(cerca(t.ppm, 70 / 300), 'con la regla de D124 (la validación la apaga para comparar): (2·30+10)/(2·100+100)', String(t.ppm));
P.PROYECCION.soloActual = true;
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
ok(cerca(P.minutosMedios(H(T(0, 40, 1), T(0, 90, 3))), (80 + 90) / (2 + 3)), 'media ponderada como la tasa: (2·40+90)/(2·1+3) = 34');
ok(cerca(P.minutosMedios(H(T(0, 60, 2), T(0, 150, 3))), 30), 'con 60 minutos esta temporada, su media de esta temporada (60/2 = 30)');

console.log('\n== c) Factor rival combinado (D133): dificultad marcada, esta temporada e historial, con un previo de 1');
const G = { pj: 20, pc: 800 }; // el grupo encaja 40 por partido
let f = P.factorRival({ pj: 2, pf: 100, pc: 120 }, G);
ok(cerca(f.factor, 1.5 ** (2 / 3)) && f.nota === null && f.encaja === 60 && f.anota === 50, `2 partidos encajando 60 con el grupo a 40: (1,5 con peso 2 y el previo 1 con peso 1) → 1,5^(2/3) = ${(1.5 ** (2 / 3)).toFixed(3)}`, String(f.factor));
ok(f.fuentes.join(' · ') === '2 partidos del rival', 'de dónde sale: «2 partidos del rival»', f.fuentes.join(' · '));
f = P.factorRival({ pj: 1, pf: 44, pc: 49 }, G);
ok(cerca(f.factor, Math.sqrt(49 / 40)) && f.nota === 'rival con pocos datos' && f.encaja === 49, 'con 1 partido ya cuenta, a medias con el previo (√(49/40)), y «rival con pocos datos»', String(f.factor));
f = P.factorRival(null, G);
ok(f.factor === 1 && f.nota === 'rival con pocos datos' && f.encaja === null && f.fuentes.join() === 'sin partidos del rival', 'sin nada del rival: factor 1, «sin partidos del rival»');
f = P.factorRival(null, G, { dificultad: 'baja' });
ok(cerca(f.factor, 1.15 ** (2 / 3)) && f.fuentes.join(' · ') === 'dificultad marcada: Baja · sin partidos del rival', `solo la dificultad marcada Baja (1,15, peso 2) → ${(1.15 ** (2 / 3)).toFixed(3)}`, f.fuentes.join(' · '));
f = P.factorRival(null, G, { dificultad: 'alta' });
ok(cerca(f.factor, 0.85 ** (2 / 3)), 'Alta → 0,85^(2/3)');
ok(cerca(P.factorRival(null, G, { dificultad: 'media' }).factor, 1), 'Media no mueve (1)');
f = P.factorRival(null, G, { historial: { temporada: '2025-26', factor: 1.4, pj: 20 } });
ok(cerca(f.factor, 1.4 ** 0.75) && f.nota === null && f.fuentes.at(-1) === 'historial 2025/26', 'historial de la temporada pasada (1,4, peso 3) → 1,4^(3/4); con historial ya no es «pocos datos»', String(f.factor));
f = P.factorRival(null, G, { historial: { temporada: '2023-24', factor: 1.4, pj: 20 } });
ok(cerca(f.factor, Math.exp((0.75 * Math.log(1.4)) / 1.75)) && f.fuentes.at(-1) === 'historial 2023/24', 'historial de hace tres temporadas: peso 3/4 (la mitad por cada temporada más atrás)', String(f.factor));
f = P.factorRival({ pj: 1, pf: 44, pc: 49 }, G, { dificultad: 'baja', historial: { temporada: '2025-26', factor: 1.4, pj: 20 } });
ok(cerca(f.factor, Math.exp((2 * Math.log(1.15) + Math.log(49 / 40) + 3 * Math.log(1.4)) / 7)), 'las tres a la vez: media geométrica con pesos 1 (previo), 2, 1 y 3');
ok(f.fuentes.join(' · ') === 'dificultad marcada: Baja · 1 partido del rival · historial 2025/26', '«dificultad marcada: Baja · 1 partido del rival · historial 2025/26»', f.fuentes.join(' · '));

console.log('\n== d) Corrección de sesgo: mediana de real / proyectado, a medio camino de 1 hasta los 8 partidos');
ok(P.correccionSesgo([]) === 1, 'sin partidos: 1');
ok(cerca(P.correccionSesgo([{ sinCorreccion: 50, real: 60 }, { sinCorreccion: 50, real: 55 }, { sinCorreccion: 50, real: 50 }]), (1 + 1.1) / 2), '3 partidos con 1,2 · 1,1 · 1,0: mediana 1,1 → a medio camino, 1,05');
ok(cerca(P.correccionSesgo([{ sinCorreccion: 50, real: 60 }, { sinCorreccion: 50, real: 50 }]), (1 + 1.1) / 2), 'con un número par, la media de los dos del centro');
const ocho = Array.from({ length: 8 }, (_, i) => ({ sinCorreccion: 50, real: 50 + i }));
ok(cerca(P.correccionSesgo(ocho), (53 + 54) / 2 / 50), 'con 8 partidos, la mediana entera (sin medio camino)');
ok(cerca(P.correccionSesgo(ocho.slice(0, 7)), (1 + 53 / 50) / 2), 'con 7, todavía a medio camino');

console.log('\n== e) Margen');
ok(P.margenDe(0) === 0.15 && P.margenDe(4) === 0.15 && P.margenDe(5) === 0.1 && P.margenDe(12) === 0.1, '±15 % con menos de 5 jornadas; ±10 % desde la 5.ª');

console.log('\n== Proyección completa (10 convocados sintéticos)');
const conv = Array.from({ length: 10 }, (_, i) => ({ person_id: `sint-${i + 1}`, nombre: `Sint ${String(i + 1).padStart(2, '0')}`, letra: 'C', hist: H(T(48, 240, 10)) }));
let pr = P.proyectar({ convocados: conv, tasas: tasasVacias, rival: null, grupo: null, jornadasJugadas: 2 });
ok(pr.puntos === 48 && pr.desde === 41 && pr.hasta === 55, '10 a 0,20 pts/min × 240 min, sin nada del rival: 48 (entre 41 y 55, ±15 %)', `${pr.puntos} ${pr.desde}-${pr.hasta}`);
ok(P.textoProyeccion(pr) === 'Proyección ≈ 48 puntos (entre 41 y 55)', '«Proyección ≈ 48 puntos (entre 41 y 55)»', P.textoProyeccion(pr));
ok(P.textoFactor(pr) === 'Factor rival 1,00: sin partidos del rival' && P.textoCorreccion(pr) === null, '«Factor rival 1,00: sin partidos del rival» y sin línea de corrección', P.textoFactor(pr));
pr = P.proyectar({ convocados: conv, tasas: tasasVacias, rival: { pj: 2, pf: 80, pc: 100 }, grupo: G, jornadasJugadas: 2, dificultad: 'baja', historial: { temporada: '2025-26', factor: 1.2, pj: 20 }, correccion: 1.05 });
const fEsp = Math.exp((2 * Math.log(1.15) + 2 * Math.log(1.25) + 3 * Math.log(1.2)) / 8);
ok(cerca(pr.factor, fEsp) && pr.puntos === Math.round(48 * fEsp * 1.05), `con dificultad Baja, 2 partidos del rival (1,25) e historial (1,2) y corrección ×1,05: 48 × ${fEsp.toFixed(3)} × 1,05 = ${Math.round(48 * fEsp * 1.05)}`, `${pr.factor} ${pr.puntos}`);
ok(P.textoFactor(pr) === `Factor rival ${fEsp.toFixed(2).replace('.', ',')}: dificultad marcada: Baja · 2 partidos del rival · historial 2025/26` && P.textoCorreccion(pr) === 'Corrección de sesgo ×1,05', `«${P.textoFactor(pr)}» · «${P.textoCorreccion(pr)}»`);
ok(P.textoRival(pr) === 'El rival encaja de media 50 y anota 40', '«El rival encaja de media 50 y anota 40»', P.textoRival(pr));
ok(cerca(pr.aportes.reduce((s, a) => s + a.puntos, 0), pr.exacta, 0.1) && pr.aportes.every((a) => a.puntos === pr.aportes[0].puntos), '«Quién aporta»: lo de cada uno ya lleva el factor y la corrección, y suman la proyección');
ok(!pr.bajoMinimo, `${pr.puntos} no baja de la anotación mínima (45)`);
pr = P.proyectar({ convocados: conv.slice(0, 7).map((c, i) => (i < 2 ? { ...c, hist: SIN, letra: 'E' } : c)), tasas: tasasVacias, rival: null, grupo: null, jornadasJugadas: 6 });
ok(pr.pocosDatos === 2 && pr.aportes.filter((a) => a.pocosDatos).length === 2, '«pocos datos» en los 2 sin minutos');
ok(pr.bajoMinimo && P.textoBajoMinimo(pr) === `Proyección ≈ ${pr.puntos} puntos: por debajo de la anotación mínima (45).`, `por debajo de 45 → aviso, sin cambiar la anotación mínima (${pr.puntos})`);
ok(pr.margen === 0.1 && pr.notaRival === 'rival con pocos datos', 'J6: ±10 %; sin rival, la nota');
const datos = { hist: Object.fromEntries(conv.map((c) => [c.person_id, c.hist])), letras: Object.fromEntries(conv.map((c) => [c.person_id, 'C'])), tasas: tasasVacias, partidos: { MdA: { rival: null, grupo: null, jornadas: 3, historial: null } }, calibracion: null };
ok(P.proyeccionDe(datos, 'MdA', conv.slice(0, 8)).puntos === 48 && P.proyeccionDe(datos, 'MdL', conv) === null, 'proyeccionDe: recalcula con los convocados de ahora (8 → 48); sin partido del MdL, nada');
ok(P.proyeccionDe(datos, 'MdA', conv.slice(0, 8), 'alta').puntos === Math.round(48 * 0.85 ** (2 / 3)), `y con la dificultad marcada (Alta → ${Math.round(48 * 0.85 ** (2 / 3))})`);
ok(P.proyeccionDe({ ...datos, correccion: 1.1 }, 'MdA', conv.slice(0, 8)).puntos === Math.round(48 * 1.1), 'y con la corrección de sesgo de los datos (×1,1 → 53)');

console.log('\n== Calibración con temporadas sintéticas (la corrección de cada partido, con los demás)');
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
const base = { actual, anterior, liga, clave, letra: () => 'C', nombre: (id) => id, plantilla: actual.players.map((p) => p.person_id) };
let puntos = P.calibrar(base);
ok(puntos.length === 2 && puntos[0].jornada === 1 && puntos[0].real === 50, 'un punto por partido nuestro cargado, con el resultado real');
ok(cerca(puntos[0].sinCorreccion, 240 * 8 / 60) && cerca(puntos[1].sinCorreccion, 40), 'sin corregir: J1 con la temporada anterior (8 por 60 min → 32); J2 con las dos (20 por 120 → 40; Rival Dos encaja lo del grupo)', `${puntos[0].sinCorreccion} ${puntos[1].sinCorreccion}`);
ok(puntos[0].proyeccion === Math.round(32 * (1 + 70 / 40) / 2) && puntos[1].proyeccion === Math.round(40 * (1 + 50 / 32) / 2), `dejando uno fuera: la J1 se corrige solo con la J2 (32 × 1,375 = ${Math.round(32 * 1.375)}) y la J2 solo con la J1 (40 × 1,281 = ${Math.round(40 * (1 + 50 / 32) / 2)})`, puntos.map((x) => x.proyeccion).join(' '));
ok(puntos.every((x) => x.error === Math.abs(x.proyeccion - x.real) && x.diferencia === x.proyeccion - x.real), 'el error es |proyección − real| y la diferencia lleva el signo');
let r = P.resumenCalibracion(puntos);
ok(r.partidos === 2 && r.sesgo === -12.5 && r.texto === 'Acierto de la proyección: error medio 12,5 puntos en 2 partidos · se queda corta en 12,5 puntos de media', `«${r.texto}»`);
ok(cerca(P.correccionSesgo(puntos), (1 + ((50 / 32 + 70 / 40) / 2)) / 2), 'la corrección para el próximo partido usa los dos (a medio camino)');
puntos = P.calibrar({ ...base, dificultad: (fecha, eq) => (fecha === '2026-10-18' && eq === 'MDA' ? 'baja' : null), historial: (rival) => (rival === 'Rival Uno' ? { temporada: '2025-26', factor: 0.8, pj: 20 } : null) });
ok(cerca(puntos[1].sinCorreccion, 40 * Math.exp((2 * Math.log(1.15)) / 4)) && cerca(puntos[0].sinCorreccion, 32 * 0.8 ** 0.75), 'con la dificultad marcada en la J2 (Baja) y el historial del rival de la J1 (0,8)', `${puntos[0].sinCorreccion} ${puntos[1].sinCorreccion}`);
const resumen = (difs) => P.resumenCalibracion(difs.map((d) => ({ error: Math.abs(d), diferencia: d })));
ok(resumen([3, 5]).texto.endsWith('· se pasa en 4 puntos de media'), '«se pasa en N puntos de media» si se pasa');
ok(resumen([2, -2]).texto.endsWith('· sin sesgo') && resumen([2, -2]).error === 2, '«sin sesgo» si se compensa');
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
