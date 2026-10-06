#!/usr/bin/env node
// Pantallas de liga de la zona de gestion (D73), de extremo a extremo: pila local (Postgres + PostgREST reales con
// nuestras migraciones), carga de la J1 con `db:liga`, la app Next.js compilada de verdad y Chrome.
//
//   npm run pruebas:pantallas
//
// Comprueba acceso (anonimo y jugador fuera), contenido, movil (<640 px: tarjetas) y escritorio (tabla), que el menu
// no se corte, que no haya desbordamiento horizontal ni errores de JS, y deja capturas en privado/mockups_liga/real_*.png
// (fuera de git: llevan nombres de jugadores de otros equipos).

import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { arrancar } from './pila.mjs';
import { leerLiga, cargarLiga } from '../scripts/cargar_liga.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = path.join(RAIZ, '..', 'privado', 'mockups_liga');
fs.mkdirSync(SALIDA, { recursive: true });
const PUERTO = 3101;
const APP = `http://127.0.0.1:${PUERTO}`;
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };

async function esperar(url, ms = 60000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) { try { const r = await fetch(url); if (r.status < 500) return; } catch {} await new Promise((r) => setTimeout(r, 300)); }
  throw new Error(`${url} no arranca`);
}

const pila = await arrancar();
let app, nav;
try {
  const { sql, url, anonKey } = pila;
  await cargarLiga(sql, leerLiga('2026-27'), '2026-27', { log: () => {} });
  const gestorEmail = 'gestor@pruebas.local', jugadorEmail = 'jugador@pruebas.local';
  const gId = await pila.crearUsuario(gestorEmail, 'no-se-usa');
  await sql`insert into public.gestores (user_id, nombre, email) values (${gId}, 'Gestor de pruebas', ${gestorEmail})`;
  await sql`update public.jugadores set email = ${jugadorEmail} where person_id = 'esteban-jon'`;
  const codigoDe = async (email) => (await sql`select codigo from public._otp_pruebas where email = ${email}`)[0]?.codigo;

  console.log('\n== Compilacion');
  const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey, NEXT_TELEMETRY_DISABLED: '1' };
  const next = path.join(RAIZ, 'node_modules', 'next', 'dist', 'bin', 'next');
  execFileSync(process.execPath, [next, 'build'], { cwd: RAIZ, env, stdio: 'ignore' });
  ok(true, 'next build');
  app = spawn(process.execPath, [next, 'start', '-p', String(PUERTO), '-H', '127.0.0.1'], { cwd: RAIZ, env, stdio: 'ignore' });
  await esperar(APP);
  nav = await chromium.launch({ channel: 'chrome', headless: true });

  async function entrar(p, email) {
    await p.goto(`${APP}/entrar`);
    await p.getByLabel('Recibir código por correo').fill(email);
    await p.getByRole('button', { name: 'Enviarme un código' }).click();
    await p.getByText('Código enviado a').waitFor({ timeout: 10000 });
    await p.getByLabel('Código de 6 dígitos').fill((await codigoDe(email)) ?? '000000');
    await p.getByRole('button', { name: 'Entrar', exact: true }).click();
    await p.waitForURL((u) => !u.pathname.startsWith('/entrar') || u.pathname.startsWith('/entrar/elegir'), { timeout: 15000 });
  }

  console.log('\n== Acceso');
  const ctxA = await nav.newContext({ viewport: { width: 375, height: 800 } });
  const pa = await ctxA.newPage();
  for (const r of ['/gestion/scouting', '/gestion/liga']) {
    await pa.goto(`${APP}${r}`);
    ok(pa.url().includes('/entrar'), `anonimo en ${r}: manda a Entrar`);
  }
  await entrar(pa, jugadorEmail);
  for (const r of ['/gestion/scouting', '/gestion/liga']) {
    await pa.goto(`${APP}${r}`);
    ok(pa.url().includes('/mi-zona'), `un jugador (no gestor) en ${r}: va a su zona`, pa.url());
    ok(!(await pa.textContent('body')).includes('Hernando'), `un jugador no ve ni un nombre de rival en ${r}`);
  }
  await ctxA.close();

  for (const [etiqueta, ancho, alto, movil] of [['375', 375, 800, true], ['escritorio', 1280, 900, false]]) {
    console.log(`\n== Gestor, ${etiqueta}`);
    const ctx = await nav.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: movil ? 2 : 1, isMobile: movil, hasTouch: movil, locale: 'es-ES' });
    const p = await ctx.newPage();
    const errores = [];
    p.on('pageerror', (e) => errores.push(String(e)));
    await entrar(p, gestorEmail);
    if (p.url().includes('/elegir')) await p.goto(`${APP}/gestion`);
    const sinDesbordar = () => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    const menuEntero = () => p.evaluate(() => [...document.querySelectorAll('nav[aria-label="Gestión"] a, nav[aria-label="Gestión"] button')]
      .every((e) => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth + 1; }));

    await p.goto(`${APP}/gestion/scouting`);
    ok((await p.textContent('h2')).includes('Litros de Mahou'), 'scouting: por defecto, el proximo rival del MdA (Litros de Mahou)');
    ok((await p.textContent('.lg-prox')).includes('J2') && (await p.textContent('.lg-prox')).includes('18/10') && (await p.textContent('.lg-prox')).includes('en casa'), 'scouting: proximo partido contra nosotros (J2 · 18/10 · en casa)');
    ok((await p.locator('.lg-max').count()) === 3, 'scouting: 3 maximos anotadores');
    ok(await menuEntero(), 'el menu de gestion no se corta');
    ok(await sinDesbordar(), 'scouting: sin desbordamiento horizontal');
    ok((await p.locator('.lg-tarjetas').isVisible()) === movil && (await p.locator('.lg-tabla').first().isVisible()) === !movil,
      movil ? 'scouting movil: tarjetas por jugador, sin tabla' : 'scouting escritorio: tabla, sin tarjetas');
    if (movil) {
      const t = await p.locator('.lg-tarjetas .lg-jug').first().textContent();
      ok(['PJ', 'Pts', 'Media', '2P', '3P', 'TL', 'Faltas'].every((k) => t.includes(k)) && /#?\d/.test(t), 'tarjeta: dorsal, nombre, PJ, puntos, media, 2P, 3P, TL y faltas');
    }
    await p.screenshot({ path: path.join(SALIDA, `real_b_scouting_${etiqueta}.png`), fullPage: true });
    await p.getByRole('link', { name: /^MdL:/ }).click();
    await p.waitForURL(/v=mdl/);
    ok((await p.textContent('h2')).includes('Quinto Tiempo'), 'scouting: el selector pasa al proximo rival del MdL (Quinto Tiempo)');
    await p.selectOption('select[name="e"]', 'Craps');
    await p.getByRole('button', { name: 'Ver' }).click();
    await p.waitForURL(/e=Craps/);
    ok((await p.textContent('h2')).includes('Craps'), 'scouting: el desplegable abre cualquier equipo (Craps)');
    await p.selectOption('select[name="e"]', 'MdA');
    await p.getByRole('button', { name: 'Ver' }).click();
    await p.waitForURL(/e=MdA/);
    ok((await p.textContent('body')).includes('dobla') && (await p.locator('.lg-prox').count()) === 0, 'scouting: en nuestro equipo no hay "proximo partido" y salen las marcas "dobla"');

    await p.goto(`${APP}/gestion/liga`);
    const orden = await p.evaluate(() => { const h = document.querySelector('.lg-lideres')?.getBoundingClientRect().top ?? 1e9; const d = document.querySelector('details.lg-ranking')?.getBoundingClientRect().top ?? -1; return h < d; });
    ok(orden, 'liga: primero los lideres individuales, el ranking de equipos mas abajo');
    ok((await p.locator('details.lg-ranking').getAttribute('open')) === null, 'liga: el ranking conjunto viene plegado');
    ok((await p.locator('.lg-lider').count()) === 5, 'liga: 5 listas (puntos, media, triples, tiros libres, faltas)');
    ok((await p.locator('.lg-lider .etiqueta', { hasText: 'dobla' }).count()) > 0, 'liga: marca "dobla" en nuestros jugadores que salen con MdA y MdL');
    ok(await menuEntero() && await sinDesbordar(), 'liga: menu entero y sin desbordamiento');
    await p.screenshot({ path: path.join(SALIDA, `real_c_liga_plegado_${etiqueta}.png`), fullPage: true });
    await p.locator('details.lg-ranking > summary').click();
    ok((await p.locator('details.lg-ranking tbody tr').count()) === 20, 'liga: el ranking desplegado tiene los 20 equipos con partidos');
    ok(await sinDesbordar(), 'liga: desplegado, sin desbordamiento de pagina');
    await p.screenshot({ path: path.join(SALIDA, `real_c_liga_desplegado_${etiqueta}.png`), fullPage: true });
    ok(errores.length === 0, 'sin errores de JavaScript', errores.join(' | '));
    await ctx.close();
  }
} finally {
  if (nav) await nav.close();
  if (app) app.kill();
  await pila.parar();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
