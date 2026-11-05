#!/usr/bin/env node
// Comprobación de los DATOS reales de equipación (no es una prueba; D185): que todos los rivales del calendario real
// (data/calendario_<temporada>.json) tienen color en data/equipaciones_<temporada>.json y cada nombre cae en un equipo
// distinto, y la lista de partidos de la temporada con aviso. La usa la rutina B tras un cambio de colores o de rivales.
// Las pruebas (pruebas:equipacion) van con el calendario de prueba y no leen estos ficheros.
//
//   npm run datos:equipacion
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const A = createRequire(import.meta.url)(path.join(REPO, 'data', 'avisos_equipacion.js'));
const leer = (f) => JSON.parse(fs.readFileSync(path.join(REPO, 'data', f), 'utf8'));
const equip = leer('equipaciones_2026-27.json');
const cal = leer('calendario_2026-27.json');

let mal = 0;
const sin = A.rivalesSinColor(equip, cal);
if (sin.length) { mal++; console.log(`FALTA COLOR: ${sin.join(', ')} (añádelos a data/equipaciones_2026-27.json y npm run datos:sync)`); }
const rivales = [...new Set(cal.partidos.filter((p) => p.rival).map((p) => p.rival))];
const equipos = new Set(rivales.map((r) => A.equipoPorNombre(equip, r)?.nombre).filter(Boolean));
if (equipos.size !== rivales.length - sin.length) { mal++; console.log('DOS NOMBRES DEL CALENDARIO CAEN EN EL MISMO EQUIPO: revisa los alias de data/equipaciones_2026-27.json'); }
const av = A.listarAvisos(equip, cal);
const dd = (f) => f.split('-').reverse().join('/');
console.log(`${rivales.length} rivales en el calendario, ${sin.length} sin color. ${av.length} partidos con aviso:`);
for (const x of av) console.log(`  ${dd(x.fecha)}  J${String(x.jornada).padStart(2)}  ${x.equipo === 'MDA' ? 'MdA' : 'MdL'}  ${x.tipo === 'nos_toca' ? 'NOS TOCA CAMBIAR' : x.tipo === 'cambian_ellos' ? 'cambian ellos' : 'dudoso'}  ${x.rival} (${x.color})`);
console.log(mal ? '\nHay que revisar los datos.' : '\nDatos de equipación: OK.');
process.exit(mal ? 1 : 0);
