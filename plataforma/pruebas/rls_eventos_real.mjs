#!/usr/bin/env node
// RLS de eventos, pistas, respuestas, ausencias, diccionario, importaciones y resumen de asistencia CONTRA EL SUPABASE
// REAL, en SOLO LECTURA (D94, mitigacion 5). No crea ni borra cuentas ni escribe nada:
//   - anonimo: por HTTPS con la clave publica, como cualquiera en internet;
//   - jugador y gestor: con las cuentas que YA existen, dentro de una transaccion READ ONLY que adopta el rol
//     `authenticated` y los claims de esa cuenta (lo mismo que hace PostgREST), y se deshace al final.
// Para comprobar la ESCRITURA sin escribir, se intenta cada insert/update/delete dentro de la transaccion de solo
// lectura: Postgres lo rechaza siempre; ademas se comprueban los permisos (has_table_privilege) y las politicas.
//
//   npm run pruebas:eventos-real

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
const PRIVADAS = ['eventos', 'pistas', 'descansos', 'respuestas', 'ausencias_periodo', 'diccionario_sporteasy', 'importaciones', 'asistencia_resumen'];
const COLUMNAS_PRIVADAS = ['id', 'origen', 'serie', 'sporteasy_estado', 'sporteasy_cambio', 'sporteasy_copiado_en', 'creado_en', 'actualizado_en', 'pista_id', 'person_id', 'respuesta', 'motivo', 'detalle'];

async function api(ruta, { metodo = 'GET', cuerpo } = {}) {
  const r = await fetch(`${URL}/rest/v1${ruta}`, { method: metodo, headers: { apikey: ANON, authorization: `Bearer ${ANON}`, 'content-type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  let datos = null; try { datos = await r.json(); } catch {}
  return { status: r.status, datos };
}
const bloqueado = (r) => r.status === 401 || r.status === 403 || r.status === 404 || (Array.isArray(r.datos) && r.datos.length === 0);

/** Ejecuta `fn(tx)` como `authenticated` con los claims de una cuenta, en una transaccion de SOLO LECTURA que se deshace. */
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
  try { await tx.savepoint(async (sp) => { await sp.unsafe(texto); }); return 'permitido'; } catch (e) { return `rechazado: ${e.message}`; }
};

try {
  console.log('\n== Anónimo (HTTPS, clave pública)');
  for (const t of PRIVADAS) ok(bloqueado(await api(`/${t}?select=*`)), `anónimo NO lee ${t}`);
  for (const t of PRIVADAS) ok((await api(`/${t}`, { metodo: 'POST', cuerpo: {} })).status >= 400, `anónimo NO escribe en ${t}`);
  const pub = await api('/v_eventos_publicos?select=*&limit=1000');
  ok(pub.status === 200 && pub.datos.length === 67, 'anónimo lee la vista pública: 67 eventos', `${pub.status} ${pub.datos?.length}`);
  const cols = Object.keys(pub.datos?.[0] ?? {});
  ok(cols.length > 0 && !cols.some((c) => COLUMNAS_PRIVADAS.includes(c)), `la vista pública no trae columnas privadas (${cols.join(', ')})`);
  ok(!JSON.stringify(pub.datos.map((f) => Object.values(f))).match(/@|sporteasy|motivo|lesi/i), 'ningún valor de la vista pública es un correo, ni habla de SportEasy, motivos o lesiones');
  const dp = await api('/v_descansos_publicos?select=*');
  ok(dp.status === 200 && dp.datos.length === 4, 'anónimo lee los 4 descansos');
  ok((await api('/v_eventos_publicos', { metodo: 'POST', cuerpo: {} })).status >= 400, 'la vista pública no admite escritura');
  const ph = await api('/v_pista_habitual_publica?select=*');
  ok(ph.status === 200 && ph.datos.length === 1 && Object.keys(ph.datos[0]).sort().join() === 'estado,nombre,nombre_corto', 'anónimo lee la pista habitual (solo nombre y estado, sin dirección)', JSON.stringify(ph.datos));

  console.log('\n== Permisos y políticas en la base real');
  for (const t of PRIVADAS) {
    const [p] = await sql`select has_table_privilege('anon', ${'public.' + t}, 'select') a_sel, has_table_privilege('anon', ${'public.' + t}, 'insert') a_ins,
                                 has_table_privilege('authenticated', ${'public.' + t}, 'delete') u_del, has_table_privilege('authenticated', ${'public.' + t}, 'truncate') u_trunc,
                                 (select relrowsecurity from pg_class where oid = ${'public.' + t}::regclass) rls`;
    ok(!p.a_sel && !p.a_ins && !p.u_del && !p.u_trunc && p.rls, `${t}: RLS activa; anon sin permisos; authenticated sin DELETE ni TRUNCATE`);
  }
  const pol = await sql`select tablename, cmd, qual, with_check from pg_policies where schemaname = 'public' and tablename = any(${PRIVADAS})`;
  ok(pol.every((p) => /is_gestor\(\)/.test(`${p.qual ?? ''}${p.with_check ?? ''}`)), `las ${pol.length} políticas de las 8 tablas exigen is_gestor()`);
  ok(!pol.some((p) => p.cmd === 'DELETE' || p.cmd === 'ALL'), 'ninguna política permite DELETE ni ALL');
  const [v] = await sql`select has_table_privilege('anon', 'public.v_eventos_publicos', 'select') a, has_table_privilege('anon', 'public.v_eventos_publicos', 'insert') i`;
  ok(v.a && !v.i, 'anon puede leer la vista pública y no escribirla');

  console.log('\n== Gestor (cuenta real existente, transacción de solo lectura)');
  const [gestor] = await sql`select user_id from public.gestores where user_id is not null limit 1`;
  ok(!!gestor, 'hay al menos un gestor con cuenta');
  await como(gestor.user_id, async (tx) => {
    ok((await tx`select public.is_gestor() g`)[0].g === true, 'is_gestor() = true');
    for (const t of PRIVADAS) {
      const [{ n }] = await tx.unsafe(`select count(*)::int n from public.${t}`);
      ok(n >= 0, `el gestor lee ${t} (${n} filas)`);
    }
    ok((await tx`select count(*)::int n from public.eventos`)[0].n === 67, 'el gestor ve los 67 eventos');
    ok((await tx`select count(*)::int n from public.asistencia_resumen`)[0].n === (await tx`select count(*)::int n from public.asistencia_motivos`)[0].n, 'y el resumen de asistencia = asistencia_motivos');
    ok((await intenta(tx, `delete from public.eventos`)).startsWith('rechazado'), 'el gestor NO puede borrar eventos');
    ok((await intenta(tx, `delete from public.diccionario_sporteasy`)).startsWith('rechazado'), 'el gestor NO puede borrar el diccionario');
    ok((await intenta(tx, `update public.asistencia_resumen set fueron = 0`)).startsWith('rechazado'), 'el gestor NO puede cambiar el resumen de asistencia');
  });

  console.log('\n== Jugador y no gestor (cuentas reales existentes, transacción de solo lectura)');
  const jugadores = await sql`select u.id from auth.users u join public.jugadores j on lower(j.email) = lower(u.email) where j.activo
    and not exists (select 1 from public.gestores g where g.user_id = u.id) limit 2`;
  ok(jugadores.length > 0, `hay ${jugadores.length} jugador(es) sin rol de gestor con cuenta para probar`);
  for (const j of jugadores) {
    await como(j.id, async (tx) => {
      ok((await tx`select public.is_gestor() g`)[0].g === false, 'is_gestor() = false');
      for (const t of PRIVADAS) ok((await tx.unsafe(`select count(*)::int n from public.${t}`))[0].n === 0, `el jugador ve 0 filas de ${t}`);
      ok((await tx`select count(*)::int n from public.v_eventos_publicos`)[0].n === 67, 'sí ve la vista pública (67)');
      ok((await intenta(tx, `insert into public.eventos (clave, tipo, equipo, fecha) values ('x', 'amistoso', 'MdA', '2026-11-01')`)).startsWith('rechazado'), 'el jugador NO puede crear eventos');
      ok((await intenta(tx, `insert into public.respuestas (evento_id, person_id, respuesta) select id, 'x', 'va' from public.eventos limit 1`)).startsWith('rechazado'), 'el jugador NO puede escribir respuestas');
    });
  }
  console.log('\n== Sin efectos');
  const [{ n }] = await sql`select count(*)::int n from public.eventos`;
  const [{ u }] = await sql`select count(*)::int u from auth.users`;
  ok(n === 67, 'siguen 67 eventos (nada escrito ni borrado)');
  console.log(`  (${u} cuentas de auth; esta prueba no crea ni borra ninguna)`);
} finally {
  await sql.end();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
