#!/usr/bin/env node
// Historial de los rivales de 2026/27 para el factor rival de la proyeccion (D132, REGLAS_CONVOCATORIA.md §9 c): para cada
// rival, su temporada anterior mas reciente con liga y lo que encajaba por partido frente a la media de su grupo de
// entonces. Datos de EQUIPO, publicos (Ayuntamiento de Madrid, CC BY 4.0); nada por jugador (D73).
//
// Fuentes: data/rivales_2026-27.json (la trayectoria de cada rival por su Codigo_equipo) y, para la media de cada grupo
// de 2025/26, la clasificacion completa del portal (data/raw/211549_clasificaciones_*.csv, fuera de git). Para
// temporadas mas antiguas no hay clasificacion completa: la media es la de todas las fases de liga de los rivales de esa
// temporada. Escribe data/historial_rivales_2026-27.json (se copia a plataforma/src/data/historialRivales.json con
// `npm run datos:sync`).
//
//   npm run proyeccion:historial
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DATA = path.join(REPO, 'data');
const riv = JSON.parse(fs.readFileSync(path.join(DATA, 'rivales_2026-27.json'), 'utf8'));
const csvs = fs.readdirSync(path.join(DATA, 'raw')).filter((f) => /^211549_clasificaciones_\d+\.csv$/.test(f)).sort();
if (!csvs.length) { console.error('Falta data/raw/211549_clasificaciones_*.csv (descargarlo del portal de datos abiertos, dataset 211549).'); process.exit(1); }
const csv = csvs.at(-1);

// Media de puntos encajados por partido de cada grupo de baloncesto masculino de 2025/26 (todos los equipos del grupo).
const grupos = {};
for (const c of new TextDecoder('latin1').decode(fs.readFileSync(path.join(DATA, 'raw', csv))).split(/\r?\n/).map((l) => l.split(';'))) {
  if (c[17] !== 'BALONCESTO' || c[20] !== 'MASCULINO') continue;
  const g = (grupos[c[3]] ??= { pj: 0, pc: 0 });
  g.pj += +c[7]; g.pc += +c[12];
}
// Media de cada temporada con todas las fases de liga de los rivales (para las temporadas sin clasificacion completa).
const temporadas = {};
for (const r of riv.rivales) for (const t of r.trayectoria ?? []) for (const i of t.inscripciones ?? []) for (const f of i.fases ?? []) {
  if (f.tipo !== 'liga' || !f.pj) continue;
  const m = (temporadas[t.temporada] ??= { pj: 0, pc: 0 });
  m.pj += f.pj; m.pc += f.pc;
}

const rivales = [];
for (const r of riv.rivales) {
  const nombre = r.rival.replace(/"/g, '').trim();
  let entrada = null;
  for (const t of r.trayectoria ?? []) {
    let pj = 0, pc = 0, ref = 0, completa = true;
    for (const i of t.inscripciones ?? []) for (const f of i.fases ?? []) {
      if (f.tipo !== 'liga' || !f.pj) continue;
      const g = t.temporada === '2025-26' && grupos[f.codigo_grupo]?.pj ? grupos[f.codigo_grupo] : null;
      if (!g) completa = false;
      const media = g ? g.pc / g.pj : temporadas[t.temporada].pc / temporadas[t.temporada].pj;
      pj += f.pj; pc += f.pc; ref += media * f.pj;
    }
    if (pj) {
      entrada = { nombre, temporada: t.temporada, pj, encaja: Math.round((pc / pj) * 10) / 10, media_grupo: Math.round((ref / pj) * 10) / 10, factor: Math.round((pc / ref) * 1e6) / 1e6, media: completa ? 'grupo' : 'temporada' };
      break;
    }
  }
  rivales.push(entrada ?? { nombre, temporada: null, pj: 0, encaja: null, media_grupo: null, factor: null, media: null });
}

const salida = {
  _meta: {
    generado: new Date().toISOString().slice(0, 10), decision: 'D132',
    fuente: `data/rivales_2026-27.json y data/raw/${csv} (Ayuntamiento de Madrid, CC BY 4.0)`,
    metodo: 'factor = puntos encajados por partido / media del grupo (2025/26: clasificacion completa del grupo; antes: media de la temporada con todas las fases de liga de los rivales). Solo la temporada anterior mas reciente con liga.',
  },
  rivales,
};
fs.writeFileSync(path.join(DATA, 'historial_rivales_2026-27.json'), JSON.stringify(salida, null, 1) + '\n', 'utf8');
console.log(`Historial de ${rivales.filter((x) => x.factor).length} de ${rivales.length} rivales en data/historial_rivales_2026-27.json.`);
for (const x of rivales) console.log(`  ${x.nombre}: ${x.factor ? `${x.temporada} · encaja ${x.encaja} frente a ${x.media_grupo} (${x.media}) → ${x.factor}` : 'sin historial'}`);
