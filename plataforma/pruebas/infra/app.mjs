// La web compilada de verdad para las pruebas (D150): `next build` solo si cambia algo que entra en la compilacion, la app
// en el puerto del carril (comprobado libre antes) y un solo Chrome compartido por todas las suites de una tanda.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { lanzar, matarArbol, olvidarProceso } from './procesos.mjs';
import { exigirLibres } from './puertos.mjs';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const NEXT = path.join(RAIZ, 'node_modules', 'next', 'dist', 'bin', 'next');
const HUELLA = path.join(RAIZ, '.next', 'huella-pruebas.json');

/** Huella de todo lo que entra en `next build`: el contenido de src/, public/ y la configuracion, y el entorno. */
function huella(env) {
  const h = crypto.createHash('sha256');
  const recorrer = (rel) => {
    const abs = path.join(RAIZ, rel);
    if (!fs.existsSync(abs)) return;
    if (fs.statSync(abs).isDirectory()) { for (const n of fs.readdirSync(abs).sort()) recorrer(path.join(rel, n)); return; }
    h.update(rel.replace(/\\/g, '/')).update('\0').update(fs.readFileSync(abs)).update('\0');
  };
  for (const r of ['src', 'public', 'next.config.ts', 'tsconfig.json', 'package-lock.json', '.env', '.env.local', '.env.production', '.env.production.local']) recorrer(r);
  // El entorno que ve la compilacion: todo NEXT_PUBLIC_* y lo que pase la suite (envExtra), mas el SO y la version de Node.
  const relevante = Object.entries(env).filter(([k]) => k.startsWith('NEXT_PUBLIC_') || env.__CLAVES_EXTRA?.includes(k)).sort();
  h.update(JSON.stringify(relevante)).update(process.platform).update(process.version);
  return h.digest('hex');
}

/** `next build` con el entorno dado, salvo que .next/ ya sea exactamente esa compilacion. Devuelve true si compilo. */
export function compilar(env, clavesExtra = []) {
  const clave = huella({ ...env, __CLAVES_EXTRA: clavesExtra });
  try {
    if (JSON.parse(fs.readFileSync(HUELLA, 'utf8')).clave === clave && fs.existsSync(path.join(RAIZ, '.next', 'BUILD_ID'))) return false;
  } catch { /* sin huella: se compila */ }
  fs.rmSync(HUELLA, { force: true });
  execFileSync(process.execPath, [NEXT, 'build'], { cwd: RAIZ, env, stdio: process.env.PRUEBAS_VER_BUILD ? 'inherit' : 'ignore' });
  fs.writeFileSync(HUELLA, JSON.stringify({ clave, cuando: new Date().toISOString() }));
  return true;
}

export async function esperar(url, ms = 90000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) { try { const r = await fetch(url); if (r.status < 500) return; } catch {} await new Promise((r) => setTimeout(r, 200)); }
  throw new Error(`${url} no arranca`);
}

/** Compila (si hace falta) y arranca la app en `puerto`. Devuelve { APP, parar }. */
export async function arrancarApp({ puerto, env, envExtra = {}, compilarAntes = true }) {
  await exigirLibres({ app: puerto });
  const entorno = { ...process.env, NEXT_TELEMETRY_DISABLED: '1', ...env, ...envExtra };
  // Lo que pone la suite (y no viene del entorno de fuera) entra en la huella: con otro valor, otra compilacion.
  if (compilarAntes) compilar(entorno, Object.keys(entorno).filter((k) => entorno[k] !== process.env[k]));
  const hijo = lanzar(process.execPath, [NEXT, 'start', '-p', String(puerto), '-H', '127.0.0.1'], { cwd: RAIZ, env: entorno, stdio: 'ignore' });
  const APP = `http://127.0.0.1:${puerto}`;
  await esperar(APP);
  return { APP, hijo, parar: () => { matarArbol(hijo.pid); olvidarProceso(hijo.pid); } };
}

/** Chrome: el de la tanda si el corredor lo comparte (PRUEBAS_NAVEGADOR_WS), si no uno propio. close() solo suelta el compartido. */
export async function abrirNavegador() {
  let nav = null;
  if (process.env.PRUEBAS_NAVEGADOR_WS) {
    try { nav = await chromium.connect(process.env.PRUEBAS_NAVEGADOR_WS); } catch { /* no esta: uno propio */ }
  }
  nav ??= await chromium.launch({ channel: 'chrome', headless: true });
  if (!conCapturas()) await sinCapturas(nav);
  return nav;
}

/** Sin capturas, screenshot() de paginas, localizadores y elementos no hace nada (las suites las piden en muchos sitios;
 *  ninguna comprobacion depende de ellas). */
async function sinCapturas(nav) {
  const ctx = await nav.newContext();
  const p = await ctx.newPage();
  const el = await p.evaluateHandle(() => document.body);
  for (const o of [p, p.locator('body'), el]) Object.getPrototypeOf(o).screenshot = async () => Buffer.alloc(0);
  await ctx.close();
}

/** Capturas de pantalla: en las tandas (rapidas/completas) y en GitHub Actions no se hacen (PRUEBAS_CAPTURAS=0). */
export const conCapturas = () => process.env.PRUEBAS_CAPTURAS !== '0' && !process.env.CI;
