#!/usr/bin/env node
// Cálculo de «Asistencia y motivos» rediseñada (D170): src/lib/eventos/asistenciaPantalla.ts. Lógica pura, sin base de
// datos ni navegador. Datos sintéticos.
//   - Exclusión de «no convocado» y lesión; faltas = con excusa + sin excusa; TOTAL suma fue y faltas (no la media).
//   - Suma de varias temporadas; mínimo de 5 eventos; marca «aprox.» en las temporadas anteriores a 2025/26.
//   - Equipo, periodo «últimas 4 semanas», tendencia (±10 puntos), plantilla actual, orden por cada columna.
//   - 2025/26: mandan los totales corregidos a mano (D72); el detalle de SportEasy solo en «últimos 10 eventos».
//   - Ficha: % por temporada, motivos y últimos 10 eventos.
//
//   npm run pruebas:asistencia-calculo
import * as P from '../src/lib/eventos/asistenciaPantalla.ts';
import * as A from '../src/lib/eventos/asistencia.ts';

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

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
