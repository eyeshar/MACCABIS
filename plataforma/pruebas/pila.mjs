#!/usr/bin/env node
// Pila LOCAL de pruebas que imita a Supabase, sin Docker:
//   - Postgres 17 real (embedded-postgres) con la emulacion minima de Supabase
//     (roles anon/authenticated, auth.uid()) y NUESTRAS migraciones reales.
//   - PostgREST real (el mismo motor de la API de Supabase) delante.
//   - Un doble de pruebas de Supabase Auth (GoTrue) con lo justo para el login
//     por correo y contrasena de los gestores.
//   - Una pasarela en :54321 que enruta /rest/v1 y /auth/v1 como Supabase.
// La base se crea de cero en cada arranque, en una carpeta temporal.
//
//   node pruebas/pila.mjs     arranca la pila y la deja encendida (Ctrl+C para parar)

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import postgres from 'postgres';
import { SignJWT, jwtVerify } from 'jose';
import { migrar, semilla } from '../scripts/db.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.join(AQUI, '.bin');
const POSTGREST_VERSION = 'v12.2.12';
export const PUERTOS = { pg: 54329, rest: 54330, pasarela: 54321 };
export const JWT_SECRET = 'secreto-solo-para-pruebas-locales-de-maccabis-000000';
const clave = new TextEncoder().encode(JWT_SECRET);

export async function firmar(claims, segundos = 3600) {
  return new SignJWT(claims).setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt().setExpirationTime(Math.floor(Date.now() / 1000) + segundos).sign(clave);
}

function descargarPostgrest() {
  const exe = path.join(BIN, 'postgrest.exe');
  if (fs.existsSync(exe)) return exe;
  fs.mkdirSync(BIN, { recursive: true });
  const zip = path.join(BIN, 'postgrest.zip');
  const url = `https://github.com/PostgREST/postgrest/releases/download/${POSTGREST_VERSION}/postgrest-${POSTGREST_VERSION}-windows-x86-64.zip`;
  execFileSync('curl', ['-sSL', '-o', zip, url]);
  execFileSync(path.join(process.env.SystemRoot || 'C:/Windows', 'System32', 'tar.exe'), ['-xf', zip, '-C', BIN]);
  fs.rmSync(zip);
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

export async function arrancar({ log = () => {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maccabis-pg-'));
  const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'postgres', port: PUERTOS.pg, persistent: false, onLog: () => {}, onError: () => {} });
  await pg.initialise();
  await pg.start();
  const url = `postgres://postgres:postgres@127.0.0.1:${PUERTOS.pg}/postgres`;
  const sql = postgres(url, { onnotice: () => {}, max: 2 });
  await sql.unsafe(fs.readFileSync(path.join(AQUI, 'supabase_local.sql'), 'utf8'));
  await migrar(sql, { log });
  await semilla(sql, { log });

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
  const rest = spawn(exe, [conf], { stdio: 'ignore', env: { ...process.env, PATH: `${binPg}${path.delimiter}${process.env.PATH}` } });
  await esperarPuerto(PUERTOS.rest);

  const anonKey = await firmar({ role: 'anon', iss: 'supabase-local' }, 3600 * 24 * 365);

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
        prox.on('error', e => { res.writeHead(502); res.end(String(e)); });
        req.pipe(prox);
        return;
      }
      res.writeHead(404); res.end();
    } catch (e) {
      res.writeHead(500); res.end(String(e));
    }
  });
  await new Promise(ok => pasarela.listen(PUERTOS.pasarela, '127.0.0.1', ok));

  async function crearUsuario(email, password) {
    const [u] = await sql`insert into auth.users (email, encrypted_password) values (${email}, ${hash(password)}) returning id`;
    return u.id;
  }

  async function parar() {
    pasarela.close();
    rest.kill();
    await sql.end();
    await pg.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }

  return { sql, url: `http://127.0.0.1:${PUERTOS.pasarela}`, anonKey, crearUsuario, parar, firmar };
}

// Modo manual: arranca y deja la pila encendida para `npm run dev`.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pila = await arrancar({ log: console.log });
  const email = 'gestor@pruebas.local';
  const id = await pila.crearUsuario(email, 'pruebas-1234');
  await pila.sql`insert into public.gestores (user_id, nombre) values (${id}, 'Gestor de pruebas')`;
  const enlaces = await pila.sql`select j.nombre_visible, e.token from public.enlaces e join public.jugadores j on j.id = e.jugador_id where e.anulado_en is null order by j.nombre_visible limit 3`;
  console.log(`\nPila local lista en ${pila.url}`);
  console.log(`NEXT_PUBLIC_SUPABASE_URL=${pila.url}`);
  console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${pila.anonKey}`);
  console.log(`Gestor de pruebas: ${email} / pruebas-1234`);
  for (const e of enlaces) console.log(`  /j/${e.token}  (${e.nombre_visible})`);
  const salir = async () => { await pila.parar(); process.exit(0); };
  process.on('SIGINT', salir);
  process.on('SIGTERM', salir);
}
