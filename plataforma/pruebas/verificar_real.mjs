#!/usr/bin/env node
// Verificacion de seguridad CONTRA EL PROYECTO REAL de Supabase (lee .env.local).
// Las comprobaciones de acceso van por HTTPS con la clave publica, como cualquiera en internet.
// Crea datos temporales (2 usuarios de prueba, 1 campana "PRUEBA", sus pedidos y un enlace
// anulado de prueba) y los BORRA al final, pase lo que pase. No imprime claves ni enlaces.
//
//   node pruebas/verificar_real.mjs

import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { conectar } from '../scripts/db.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(RAIZ, '.env.local') });
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sql = conectar();

let fallos = 0;
const ok = (c, que, det = '') => { if (c) console.log(`  OK    ${que}`); else { fallos++; console.log(`  FALLO ${que}${det ? ` -> ${det}` : ''}`); } };
const seccion = (t) => console.log(`\n== ${t}`);

async function api(ruta, { metodo = 'GET', cuerpo, token } = {}) {
  const r = await fetch(`${URL}/rest/v1${ruta}`, {
    method: metodo,
    headers: { apikey: ANON, authorization: `Bearer ${token ?? ANON}`, 'content-type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  let datos = null;
  try { datos = await r.json(); } catch {}
  return { status: r.status, datos };
}
const rpc = (f, a, token) => api(`/rpc/${f}`, { metodo: 'POST', cuerpo: a, token });

// Usuario temporal de Supabase Auth creado por SQL (el registro libre esta desactivado).
async function usuarioTemporal(email, clave) {
  const [u] = await sql`
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', ${email},
            extensions.crypt(${clave}, extensions.gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
    returning id`;
  await sql`insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
            values (gen_random_uuid(), ${u.id}, ${u.id}, ${sql.json({ sub: u.id, email, email_verified: true })}, 'email', now(), now(), now())`;
  return u.id;
}

const sufijo = crypto.randomBytes(4).toString('hex');
const temporales = { usuarios: [], campana: null, enlace: null };
let usosPrevios = [];

try {
  const [{ n: nUsuariosAntes }] = await sql`select count(*)::int n from auth.users`;

  seccion('Estructura en el proyecto real');
  const sinRls = await sql`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity`;
  ok(sinRls.length === 0, 'todas las tablas de public tienen RLS activada', sinRls.map((x) => x.relname).join(', '));
  await sql`create table public.prueba_rls_automatica (id int)`;
  const [nueva] = await sql`select relrowsecurity from pg_class where oid = 'public.prueba_rls_automatica'::regclass`;
  await sql`drop table public.prueba_rls_automatica`;
  ok(nueva?.relrowsecurity === true, 'RLS automatica: una tabla de prueba nace con RLS (creada y borrada)');
  const [{ existe }] = await sql`select exists (select 1 from pg_class where relname = 'prueba_rls_automatica') as existe`;
  ok(!existe, 'la tabla de prueba ya no existe');
  const anonTablas = await sql`select table_name, privilege_type from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public'`;
  ok(anonTablas.length === 0, 'anon no tiene NINGUN permiso sobre tablas o vistas de public', anonTablas.map((x) => `${x.table_name}:${x.privilege_type}`).join(', '));
  const anonFunciones = (await sql`
    select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE') order by 1`).map((x) => x.proname);
  ok(JSON.stringify(anonFunciones) === JSON.stringify(['anular_pedido', 'dorsal_cogido', 'guardar_pedido', 'zona_jugador']),
    'anon solo puede ejecutar las 4 funciones que exigen enlace', anonFunciones.join(', '));

  seccion('Anonimo sin enlace (HTTPS, clave publica)');
  for (const t of ['jugadores', 'enlaces', 'gestores', 'campanas_ropa', 'pedidos_ropa', 'v_dorsales_repetidos']) {
    const r = await api(`/${t}?select=*`);
    ok(r.status === 401 || r.status === 403 || r.status === 404 || (Array.isArray(r.datos) && r.datos.length === 0), `no lee ${t}`, `HTTP ${r.status}`);
  }
  let r = await api('/pedidos_ropa', { metodo: 'POST', cuerpo: { nombre_completo: 'x' } });
  ok(r.status >= 400, 'no puede escribir en las tablas', `HTTP ${r.status}`);
  for (const f of ['regenerar_enlace', 'anular_enlace', '_jugador_de_token', 'nuevo_token', 'is_gestor']) {
    r = await rpc(f, f.includes('enlace') ? { p_jugador: crypto.randomUUID() } : f === '_jugador_de_token' ? { p_token: 'x' } : {});
    ok(r.status >= 400, `no puede ejecutar ${f}()`, `HTTP ${r.status}`);
  }
  r = await rpc('zona_jugador', { p_token: crypto.randomBytes(32).toString('hex') });
  ok(r.status === 200 && r.datos === null, 'enlace inventado: no devuelve nada');

  seccion('Tu usuario de gestor (Iván), evaluado por la base de datos real');
  const [ivan] = await sql`select g.user_id, u.email_confirmed_at is not null as confirmado from public.gestores g join auth.users u on u.id = g.user_id where g.nombre = 'Iván'`;
  ok(ivan?.confirmado, 'Iván esta en gestores y su usuario esta confirmado');
  const comoUsuario = (uid) => sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: uid, role: 'authenticated' })}, true)`;
    await tx`set local role authenticated`;
    const [{ g }] = await tx`select public.is_gestor() as g`;
    const [{ n }] = await tx`select count(*)::int n from public.jugadores`;
    const [{ e }] = await tx`select count(*)::int e from public.enlaces`;
    return { g, n, e };
  });
  const vi = await comoUsuario(ivan.user_id);
  ok(vi.g === true && vi.n === 25 && vi.e >= 25, 'con la identidad de Iván: es gestor y ve los 25 jugadores y sus enlaces', JSON.stringify(vi));
  const vx = await comoUsuario(crypto.randomUUID());
  ok(vx.g === false && vx.n === 0 && vx.e === 0, 'con otra identidad cualquiera: no es gestor y no ve nada', JSON.stringify(vx));

  seccion('Login real de Supabase Auth (usuarios temporales)');
  const claveG = crypto.randomBytes(18).toString('base64url');
  const claveN = crypto.randomBytes(18).toString('base64url');
  const emailG = `prueba-gestor-${sufijo}@maccabis.invalid`;
  const emailN = `prueba-nogestor-${sufijo}@maccabis.invalid`;
  const idG = await usuarioTemporal(emailG, claveG); temporales.usuarios.push(idG);
  const idN = await usuarioTemporal(emailN, claveN); temporales.usuarios.push(idN);
  await sql`insert into public.gestores (user_id, nombre) values (${idG}, 'PRUEBA temporal')`;
  const cliente = () => createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const cg = cliente();
  const lg = await cg.auth.signInWithPassword({ email: emailG, password: claveG });
  ok(!lg.error && lg.data.session, 'un gestor entra con correo y contraseña', lg.error?.message);
  const malo = await cliente().auth.signInWithPassword({ email: emailG, password: 'contraseña-mala' });
  ok(!!malo.error, 'con contraseña equivocada no entra');
  const jg = await cg.from('jugadores').select('id');
  ok(jg.data?.length === 25, 'el gestor, con su sesion real, ve los 25 jugadores', jg.error?.message ?? `${jg.data?.length}`);
  const cn = cliente();
  const ln = await cn.auth.signInWithPassword({ email: emailN, password: claveN });
  ok(!ln.error, 'un usuario que NO es gestor tambien puede iniciar sesion...', ln.error?.message);
  const jn = await cn.from('jugadores').select('id');
  const en = await cn.from('enlaces').select('token');
  ok((jn.data?.length ?? 0) === 0 && (en.data?.length ?? 0) === 0, '...pero no ve ni jugadores ni enlaces');
  const rn = await cn.rpc('regenerar_enlace', { p_jugador: crypto.randomUUID() });
  ok(!!rn.error, '...ni puede regenerar enlaces');

  seccion('Un jugador solo ve y toca lo suyo (HTTPS, con enlaces reales)');
  const enlace = async (pid) => (await sql`select e.id, e.token, e.ultimo_uso, j.id as jugador from public.enlaces e join public.jugadores j on j.id = e.jugador_id where j.person_id = ${pid} and e.anulado_en is null`)[0];
  const A = await enlace('calahorro-sanchez-manuel');
  const B = await enlace('jorba-lopez-sergi');
  usosPrevios = [A, B];
  const [cam] = await sql`insert into public.campanas_ropa (nombre, estado) values (${'PRUEBA temporal ' + sufijo}, 'abierta') returning id`;
  temporales.campana = cam.id;
  const pedido = (extra) => ({ campana_id: cam.id, para: 'yo', nombre_completo: 'Prueba Temporal', nombre_ropa: 'PRUEBA', dorsal: 7, tallas: { camiseta: 'M' }, ...extra });
  r = await rpc('guardar_pedido', { p_token: A.token, p_pedido: pedido() });
  ok(r.datos?.ok === true, 'A hace un pedido valido', JSON.stringify(r.datos));
  const idA = r.datos?.id;
  const zA = (await rpc('zona_jugador', { p_token: A.token })).datos;
  const zB = (await rpc('zona_jugador', { p_token: B.token })).datos;
  ok(zA?.jugador?.nombre_visible === 'Manu' && zA.pedidos.some((p) => p.id === idA), 'la zona de A trae su nombre y su pedido');
  ok(zB?.jugador?.nombre_visible === 'Sergi' && !zB.pedidos.some((p) => p.id === idA), 'la zona de B NO trae el pedido de A');
  ok(zA && !('telefono' in zA.jugador) && !('rol' in zA.jugador) && !('entrena' in zA.jugador), 'la zona no devuelve telefono, rol ni "entrena"');
  r = await rpc('guardar_pedido', { p_token: B.token, p_pedido: pedido({ id: idA, nombre_ropa: 'PIRATA' }) });
  ok(r.datos?.error === 'no_encontrado', 'B no puede modificar el pedido de A', JSON.stringify(r.datos));
  r = await rpc('anular_pedido', { p_token: B.token, p_pedido: idA });
  ok(r.datos?.error === 'no_encontrado', 'B no puede anular el pedido de A', JSON.stringify(r.datos));
  r = await rpc('guardar_pedido', { p_token: B.token, p_pedido: pedido({ nombre_completo: 'Sergi', nombre_ropa: 'SERGI' }) });
  ok(r.datos?.error === 'dorsal_cogido' && !JSON.stringify(r.datos).includes('PRUEBA'), 'B, para si, con el dorsal 7: "cogido", sin decir de quien', JSON.stringify(r.datos));
  r = await rpc('guardar_pedido', { p_token: B.token, p_pedido: pedido({ para: 'familiar', nombre_completo: 'Familiar de prueba', nombre_ropa: 'FAMILIA' }) });
  ok(r.datos?.ok === true, 'B, para un familiar, con el dorsal 7: se acepta (dorsal libre)', JSON.stringify(r.datos));
  r = await rpc('guardar_pedido', { p_token: B.token, p_pedido: pedido({ dorsal: 8, tallas: { camiseta: 'XXXL' } }) });
  ok(r.datos?.error === 'talla_invalida', 'talla inexistente rechazada', JSON.stringify(r.datos));
  r = await rpc('guardar_pedido', { p_token: A.token, p_pedido: pedido({ id: idA, tallas: { camiseta: 'L', sudadera: 'XL' } }) });
  ok(r.datos?.ok === true, 'A modifica su pedido', JSON.stringify(r.datos));
  const rep = await cg.from('v_dorsales_repetidos').select('dorsal').eq('campana_id', cam.id);
  ok((rep.data ?? []).length === 0, 'el pedido del familiar no cuenta como dorsal repetido para los gestores');
  await sql`update public.campanas_ropa set estado = 'cerrada' where id = ${cam.id}`;
  r = await rpc('guardar_pedido', { p_token: A.token, p_pedido: pedido({ id: idA }) });
  ok(r.datos?.error === 'campana_cerrada', 'con la campaña cerrada no se puede modificar', JSON.stringify(r.datos));
  const tokenAnulado = crypto.randomBytes(32).toString('hex');
  const [ea] = await sql`insert into public.enlaces (jugador_id, token, anulado_en) values (${A.jugador}, ${tokenAnulado}, now()) returning id`;
  temporales.enlace = ea.id;
  r = await rpc('zona_jugador', { p_token: tokenAnulado });
  ok(r.status === 200 && r.datos === null, 'enlace anulado: no devuelve nada');
} catch (e) {
  fallos++;
  console.log(`  FALLO la verificacion se interrumpio: ${String(e.message).split(/\r?\n/)[0]}`);
} finally {
  seccion('Limpieza');
  if (temporales.enlace) await sql`delete from public.enlaces where id = ${temporales.enlace}`;
  if (temporales.campana) await sql`delete from public.campanas_ropa where id = ${temporales.campana}`; // borra sus pedidos
  for (const u of usosPrevios) await sql`update public.enlaces set ultimo_uso = ${u.ultimo_uso} where id = ${u.id}`;
  for (const id of temporales.usuarios) await sql`delete from auth.users where id = ${id}`; // borra identidades y gestores
  const [f] = await sql`select
    (select count(*)::int from auth.users) as usuarios,
    (select count(*)::int from public.gestores) as gestores,
    (select count(*)::int from public.jugadores) as jugadores,
    (select count(*)::int from public.enlaces) as enlaces,
    (select count(*)::int from public.campanas_ropa) as campanas,
    (select count(*)::int from public.pedidos_ropa) as pedidos,
    (select string_agg(estado, ',') from public.campanas_ropa) as estado_campanas`;
  console.log('  estado final:', JSON.stringify(f));
  ok(f.usuarios === 1 && f.gestores === 1 && f.jugadores === 25 && f.enlaces === 25 && f.campanas === 1 && f.pedidos === 0 && f.estado_campanas === 'cerrada',
    'todo lo temporal borrado: queda solo lo de la semilla y tu usuario');
  await sql.end();
  console.log(`\nRESULTADO: ${fallos === 0 ? 'TODO OK' : `${fallos} FALLOS`}`);
  process.exitCode = fallos ? 1 : 0;
}
