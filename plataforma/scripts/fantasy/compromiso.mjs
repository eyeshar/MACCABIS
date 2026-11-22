#!/usr/bin/env node
// MdFantasy (D196): tabla por jornada de rendimiento y compromiso, para decidir si hay que limitar el compromiso semanal.
// Lee privado/fantasy/datos.json (lo deja scripts/fantasy/extraer.mjs). NO se conecta a ninguna base. Mismo motor que la web.
// Solo imprime medias y recuentos: ningun nombre.
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=ExperimentalWarning scripts/fantasy/compromiso.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PARAMETROS } from '../../src/lib/fantasy/reglas.ts';
import { puntuarJornada } from '../../src/lib/fantasy/jornada.ts';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const datos = JSON.parse(fs.readFileSync(path.join(RAIZ, '..', 'privado', 'fantasy', 'datos.json'), 'utf8'));
const r1 = (n) => (Math.round(n * 10) / 10).toLocaleString('es-ES');
const media = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const P = { ...PARAMETROS };

console.log('| Jornada | Entrenos | Partidos | Jugaron | Rend. medio (quien jugó) | Comp. medio (todos) | Comp. medio (quien no jugó) | Comp. máx. | No jugaron y suman 6 o más | Total medio (quien jugó) | % del total que es compromiso |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (const j of datos.jornadas.filter((x) => x.publicada)) {
  const r = puntuarJornada(j, P);
  const ps = [...r.puntos.values()];
  const jugaron = ps.filter((p) => p.minutos > 0), no = ps.filter((p) => p.minutos === 0);
  const entrenos = j.eventos.filter((e) => e.tipo === 'entreno').length;
  const sumaR = ps.reduce((s, p) => s + p.rendimiento, 0), sumaC = ps.reduce((s, p) => s + Math.max(0, p.total - p.rendimiento), 0);
  console.log(`| ${j.fecha.slice(8, 10)}/${j.fecha.slice(5, 7)} | ${entrenos} | ${j.partidos.length} | ${jugaron.length} de ${ps.length} | ${r1(media(jugaron.map((p) => p.rendimiento)))} | ${r1(media(ps.map((p) => p.compromiso)))} | ${r1(media(no.map((p) => p.compromiso)))} | ${Math.max(...ps.map((p) => p.compromiso))} | ${no.filter((p) => p.total >= 6).length} | ${r1(media(jugaron.map((p) => p.total)))} | ${sumaR + sumaC ? Math.round((100 * sumaC) / (sumaR + sumaC)) : 0} % |`);
}
console.log(`\nMáximo de compromiso posible: ${P.respuestaRapida} (respuesta rápida) + ${P.entrenoAsistido} (ir) por entreno, y ${P.respuestaRapida} por responder al domingo.`);
