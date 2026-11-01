#!/usr/bin/env node
// Jugadores de otros equipos en Scouting y Liga consolidada (src/lib/jugadoresLiga.ts): identidad = equipo + nombre
// normalizado, sin el dorsal (D168), y «Más peligrosos» por media con un mínimo de partidos (D169). Datos sintéticos;
// sin base de datos ni navegador.
//
//   npm run pruebas:jugadores-rivales
import {
  agruparJugadores, claveNombre, filasTabla, masPeligrosos, minimoPartidos, quienDobla, textoDorsales, unirDoblan,
} from '../src/lib/jugadoresLiga.ts';
import { createRequire } from 'node:module';

const { nombresRepetidos } = createRequire(import.meta.url)('../../scripts/estadisticas/liga.js');

let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };

const fila = (partido, jornada, equipo, dorsal, nombre, x = {}) => ({
  partido_id: partido, grupo: 'G1', jornada, equipo, dorsal, nombre,
  segundos: 600, pts: 0, p2a: 0, p3a: 0, tla: 0, tli: 0, faltas: 0, ...x,
});
const de = (jugadores, nombre) => jugadores.filter((j) => claveNombre(j.nombre) === claveNombre(nombre));

console.log('\n== Mismo jugador, otro dorsal u otra escritura (caso Miragaya, Vallekas Basket)');
{
  const { jugadores, conflictos } = agruparJugadores([
    fila('p1', 1, 'Rival Sint', '16', 'MIRAGAYA GONZÁLEZ, ALBERTO', { segundos: 1373, pts: 9, p2a: 3, p3a: 1, faltas: 2 }),
    fila('p2', 2, 'Rival Sint', '9', 'MIRAGAYA GONZALEZ, ALBERTO', { segundos: 1730, pts: 8, p2a: 1, p3a: 1, tla: 3, tli: 4, faltas: 4 }),
  ]);
  const m = de(jugadores, 'Miragaya Gonzalez, Alberto');
  ok(m.length === 1, 'una sola línea', JSON.stringify(jugadores));
  ok(m[0]?.pj === 2 && m[0].pts === 17 && m[0].segundos === 3103 && m[0].p2a === 4 && m[0].p3a === 2 && m[0].tla === 3 && m[0].tli === 4 && m[0].faltas === 6, 'suma PJ, minutos, puntos, 2P, 3P, TL y faltas', JSON.stringify(m[0]));
  ok(textoDorsales(m[0]) === '#9 / #16', 'todos los dorsales usados: «#9 / #16»', textoDorsales(m[0]));
  ok(m[0].nombre === 'MIRAGAYA GONZÁLEZ, ALBERTO', 'el nombre en su forma más completa (con tilde)', m[0].nombre);
  ok(conflictos.length === 0, 'sin avisos');
  ok(claveNombre('TORREALBA , PEDRO JOSE') === claveNombre('Torrealba, Pedro Jose'), 'mayúsculas, espacios y puntuación no cuentan');
}

console.log('\n== Dos personas distintas con el mismo dorsal');
{
  const { jugadores } = agruparJugadores([
    fila('p1', 1, 'Rival Sint', '0', 'PEREZ SINT, ANA', { pts: 4 }),
    fila('p1', 1, 'Rival Sint', '0', 'LOPEZ SINT, BEA', { pts: 6 }),
    fila('p2', 2, 'Rival Sint', '0', 'PEREZ SINT, ANA', { pts: 2 }),
  ]);
  ok(jugadores.length === 2 && de(jugadores, 'Perez Sint, Ana')[0]?.pts === 6 && de(jugadores, 'Lopez Sint, Bea')[0]?.pts === 6, 'el dorsal no es identidad: dos líneas, cada una con lo suyo', JSON.stringify(jugadores));
  ok(textoDorsales(de(jugadores, 'Perez Sint, Ana')[0]) === '#0', 'un solo dorsal: «#0»');
}

console.log('\n== Mismo nombre y dorsales distintos en el MISMO partido: dos personas, no se fusionan');
{
  const { jugadores, conflictos } = agruparJugadores([
    fila('p1', 1, 'Rival Sint', '4', 'GARCIA SINT, LUIS', { pts: 10 }),
    fila('p1', 1, 'Rival Sint', '12', 'García Sint, Luis', { pts: 3 }),
    fila('p2', 2, 'Rival Sint', '4', 'GARCIA SINT, LUIS', { pts: 8 }),
    fila('p2', 2, 'Otro Sint', '7', 'GARCIA SINT, LUIS', { pts: 5 }),
  ]);
  const g = jugadores.filter((j) => j.equipo === 'Rival Sint' && claveNombre(j.nombre) === claveNombre('Garcia Sint, Luis'));
  ok(g.length === 2 && g.find((j) => j.dorsal === '4')?.pts === 18 && g.find((j) => j.dorsal === '12')?.pts === 3, 'se separan por dorsal', JSON.stringify(g));
  ok(conflictos.length === 1 && conflictos[0].jornada === 1 && conflictos[0].dorsales.join() === '4,12' && conflictos[0].equipo === 'Rival Sint', 'se avisa (equipo, jornada y dorsales)', JSON.stringify(conflictos));
  ok(jugadores.some((j) => j.equipo === 'Otro Sint' && j.pts === 5), 'el mismo nombre en otro equipo es otra persona');
  const avisos = nombresRepetidos({ grupo: 'G1', jornada: 1, fichero: 'sint.xlsx', equipos: [
    { equipo: 'Rival Sint', jugadores: [{ num: '4', nombre: 'GARCIA SINT, LUIS' }, { num: '12', nombre: 'García Sint , Luis' }, { num: '0', nombre: 'OTRO SINT, X' }, { num: '0', nombre: 'OTRA SINT, Y' }] },
    { equipo: 'Otro Sint', jugadores: [{ num: '7', nombre: 'GARCIA SINT, LUIS' }] },
  ] });
  ok(avisos.length === 1 && /J1: .* sale dos veces en Rival Sint con dorsales #4 y #12 \(sint\.xlsx\)/.test(avisos[0]), 'el informe de la jornada lo avisa (y el mismo dorsal con dos nombres, no)', avisos.join(' | '));
}

console.log('\n== Quien figura en las hojas sin jugar ningún minuto no sale (caso «#0 con 0 PJ»)');
{
  const { jugadores } = agruparJugadores([
    fila('p2', 2, 'Rival Sint', '16', 'MARTINEZ SINT , DAVID', { segundos: 0 }),
    fila('p3', 3, 'Rival Sint', '0', 'MARTINEZ SINT , DAVID', { segundos: 0 }),
    fila('p2', 2, 'Rival Sint', '5', 'BANQUILLO SINT, EVA', { segundos: 0 }),
    fila('p3', 3, 'Rival Sint', '5', 'BANQUILLO SINT, EVA', { segundos: 300, pts: 2 }),
  ]);
  ok(de(jugadores, 'Martinez Sint, David').length === 0, 'convocado en dos hojas sin minutos: no sale');
  ok(de(jugadores, 'Banquillo Sint, Eva')[0]?.pj === 1, 'un partido sin minutos y otro con minutos: 1 PJ');
}

console.log('\n== Mínimo de partidos para las medias (la mitad de los de su equipo, hacia arriba, o 2, lo que sea menor)');
ok([[0, 1], [1, 1], [2, 1], [3, 2], [4, 2], [7, 2], [20, 2]].every(([pj, m]) => minimoPartidos(pj) === m), 'equipo con 0, 1, 2, 3, 4, 7 y 20 partidos: 1, 1, 1, 2, 2, 2, 2');
{
  const j = (nombre, pj, pts) => ({ grupo: 'G1', equipo: 'Rival Sint', nombre, dorsal: '1', pj, segundos: pj * 600, pts, p2a: 0, p3a: 0, tla: 0, tli: 0, faltas: 0 });
  const plantilla = [j('SUERTE, UNO', 1, 30), j('REGULAR, DOS', 4, 40), j('ANOTADOR, TRES', 2, 17), j('FLOJO, CUATRO', 4, 8), j('MEDIO, CINCO', 3, 21)];
  const p = masPeligrosos(plantilla, 4);
  ok(p.map((x) => x.nombre).join('|') === 'REGULAR, DOS|ANOTADOR, TRES|MEDIO, CINCO', 'equipo con 4 partidos (mínimo 2): por media, 10,0 · 8,5 · 7,0; el de 1 partido con 30 no entra', p.map((x) => x.nombre).join('|'));
  ok(masPeligrosos(plantilla, 1)[0].nombre === 'SUERTE, UNO', 'equipo con 1 partido (mínimo 1): entra');
  const t = filasTabla(plantilla, new Map([['G1|Rival Sint', 4]]));
  ok(t.every((x) => x.minPartidos === 2), 'Liga consolidada usa el mismo mínimo (minPartidos)', t.map((x) => x.minPartidos).join());
  ok(filasTabla(plantilla, new Map([['G1|Rival Sint', 10]]))[0].minPartidos === 2, 'con 10 partidos de equipo, el mínimo es 2 (no 5)');
}

console.log('\n== Nuestros jugadores');
{
  const n = (equipo, grupo, nombre, pj, pts) => ({ grupo, equipo, nombre, dorsal: '7', pj, segundos: 0, pts, p2a: 0, p3a: 0, tla: 0, tli: 0, faltas: 0 });
  const nuestros = [n('MdA', 'G1', 'ESTEBAN, JON', 2, 10), n('MdL', 'G2', 'Estebán, Jon', 1, 4)];
  ok(quienDobla(nuestros).size === 2, 'dobla aunque una hoja traiga tilde y la otra no');
  const u = unirDoblan(nuestros);
  ok(u.length === 1 && u[0].pj === 3 && u[0].pts === 14, 'y cuenta una vez, con las dos fichas sumadas');
}

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
