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
import crypto from 'node:crypto';
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

  // Datos de prueba: dos jugadores, un gestor y un usuario con sesion que NO es gestor.
  const enlaceDe = async (personId) => (await sql`select e.token, j.id, j.nombre_visible from public.enlaces e join public.jugadores j on j.id = e.jugador_id where j.person_id = ${personId} and e.anulado_en is null`)[0];
  const A = await enlaceDe('calahorro-sanchez-manuel'); // "Manu"
  const B = await enlaceDe('jorba-lopez-sergi');        // "Sergi"
  const C = await enlaceDe('esteban-jon');              // "Jon" (para el enlace anulado)
  const [campana] = await sql`select id from public.campanas_ropa limit 1`;
  const gestorEmail = 'gestor@pruebas.local', gestorClave = 'clave-de-pruebas-123';
  const gestorId = await pila.crearUsuario(gestorEmail, gestorClave);
  await sql`insert into public.gestores (user_id, nombre) values (${gestorId}, 'Gestor de pruebas')`;
  const intrusoId = await pila.crearUsuario('intruso@pruebas.local', 'otra-clave-123456');
  const jwtGestor = await pila.firmar({ sub: gestorId, role: 'authenticated', email: gestorEmail });
  const jwtIntruso = await pila.firmar({ sub: intrusoId, role: 'authenticated', email: 'intruso@pruebas.local' });

  // ------------------------------------------------------------------ RLS
  seccion('RLS y permisos (API directa, como lo haria cualquiera con la clave publica)');
  for (const t of ['jugadores', 'enlaces', 'gestores', 'campanas_ropa', 'pedidos_ropa', 'v_dorsales_repetidos']) {
    const r = await api(`/${t}?select=*`);
    ok(r.status === 401 || r.status === 403 || (Array.isArray(r.datos) && r.datos.length === 0), `anonimo sin enlace NO lee ${t}`, `status ${r.status}`);
  }
  let r = await api('/jugadores', { metodo: 'POST', cuerpo: { person_id: 'x', nombre_oficial: 'X', nombre_visible: 'X' } });
  ok(r.status >= 400, 'anonimo NO puede crear jugadores', `status ${r.status}`);
  r = await api('/pedidos_ropa', { metodo: 'POST', cuerpo: { campana_id: campana.id, jugador_id: A.id, nombre_completo: 'Hack', dorsal: 1, nombre_ropa: 'H', talla_camiseta: 'M' } });
  ok(r.status >= 400, 'anonimo NO puede insertar pedidos directamente en la tabla', `status ${r.status}`);
  for (const f of ['_jugador_de_token', 'regenerar_enlace', 'anular_enlace', 'nuevo_token', '_dorsal_cogido']) {
    const args = f === '_jugador_de_token' ? { p_token: A.token } : f.includes('enlace') ? { p_jugador: A.id } : f === '_dorsal_cogido' ? { p_campana: campana.id, p_dorsal: 1, p_excluir: null } : {};
    r = await rpc(f, args);
    ok(r.status >= 400, `anonimo NO puede ejecutar ${f}()`, `status ${r.status}`);
  }
  await sql`create table public.prueba_rls_automatica (id int)`;
  const [rlsNueva] = await sql`select relrowsecurity from pg_class where oid = 'public.prueba_rls_automatica'::regclass`;
  await sql`drop table public.prueba_rls_automatica`;
  ok(rlsNueva?.relrowsecurity === true, 'una tabla nueva en public nace con RLS activada (event trigger)');
  const sinRls = await sql`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`;
  ok(sinRls.length === 0, 'todas las tablas de public tienen RLS', sinRls.map((x) => x.relname).join(','));
  r = await rpc('zona_jugador', { p_token: 'f'.repeat(64) });
  ok(r.status === 200 && r.datos === null, 'enlace inventado: zona_jugador devuelve null');
  for (const t of ['jugadores', 'enlaces', 'pedidos_ropa']) {
    const x = await api(`/${t}?select=*`, { token: jwtIntruso });
    ok(Array.isArray(x.datos) && x.datos.length === 0, `usuario con sesion que NO es gestor no ve ${t}`, JSON.stringify(x.datos)?.slice(0, 80));
  }
  r = await rpc('regenerar_enlace', { p_jugador: A.id }, jwtIntruso);
  ok(r.status >= 400, 'usuario que NO es gestor no puede regenerar enlaces', `status ${r.status}`);
  r = await api('/jugadores?select=id', { token: jwtGestor });
  ok(Array.isArray(r.datos) && r.datos.length === 25, 'el gestor ve los 25 jugadores', `${r.datos?.length}`);
  const zonaA = (await rpc('zona_jugador', { p_token: A.token })).datos;
  ok(zonaA && !('telefono' in zonaA.jugador) && !('entrena' in zonaA.jugador) && !('rol' in zonaA.jugador),
    'la zona del jugador no devuelve telefono, rol ni "entrena"', JSON.stringify(zonaA?.jugador));

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

  seccion('Enlaces personales');
  await pA.goto(`${APP}/j/${A.token}`);
  ok(await pA.getByRole('heading', { name: `Hola, ${A.nombre_visible}` }).isVisible(), 'enlace valido: abre la zona con su nombre');
  ok(await sinDesbordar(pA), 'zona personal sin desbordamiento horizontal a 375 px');
  const h = await (await fetch(`${APP}/j/${A.token}`)).headers;
  ok(h.get('referrer-policy') === 'no-referrer', 'cabecera Referrer-Policy: no-referrer (el enlace no viaja a otras webs)');
  ok((h.get('x-robots-tag') || '').includes('noindex'), 'cabecera X-Robots-Tag: noindex');
  await captura(pA, '01-zona-jugador');
  await pAnon.goto(`${APP}/j/${crypto.randomBytes(32).toString('hex')}`);
  ok(await pAnon.getByRole('heading', { name: 'Enlace no válido' }).isVisible(), 'enlace inventado (64 hex al azar): "Enlace no valido"');
  await pAnon.goto(`${APP}/j/hola`);
  ok(await pAnon.getByRole('heading', { name: 'Enlace no válido' }).isVisible(), 'enlace inventado (texto corto): "Enlace no valido"');
  await captura(pAnon, '02-enlace-no-valido');

  seccion('Anonimo sin enlace');
  await pAnon.goto(`${APP}/`);
  const portada = await pAnon.textContent('body');
  ok(!portada.includes(A.nombre_visible) && !portada.includes('Calahorro'), 'la portada no muestra ningun dato de jugadores');
  await pAnon.goto(`${APP}/gestion`);
  ok(pAnon.url().includes('/gestion/entrar'), '/gestion sin sesion manda a "Entrar"');
  await pAnon.goto(`${APP}/gestion/jugadores`);
  ok(pAnon.url().includes('/gestion/entrar'), '/gestion/jugadores sin sesion manda a "Entrar"');
  const xl = await fetch(`${APP}/gestion/ropa/excel?c=${campana.id}`, { redirect: 'manual' });
  ok(xl.status === 401 || (xl.status >= 300 && xl.status < 400), 'el Excel no se descarga sin sesion', `status ${xl.status}`);

  seccion('Gestor: entrar y abrir la campana');
  await pG.goto(`${APP}/gestion/entrar`);
  await pG.getByLabel('Correo').fill(gestorEmail);
  await pG.getByLabel('Contraseña').fill('mal');
  await pG.getByRole('button', { name: 'Entrar' }).click();
  await pG.getByText('Correo o contraseña incorrectos.').waitFor({ timeout: 10000 }).catch(() => {});
  ok(await pG.getByText('Correo o contraseña incorrectos.').isVisible(), 'contrasena erronea rechazada');
  ok(await pG.getByLabel('Correo').inputValue() === gestorEmail, 'tras el error, el correo sigue escrito');
  await pG.getByLabel('Contraseña').fill(gestorClave);
  await pG.getByRole('button', { name: 'Entrar' }).click();
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
  await pA.goto(`${APP}/j/${A.token}`);
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
  await pB.goto(`${APP}/j/${B.token}/ropa/nuevo`);
  await pB.getByLabel('Nombre en la ropa').fill('SERGI');
  await pB.getByLabel('Dorsal').fill('7');
  await pB.locator('.prenda', { has: pB.getByRole('heading', { name: 'Camiseta de juego', exact: true }) }).getByLabel('La quiero').check();
  await pB.locator('.prenda', { has: pB.getByRole('heading', { name: 'Camiseta de juego', exact: true }) }).getByLabel('Talla').selectOption('L');
  await pB.getByText('Ese dorsal ya está cogido.').waitFor({ timeout: 5000 });
  const cuerpoB = await pB.textContent('body');
  ok(!/Manu|Calahorro|MANU/.test(cuerpoB), 'avisa "Ese dorsal ya esta cogido" SIN decir de quien');
  await captura(pB, '05-dorsal-cogido');
  r = await rpc('guardar_pedido', { p_token: B.token, p_pedido: { campana_id: campana.id, para: 'yo', nombre_completo: 'Sergi Jorba', nombre_ropa: 'SERGI', dorsal: 7, tallas: { camiseta: 'L' } } });
  ok(r.datos?.ok === false && r.datos?.error === 'dorsal_cogido' && !JSON.stringify(r.datos).includes('MANU'), 'la base de datos tambien lo rechaza, sin nombres', JSON.stringify(r.datos));
  r = await rpc('dorsal_cogido', { p_token: 'f'.repeat(64), p_campana: campana.id, p_dorsal: 7 });
  ok(r.status >= 400, 'sin enlace valido no se puede preguntar por dorsales', `status ${r.status}`);
  await pB.getByLabel('Dorsal').fill('8');
  await pB.getByRole('button', { name: 'Enviar pedido' }).click();
  await pB.waitForURL(/guardado=1/);
  ok(true, 'con otro dorsal (8), el pedido de B se envia');

  seccion('Talla invalida y campos obligatorios (API)');
  r = await rpc('guardar_pedido', { p_token: B.token, p_pedido: { campana_id: campana.id, nombre_completo: 'Sergi Jorba', nombre_ropa: 'SERGI', dorsal: 9, tallas: { camiseta: 'XXXL' } } });
  ok(r.datos?.error === 'talla_invalida', 'talla "XXXL" (no existe en VIVE) rechazada', JSON.stringify(r.datos));
  r = await rpc('guardar_pedido', { p_token: B.token, p_pedido: { campana_id: campana.id, nombre_completo: 'Sergi Jorba', nombre_ropa: 'SERGI', dorsal: 9, tallas: { camiseta: '' } } });
  ok(r.datos?.error === 'falta_talla', 'prenda marcada sin talla rechazada', JSON.stringify(r.datos));
  r = await rpc('guardar_pedido', { p_token: B.token, p_pedido: { campana_id: campana.id, nombre_completo: 'Sergi Jorba', nombre_ropa: 'SERGI', dorsal: 100, tallas: { camiseta: 'L' } } });
  ok(r.datos?.error === 'dorsal_invalido', 'dorsal 100 rechazado', JSON.stringify(r.datos));

  seccion('Un jugador no puede ver ni tocar lo de otro');
  const zonaB = (await rpc('zona_jugador', { p_token: B.token })).datos;
  ok(zonaB.pedidos.length === 1 && zonaB.pedidos.every((p) => p.id !== pedA.id), 'la zona de B solo trae SU pedido');
  await pB.goto(`${APP}/j/${B.token}`);
  ok(!(await pB.textContent('body')).includes('MANU'), 'la pagina de B no muestra el pedido de A');
  await pB.goto(`${APP}/j/${B.token}/ropa/${pedA.id}`);
  ok(await pB.getByText('No encontramos ese pedido entre los tuyos.').isVisible(), 'B no puede abrir el pedido de A ni sabiendo su identificador');
  r = await rpc('guardar_pedido', { p_token: B.token, p_pedido: { id: pedA.id, campana_id: campana.id, nombre_completo: 'Pirata', nombre_ropa: 'PIRATA', dorsal: 50, tallas: { camiseta: 'S' } } });
  ok(r.datos?.error === 'no_encontrado', 'B no puede modificar el pedido de A (RPC con su id)', JSON.stringify(r.datos));
  r = await rpc('anular_pedido', { p_token: B.token, p_pedido: pedA.id });
  ok(r.datos?.error === 'no_encontrado', 'B no puede anular el pedido de A', JSON.stringify(r.datos));
  const [pedA2] = await sql`select nombre_ropa, dorsal from public.pedidos_ropa where id = ${pedA.id}`;
  ok(pedA2?.nombre_ropa === 'MANU' && pedA2.dorsal === 7, 'el pedido de A sigue intacto');

  seccion('Modificar un pedido');
  await pA.goto(`${APP}/j/${A.token}`);
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
  await pA.getByLabel('Dorsal').fill('7'); // el mismo que el suyo: en un familiar el dorsal es libre (D59)
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

  seccion('Enlace anulado y regenerado (gestor)');
  await pG.goto(`${APP}/gestion/jugadores`);
  const filaC = pG.locator(`li[data-person="esteban-jon"]`);
  pG.once('dialog', (d) => d.accept());
  await filaC.getByRole('button', { name: 'Anular' }).click();
  await filaC.getByText('Sin enlace').waitFor();
  await pAnon.goto(`${APP}/j/${C.token}`);
  ok(await pAnon.getByRole('heading', { name: 'Enlace no válido' }).isVisible(), 'enlace anulado: "Enlace no valido"');
  pG.once('dialog', (d) => d.accept());
  await filaC.getByRole('button', { name: 'Crear enlace' }).click();
  await filaC.getByText('Enlace activo').waitFor();
  const [nuevoC] = await sql`select token from public.enlaces where jugador_id = ${C.id} and anulado_en is null`;
  ok(nuevoC && nuevoC.token !== C.token, 'el gestor crea un enlace nuevo, distinto del anulado');
  await pAnon.goto(`${APP}/j/${nuevoC.token}`);
  ok(await pAnon.getByRole('heading', { name: 'Hola, Jon' }).isVisible(), 'el enlace nuevo funciona');
  await pAnon.goto(`${APP}/j/${C.token}`);
  ok(await pAnon.getByRole('heading', { name: 'Enlace no válido' }).isVisible(), 'el enlace viejo sigue sin funcionar');
  const filaA = pG.locator(`li[data-person="calahorro-sanchez-manuel"]`);
  await filaA.getByText('Editar datos').click();
  await filaA.getByLabel('Teléfono (opcional, solo gestores)').fill('600 111 222');
  await filaA.getByRole('button', { name: 'Guardar datos' }).click();
  await filaA.getByText('Guardado.').waitFor();
  await pG.reload();
  const wa = await pG.locator(`li[data-person="calahorro-sanchez-manuel"] a`, { hasText: 'Enviar por WhatsApp' }).getAttribute('href');
  ok(wa?.startsWith('https://wa.me/34600111222?text=') && decodeURIComponent(wa).includes(`/j/${A.token}`), 'con telefono guardado aparece el enlace wa.me con su mensaje y su enlace');
  await ctxG.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: APP });
  await pG.locator(`li[data-person="calahorro-sanchez-manuel"]`).getByRole('button', { name: 'Copiar mensaje' }).click();
  const copiado = await pG.evaluate(() => navigator.clipboard.readText());
  ok(copiado.includes('Hola, Manu') && copiado.includes(`/j/${A.token}`) && copiado.includes('No lo reenvíes'), '"Copiar mensaje" copia el texto de bienvenida con su enlace');
  await captura(pG, '07-gestion-jugadores');

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
  r = await rpc('guardar_pedido', { p_token: B.token, p_pedido: { campana_id: campana.id, nombre_completo: 'Sergi Jorba', nombre_ropa: 'SERGI', dorsal: 30, tallas: { sudadera: 'M' } } });
  ok(r.datos?.error === 'campana_cerrada', 'con la campana cerrada se rechaza un pedido nuevo', JSON.stringify(r.datos));
  r = await rpc('guardar_pedido', { p_token: A.token, p_pedido: { id: pedA.id, nombre_completo: 'Manuel Calahorro Sánchez', nombre_ropa: 'MANU', dorsal: 7, tallas: { camiseta: 'S' } } });
  ok(r.datos?.error === 'campana_cerrada', 'con la campana cerrada no se puede modificar', JSON.stringify(r.datos));
  r = await rpc('anular_pedido', { p_token: A.token, p_pedido: pedA.id });
  ok(r.datos?.error === 'campana_cerrada', 'con la campana cerrada no se puede anular', JSON.stringify(r.datos));
  await pA.goto(`${APP}/j/${A.token}`);
  ok(await pA.getByText('Cerrado', { exact: true }).isVisible() && (await pA.getByRole('link', { name: /Hacer/ }).count()) === 0 && (await pA.getByRole('link', { name: 'Modificar' }).count()) === 0,
    'el jugador ve "Cerrado", sin boton de pedir ni de modificar');
  await pA.goto(`${APP}/j/${A.token}/ropa/nuevo`);
  ok(await pA.getByText('El pedido de ropa está cerrado').isVisible(), 'el formulario de pedido dice que esta cerrado');
  // Plazo vencido con la campana "abierta": tambien rechaza.
  await sql`update public.campanas_ropa set estado = 'abierta', fecha_limite = now() - interval '1 minute' where id = ${campana.id}`;
  r = await rpc('guardar_pedido', { p_token: B.token, p_pedido: { campana_id: campana.id, nombre_completo: 'Sergi Jorba', nombre_ropa: 'SERGI', dorsal: 30, tallas: { sudadera: 'M' } } });
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
