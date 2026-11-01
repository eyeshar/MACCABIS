#!/usr/bin/env node
// Verificacion del despliegue de PRODUCCION (https://maccabis.vercel.app) con una sesion de gestor temporal.
// No toca la configuracion de Vercel ni de Supabase. Crea un usuario temporal (como verificar_real.mjs), entra con su
// contrasena por la API de Supabase, pasa la sesion al navegador como cookies y recorre /entrar, /gestion, Scouting y (D162: en /liga/…)
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
// Filas del ranking de equipos de Liga consolidada: los equipos que ya tienen algun partido con hoja (crece
// con las jornadas: 20 en la J1, 22 desde la J2, cuando RIF y 28500 dejaron de descansar).
const EQUIPOS_CON_PARTIDOS = Object.values(JSON.parse(fs.readFileSync(path.join(RAIZ, 'src', 'data', 'liga.json'), 'utf8')).grupos)
  .flatMap((g) => g.clasificacion).filter((c) => c.pj > 0).length;
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
let calPersona = null;
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
  for (const r of ['/gestion', '/liga/scouting', '/liga/consolidada']) {
    const resp = await fetch(BASE + r, { redirect: 'manual' });
    ok(resp.status >= 300 && resp.status < 400 && (resp.headers.get('location') || '').includes('/entrar'), `${r} sin sesion manda a /entrar`, `HTTP ${resp.status}`);
  }
  const entrar = await fetch(BASE + '/entrar');
  const html = await entrar.text();
  ok(entrar.status === 200 && html.includes('Continuar con Google') && html.includes('Enviarme el código'), '/entrar carga (HTTP 200)', `HTTP ${entrar.status}`);
  // D139: la casilla del código (solo aparece tras pedir un código) acepta de 6 a 8 dígitos: se mira en el JS de la página.
  const scripts = [...new Set(html.split('"').filter((x) => x.startsWith('/_next/static/') && x.endsWith('.js')))];
  let casilla = false;
  for (const s of scripts) { const js = await (await fetch(BASE + s)).text(); if (js.includes('Código del correo') && /maxLength:8/.test(js) && /minLength:6/.test(js)) { casilla = true; break; } }
  ok(casilla, '/entrar: la casilla «Código del correo» acepta de 6 a 8 dígitos (minLength 6, maxLength 8)');

  // Web publica sin sesion (D85, D89): paginas, redirecciones, iCal, robots y sitemap.
  // Manifiestos que enlaza cada pagina: siempre el unico, /manifest.webmanifest (fallo del 25/10: /mi-zona/manifest...).
  const manifiestosMalos = [];
  const revisarManifiesto = (ruta, cuerpo) => {
    const hrefs = [...cuerpo.matchAll(/<link[^>]*rel="manifest"[^>]*>/g)].map((m) => (m[0].match(/href="([^"]*)"/) || [])[1]);
    if (hrefs.length !== 1 || hrefs[0] !== '/manifest.webmanifest') manifiestosMalos.push(`${ruta}: ${JSON.stringify(hrefs)}`);
  };
  for (const r of ['/', '/club', '/privacidad', '/liga', '/liga/rivales', '/liga/2025-26/equipo', '/historia', '/plantilla', '/plantilla?t=2017-18', '/jugador/esteban-jon?t=2025-26', '/liga/2013-14/rankings', '/liga/2023-24/mda']) {
    const resp = await fetch(BASE + r);
    const cuerpo = await resp.text();
    revisarManifiesto(r, cuerpo);
    ok(resp.status === 200 && cuerpo.includes('class="nv-cab"') && cuerpo.includes('href="/entrar"') && cuerpo.includes('Acceso jugadores y gestores'), `${r}: 200 con la cabecera unica y el acceso (sin sesion)`, `HTTP ${resp.status}`);
  }
  // «/» sin sesion, la portada publica de siempre (D117 no la cambia).
  const portada = await (await fetch(BASE + '/')).text();
  ok(portada.includes('Dos equipos.') && portada.includes('Una plantilla.') && portada.includes('Próxima jornada') && !portada.includes('Te faltan') && !portada.includes('Hola,'), '«/» sin sesion: la portada publica de siempre (sin nada del inicio personal)');
  const mz = await fetch(BASE + '/mi-zona', { redirect: 'manual' });
  ok(mz.status === 308 && new globalThis.URL(mz.headers.get('location') || '', BASE).pathname === '/', '/mi-zona redirige a «/» (308, D117)', `HTTP ${mz.status} ${mz.headers.get('location')}`);
  for (const r of ['/cuenta', '/agenda', '/planes/nuevo', '/mis-numeros', '/gestion/tablero', '/gestion/grupos']) {
    const resp = await fetch(BASE + r, { redirect: 'manual' });
    ok(resp.status >= 300 && resp.status < 400 && (resp.headers.get('location') || '').includes('/entrar'), `${r} sin sesion manda a /entrar`, `HTTP ${resp.status}`);
  }
  const ics = await fetch(BASE + '/calendario.ics');
  const icsTxt = await ics.text();
  ok(ics.status === 200 && (ics.headers.get('content-type') || '').startsWith('text/calendar') && icsTxt.startsWith('BEGIN:VCALENDAR') && (icsTxt.match(/BEGIN:VEVENT/g) || []).length > 0, `/calendario.ics: 200, ${(icsTxt.match(/BEGIN:VEVENT/g) || []).length} eventos`);
  const robots = await (await fetch(BASE + '/robots.txt')).text();
  ok(['/entrar', '/mi-zona', '/gestion', '/cuenta', '/auth', '/agenda', '/planes', '/mis-numeros', '/cal'].every((x) => robots.includes(`Disallow: ${x}`)) && robots.includes('Sitemap: https://maccabis.vercel.app/sitemap.xml'), 'robots.txt: Disallow de lo privado (con /cuenta, /agenda, /planes, /mis-numeros y /cal) y sitemap');
  const sitemap = await (await fetch(BASE + '/sitemap.xml')).text();
  ok(['/', '/club', '/privacidad'].every((x) => sitemap.includes(`<loc>https://maccabis.vercel.app${x === '/' ? '/' : x}</loc>`)) && !/entrar|mi-zona|gestion|cuenta|agenda|planes|\/cal\//.test(sitemap), 'sitemap.xml: solo la web publica');

  // Liga enlazada (D129): equipos y partidos con enlace, sin «casa/fuera»; la pagina de partido sin sesion no tiene
  // datos por jugador de los rivales (D73).
  const liga = await (await fetch(BASE + '/liga')).text();
  const partidos = [...new Set([...liga.matchAll(/href="(\/liga\/2026-27\/partido\/[^"]+)"/g)].map((m) => m[1]))];
  const equiposEnl = [...liga.matchAll(/href="(\/liga\/(?:rivales\?[^"]+|2026-27\/equipo\?eq=[^"]+))"/g)].length;
  ok(partidos.length > 0 && equiposEnl > 0, `/liga: equipos (${equiposEnl}) y partidos (${partidos.length}) enlazados (D129)`);
  ok(!/en casa|>\s*fuera\s*</i.test(liga.replace(/<script[\s\S]*?<\/script>/g, '')), '/liga: sin «en casa / fuera»');
  const conHoja = partidos.find((h) => /mda|mdl/.test(h)) ?? partidos[0];
  const pp = conHoja ? await fetch(BASE + conHoja) : null;
  const ppTxt = pp ? await pp.text() : '';
  ok(pp?.status === 200 && ppTxt.includes('data-testid="pagina-partido"') && !ppTxt.includes('Rival por jugador') && !ppTxt.includes('rival-por-jugador'), `${conHoja}: 200 sin sesion y sin «Rival por jugador» (D73)`, `HTTP ${pp?.status}`);

  // Web instalable (D78): el manifiesto unico, sin sesion, valido para instalarla en Android; y el service worker.
  console.log('\n== Web instalable (manifiesto y service worker)');
  const manResp = await fetch(BASE + '/manifest.webmanifest');
  let man = null;
  try { man = JSON.parse(await manResp.text()); } catch {}
  ok(manResp.status === 200 && (manResp.headers.get('content-type') || '').startsWith('application/manifest+json') && man !== null,
    '/manifest.webmanifest: 200, application/manifest+json y JSON valido', `HTTP ${manResp.status} ${manResp.headers.get('content-type')}`);
  ok(Boolean(man) && man.name === 'Maccabis' && man.short_name === 'Maccabis' && man.id === '/' && man.start_url === '/' && man.display === 'standalone'
    && man.icons.some((i) => i.sizes === '192x192') && man.icons.some((i) => i.sizes === '512x512'), 'manifiesto instalable: name, short_name, id «/», start_url «/», standalone, iconos 192 y 512');
  for (const i of man?.icons ?? []) {
    const x = await fetch(BASE + i.src);
    ok(x.status === 200 && x.headers.get('content-type') === 'image/png', `icono ${i.src}: 200, image/png`, `HTTP ${x.status}`);
  }
  const viejo = await fetch(BASE + '/mi-zona/manifest.webmanifest', { redirect: 'manual' });
  ok(viejo.status === 308 && new globalThis.URL(viejo.headers.get('location') || '', BASE).pathname === '/manifest.webmanifest', 'el antiguo /mi-zona/manifest.webmanifest redirige (308) al unico', `HTTP ${viejo.status} ${viejo.headers.get('location')}`);
  const sw = await fetch(BASE + '/sw.js');
  ok(sw.status === 200 && /javascript/.test(sw.headers.get('content-type') || '') && (await sw.text()).includes("addEventListener('push'"), '/sw.js: 200, JavaScript, con el manejador de avisos', `HTTP ${sw.status}`);
  ok(manifiestosMalos.length === 0, 'ninguna pagina publica enlaza un manifiesto distinto de /manifest.webmanifest (ni bajo /mi-zona)', manifiestosMalos.join(' | '));

  // Calendario personal (D120): un enlace de PRUEBA, creado aqui y revocado al terminar (pase lo que pase). Se usa un
  // jugador activo SIN enlace (nunca se toca el enlace de nadie) y no se imprime nada suyo: solo cabeceras y recuentos.
  console.log('\n== Calendario personal (/cal/<enlace>.ics)');
  const falso = await fetch(`${BASE}/cal/${'x'.repeat(43)}.ics`);
  ok(falso.status === 404 && /noindex/.test(falso.headers.get('x-robots-tag') || ''), 'un enlace que no existe: 404 y noindex', `HTTP ${falso.status}`);
  [calPersona] = await sql`select j.person_id from public.jugadores j where j.activo and j.rol <> 'entrenador'
                            and not exists (select 1 from public.calendario_tokens t where t.person_id = j.person_id) order by j.person_id limit 1`;
  ok(Boolean(calPersona), 'hay un jugador activo sin enlace para la prueba');
  if (calPersona) {
    const token = crypto.randomBytes(32).toString('base64url');
    await sql`insert into public.calendario_tokens (person_id, hash) values (${calPersona.person_id}, encode(sha256(convert_to(${token}, 'UTF8')), 'hex'))`;
    const cal = await fetch(`${BASE}/cal/${token}.ics`);
    const txt = await cal.text();
    const n = (txt.match(/BEGIN:VEVENT/g) || []).length;
    ok(cal.status === 200 && (cal.headers.get('content-type') || '').startsWith('text/calendar') && txt.startsWith('BEGIN:VCALENDAR') && txt.includes('BEGIN:VTIMEZONE') && /END:VCALENDAR\s*$/.test(txt),
      `/cal/<enlace de prueba>.ics: 200, text/calendar, VCALENDAR con VTIMEZONE (${n} eventos)`, `HTTP ${cal.status}`);
    ok(/REFRESH-INTERVAL|X-PUBLISHED-TTL/.test(txt) && (n === 0 || (/UID:/.test(txt) && /SEQUENCE:/.test(txt) && /LAST-MODIFIED:/.test(txt))), 'con REFRESH-INTERVAL / X-PUBLISHED-TTL y, en cada evento, UID, SEQUENCE y LAST-MODIFIED');
    const etag = cal.headers.get('etag');
    ok(Boolean(etag) && /private/.test(cal.headers.get('cache-control') || '') && /noindex/.test(cal.headers.get('x-robots-tag') || ''), 'ETag, Cache-Control private y noindex');
    ok(!/nivel|motivo|lesi[oó]n|posici[oó]n/i.test(txt), 'sin niveles, posiciones ni motivos');
    const otra = await fetch(`${BASE}/cal/${token}.ics`, { headers: { 'if-none-match': etag } });
    ok(otra.status === 304, 'con el mismo ETag: 304', `HTTP ${otra.status}`);
    await sql`delete from public.calendario_tokens where person_id = ${calPersona.person_id}`;
    const revocado = await fetch(`${BASE}/cal/${token}.ics`);
    ok(revocado.status === 404, 'revocado el enlace de prueba: 404', `HTTP ${revocado.status}`);
  }

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

    // «/» con sesion de gestor: el inicio personal (D117). El gestor temporal no tiene ficha de jugador: la banda
    // «Gestión esta semana», el saludo y el club; nunca la portada publica.
    await p.goto(`${BASE}/`);
    ok(await p.getByTestId('banda-gestion').isVisible() && (await p.locator('.in-hola h1').innerText()).includes('Hola') && !(await p.content()).includes('Dos equipos.'), '«/» con sesion de gestor: el inicio personal con la banda «Gestión esta semana»');
    ok(await sinDesbordar(), '«/» con sesion sin desbordamiento');
    const manInicio = await p.locator('link[rel="manifest"]').evaluateAll((l) => l.map((x) => x.getAttribute('href')));
    ok(manInicio.length === 1 && manInicio[0] === '/manifest.webmanifest', '«/» con sesion enlaza /manifest.webmanifest (nunca uno bajo /mi-zona)', JSON.stringify(manInicio));
    for (const [ruta, eyebrow] of [['/gestion/tablero', 'Tablero'], ['/gestion/grupos', 'Grupos de entreno']]) {
      const resp = await p.goto(`${BASE}${ruta}`);
      ok(resp.status() === 200 && (await p.locator('.gs-eyebrow').first().textContent()).includes(eyebrow) && (await p.locator('h1').count()) > 0, `${ruta} carga (${(await p.locator('h1').first().innerText().catch(() => '')).slice(0, 40)})`, `HTTP ${resp.status()}`);
      ok(await sinDesbordar(), `${ruta} sin desbordamiento`);
    }

    await p.goto(`${BASE}/gestion`);
    ok(p.url().endsWith('/gestion') && (await p.textContent('.gs-eyebrow')).includes('Panel de gestión'), '/gestion carga con sesion de gestor');
    const enlaces = await p.$$eval('nav[aria-label="Gestión"] a', (a) => a.map((x) => x.textContent.trim()));
    ok(enlaces.includes('Scouting rivales') && enlaces.includes('Liga consolidada'), 'el menu de gestion trae Scouting rivales y Liga consolidada', enlaces.join(','));
    ok(await sinDesbordar(), '/gestion sin desbordamiento');

    // Aviso en la web de la convocatoria (D127): no depende del interruptor. Solo se mira; nunca se pulsa «Enviar ahora».
    if (!movil) {
      const [{ fecha }] = await sql`select max(fecha)::text fecha from public.convocatorias where estado = 'aprobada'`;
      const [{ encendido }] = await sql`select public.respuestas_web_encendido() encendido`;
      await p.goto(`${BASE}/gestion/convocatoria/salida?fecha=${fecha}`);
      const tarjeta = p.getByTestId('cv-salida-aviso');
      const txt = await tarjeta.innerText();
      const boton = await tarjeta.getByRole('button', { name: 'Enviar ahora' }).count();
      ok(!txt.includes('interruptor') && (boton === 1 || /Enviado/.test(txt)), `convocatoria del ${fecha}: «Aviso en la web» sin depender del interruptor (${encendido ? 'encendido' : 'apagado'}): ${boton ? '«Enviar ahora» disponible' : 'enviado'}`, txt.slice(0, 200));
    }

    await p.goto(`${BASE}/liga/scouting`);
    ok((await p.textContent('.e-sec h2')).includes('Scouting rivales') && (await p.textContent('.lg-cab-equipo h2')).length > 0, 'Scouting rivales carga');
    ok((await p.locator('.lg-max').count()) === 3 && (await p.locator('.lg-prox').count()) === 1, 'Scouting: 3 maximos anotadores y proximo partido contra nosotros');
    ok((await p.locator('.lg-tarjetas').isVisible()) === movil, movil ? 'Scouting movil: tarjetas' : 'Scouting escritorio: tabla');
    ok(await sinDesbordar(), 'Scouting sin desbordamiento');

    await p.goto(`${BASE}/liga/consolidada`);
    ok((await p.textContent('.e-sec h2')).includes('Liga consolidada') && (await p.locator('#lideres .lg-lider').count()) === 4, 'Liga consolidada carga con sus listas de lideres (Totales)');
    await p.locator('#lideres').getByRole('button', { name: 'Por partido' }).click();
    ok((await p.locator('#lideres .lg-lider').count()) === 7, 'lideres Por partido: 7 listas');
    ok((await p.locator('nav.lg-indice a').count()) === 3 && (await p.locator('.lg-todos').isVisible()), 'indice de la pagina y tabla Todos los jugadores');
    ok((await p.locator('.lg-todos tbody tr, .lg-todos .lg-compactas .lg-fila').count()) > 0 && await sinDesbordar(), 'tabla Todos los jugadores con filas y sin desbordamiento');
    await p.locator('.lg-todos').getByLabel('Buscar').fill('esteban, jon').catch(async () => { await p.locator('.lg-filtros-btn').click(); await p.locator('.lg-todos').getByLabel('Buscar').fill('esteban, jon'); });
    ok((await p.locator('.lg-todos').textContent()).includes('MdA + MdL'), 'tabla: un doblador sale en una sola fila MdA + MdL');
    await p.locator('details.lg-ranking > summary').click();
    ok((await p.locator('details.lg-ranking tbody tr').count()) === EQUIPOS_CON_PARTIDOS && await sinDesbordar(), `ranking de equipos (${EQUIPOS_CON_PARTIDOS}) sin desbordamiento`, String(await p.locator('details.lg-ranking tbody tr').count()));
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
  if (calPersona) await sql`delete from public.calendario_tokens where person_id = ${calPersona.person_id}`;
  const [r] = await sql`select (select count(*)::int from public.gestores) g, (select count(*)::int from auth.users) u`;
  console.log(`  gestores: ${r.g}, usuarios de auth: ${r.u} (deben ser los mismos que antes)`);
  await sql.end();
  console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTODO OK');
  process.exitCode = fallos ? 1 : 0;
}
