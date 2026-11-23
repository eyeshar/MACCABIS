#!/usr/bin/env node
// Cálculo de «Asistencia y motivos» rediseñada (D170): src/lib/eventos/asistenciaPantalla.ts. Lógica pura, sin base de
// datos ni navegador. Datos sintéticos.
//   - Exclusión de «no convocado» y lesión; faltas = con excusa + sin excusa; TOTAL suma fue y faltas (no la media).
//   - Suma de varias temporadas; mínimo de 5 eventos; marca «aprox.» en las temporadas anteriores a 2025/26.
//   - Equipo, periodo «últimas 4 semanas», tendencia (±10 puntos), plantilla actual, orden por cada columna.
//   - 2025/26: mandan los totales corregidos a mano (D72); el detalle de SportEasy solo en «últimos 10 eventos».
//   - Ficha: % por temporada, motivos y últimos 10 eventos.
//   - Pase de lista (D192): manda sobre la respuesta de la plataforma en vivo para esa persona y ese evento (no suma dos
//     veces); estado por defecto (copia la respuesta) y hora de apertura (al terminar el evento).
//
//   npm run pruebas:asistencia-calculo
import * as P from '../src/lib/eventos/asistenciaPantalla.ts';
import * as A from '../src/lib/eventos/asistencia.ts';
import * as PL from '../src/lib/eventos/paseDeLista.ts';

let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };
const HOY = '2026-11-02';
let n = 0;
const ev = (person_id, fecha, estado, o = {}) => ({
  person_id, nombre: o.nombre ?? person_id.toUpperCase(), temporada: o.temporada ?? '2026-27', evento_ref: `e${++n}`, fecha,
  ambito: o.ambito ?? 'entrenos', equipo: o.ambito === 'partidos' ? (o.equipo ?? 'MdA') : null, titulo: o.titulo ?? null, estado, motivo: o.motivo ?? null, origen: o.origen ?? 'sporteasy',
});
const rep = (k, ...a) => Array.from({ length: k }, () => ev(...a));
const todos = (extra = {}) => ({ temporadas: ['2026-27'], ver: 'todos', equipo: 'todos', periodo: 'temporada', ...extra });
const calc = (filas, f = todos(), totales = [], actuales = null) => P.calcularJugadores({ filas, totales, hoy: HOY }, f, actuales);
const por = (js, id) => js.find((j) => j.person_id === id);

console.log('\n== Cómo se cuenta');
{
  const filas = [...rep(6, 'a', '2026-09-10', 'fue'), ...rep(2, 'a', '2026-09-11', 'con_excusa'), ...rep(1, 'a', '2026-09-12', 'sin_excusa'),
    ...rep(3, 'a', '2026-09-13', 'no_convocado'), ...rep(4, 'a', '2026-09-14', 'lesion')];
  const a = por(calc(filas), 'a');
  ok(a.entrenos.fue === 6 && a.entrenos.faltas === 3 && P.eventosDe(a.entrenos) === 9, 'fue 6, faltas 3 (2 con excusa + 1 sin excusa); no convocado y lesión no cuentan', JSON.stringify(a.entrenos));
  ok(Math.abs(a.pctEntrenos - 6 / 9) < 1e-9 && a.sin === 1, 'asistencia = fue / (fue + faltas) = 67 %; «Sin excusa» = 1', String(a.pctEntrenos));
  ok(P.textoPct(a.pctEntrenos) === '67 %' && P.textoPct(null) === '—', 'texto del porcentaje');
  const soloFuera = calc(rep(4, 'b', '2026-09-10', 'no_convocado').concat(rep(2, 'b', '2026-09-11', 'lesion')));
  ok(!por(soloFuera, 'b'), 'quien solo tiene no convocado o lesión no tiene nada que contar y no sale');
}
{
  // 1/10 en entrenos (10 %) y 2/2 en partidos (100 %): la media de porcentajes sería 55 %; sumando, 3/12 = 25 %.
  const filas = [ev('a', '2026-09-01', 'fue'), ...rep(9, 'a', '2026-09-02', 'con_excusa'), ...rep(2, 'a', '2026-09-20', 'fue', { ambito: 'partidos' })];
  const a = por(calc(filas), 'a');
  ok(P.textoPct(a.pctEntrenos) === '10 %' && P.textoPct(a.pctPartidos) === '100 %' && P.textoPct(a.pctTotal) === '25 %', 'TOTAL suma fue y faltas (3/12 = 25 %), no la media de porcentajes (55 %)', P.textoPct(a.pctTotal));
}

console.log('\n== Varias temporadas: se suman');
{
  const filas = [...rep(2, 'a', '2026-09-01', 'fue'), ...rep(2, 'a', '2026-09-02', 'sin_excusa'), ...rep(6, 'a', '2025-09-01', 'fue', { temporada: '2025-26' }), ...rep(0, 'a', '2025-09-02', 'fue')];
  const una = por(calc(filas, todos()), 'a');
  const dos = por(calc(filas, todos({ temporadas: ['2026-27', '2025-26'] })), 'a');
  ok(P.eventosDe(una.total) === 4 && P.eventosDe(dos.total) === 4, 'sin totales corregidos de 2025/26, solo cuenta lo que hay (aquí 2025/26 no tiene totales: no se suma el detalle)', JSON.stringify(dos.total));
  const antiguas = [...rep(8, 'a', '2018-10-01', 'fue', { temporada: '2018-19' }), ...rep(2, 'a', '2018-10-02', 'con_excusa', { temporada: '2018-19' }), ...rep(3, 'a', '2019-10-01', 'fue', { temporada: '2019-20' }), ...rep(7, 'a', '2019-10-02', 'con_excusa', { temporada: '2019-20' }), ...rep(5, 'a', '2026-09-01', 'fue')];
  const s = por(calc(antiguas, todos({ temporadas: ['2026-27', '2019-20', '2018-19'] })), 'a');
  ok(s.total.fue === 16 && P.eventosDe(s.total) === 25 && P.textoPct(s.pctTotal) === '64 %', 'con varias temporadas todo se suma (16/25 = 64 %; la media de las tres daría 70 %)', JSON.stringify(s.total));
}

console.log('\n== Mínimo de 5 eventos y orden');
{
  const filas = [...rep(5, 'a', '2026-09-01', 'fue'), ...rep(4, 'b', '2026-09-01', 'fue'), ...rep(3, 'c', '2026-09-01', 'fue'), ...rep(2, 'c', '2026-09-02', 'con_excusa'), ev('d', '2026-09-01', 'fue')];
  const { ranking, pocos } = P.separar(calc(filas));
  ok(ranking.map((j) => j.person_id).sort().join() === 'a,c' && pocos.map((j) => j.person_id).sort().join() === 'b,d', 'con 5 o más eventos contables, al ranking; con menos, debajo («Menos de 5 eventos»)');
}
{
  const filas = [
    ...rep(8, 'ana', '2026-09-01', 'fue', { nombre: 'Ana' }), ...rep(2, 'ana', '2026-09-02', 'con_excusa', { nombre: 'Ana' }), ...rep(5, 'ana', '2026-09-20', 'fue', { ambito: 'partidos', nombre: 'Ana' }),
    ...rep(3, 'beto', '2026-09-01', 'fue', { nombre: 'Beto' }), ...rep(5, 'beto', '2026-09-02', 'sin_excusa', { nombre: 'Beto' }), ...rep(2, 'beto', '2026-09-20', 'fue', { ambito: 'partidos', nombre: 'Beto' }), ...rep(3, 'beto', '2026-09-27', 'sin_excusa', { ambito: 'partidos', nombre: 'Beto' }),
    ...rep(5, 'cira', '2026-09-01', 'con_excusa', { nombre: 'Cira' }), ...rep(5, 'cira', '2026-09-02', 'fue', { nombre: 'Cira' }), ...rep(1, 'cira', '2026-09-20', 'con_excusa', { ambito: 'partidos', nombre: 'Cira' }), ...rep(5, 'cira', '2026-09-27', 'fue', { ambito: 'partidos', nombre: 'Cira' }),
  ];
  const js = calc(filas);
  const orden = (col, dir) => P.ordenar(js, col, dir).map((j) => j.person_id).join();
  ok(orden('total', 'desc') === 'ana,cira,beto' && orden('total', 'asc') === 'beto,cira,ana', 'orden por TOTAL %', orden('total', 'desc'));
  ok(orden('entrenos', 'desc') === 'ana,cira,beto' && orden('entrenos', 'asc') === 'beto,cira,ana', 'orden por Entrenos %', orden('entrenos', 'desc'));
  ok(orden('partidos', 'desc') === 'ana,cira,beto' && orden('partidos', 'asc') === 'beto,cira,ana', 'orden por Partidos %', orden('partidos', 'desc'));
  ok(orden('sin', 'desc') === 'beto,ana,cira' && orden('sin', 'asc') === 'ana,cira,beto', 'orden por Sin excusa (número)', orden('sin', 'desc'));
  ok(orden('jugador', 'asc') === 'ana,beto,cira' && orden('jugador', 'desc') === 'cira,beto,ana', 'orden por Jugador (alfabético)');
  ok(orden('tendencia', 'desc').split(',').length === 3 && orden('tendencia', 'asc').split(',').length === 3, 'orden por Tendencia (no rompe con vacíos)');
  const conVacio = P.ordenar([...js, { ...js[0], person_id: 'z', nombre: 'Z', pctPartidos: null }], 'partidos', 'asc');
  ok(conVacio.at(-1).person_id === 'z', 'los vacíos (—) van siempre al final, también en ascendente');
  ok(P.DIR_DEFECTO.total === 'desc' && P.DIR_DEFECTO.jugador === 'asc', 'por defecto TOTAL % de mayor a menor');
}

console.log('\n== Marca «aprox.»');
{
  const filas = [...rep(6, 'a', '2018-10-01', 'fue', { temporada: '2018-19' }), ...rep(6, 'a', '2026-09-01', 'fue'), ...rep(6, 'b', '2026-09-01', 'fue')];
  const js = calc(filas, todos({ temporadas: ['2026-27', '2018-19'] }));
  ok(por(js, 'a').aprox === true && por(js, 'b').aprox === false, 'aprox. solo si entra una temporada anterior a 2025/26 en sus cuentas');
  ok(!calc(filas, todos()).some((j) => j.aprox), 'solo 2026/27: sin marca');
}

console.log('\n== Equipo y periodo');
{
  const filas = [...rep(4, 'a', '2026-09-01', 'fue'), ...rep(3, 'a', '2026-09-20', 'fue', { ambito: 'partidos', equipo: 'MdA' }), ...rep(2, 'a', '2026-09-27', 'con_excusa', { ambito: 'partidos', equipo: 'MdL' })];
  const todosEq = por(calc(filas), 'a'), mda = por(calc(filas, todos({ equipo: 'MdA' })), 'a'), mdl = por(calc(filas, todos({ equipo: 'MdL' })), 'a');
  ok(todosEq.partidos.fue === 3 && todosEq.partidos.faltas === 2, 'Todos: los partidos de los dos equipos');
  ok(mda.partidos.fue === 3 && mda.partidos.faltas === 0 && mdl.partidos.fue === 0 && mdl.partidos.faltas === 2, 'MdA y MdL: solo los partidos de ese equipo');
  ok(mda.entrenos.fue === 4 && mdl.entrenos.fue === 4, 'los entrenos son comunes a los dos equipos');
}
{
  // Últimas 4 semanas con HOY = 2026-11-02 -> desde el 2026-10-05 (incluido) hasta antes de hoy.
  const filas = [...rep(8, 'a', '2026-09-10', 'fue'), ...rep(2, 'a', '2026-10-05', 'con_excusa'), ...rep(5, 'a', '2026-10-20', 'fue')];
  const s = por(calc(filas), 'a'), c4 = por(calc(filas, todos({ periodo: '4s' })), 'a');
  ok(s.total.fue === 13 && P.eventosDe(s.total) === 15, 'periodo Temporada: todo');
  ok(c4.total.fue === 5 && P.eventosDe(c4.total) === 7, 'periodo Últimas 4 semanas: solo desde el 05/10 (28 días antes de hoy)', JSON.stringify(c4.total));
  ok(!calc([ev('a', '2026-10-04', 'fue'), ev('a', '2026-11-02', 'fue')], todos({ periodo: '4s' })).length, 'ni el día 29 antes ni hoy mismo entran');
}

console.log('\n== Tendencia');
{
  const t = (reciente, resto) => {
    // reciente/resto = [fue, faltas] de las últimas 4 semanas y de antes
    const f = [...rep(reciente[0], 'a', '2026-10-20', 'fue'), ...rep(reciente[1], 'a', '2026-10-21', 'con_excusa'), ...rep(resto[0], 'a', '2026-09-10', 'fue'), ...rep(resto[1], 'a', '2026-09-11', 'con_excusa')];
    return por(calc(f), 'a').tendencia;
  };
  ok(t([4, 1], [4, 6]).dir === 'sube', 'sube: 80 % reciente frente a 61 % del periodo (≥ +10 puntos)', JSON.stringify(t([4, 1], [4, 6])));
  ok(t([1, 4], [12, 3]).dir === 'baja', 'baja: 20 % frente a 65 % (≤ −10 puntos)');
  ok(t([3, 2], [8, 7]).dir === 'igual', '=: dentro de ±10 puntos');
  ok(t([7, 3], [7, 3]).pct4 === 0.7 && t([7, 3], [7, 3]).dir === 'igual', 'el tooltip lleva el % de las 4 semanas');
  ok(P.UMBRAL_TENDENCIA === 0.1, 'umbral de 10 puntos');
  const sinReciente = por(calc(rep(6, 'a', '2026-09-10', 'fue')), 'a').tendencia;
  ok(sinReciente.dir === null && sinReciente.pct4 === null, 'sin eventos en las 4 semanas: sin tendencia (—)');
  const con4s = por(calc([...rep(2, 'a', '2026-09-10', 'fue'), ...rep(6, 'a', '2026-09-11', 'con_excusa'), ...rep(5, 'a', '2026-10-20', 'fue')], todos({ periodo: '4s' })), 'a');
  ok(con4s.tendencia.dir === 'sube', 'con periodo «4 semanas», se compara con el de toda la temporada');
}

console.log('\n== Plantilla actual / Todos');
{
  const filas = [...rep(6, 'a', '2026-09-01', 'fue'), ...rep(6, 'viejo', '2026-09-01', 'fue')];
  const actuales = new Set(['a']);
  ok(calc(filas, todos({ ver: 'actual' }), [], actuales).map((j) => j.person_id).join() === 'a' && calc(filas, todos({ ver: 'todos' }), [], actuales).length === 2, 'Plantilla actual: solo los activos; Todos: también los antiguos');
}

ok(P.temporadasDesde('2018-19', '2026-27').join() === '2018-19,2019-20,2020-21,2021-22,2022-23,2023-24,2024-25,2025-26,2026-27', 'todas las temporadas con detalle, de 2018/19 a la actual');

console.log('\n== Colores de la barrita');
ok(P.colorPct(0.75) === 'verde' && P.colorPct(0.7449) === 'ambar' && P.colorPct(0.5) === 'ambar' && P.colorPct(0.4949) === 'rojo' && P.colorPct(null) === null, 'verde ≥ 75, ámbar 50–74, rojo < 50 (sobre el número que se ve)');
ok(P.colorPct(0.746) === 'verde' && P.colorPct(0.495) === 'ambar', 'se redondea como el número: 74,6 → 75 verde; 49,5 → 50 ámbar');

console.log('\n== 2025/26: mandan los totales corregidos (D72)');
{
  const corr = (person_id, ambito, o) => ({ temporada: '2025-26', person_id, nombre: person_id.toUpperCase(), ambito, fueron: 0, con_excusa: 0, sin_excusa: 0, no_convocado: 0, lesion: 0, total: 0, ...o });
  const totales = [corr('a', 'entrenos', { fueron: 20, con_excusa: 10, no_convocado: 3, lesion: 4, total: 37 }), corr('a', 'partidos', { fueron: 10, con_excusa: 5, no_convocado: 20, total: 35 })];
  const detalle = [...rep(25, 'a', '2025-10-01', 'fue', { temporada: '2025-26' }), ...rep(5, 'a', '2025-10-02', 'sin_excusa', { temporada: '2025-26' }),
    ...rep(14, 'a', '2025-10-12', 'fue', { temporada: '2025-26', ambito: 'partidos', equipo: 'MdA' }), ...rep(6, 'a', '2025-10-19', 'fue', { temporada: '2025-26', ambito: 'partidos', equipo: 'MdL' }),
    ...rep(9, 'fuera', '2025-10-01', 'fue', { temporada: '2025-26' })];
  const f = todos({ temporadas: ['2025-26'] });
  const a = por(calc(detalle, f, totales), 'a');
  ok(a.entrenos.fue === 20 && a.entrenos.faltas === 10 && a.partidos.fue === 10 && a.partidos.faltas === 5 && a.sin === 0, 'los totales salen de asistencia_motivos (lo corregido), no del detalle de SportEasy', JSON.stringify([a.entrenos, a.partidos]));
  ok(!a.segunSportEasy && !a.aprox, '2025/26 no es aproximada y con «Todos» los equipos no usa el detalle');
  ok(!por(calc(detalle, f, totales), 'fuera'), 'quien no está en lo corregido no cuenta en 2025/26 (mandan los totales)');
  const mda = por(calc(detalle, todos({ temporadas: ['2025-26'], equipo: 'MdA' }), totales), 'a');
  ok(mda.entrenos.fue === 20 && mda.partidos.fue === 14 && mda.segunSportEasy && mda.aprox, 'por equipo: entrenos corregidos; partidos del detalle de SportEasy, marcados', JSON.stringify([mda.entrenos, mda.partidos]));
  const dos = por(calc([...detalle, ...rep(5, 'a', '2026-09-01', 'fue')], todos({ temporadas: ['2026-27', '2025-26'] }), totales), 'a');
  ok(dos.entrenos.fue === 25 && dos.entrenos.faltas === 10, '2026/27 + 2025/26: se suman los totales corregidos y el detalle nuevo', JSON.stringify(dos.entrenos));
}

console.log('\n== Ficha');
{
  const corr = (ambito, o) => ({ temporada: '2025-26', person_id: 'a', nombre: 'Ana', ambito, fueron: 0, con_excusa: 0, sin_excusa: 0, no_convocado: 0, lesion: 0, total: 0, ...o });
  const totales = [corr('entrenos', { fueron: 20, con_excusa: 10, no_convocado: 3, lesion: 4 }), corr('partidos', { fueron: 10, con_excusa: 5, no_convocado: 20, lesion: 1 })];
  const filas = [
    ...Array.from({ length: 12 }, (_, i) => ev('a', `2026-10-${String(i + 1).padStart(2, '0')}`, i === 3 ? 'lesion' : i === 4 ? 'no_convocado' : i % 3 === 0 ? 'con_excusa' : 'fue', { nombre: 'Ana', motivo: i === 0 ? 'viaje' : null })),
    ev('a', '2026-11-05', 'fue', { nombre: 'Ana' }), // futuro: no cuenta
    ...rep(4, 'a', '2025-10-01', 'fue', { temporada: '2025-26', nombre: 'Ana' }),
    ...rep(5, 'a', '2018-10-01', 'fue', { temporada: '2018-19', nombre: 'Ana' }), ...rep(5, 'a', '2018-10-02', 'sin_excusa', { temporada: '2018-19', nombre: 'Ana' }),
  ];
  const fi = P.fichaJugador({ filas, totales, hoy: HOY }, 'a');
  const t = Object.fromEntries(fi.temporadas.map((x) => [x.temporada, x]));
  ok(fi.temporadas.map((x) => x.temporada).join() === '2026-27,2025-26,2018-19', '% por temporada, de la más reciente a la más antigua');
  ok(t['2025-26'].corregida && t['2025-26'].entrenos.fue === 20 && t['2025-26'].partidos.faltas === 5, '2025/26: los totales corregidos');
  ok(t['2018-19'].aprox && P.textoPct(t['2018-19'].total.fue / P.eventosDe(t['2018-19'].total)) === '50 %' && t['2018-19'].total.sin === 5, '2018/19: aproximada, con su «sin excusa»');
  ok(t['2026-27'].entrenos.fue + t['2026-27'].entrenos.faltas === 10, '2026/27: 12 eventos menos lesión y no convocado = 10; el futuro no entra', JSON.stringify(t['2026-27'].entrenos));
  ok(fi.ultimos.length === 10 && fi.ultimos[0].fecha === '2026-10-12' && fi.ultimos.every((x, i, a) => i === 0 || a[i - 1].fecha >= x.fecha), 'últimos 10 eventos, del más reciente al más antiguo (sin el futuro)');
  ok(fi.ultimos.some((x) => x.estado === 'lesion') && fi.ultimos.some((x) => x.estado === 'no_convocado') && fi.ultimos.some((x) => x.estado === 'fue') && fi.ultimos.some((x) => x.estado === 'con_excusa'), 'la lista enseña todos los estados (fue / con excusa / no convocado / lesión)');
  ok(P.textoEstado('con_excusa') === 'con excusa' && P.textoEstado('sin_excusa') === 'sin excusa' && P.textoEstado('no_convocado') === 'no convocado' && P.textoEstado('lesion') === 'lesión' && P.textoEstado('fue') === 'fue', 'textos de los estados');
  const m = Object.fromEntries(fi.motivos.map((x) => [x.texto, x.veces]));
  ok(m['viaje'] === 1 && m['con excusa'] >= 10 && m['lesión'] >= 4 && m['no convocado'] >= 3, 'motivos: el texto de la plataforma y los recuentos de estado (2025/26 de lo corregido)', JSON.stringify(m));
  const f2 = P.fichaJugador({ filas, totales, hoy: '2026-11-02' }, 'a', { ultimos: 3 });
  ok(f2.ultimos.length === 3, 'el número de eventos es configurable');
  const so = P.fichaJugador({ filas: [...rep(3, 'a', '2025-10-01', 'fue', { temporada: '2025-26', nombre: 'Ana', origen: 'sporteasy' })], totales, hoy: HOY }, 'a');
  ok(so.ultimos.every((x) => x.segunSportEasy), 'el detalle de 2025/26 va marcado «según SportEasy»');
  ok(P.fichaJugador({ filas: [], totales: [], hoy: HOY }, 'nadie') === null, 'persona sin datos: sin ficha');
}

console.log('\n== La plataforma desde el 24/10 (D161) con los estados de la tabla');
{
  const evs = [{ id: 'e1', fecha: '2026-10-28', tipo: 'entreno', oficial: true, equipo: null, titulo: 'Entreno' }, { id: 'l1', fecha: '2026-10-25', tipo: 'liga', oficial: true, equipo: 'MdL', titulo: 'MdL – X' }];
  const defecto = { marcas: new Map(), quitados: new Set(), ausencias: [{ person_id: 'v', desde: '2026-10-26', hasta: '2026-10-30', motivo: 'lesion' }] };
  const R = (evento_id, person_id, respuesta, motivo = null) => ({ evento_id, person_id, respuesta, motivo });
  const a = A.asistenciaPlataforma(evs, [R('e1', 'a', 'va'), R('e1', 'b', 'no', 'trabajo'), R('e1', 'c', 'no', 'lesion'), R('e1', 'd', 'sin_responder'), R('e1', 'v', 'sin_responder'), R('l1', 'a', 'va')], defecto, '2026-11-02');
  const e = (id, amb) => a.find((x) => x.person_id === id && x.ambito === amb)?.estado;
  ok(e('a', 'entrenos') === 'fue' && e('b', 'entrenos') === 'con_excusa' && e('c', 'entrenos') === 'lesion' && e('d', 'entrenos') === 'sin_excusa' && e('v', 'entrenos') === 'lesion', 'va = fue; no con motivo = con excusa; lesión (también por ausencia) = lesión; sin responder = sin excusa', JSON.stringify(a.map((x) => [x.person_id, x.estado])));
  const filas = P.filasDePlataforma(a, { a: 'Ana' });
  const l = filas.find((x) => x.ambito === 'partidos');
  ok(l.equipo === 'MdL' && l.temporada === '2026-27' && l.origen === 'plataforma' && l.nombre === 'Ana' && filas.find((x) => x.ambito === 'entrenos').equipo === null, 'filas con equipo (solo partidos), temporada, origen y nombre');
}

console.log('\n== Partidos de liga: mandan la hoja de la FBM y la convocatoria aprobada (D72, D197)');
{
  // Domingo 22/11 con dos partidos (MdA y MdL), los dos con hoja y convocatoria aprobada; 15/11 MdL con convocatoria y sin
  // hoja; 08/11 MdL sin ninguna de las dos (provisional). Jugadores sintéticos.
  const L = (id, fecha, equipo) => ({ id, fecha, tipo: 'liga', oficial: true, equipo, titulo: `${equipo} – Rival` });
  const evs = [L('a22', '2026-11-22', 'MdA'), L('l22', '2026-11-22', 'MdL'), L('l15', '2026-11-15', 'MdL'), L('l08', '2026-11-08', 'MdL'),
    { id: 'e18', fecha: '2026-11-18', tipo: 'entreno', oficial: true, equipo: null, titulo: 'Entreno' }];
  const season = {
    partidos: [{ pn: 6, equipo: 'MDA', fecha: '2026-11-22' }, { pn: 6, equipo: 'MDL', fecha: '2026-11-22' }],
    players: [
      { person_id: 'sint-hoja', games: [{ pn: 6, eq: 'MDA' }] },
      { person_id: 'sint-dijo-no', games: [{ pn: 6, eq: 'MDL' }] },
      { person_id: 'sint-sin-resp', games: [{ pn: 6, eq: 'MDA' }] },
      { person_id: 'sint-doblado-medio', games: [{ pn: 6, eq: 'MDA' }] },
      { nombre: 'Rival sin persona', games: [{ pn: 6, eq: 'MDA' }] },
    ],
  };
  const aprobadas = [
    { fecha: '2026-11-22', equipos: { MdA: [{ person_id: 'sint-hoja' }, { person_id: 'sint-viaje' }, { person_id: 'sint-conv-no' }, { person_id: 'sint-conv-lesion' }, { person_id: 'sint-doblado-medio' }, { person_id: 'sint-conv-ausencia' }],
      MdL: [{ person_id: 'sint-viaje' }, { person_id: 'sint-dijo-no' }, { person_id: 'sint-doblado-medio' }] } },
    { fecha: '2026-11-15', equipos: { MdL: [{ person_id: 'sint-c15' }, { person_id: 'sint-c15-no' }] } },
  ];
  const partidos = { hojas: A.hojasDeTemporada(season), convocados: A.convocadosDeAprobadas(aprobadas) };
  ok(partidos.hojas.get('2026-11-22|MdA')?.size === 3 && partidos.hojas.get('2026-11-22|MdL')?.size === 1 && !partidos.hojas.has('2026-11-15|MdL'), 'hojas por partido («fecha|MdA»), sin las filas sin persona; un partido sin hoja no aparece');
  const R = (evento_id, person_id, respuesta, motivo = null) => ({ evento_id, person_id, respuesta, motivo });
  const defecto = { marcas: new Map([['sint-nunca', { no_suele_entrenar: false, nunca_partidos: true }]]), quitados: new Set(),
    ausencias: [{ person_id: 'sint-conv-ausencia', desde: '2026-11-20', hasta: '2026-11-23', motivo: 'viaje' }] };
  const resp = [
    R('a22', 'sint-hoja', 'va'),                       // en la hoja → fue
    R('l22', 'sint-dijo-no', 'no', 'trabajo'),         // respondió «no» pero sale en la hoja → fue
    // Caso de Enyel: dobla, dijo «voy» a los dos, convocado en los dos, no sale en ninguna hoja (viaje sin avisar).
    R('a22', 'sint-viaje', 'va'), R('l22', 'sint-viaje', 'va'),
    // Doblado a medias: convocado en los dos, solo jugó el MdA.
    R('a22', 'sint-doblado-medio', 'va'), R('l22', 'sint-doblado-medio', 'va'),
    R('a22', 'sint-conv-no', 'no', 'familia'),         // convocado, luego «no» con motivo → con excusa
    R('a22', 'sint-conv-lesion', 'no', 'lesion'),      // convocado, lesionado → lesión (no cuenta)
    R('a22', 'sint-conv-ausencia', 'sin_responder'),   // convocado, ausencia por periodo → con excusa
    R('a22', 'sint-voy-fuera', 'va'), R('l22', 'sint-voy-fuera', 'va'), // «voy» sin entrar en ninguna → no convocado
    R('a22', 'sint-no', 'no', 'viaje'), R('a22', 'sint-duda', 'duda'), R('a22', 'sint-nunca', 'sin_responder'), // fuera: como siempre
    R('l15', 'sint-c15', 'va'), R('l15', 'sint-c15-no', 'no'), R('l15', 'sint-v15', 'va'), // sin hoja: manda la convocatoria
    R('l08', 'sint-p', 'va'), R('l08', 'sint-p-no', 'no', 'trabajo'), // sin hoja ni convocatoria: provisional
    R('e18', 'sint-viaje', 'va'), R('e18', 'sint-voy-fuera', 'no', 'trabajo'), // entrenos: no cambian
  ];
  const a = A.asistenciaPlataforma(evs, resp, defecto, '2026-11-23', partidos);
  const est = (p, e) => a.filter((x) => x.person_id === p && x.evento_id === e).map((x) => x.estado + (x.provisional ? '*' : '')).join(',') || '(no cuenta)';
  ok(est('sint-hoja', 'a22') === 'fue', 'sale en la hoja → fue');
  ok(est('sint-dijo-no', 'l22') === 'fue', 'respondió «no» pero sale en la hoja → fue');
  ok(est('sint-sin-resp', 'a22') === 'fue', 'sale en la hoja sin respuesta guardada → fue');
  ok(est('sint-viaje', 'a22') === 'sin_excusa' && est('sint-viaje', 'l22') === 'sin_excusa', 'caso Enyel: dobla, «voy» a los dos, convocado y no sale en ninguna hoja → sin excusa en cada partido', est('sint-viaje', 'a22') + ' ' + est('sint-viaje', 'l22'));
  ok(est('sint-doblado-medio', 'a22') === 'fue' && est('sint-doblado-medio', 'l22') === 'sin_excusa', 'doblado: cada partido por separado (fue al MdA, falta en el MdL)');
  ok(est('sint-conv-no', 'a22') === 'con_excusa' && est('sint-conv-ausencia', 'a22') === 'con_excusa', 'convocado y no sale en la hoja con «no» con motivo o ausencia por periodo → con excusa');
  ok(est('sint-conv-lesion', 'a22') === 'lesion', 'convocado y lesionado → lesión (excluida)');
  ok(est('sint-voy-fuera', 'a22') === 'no_convocado' && est('sint-voy-fuera', 'l22') === 'no_convocado', '«voy» sin salir en la hoja ni en la convocatoria → no convocado');
  ok(est('sint-no', 'a22') === 'con_excusa' && est('sint-duda', 'a22') === 'sin_excusa' && est('sint-nunca', 'a22') === '(no cuenta)', 'fuera de las dos: «no» = con excusa, «duda» = sin excusa, «nunca a partidos» sin responder no cuenta (D161)');
  ok(est('sint-c15', 'l15') === 'fue' && est('sint-c15-no', 'l15') === 'sin_excusa' && est('sint-v15', 'l15') === 'no_convocado', 'sin hoja: manda la convocatoria aprobada con la respuesta («voy» convocado = fue; convocado con «no» sin motivo = sin excusa; «voy» fuera = no convocado)');
  ok(est('sint-p', 'l08') === 'fue*' && est('sint-p-no', 'l08') === 'con_excusa*', 'sin hoja ni convocatoria: la regla de D161, marcada provisional');
  ok(est('sint-viaje', 'e18') === 'fue' && est('sint-voy-fuera', 'e18') === 'con_excusa', 'entrenos: no cambian');
  ok(a.every((x) => x.person_id), 'las filas de la hoja sin persona no generan filas');
  // En la tabla: el caso Enyel cuenta 1 de 3 en partidos (fue en otro, y dos faltas); no convocado no cuenta.
  const nombres = { 'sint-viaje': 'Viajero' };
  const filas = P.filasDePlataforma(a, nombres);
  const extra = { person_id: 'sint-viaje', nombre: 'Viajero', temporada: '2026-27', evento_ref: 'previo', fecha: '2026-11-01', ambito: 'partidos', equipo: 'MdA', titulo: null, estado: 'fue', motivo: null, origen: 'sporteasy' };
  const j = por(P.calcularJugadores({ filas: [...filas, extra], totales: [], hoy: '2026-11-23' }, todos(), null), 'sint-viaje');
  ok(j.partidos.fue === 1 && j.partidos.faltas === 2 && j.partidos.sin === 2, 'caso Enyel en la tabla: 1/3 en partidos, 2 sin excusa', JSON.stringify(j.partidos));
  const v = por(P.calcularJugadores({ filas, totales: [], hoy: '2026-11-23' }, todos(), null), 'sint-voy-fuera');
  ok(v.partidos.fue === 0 && v.partidos.faltas === 0 && v.entrenos.faltas === 1, '«voy» no convocado no cuenta en partidos (sí su entreno)', JSON.stringify(v.partidos));
  const fp = P.fichaJugador({ filas: P.filasDePlataforma(a, {}), totales: [], hoy: '2026-11-23' }, 'sint-p');
  ok(fp.ultimos[0].provisional === true && !P.filasDePlataforma(a, {}).find((x) => x.person_id === 'sint-hoja').provisional, 'la ficha lleva la marca «provisional» solo en los partidos sin hoja ni convocatoria');
  const sinPartidos = A.asistenciaPlataforma(evs, resp, defecto, '2026-11-23');
  ok(sinPartidos.filter((x) => x.ambito === 'partidos').every((x) => x.provisional) && sinPartidos.find((x) => x.person_id === 'sint-viaje' && x.evento_id === 'a22').estado === 'fue', 'sin hojas ni convocatorias (llamada antigua): todo provisional, la regla de D161');
}

console.log('\n== Pase de lista (D192): manda sobre la respuesta en vivo, sin contar dos veces');
{
  const fila = (person_id, evento_ref, estado, origen, o = {}) => ({ person_id, nombre: person_id, temporada: '2026-27', evento_ref, fecha: '2026-10-28', ambito: 'entrenos', equipo: null, titulo: null, estado, motivo: o.motivo ?? null, origen });
  const guardadas = [fila('a', 'se-1', 'fue', 'sporteasy'), fila('a', 'ev-1', 'fue', 'plataforma', { motivo: 'retraso' }), fila('b', 'ev-1', 'sin_excusa', 'plataforma')];
  const enVivo = [fila('a', 'ev-1', 'sin_excusa', 'plataforma'), fila('b', 'ev-1', 'con_excusa', 'plataforma'), fila('c', 'ev-1', 'fue', 'plataforma'), fila('a', 'ev-2', 'fue', 'plataforma')];
  const u = P.unirAsistencia(guardadas, enVivo);
  const de = (p, ev) => u.filter((x) => x.person_id === p && x.evento_ref === ev);
  ok(de('a', 'ev-1').length === 1 && de('a', 'ev-1')[0].estado === 'fue' && de('a', 'ev-1')[0].motivo === 'retraso', 'Ana en ev-1: una sola fila, la del pase (fue, con retraso), no la respuesta (sin excusa)', JSON.stringify(de('a', 'ev-1')));
  ok(de('b', 'ev-1').length === 1 && de('b', 'ev-1')[0].estado === 'sin_excusa', 'Beto: manda el pase (sin excusa) sobre su «no va» con motivo');
  ok(de('c', 'ev-1').length === 1 && de('a', 'ev-2').length === 1 && de('a', 'se-1').length === 1, 'quien no está en el pase y los demás eventos, de la respuesta; SportEasy, igual');
  const fi = P.fichaJugador({ filas: u, totales: [], hoy: '2026-11-02' }, 'a');
  ok(fi.temporadas.find((t) => t.temporada === '2026-27').entrenos.fue === 3, 'en la ficha de Ana: 3 entrenos (SportEasy, el pase y ev-2), sin duplicar ev-1', JSON.stringify(fi.temporadas.map((t) => [t.temporada, t.entrenos])));

  ok(PL.estadoPorDefecto({ respuesta: 'va', lesion: false, convocado: null }) === 'a_tiempo' && PL.estadoPorDefecto({ respuesta: 'no', lesion: true, convocado: null }) === 'lesion'
    && PL.estadoPorDefecto({ respuesta: 'no', lesion: false, convocado: null }) === 'con_excusa' && PL.estadoPorDefecto({ respuesta: 'duda', lesion: false, convocado: null }) === 'sin_excusa'
    && PL.estadoPorDefecto({ respuesta: 'sin_responder', lesion: false, convocado: null }) === 'sin_excusa', 'por defecto copia la respuesta (D50)');
  ok(PL.estadoPorDefecto({ respuesta: 'va', lesion: false, convocado: false }) === 'no_convocado' && PL.estadoPorDefecto({ respuesta: 'va', lesion: false, convocado: true }) === 'a_tiempo', 'partido con la convocatoria aprobada: quien no está, «no convocado»');
  ok(PL.estadoGuardado({ estado: 'fue', motivo: 'retraso' }) === 'retraso' && PL.estadoGuardado({ estado: 'fue', motivo: null }) === 'a_tiempo' && PL.estadoGuardado({ estado: 'lesion', motivo: null }) === 'lesion', 'lo guardado, de vuelta en los estados del pase');
  ok(!PL.estadosPase(false).includes('no_convocado') && PL.estadosPase(true).includes('no_convocado'), '«no convocado», solo en los partidos');
  const iso = (d) => d.toISOString();
  ok(iso(PL.finDelEvento({ fecha: '2026-10-28', inicio: '20:30:00', fin: '22:30:00' })) === '2026-10-28T21:30:00.000Z', 'se abre a la hora de fin (22:30 de Madrid)');
  ok(iso(PL.finDelEvento({ fecha: '2026-10-25', inicio: '09:00:00', fin: null })) === '2026-10-25T10:00:00.000Z', 'sin fin: inicio + 2 h (11:00 de Madrid, ya en horario de invierno)');
  ok(iso(PL.finDelEvento({ fecha: '2026-10-28', inicio: '23:00:00', fin: '00:30:00' })) === '2026-10-28T23:30:00.000Z', 'un fin pasada la medianoche, al día siguiente');
  const rc = PL.recuentoPase(['a_tiempo', 'retraso', 'con_excusa', 'sin_excusa', 'lesion', 'no_convocado']);
  ok(rc.fueron === 2 && rc.retraso === 1 && rc.conExcusa === 1 && rc.sinExcusa === 1 && rc.lesion === 1 && rc.noConvocado === 1, 'recuento del pase');
}

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
