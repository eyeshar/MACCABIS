#!/usr/bin/env node
// Desempates de los lideres individuales (src/lib/ordenLideres.ts): deterministas y con los casos de control de Iván.
//   npm run pruebas:orden
import { porPuntos, porMedia, porTriples, porTirosLibres, porFaltas } from '../src/lib/ordenLideres.ts';

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

console.log('\n== Determinismo: el mismo dato da siempre el mismo orden, sea cual sea el orden de entrada');
const datos = [];
for (let i = 0; i < 30; i++) datos.push({ nombre: `Jugador ${i % 7}`, equipo: i % 2 ? 'A' : 'B', pj: 1 + (i % 3), pts: i % 5, p3a: i % 4, tla: i % 3, tli: 3 + (i % 3), faltas: i % 4 });
for (const [n, f] of [['puntos', porPuntos], ['media', porMedia], ['triples', porTriples], ['tiros libres', porTirosLibres], ['faltas', porFaltas]]) {
  const ref = JSON.stringify([...datos].sort(f));
  const igual = [1, 2, 3, 4, 5, 6, 7, 8].every((s) => JSON.stringify(barajar(datos, s).sort(f)) === ref);
  ok(igual, `${n}: mismo orden con 8 barajados distintos de entrada`);
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
