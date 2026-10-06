#!/usr/bin/env node
// Carga en Supabase la liga de TODOS los equipos (D73): partidos, estadisticas POR JUGADOR (de terceros: solo
// gestores, RLS), el calendario propio de MdA y MdL y la clasificacion calculada.
//
//   npm run db:liga                    carga fuentes_fbm/2026-27/{liga,hojas}/*.xlsx (conexion de .env.local)
//   npm run db:liga -- --dry           lee, valida y cuenta, sin escribir
//   npm run db:liga -- 2026-27         otra temporada
//
// Usa el MISMO lector y las mismas validaciones que `npm run jornada` (scripts/estadisticas/liga.js): si la
// suma por jugador no es el total del equipo, o algo no cuadra, no carga nada. La temporada se REEMPLAZA entera
// dentro de una transaccion (nunca quedan filas viejas ni duplicadas), asi que es repetible.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { conectar } from './db.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

/** Lee y valida las hojas. Devuelve lo privado (por jugador), la clasificacion calculada (publica) y el calendario propio. */
export function leerLiga(temporada) {
  const { construir } = require(path.join(RAIZ, '..', 'scripts', 'estadisticas', 'liga.js'));
  const { nombreTitulo } = require(path.join(RAIZ, '..', 'scripts', 'estadisticas', 'util.js'));
  const r = construir(temporada);
  if (r.errores.length) throw new Error('Las hojas no cuadran, no se carga nada:\n  - ' + r.errores.join('\n  - '));
  const cal = JSON.parse(fs.readFileSync(path.join(RAIZ, '..', 'data', `calendario_${temporada}.json`), 'utf8'));
  const calendario = cal.partidos.filter((p) => p.fase === 'liga').map((p) => ({ ...p, rival: p.rival ? nombreTitulo(p.rival) : null }));
  return { privado: r.privado, publico: r.publico, calendario };
}

export async function cargarLiga(sql, liga, temporada, { log = console.log } = {}) {
  const { privado: partidos, publico, calendario } = liga;
  let jugadores = 0;
  let filasClasificacion = 0;
  await sql.begin(async (tx) => {
    // Se REEMPLAZA la temporada entera (los jugadores caen en cascada con sus partidos).
    await tx`delete from public.liga_partidos where temporada = ${temporada}`;
    await tx`delete from public.liga_calendario where temporada = ${temporada}`;
    await tx`delete from public.liga_clasificacion where temporada = ${temporada}`;
    for (const c of calendario) {
      await tx`insert into public.liga_calendario (temporada, equipo, jornada, fecha, hora, local, descansa, rival, campo)
               values (${temporada}, ${c.equipo}, ${c.jornada}, ${c.fecha}, ${c.hora}, ${c.local}, ${!!c.descansa}, ${c.rival}, ${c.campo})`;
    }
    for (const [grupo, g] of Object.entries(publico.grupos)) {
      for (const x of g.clasificacion) {
        await tx`insert into public.liga_clasificacion (temporada, grupo, pos, equipo, nuestro, pj, g, p, pf, pc, pts, pts_fuente)
                 values (${temporada}, ${grupo}, ${x.pos}, ${x.equipo}, ${x.nuestro}, ${x.pj}, ${x.g}, ${x.p}, ${x.pf}, ${x.pc}, ${x.pts}, ${x.pts_fuente ?? null})`;
        filasClasificacion++;
      }
    }
    for (const p of partidos) {
      const nuestro = ['MdA', 'MdL'].some((n) => n === p.local || n === p.visitante);
      const [fila] = await tx`
        insert into public.liga_partidos (temporada, grupo, jornada, fecha, local, visitante, pts_local, pts_visitante, hoja, nuestro)
        values (${temporada}, ${p.grupo}, ${p.jornada}, ${p.fecha}, ${p.local}, ${p.visitante}, ${p.pl}, ${p.pv}, ${p.fichero}, ${nuestro})
        returning id`;
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
  log(`Liga ${temporada}: ${partidos.length} partidos, ${jugadores} filas de jugador, ${calendario.length} partidos de calendario y ${filasClasificacion} filas de clasificacion cargados.`);
  return { partidos: partidos.length, jugadores, calendario: calendario.length, clasificacion: filasClasificacion };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const temporada = args.find((a) => /^\d{4}-\d{2}$/.test(a)) || '2026-27';
  try {
    const liga = leerLiga(temporada);
    const n = liga.privado.reduce((s, p) => s + p.equipos.reduce((t, e) => t + e.jugadores.length, 0), 0);
    if (args.includes('--dry')) {
      console.log(`[dry] ${liga.privado.length} partidos, ${n} filas de jugador, ${liga.calendario.length} de calendario. No se escribe nada.`);
    } else {
      const dotenv = await import('dotenv');
      dotenv.config({ path: path.join(RAIZ, '.env.local') });
      const sql = conectar();
      try {
        const host = (() => { try { return new URL(process.env.SUPABASE_DB_URL).hostname; } catch { return '?'; } })();
        console.log(`Destino: ${host}`);
        await cargarLiga(sql, liga, temporada);
      } finally { await sql.end(); }
    }
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  }
}
