#!/usr/bin/env node
// asistencia_eventos (D170) CONTRA EL SUPABASE REAL, en SOLO LECTURA (como pruebas:respuestas-real, D94/D111). No crea ni
// borra cuentas ni escribe nada:
//   - anónimo por HTTPS con la clave pública;
//   - un jugador y un gestor con cuentas que YA existen, dentro de una transacción READ ONLY que adopta su rol y claims.
// Demuestra que solo los gestores leen el detalle por evento, que ningún rol de la API escribe, y que la migración no
// tocó asistencia_motivos. Vale antes de aplicar la migración (la tabla aún no existe) y después. Imprime recuentos, nunca
// nombres ni estados de nadie.
//
//   npm run pruebas:asistencia-eventos-real

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { conectar } from '../scripts/db.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(RAIZ, '.env.local') });
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sql = conectar();
let fallos = 0;
const ok = (c, que, det = '') => { if (c) console.log(`  OK    ${que}`); else { fallos++; console.log(`  FALLO ${que}${det ? ` -> ${det}` : ''}`); } };

async function api(ruta) {
  const r = await fetch(`${URL}/rest/v1${ruta}`, { headers: { apikey: ANON, authorization: `Bearer ${ANON}` } });
  let datos = null; try { datos = await r.json(); } catch {}
  return { status: r.status, datos };
}
const bloqueado = (r) => r.status === 401 || r.status === 403 || r.status === 404 || (Array.isArray(r.datos) && r.datos.length === 0);
async function como(userId, fn) {
  try {
    await sql.begin('read only', async (tx) => {
      await tx.unsafe('set local role authenticated');
      await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: 'authenticated' })}, true)`;
      await fn(tx);
      throw new Error('__deshacer__');
    });
  } catch (e) { if (e.message !== '__deshacer__') throw e; }
}
const intenta = async (tx, texto) => {
  try { await tx.savepoint(async (sp) => sp.unsafe(texto)); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; }
};

try {
  const cuentas = (await sql`select count(*)::int n from auth.users`)[0].n;
  console.log(`\nCuentas de auth.users: ${cuentas}`);
  const [{ aplicada }] = await sql`select exists (select 1 from supabase_migrations.schema_migrations where version = '20261102100000') aplicada`;
  const [{ existe }] = await sql`select to_regclass('public.asistencia_eventos') is not null existe`;
  const [mot] = await sql`select count(*)::int n, coalesce(sum(fueron + excusa + sin_excusa + no_conv + lesion + total), 0)::int s from public.asistencia_motivos`;
  console.log(`asistencia_motivos: ${mot.n} filas, suma ${mot.s} (no debe cambiar al aplicar ni al cargar)`);

  if (!existe) {
    ok(!aplicada, 'migración 20261102100000 (D170) aún no aplicada: la tabla no existe');
    ok(bloqueado(await api('/asistencia_eventos?select=*')), 'anónimo: la tabla no responde datos');
  } else {
    console.log('\n== Esquema y permisos');
    ok(aplicada, 'migración 20261102100000 registrada');
    const [p] = await sql`select has_table_privilege('anon', 'public.asistencia_eventos', 'select') a_sel, has_table_privilege('anon', 'public.asistencia_eventos', 'insert') a_ins,
      has_table_privilege('authenticated', 'public.asistencia_eventos', 'select') u_sel, has_table_privilege('authenticated', 'public.asistencia_eventos', 'insert') u_ins,
      has_table_privilege('authenticated', 'public.asistencia_eventos', 'update') u_upd, has_table_privilege('authenticated', 'public.asistencia_eventos', 'delete') u_del,
      (select relrowsecurity from pg_class where oid = 'public.asistencia_eventos'::regclass) rls`;
    ok(!p.a_sel && !p.a_ins, 'anon sin ningún permiso');
    ok(p.u_sel && !p.u_ins && !p.u_upd && !p.u_del && p.rls, 'authenticated solo SELECT; RLS activada; nadie escribe por la API');
    const pol = await sql`select cmd, qual from pg_policies where tablename = 'asistencia_eventos'`;
    ok(pol.length === 1 && pol[0].cmd === 'SELECT' && /is_gestor/.test(pol[0].qual), 'una única política: SELECT con is_gestor()', JSON.stringify(pol));
    const [{ total, temporadas, personas }] = await sql`select count(*)::int total, count(distinct temporada)::int temporadas, count(distinct person_id)::int personas from public.asistencia_eventos`;
    console.log(`  (${total} filas, ${temporadas} temporadas, ${personas} personas)`);
    const [{ raras }] = await sql`select count(*)::int raras from public.asistencia_eventos where (ambito = 'entrenos' and equipo is not null) or person_id like 'sporteasy-%'`;
    ok(raras === 0, 'ningún entreno con equipo ni persona histórica sin casar (D166: 0 históricas)');

    console.log('\n== Anónimo (HTTPS)');
    ok(bloqueado(await api('/asistencia_eventos?select=*')), 'anónimo NO lee asistencia_eventos');
    ok(bloqueado(await api('/asistencia_eventos?select=person_id,estado&limit=5')), 'anónimo NO lee ni columnas sueltas');

    console.log('\n== Un jugador real (solo lectura)');
    const [jug] = await sql`select u.id from public.jugadores j join auth.users u on lower(u.email) = lower(j.email)
                            where j.activo and not exists (select 1 from public.gestores g where g.user_id = u.id) limit 1`;
    if (!jug) ok(false, 'hay al menos un jugador (no gestor) con cuenta');
    else await como(jug.id, async (tx) => {
      ok((await tx`select count(*)::int n from public.asistencia_eventos`)[0].n === 0, 'un jugador NO lee nada de asistencia_eventos (ni lo suyo)');
      const r = await intenta(tx, `insert into public.asistencia_eventos (person_id, evento_ref, nombre, temporada, fecha, ambito, estado) values ('x', 'real-1', 'X', '2099-00', '2099-01-01', 'entrenos', 'fue')`);
      ok(!r.ok, 'no escribe');
    });

    console.log('\n== Un gestor real (solo lectura)');
    const [ges] = await sql`select user_id from public.gestores where user_id is not null limit 1`;
    if (!ges) ok(false, 'hay al menos un gestor con cuenta');
    else await como(ges.user_id, async (tx) => {
      const n = (await tx`select count(*)::int n from public.asistencia_eventos`)[0].n;
      ok(n === total, `un gestor lee las ${total} filas`, String(n));
      for (const [que, texto] of [['inserta', `insert into public.asistencia_eventos (person_id, evento_ref, nombre, temporada, fecha, ambito, estado) values ('x', 'real-1', 'X', '2099-00', '2099-01-01', 'entrenos', 'fue')`],
        ['modifica', `update public.asistencia_eventos set estado = 'lesion'`], ['borra', 'delete from public.asistencia_eventos']]) {
        ok(!(await intenta(tx, texto)).ok, `ni un gestor ${que} por la API (solo el script local)`);
      }
    });
  }
  const cuentas2 = (await sql`select count(*)::int n from auth.users`)[0].n;
  ok(cuentas2 === cuentas, `cuentas de auth.users iguales antes y después de la prueba (${cuentas})`);
} finally { await sql.end(); }
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
