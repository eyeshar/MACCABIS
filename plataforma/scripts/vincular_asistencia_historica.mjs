#!/usr/bin/env node
// Aplica las decisiones de Iván sobre las personas históricas de SportEasy (D166) en
// privado/sporteasy/propuestas_para_ivan.md (o el fichero que se pase), sin recargar nada:
//   - «OK»: vincula el perfil con la persona del club (el person_id entre (`…`) de la línea o, si no lo hay, el nombre
//     completo exacto tras «→»; si no hay exactamente una persona con ese nombre, se para y lo dice);
//   - «NO»: descarta el perfil (no es una persona: sus filas desaparecen).
// Guarda los vínculos en privado/sporteasy/vinculos_historico.json y los descartes en descartes_historico.json, regenera
// los JSON de privado/asistencia/ (sin tocar el .md de Iván) y, en la base, solo reescribe las filas de las personas
// afectadas: la histórica `sporteasy-<id>` desaparece y la del club recibe sus eventos (si dos perfiles coinciden en un
// evento, cuenta una vez). Una transacción por temporada. Repetible: rehace siempre las filas de todo lo decidido.
//
//   npm run db:asistencia-vincular                       (conexión de .env.local)
//   npm run db:asistencia-vincular -- --dry              dice qué haría, sin escribir nada
//   npm run db:asistencia-vincular -- --fichero <ruta>   otro .md de decisiones
// Por consola, solo recuentos e ids de perfil: nunca nombres.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { conectar } from './db.mjs';
import { filasDeJugadores } from './cargar_asistencia.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const H = require(path.join(RAIZ, '..', 'scripts', 'estadisticas', 'asistencia_historica.js'));

/**
 * Filas de la base a cambiar, por temporada: los person_id que se borran (las históricas de los perfiles decididos y las
 * personas del club que los reciben) y las filas nuevas de esas personas, sacadas del recuento ya regenerado.
 */
export function cambios({ perfiles, pids }, porTemporada) {
  const ids = new Set([...perfiles.map((p) => H.PREFIJO + p), ...pids]);
  return Object.entries(porTemporada).map(([temporada, { jugadores }]) => ({
    temporada, borrar: [...ids], nuevas: filasDeJugadores(temporada, jugadores).filter((f) => ids.has(f.person_id)),
  }));
}

/** Vínculos y descartes resultantes: los previos más los del .md. Lo que el .md no resuelve y no estaba ya vinculado, falta. */
export function decidir(dec, previas, descartesPrevios) {
  const vinculos = { ...previas, ...dec.vincular };
  for (const id of dec.descartar) delete vinculos[id];
  const descartes = [...new Set([...descartesPrevios, ...dec.descartar])].sort();
  const faltan = dec.sinResolver.filter((x) => !vinculos[x.id]);
  return { vinculos, descartes, faltan };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { config } = await import('dotenv');
  config({ path: path.join(RAIZ, '.env.local') });
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const iF = args.indexOf('--fichero');
  const md = iF >= 0 ? path.resolve(args[iF + 1]) : path.join(RAIZ, '..', 'privado', 'sporteasy', 'propuestas_para_ivan.md');
  const entradas = H.cargarEntradas();
  const dec = H.leerDecisiones(fs.readFileSync(md, 'utf8'), entradas.personas);
  const { vinculos, descartes, faltan } = decidir(dec, entradas.vinculos, entradas.descartes);
  console.log(`Decisiones: ${Object.keys(dec.vincular).length} vínculos resueltos en el .md, ${dec.descartar.length} descartes, ${dec.sinResolver.length} sin person_id ni nombre exacto`
    + ` (${dec.sinResolver.length - faltan.length} ya vinculados en vinculos_historico.json)`);
  if (faltan.length) {
    console.error(`PARO: ${faltan.length} perfiles sin una persona del club única (ids: ${faltan.map((x) => x.id).join(', ')}). No se adivina.`);
    process.exit(1);
  }
  const c = H.calcular({ ...entradas, vinculos, descartes });
  const pids = [...new Set(Object.values(vinculos))];
  const lista = cambios({ perfiles: [...Object.keys(vinculos), ...descartes], pids }, c.porTemporada);
  const historicas = new Set(Object.values(c.porTemporada).flatMap((t) => t.jugadores.map((j) => j.person_id)).filter((p) => p.startsWith(H.PREFIJO)));
  console.log(`Vínculos en total: ${Object.keys(vinculos).length} perfiles -> ${pids.length} personas del club · descartes: ${descartes.length} · personas históricas que quedan: ${historicas.size}`);
  for (const x of lista) console.log(`${dry ? '[dry] ' : ''}${x.temporada}: se reescriben las filas de ${x.borrar.length} ids con ${x.nuevas.length} filas`);
  if (dry) process.exit(0);
  fs.writeFileSync(H.F_VINCULOS, JSON.stringify(vinculos, null, 1));
  fs.writeFileSync(H.F_DESCARTES, JSON.stringify(descartes, null, 1));
  H.escribir(c, { propuestas: false });
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
