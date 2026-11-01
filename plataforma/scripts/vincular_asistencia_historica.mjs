#!/usr/bin/env node
// Vincula las personas históricas de SportEasy (D166) con la persona del club que Iván acepte en
// privado/sporteasy/propuestas_para_ivan.md (líneas con «OK»). Sin recargar nada: guarda los vínculos en
// privado/sporteasy/vinculos_historico.json, regenera los JSON de privado/asistencia/ y, en la base, solo reescribe las
// filas de las personas afectadas (la histórica `sporteasy-<id>` desaparece y la del club recibe sus eventos; si los dos
// perfiles coinciden en un evento, cuenta una vez). Una transacción por temporada.
//
//   npm run db:asistencia-vincular            (conexión de .env.local)
//   npm run db:asistencia-vincular -- --dry   dice qué haría, sin escribir nada

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { conectar } from './db.mjs';
import { leerAsistencia } from './cargar_asistencia.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const H = require(path.join(RAIZ, '..', 'scripts', 'estadisticas', 'asistencia_historica.js'));

/** Filas de la base a cambiar: por temporada, los person_id que se borran y las filas que se escriben. */
export function cambios(aceptadas, temporadas) {
  const out = [];
  for (const t of temporadas) {
    const filas = leerAsistencia(t);
    const ids = new Set();
    for (const [perfil, pid] of Object.entries(aceptadas)) { ids.add(H.PREFIJO + perfil); ids.add(pid); }
    const nuevas = filas.filter((f) => ids.has(f.person_id));
    out.push({ temporada: t, borrar: [...ids], nuevas });
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { config } = await import('dotenv');
  config({ path: path.join(RAIZ, '.env.local') });
  const dry = process.argv.includes('--dry');
  const md = path.join(RAIZ, '..', 'privado', 'sporteasy', 'propuestas_para_ivan.md');
  const aceptadas = H.leerAceptadas(fs.readFileSync(md, 'utf8'));
  const previas = fs.existsSync(H.F_VINCULOS) ? JSON.parse(fs.readFileSync(H.F_VINCULOS, 'utf8')) : {};
  const nuevas = Object.fromEntries(Object.entries(aceptadas).filter(([k, v]) => previas[k] !== v));
  console.log(`Aceptadas en el .md: ${Object.keys(aceptadas).length} · nuevas: ${Object.keys(nuevas).length}`);
  if (!Object.keys(nuevas).length) process.exit(0);
  if (dry) process.exit(0);
  fs.writeFileSync(H.F_VINCULOS, JSON.stringify({ ...previas, ...nuevas }, null, 1));
  const c = H.calcular(H.cargarEntradas());
  H.escribir(c);
  const lista = cambios(nuevas, H.TEMPORADAS);
  const sql = conectar();
  try {
    for (const { temporada, borrar, nuevas: filas } of lista) {
      await sql.begin(async (tx) => {
        const b = await tx`delete from public.asistencia_motivos where temporada = ${temporada} and person_id in ${sql(borrar)}`;
        for (const x of filas) {
          await tx`insert into public.asistencia_motivos (temporada, person_id, nombre, ambito, fueron, excusa, sin_excusa, no_conv, lesion, total)
                   values (${x.temporada}, ${x.person_id}, ${x.nombre}, ${x.ambito}, ${x.fueron}, ${x.excusa}, ${x.sin_excusa}, ${x.no_conv}, ${x.lesion}, ${x.total})`;
        }
        console.log(`${temporada}: ${b.count} filas sustituidas por ${filas.length}`);
      });
    }
  } finally { await sql.end(); }
}
