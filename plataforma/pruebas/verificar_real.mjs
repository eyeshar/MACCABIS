#!/usr/bin/env node
// Verificacion de seguridad CONTRA EL PROYECTO REAL de Supabase (lee .env.local).
// Las comprobaciones de acceso van por HTTPS con la clave publica, como cualquiera en internet.
// Crea datos temporales (2 usuarios de prueba, 1 campana "PRUEBA" y sus pedidos) y los BORRA
// al final, pase lo que pase. No imprime claves ni correos reales de jugadores.
//
//   node pruebas/verificar_real.mjs

import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { conectar } from '../scripts/db.mjs';
import { volcar, huella, TABLAS } from '../scripts/backup_public.mjs';

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

// Usuario temporal de Supabase Auth creado por SQL (el registro libre esta desactivado;
// esto SALTA el hook "Before User Created" a proposito, igual que haria un admin desde
// el panel: por eso la lista blanca se comprueba tambien aparte, llamando a las mismas
// funciones SQL que usa el hook).
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
const temporales = { usuarios: [], campana: null };
let correosOriginales = [];
// Jugadores de verdad del club: crece con el tiempo (altas en "Jugadores" o
// db:correos/db:gestor), así que se compara contra el total real, no un numero fijo.
let nJugadoresReales = null;
const sinMarca = (filas) => filas.map(({ actualizado_en, ...r }) => r);   // la prueba cambia y devuelve el correo de 2 jugadores: solo se mueve su marca de actualizacion
let antes = null;   // huellas de los datos reales antes de empezar: al final deben ser identicas

try {
  const [{ n: nUsuariosAntes }] = await sql`select count(*)::int n from auth.users`;
  nJugadoresReales = (await sql`select count(*)::int n from public.jugadores`)[0].n;
  const v0 = await volcar(sql);
  antes = { usuarios: nUsuariosAntes, huellas: Object.fromEntries(TABLAS.map((t) => [t, huella(sinMarca(v0.tablas[t]))])), filas: Object.fromEntries(TABLAS.map((t) => [t, v0.tablas[t].length])) };

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
  ok(anonFunciones.length === 0, 'anon no puede ejecutar NINGUNA funcion de public (D68)', anonFunciones.join(', '));
  const authFunciones = (await sql`
    select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'EXECUTE') order by 1`).map((x) => x.proname);
  ok(JSON.stringify(authFunciones.filter((f) => f !== 'cambiar_correo_jugador')) === JSON.stringify(['anular_pedido', 'dorsal_cogido', 'guardar_pedido', 'is_gestor', 'mi_zona', 'tallas_vive', 'tocar_actualizado_en']),
    'authenticated solo puede ejecutar las funciones de sesion previstas', authFunciones.join(', '));

  seccion('Anonimo sin sesion (HTTPS, clave publica)');
  for (const t of ['jugadores', 'gestores', 'campanas_ropa', 'pedidos_ropa', 'v_dorsales_repetidos']) {
    const r = await api(`/${t}?select=*`);
    ok(r.status === 401 || r.status === 403 || r.status === 404 || (Array.isArray(r.datos) && r.datos.length === 0), `no lee ${t}`, `HTTP ${r.status}`);
  }
  let r = await api('/pedidos_ropa', { metodo: 'POST', cuerpo: { nombre_completo: 'x' } });
  ok(r.status >= 400, 'no puede escribir en las tablas', `HTTP ${r.status}`);
  for (const f of ['mi_zona', 'guardar_pedido', 'anular_pedido', 'dorsal_cogido', 'is_gestor']) {
    r = await rpc(f, {});
    ok(r.status >= 400, `no puede ejecutar ${f}()`, `HTTP ${r.status}`);
  }

  seccion('Lista blanca de correos (D68)');
  const [jugadorReal] = await sql`select email from public.jugadores where email is not null limit 1`;
  if (jugadorReal) {
    const [{ permitido }] = await sql`select public.correo_permitido(${jugadorReal.email}) as permitido`;
    ok(permitido === true, 'correo_permitido(): un correo real de la plantilla esta permitido');
  } else {
    console.log('  AVISO ningun jugador tiene correo todavia (pendiente de npm run db:correos): se omite esta comprobacion');
  }
  const correoFuera = `prueba-fuera-${sufijo}@maccabis.invalid`;
  const [{ permitido_fuera }] = await sql`select public.correo_permitido(${correoFuera}) as permitido_fuera`;
  ok(permitido_fuera === false, 'correo_permitido(): un correo inventado NO esta permitido');
  const [{ rechazo }] = await sql`select (public.antes_de_crear_usuario(jsonb_build_object('user', jsonb_build_object('email', ${correoFuera}::text)))->'error'->>'http_code') as rechazo`;
  ok(rechazo === '403', 'antes_de_crear_usuario(): rechaza con 403 un correo fuera de la lista', String(rechazo));
  const [{ hookRegistrado }] = await sql`select has_function_privilege('supabase_auth_admin', 'public.antes_de_crear_usuario(jsonb)', 'EXECUTE') as "hookRegistrado"`.catch(() => [{ hookRegistrado: null }]);
  if (hookRegistrado === null) console.log('  AVISO no se pudo comprobar el permiso de supabase_auth_admin (rol no visible con esta conexion)');
  else ok(hookRegistrado === true, 'supabase_auth_admin puede ejecutar antes_de_crear_usuario() (requisito del hook)');

  seccion('Tu usuario de gestor (Iván), evaluado por la base de datos real');
  const [ivan] = await sql`select g.user_id, u.email_confirmed_at is not null as confirmado from public.gestores g join auth.users u on u.id = g.user_id where g.nombre = 'Iván'`;
  ok(ivan?.confirmado, 'Iván esta en gestores y su usuario esta confirmado');
  const comoUsuario = (uid) => sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: uid, role: 'authenticated' })}, true)`;
    await tx`set local role authenticated`;
    const [{ g }] = await tx`select public.is_gestor() as g`;
    const [{ n }] = await tx`select count(*)::int n from public.jugadores`;
    return { g, n };
  });
  const vi = await comoUsuario(ivan.user_id);
  ok(vi.g === true && vi.n === nJugadoresReales, 'con la identidad de Iván: es gestor y ve todos los jugadores', JSON.stringify({ ...vi, esperados: nJugadoresReales }));
  const vx = await comoUsuario(crypto.randomUUID());
  ok(vx.g === false && vx.n === 0, 'con otra identidad cualquiera: no es gestor y no ve nada', JSON.stringify(vx));

  seccion('Login real de Supabase Auth (usuarios temporales, creados saltando el hook)');
  const claveG = crypto.randomBytes(18).toString('base64url');
  const claveN = crypto.randomBytes(18).toString('base64url');
  const emailG = `prueba-gestor-${sufijo}@maccabis.invalid`;
  const emailN = `prueba-nogestor-${sufijo}@maccabis.invalid`;
  const idG = await usuarioTemporal(emailG, claveG); temporales.usuarios.push(idG);
  const idN = await usuarioTemporal(emailN, claveN); temporales.usuarios.push(idN);
  await sql`insert into public.gestores (user_id, nombre, email) values (${idG}, 'PRUEBA temporal', ${emailG})`;
  const cliente = () => createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const cg = cliente();
  const lg = await cg.auth.signInWithPassword({ email: emailG, password: claveG });
  ok(!lg.error && lg.data.session, 'un gestor entra con correo y contraseña', lg.error?.message);
  const malo = await cliente().auth.signInWithPassword({ email: emailG, password: 'contraseña-mala' });
  ok(!!malo.error, 'con contraseña equivocada no entra');
  const jg = await cg.from('jugadores').select('id');
  ok(jg.data?.length === nJugadoresReales, 'el gestor, con su sesion real, ve todos los jugadores', jg.error?.message ?? `${jg.data?.length} / ${nJugadoresReales}`);
  const cn = cliente();
  const ln = await cn.auth.signInWithPassword({ email: emailN, password: claveN });
  ok(!ln.error, 'un usuario que NO es gestor tambien puede iniciar sesion...', ln.error?.message);
  const jn = await cn.from('jugadores').select('id');
  ok((jn.data?.length ?? 0) === 0, '...pero no ve jugadores');
  const mn = await cn.rpc('mi_zona');
  ok(mn.data === null || mn.data === undefined, '...ni tiene zona de jugador (mi_zona devuelve null)', JSON.stringify(mn.data));

  seccion('Un jugador solo ve y toca lo suyo (HTTPS, con sesion real)');
  const emailA = `prueba-jugA-${sufijo}@maccabis.invalid`;
  const emailB = `prueba-jugB-${sufijo}@maccabis.invalid`;
  const jugador = async (pid) => (await sql`select id, email from public.jugadores where person_id = ${pid}`)[0];
  const jA = await jugador('calahorro-sanchez-manuel');
  const jB = await jugador('jorba-lopez-sergi');
  correosOriginales = [jA, jB];
  await sql`update public.jugadores set email = ${emailA} where id = ${jA.id}`;
  await sql`update public.jugadores set email = ${emailB} where id = ${jB.id}`;
  const claveA = crypto.randomBytes(18).toString('base64url');
  const claveB = crypto.randomBytes(18).toString('base64url');
  const idA = await usuarioTemporal(emailA, claveA); temporales.usuarios.push(idA);
  const idB = await usuarioTemporal(emailB, claveB); temporales.usuarios.push(idB);
  const cA = cliente();
  await cA.auth.signInWithPassword({ email: emailA, password: claveA });
  const cB = cliente();
  await cB.auth.signInWithPassword({ email: emailB, password: claveB });

  const [cam] = await sql`insert into public.campanas_ropa (nombre, estado) values (${'PRUEBA temporal ' + sufijo}, 'abierta') returning id`;
  temporales.campana = cam.id;
  const pedido = (extra) => ({ campana_id: cam.id, para: 'yo', nombre_completo: 'Prueba Temporal', nombre_ropa: 'PRUEBA', dorsal: 7, tallas: { camiseta: 'M' }, ...extra });
  let rA = await cA.rpc('guardar_pedido', { p_pedido: pedido() });
  ok(rA.data?.ok === true, 'A hace un pedido valido', JSON.stringify(rA.data ?? rA.error));
  const idPedidoA = rA.data?.id;
  const zA = (await cA.rpc('mi_zona')).data;
  const zB = (await cB.rpc('mi_zona')).data;
  ok(zA?.jugador?.nombre_visible === 'Manu' && zA.pedidos.some((p) => p.id === idPedidoA), 'la zona de A trae su nombre y su pedido');
  ok(zB?.jugador?.nombre_visible === 'Sergi' && !zB.pedidos.some((p) => p.id === idPedidoA), 'la zona de B NO trae el pedido de A');
  ok(zA && !('telefono' in zA.jugador) && !('rol' in zA.jugador) && !('entrena' in zA.jugador), 'la zona no devuelve telefono, rol ni "entrena"');
  let rB = await cB.rpc('guardar_pedido', { p_pedido: pedido({ id: idPedidoA, nombre_ropa: 'PIRATA' }) });
  ok(rB.data?.error === 'no_encontrado', 'B no puede modificar el pedido de A', JSON.stringify(rB.data));
  rB = await cB.rpc('anular_pedido', { p_pedido: idPedidoA });
  ok(rB.data?.error === 'no_encontrado', 'B no puede anular el pedido de A', JSON.stringify(rB.data));
  rB = await cB.rpc('guardar_pedido', { p_pedido: pedido({ nombre_completo: 'Sergi', nombre_ropa: 'SERGI' }) });
  ok(rB.data?.error === 'dorsal_cogido' && !JSON.stringify(rB.data).includes('PRUEBA'), 'B, para si, con el dorsal 7: "cogido", sin decir de quien', JSON.stringify(rB.data));
  rB = await cB.rpc('guardar_pedido', { p_pedido: pedido({ para: 'familiar', nombre_completo: 'Familiar de prueba', nombre_ropa: 'FAMILIA' }) });
  ok(rB.data?.ok === true, 'B, para un familiar, con el dorsal 7: se acepta (dorsal libre)', JSON.stringify(rB.data));
  rB = await cB.rpc('guardar_pedido', { p_pedido: pedido({ dorsal: 8, tallas: { camiseta: 'XXXL' } }) });
  ok(rB.data?.error === 'talla_invalida', 'talla inexistente rechazada', JSON.stringify(rB.data));
  rA = await cA.rpc('guardar_pedido', { p_pedido: pedido({ id: idPedidoA, tallas: { camiseta: 'L', sudadera: 'XL' } }) });
  ok(rA.data?.ok === true, 'A modifica su pedido', JSON.stringify(rA.data));
  const rep = await cg.from('v_dorsales_repetidos').select('dorsal').eq('campana_id', cam.id);
  ok((rep.data ?? []).length === 0, 'el pedido del familiar no cuenta como dorsal repetido para los gestores');
  await sql`update public.campanas_ropa set estado = 'cerrada' where id = ${cam.id}`;
  rA = await cA.rpc('guardar_pedido', { p_pedido: pedido({ id: idPedidoA }) });
  ok(rA.data?.error === 'campana_cerrada', 'con la campaña cerrada no se puede modificar', JSON.stringify(rA.data));

  seccion('Liga 26/27 (D73): datos por jugador de otros equipos, solo para gestores');
  const [{ np, nj }] = await sql`select (select count(*)::int from public.liga_partidos) as np, (select count(*)::int from public.liga_estadisticas_jugador) as nj`;
  ok(np > 0 && nj > 0, `hay datos de liga cargados (${np} partidos, ${nj} filas de jugador)`);
  const ligaRls = await sql`select relname, relrowsecurity from pg_class where relname in ('liga_partidos', 'liga_estadisticas_jugador')`;
  ok(ligaRls.length === 2 && ligaRls.every((x) => x.relrowsecurity), 'RLS activada en las tablas de liga');
  const [{ anonLiga, escribeAuth }] = await sql`select
    (has_table_privilege('anon','public.liga_partidos','select') or has_table_privilege('anon','public.liga_estadisticas_jugador','select') or has_table_privilege('anon','public.v_liga_jugadores','select')) as "anonLiga",
    (has_table_privilege('authenticated','public.liga_partidos','insert,update,delete') or has_table_privilege('authenticated','public.liga_estadisticas_jugador','insert,update,delete')) as "escribeAuth"`;
  ok(anonLiga === false, 'anon no tiene ningun permiso sobre las tablas ni la vista de liga');
  ok(escribeAuth === false, 'authenticated no puede escribir en las tablas de liga (solo el script local)');
  for (const t of ['liga_partidos', 'liga_estadisticas_jugador', 'v_liga_jugadores']) {
    const ra = await api(`/${t}?select=*`);
    ok(ra.status >= 400 || (Array.isArray(ra.datos) && ra.datos.length === 0), `anonimo (HTTPS) no lee ${t}`, `HTTP ${ra.status}`);
    const rj = await cA.from(t).select('*');
    ok((rj.data?.length ?? 0) === 0, `un jugador con sesion real (A) no lee ${t}`, rj.error?.message ?? `${rj.data?.length}`);
    const rn = await cn.from(t).select('*');
    ok((rn.data?.length ?? 0) === 0, `un usuario que no es gestor no lee ${t}`, rn.error?.message ?? `${rn.data?.length}`);
  }
  const busca = await cA.from('liga_estadisticas_jugador').select('nombre').ilike('nombre', '%a%');
  ok((busca.data?.length ?? 0) === 0, 'un jugador no saca ni un rival buscando por nombre');
  const gp = await cg.from('liga_partidos').select('id');
  const gj = await cg.from('liga_estadisticas_jugador').select('id');
  const gv = await cg.from('v_liga_jugadores').select('nombre').limit(5);
  ok(gp.data?.length === np && gj.data?.length === nj && (gv.data?.length ?? 0) > 0, `un gestor (sesion real) lee los ${np} partidos, las ${nj} filas de jugador y la vista`, `${gp.data?.length}/${gj.data?.length}/${gv.data?.length} ${gp.error?.message ?? ''}`);
  const ins = await cg.from('liga_partidos').insert({ temporada: 'x', grupo: 'G1', jornada: 99, local: 'a', visitante: 'b', pts_local: 1, pts_visitante: 0 });
  const del = await cg.from('liga_partidos').delete().neq('jornada', -1);
  const [{ np2 }] = await sql`select count(*)::int as np2 from public.liga_partidos`;
  ok(!!ins.error && np2 === np, 'ni un gestor puede insertar ni borrar por la API', `${ins.error?.message ?? 'inserto'} / ${del.error?.message ?? 'borro'} / ${np2}`);
} catch (e) {
  fallos++;
  console.log(`  FALLO la verificacion se interrumpio: ${String(e.message).split(/\r?\n/)[0]}`);
} finally {
  seccion('Limpieza');
  if (temporales.campana) await sql`delete from public.campanas_ropa where id = ${temporales.campana}`; // borra sus pedidos
  for (const j of correosOriginales) await sql`update public.jugadores set email = ${j.email} where id = ${j.id}`;
  for (const id of temporales.usuarios) await sql`delete from auth.users where id = ${id}`; // borra identidades y gestores vinculados
  await sql`delete from public.gestores where nombre = 'PRUEBA temporal'`; // por si el borrado en cascada no alcanzo (user_id ahora es nullable)
  const [f] = await sql`select
    (select count(*)::int from auth.users) as usuarios,
    (select count(*)::int from public.gestores) as gestores,
    (select count(*)::int from public.jugadores) as jugadores,
    (select count(*)::int from public.campanas_ropa) as campanas,
    (select count(*)::int from public.pedidos_ropa) as pedidos,
    (select string_agg(estado, ',') from public.campanas_ropa) as estado_campanas`;
  console.log('  estado final:', JSON.stringify(f));
  const v1 = await volcar(sql);
  for (const t of TABLAS) ok(huella(sinMarca(v1.tablas[t])) === antes.huellas[t] && v1.tablas[t].length === antes.filas[t], `${t}: ${v1.tablas[t].length} filas, identicas a las de antes de empezar (huella ${antes.huellas[t]}, sin contar la marca actualizado_en)`);
  const [{ conCorreo }] = await sql`select count(*)::int as "conCorreo" from public.jugadores where email is not null`;
  ok(f.jugadores === nJugadoresReales && conCorreo === nJugadoresReales, `los ${nJugadoresReales} jugadores siguen con su correo (${conCorreo} con correo)`);
  ok(f.usuarios === antes.usuarios, `cuentas de auth: ${f.usuarios}, las mismas que antes (${antes.usuarios})`);
  await sql.end();
  console.log(`\nRESULTADO: ${fallos === 0 ? 'TODO OK' : `${fallos} FALLOS`}`);
  process.exitCode = fallos ? 1 : 0;
}
