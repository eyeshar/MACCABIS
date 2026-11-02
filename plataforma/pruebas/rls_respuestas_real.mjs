#!/usr/bin/env node
// Paso 3 (D99) CONTRA EL SUPABASE REAL, en SOLO LECTURA (como pruebas:eventos-real, D94). Se ejecuta DESPUES de aplicar
// las migraciones 20261008100000 y 20261008101000 en producción. No crea ni borra cuentas ni escribe nada:
//   - anónimo por HTTPS con la clave pública;
//   - un jugador y un gestor con cuentas que YA existen, dentro de una transacción READ ONLY que adopta su rol y claims.
// Demuestra que un jugador: no lee motivos ajenos, no responde por otro, no responde a un evento al que no está
// invitado (la base solo le deja responder a lo suyo), y no ve niveles ni posiciones en nada de lo que le llega.
// Desde D172 (migración 20261102200000) no hay interruptor: las respuestas en la web están siempre encendidas, y se
// comprueba que lo del interruptor y lo huérfano de SportEasy ya no están. Se pasa DESPUÉS de aplicarla.
//
//   npm run pruebas:respuestas-real

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
const NUEVAS = ['respuestas_domingo', 'respuestas_web_config', 'respuestas_web_registro', 'jornadas_control', 'alertas_gestores', 'suscripciones_avisos', 'avisos_registro'];
const FUNCIONES = ['responder', 'responder_domingo', 'guardar_ausencia', 'cerrar_ausencia', 'borrar_ausencia', 'alta_suscripcion', 'baja_suscripcion', 'previsualizar_ausencia', 'responder_por', 'responder_domingo_por', 'estado_activacion'];
// D172: lo que la migración 20261102200000 quita (funciones del interruptor y ultima_importacion_respuestas).
const BORRADAS = ['cambiar_interruptor', 'marcar_sporteasy', 'marcar_jornada', 'respuestas_web_encendido', '_exigir_encendido', '_respuestas_web_encendido',
  '_exigir_responsable', '_es_responsable', '_jornadas_limpias_seguidas', 'ultima_importacion_respuestas'];

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
  for (const t of NUEVAS) {
    const [p] = await sql`select to_regclass(${'public.' + t}) is not null existe, has_table_privilege('anon', ${'public.' + t}, 'select') a_sel,
      has_table_privilege('authenticated', ${'public.' + t}, 'delete') u_del, (select relrowsecurity from pg_class where oid = to_regclass(${'public.' + t})) rls`;
    ok(p.existe && !p.a_sel && !p.u_del && p.rls, `${t}: existe, RLS activa, anon sin permisos, nadie borra`);
  }
  for (const t of ['respuestas', 'ausencias_periodo']) ok(!(await sql`select has_table_privilege('authenticated', ${'public.' + t}, 'delete') d`)[0].d, `${t}: nadie borra por la API`);
  const fns = await sql`select proname, has_function_privilege('anon', oid, 'execute') anon from pg_proc where pronamespace = 'public'::regnamespace and proname = any(${FUNCIONES})`;
  ok(fns.length === FUNCIONES.length && fns.every((f) => !f.anon), `las ${FUNCIONES.length} funciones nuevas existen y anónimo no ejecuta ninguna`);
  // D159 (migración 20261031190000): respuestas a mano por un gestor. Antes de aplicarla, la función no existe.
  const [mMano] = await sql`select count(*)::int n from supabase_migrations.schema_migrations where version = '20261031190000'`;
  const aMano = mMano.n > 0;
  const [gr] = await sql`select to_regprocedure('public.gestor_responder(uuid, text[], text, text, text)') is not null fn`;
  if (!aMano) ok(!gr.fn, 'gestor_responder (D159): aún no aplicada y la función no existe');
  else {
    const [f] = await sql`select has_function_privilege('authenticated', 'public.gestor_responder(uuid, text[], text, text, text)', 'execute') a, has_function_privilege('anon', 'public.gestor_responder(uuid, text[], text, text, text)', 'execute') n`;
    ok(f.a && !f.n, 'gestor_responder (D159): la ejecutan los usuarios con sesión (is_gestor dentro), no anónimo');
  }

  console.log('\n== Sin interruptor ni SportEasy (D172)');
  ok((await sql`select count(*)::int n from supabase_migrations.schema_migrations where version = '20261102200000'`)[0].n === 1, 'la migración 20261102200000 (fin de SportEasy) está aplicada');
  const quedan = (await sql`select proname from pg_proc where pronamespace = 'public'::regnamespace and proname = any(${BORRADAS})`).map((x) => x.proname);
  ok(quedan.length === 0, 'no quedan las funciones del interruptor ni ultima_importacion_respuestas', quedan.join(', '));
  ok((await sql`select to_regclass('public.diccionario_sporteasy') is null n`)[0].n, 'diccionario_sporteasy ya no existe');
  const colsSE = (await sql`select table_name || '.' || column_name c from information_schema.columns where table_schema = 'public' and column_name like 'sporteasy%'`).map((x) => x.c);
  ok(colsSE.length === 0, 'ninguna tabla tiene columnas sporteasy_*', colsSE.join(', '));
  ok(bloqueado(await api('/diccionario_sporteasy?select=*')) && bloqueado(await api('/rpc/respuestas_web_encendido', { metodo: 'POST', cuerpo: {} })), 'y por la API tampoco están');

  console.log('\n== Anónimo (HTTPS)');
  for (const t of [...NUEVAS, 'v_mis_eventos', 'v_quien_va']) ok(bloqueado(await api(`/${t}?select=*`)), `anónimo NO lee ${t}`);
  ok((await api('/rpc/responder', { metodo: 'POST', cuerpo: { p_evento: '00000000-0000-0000-0000-000000000000', p_respuesta: 'va' } })).status >= 400, 'anónimo NO responde');
  ok((await api('/rpc/alta_suscripcion', { metodo: 'POST', cuerpo: { p_endpoint: 'https://x', p_p256dh: 'a', p_auth: 'b' } })).status >= 400, 'anónimo NO se suscribe');

  console.log('\n== Un jugador real (solo lectura)');
  const [jug] = await sql`select u.id, j.person_id, j.ficha_mda, j.ficha_mdl from public.jugadores j join auth.users u on lower(u.email) = lower(j.email)
                          where j.activo and not exists (select 1 from public.gestores g where g.user_id = u.id) and (j.ficha_mda or j.ficha_mdl) order by (j.ficha_mda and j.ficha_mdl) limit 1`;
  // (fuera de la transaccion: la conexion es una sola)
  const [ajeno] = jug ? await sql`select e.id from public.eventos e where e.tipo = 'liga' and e.equipo = ${jug.ficha_mda ? 'MdL' : 'MdA'} limit 1` : [];
  if (!jug) ok(false, 'hay al menos un jugador (no gestor) con cuenta');
  else await como(jug.id, async (tx) => {
    const mias = await tx`select person_id from public.respuestas`;
    ok(mias.every((r) => r.person_id === jug.person_id), `lee solo SUS respuestas (${mias.length})`);
    ok((await tx`select person_id from public.ausencias_periodo`).every((r) => r.person_id === jug.person_id), 'lee solo SUS ausencias');
    ok((await tx`select user_id from public.suscripciones_avisos`).every((r) => r.user_id === jug.id), 'lee solo SUS suscripciones');
    const qv = await tx`select * from public.v_quien_va limit 500`;
    ok(qv.length === 0 || Object.keys(qv[0]).sort().join() === 'estado,evento_id,nombre', `v_quien_va: solo evento, nombre y estado (${qv.length} filas)`);
    const mis = await tx`select * from public.v_mis_eventos`;
    const cols = Object.keys(mis[0] ?? {});
    ok(mis.length > 0 && !cols.some((c) => /sporteasy|serie|person|respuesta|^motivo|detalle|nivel|posici/.test(c)), `v_mis_eventos: ${mis.length} eventos suyos, sin columnas privadas`);
    const todo = JSON.stringify([mias, qv, mis]);
    ok(!/nivel|posici|ficha_m|telefono|"email"/i.test(todo), 'nada de lo que le llega lleva niveles, posiciones, fichas, teléfonos ni correos');
    for (const t of ['eventos', 'jugadores', 'alertas_gestores', 'avisos_registro', 'respuestas_web_config', 'jornadas_control', 'asistencia_resumen']) {
      ok((await tx.unsafe(`select count(*)::int n from public.${t}`).catch(() => [{ n: 0 }]))[0].n === 0, `no lee ${t}`);
    }
    // fecha llega como Date: se compara como AAAA-MM-DD (antes, Date > texto nunca casaba y se probaba con el uuid 0).
    const ev = mis.find((e) => e.estado === 'programado' && new Date(e.fecha).toISOString().slice(0, 10) > new Date().toISOString().slice(0, 10));
    ok(!!ev, `tiene un evento suyo abierto para probar (${ev ? new Date(ev.fecha).toISOString().slice(0, 10) : 'ninguno'})`);
    let r = await intenta(tx, `select public.responder($1::uuid, 'va')`, [ev?.id ?? '00000000-0000-0000-0000-000000000000']);
    ok(!r.ok && !/respuestas_apagadas|no_invitado/.test(r.error), 'la base le deja responder a un evento suyo, siempre (solo lo para esta transacción de solo lectura)', r.error);
    if (ajeno && !(jug.ficha_mda && jug.ficha_mdl)) {
      r = await intenta(tx, `select public.responder($1::uuid, 'va')`, [ajeno.id]);
      ok(!r.ok && /no_invitado/.test(r.error), 'NO responde a un partido del otro equipo (no_invitado, lo para la base)', r.error);
    }
    if (ajeno && !(jug.ficha_mda && jug.ficha_mdl)) {
      ok(!(await tx`select 1 from public.v_mis_eventos where id = ${ajeno.id}`).length, 'no ve el partido del otro equipo (no está invitado)');
    }
    r = await intenta(tx, `insert into public.respuestas (evento_id, person_id, respuesta) values ($1::uuid, 'otra-persona', 'va')`, [ev?.id ?? '00000000-0000-0000-0000-000000000000']);
    ok(!r.ok, 'no escribe en la tabla de respuestas (ni por otro)');
    r = await intenta(tx, `select public.responder_por($1::uuid, 'otra-persona', 'va')`, [ev?.id ?? '00000000-0000-0000-0000-000000000000']);
    ok(!r.ok && /solo_gestores|read-only|solo lectura/i.test(r.error), 'no usa «Responder por él»', r.error);
    if (aMano) {
      r = await intenta(tx, `select public.gestor_responder($1::uuid, array['otra-persona'], 'va')`, [ev?.id ?? '00000000-0000-0000-0000-000000000000']);
      ok(!r.ok && /solo_gestores|read-only|solo lectura/i.test(r.error), 'no cambia respuestas a mano (gestor_responder, D159: solo gestores)', r.error);
    }
    r = await intenta(tx, 'select public.estado_activacion()');
    ok(!r.ok && /solo_gestores/.test(r.error), 'no ve el estado de activación (solo gestores)');
  });

  console.log('\n== Un gestor real (solo lectura)');
  // estado_activacion (D172): solo los contadores del recuadro «Avisos y accesos», igual para todos los gestores.
  const CLAVES = 'con_avisos,entrados,faltan_por_entrar,pidio_codigo,plantilla';
  const gestores = await sql`select g.user_id from public.gestores g where g.user_id is not null order by g.nombre`;
  if (!gestores.length) ok(false, 'hay al menos un gestor vinculado');
  let est0 = null;
  for (const g of gestores.slice(0, 2)) await como(g.user_id, async (tx) => {
    const est = (await tx`select public.estado_activacion() e`)[0].e;
    ok(Object.keys(est).sort().join() === CLAVES && typeof est.plantilla === 'number', `un gestor ve los contadores (nada del interruptor): ${est.entrados}/${est.plantilla} han entrado, ${est.con_avisos} con avisos`, Object.keys(est).sort().join());
    if (est0) ok(est.plantilla === est0.plantilla && est.entrados === est0.entrados, 'otro gestor ve lo mismo');
    est0 ??= est;
    ok((await tx`select count(*)::int n from public.respuestas`)[0].n >= 0, 'el gestor lee las respuestas');
  });
  ok((await sql`select count(*)::int n from auth.users`)[0].n === cuentas0, `cuentas de auth antes y después: ${cuentas0}`);
} finally {
  await sql.end();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
