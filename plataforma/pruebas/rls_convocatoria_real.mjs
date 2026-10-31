#!/usr/bin/env node
// Convocatoria (D107, D108) CONTRA EL SUPABASE REAL, en SOLO LECTURA (como pruebas:respuestas-real, D94). Se ejecuta
// DESPUES de aplicar 20261023100000_convocatoria en produccion. No crea ni borra cuentas ni escribe nada:
//   - anonimo por HTTPS con la clave publica;
//   - un jugador y un gestor con cuentas que YA existen, dentro de una transaccion READ ONLY que adopta su rol y claims.
// Demuestra que ni un anonimo ni un jugador leen notas, niveles, datos privados, convocatorias (aprobadas o no) ni
// cambios, ni escriben nada; y que mi_convocatoria solo devuelve convocatorias aprobadas y solo lo suyo. Nunca imprime
// niveles ni notas: solo recuentos. D146: las marcas de disponibilidad; D152: mi_disponibilidad_defecto() solo da a cada
// jugador su marca y sus entrenos quitados.
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
  console.log('\n== Página del domingo del jugador (D128, migración 20261025100000)');
  const [m9] = await sql`select count(*)::int n from supabase_migrations.schema_migrations where version = '20261025100000'`;
  if (!m9.n) console.log('  (aún no aplicada: nada que comprobar)');
  else {
    const f9 = await sql`select proname, has_function_privilege('anon', oid, 'execute') anon from pg_proc where pronamespace = 'public'::regnamespace and proname in ('convocados_del_domingo', 'ultima_importacion_respuestas')`;
    ok(f9.length === 2 && f9.every((f) => !f.anon), 'convocados_del_domingo y ultima_importacion_respuestas existen y anónimo no las ejecuta');
    const rA = await api('/rpc/convocados_del_domingo', { metodo: 'POST', cuerpo: { p_fecha: '2026-10-25' } });
    ok(rA.status >= 400 || rA.datos === null, 'anónimo (HTTPS): convocados_del_domingo no le da nada', `${rA.status}`);
    const [apr] = await sql`select fecha::text, equipos from public.convocatorias where estado = 'aprobada' order by fecha desc limit 1`;
    const [bor] = await sql`select fecha::text from public.convocatorias where estado <> 'aprobada' order by fecha desc limit 1`;
    if (jug) {
      await como(jug.id, async (tx) => {
        if (apr) {
          const r = await intenta(tx, 'select public.convocados_del_domingo($1::date) r', [apr.fecha]);
          const v = r.ok ? r.r[0].r : null;
          const bien = v && Object.keys(v).every((k) => ['MdA', 'MdL'].includes(k)) && Object.entries(v).every(([k, xs]) => Array.isArray(xs) && xs.every((x) => typeof x === 'string') && xs.length === (apr.equipos[k] ?? []).length);
          ok(bien, `jugador, convocatoria aprobada del ${apr.fecha}: solo nombres por equipo (${v ? Object.entries(v).map(([k, xs]) => `${k} ${xs.length}`).join(', ') : '—'})`, r.ok ? '' : r.error);
        } else console.log('  (no hay ninguna convocatoria aprobada todavía)');
        if (bor) {
          const r = await intenta(tx, 'select public.convocados_del_domingo($1::date) r', [bor.fecha]);
          ok(r.ok && r.r[0].r === null, `jugador, convocatoria sin aprobar del ${bor.fecha}: nada (null)`);
        }
        const u = await intenta(tx, 'select public.ultima_importacion_respuestas() r');
        ok(u.ok && (u.r[0].r === null || u.r[0].r instanceof Date), 'jugador: ultima_importacion_respuestas da solo una hora');
      });
    }
  }

  console.log('\n== Disponibilidad por defecto (D146, migración 20261028230000)');
  const [m146] = await sql`select count(*)::int n from supabase_migrations.schema_migrations where version = '20261028230000'`;
  if (!m146.n) console.log('  (aún no aplicada: nada que comprobar)');
  else {
    const [p] = await sql`select has_table_privilege('anon', 'public.entreno_defecto_quitado', 'select') a_sel, (select relrowsecurity from pg_class where oid = 'public.entreno_defecto_quitado'::regclass) rls,
      has_table_privilege('service_role', 'public.entreno_defecto_quitado', 'select') s_q`;
    ok(!p.a_sel && p.rls && p.s_q, 'entreno_defecto_quitado: RLS activa, anónimo sin permisos; la tarea de avisos (service_role) lee las excepciones');
    const [m2] = await sql`select count(*)::int n from supabase_migrations.schema_migrations where version = '20261028233000'`;
    if (!m2.n) console.log('  (20261028233000 aún no aplicada: la tarea de avisos todavía lee jugadores_privado)');
    else {
      const [s2] = await sql`select (select coalesce(array_agg(privilege_type::text order by privilege_type), '{}') from information_schema.role_table_grants where table_schema = 'public' and table_name = 'jugadores_privado' and grantee = 'service_role') tabla,
        has_function_privilege('service_role', 'public.marcas_disponibilidad()', 'execute') s_fn, has_function_privilege('authenticated', 'public.marcas_disponibilidad()', 'execute') a_fn,
        has_function_privilege('anon', 'public.marcas_disponibilidad()', 'execute') n_fn`;
      ok(s2.tabla.length === 0, 'la tarea de avisos (service_role) NO tiene ningún permiso sobre jugadores_privado', s2.tabla.join(','));
      ok(s2.s_fn && !s2.a_fn && !s2.n_fn, 'y sí ejecuta marcas_disponibilidad(); ni jugadores ni anónimos');
      const den = await (async () => { try { await sql.begin('read only', async (tx) => { await tx.unsafe('set local role service_role'); await tx.unsafe('select nivel from public.jugadores_privado limit 1'); }); return 'leyó'; } catch (e) { return e.message; } })();
      ok(/permission denied/.test(den), 'como service_role, leer jugadores_privado da «permiso denegado»', den);
      const cols = await (async () => { let out = null; try { await sql.begin('read only', async (tx) => { await tx.unsafe('set local role service_role'); out = await tx.unsafe('select * from public.marcas_disponibilidad()'); }); } catch (e) { return e.message; } return out; })();
      ok(Array.isArray(cols) && cols.every((x) => Object.keys(x).sort().join() === 'no_suele_entrenar,nunca_partidos,person_id'), `como service_role, marcas_disponibilidad() da ${Array.isArray(cols) ? cols.length : '?'} filas con solo el jugador y sus dos marcas`, Array.isArray(cols) ? '' : String(cols));
      const rA = await api('/rpc/marcas_disponibilidad', { metodo: 'POST', cuerpo: {} });
      ok(rA.status >= 400, 'anónimo (HTTPS) NO ejecuta marcas_disponibilidad()', String(rA.status));
    }
    const pol = await sql`select policyname, cmd, qual, with_check from pg_policies where schemaname = 'public' and tablename = 'entreno_defecto_quitado'`;
    ok(pol.length === 3 && pol.every((x) => /is_gestor\(\)/.test(`${x.qual ?? ''}${x.with_check ?? ''}`)), 'entreno_defecto_quitado: sus 3 políticas exigen ser gestor', JSON.stringify(pol.map((x) => [x.policyname, x.cmd])));
    const [c146] = await sql`select (select count(*)::int from public.jugadores_privado where no_suele_entrenar) nse, (select count(*)::int from public.jugadores_privado where nunca_partidos) nap, (select count(*)::int from public.entreno_defecto_quitado) q`;
    console.log(`  (en la base: ${c146.nse} con «no suele entrenar», ${c146.nap} «nunca a partidos», ${c146.q} excepciones de entreno)`);
    ok(bloqueado(await api('/jugadores_privado?select=person_id,no_suele_entrenar,nunca_partidos')), 'anónimo (HTTPS) NO lee las marcas');
    ok(bloqueado(await api('/entreno_defecto_quitado?select=*')), 'anónimo (HTTPS) NO lee las excepciones de entreno');
    ok((await api('/entreno_defecto_quitado', { metodo: 'POST', cuerpo: { evento_id: '00000000-0000-0000-0000-000000000000', person_id: 'x' } })).status >= 400, 'anónimo NO escribe excepciones');
    if (jug) {
      await como(jug.id, async (tx) => {
        const m = await intenta(tx, 'select count(*)::int n from public.jugadores_privado where no_suele_entrenar or nunca_partidos');
        ok(!m.ok || m.r[0].n === 0, `el jugador NO lee las marcas (${m.ok ? '0 filas visibles' : 'permiso denegado'})`);
        const q = await intenta(tx, 'select count(*)::int n from public.entreno_defecto_quitado');
        ok(!q.ok || q.r[0].n === 0, `el jugador NO lee las excepciones de entreno (${q.ok ? '0 filas visibles' : 'permiso denegado'})`);
      });
    }
    if (ges) {
      // El recuento esperado, ANTES de la transacción: el cliente tiene una sola conexión y dentro de `como` está ocupada.
      const [{ n: conMarca }] = await sql`select count(*)::int n from public.jugadores_privado where no_suele_entrenar or nunca_partidos`;
      await como(ges.user_id, async (tx) => {
        const m = await intenta(tx, 'select count(*)::int n from public.jugadores_privado where no_suele_entrenar or nunca_partidos');
        ok(m.ok && m.r[0].n === conMarca, `un gestor sí lee las marcas (${m.ok ? m.r[0].n : '?'} de ${conMarca} filas)`);
      });
    }
  }

  console.log('\n== «No vas (puesto por defecto)» del propio jugador (D152, migración 20261031150000)');
  const [m151] = await sql`select count(*)::int n from supabase_migrations.schema_migrations where version = '20261031150000'`;
  if (!m151.n) {
    const [f] = await sql`select to_regprocedure('public.mi_disponibilidad_defecto()') is not null fn`;
    ok(!f.fn, '(aún no aplicada) y la función no existe');
  } else {
    const [f] = await sql`select has_function_privilege('authenticated', 'public.mi_disponibilidad_defecto()', 'execute') a, has_function_privilege('anon', 'public.mi_disponibilidad_defecto()', 'execute') n,
      pg_get_functiondef('public.mi_disponibilidad_defecto()'::regprocedure) def`;
    ok(f.a && !f.n, 'mi_disponibilidad_defecto(): la ejecutan los usuarios con sesión, no anónimo');
    ok(/_mi_person_id\(\)/.test(f.def) && !/nivel|posicion|nota_|nunca_partidos|dobla|por_nombre/.test(f.def), 'solo lee lo de quien consulta: su «no suele entrenar» y sus entrenos quitados (sin niveles, la otra marca ni quién lo quitó)');
    const rA = await api('/rpc/mi_disponibilidad_defecto', { metodo: 'POST', cuerpo: {} });
    ok(rA.status >= 400, 'anónimo (HTTPS) NO la ejecuta', String(rA.status));
    if (jug) {
      // Lo esperado, antes de la transacción (una sola conexión). Nunca se imprime: solo si coincide.
      const [esp] = await sql`select coalesce((select no_suele_entrenar from public.jugadores_privado where person_id = ${jug.person_id}), false) nse,
        (select count(*)::int from public.entreno_defecto_quitado where person_id = ${jug.person_id}) q`;
      await como(jug.id, async (tx) => {
        const r = await intenta(tx, 'select public.mi_disponibilidad_defecto() d');
        const d = r.ok ? r.r[0].d : null;
        ok(!!d && Object.keys(d).sort().join() === 'no_suele_entrenar,quitados', 'un jugador: solo dos campos (su marca y sus quitados)', r.ok ? '' : r.error);
        ok(!!d && d.no_suele_entrenar === esp.nse && d.quitados.length === esp.q, 'y son los suyos (coinciden con la base; no se imprimen)');
      });
    }
    if (ges) {
      await como(ges.user_id, async (tx) => {
        const r = await intenta(tx, 'select public.mi_disponibilidad_defecto() d');
        ok(r.ok && Object.keys(r.r[0].d).sort().join() === 'no_suele_entrenar,quitados', 'un gestor: lo mismo, solo sus dos campos', r.ok ? '' : r.error);
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
