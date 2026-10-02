#!/usr/bin/env node
// Pruebas de extremo a extremo de la plataforma v0, contra la pila local
// (Postgres + PostgREST reales con NUESTRAS migraciones; ver pila.mjs) y la app
// Next.js compilada de verdad, manejada con Chrome.
//
//   npm run pruebas
//
// Resultado en consola y en pruebas/resultados/informe.txt (fuera de git).

import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { arrancar } from './pila.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const RES = path.join(AQUI, 'resultados');
fs.mkdirSync(RES, { recursive: true });
const PUERTO_APP = 3100;
const APP = `http://127.0.0.1:${PUERTO_APP}`;
const PLANTILLA_VIVE = path.join(RAIZ, '..', 'privado', 'LISTADO MACCABIS 2024 (revisado).xlsx');

const lineas = [];
let fallos = 0;
const log = (s) => { console.log(s); lineas.push(s); };
function ok(cond, que, detalle = '') {
  if (cond) log(`  OK    ${que}`);
  else { fallos++; log(`  FALLO ${que}${detalle ? ` -> ${detalle}` : ''}`); }
}
const seccion = (t) => log(`\n== ${t}`);

async function esperarHttp(url, ms = 60000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    try { const r = await fetch(url); if (r.status < 500) return; } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`${url} no arranca`);
}

const pila = await arrancar();
let app;
let navegador;
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
  const rpc = (f, args, token) => api(`/rpc/${f}`, { metodo: 'POST', cuerpo: args, token });
  const auth = (ruta, cuerpo) => fetch(`${url}/auth/v1${ruta}`, {
    method: 'POST', headers: { apikey: anonKey, 'content-type': 'application/json' }, body: JSON.stringify(cuerpo),
  }).then(async (r) => ({ status: r.status, datos: await r.json().catch(() => null) }));
  const codigoDe = async (email) => (await sql`select codigo from public._otp_pruebas where email = ${email}`)[0]?.codigo;

  // Datos de prueba: tres jugadores (por correo, ya no por enlace) y un gestor.
  const jugadorDe = async (personId, email) => {
    await sql`update public.jugadores set email = ${email} where person_id = ${personId}`;
    return (await sql`select id, nombre_visible from public.jugadores where person_id = ${personId}`)[0];
  };
  const A = { ...(await jugadorDe('calahorro-sanchez-manuel', 'manu@pruebas.local')), email: 'manu@pruebas.local' };
  const B = { ...(await jugadorDe('jorba-lopez-sergi', 'sergi@pruebas.local')), email: 'sergi@pruebas.local' };
  const C = { ...(await jugadorDe('esteban-jon', 'jon@pruebas.local')), email: 'jon@pruebas.local' };
  const [campana] = await sql`select id from public.campanas_ropa limit 1`;
  const gestorEmail = 'gestor@pruebas.local';
  const gestorId = await pila.crearUsuario(gestorEmail, 'no-se-usa');
  await sql`insert into public.gestores (user_id, nombre, email) values (${gestorId}, 'Gestor de pruebas', ${gestorEmail})`;
  const intrusoId = await pila.crearUsuario('intruso@pruebas.local', 'no-se-usa');
  const jwtGestor = await pila.firmar({ sub: gestorId, role: 'authenticated', email: gestorEmail });
  const jwtIntruso = await pila.firmar({ sub: intrusoId, role: 'authenticated', email: 'intruso@pruebas.local' });
  const idA = await pila.crearUsuario(A.email, 'no-se-usa');
  const jwtA = await pila.firmar({ sub: idA, role: 'authenticated', email: A.email });

  // ------------------------------------------------------------------ RLS y lista blanca (API directa)
  seccion('RLS y permisos (API directa, como lo haria cualquiera con la clave publica)');
  for (const t of ['jugadores', 'gestores', 'campanas_ropa', 'pedidos_ropa', 'v_dorsales_repetidos']) {
    const r = await api(`/${t}?select=*`);
    ok(r.status === 401 || r.status === 403 || (Array.isArray(r.datos) && r.datos.length === 0), `anonimo NO lee ${t}`, `status ${r.status}`);
  }
  let r = await api('/jugadores', { metodo: 'POST', cuerpo: { person_id: 'x', nombre_oficial: 'X', nombre_visible: 'X' } });
  ok(r.status >= 400, 'anonimo NO puede crear jugadores', `status ${r.status}`);
  r = await api('/pedidos_ropa', { metodo: 'POST', cuerpo: { campana_id: campana.id, jugador_id: A.id, nombre_completo: 'Hack', dorsal: 1, nombre_ropa: 'H', talla_camiseta: 'M' } });
  ok(r.status >= 400, 'anonimo NO puede insertar pedidos directamente en la tabla', `status ${r.status}`);
  for (const f of ['mi_zona', 'guardar_pedido', 'anular_pedido', 'dorsal_cogido', 'is_gestor']) {
    const args = f === 'guardar_pedido' ? { p_pedido: {} } : f === 'anular_pedido' ? { p_pedido: campana.id } : f === 'dorsal_cogido' ? { p_campana: campana.id, p_dorsal: 1 } : {};
    r = await rpc(f, args);
    ok(r.status >= 400, `anonimo NO puede ejecutar ${f}()`, `status ${r.status}`);
  }
  await sql`create table public.prueba_rls_automatica (id int)`;
  const [rlsNueva] = await sql`select relrowsecurity from pg_class where oid = 'public.prueba_rls_automatica'::regclass`;
  await sql`drop table public.prueba_rls_automatica`;
  ok(rlsNueva?.relrowsecurity === true, 'una tabla nueva en public nace con RLS activada (event trigger)');
  const sinRls = await sql`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`;
  ok(sinRls.length === 0, 'todas las tablas de public tienen RLS', sinRls.map((x) => x.relname).join(','));
  // Auditoria completa de permisos: ninguna funcion nueva debe heredar EXECUTE
  // de PUBLIC por defecto (el fallo real: revocar solo "from anon" no basta
  // si el grant lo tiene el pseudo-rol PUBLIC; hay que revocarlo tambien).
  const anonFunciones = (await sql`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE') order by 1`).map((x) => x.proname);
  ok(anonFunciones.length === 0, 'anon no puede ejecutar NINGUNA funcion de public (D68)', anonFunciones.join(', '));
  const authFunciones = (await sql`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'EXECUTE') order by 1`).map((x) => x.proname);
  ok(JSON.stringify(authFunciones) === JSON.stringify(['anular_pedido', 'dorsal_cogido', 'guardar_pedido', 'is_gestor', 'mi_zona', 'tallas_vive', 'tocar_actualizado_en']),
    'authenticated solo puede ejecutar las funciones de sesion previstas', authFunciones.join(', '));

  seccion('Lista blanca: quien puede entrar (D68)');
  const [{ permitido_jugador }] = await sql`select public.correo_permitido(${A.email}) as permitido_jugador`;
  ok(permitido_jugador === true, 'correo_permitido(): el correo de un jugador esta permitido');
  const [{ permitido_desconocido }] = await sql`select public.correo_permitido('nadie@fuera.local') as permitido_desconocido`;
  ok(permitido_desconocido === false, 'correo_permitido(): un correo desconocido NO esta permitido');
  const [{ hook_ok }] = await sql`select (public.antes_de_crear_usuario(jsonb_build_object('user', jsonb_build_object('email', ${A.email}::text))) = '{}'::jsonb) as hook_ok`;
  ok(hook_ok === true, 'antes_de_crear_usuario(): deja pasar un correo de la lista blanca');
  const [{ hook_rechaza }] = await sql`select (public.antes_de_crear_usuario(jsonb_build_object('user', jsonb_build_object('email', 'nadie@fuera.local')))->'error'->>'http_code') as hook_rechaza`;
  ok(hook_rechaza === '403', 'antes_de_crear_usuario(): rechaza un correo fuera de la lista, con error 403', String(hook_rechaza));
  r = await auth('/otp', { email: A.email, create_user: true });
  ok(r.status === 200, 'POST /otp con un correo permitido: manda el codigo', `status ${r.status}`);
  r = await auth('/otp', { email: 'nadie@fuera.local', create_user: true });
  ok(r.status === 400 && r.datos?.error_code === 'signup_disabled', 'POST /otp con un correo fuera de la lista: rechazado', JSON.stringify(r.datos));
  await sql`delete from public._otp_pruebas where email = ${A.email}`; // no interfiere con el login real de A mas abajo

  // Un gestor "reservado" solo por correo (sin usuario todavia) se vincula solo al entrar.
  const gestor2Email = 'gestor2@pruebas.local';
  await sql`insert into public.gestores (email, nombre) values (${gestor2Email}, 'Gestor reservado')`;
  r = await auth('/otp', { email: gestor2Email, create_user: true });
  const codigoG2 = await codigoDe(gestor2Email);
  r = await auth('/verify', { email: gestor2Email, token: codigoG2, type: 'email' });
  ok(r.status === 200 && r.datos?.user?.email === gestor2Email, 'gestor reservado por correo: entra por primera vez', JSON.stringify(r.datos)?.slice(0, 120));
  const [g2] = await sql`select user_id from public.gestores where email = ${gestor2Email}`;
  ok(g2?.user_id === r.datos?.user?.id, 'al entrar, su cuenta nueva se vincula sola a la plaza reservada (trigger)');

  seccion('Sesiones de prueba y RLS por sesion');
  for (const t of ['jugadores', 'gestores', 'pedidos_ropa']) {
    const x = await api(`/${t}?select=*`, { token: jwtIntruso });
    ok(Array.isArray(x.datos) && x.datos.length === 0, `sesion sin jugador ni gestor no ve ${t}`, JSON.stringify(x.datos)?.slice(0, 80));
  }
  r = await rpc('mi_zona', {}, jwtIntruso);
  ok(r.status === 200 && r.datos === null, 'mi_zona(): una sesion sin jugador asociado devuelve null (no error)');
  r = await rpc('is_gestor', {}, jwtIntruso);
  ok(r.status === 200 && r.datos === false, 'is_gestor(): una sesion normal no es gestor');
  r = await api('/jugadores?select=id', { token: jwtGestor });
  ok(Array.isArray(r.datos) && r.datos.length === 25, 'el gestor ve los 25 jugadores', `${r.datos?.length}`);
  const zonaA = (await rpc('mi_zona', {}, jwtA)).datos;
  ok(zonaA && !('telefono' in zonaA.jugador) && !('entrena' in zonaA.jugador) && !('rol' in zonaA.jugador),
    'mi_zona() no devuelve telefono, rol ni "entrena"', JSON.stringify(zonaA?.jugador));

  // ------------------------------------------------------------------ App
  seccion('Compilacion de la app contra la pila local');
  const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey, NEXT_TELEMETRY_DISABLED: '1' };
  const next = path.join(RAIZ, 'node_modules', 'next', 'dist', 'bin', 'next');
  execFileSync(process.execPath, [next, 'build'], { cwd: RAIZ, env, stdio: 'ignore' });
  log('  OK    next build');
  app = spawn(process.execPath, [next, 'start', '-p', String(PUERTO_APP), '-H', '127.0.0.1'], { cwd: RAIZ, env, stdio: 'ignore' });
  await esperarHttp(APP);

  navegador = await chromium.launch({ channel: 'chrome', headless: true });
  const movil = { viewport: { width: 375, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-ES' };
  const ctxA = await navegador.newContext(movil);
  const ctxB = await navegador.newContext(movil);
  const ctxAnon = await navegador.newContext(movil);
  const ctxG = await navegador.newContext({ viewport: { width: 1100, height: 900 }, locale: 'es-ES', acceptDownloads: true });
  const pA = await ctxA.newPage();
  const pB = await ctxB.newPage();
  const pAnon = await ctxAnon.newPage();
  const pG = await ctxG.newPage();
  const erroresJS = [];
  for (const p of [pA, pB, pAnon, pG]) p.on('pageerror', (e) => erroresJS.push(String(e)));
  const captura = (p, n) => p.screenshot({ path: path.join(RES, `${n}.png`), fullPage: true });
  const sinDesbordar = async (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

  // Entra por la UI con "codigo por correo" (Google no se puede probar sin una cuenta real).
  async function entrarPorCodigo(p, email) {
    await p.goto(`${APP}/entrar`);
    await p.getByLabel('Recibir código por correo').fill(email);
    await p.getByRole('button', { name: 'Enviarme un código' }).click();
    await p.getByText('Código enviado a').waitFor({ timeout: 10000 });
    const codigo = await codigoDe(email);
    await p.getByLabel('Código de 6 dígitos').fill(codigo ?? '000000');
    await p.getByRole('button', { name: 'Entrar', exact: true }).click();
  }

  seccion('Cabeceras y portada');
  const h = await (await fetch(`${APP}/entrar`)).headers;
  ok(h.get('referrer-policy') === 'no-referrer', 'cabecera Referrer-Policy: no-referrer');
  ok((h.get('x-robots-tag') || '').includes('noindex'), 'cabecera X-Robots-Tag: noindex');
  await pAnon.goto(`${APP}/`);
  const portada = await pAnon.textContent('body');
  ok(!portada.includes('Calahorro') && !portada.includes(A.nombre_visible), 'la portada no muestra ningun dato de jugadores');

  seccion('Anonimo sin sesion');
  await pAnon.goto(`${APP}/gestion`);
  ok(pAnon.url().includes('/entrar'), '/gestion sin sesion manda a "Entrar"');
  await pAnon.goto(`${APP}/gestion/jugadores`);
  ok(pAnon.url().includes('/entrar'), '/gestion/jugadores sin sesion manda a "Entrar"');
  await pAnon.goto(`${APP}/mi-zona`);
  ok(pAnon.url().includes('/entrar'), '/mi-zona sin sesion manda a "Entrar"');
  const xl = await fetch(`${APP}/gestion/ropa/excel?c=${campana.id}`, { redirect: 'manual' });
  ok(xl.status === 401 || (xl.status >= 300 && xl.status < 400), 'el Excel no se descarga sin sesion', `status ${xl.status}`);

  seccion('Entrar con un correo que no está en la lista blanca');
  await pAnon.goto(`${APP}/entrar`);
  await pAnon.getByLabel('Recibir código por correo').fill('nadie@fuera.local');
  await pAnon.getByRole('button', { name: 'Enviarme un código' }).click();
  await pAnon.getByText('No hemos podido mandar el código').waitFor({ timeout: 5000 }).catch(() => {});
  ok(await pAnon.getByText('No hemos podido mandar el código').isVisible(),
    'correo fuera de la lista blanca: aviso generico, sin confirmar que no esta dado de alta');
  ok(!(await pAnon.getByLabel('Código de 6 dígitos').isVisible().catch(() => false)), 'no pasa al paso del codigo');

  seccion('Entrar con código por correo (jugador A)');
  await entrarPorCodigo(pA, A.email);
  await pA.waitForURL(`${APP}/mi-zona`);
  ok(await pA.getByRole('heading', { name: `Hola, ${A.nombre_visible}` }).isVisible(), 'codigo correcto: entra y abre su zona');
  ok(await sinDesbordar(pA), 'zona personal sin desbordamiento horizontal a 375 px');
  await captura(pA, '01-zona-jugador');

  seccion('Código incorrecto');
  await pAnon.goto(`${APP}/entrar`);
  await pAnon.getByLabel('Recibir código por correo').fill(C.email);
  await pAnon.getByRole('button', { name: 'Enviarme un código' }).click();
  await pAnon.getByText('Código enviado a').waitFor({ timeout: 10000 });
  await pAnon.getByLabel('Código de 6 dígitos').fill('000000');
  await pAnon.getByRole('button', { name: 'Entrar', exact: true }).click();
  await pAnon.getByText('Código incorrecto o caducado.').waitFor({ timeout: 5000 }).catch(() => {});
  ok(await pAnon.getByText('Código incorrecto o caducado.').isVisible(), 'codigo equivocado: rechazado, sigue sin sesion');
  await captura(pAnon, '02-codigo-incorrecto');

  seccion('Gestor: entrar y abrir la campana');
  await entrarPorCodigo(pG, gestorEmail);
  await pG.waitForURL(`${APP}/gestion`);
  ok(await pG.getByRole('heading', { name: 'Panel de gestión' }).isVisible(), 'el gestor entra al panel');
  await pG.goto(`${APP}/gestion/ropa`);
  ok(await pA.getByText('Cerrado', { exact: true }).isVisible(), 'con la campana cerrada, el jugador ve "Cerrado" (antes de abrirla)');
  await pG.getByLabel('Estado').selectOption('abierta');
  await pG.getByLabel('Fecha límite (incluida)').fill('2026-12-31');
  await pG.getByRole('button', { name: 'Guardar campaña' }).click();
  await pG.getByText('Campaña guardada.').waitFor();
  const [cam] = await sql`select estado, fecha_limite from public.campanas_ropa where id = ${campana.id}`;
  ok(cam.estado === 'abierta' && new Date(cam.fecha_limite).toISOString() === '2026-12-31T22:59:59.000Z', 'campana abierta con fecha limite 31/12 a las 23:59 de Madrid', `${cam.estado} ${cam.fecha_limite?.toISOString?.()}`);

  seccion('Pedido del jugador A (valido)');
  await pA.goto(`${APP}/mi-zona`);
  await pA.getByRole('link', { name: 'Hacer mi pedido' }).click();
  await pA.waitForURL(/ropa\/nuevo/);
  ok(await sinDesbordar(pA), 'formulario sin desbordamiento horizontal a 375 px');
  ok(await pA.getByLabel('Nombre completo').inputValue() === 'Manuel Calahorro Sánchez', 'para mi: el nombre completo viene relleno');
  await pA.getByLabel('Nombre en la ropa').fill('manu');
  ok(await pA.getByLabel('Nombre en la ropa').inputValue() === 'MANU', 'el nombre en la ropa se pone en mayusculas');
  await pA.getByLabel('Dorsal').fill('7');
  const tarjeta = (n) => pA.locator('.prenda', { has: pA.getByRole('heading', { name: n, exact: true }) });
  await tarjeta('Camiseta de juego').getByLabel('La quiero').check();
  await tarjeta('Pantalón').getByLabel('La quiero').check();
  await tarjeta('Cubre').getByLabel('La quiero').check();
  ok(await pA.getByText('¿No tienes la equipación amarilla?').isVisible(), 'la tarjeta del cubre lleva la nota de la equipacion amarilla');
  await tarjeta('Camiseta de juego').getByLabel('Talla').selectOption('M');
  await tarjeta('Pantalón').getByLabel('Talla').selectOption('L');
  ok(await pA.getByRole('button', { name: 'Enviar pedido' }).isDisabled(), 'falta una talla (cubre): el boton de enviar esta desactivado');
  ok(await pA.locator('td.falta', { hasText: 'Falta talla' }).count() === 1, 'el resumen marca "Falta talla"');
  await tarjeta('Cubre').getByLabel('Talla').selectOption('M');
  const filas = await pA.locator('#titulo-resumen + div table tbody tr').allInnerTexts();
  ok(filas.length === 3 && filas[0].includes('MANU') && filas[0].includes('7') && filas[1].includes('Sin nombre'), 'resumen completo (prenda, nombre, numero, talla) antes de enviar', JSON.stringify(filas));
  await captura(pA, '03-formulario-pedido');
  await pA.getByRole('button', { name: 'Enviar pedido' }).click();
  await pA.waitForURL(/guardado=1/);
  ok(await pA.getByText('Pedido guardado.').isVisible(), 'pedido enviado y confirmado');
  const [pedA] = await sql`select * from public.pedidos_ropa where jugador_id = ${A.id}`;
  ok(pedA && pedA.dorsal === 7 && pedA.nombre_ropa === 'MANU' && pedA.talla_camiseta === 'M' && pedA.talla_pantalon === 'L' && pedA.talla_cubre === 'M' && !pedA.talla_sudadera, 'el pedido queda en la base de datos tal cual');
  await captura(pA, '04-zona-con-pedido');

  seccion('Dorsal repetido (jugador B)');
  await entrarPorCodigo(pB, B.email);
  await pB.waitForURL(`${APP}/mi-zona`);
  await pB.goto(`${APP}/mi-zona/ropa/nuevo`);
  await pB.getByLabel('Nombre en la ropa').fill('SERGI');
  await pB.getByLabel('Dorsal').fill('7');
  await pB.locator('.prenda', { has: pB.getByRole('heading', { name: 'Camiseta de juego', exact: true }) }).getByLabel('La quiero').check();
  await pB.locator('.prenda', { has: pB.getByRole('heading', { name: 'Camiseta de juego', exact: true }) }).getByLabel('Talla').selectOption('L');
  await pB.getByText('Ese dorsal ya está cogido.').waitFor({ timeout: 5000 });
  const cuerpoB = await pB.textContent('body');
  ok(!/Manu|Calahorro|MANU/.test(cuerpoB), 'avisa "Ese dorsal ya esta cogido" SIN decir de quien');
  await captura(pB, '05-dorsal-cogido');
  const jwtB = await pila.firmar({ sub: (await sql`select id from auth.users where lower(email) = ${B.email}`)[0].id, role: 'authenticated', email: B.email });
  r = await rpc('guardar_pedido', { p_pedido: { campana_id: campana.id, para: 'yo', nombre_completo: 'Sergi Jorba', nombre_ropa: 'SERGI', dorsal: 7, tallas: { camiseta: 'L' } } }, jwtB);
  ok(r.datos?.ok === false && r.datos?.error === 'dorsal_cogido' && !JSON.stringify(r.datos).includes('MANU'), 'la base de datos tambien lo rechaza, sin nombres', JSON.stringify(r.datos));
  r = await rpc('dorsal_cogido', { p_campana: campana.id, p_dorsal: 7 });
  ok(r.status >= 400, 'sin sesion no se puede preguntar por dorsales', `status ${r.status}`);
  await pB.getByLabel('Dorsal').fill('8');
  await pB.getByRole('button', { name: 'Enviar pedido' }).click();
  await pB.waitForURL(/guardado=1/);
  ok(true, 'con otro dorsal (8), el pedido de B se envia');

  seccion('Talla invalida y campos obligatorios (API)');
  r = await rpc('guardar_pedido', { p_pedido: { campana_id: campana.id, nombre_completo: 'Sergi Jorba', nombre_ropa: 'SERGI', dorsal: 9, tallas: { camiseta: 'XXXL' } } }, jwtB);
  ok(r.datos?.error === 'talla_invalida', 'talla "XXXL" (no existe en VIVE) rechazada', JSON.stringify(r.datos));
  r = await rpc('guardar_pedido', { p_pedido: { campana_id: campana.id, nombre_completo: 'Sergi Jorba', nombre_ropa: 'SERGI', dorsal: 9, tallas: { camiseta: '' } } }, jwtB);
  ok(r.datos?.error === 'falta_talla', 'prenda marcada sin talla rechazada', JSON.stringify(r.datos));
  r = await rpc('guardar_pedido', { p_pedido: { campana_id: campana.id, nombre_completo: 'Sergi Jorba', nombre_ropa: 'SERGI', dorsal: 100, tallas: { camiseta: 'L' } } }, jwtB);
  ok(r.datos?.error === 'dorsal_invalido', 'dorsal 100 rechazado', JSON.stringify(r.datos));

  seccion('Un jugador no puede ver ni tocar lo de otro');
  const zonaB = (await rpc('mi_zona', {}, jwtB)).datos;
  ok(zonaB.pedidos.length === 1 && zonaB.pedidos.every((p) => p.id !== pedA.id), 'la zona de B solo trae SU pedido');
  await pB.goto(`${APP}/mi-zona`);
  ok(!(await pB.textContent('body')).includes('MANU'), 'la pagina de B no muestra el pedido de A');
  await pB.goto(`${APP}/mi-zona/ropa/${pedA.id}`);
  ok(await pB.getByText('No encontramos ese pedido entre los tuyos.').isVisible(), 'B no puede abrir el pedido de A ni sabiendo su identificador');
  r = await rpc('guardar_pedido', { p_pedido: { id: pedA.id, campana_id: campana.id, nombre_completo: 'Pirata', nombre_ropa: 'PIRATA', dorsal: 50, tallas: { camiseta: 'S' } } }, jwtB);
  ok(r.datos?.error === 'no_encontrado', 'B no puede modificar el pedido de A (RPC con su id)', JSON.stringify(r.datos));
  r = await rpc('anular_pedido', { p_pedido: pedA.id }, jwtB);
  ok(r.datos?.error === 'no_encontrado', 'B no puede anular el pedido de A', JSON.stringify(r.datos));
  const [pedA2] = await sql`select nombre_ropa, dorsal from public.pedidos_ropa where id = ${pedA.id}`;
  ok(pedA2?.nombre_ropa === 'MANU' && pedA2.dorsal === 7, 'el pedido de A sigue intacto');

  seccion('Modificar un pedido');
  await pA.goto(`${APP}/mi-zona`);
  await pA.getByRole('link', { name: 'Modificar' }).first().click();
  await pA.waitForURL(/ropa\/[0-9a-f-]{36}$/);
  await pA.locator('.prenda', { has: pA.getByRole('heading', { name: 'Pantalón', exact: true }) }).getByLabel('Talla').selectOption('XL');
  await pA.locator('.prenda', { has: pA.getByRole('heading', { name: 'Sudadera / chaqueta', exact: true }) }).getByLabel('La quiero').check();
  await pA.locator('.prenda', { has: pA.getByRole('heading', { name: 'Sudadera / chaqueta', exact: true }) }).getByLabel('Talla').selectOption('L');
  await pA.getByRole('button', { name: 'Guardar cambios' }).click();
  await pA.waitForURL(/guardado=1/);
  const [pedA3] = await sql`select * from public.pedidos_ropa where id = ${pedA.id}`;
  ok(pedA3.talla_pantalon === 'XL' && pedA3.talla_sudadera === 'L' && pedA3.dorsal === 7, 'pedido modificado (pantalon XL y sudadera L), mismo dorsal sin falso "cogido"');

  seccion('Pedido para un familiar');
  await pA.getByRole('link', { name: 'Hacer otro pedido' }).click();
  await pA.getByLabel('Para un familiar').check();
  ok(await pA.getByLabel('Nombre completo del familiar').inputValue() === '', 'al elegir familiar se vacia el nombre completo');
  await pA.getByLabel('Nombre completo del familiar').fill('Lucía Calahorro');
  await pA.getByLabel('Nombre en la ropa').fill('LUCIA');
  await pA.getByLabel('Dorsal').fill('7'); // el mismo que el suyo: en un familiar el dorsal es libre (D60)
  await pA.locator('.prenda', { has: pA.getByRole('heading', { name: 'Camiseta de juego', exact: true }) }).getByLabel('La quiero').check();
  await pA.locator('.prenda', { has: pA.getByRole('heading', { name: 'Camiseta de juego', exact: true }) }).getByLabel('Talla').selectOption('10');
  await pA.waitForTimeout(800);
  ok(!(await pA.getByText('Ese dorsal ya está cogido.').isVisible()), 'familiar con el mismo dorsal (7) que un jugador: sin aviso');
  await pA.getByRole('button', { name: 'Enviar pedido' }).click();
  await pA.waitForURL(/guardado=1/);
  const fam = await sql`select * from public.pedidos_ropa where jugador_id = ${A.id} and para = 'familiar'`;
  ok(fam.length === 1 && fam[0].nombre_completo === 'Lucía Calahorro' && fam[0].talla_camiseta === '10' && fam[0].dorsal === 7, 'pedido para un familiar guardado a nombre de A, con dorsal 7');
  ok(await pA.getByRole('heading', { name: 'Para Lucía Calahorro' }).isVisible(), 'A ve el pedido del familiar en "Mis pedidos"');
  await captura(pA, '06-mis-pedidos');

  seccion('Gestor: correo de un jugador (sustituye a los enlaces)');
  await pG.goto(`${APP}/gestion/jugadores`);
  const filaC = pG.locator(`li[data-person="esteban-jon"]`);
  ok(await filaC.getByText('Puede entrar').isVisible(), 'Jon ya tiene correo: "Puede entrar"');
  await filaC.getByText('Editar datos').click();
  await filaC.getByLabel('Teléfono (opcional, solo gestores)').fill('600 111 222');
  await filaC.getByRole('button', { name: 'Guardar datos' }).click();
  await filaC.getByText('Guardado.').waitFor();
  await pG.reload();
  const wa = await pG.locator(`li[data-person="esteban-jon"] a`, { hasText: 'Enviar por WhatsApp' }).getAttribute('href');
  ok(wa?.startsWith('https://wa.me/34600111222?text=') && decodeURIComponent(wa).includes('/entrar') && decodeURIComponent(wa).includes(C.email), 'con telefono guardado aparece el enlace wa.me con el mensaje (correo y /entrar, sin token)');
  await ctxG.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: APP });
  await pG.locator(`li[data-person="esteban-jon"]`).getByRole('button', { name: 'Copiar mensaje' }).click();
  const copiado = await pG.evaluate(() => navigator.clipboard.readText());
  ok(copiado.includes(`Hola, ${C.nombre_visible}`) && copiado.includes('/entrar') && copiado.includes(C.email), '"Copiar mensaje" copia el texto de bienvenida con el correo y el enlace de /entrar');

  const filaSinCorreo = pG.locator(`li[data-person="de-maria-sanchez-jaime"]`);
  ok(await filaSinCorreo.getByText('Sin correo: no puede entrar').isVisible(), 'un jugador sin correo se marca "Sin correo: no puede entrar"');
  await filaSinCorreo.getByText('Editar datos').click();
  await filaSinCorreo.getByLabel('Correo (para entrar)').fill('intruso@pruebas.local'); // ya en uso por otro usuario de pruebas, pero NO por otro jugador
  await filaSinCorreo.getByRole('button', { name: 'Guardar datos' }).click();
  await filaSinCorreo.getByText('Guardado.').waitFor();
  await pG.reload();
  ok(await pG.locator(`li[data-person="de-maria-sanchez-jaime"]`).getByText('Puede entrar').isVisible(), 'el gestor da de alta el correo de un jugador y pasa a "Puede entrar"');
  await captura(pG, '07-gestion-jugadores');

  const filaDup = pG.locator(`li[data-person="esteban-jon"]`);
  await filaDup.getByText('Editar datos').click();
  await filaDup.getByLabel('Correo (para entrar)').fill('intruso@pruebas.local');
  await filaDup.getByRole('button', { name: 'Guardar datos' }).click();
  await filaDup.getByText('Ese correo ya está en uso por otro jugador.').waitFor({ timeout: 5000 }).catch(() => {});
  ok(await filaDup.getByText('Ese correo ya está en uso por otro jugador.').isVisible(), 'dos jugadores no pueden compartir el mismo correo');

  seccion('Vista de gestores: dorsales repetidos CON nombres, recuento, alta manual');
  await pG.goto(`${APP}/gestion/ropa/nuevo?c=${campana.id}`);
  await pG.getByLabel('Jugador que hace el pedido').selectOption(B.id);
  await pG.getByLabel('Nombre completo').fill('Sergi Jorba López');
  await pG.getByLabel('Nombre en la ropa').fill('JORBA');
  await pG.getByLabel('Dorsal').fill('7');
  await pG.locator('.prenda', { has: pG.getByRole('heading', { name: 'Cubre', exact: true }) }).getByLabel('La quiero').check();
  await pG.locator('.prenda', { has: pG.getByRole('heading', { name: 'Cubre', exact: true }) }).getByLabel('Talla').selectOption('XL');
  await pG.getByText('Puedes guardar igualmente').waitFor();
  await pG.getByRole('button', { name: 'Enviar pedido' }).click();
  await pG.waitForURL(/gestion\/ropa\?c=.*guardado=1/);
  const repetidos = await pG.locator('section', { has: pG.getByRole('heading', { name: 'Dorsales repetidos' }) }).innerText();
  ok(/7: .*Manuel Calahorro Sánchez.*Sergi Jorba López/s.test(repetidos) && !repetidos.includes('Lucía'), 'el gestor ve el dorsal 7 repetido con los dos jugadores (el familiar no cuenta)', repetidos);
  const recuento = await pG.locator('section', { has: pG.getByRole('heading', { name: 'Recuento por prenda y talla' }) }).innerText();
  ok(/Cubre[\s\S]*\b2\b/.test(recuento), 'recuento por prenda y talla visible');
  await captura(pG, '08-gestion-ropa');
  const pedidoGestor = (await sql`select id from public.pedidos_ropa where creado_por_gestor`)[0];
  await pG.goto(`${APP}/gestion/ropa/pedido/${pedidoGestor.id}`);
  await pG.getByLabel('Dorsal').fill('77');
  await pG.getByRole('button', { name: 'Guardar cambios' }).click();
  await pG.waitForURL(/guardado=1/);
  ok((await sql`select dorsal from public.pedidos_ropa where id = ${pedidoGestor.id}`)[0].dorsal === 77, 'el gestor edita un pedido');
  pG.once('dialog', (d) => d.accept());
  await pG.locator(`li[data-pedido="${pedidoGestor.id}"]`).getByRole('button', { name: 'Borrar' }).click();
  await pG.locator(`li[data-pedido="${pedidoGestor.id}"]`).waitFor({ state: 'detached' });
  ok((await sql`select count(*)::int n from public.pedidos_ropa where id = ${pedidoGestor.id}`)[0].n === 0, 'el gestor borra un pedido');

  seccion('Campana cerrada');
  await pG.goto(`${APP}/gestion/ropa`);
  await pG.getByLabel('Estado').selectOption('cerrada');
  await pG.getByRole('button', { name: 'Guardar campaña' }).click();
  await pG.getByText('Campaña guardada.').waitFor();
  r = await rpc('guardar_pedido', { p_pedido: { campana_id: campana.id, nombre_completo: 'Sergi Jorba', nombre_ropa: 'SERGI', dorsal: 30, tallas: { sudadera: 'M' } } }, jwtB);
  ok(r.datos?.error === 'campana_cerrada', 'con la campana cerrada se rechaza un pedido nuevo', JSON.stringify(r.datos));
  r = await rpc('guardar_pedido', { p_pedido: { id: pedA.id, nombre_completo: 'Manuel Calahorro Sánchez', nombre_ropa: 'MANU', dorsal: 7, tallas: { camiseta: 'S' } } }, jwtA);
  ok(r.datos?.error === 'campana_cerrada', 'con la campana cerrada no se puede modificar', JSON.stringify(r.datos));
  r = await rpc('anular_pedido', { p_pedido: pedA.id }, jwtA);
  ok(r.datos?.error === 'campana_cerrada', 'con la campana cerrada no se puede anular', JSON.stringify(r.datos));
  await pA.goto(`${APP}/mi-zona`);
  ok(await pA.getByText('Cerrado', { exact: true }).isVisible() && (await pA.getByRole('link', { name: /Hacer/ }).count()) === 0 && (await pA.getByRole('link', { name: 'Modificar' }).count()) === 0,
    'el jugador ve "Cerrado", sin boton de pedir ni de modificar');
  await pA.goto(`${APP}/mi-zona/ropa/nuevo`);
  ok(await pA.getByText('El pedido de ropa está cerrado').isVisible(), 'el formulario de pedido dice que esta cerrado');
  // Plazo vencido con la campana "abierta": tambien rechaza.
  await sql`update public.campanas_ropa set estado = 'abierta', fecha_limite = now() - interval '1 minute' where id = ${campana.id}`;
  r = await rpc('guardar_pedido', { p_pedido: { campana_id: campana.id, nombre_completo: 'Sergi Jorba', nombre_ropa: 'SERGI', dorsal: 30, tallas: { sudadera: 'M' } } }, jwtB);
  ok(r.datos?.error === 'campana_cerrada', 'con la fecha limite pasada tambien se rechaza', JSON.stringify(r.datos));

  seccion('Excel para VIVE (estructura celda a celda con la plantilla)');
  // Mismo numero de filas por bloque que la plantilla (11 camisetas, 10 pantalones,
  // 6 cubres, 5 sudaderas), con datos inventados: de la plantilla solo se copia el formato.
  await sql`delete from public.pedidos_ropa where campana_id = ${campana.id}`;
  const tallas = ['4', '12', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'M', 'L', 'XS'];
  for (let i = 0; i < 11; i++) {
    await sql`insert into public.pedidos_ropa (campana_id, jugador_id, nombre_completo, nombre_ropa, dorsal, talla_camiseta, talla_pantalon, talla_cubre, talla_sudadera)
      values (${campana.id}, ${A.id}, ${'Persona ' + i}, ${'PRUEBA' + i}, ${i + 1}, ${tallas[i]}, ${i < 10 ? tallas[i] : null}, ${i < 6 ? tallas[i] : null}, ${i < 5 ? tallas[i] : null})`;
  }
  const [descarga] = await Promise.all([pG.waitForEvent('download'), pG.goto(`${APP}/gestion/ropa`).then(() => pG.getByRole('link', { name: 'Descargar Excel para VIVE' }).click())]);
  const ruta = path.join(RES, 'vive.xlsx');
  await descarga.saveAs(ruta);
  ok(fs.statSync(ruta).size > 1000, 'el gestor descarga el Excel');
  if (fs.existsSync(PLANTILLA_VIVE)) {
    try {
      const salida = execFileSync('python', [path.join(AQUI, 'comparar_excel.py'), PLANTILLA_VIVE, ruta], { encoding: 'utf8' });
      salida.trim().split('\n').forEach((l) => log(`        ${l}`));
      ok(/^RESULTADO: IGUAL/m.test(salida), 'el Excel coincide en estructura, celda a celda, con la plantilla');
    } catch (e) {
      ok(false, 'el Excel coincide en estructura, celda a celda, con la plantilla', String(e.stdout || e));
    }
  } else {
    log('  AVISO no esta la plantilla en privado/: comparacion omitida');
  }

  seccion('Varios');
  ok(erroresJS.length === 0, 'sin errores de JavaScript en el navegador', erroresJS.join(' | '));
} catch (e) {
  fallos++;
  log(`  FALLO la prueba se interrumpio: ${String(e.message).split(/\r?\n/)[0]}`);
} finally {
  if (navegador) await navegador.close();
  if (app) app.kill();
  await pila.parar();
  log(`\nRESULTADO: ${fallos === 0 ? 'TODO OK' : `${fallos} FALLOS`}`);
  fs.writeFileSync(path.join(RES, 'informe.txt'), lineas.join('\n') + '\n');
  process.exitCode = fallos ? 1 : 0;
}
