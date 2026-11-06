#!/usr/bin/env node
// Protecciones de D111 para una carga de la liga (db:liga) en el real: foto de antes y de despues, volcado de las 4 tablas
// de la temporada y vuelta atras. Se uso por primera vez en la carga de la jornada de G3-G6 (D186, 06/11/2026); estaba
// fuera de git y la prueba de su vuelta atras en la pila se conecto al real (ESTADO, «Incidente durante la carga de
// D186»). Desde la norma 19 (D187), todo modo que se conecta exige el destino (scripts/lib/destino.mjs):
//
//   npm run db:d111-liga -- foto <salida.json> --confirmar <ref>       solo lectura (transaccion read only): partidos y
//                                                                    filas por grupo, huellas de G1/G2, clasificacion,
//                                                                    calendario, cuentas de auth, acceso sin sesion
//                                                                    (clave publica) y permisos
//   npm run db:d111-liga -- volcar <fichero.json> --confirmar <ref>    copia de las 4 tablas de la temporada (solo lee;
//                                                                    el fichero, a privado/backups/, fuera de git)
//   npm run db:d111-liga -- revertir <fichero.json> --confirmar <ref>  borra la temporada y mete el volcado (una
//                                                                    transaccion)
//   npm run db:d111-liga -- esperado                                 huella de G1/G2 que daria db:liga con las hojas
//                                                                    locales (no se conecta a nada)
//
// Con --pila en vez de --confirmar <ref>, contra la pila local (SUPABASE_DB_URL y NEXT_PUBLIC_SUPABASE_URL a 127.0.0.1,
// y NEXT_PUBLIC_SUPABASE_ANON_KEY, pasados por el entorno: nunca lee .env.local). Asi se ensaya la vuelta atras.
// Otra temporada: --temporada 2025-26. Por consola, solo recuentos y huellas: ningun nombre de jugador.

import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { conectar } from './db.mjs';
import { leerLiga } from './cargar_liga.mjs';
import { exigirDestino } from './lib/destino.mjs';

export const TABLAS = ['liga_partidos', 'liga_estadisticas_jugador', 'liga_calendario', 'liga_clasificacion'];
const sha = (x) => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
const ordenar = (filas) => [...filas].map((f) => JSON.stringify(f)).sort();

/** Huella de G1/G2 a partir de partidos {grupo, jornada, local, visitante, pl, pv} y filas {grupo, jornada, equipo, pts}. */
export function huellaG12(partidos, filas) {
  const p = partidos.filter((x) => x.grupo === 'G1' || x.grupo === 'G2').map((x) => ({ g: x.grupo, j: x.jornada, l: x.local, v: x.visitante, pl: x.pl, pv: x.pv }));
  const suma = {};
  for (const f of filas.filter((x) => x.grupo === 'G1' || x.grupo === 'G2')) {
    const k = `${f.grupo}|J${f.jornada}|${f.equipo}`; suma[k] = (suma[k] ?? 0) + f.pts;
  }
  const s = Object.entries(suma).sort();
  return { partidos: p.length, huella_partidos: sha(ordenar(p)), huella_puntos_equipo_jornada: sha(s), filas: filas.filter((x) => x.grupo === 'G1' || x.grupo === 'G2').length,
    detalle_partidos: ordenar(p), detalle_puntos: s };
}

export async function foto(sql, T, { api, anon }) {
  const d = await sql.begin('read only', async (tx) => ({
    porGrupo: await tx`select p.grupo, count(distinct p.id)::int partidos, count(distinct p.id) filter (where p.jornada is not null)::int con_jornada, count(e.id)::int filas
      from public.liga_partidos p left join public.liga_estadisticas_jugador e on e.partido_id = p.id where p.temporada = ${T} group by p.grupo order by p.grupo`,
    partidos: await tx`select grupo, jornada, local, visitante, pts_local pl, pts_visitante pv from public.liga_partidos where temporada = ${T}`,
    filas: await tx`select p.grupo, p.jornada, e.equipo, e.pts from public.liga_estadisticas_jugador e join public.liga_partidos p on p.id = e.partido_id where p.temporada = ${T}`,
    clasG12: await tx`select grupo, pos, equipo, pj, g, p, pf, pc, pts from public.liga_clasificacion where temporada = ${T} and grupo in ('G1','G2')`,
    cal: await tx`select equipo, jornada, fecha, hora, local, descansa, rival, campo from public.liga_calendario where temporada = ${T}`,
    auth: (await tx`select count(*)::int n from auth.users`)[0].n,
    permisos: await tx`select tablename, policyname, cmd, roles::text, qual, with_check from pg_policies where schemaname = 'public' and tablename like 'liga%' order by 1, 2`,
    grants: await tx`select table_name, grantee, privilege_type from information_schema.role_table_grants where table_schema = 'public' and (table_name like 'liga%' or table_name like 'v_liga%') order by 1, 2, 3`,
    rls: await tx`select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relname like 'liga%' order by 1`,
  }));
  // Sin sesion, con la clave publica (como cualquiera en internet)
  const anonimo = {};
  for (const t of [...TABLAS, 'v_liga_jugadores']) {
    const r = await fetch(`${api}/rest/v1/${t}?select=*&limit=5`, { signal: AbortSignal.timeout(20000), headers: { apikey: anon, authorization: `Bearer ${anon}` } });
    let n;
    try { const j = await r.json(); n = Array.isArray(j) ? j.length : `estado ${r.status}`; } catch { n = `estado ${r.status}`; }
    anonimo[t] = n;
  }
  const ajenos = d.partidos.filter((x) => /^G[3-6]$/.test(x.grupo));
  return {
    temporada: T, por_grupo: d.porGrupo, g12: huellaG12(d.partidos, d.filas), clasificacion_g12: sha(ordenar(d.clasG12)),
    calendario: { filas: d.cal.length, huella: sha(ordenar(d.cal)) }, auth_usuarios: d.auth, anonimo,
    permisos: sha([d.permisos, d.grants, d.rls]), rls: d.rls.map((x) => `${x.relname}:${x.relrowsecurity}`),
    ajenos: { partidos: ajenos.length, con_jornada: ajenos.filter((x) => x.jornada != null).length },
  };
}

export async function volcar(sql, T) {
  return sql.begin('read only', async (tx) => ({
    generado: new Date().toISOString(), temporada: T, tablas: {
      liga_partidos: (await tx`select to_jsonb(t) r from public.liga_partidos t where temporada = ${T}`).map((x) => x.r),
      liga_estadisticas_jugador: (await tx`select to_jsonb(e) r from public.liga_estadisticas_jugador e join public.liga_partidos p on p.id = e.partido_id where p.temporada = ${T}`).map((x) => x.r),
      liga_calendario: (await tx`select to_jsonb(t) r from public.liga_calendario t where temporada = ${T}`).map((x) => x.r),
      liga_clasificacion: (await tx`select to_jsonb(t) r from public.liga_clasificacion t where temporada = ${T}`).map((x) => x.r),
    },
  }));
}

/** Borra la temporada y vuelve a meter el volcado, en una transaccion (si algo falla, no cambia nada). */
export async function revertir(sql, d) {
  if (!d?.temporada || !d.tablas || TABLAS.some((t) => !Array.isArray(d.tablas[t]))) throw new Error('el fichero no es un volcado de d111_liga');
  await sql.begin(async (tx) => {
    await tx`delete from public.liga_partidos where temporada = ${d.temporada}`;   // las filas por jugador caen en cascada
    await tx`delete from public.liga_calendario where temporada = ${d.temporada}`;
    await tx`delete from public.liga_clasificacion where temporada = ${d.temporada}`;
    for (const t of TABLAS) {
      if (!d.tablas[t].length) continue;
      await tx.unsafe(`insert into public.${t} select * from jsonb_populate_recordset(null::public.${t}, $1::text::jsonb)`, [JSON.stringify(d.tablas[t])]);
    }
  });
}

const cuenta = (d) => Object.fromEntries(Object.entries(d.tablas).map(([k, v]) => [k, v.length]));

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [modo] = process.argv.slice(2);
  if (!['foto', 'volcar', 'revertir', 'esperado'].includes(modo)) {
    console.error('Uso: npm run db:d111-liga -- foto|volcar|revertir <fichero.json> --confirmar <ref> (o --pila) · esperado');
    process.exit(1);
  }
  const temporadaDe = (a) => { const i = a.indexOf('--temporada'); return i >= 0 ? a[i + 1] : '2026-27'; };
  if (modo === 'esperado') {
    const T = temporadaDe(process.argv);
    const liga = leerLiga(T);
    const partidos = liga.privado.map((p) => ({ grupo: p.grupo, jornada: p.jornada, local: p.local, visitante: p.visitante, pl: p.pl, pv: p.pv }));
    const filas = liga.privado.flatMap((p) => p.equipos.flatMap((e) => e.jugadores.map((j) => ({ grupo: p.grupo, jornada: p.jornada, equipo: e.equipo, pts: j.pts }))));
    const h = huellaG12(partidos, filas);
    console.log(JSON.stringify({ temporada: T, partidos: h.partidos, filas: h.filas, huella_partidos: h.huella_partidos, huella_puntos_equipo_jornada: h.huella_puntos_equipo_jornada,
      ajenos: liga.privado.filter((p) => /^G[3-6]$/.test(p.grupo)).length, ajenos_con_jornada: liga.privado.filter((p) => /^G[3-6]$/.test(p.grupo) && p.jornada != null).length }, null, 1));
    process.exit(0);
  }
  // norma 19: antes de leer el fichero ni conectarse; foto mira tambien la API (sin sesion)
  const { args } = await exigirDestino(process.argv.slice(2), { conApi: modo === 'foto' });
  const T = temporadaDe(args);
  const fichero = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--temporada')[1];
  if (!fichero) { console.error(`Falta el fichero: npm run db:d111-liga -- ${modo} <fichero.json> …`); process.exit(1); }
  const sql = conectar();
  try {
    if (modo === 'foto') {
      const f = await foto(sql, T, { api: process.env.NEXT_PUBLIC_SUPABASE_URL, anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY });
      fs.writeFileSync(fichero, JSON.stringify(f, null, 1));
      const { detalle_partidos, detalle_puntos, ...g12 } = f.g12;
      console.log(JSON.stringify({ ...f, g12 }, null, 1));
    } else if (modo === 'volcar') {
      const d = await volcar(sql, T);
      fs.writeFileSync(fichero, JSON.stringify(d));
      console.log('volcado', fichero, cuenta(d));
    } else {
      const d = JSON.parse(fs.readFileSync(fichero, 'utf8'));
      if (d.temporada !== T) throw new Error(`el volcado es de ${d.temporada} y se ha pedido ${T} (--temporada)`);
      await revertir(sql, d);
      console.log('revertido desde', fichero, cuenta(d));
    }
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally { await sql.end(); }
}
