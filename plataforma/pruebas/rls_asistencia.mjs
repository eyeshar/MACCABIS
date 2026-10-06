#!/usr/bin/env node
// RLS de la asistencia con motivos (D82), contra la pila local (Postgres + PostgREST reales con NUESTRAS migraciones).
// Los motivos de ausencia solo los leen los gestores; anon, los jugadores y un usuario sin ficha, nada. Nadie escribe
// por la API.
//
//   npm run pruebas:asistencia
//
// Carga privado/asistencia/*.json (fuera de git) con el mismo codigo que `npm run db:asistencia`; si no estan en este
// equipo, usa dos filas de ejemplo.

import { arrancar } from './pila.mjs';
import { cargarAsistencia, leerAsistencia, temporadasDisponibles } from '../scripts/cargar_asistencia.mjs';

let fallos = 0;
const ok = (cond, que, detalle = '') => {
  if (cond) console.log(`  OK    ${que}`);
  else { fallos++; console.log(`  FALLO ${que}${detalle ? ` -> ${detalle}` : ''}`); }
};

const pila = await arrancar();
try {
  const { sql, url, anonKey } = pila;
  const api = async (ruta, { metodo = 'GET', cuerpo, token } = {}) => {
    const r = await fetch(`${url}/rest/v1${ruta}`, {
      method: metodo,
      headers: { apikey: anonKey, authorization: `Bearer ${token ?? anonKey}`, 'content-type': 'application/json', prefer: 'return=representation' },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    let datos = null;
    try { datos = await r.json(); } catch {}
    return { status: r.status, datos };
  };
  const vacioOBloqueado = (r) => r.status === 401 || r.status === 403 || (Array.isArray(r.datos) && r.datos.length === 0);

  console.log('\n== Carga (la misma que npm run db:asistencia)');
  const temporadas = temporadasDisponibles();
  let total = 0;
  if (temporadas.length) {
    for (const t of temporadas) { const f = leerAsistencia(t); total += f.length; await cargarAsistencia(sql, t, f, { log: () => {} }); }
    for (const t of temporadas) await cargarAsistencia(sql, t, leerAsistencia(t), { log: () => {} });
  } else {
    const ejemplo = [
      { temporada: '2026-27', person_id: 'esteban-jon', nombre: 'Jon Esteban', ambito: 'partidos', fueron: 2, excusa: 1, sin_excusa: 0, no_conv: 0, lesion: 1, total: 4 },
      { temporada: '2026-27', person_id: 'esteban-jon', nombre: 'Jon Esteban', ambito: 'entrenos', fueron: 2, excusa: 2, sin_excusa: 0, no_conv: 0, lesion: 0, total: 4 },
    ];
    total = ejemplo.length;
    await cargarAsistencia(sql, '2026-27', ejemplo, { log: () => {} });
    console.log('  (sin privado/asistencia/ en este equipo: filas de ejemplo)');
  }
  const [{ n }] = await sql`select count(*)::int n from public.asistencia_motivos`;
  ok(n === total && n > 0, `${total} filas cargadas (${temporadas.join(', ') || 'ejemplo'}), y cargar dos veces no duplica`, String(n));
  const [{ m }] = await sql`select count(*)::int m from public.asistencia_motivos where excusa + sin_excusa + no_conv + lesion > 0`;
  ok(m > 0, 'los motivos (excusa, lesion...) estan en la tabla');

  await sql`update public.jugadores set email = 'jugador@pruebas.local' where person_id = 'esteban-jon'`;
  const gestorId = await pila.crearUsuario('gestor@pruebas.local', 'no-se-usa');
  await sql`insert into public.gestores (user_id, nombre, email) values (${gestorId}, 'Gestor de pruebas', 'gestor@pruebas.local')`;
  const jugadorId = await pila.crearUsuario('jugador@pruebas.local', 'no-se-usa');
  const intrusoId = await pila.crearUsuario('intruso@pruebas.local', 'no-se-usa');
  const jwt = (id, email) => pila.firmar({ sub: id, role: 'authenticated', email });
  const tGestor = await jwt(gestorId, 'gestor@pruebas.local');
  const tJugador = await jwt(jugadorId, 'jugador@pruebas.local');
  const tIntruso = await jwt(intrusoId, 'intruso@pruebas.local');

  console.log('\n== RLS: nadie salvo los gestores lee los motivos');
  ok(vacioOBloqueado(await api('/asistencia_motivos?select=*')), 'anonimo NO lee asistencia_motivos');
  ok(vacioOBloqueado(await api('/asistencia_motivos?select=*', { token: tJugador })), 'un jugador NO lee asistencia_motivos (ni los demas ni los suyos)');
  ok(vacioOBloqueado(await api('/asistencia_motivos?select=*&person_id=eq.esteban-jon', { token: tJugador })), 'un jugador NO lee su propia fila');
  ok(vacioOBloqueado(await api('/asistencia_motivos?select=*', { token: tIntruso })), 'un usuario sin ficha NO lee asistencia_motivos');
  const rg = await api('/asistencia_motivos?select=*', { token: tGestor });
  ok(rg.status === 200 && rg.datos.length === total, `el gestor lee las ${total} filas`, `status ${rg.status} / ${rg.datos?.length}`);
  ok(rg.status === 200 && rg.datos.every((x) => 'excusa' in x && 'lesion' in x), 'el gestor ve los motivos');

  console.log('\n== Escritura: nadie escribe por la API (solo el script local)');
  const nueva = { temporada: '2099-00', person_id: 'x', nombre: 'X', ambito: 'partidos', fueron: 1 };
  for (const [quien, token] of [['anonimo', undefined], ['jugador', tJugador], ['gestor', tGestor]]) {
    ok((await api('/asistencia_motivos', { metodo: 'POST', cuerpo: nueva, token })).status >= 400, `${quien} NO inserta`);
    await api('/asistencia_motivos?fueron=gte.0', { metodo: 'PATCH', cuerpo: { lesion: 99 }, token });
    await api('/asistencia_motivos?fueron=gte.0', { metodo: 'DELETE', token });
  }
  const [{ n2 }] = await sql`select count(*)::int n2 from public.asistencia_motivos`;
  const [{ l99 }] = await sql`select count(*)::int l99 from public.asistencia_motivos where lesion = 99`;
  ok(n2 === total && l99 === 0, 'tras los intentos de escritura, modificacion y borrado no ha cambiado nada');

  console.log('\n== Permisos de base de datos');
  const [{ anon_sel, aut_ins, aut_upd, aut_del }] = await sql`
    select has_table_privilege('anon', 'public.asistencia_motivos', 'select') as anon_sel,
           has_table_privilege('authenticated', 'public.asistencia_motivos', 'insert') as aut_ins,
           has_table_privilege('authenticated', 'public.asistencia_motivos', 'update') as aut_upd,
           has_table_privilege('authenticated', 'public.asistencia_motivos', 'delete') as aut_del`;
  ok(!anon_sel, 'anon no tiene SELECT');
  ok(!aut_ins && !aut_upd && !aut_del, 'authenticated no tiene INSERT/UPDATE/DELETE');
  const [{ rls }] = await sql`select relrowsecurity as rls from pg_class where relname = 'asistencia_motivos'`;
  ok(rls === true, 'RLS activada');
  const pol = await sql`select cmd from pg_policies where tablename = 'asistencia_motivos'`;
  ok(pol.length === 1 && pol[0].cmd === 'SELECT', 'una unica politica, de SELECT para gestores', JSON.stringify(pol));
} finally {
  await pila.parar();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
