#!/usr/bin/env node
// Desempates de los lideres individuales (src/lib/ordenLideres.ts): deterministas y con los casos de control de Iván.
//   npm run pruebas:orden
import { porPuntos, porMedia, porTriples, porTirosLibres, porFaltas, comparadorTabla, pasaMinimo, valorColumna, porPartido, valorPP, cumpleMinimoPP } from '../src/lib/ordenLideres.ts';
import { unirDoblan, filasFichas } from '../src/lib/jugadoresLiga.ts';

let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };
const J = (nombre, tla, tli, extra = {}) => ({ nombre, equipo: 'X', pj: 1, pts: 0, p3a: 0, tla, tli, faltas: 0, ...extra });
const barajar = (a, sem) => { const r = [...a]; let s = sem; for (let i = r.length - 1; i > 0; i--) { s = (s * 1103515245 + 12345) % 2147483648; const k = s % (i + 1); [r[i], r[k]] = [r[k], r[i]]; } return r; };
const nombres = (l) => l.map((j) => j.nombre).join(' > ');

console.log('\n== Tiros libres: anotados, luego porcentaje, luego menos intentados, luego nombre');
const a = [J('Esteban, Jon', 4, 15), J('Muñoz Bonet, Javier', 4, 6), J('Sanchez Sanchez, Alberto', 4, 5)].sort(porTirosLibres);
ok(a[2].nombre === 'Esteban, Jon' && nombres(a.slice(0, 2)) === 'Sanchez Sanchez, Alberto > Muñoz Bonet, Javier', 'Muñoz 4/6 y Sánchez 4/5 van delante de Jon 4/15', nombres(a));
const b = [J('Gianatti, Adriano', 5, 10), J('Villena Navas, Santiago', 5, 6), J('Espinoll Gayubo, Ruben', 5, 10), J('Urrutia Valencia, Pablo', 5, 6)].sort(porTirosLibres);
ok(nombres(b) === 'Urrutia Valencia, Pablo > Villena Navas, Santiago > Espinoll Gayubo, Ruben > Gianatti, Adriano', 'Villena 5/6 y Urrutia 5/6 delante de Gianatti 5/10 y Espinoll 5/10 (y entre iguales, por nombre)', nombres(b));
ok(nombres([J('B', 3, 3), J('A', 4, 9)].sort(porTirosLibres)) === 'A > B', 'más anotados manda sobre el porcentaje (4/9 antes que 3/3)');
ok(nombres([J('B', 2, 4), J('A', 2, 2)].sort(porTirosLibres)) === 'A > B', 'mismo número de anotados: el mejor porcentaje primero');

console.log('\n== Faltas: a igualdad, menos partidos primero (mas faltas por partido), luego nombre');
const F = (nombre, faltas, pj) => ({ nombre, equipo: 'X', pj, pts: 0, p3a: 0, tla: 0, tli: 0, faltas });
const f = [F('Esteban, Jon', 4, 2), F('Lucena, A', 4, 1), F('Garcia Gamon, B', 4, 1), F('Loarte, C', 4, 1), F('Zeta, D', 5, 3)].sort(porFaltas);
ok(nombres(f) === 'Zeta, D > Garcia Gamon, B > Loarte, C > Lucena, A > Esteban, Jon', 'Esteban (4 faltas en 2 partidos, dobla) va detras de quienes hicieron 4 en 1 partido; entre iguales, por nombre', nombres(f));
ok(nombres([F('B', 4, 1), F('A', 4, 1)].sort(porFaltas)) === 'A > B', 'mismas faltas y mismos partidos: por nombre');

console.log('\n== Determinismo: el mismo dato da siempre el mismo orden, sea cual sea el orden de entrada');
const datos = [];
for (let i = 0; i < 30; i++) datos.push({ nombre: `Jugador ${i % 7}`, equipo: i % 2 ? 'A' : 'B', pj: 1 + (i % 3), pts: i % 5, p3a: i % 4, tla: i % 3, tli: 3 + (i % 3), faltas: i % 4 });
for (const [n, f] of [['puntos', porPuntos], ['media', porMedia], ['triples', porTriples], ['tiros libres', porTirosLibres], ['faltas', porFaltas]]) {
  const ref = JSON.stringify([...datos].sort(f));
  const igual = [1, 2, 3, 4, 5, 6, 7, 8].every((s) => JSON.stringify(barajar(datos, s).sort(f)) === ref);
  ok(igual, `${n}: mismo orden con 8 barajados distintos de entrada`);
}

console.log('\n== Tabla "Todos los jugadores": cada columna, asc y desc, totales y por partido');
const COLS = ['nombre', 'equipo', 'pj', 'segundos', 'pts', 'media', 'p2a', 'p3a', 'tla', 'pctTL', 'faltas', 'fpp'];
const T = [];
for (let i = 0; i < 40; i++) T.push({ nombre: `Jugador ${String(i).padStart(2, "0")}`, equipo: i % 3 ? 'A' : 'B', equipos: [i % 3 ? 'A' : 'B'], pj: i % 4, segundos: (i % 5) * 600, pts: i % 6, p2a: i % 4, p3a: i % 3, tla: i % 3, tli: i % 4 === 0 ? 0 : 3 + (i % 3), faltas: i % 5, minPartidos: 1 + (i % 2) });
for (const col of COLS) for (const dir of [1, -1]) for (const pp of [false, true]) {
  const ref = JSON.stringify([...T].sort(comparadorTabla(col, dir, pp)));
  const det = [1, 2, 3, 4, 5, 6].every((s) => JSON.stringify(barajar(T, s).sort(comparadorTabla(col, dir, pp))) === ref);
  if (!det) ok(false, `${col} ${dir === 1 ? 'asc' : 'desc'}${pp ? ' por partido' : ''}: determinista`);
}
ok(true, `las 12 columnas, asc y desc, en totales y por partido: mismo orden con 6 barajados distintos`);
// la direccion invierte la columna elegida, pero no el desempate
for (const col of ['pts', 'media', 'pctTL', 'fpp']) {
  const d = [...T].sort(comparadorTabla(col, -1, false)).map((j) => valorColumna(j, col, false)).filter((v) => v !== null);
  const u = [...T].sort(comparadorTabla(col, 1, false)).map((j) => valorColumna(j, col, false)).filter((v) => v !== null);
  ok(d.every((v, i) => i === 0 || d[i - 1] >= v) && u.every((v, i) => i === 0 || u[i - 1] <= v), `${col}: desc de mayor a menor y asc de menor a mayor`);
}
const sinDato = [...T].sort(comparadorTabla('pctTL', 1, false));
ok(sinDato.slice(-sinDato.filter((j) => j.tli === 0).length).every((j) => j.tli === 0), '% de TL sin intentos va siempre al final (tambien en ascendente)');
const orden = [...T].sort(comparadorTabla('nombre', 1, false)).map((j) => j.nombre);
ok(orden.every((n, i) => i === 0 || orden[i - 1].localeCompare(n, 'es') <= 0), 'nombre: alfabetico ascendente');
// por partido: se divide entre PJ
const pj2 = { nombre: 'X', equipo: 'A', equipos: ['A'], pj: 2, segundos: 1200, pts: 10, p2a: 4, p3a: 2, tla: 3, tli: 4, faltas: 4, minPartidos: 1 };
ok(valorColumna(pj2, 'p2a', true) === 2 && valorColumna(pj2, 'p3a', true) === 1 && valorColumna(pj2, 'tla', true) === 1.5 && valorColumna(pj2, 'faltas', true) === 2 && valorColumna(pj2, 'segundos', true) === 600, 'por partido: 2P, 3P, TL, faltas y minutos divididos entre PJ');
ok(valorColumna(pj2, 'pts', true) === 10 && valorColumna(pj2, 'media', true) === 5, 'por partido: PTS y Media no cambian');
// minimo de partidos
const jug = (nombre, pj, tli) => ({ nombre, equipo: 'A', equipos: ['A'], pj, segundos: 0, pts: pj * 5, p2a: 0, p3a: 0, tla: 0, tli, faltas: 0, minPartidos: 3 });
const unPartido = jug('Uno', 1, 5), cuatro = jug('Cuatro', 4, 5), sinTL = jug('SinTL', 4, 2);
ok(!pasaMinimo(unPartido, 'media', 'auto', false) && pasaMinimo(cuatro, 'media', 'auto', false), 'automatico: ordenando por media, 1 partido no lidera (mitad de los de su equipo)');
ok(pasaMinimo(unPartido, 'pts', 'auto', false) && pasaMinimo(unPartido, 'nombre', 'auto', false), 'automatico: ordenando por totales, no se oculta a nadie');
ok(!pasaMinimo(unPartido, 'p2a', 'auto', true) && pasaMinimo(unPartido, 'p2a', 'auto', false), 'automatico: en "por partido" tambien se aplica a las columnas divididas');
ok(!pasaMinimo(sinTL, 'pctTL', 'auto', false) && !pasaMinimo(sinTL, 'pctTL', 2, false) && pasaMinimo(sinTL, 'pctTL', 'todos', false), 'TL%: exige 3 intentados salvo en "todos"');
ok(!pasaMinimo(unPartido, 'pts', 2, false) && pasaMinimo(cuatro, 'pts', 2, false) && pasaMinimo(unPartido, 'media', 'todos', false), 'minimo numerico: filtra siempre; "todos": nadie');
const lista = [unPartido, cuatro, sinTL, jug('Dos', 2, 9)].filter((j) => pasaMinimo(j, 'media', 'auto', false)).sort(comparadorTabla('media', -1, false));
ok(!lista.some((j) => j.pj < 3), 'ordenando por media con minimo automatico, nadie con menos partidos que el minimo aparece');


console.log('\n== Lideres "Por partido": cada lista, determinista, con minimo y con su desempate');
const CLAVES = ['pts', 'p2a', 'p3a', 'tla', 'pctTL', 'faltas', 'segundos'];
const P = [];
for (let i = 0; i < 48; i++) P.push({ nombre: `Jugador ${String(i).padStart(2, '0')}`, equipo: i % 3 ? 'A' : 'B', pj: i % 4, pts: i % 7, p2a: i % 4, p3a: i % 3, tla: i % 3, tli: i % 5 === 0 ? 0 : 3 + (i % 3), faltas: i % 5, segundos: (i % 6) * 300, minPartidos: 1 + (i % 2) });
for (const k of CLAVES) {
  const lista = P.filter((j) => cumpleMinimoPP(j, k));
  const ref = JSON.stringify([...lista].sort(porPartido(k)));
  ok([1, 2, 3, 4, 5, 6].every((s) => JSON.stringify(barajar(lista, s).sort(porPartido(k))) === ref), `${k} por partido: mismo orden con 6 barajados distintos`);
  const v = [...lista].sort(porPartido(k)).map((j) => valorPP(j, k));
  ok(v.every((x, i) => i === 0 || v[i - 1] >= x) && lista.every((j) => j.pj >= j.minPartidos && (k !== 'pctTL' || j.tli >= 3)), `${k} por partido: de mayor a menor y solo con el minimo (mitad de los partidos de su equipo, al menos 1; TL%: 3 intentados)`);
}
const Q = (nombre, pj, pts, extra = {}) => ({ nombre, equipo: 'A', pj, pts, p2a: 0, p3a: 0, tla: 0, tli: 0, faltas: 0, segundos: 0, minPartidos: 1, ...extra });
ok(nombres([Q('B', 1, 5), Q('A', 2, 10)].sort(porPartido('pts'))) === 'A > B', 'desempate: mismo valor por partido (5,0): manda el total (10 antes que 5)');
ok(nombres([Q('B', 1, 5), Q('A', 1, 5)].sort(porPartido('pts'))) === 'A > B', 'desempate: mismo valor y mismo total: el nombre');
ok(nombres([Q('A', 2, 0, { tla: 2, tli: 4 }), Q('B', 1, 0, { tla: 2, tli: 4 })].sort(porPartido('pctTL'))) === 'B > A', 'desempate: mismo % y mismos TL anotados: antes quien tiene menos partidos');
ok(nombres([Q('B', 1, 0, { faltas: 2 }), Q('A', 1, 0, { faltas: 2 })].sort(porPartido('faltas'))) === 'A > B', 'desempate final: nombre');
ok(nombres([Q('X', 2, 0, { faltas: 4 }), Q('Y', 1, 0, { faltas: 3 })].sort(porPartido('faltas'))) === 'Y > X', 'manda el valor por partido: 3 faltas en 1 partido (3,0) antes que 4 en 2 (2,0)');
const e1 = [{ ...Q('Z', 1, 0), equipo: 'A', equipos: ['A'] }, { ...Q('Z', 1, 0), equipo: 'B', equipos: ['B'] }];
ok(nombres(e1.sort(porPartido('pts'))) === 'Z > Z' && e1[0].equipo === 'A', 'desempate final: mismo nombre, el equipo');

console.log('\n== Dobladores en los lideres por partido: media sobre los partidos sumados de las dos fichas');
const ficha = (equipo, grupo, pj, pts) => ({ grupo, equipo, nombre: 'ESTEBAN, JON', dorsal: '3', pj, segundos: pj * 600, pts, p2a: 0, p3a: 0, tla: 0, tli: 0, faltas: 0 });
const ds = unirDoblan([ficha('MdA', 'G1', 1, 10), ficha('MdL', 'G2', 2, 8)]);
ok(ds.length === 1 && ds[0].pj === 3 && ds[0].pts === 18, 'dos fichas, una sola fila con PJ 3 y 18 puntos');
ok(valorPP({ ...ds[0], minPartidos: 1 }, 'pts') === 6, 'media por partido del doblador: 18 / 3 = 6,0 (no la media de las medias, 10 y 4)');
const fs = filasFichas([ficha('MdA', 'G1', 1, 10), ficha('MdL', 'G2', 2, 8)], new Map([['G1|MdA', 1], ['G2|MdL', 2]]));
ok(fs.length === 2 && fs.every((f) => f.dobla && f.soloFicha === f.equipo) && fs.map((f) => f.pts).join() === '10,8', 'fichas sin sumar: dos filas con «dobla» y "solo ficha MdA" / "solo ficha MdL"');

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
