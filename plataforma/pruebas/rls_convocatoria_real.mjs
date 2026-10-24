#!/usr/bin/env node
// Convocatoria (D107, D108) CONTRA EL SUPABASE REAL, en SOLO LECTURA (como pruebas:respuestas-real, D94). Se ejecuta
// DESPUES de aplicar 20261023100000_convocatoria en produccion. No crea ni borra cuentas ni escribe nada:
//   - anonimo por HTTPS con la clave publica;
//   - un jugador y un gestor con cuentas que YA existen, dentro de una transaccion READ ONLY que adopta su rol y claims.
// Demuestra que ni un anonimo ni un jugador leen notas, niveles, datos privados, convocatorias (aprobadas o no) ni
// cambios, ni escriben nada; y que mi_convocatoria solo devuelve convocatorias aprobadas y solo lo suyo. Nunca imprime
// niveles ni notas: solo recuentos.
//
//   npm run pruebas:convocatoria-real

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
const TABLAS = ['jugadores_privado', 'convocatorias', 'convocatoria_cambios'];
const FUNCIONES = ['convocatoria_guardar', 'convocatoria_aprobar', 'convocatoria_marcar', 'mi_convocatoria'];

async function api(ruta, { metodo = 'GET', cuerpo } = {}) {
  const r = await fetch(`${URL}/rest/v1${ruta}`, { method: metodo, headers: { apikey: ANON, authorization: `Bearer ${ANON}`, 'content-type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
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
const intenta = async (tx, texto, params = []) => {
  try { const r = await tx.savepoint(async (sp) => sp.unsafe(texto, params)); return { ok: true, r }; } catch (e) { return { ok: false, error: e.message }; }
};

try {
  const cuentas0 = (await sql`select count(*)::int n from auth.users`)[0].n;
  console.log('\n== Esquema y permisos');
  const [mig] = await sql`select count(*)::int n from supabase_migrations.schema_migrations where version = '20261023100000'`;
  ok(mig.n === 1, 'la migración 20261023100000_convocatoria está registrada');
  for (const t of TABLAS) {
    const [p] = await sql`select to_regclass(${'public.' + t}) is not null existe, has_table_privilege('anon', ${'public.' + t}, 'select') a_sel,
      has_table_privilege('authenticated', ${'public.' + t}, 'delete') u_del, (select relrowsecurity from pg_class where oid = to_regclass(${'public.' + t})) rls`;
    ok(p.existe && !p.a_sel && !p.u_del && p.rls, `${t}: existe, RLS activa, anónimo sin permisos, nadie borra`);
    const pol = await sql`select policyname, cmd, qual from pg_policies where schemaname = 'public' and tablename = ${t}`;
    ok(pol.length > 0 && pol.every((x) => /is_gestor\(\)/.test(`${x.qual ?? ''}`) || x.cmd === 'INSERT'), `${t}: todas sus políticas exigen ser gestor`, JSON.stringify(pol.map((x) => [x.policyname, x.cmd])));
  }
  const fns = await sql`select proname, has_function_privilege('anon', oid, 'execute') anon, pg_get_functiondef(oid) def from pg_proc where pronamespace = 'public'::regnamespace and proname = any(${FUNCIONES})`;
  ok(fns.length === FUNCIONES.length && fns.every((f) => !f.anon), `las ${FUNCIONES.length} funciones existen y anónimo no ejecuta ninguna`);
  const mi = fns.find((f) => f.proname === 'mi_convocatoria')?.def ?? '';
  ok(/estado = 'aprobada'/.test(mi) && /_mi_person_id\(\)/.test(mi) && !/nivel|posicion|nota_|dificultad|jugadores_privado/.test(mi), 'mi_convocatoria: solo aprobadas, solo lo de quien consulta, sin niveles, notas ni dificultad');
  const [cnt] = await sql`select (select count(*)::int from public.jugadores_privado) priv, (select count(*)::int from public.convocatorias) conv,
    (select count(*)::int from public.convocatorias where estado <> 'aprobada') borr, (select count(*)::int from public.convocatoria_cambios) camb`;
  console.log(`  (en la base: ${cnt.priv} filas de datos privados, ${cnt.conv} convocatorias, ${cnt.borr} sin aprobar, ${cnt.camb} cambios)`);

  console.log('\n== Anónimo (HTTPS)');
  for (const t of TABLAS) ok(bloqueado(await api(`/${t}?select=*`)), `anónimo NO lee ${t}`);
  ok(bloqueado(await api('/jugadores_privado?select=nivel,nota_ataque,nota_defensa,nota_total,pts_min')), 'anónimo NO lee niveles ni notas');
  const rMi = await api('/rpc/mi_convocatoria', { metodo: 'POST', cuerpo: {} });
  ok(rMi.status >= 400 || JSON.stringify(rMi.datos) === '[]', 'anónimo: mi_convocatoria no le da nada', `${rMi.status}`);
  ok((await api('/rpc/convocatoria_guardar', { metodo: 'POST', cuerpo: { p_fecha: '2026-11-08', p_jornada: 4, p_equipos: {}, p_dificultad: {}, p_accion: 'blanco' } })).status >= 400, 'anónimo NO guarda convocatorias');
  ok((await api('/jugadores_privado', { metodo: 'POST', cuerpo: { person_id: 'x', nivel: 'A' } })).status >= 400, 'anónimo NO escribe datos privados');

  console.log('\n== Un jugador real (solo lectura)');
  const [jug] = await sql`select u.id, j.person_id from public.jugadores j join auth.users u on lower(u.email) = lower(j.email)
                          where j.activo and not exists (select 1 from public.gestores g where g.user_id = u.id) order by j.person_id limit 1`;
  const [ges] = await sql`select user_id from public.gestores where user_id is not null limit 1`;
  if (!jug) ok(false, 'hay al menos un jugador (no gestor) con cuenta');
  else {
    await como(jug.id, async (tx) => {
      ok((await tx`select public.is_gestor() g`)[0].g === false, 'la cuenta elegida es de jugador, no de gestor');
      for (const t of TABLAS) {
        const r = await intenta(tx, `select count(*)::int n from public.${t}`);
        ok(!r.ok || r.r[0].n === 0, `el jugador NO lee ${t} (${r.ok ? '0 filas visibles' : 'permiso denegado'})`);
      }
      const n = await intenta(tx, 'select nivel, nota_ataque, nota_defensa, nota_total, minutos, pts_min from public.jugadores_privado');
      ok(!n.ok || n.r.length === 0, 'el jugador NO lee niveles ni notas (tampoco las suyas)');
      const s = await intenta(tx, "select count(*)::int n from public.convocatorias where estado = 'borrador'");
      ok(!s.ok || s.r[0].n === 0, 'el jugador NO ve convocatorias sin aprobar');
      const m = await intenta(tx, 'select public.mi_convocatoria() r');
      ok(m.ok && Array.isArray(m.r[0].r) && m.r[0].r.every((x) => Object.keys(x).sort().join() === 'equipos,fecha'), 'mi_convocatoria: solo fecha y sus equipos', m.ok ? JSON.stringify(m.r[0].r).slice(0, 120) : m.error);
      const g = await intenta(tx, "select public.convocatoria_guardar('2026-11-08', 4, '{}'::jsonb, '{}'::jsonb, 'blanco')");
      ok(!g.ok && /solo_gestores|read-only|read only/.test(g.error), 'el jugador NO guarda convocatorias (solo_gestores)', g.error);
    });
    if (ges) {
      await como(ges.user_id, async (tx) => {
        ok((await tx`select public.is_gestor() g`)[0].g === true, 'un gestor real sí es gestor');
        const r = await intenta(tx, 'select count(*)::int n from public.jugadores_privado');
        ok(r.ok && r.r[0].n === cnt.priv, `y lee los datos privados (${r.ok ? r.r[0].n : '?'} filas)`);
      });
    }
  }
  const cuentas1 = (await sql`select count(*)::int n from auth.users`)[0].n;
  ok(cuentas0 === cuentas1, `no se ha creado ni borrado ninguna cuenta (${cuentas0} antes y después)`);
} finally {
  await sql.end();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
