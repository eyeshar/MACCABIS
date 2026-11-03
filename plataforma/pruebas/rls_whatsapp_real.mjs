#!/usr/bin/env node
// D177 y D178 CONTRA EL SUPABASE REAL, en SOLO LECTURA (como pruebas:respuestas-real). No crea ni borra cuentas ni
// escribe nada: anónimo por HTTPS con la clave pública; un jugador y un gestor con cuentas que YA existen, dentro de una
// transacción READ ONLY que adopta su rol y claims. Vale antes y después de aplicar 20261104100000 y 20261104110000.
//   - D177: en el entreno del miércoles 04/11/2026 (o el que se pase con --fecha), el «Quién va» del jugador (v_quien_va)
//     da los mismos números que Gestión (respuestaEfectiva con los datos de la base). Antes de aplicar, no coinciden.
//   - D178: whatsapp_contacto y telefono, solo gestores: ni anónimo ni un jugador los leen; ninguna vista los expone.
// Solo imprime recuentos y motes (nunca teléfonos, contactos, motivos ni marcas).
//
//   npm run pruebas:whatsapp-real [-- --fecha 2026-11-04]

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { conectar } from '../scripts/db.mjs';
import * as D from '../src/lib/disponibilidad/porDefecto.ts';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(RAIZ, '.env.local') });
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const i = process.argv.indexOf('--fecha');
const FECHA = i > 0 ? process.argv[i + 1] : '2026-11-04';
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
  try { const r = await tx.savepoint(async (sp) => sp.unsafe(texto)); return { ok: true, r }; } catch (e) { return { ok: false, error: e.message.replace(/\+?\d{8,}/g, '…') }; }
};
const txt = (c) => `${c.va} van / ${c.duda} duda / ${c.no} no van / ${c.sin} sin responder`;

try {
  const cuentas0 = (await sql`select count(*)::int n from auth.users`)[0].n;
  const reg = async (v) => (await sql`select count(*)::int n from supabase_migrations.schema_migrations where version = ${v}`)[0].n === 1;
  const d177 = await reg('20261104100000'), d178 = await reg('20261104110000');
  console.log(`\n(20261104100000 ${d177 ? 'aplicada' : 'SIN aplicar'} · 20261104110000 ${d178 ? 'aplicada' : 'SIN aplicar'})`);

  console.log('\n== D177: _estado_efectivo, interna');
  const [f] = await sql`select to_regprocedure('public._estado_efectivo(uuid, text, text)') is not null fn`;
  if (!d177) ok(!f.fn, 'sin aplicar: la función no existe');
  else {
    const [p] = await sql`select has_function_privilege('anon', 'public._estado_efectivo(uuid, text, text)', 'execute') a,
      has_function_privilege('authenticated', 'public._estado_efectivo(uuid, text, text)', 'execute') u,
      pg_get_functiondef('public._quien_va()'::regprocedure) ~ '_estado_efectivo' usa`;
    ok(f.fn && !p.a && !p.u && p.usa, 'existe, nadie la ejecuta por la API y _quien_va la usa', JSON.stringify(p));
  }

  console.log(`\n== D177: entreno del ${FECHA}, jugador frente a Gestión`);
  const [ev] = await sql`select id, tipo, fecha::text fecha, oficial from public.eventos where fecha = ${FECHA} and tipo = 'entreno' and estado = 'programado' and borrado_en is null limit 1`;
  const [jug] = await sql`select u.id, j.person_id from public.jugadores j join auth.users u on lower(u.email) = lower(j.email)
                          where j.activo and not exists (select 1 from public.gestores g where g.user_id = u.id)
                            and public._invitado(j.person_id, ${ev?.id ?? null}::uuid) order by j.person_id limit 1`;
  if (!ev || !jug) ok(false, 'hay un entreno ese día y un jugador invitado con cuenta');
  else {
    // Gestión: la regla de la web (respuestaEfectiva) con los datos de la base (lo que lee la pantalla de un gestor).
    const filas = await sql`
      select j.person_id, j.nombre_visible, coalesce(r.respuesta, 'sin_responder') respuesta,
             coalesce(p.no_suele_entrenar, false) nse, coalesce(p.nunca_partidos, false) nap,
             exists (select 1 from public.entreno_defecto_quitado q where q.evento_id = ${ev.id} and q.person_id = j.person_id) quitado,
             public._ausencia_que_cubre(j.person_id, ${ev.fecha}::date) is not null ausencia
      from public.jugadores j
      left join public.respuestas r on r.evento_id = ${ev.id} and r.person_id = j.person_id
      left join public.jugadores_privado p on p.person_id = j.person_id
      where public._invitado(j.person_id, ${ev.id})`;
    const gestion = { va: 0, duda: 0, no: 0, sin: 0 }, sinResp = [];
    for (const x of filas) {
      const e = D.respuestaEfectiva(ev, { no_suele_entrenar: x.nse, nunca_partidos: x.nap }, x.respuesta, { quitado: x.quitado, ausencia: x.ausencia ? { person_id: x.person_id, desde: ev.fecha, hasta: ev.fecha } : null });
      if (e.fuera) continue;
      const k = e.respuesta === 'sin_responder' ? 'sin' : e.respuesta;
      gestion[k]++;
      if (k === 'sin') sinResp.push(x.nombre_visible);
    }
    let jugador = null;
    await como(jug.id, async (tx) => {
      const r = await intenta(tx, `select estado from public.v_quien_va where evento_id = '${ev.id}'`);
      if (r.ok) jugador = { va: 0, duda: 0, no: 0, sin: 0 }, r.r.forEach((y) => { jugador[y.estado === 'sin_responder' ? 'sin' : y.estado]++; });
    });
    console.log(`  Gestión:  ${txt(gestion)}`);
    console.log(`  Jugador:  ${jugador ? txt(jugador) : '(no pudo leer v_quien_va)'}`);
    console.log(`  Sin responder: ${sinResp.sort((a, b) => a.localeCompare(b, 'es')).join(', ') || 'nadie'}`);
    if (d177) ok(jugador && JSON.stringify(jugador) === JSON.stringify(gestion), 'las dos pantallas dan los mismos números');
    else console.log(`  (sin aplicar: ${jugador && JSON.stringify(jugador) === JSON.stringify(gestion) ? 'coinciden' : 'NO coinciden, como se esperaba antes de la migración'})`);
  }

  console.log('\n== D178: whatsapp_contacto y telefono, solo gestores');
  const [col] = await sql`select count(*)::int n from information_schema.columns where table_schema = 'public' and table_name = 'jugadores' and column_name = 'whatsapp_contacto'`;
  ok(d178 ? col.n === 1 : col.n === 0, d178 ? 'la columna whatsapp_contacto existe' : 'sin aplicar: la columna aún no existe');
  const cols = d178 ? 'whatsapp_contacto,telefono' : 'telefono';
  ok(bloqueado(await api(`/jugadores?select=${cols}`)), `anónimo (HTTPS) NO lee ${cols}`);
  const [pol] = await sql`select relrowsecurity rls, (select string_agg(policyname || ':' || coalesce(qual, '') , ' ') from pg_policies where schemaname = 'public' and tablename = 'jugadores') pols from pg_class where oid = 'public.jugadores'::regclass`;
  ok(pol.rls && /is_gestor\(\)/.test(pol.pols) && !/true/.test(pol.pols), 'jugadores: RLS activa y todas sus políticas piden is_gestor()', pol.pols);
  const vistas = await sql`select view_name from information_schema.view_column_usage where table_schema = 'public' and table_name = 'jugadores' and column_name in ('telefono', 'whatsapp_contacto')`;
  ok(vistas.length === 0, 'ninguna vista expone telefono ni whatsapp_contacto', vistas.map((v) => v.view_name).join());
  if (jug) await como(jug.id, async (tx) => {
    const r = await intenta(tx, `select ${cols} from public.jugadores`);
    ok(r.ok ? r.r.length === 0 : /permission denied/.test(r.error), `un jugador real NO lee ${cols} (ni el suyo): ${r.ok ? r.r.length + ' filas' : 'permiso denegado'}`);
  });
  const [ges] = await sql`select user_id from public.gestores where user_id is not null limit 1`;
  if (ges) await como(ges.user_id, async (tx) => {
    const r = await intenta(tx, `select count(*)::int n, ${d178 ? 'count(whatsapp_contacto)::int c,' : ''} count(nullif(btrim(telefono), ''))::int t from public.jugadores where activo`);
    ok(r.ok && r.r[0].n > 0, `un gestor sí: ${r.ok ? `${r.r[0].n} activos, ${d178 ? `${r.r[0].c} con contacto, ` : ''}${r.r[0].t} con teléfono` : r.error}`);
  });
  if (d178) {
    const sinC = await sql`select nombre_visible from public.jugadores where activo and whatsapp_contacto is null order by 1`;
    console.log(`  Sin contacto de WhatsApp: ${sinC.map((x) => x.nombre_visible).join(', ') || 'nadie'}`);
  }

  const cuentas1 = (await sql`select count(*)::int n from auth.users`)[0].n;
  ok(cuentas0 === cuentas1, `no se ha creado ni borrado ninguna cuenta (${cuentas0} antes y después)`);
} finally {
  await sql.end();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
