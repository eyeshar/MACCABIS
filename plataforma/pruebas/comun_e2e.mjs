// Piezas comunes de las pruebas de extremo a extremo del bloque «Inicio personal y planes» (D116-D121): la pila local,
// la web compilada de verdad con el entorno que se pida, Chrome y las ayudas de siempre (entrar con codigo, sin
// desbordamiento, capturas). Cada suite sigue siendo independiente (npm run pruebas:<suite>).
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { arrancar } from './pila.mjs';
import { cargarEventos } from '../scripts/cargar_eventos.mjs';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO = path.join(RAIZ, '..');
export const CAPTURAS = path.join(REPO, 'privado', 'mockups_liga', 'inicio-y-planes');
fs.mkdirSync(CAPTURAS, { recursive: true });

export function contador() {
  let fallos = 0;
  const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };
  return { ok, fallos: () => fallos, sumar: () => { fallos++; } };
}

export async function esperar(url, ms = 90000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) { try { const r = await fetch(url); if (r.status < 500) return; } catch {} await new Promise((r) => setTimeout(r, 300)); }
  throw new Error(`${url} no arranca`);
}

/** Pila + eventos de la temporada + (opcional) web compilada en `puerto` con `envExtra`. */
export async function preparar({ puerto, envExtra = {}, compilar = true } = {}) {
  const pila = await arrancar();
  await cargarEventos(pila.sql, { log: () => {} });
  const APP = `http://127.0.0.1:${puerto}`;
  let app = null;
  if (compilar) {
    const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: pila.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: pila.anonKey, NEXT_TELEMETRY_DISABLED: '1', ...envExtra };
    const next = path.join(RAIZ, 'node_modules', 'next', 'dist', 'bin', 'next');
    execFileSync(process.execPath, [next, 'build'], { cwd: RAIZ, env, stdio: 'ignore' });
    app = spawn(process.execPath, [next, 'start', '-p', String(puerto), '-H', '127.0.0.1'], { cwd: RAIZ, env, stdio: 'ignore' });
    await esperar(APP);
  }
  const nav = compilar ? await chromium.launch({ channel: 'chrome', headless: true }) : null;
  const codigoDe = async (email) => (await pila.sql`select codigo from public._otp_pruebas where email = ${email}`)[0]?.codigo;
  const errores = [];
  const nuevaPagina = async (ctx) => {
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errores.push(`${p.url()} ${e.message}`));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) errores.push(`${p.url()} ${m.text()}`); });
    return p;
  };
  const contexto = (ancho, alto = 900) => nav.newContext({ viewport: { width: ancho, height: ancho < 600 ? 812 : alto }, isMobile: ancho < 600, hasTouch: ancho < 600, deviceScaleFactor: ancho < 600 ? 2 : 1, locale: 'es-ES' });
  async function entrar(p, email) {
    await p.goto(`${APP}/entrar`);
    await p.getByLabel('Tu correo').fill(email);
    await p.getByRole('button', { name: 'Enviarme el código' }).click();
    await p.getByText('Código enviado a').waitFor({ timeout: 10000 });
    await p.getByLabel('Código de 6 dígitos').fill((await codigoDe(email)) ?? '000000');
    await p.getByRole('button', { name: 'Entrar', exact: true }).click();
    await p.waitForURL((u) => !u.pathname.startsWith('/entrar') || u.pathname.startsWith('/entrar/elegir'), { timeout: 15000 });
  }
  /** Una persona con sesion en un tamaño: su pagina ya dentro. */
  async function sesion(email, ancho) {
    const ctx = await contexto(ancho);
    const p = await nuevaPagina(ctx);
    await entrar(p, email);
    return p;
  }
  const parar = async () => { await nav?.close().catch(() => {}); app?.kill(); await pila.parar(); };
  return { pila, sql: pila.sql, APP, nav, errores, nuevaPagina, contexto, entrar, sesion, parar };
}

/** Jugadores SINTETICOS (person_id «sint-…»): los datos privados de las pruebas (posicion, nivel) van siempre en ellos,
 *  nunca en un jugador real (D39: ni en git ni de mentira). [person_id, mote, ficha_mda, ficha_mdl, rol?] */
export async function sinteticos(sql, lista) {
  for (const [person_id, visible, mda, mdl, rol = 'jugador'] of lista) {
    await sql`insert into public.jugadores (person_id, nombre_oficial, nombre_visible, ficha_mda, ficha_mdl, rol, entrena)
              values (${person_id}, ${`Prueba, ${visible}`}, ${visible}, ${mda}, ${mdl}, ${rol}, true) on conflict (person_id) do nothing`;
  }
}

/** Jugador con correo (y su cuenta) o gestor (con o sin ficha). */
export async function personas(pila, { jugadores = [], gestores = [] }) {
  const sql = pila.sql;
  const out = {};
  for (const [personId, email] of jugadores) {
    await sql`update public.jugadores set email = ${email} where person_id = ${personId}`;
    const uid = await pila.crearUsuario(email, 'x');
    out[personId] = { email, uid, token: await pila.firmar({ sub: uid, role: 'authenticated', email }) };
  }
  for (const [nombre, email, personId] of gestores) {
    if (personId) await sql`update public.jugadores set email = ${email} where person_id = ${personId}`;
    const uid = await pila.crearUsuario(email, 'x');
    await sql`insert into public.gestores (user_id, nombre, email) values (${uid}, ${nombre}, ${email})`;
    out[email] = { email, uid, token: await pila.firmar({ sub: uid, role: 'authenticated', email }) };
  }
  return out;
}

export const visto = async (loc, ms = 8000) => { try { await loc.first().waitFor({ state: 'visible', timeout: ms }); return true; } catch { return false; } };
export const sinDesbordar = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
export const foto = (p, n, completa = true) => p.screenshot({ path: path.join(CAPTURAS, `${n}.png`), fullPage: completa }).catch(() => {});
/** Elementos interactivos visibles de menos de 44 px. */
export const pequenos = (p, sel) => p.evaluate((s) => [...document.querySelectorAll(s)].filter((x) => x.offsetParent && getComputedStyle(x).visibility !== 'hidden').map((x) => { const r = x.getBoundingClientRect(); return { t: (x.textContent || x.getAttribute('aria-label') || '').trim().slice(0, 30), h: Math.round(r.height), w: Math.round(r.width) }; }).filter((x) => x.h < 44 || x.w < 44), sel);
