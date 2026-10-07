#!/usr/bin/env node
// Verificacion del despliegue de PRODUCCION (https://maccabis.vercel.app) con una sesion de gestor temporal.
// No toca la configuracion de Vercel ni de Supabase. Crea un usuario temporal (como verificar_real.mjs), entra con su
// contrasena por la API de Supabase, pasa la sesion al navegador como cookies y recorre /entrar, /gestion, Scouting y
// Liga consolidada a 375 px y escritorio. Al final BORRA el usuario y la ficha de gestor temporales, pase lo que pase.
//
//   node pruebas/verificar_produccion.mjs [url]

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createServerClient } from '@supabase/ssr';
import { chromium } from 'playwright';
import { conectar } from '../scripts/db.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(RAIZ, '.env.local') });
/** Con la redireccion activada (scripts/activar_redirecciones.js) GitHub Pages ya no tiene barra: se omiten sus pruebas. */
const REDIR_ACTIVA = /var ESTA_ACTIVA = true;/.test(fs.readFileSync(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'), 'data', 'redireccion_web.js'), 'utf8'));
const BASE = (process.argv[2] || 'https://maccabis.vercel.app').replace(/\/$/, '');
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sql = conectar();
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };

const sufijo = crypto.randomBytes(4).toString('hex');
const email = `prueba-prod-${sufijo}@maccabis.invalid`;
const clave = crypto.randomBytes(18).toString('base64url');
let uid = null;
let nav;
try {
  const [{ n: gestoresAntes }] = await sql`select count(*)::int n from public.gestores`;
  const [{ n: usuariosAntes }] = await sql`select count(*)::int n from auth.users`;
  const [u] = await sql`
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                            created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', ${email},
            extensions.crypt(${clave}, extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
    returning id`;
  uid = u.id;
  await sql`insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
            values (gen_random_uuid(), ${uid}, ${uid}, ${sql.json({ sub: uid, email, email_verified: true })}, 'email', now(), now(), now())`;
  await sql`insert into public.gestores (user_id, nombre, email) values (${uid}, 'PRUEBA temporal', ${email})`;

  // Sesion real -> cookies exactamente como las escribe la app (@supabase/ssr)
  const cookies = [];
  const cliente = createServerClient(URL_SB, ANON, { cookies: { getAll: () => cookies.map(({ name, value }) => ({ name, value })), setAll: (l) => l.forEach((c) => cookies.push(c)) } });
  const { error } = await cliente.auth.signInWithPassword({ email, password: clave });
  ok(!error && cookies.length > 0, 'sesion de gestor temporal creada', error?.message);
  const host = new globalThis.URL(BASE).hostname;

  nav = await chromium.launch({ channel: 'chrome', headless: true });
  console.log(`\n== Sin sesion (${BASE})`);
  for (const r of ['/gestion', '/gestion/scouting', '/gestion/liga']) {
    const resp = await fetch(BASE + r, { redirect: 'manual' });
    ok(resp.status >= 300 && resp.status < 400 && (resp.headers.get('location') || '').includes('/entrar'), `${r} sin sesion manda a /entrar`, `HTTP ${resp.status}`);
  }
  const entrar = await fetch(BASE + '/entrar');
  const html = await entrar.text();
  ok(entrar.status === 200 && html.includes('Continuar con Google') && html.includes('Enviarme el código'), '/entrar carga (HTTP 200)', `HTTP ${entrar.status}`);

  // Web publica sin sesion (D85, D89): paginas, redirecciones, iCal, robots y sitemap.
  for (const r of ['/', '/club', '/privacidad', '/liga', '/liga/rivales', '/liga/2025-26/equipo', '/historia', '/plantilla', '/plantilla?t=2017-18', '/jugador/esteban-jon?t=2025-26', '/liga/2013-14/rankings', '/liga/2023-24/mda']) {
    const resp = await fetch(BASE + r);
    const cuerpo = await resp.text();
    ok(resp.status === 200 && cuerpo.includes('class="nv-cab"') && cuerpo.includes('href="/entrar"') && cuerpo.includes('Acceso jugadores y gestores'), `${r}: 200 con la cabecera unica y el acceso (sin sesion)`, `HTTP ${resp.status}`);
  }
  for (const r of ['/mi-zona', '/cuenta']) {
    const resp = await fetch(BASE + r, { redirect: 'manual' });
    ok(resp.status >= 300 && resp.status < 400 && (resp.headers.get('location') || '').includes('/entrar'), `${r} sin sesion manda a /entrar`, `HTTP ${resp.status}`);
  }
  const ics = await fetch(BASE + '/calendario.ics');
  const icsTxt = await ics.text();
  ok(ics.status === 200 && (ics.headers.get('content-type') || '').startsWith('text/calendar') && icsTxt.startsWith('BEGIN:VCALENDAR') && (icsTxt.match(/BEGIN:VEVENT/g) || []).length > 0, `/calendario.ics: 200, ${(icsTxt.match(/BEGIN:VEVENT/g) || []).length} eventos`);
  const robots = await (await fetch(BASE + '/robots.txt')).text();
  ok(['/entrar', '/mi-zona', '/gestion', '/cuenta', '/auth'].every((x) => robots.includes(`Disallow: ${x}`)) && robots.includes('Sitemap: https://maccabis.vercel.app/sitemap.xml'), 'robots.txt: Disallow de lo privado (con /cuenta) y sitemap');
  const sitemap = await (await fetch(BASE + '/sitemap.xml')).text();
  ok(['/', '/club', '/privacidad'].every((x) => sitemap.includes(`<loc>https://maccabis.vercel.app${x === '/' ? '/' : x}</loc>`)) && !/entrar|mi-zona|gestion|cuenta/.test(sitemap), 'sitemap.xml: solo la web publica');

  // Web de estadisticas (GitHub Pages): barra "Volver a Maccabis" en todas las pestañas (D89).
  if (!REDIR_ACTIVA) {
    const GH = 'https://eyeshar.github.io/MACCABIS/';
    const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' });
    const p = await ctx.newPage();
    const errores = [];
    p.on('pageerror', (e) => errores.push(String(e)));
    await p.goto(GH);
    await p.locator('.tab.on').waitFor({ timeout: 20000 });
    const pestanas = await p.locator('.tab').evaluateAll((t) => t.map((x) => x.dataset.p));
    const malas = [];
    for (const t of pestanas) {
      await p.goto(`${GH}?p=${t}`);
      await p.locator('.tab.on').waitFor({ timeout: 20000 });
      const d = await p.evaluate(() => { const v = document.querySelector('#mcb .mcb-volver'); return v ? { href: v.getAttribute('href'), txt: v.textContent.trim(), fija: getComputedStyle(document.getElementById('mcb')).position } : null; });
      if (!d || d.href !== 'https://maccabis.vercel.app/' || d.txt !== '← Volver a Maccabis' || d.fija !== 'sticky') malas.push(`${t}: ${JSON.stringify(d)}`);
    }
    ok(pestanas.length === 10 && malas.length === 0, `GitHub Pages: "← Volver a Maccabis" en las ${pestanas.length} pestañas, fija y a la portada`, malas.join(' | '));
    ok(errores.length === 0, 'GitHub Pages: sin errores de JavaScript', errores.join(' | '));
    await ctx.close();
  }

  for (const [etiqueta, ancho, alto, movil] of [['375', 375, 800, true], ['escritorio', 1280, 900, false]]) {
    console.log(`\n== Gestor en produccion, ${etiqueta}`);
    const ctx = await nav.newContext({ viewport: { width: ancho, height: alto }, isMobile: movil, hasTouch: movil, locale: 'es-ES' });
    await ctx.addCookies(cookies.map((c) => ({ name: c.name, value: c.value, domain: host, path: '/', secure: true, httpOnly: false, sameSite: 'Lax' })));
    const p = await ctx.newPage();
    const errores = [];
    p.on('pageerror', (e) => errores.push(String(e)));
    const sinDesbordar = () => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

    await p.goto(`${BASE}/gestion`);
    ok(p.url().endsWith('/gestion') && (await p.textContent('.gs-eyebrow')).includes('Panel de gestión'), '/gestion carga con sesion de gestor');
    const enlaces = await p.$$eval('nav[aria-label="Gestión"] a', (a) => a.map((x) => x.textContent.trim()));
    ok(enlaces.includes('Scouting rivales') && enlaces.includes('Liga consolidada'), 'el menu de gestion trae Scouting rivales y Liga consolidada', enlaces.join(','));
    ok(await sinDesbordar(), '/gestion sin desbordamiento');

    await p.goto(`${BASE}/gestion/scouting`);
    ok((await p.textContent('h1')).includes('Scouting rivales') && (await p.textContent('h2:nth-of-type(1)')).length > 0, 'Scouting rivales carga');
    ok((await p.locator('.lg-max').count()) === 3 && (await p.locator('.lg-prox').count()) === 1, 'Scouting: 3 maximos anotadores y proximo partido contra nosotros');
    ok((await p.locator('.lg-tarjetas').isVisible()) === movil, movil ? 'Scouting movil: tarjetas' : 'Scouting escritorio: tabla');
    ok(await sinDesbordar(), 'Scouting sin desbordamiento');

    await p.goto(`${BASE}/gestion/liga`);
    ok((await p.textContent('h1')).includes('Liga consolidada') && (await p.locator('#lideres .lg-lider').count()) === 4, 'Liga consolidada carga con sus listas de lideres (Totales)');
    await p.locator('#lideres').getByRole('button', { name: 'Por partido' }).click();
    ok((await p.locator('#lideres .lg-lider').count()) === 7, 'lideres Por partido: 7 listas');
    ok((await p.locator('nav.lg-indice a').count()) === 3 && (await p.locator('.lg-todos').isVisible()), 'indice de la pagina y tabla Todos los jugadores');
    ok((await p.locator('.lg-todos tbody tr, .lg-todos .lg-compactas .lg-fila').count()) > 0 && await sinDesbordar(), 'tabla Todos los jugadores con filas y sin desbordamiento');
    await p.locator('.lg-todos').getByLabel('Buscar').fill('esteban, jon').catch(async () => { await p.locator('.lg-filtros-btn').click(); await p.locator('.lg-todos').getByLabel('Buscar').fill('esteban, jon'); });
    ok((await p.locator('.lg-todos').textContent()).includes('MdA + MdL'), 'tabla: un doblador sale en una sola fila MdA + MdL');
    await p.locator('details.lg-ranking > summary').click();
    ok((await p.locator('details.lg-ranking tbody tr').count()) === 20 && await sinDesbordar(), 'ranking de equipos (20) sin desbordamiento');
    ok(errores.length === 0, 'sin errores de JavaScript', errores.join(' | '));
    await ctx.close();
  }
} catch (e) {
  fallos++;
  console.log(`  FALLO la verificacion se interrumpio: ${String(e.message).split(/\r?\n/)[0]}`);
} finally {
  if (nav) await nav.close();
  console.log('\n== Limpieza');
  if (uid) {
    await sql`delete from public.gestores where user_id = ${uid} or nombre = 'PRUEBA temporal'`;
    await sql`delete from auth.users where id = ${uid}`;
  }
  const [r] = await sql`select (select count(*)::int from public.gestores) g, (select count(*)::int from auth.users) u`;
  console.log(`  gestores: ${r.g}, usuarios de auth: ${r.u} (deben ser los mismos que antes)`);
  await sql.end();
  console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTODO OK');
  process.exitCode = fallos ? 1 : 0;
}
