#!/usr/bin/env node
// Carga en Supabase los partidos de liga de TODOS los equipos y sus estadisticas POR JUGADOR (D73).
// Los datos por jugador de otros equipos son de terceros: solo van a estas tablas (RLS: solo gestores).
//
//   npm run db:liga                    carga fuentes_fbm/2026-27/{liga,hojas}/*.xlsx (conexion de .env.local)
//   npm run db:liga -- --dry           lee, valida y cuenta, sin escribir
//   npm run db:liga -- 2026-27         otra temporada
//
// Usa el MISMO lector y las mismas validaciones que `npm run jornada` (scripts/estadisticas/liga.js): si la
// suma por jugador no es el total del equipo, o algo no cuadra, no carga nada. Es idempotente: cada partido se
// reemplaza entero (upsert del partido y de sus jugadores) dentro de una transaccion.

import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { conectar } from './db.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

export function leerLiga(temporada) {
  const { construir } = require(path.join(RAIZ, '..', 'scripts', 'estadisticas', 'liga.js'));
  const r = construir(temporada);
  if (r.errores.length) throw new Error('Las hojas no cuadran, no se carga nada:\n  - ' + r.errores.join('\n  - '));
  return r.privado;
}

export async function cargarLiga(sql, partidos, temporada, { log = console.log } = {}) {
  let jugadores = 0;
  await sql.begin(async (tx) => {
    for (const p of partidos) {
      const nuestro = ['MdA', 'MdL'].some((n) => n === p.local || n === p.visitante);
      const [fila] = await tx`
        insert into public.liga_partidos (temporada, grupo, jornada, fecha, local, visitante, pts_local, pts_visitante, hoja, nuestro)
        values (${temporada}, ${p.grupo}, ${p.jornada}, ${p.fecha}, ${p.local}, ${p.visitante}, ${p.pl}, ${p.pv}, ${p.fichero}, ${nuestro})
        on conflict (temporada, grupo, jornada, local, visitante)
        do update set fecha = excluded.fecha, pts_local = excluded.pts_local, pts_visitante = excluded.pts_visitante,
                      hoja = excluded.hoja, nuestro = excluded.nuestro, cargado_en = now()
        returning id`;
      await tx`delete from public.liga_estadisticas_jugador where partido_id = ${fila.id}`;
      for (const e of p.equipos) {
        for (const j of e.jugadores) {
          await tx`
            insert into public.liga_estadisticas_jugador
              (partido_id, equipo, dorsal, nombre, segundos, pts, p2a, p2i, p3a, p3i, tla, tli, faltas, valoracion, mas_menos)
            values (${fila.id}, ${e.equipo}, ${j.num}, ${j.nombre}, ${j.sec}, ${j.pts}, ${j.p2a}, ${j.p2i}, ${j.p3a}, ${j.p3i},
                    ${j.tla}, ${j.tli}, ${j.fc}, ${j.val}, ${j.pm})`;
          jugadores++;
        }
      }
    }
  });
  log(`Liga ${temporada}: ${partidos.length} partidos y ${jugadores} filas de jugador cargados.`);
  return { partidos: partidos.length, jugadores };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const temporada = args.find((a) => /^\d{4}-\d{2}$/.test(a)) || '2026-27';
  try {
    const partidos = leerLiga(temporada);
    const n = partidos.reduce((s, p) => s + p.equipos.reduce((t, e) => t + e.jugadores.length, 0), 0);
    if (args.includes('--dry')) {
      console.log(`[dry] ${partidos.length} partidos, ${n} filas de jugador. No se escribe nada.`);
    } else {
      const dotenv = await import('dotenv');
      dotenv.config({ path: path.join(RAIZ, '.env.local') });
      const sql = conectar();
      try {
        const host = (() => { try { return new URL(process.env.SUPABASE_DB_URL).hostname; } catch { return '?'; } })();
        console.log(`Destino: ${host}`);
        await cargarLiga(sql, partidos, temporada);
      } finally { await sql.end(); }
    }
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  }
}
