#!/usr/bin/env node
// Pila LOCAL de pruebas que imita a Supabase, sin Docker:
//   - Postgres 17 real (embedded-postgres) con la emulacion minima de Supabase
//     (roles anon/authenticated, auth.uid()) y NUESTRAS migraciones reales.
//   - PostgREST real (el mismo motor de la API de Supabase) delante.
//   - Un doble de pruebas de Supabase Auth (GoTrue) con lo justo para el login
//     por correo y contrasena de los gestores.
//   - Una pasarela que enruta /rest/v1 y /auth/v1 como Supabase.
// La base se crea de cero en cada arranque, en pruebas/resultados/pg/ (fuera de git). Puertos: los del carril de este
// worktree (infra/puertos.mjs, D149); si alguno esta ocupado, para sin arrancar. Al terminar (bien, mal, Ctrl+C o
// matada de golpe) no queda nada encendido ni la carpeta de la base (infra/procesos.mjs).
//
//   node pruebas/pila.mjs     arranca la pila y la deja encendida (Ctrl+C para parar)

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import postgres from 'postgres';
import { SignJWT, jwtVerify } from 'jose';
import { migrar, semilla } from '../scripts/db.mjs';
import { PUERTOS as P, exigirLibres } from './infra/puertos.mjs';
import { lanzar, apuntarProceso, apuntarCarpeta, olvidarCarpeta, apuntarPostgres, olvidarPostgres, matarArbol, conVentanasOcultas } from './infra/procesos.mjs';
import { pararPostgres, barrerPostgres } from './infra/matar.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.join(AQUI, '.bin');
const POSTGREST_VERSION = 'v12.2.12';
export const PUERTOS = { pg: P.pg, rest: P.rest, pasarela: P.pasarela };
export const JWT_SECRET = 'secreto-solo-para-pruebas-locales-de-maccabis-000000';
const clave = new TextEncoder().encode(JWT_SECRET);

export async function firmar(claims, segundos = 3600) {
  return new SignJWT(claims).setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt().setExpirationTime(Math.floor(Date.now() / 1000) + segundos).sign(clave);
}

/** PostgREST en pruebas/.bin/ (se descarga la primera vez). Atomico: varias suites a la vez no se pisan. */
export function descargarPostgrest() {
  const win = process.platform === 'win32';
  const exe = path.join(BIN, win ? 'postgrest.exe' : 'postgrest');
  if (fs.existsSync(exe)) return exe;
  fs.mkdirSync(BIN, { recursive: true });
  // Windows en local; Linux en GitHub Actions (binario estatico, no necesita libpq).
  const fichero = win ? `postgrest-${POSTGREST_VERSION}-windows-x86-64.zip` : `postgrest-${POSTGREST_VERSION}-linux-static-x86-64.tar.xz`;
  const tmp = fs.mkdtempSync(path.join(BIN, 'descarga-'));
  try {
    const comprimido = path.join(tmp, fichero);
    execFileSync('curl', ['-sSfL', '-o', comprimido, `https://github.com/PostgREST/postgrest/releases/download/${POSTGREST_VERSION}/${fichero}`], { windowsHide: true });
    execFileSync(win ? path.join(process.env.SystemRoot || 'C:/Windows', 'System32', 'tar.exe') : 'tar', [win ? '-xf' : '-xJf', comprimido, '-C', tmp], { windowsHide: true });
    try { fs.renameSync(path.join(tmp, path.basename(exe)), exe); } catch (e) { if (!fs.existsSync(exe)) throw e; }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  return exe;
}

function esperarPuerto(puerto, ms = 30000) {
  const fin = Date.now() + ms;
  return new Promise((ok, mal) => {
    const intento = () => {
      const req = http.get({ host: '127.0.0.1', port: puerto, path: '/' }, r => {
        r.resume();
        // PostgREST responde 503 mientras carga la cache del esquema.
        if (r.statusCode === 503 && Date.now() < fin) setTimeout(intento, 250); else ok();
      });
      req.on('error', () => (Date.now() > fin ? mal(new Error(`puerto ${puerto} no responde`)) : setTimeout(intento, 250)));
    };
    intento();
  });
}

const leerCuerpo = req => new Promise(ok => { let b = ''; req.on('data', c => (b += c)); req.on('end', () => ok(b)); });
const hash = s => crypto.createHash('sha256').update(s).digest('hex');

// Clave anonima fija (mismas fechas siempre): la web compilada contra la pila sale identica entre suites y entre tandas,
// y se reutiliza la compilacion (infra/app.mjs). Solo vale contra esta pila local, con el secreto de pruebas.
const ANON_KEY_FIJA = new SignJWT({ role: 'anon', iss: 'supabase-local' }).setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
  .setIssuedAt(1767225600).setExpirationTime(4102444800).sign(clave);

/** El entorno con el que se compila la web contra la pila de este carril. Sirve tambien a las suites que no necesitan
 *  base (cuadre, privacidad): misma compilacion que las demas, sin volver a compilar. */
export const entornoPila = async () => ({ NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${PUERTOS.pasarela}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: await ANON_KEY_FIJA });

export async function arrancar({ log = () => {} } = {}) {
  // y el de la app del carril, para que una suite web se pare al momento y no tras levantar la pila
  await exigirLibres({ 'pila: pasarela': PUERTOS.pasarela, 'pila: postgres': PUERTOS.pg, 'pila: postgrest': PUERTOS.rest, app: P.app });
  // La cache de datos de Next (unstable_cache: la fuente del calendario) sobrevive entre compilaciones: lo guardado por
  // la suite anterior (otra base, con otras fechas) saldria en esta. Cada pila es una base nueva: se vacia.
  fs.rmSync(path.join(AQUI, '..', '.next', 'cache', 'fetch-cache'), { recursive: true, force: true });
  const RES = path.join(AQUI, 'resultados', 'pg');
  fs.mkdirSync(RES, { recursive: true });
  const dir = apuntarPostgres(apuntarCarpeta(fs.mkdtempSync(path.join(RES, `c${process.env.PRUEBAS_CARRIL || 0}-`))));
  const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'postgres', port: PUERTOS.pg, persistent: false, onLog: () => {}, onError: () => {} });
  // Su stop (tambien el de su async-exit-hook al salir) mata el postmaster con taskkill /F: en Windows puede dejar un
  // hijo suspendido con el puerto y la carpeta (infra/matar.mjs). Lo para siempre infra/procesos.mjs con pg_ctl.
  pg.stop = async () => {};
  // embedded-postgres lanza initdb y postgres sin windowsHide: sin consola delante, cada uno abria una ventana.
  await conVentanasOcultas(() => pg.initialise());
  await conVentanasOcultas(() => pg.start());
  apuntarProceso(pg.process);
  const url = `postgres://postgres:postgres@127.0.0.1:${PUERTOS.pg}/postgres`;
  const sql = postgres(url, { onnotice: () => {}, max: 2 });
  await sql.unsafe(fs.readFileSync(path.join(AQUI, 'supabase_local.sql'), 'utf8'));
  await migrar(sql, { log });
  await semilla(sql, { log });
  // Tabla SOLO de pruebas (no va en ninguna migracion): guarda los codigos de
  // un solo uso que "manda" el doble de /otp, para que el test los lea.
  await sql`create table if not exists public._otp_pruebas (email text primary key, codigo text not null, expira timestamptz not null)`;
  // Idem para los ENLACES del correo (token_hash, D157): un solo uso, como en GoTrue.
  await sql`create table if not exists public._enlaces_pruebas (token_hash text primary key, email text not null, expira timestamptz not null)`;

  const exe = descargarPostgrest();
  const conf = path.join(dir, 'postgrest.conf');
  fs.writeFileSync(conf, [
    `db-uri = "postgres://authenticator:pruebas@127.0.0.1:${PUERTOS.pg}/postgres"`,
    'db-schemas = "public"',
    'db-anon-role = "anon"',
    `jwt-secret = "${JWT_SECRET}"`,
    `server-port = ${PUERTOS.rest}`,
    'server-host = "127.0.0.1"',
    'db-pool = 5',
  ].join('\n'));
  // PostgREST para Windows necesita libpq.dll: la trae el propio Postgres embebido.
  const binPg = path.join(AQUI, '..', 'node_modules', '@embedded-postgres', 'windows-x64', 'native', 'bin');
  const rest = lanzar(exe, [conf], { stdio: 'ignore', env: { ...process.env, PATH: `${binPg}${path.delimiter}${process.env.PATH}` } });
  await esperarPuerto(PUERTOS.rest);

  const anonKey = await ANON_KEY_FIJA;

  // --- Doble de Supabase Auth (solo lo que usa la app) ---
  async function sesionPara(u) {
    const access_token = await firmar({ sub: u.id, email: u.email, role: 'authenticated', aud: 'authenticated', session_id: crypto.randomUUID() });
    const user = { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: u.created_at };
    return { access_token, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: `r-${u.id}-${crypto.randomUUID()}`, user };
  }
  async function usuarioDeBearer(req) {
    const t = (req.headers.authorization || '').replace(/^Bearer /, '');
    try {
      const { payload } = await jwtVerify(t, clave);
      if (payload.role !== 'authenticated') return null;
      const [u] = await sql`select id, email, created_at from auth.users where id = ${payload.sub}`;
      return u || null;
    } catch { return null; }
  }
  async function auth(req, res, ruta) {
    const json = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
    const u = new URL(ruta, 'http://x');
    if (req.method === 'POST' && u.pathname === '/token') {
      const body = JSON.parse((await leerCuerpo(req)) || '{}');
      const tipo = u.searchParams.get('grant_type');
      if (tipo === 'password') {
        const [usr] = await sql`select id, email, created_at from auth.users where lower(email) = lower(${body.email || ''}) and encrypted_password = ${hash(body.password || '')}`;
        if (usr) await sql`update auth.users set last_sign_in_at = now() where id = ${usr.id}`;
        if (!usr) return json(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
        return json(200, await sesionPara(usr));
      }
      if (tipo === 'refresh_token') {
        const id = String(body.refresh_token || '').split('-').slice(1, 6).join('-');
        const [usr] = await sql`select id, email, created_at from auth.users where id::text = ${id}`;
        if (!usr) return json(400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
        return json(200, await sesionPara(usr));
      }
      return json(400, { msg: 'grant no soportado en la pila local' });
    }
    // Doble de "Entrar con codigo por correo" (signInWithOtp / verifyOtp).
    // La lista blanca la aplica aqui mismo, llamando a la MISMA funcion SQL
    // (public.correo_permitido) que en el proyecto real aplica el hook
    // "Before User Created" de GoTrue: es la pieza que se esta probando.
    if (req.method === 'POST' && u.pathname === '/otp') {
      const body = JSON.parse((await leerCuerpo(req)) || '{}');
      const email = String(body.email || '').toLowerCase();
      const [{ permitido }] = await sql`select public.correo_permitido(${email}) as permitido`;
      if (!permitido) return json(400, { code: 400, error_code: 'signup_disabled', msg: 'Signups not allowed for this instance' });
      const codigo = String(Math.floor(100000 + Math.random() * 900000));
      await sql`insert into public._otp_pruebas (email, codigo, expira) values (${email}, ${codigo}, now() + interval '10 minutes')
                on conflict (email) do update set codigo = excluded.codigo, expira = excluded.expira`;
      return json(200, {});
    }
    if (req.method === 'POST' && u.pathname === '/verify') {
      const body = JSON.parse((await leerCuerpo(req)) || '{}');
      if (body.token_hash) {
        // verifyOtp({ type, token_hash }): el enlace del correo. Se gasta al canjearlo (solo el POST de la app lo canjea).
        const [enl] = await sql`delete from public._enlaces_pruebas where token_hash = ${String(body.token_hash)} returning email, expira`;
        if (!enl || new Date(enl.expira) < new Date()) return json(403, { code: 403, error_code: 'otp_expired', msg: 'Email link is invalid or has expired' });
        let [usr] = await sql`select id, email, created_at from auth.users where lower(email) = ${enl.email}`;
        if (!usr) [usr] = await sql`insert into auth.users (email) values (${enl.email}) returning id, email, created_at`;
        await sql`update auth.users set last_sign_in_at = now() where id = ${usr.id}`;
        return json(200, await sesionPara(usr));
      }
      const email = String(body.email || '').toLowerCase();
      const [fila] = await sql`select codigo, expira from public._otp_pruebas where email = ${email}`;
      if (!fila || fila.codigo !== String(body.token || '') || new Date(fila.expira) < new Date()) {
        return json(403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
      }
      await sql`delete from public._otp_pruebas where email = ${email}`;
      let [usr] = await sql`select id, email, created_at from auth.users where lower(email) = ${email}`;
      if (!usr) {
        // El INSERT real dispara los triggers de la migracion (p. ej. vincular
        // gestor por correo), igual que en el proyecto real.
        [usr] = await sql`insert into auth.users (email) values (${email}) returning id, email, created_at`;
      }
      await sql`update auth.users set last_sign_in_at = now() where id = ${usr.id}`;   // como GoTrue: entrar de verdad lo anota (D140)
      return json(200, await sesionPara(usr));
    }
    if (u.pathname === '/user') {
      const usr = await usuarioDeBearer(req);
      if (!usr) return json(401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' });
      if (req.method === 'PUT') {
        const body = JSON.parse((await leerCuerpo(req)) || '{}');
        if (body.password) await sql`update auth.users set encrypted_password = ${hash(body.password)} where id = ${usr.id}`;
      }
      return json(200, { id: usr.id, aud: 'authenticated', role: 'authenticated', email: usr.email, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: usr.created_at });
    }
    if (u.pathname === '/logout') { res.writeHead(204); return res.end(); }
    if (u.pathname === '/recover') return json(200, {});
    return json(404, { msg: `ruta de auth no emulada: ${u.pathname}` });
  }

  // --- Pasarela tipo Supabase ---
  const pasarela = http.createServer(async (req, res) => {
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' });
        return res.end();
      }
      if (req.url.startsWith('/auth/v1')) return await auth(req, res, req.url.slice('/auth/v1'.length) || '/');
      if (req.url.startsWith('/rest/v1')) {
        const headers = { ...req.headers };
        delete headers.host;
        if (!headers.authorization && headers.apikey) headers.authorization = `Bearer ${headers.apikey}`;
        const prox = http.request({ host: '127.0.0.1', port: PUERTOS.rest, method: req.method, path: req.url.slice('/rest/v1'.length) || '/', headers }, r => {
          res.writeHead(r.statusCode, r.headers);
          r.pipe(res);
        });
        prox.on('error', e => { if (res.headersSent) { res.destroy(); return; } res.writeHead(502); res.end(String(e)); }); // un cliente que corta (timeout) no debe tumbar la pila
        res.on('close', () => { if (!res.writableFinished) prox.destroy(); }); // solo si el cliente se va antes de tener la respuesta
        req.pipe(prox);
        return;
      }
      res.writeHead(404); res.end();
    } catch (e) {
      res.writeHead(500); res.end(String(e));
    }
  });
  await new Promise(ok => pasarela.listen(PUERTOS.pasarela, '127.0.0.1', ok));

  // Por defecto el usuario HA ENTRADO (last_sign_in_at puesto, como tras un acceso real); `{ sinEntrar: true }` es una cuenta creada
  // por pedir un codigo que nunca se uso (D140).
  async function crearUsuario(email, password, { sinEntrar = false } = {}) {
    const [u] = await sql`insert into auth.users (email, encrypted_password, last_sign_in_at) values (${email}, ${hash(password)}, ${sinEntrar ? null : new Date()}) returning id`;
    return u.id;
  }

  async function parar() {
    pasarela.close();
    matarArbol(rest.pid);
    await sql.end();
    if (!pararPostgres(dir)) { matarArbol(pg.process?.pid); barrerPostgres(); }
    olvidarPostgres(dir);
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
    olvidarCarpeta(dir);
  }

  return { sql, url: (await entornoPila()).NEXT_PUBLIC_SUPABASE_URL, anonKey, crearUsuario, parar, firmar };
}

// Modo manual: arranca y deja la pila encendida para `npm run dev`.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pila = await arrancar({ log: console.log });
  const email = 'gestor@pruebas.local';
  const id = await pila.crearUsuario(email, 'pruebas-1234');
  await pila.sql`insert into public.gestores (user_id, nombre, email) values (${id}, 'Gestor de pruebas', ${email})`;
  const jugadores = await pila.sql`update public.jugadores set email = lower(replace(nombre_visible, ' ', '')) || '@pruebas.local'
    where id in (select id from public.jugadores order by nombre_visible limit 3) returning nombre_visible, email`;
  console.log(`\nPila local lista en ${pila.url}`);
  console.log(`NEXT_PUBLIC_SUPABASE_URL=${pila.url}`);
  console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${pila.anonKey}`);
  console.log(`Gestor de pruebas (contraseña, solo en esta pila local): ${email} / pruebas-1234`);
  console.log('Jugadores de prueba (entran por /entrar con "código por correo"; la pila no manda el correo de verdad: el código queda en public._otp_pruebas):');
  for (const j of jugadores) console.log(`  ${j.nombre_visible}: ${j.email}`);
  const salir = async () => { await pila.parar(); process.exit(0); };
  process.on('SIGINT', salir);
  process.on('SIGTERM', salir);
}
