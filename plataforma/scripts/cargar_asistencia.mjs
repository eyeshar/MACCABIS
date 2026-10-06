#!/usr/bin/env node
// Carga en Supabase la asistencia CON MOTIVOS (D82) desde privado/asistencia/asistencia_<temporada>.json (fuera de
// git; lo escribe `npm run jornada`). Solo la leen los gestores (RLS).
//
//   npm run db:asistencia                 todas las temporadas de privado/asistencia/ (conexion de .env.local)
//   npm run db:asistencia -- 2026-27      una temporada
//   npm run db:asistencia -- --dry        lee y cuenta, sin escribir
//
// Cada temporada se REEMPLAZA entera dentro de una transaccion: es repetible.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { conectar } from './db.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DIR = path.join(RAIZ, '..', 'privado', 'asistencia');

/** Filas de una temporada (una por persona y ambito). */
export function leerAsistencia(temporada) {
  const f = path.join(DIR, `asistencia_${temporada}.json`);
  if (!fs.existsSync(f)) throw new Error(`No existe ${f} (lo genera "npm run jornada").`);
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  const filas = [];
  for (const p of j.jugadores) {
    for (const ambito of ['partidos', 'entrenos']) {
      const d = p[ambito];
      if (!d) continue;
      filas.push({ temporada, person_id: p.person_id, nombre: p.display, ambito, fueron: d.fueron, excusa: d.excusa, sin_excusa: d.sin_excusa, no_conv: d.no_conv, lesion: d.lesion, total: d.total });
    }
  }
  return filas;
}

export const temporadasDisponibles = () => (fs.existsSync(DIR) ? fs.readdirSync(DIR) : [])
  .map((f) => f.match(/^asistencia_(\d{4}-\d{2})\.json$/)?.[1]).filter(Boolean).sort();

export async function cargarAsistencia(sql, temporada, filas, { log = console.log } = {}) {
  await sql.begin(async (tx) => {
    await tx`delete from public.asistencia_motivos where temporada = ${temporada}`;
    for (const x of filas) {
      await tx`insert into public.asistencia_motivos (temporada, person_id, nombre, ambito, fueron, excusa, sin_excusa, no_conv, lesion, total)
               values (${x.temporada}, ${x.person_id}, ${x.nombre}, ${x.ambito}, ${x.fueron}, ${x.excusa}, ${x.sin_excusa}, ${x.no_conv}, ${x.lesion}, ${x.total})`;
    }
  });
  log(`${temporada}: ${filas.length} filas de asistencia cargadas (solo gestores).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { config } = await import('dotenv');
  config({ path: path.join(RAIZ, '.env.local') });
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const pedidas = args.filter((a) => !a.startsWith('--'));
  const temporadas = pedidas.length ? pedidas : temporadasDisponibles();
  if (!temporadas.length) { console.error(`No hay ficheros en ${DIR}.`); process.exit(1); }
  const datos = temporadas.map((t) => [t, leerAsistencia(t)]);
  if (dry) { datos.forEach(([t, f]) => console.log(`[dry] ${t}: ${f.length} filas`)); process.exit(0); }
  const sql = conectar();
  try { for (const [t, f] of datos) await cargarAsistencia(sql, t, f); } finally { await sql.end(); }
}
