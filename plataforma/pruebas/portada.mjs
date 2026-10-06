#!/usr/bin/env node
// Redisenio y web unica (D76), de extremo a extremo: portada publica sin login, acceso, Mi zona y gestion con el
// aspecto nuevo, feed iCal y web instalable. Pila local (Postgres + PostgREST con nuestras migraciones) + app compilada
// + Chrome.
//
//   npm run pruebas:portada
//
// En la portada "hoy" se fija con ?hoy=AAAA-MM-DD (06/10/2026: el proximo partido de MdA y MdL es la J2 del 18/10).
// Deja capturas reales en privado/mockups_liga/rediseno/real_{portada,acceso,mizona,gestion}_{375,escritorio}.png.

import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { arrancar } from './pila.mjs';
import { desfasadas } from '../scripts/sincronizar_equipacion.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.join(RAIZ, '..');
const SALIDA = path.join(REPO, 'privado', 'mockups_liga', 'rediseno');
fs.mkdirSync(SALIDA, { recursive: true });
const require = createRequire(import.meta.url);
const A = require(path.join(REPO, 'data', 'avisos_equipacion.js'));
const equip = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'equipaciones_2026-27.json'), 'utf8'));
const cal = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'calendario_2026-27.json'), 'utf8'));
const resumen = JSON.parse(fs.readFileSync(path.join(RAIZ, 'src', 'data', 'historia_resumen.json'), 'utf8'));

const PUERTO = 3104;
const APP = `http://127.0.0.1:${PUERTO}`;
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };

async function esperar(url, ms = 60000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) { try { const r = await fetch(url); if (r.status < 500) return; } catch {} await new Promise((r) => setTimeout(r, 300)); }
  throw new Error(`${url} no arranca`);
}

console.log('== Datos');
ok(desfasadas().length === 0, 'plataforma/src/data/ coincide con data/ (npm run datos:sync)', desfasadas().join(', '));
const entrenos = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'entrenos_2026-27.json'), 'utf8'));
ok(entrenos.series[0].dia_semana === 3 && entrenos.series[0].inicio === '20:30' && entrenos.series[0].fin === '22:30', 'entreno semanal: miercoles 20:30-22:30');
ok(entrenos.pistas[entrenos.series[0].pista].estado === 'en_obras', 'pista habitual (Valdebernardo) en obras');
ok(!/@|\btel|dni|nivel/i.test(JSON.stringify(entrenos)), 'entrenos: sin datos personales');

const pila = await arrancar();
let app, nav;
try {
  const { sql, url, anonKey } = pila;
  const { leerLiga, cargarLiga } = await import('../scripts/cargar_liga.mjs');
  await cargarLiga(sql, leerLiga('2026-27'), '2026-27', { log: () => {} });
  const gestorEmail = 'gestor@pruebas.local', jugadorEmail = 'jugador@pruebas.local';
  const gId = await pila.crearUsuario(gestorEmail, 'no-se-usa');
  await sql`insert into public.gestores (user_id, nombre, email) values (${gId}, 'Iván', ${gestorEmail})`;
  await sql`update public.jugadores set email = ${jugadorEmail}, ficha_mda = true, ficha_mdl = true where person_id = 'esteban-jon'`;
  const codigoDe = async (email) => (await sql`select codigo from public._otp_pruebas where email = ${email}`)[0]?.codigo;

  console.log('\n== Compilacion');
  const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey, NEXT_TELEMETRY_DISABLED: '1' };
  const next = path.join(RAIZ, 'node_modules', 'next', 'dist', 'bin', 'next');
  execFileSync(process.execPath, [next, 'build'], { cwd: RAIZ, env, stdio: 'ignore' });
  ok(true, 'next build');
  app = spawn(process.execPath, [next, 'start', '-p', String(PUERTO), '-H', '127.0.0.1'], { cwd: RAIZ, env, stdio: 'ignore' });
  await esperar(APP);

  // ---------------------------------------------------------------- HTTP
  console.log('\n== HTTP sin sesion');
  let r = await fetch(`${APP}/`);
  const html = await r.text();
  ok(r.status === 200, 'portada "/" sin login: 200', String(r.status));
  ok(html.includes('Dos equipos.') && html.includes('Una plantilla.'), 'portada: heroe "Dos equipos. Una plantilla."');
  ok(/<meta name="theme-color" content="#0E0D12"/i.test(html), 'theme-color #0E0D12');
  ok(html.includes('rel="manifest" href="/manifest.webmanifest"'), 'la portada enlaza el manifiesto');
  for (const ruta of ['/mi-zona', '/gestion', '/gestion/liga']) {
    const x = await fetch(`${APP}${ruta}`, { redirect: 'manual' });
    ok(x.status >= 300 && x.status < 400 && (x.headers.get('location') || '').includes('/entrar'), `${ruta} sin sesion redirige a /entrar`, `${x.status} ${x.headers.get('location')}`);
  }
  r = await fetch(`${APP}/entrar`);
  ok(r.status === 200 && (await r.text()).includes('Acceso Maccabis'), '/entrar: 200 con el acceso nuevo');

  console.log('\n== Web instalable');
  r = await fetch(`${APP}/manifest.webmanifest`);
  const man = await r.json();
  ok(r.status === 200 && man.name === 'Maccabis' && man.short_name === 'Maccabis' && man.display === 'standalone' && man.start_url === '/' && man.theme_color === '#0E0D12', 'manifiesto: Maccabis, standalone, empieza en /, theme-color');
  ok(man.icons.some((i) => i.sizes === '192x192') && man.icons.some((i) => i.sizes === '512x512' && i.purpose === 'any') && man.icons.some((i) => i.purpose === 'maskable'), 'iconos 192, 512 y maskable');
  for (const i of man.icons) { const x = await fetch(`${APP}${i.src}`); ok(x.status === 200 && x.headers.get('content-type') === 'image/png', `icono ${i.src} servido`); }
  for (const f of ['/icon.png', '/apple-icon.png', '/sw.js']) ok((await fetch(`${APP}${f}`)).status === 200, `${f} servido`);
  ok(!/addEventListener\(['"]fetch/.test(await (await fetch(`${APP}/sw.js`)).text()), 'service worker sin cache ni manejador fetch (no cambia como carga la web)');

  console.log('\n== Feed iCal');
  r = await fetch(`${APP}/calendario.ics`);
  const ics = await r.text();
  ok(r.status === 200 && (r.headers.get('content-type') || '').startsWith('text/calendar'), 'calendario.ics: 200, text/calendar');
  const lineas = ics.split('\r\n');
  ok(ics.endsWith('\r\n') && !/[^\r]\n/.test(ics), 'todas las lineas terminan en CRLF');
  ok(lineas.every((l) => Buffer.byteLength(l) <= 75), 'ninguna linea pasa de 75 octetos (plegado RFC 5545)');
  const desplegado = ics.replace(/\r\n /g, '').split('\r\n').filter(Boolean);
  ok(desplegado[0] === 'BEGIN:VCALENDAR' && desplegado.at(-1) === 'END:VCALENDAR' && desplegado.includes('VERSION:2.0') && desplegado.some((l) => l.startsWith('PRODID:')), 'VCALENDAR con VERSION y PRODID');
  const pila_ = [];
  let equilibrado = true;
  for (const l of desplegado) { if (l.startsWith('BEGIN:')) pila_.push(l.slice(6)); else if (l.startsWith('END:') && pila_.pop() !== l.slice(4)) equilibrado = false; }
  ok(equilibrado && pila_.length === 0, 'BEGIN/END equilibrados');
  const ev = ics.replace(/\r\n /g, '').split('BEGIN:VEVENT').slice(1).map((b) => b.split('END:VEVENT')[0]);
  const partidos = cal.partidos.filter((p) => !p.descansa && p.rival && p.fecha);
  const miercoles = (() => { let n = 0; for (let d = new Date('2026-10-07T12:00:00Z'); d.toISOString().slice(0, 10) <= cal.partidos.map((p) => p.fecha).sort().at(-1); d.setUTCDate(d.getUTCDate() + 7)) n++; return n; })();
  ok(ev.length === partidos.length + miercoles, `${partidos.length} partidos + ${miercoles} entrenos`, String(ev.length));
  ok(ev.every((b) => /\r\nUID:/.test(b) && /\r\nDTSTAMP:\d{8}T\d{6}Z/.test(b) && /\r\nDTSTART[;:]/.test(b) && /\r\nSUMMARY:/.test(b)), 'cada VEVENT con UID, DTSTAMP, DTSTART y SUMMARY');
  ok(new Set(ev.map((b) => b.match(/UID:(.*)/)[1])).size === ev.length, 'UID unicos');
  ok(desplegado.includes('TZID:Europe/Madrid') && ev.filter((b) => b.includes('DTSTART;TZID=Europe/Madrid')).length === ev.length, 'horas en Europe/Madrid con VTIMEZONE');
  const j2 = ev.find((b) => b.includes('UID:mda-j2-'));
  ok(j2 && j2.includes('DTSTART;TZID=Europe/Madrid:20261018T101500') && j2.includes('SUMMARY:MdA – Litros de Mahou (J2)') && j2.includes('cambia Litros de Mahou'), 'J2 MdA: 18/10 10:15, con la linea de equipacion (cambian ellos)');
  const caja = ev.find((b) => b.includes('20261007T200000'));
  ok(caja && caja.includes('DTEND;TZID=Europe/Madrid:20261007T210000') && caja.includes('LOCATION:Caja Mágica'), 'entreno 07/10: 20:00-21:00 en la Caja Magica');
  const e14 = ev.find((b) => b.includes('DTSTART;TZID=Europe/Madrid:20261014T203000'));
  ok(e14 && e14.includes('DTEND;TZID=Europe/Madrid:20261014T223000') && e14.includes('Pista por confirmar (Valdebernardo en obras)'), 'entreno 14/10: 20:30-22:30, pista por confirmar (Valdebernardo en obras)');
  ok(!/[\w.+-]+@(?!maccabis\b)[\w-]+\.[\w.]+/.test(ics.replace(/UID:[^\r]*/g, '')), 'el feed no lleva ningun correo');

  // ---------------------------------------------------------------- Navegador
  nav = await chromium.launch({ channel: 'chrome', headless: true });
  const captura = (p, n) => p.addStyleTag({ content: '.w-barra,.mz-barra{position:static!important;transform:none!important;width:auto!important}' })
    .then(() => p.screenshot({ path: path.join(SALIDA, `${n}.png`), fullPage: true }));
  async function entrar(p, email) {
    await p.goto(`${APP}/entrar`);
    await p.getByLabel('Tu correo').fill(email);
    await p.getByRole('button', { name: 'Enviarme el código' }).click();
    await p.getByText('Código enviado a').waitFor({ timeout: 10000 });
    await p.getByLabel('Código de 6 dígitos').fill((await codigoDe(email)) ?? '000000');
    await p.getByRole('button', { name: 'Entrar', exact: true }).click();
    await p.waitForURL((u) => !u.pathname.startsWith('/entrar') || u.pathname.startsWith('/entrar/elegir'), { timeout: 15000 });
  }

  for (const [etiqueta, ancho, alto, movil] of [['375', 375, 812, true], ['escritorio', 1440, 900, false]]) {
    console.log(`\n== Portada, ${etiqueta}`);
    const ctx = await nav.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: movil ? 2 : 1, isMobile: movil, hasTouch: movil, locale: 'es-ES' });
    const p = await ctx.newPage();
    const errores = [];
    p.on('pageerror', (e) => errores.push(String(e)));
    p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
    const sinDesbordar = () => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    await p.goto(`${APP}/?hoy=2026-10-06`);
    ok(await sinDesbordar(), 'portada: sin desbordamiento horizontal');
    const mda = p.locator('article.w-partido[data-equipo="MDA"]'), mdl = p.locator('article.w-partido[data-equipo="MDL"]');
    ok((await mda.textContent()).includes('Litros de Mahou') && (await mdl.textContent()).includes('Quinto Tiempo'), 'proxima jornada: MdA–Litros de Mahou y Quinto Tiempo–MdL (J2)');
    ok((await p.locator('#partidos .w-meta').textContent()).toLowerCase().includes('j2 · domingo, 18 de octubre'), 'proxima jornada: J2 · domingo 18 de octubre');
    const avA = mda.locator('.eq-aviso');
    ok((await avA.count()) === 1 && (await avA.getAttribute('data-tipo')) === 'cambian_ellos' && (await avA.textContent()).includes('Coinciden colores: cambia Litros de Mahou'), 'J2 MdA: aviso CAMBIAN ELLOS');
    ok((await mdl.locator('.eq-aviso').count()) === 0 && (await mdl.locator('[data-tipo="sin_choque"]').count()) === 1, 'J2 MdL (Quinto Tiempo): sin choque de color');
    const banda = await p.locator('section[aria-label="Últimos resultados"]').textContent();
    ok(banda.includes('14 – 62') && banda.includes('59 – 38') && banda.includes('Pendiente de acta oficial'), 'ultimos resultados de la J1 (14-62 y 59-38), pendientes de acta');
    ok((await p.locator('.w-clas-grupo[data-grupo="G1"] tr.w-nuestro-MDA').textContent()).includes('MdA') && (await p.locator('.w-clas-grupo[data-grupo="G2"] tr.w-nuestro-MDL').count()) === 1, 'clasificacion G1 y G2 con MdA y MdL resaltados');
    ok((await p.locator('.w-clas-grupo[data-grupo="G1"] tbody tr').count()) <= 7, 'clasificacion: top 5 (+ nuestro equipo si va mas abajo)');
    ok((await p.locator('[data-lider]').count()) === 4 && (await p.locator('[data-lider="puntos"]').textContent()).includes('Jon Esteban'), 'lideres Maccabis: 4 tarjetas, puntos = Jon Esteban');
    const cifras = await p.locator('[data-testid="cifras-historia"]').textContent();
    ok(cifras.includes(String(resumen.partidos_con_estadisticas)) && cifras.includes(String(resumen.victorias)) && cifras.includes(String(resumen.jugadores_en_la_historia)), 'historia: cifras generadas de los datos');
    ok((await p.textContent('body')).includes('Desde 2013'), '"Desde 2013" (FUNDACION en src/lib/web.ts)');
    // calendario
    const calSel = p.locator('[data-testid="calendario"]');
    const filaCaja = calSel.locator('[data-id="entreno-semanal-2026-10-07"]');
    ok((await filaCaja.textContent()).includes('20:00–21:00') && (await filaCaja.textContent()).includes('Caja Mágica'), 'calendario: entreno del 07/10, 20:00–21:00 en la Caja Magica');
    const fila14 = calSel.locator('[data-id="entreno-semanal-2026-10-14"]');
    ok((await fila14.textContent()).includes('20:30–22:30') && (await fila14.textContent()).includes('pista por confirmar') && (await fila14.textContent()).includes('Valdebernardo en obras'), 'calendario: entreno del 14/10, pista por confirmar (Valdebernardo en obras)');
    ok((await calSel.locator('[data-id="mda-j2"] [data-aviso="cambian_ellos"]').count()) === 1, 'calendario: J2 MdA con la pastilla "Cambian ellos"');
    for (const [boton, sel, comprueba] of [
      ['Entrenamientos', '.w-cal-fila', (t) => t.every((x) => x === 'entreno')],
      ['Partidos', '.w-cal-fila', (t) => t.every((x) => x === 'partido')],
    ]) {
      await p.getByRole('group', { name: 'Filtrar calendario' }).getByRole('button', { name: boton, exact: true }).click();
      ok(comprueba(await calSel.locator(sel).evaluateAll((f) => f.map((x) => x.dataset.tipo))), `filtro "${boton}"`);
    }
    await p.getByRole('group', { name: 'Filtrar calendario' }).getByRole('button', { name: 'MdL', exact: true }).click();
    ok((await calSel.locator('.w-cal-fila').evaluateAll((f) => f.map((x) => x.dataset.equipo))).every((x) => x === 'MDL'), 'filtro "MdL"');
    await p.getByRole('group', { name: 'Filtrar calendario' }).getByRole('button', { name: 'Todo', exact: true }).click();
    const antes = await calSel.locator('.w-cal-fila').count();
    await calSel.getByRole('button', { name: /Ver toda la temporada/ }).click();
    ok((await calSel.locator('.w-cal-fila').count()) > antes && (await calSel.locator('[data-id="mdl-j6"] [data-aviso="nos_toca"]').count()) === 1, 'ver toda la temporada: J6 en 28500 con "Nos toca: amarilla"');
    ok((await p.locator('a[href^="webcal://"]').count()) === 1 && (await p.locator('a[href="/calendario.ics"]').count()) === 1, '"Añadir a mi calendario": suscripcion webcal y descarga del .ics');
    // objetivos tactiles
    const pequenos = await p.evaluate(() => [...document.querySelectorAll('main a, main button, header a, header summary, nav a')]
      .filter((e) => e.offsetParent !== null).map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim().slice(0, 30), h: r.height }; })
      .filter((x) => x.h > 0 && x.h < 43.5));
    ok(pequenos.length === 0, 'objetivos tactiles de al menos 44 px', JSON.stringify(pequenos.slice(0, 5)));
    if (movil) {
      ok(await p.locator('nav[aria-label="Secciones"]').isVisible() && !(await p.locator('nav[aria-label="Principal"]').isVisible()), 'movil: barra inferior de secciones; el menu de escritorio se pliega');
      ok(await p.locator('.w-clas-grupo[data-grupo="G2"]').isHidden(), 'movil: clasificacion con conmutador (G2 oculto)');
      await p.getByRole('group', { name: 'Grupo' }).getByRole('button', { name: /G2/ }).click();
      ok(await p.locator('.w-clas-grupo[data-grupo="G2"]').isVisible() && await p.locator('.w-clas-grupo[data-grupo="G1"]').isHidden(), 'movil: el conmutador muestra el G2');
      await p.getByRole('group', { name: 'Grupo' }).getByRole('button', { name: /G1/ }).click();
    } else {
      ok(await p.locator('nav[aria-label="Principal"]').isVisible() && !(await p.locator('nav[aria-label="Secciones"]').isVisible()), 'escritorio: menu principal; sin barra inferior');
      const menu = await p.$$eval('nav[aria-label="Principal"] a', (a) => a.map((x) => x.textContent.trim()));
      ok(['Inicio', 'Partidos', 'Liga', 'Plantilla', 'Historia', 'El club'].every((t, i) => menu[i]?.startsWith(t)), 'menu: Inicio, Partidos, Liga, Plantilla, Historia, El club', menu.join(','));
      ok((await p.locator('nav[aria-label="Principal"] a[href^="https://eyeshar.github.io/MACCABIS/"]').count()) === 3, 'Liga, Plantilla e Historia enlazan a la web de estadisticas (GitHub Pages)');
    }
    await p.goto(`${APP}/?hoy=2026-10-06`);
    await captura(p, `real_portada_${etiqueta}`);
    // NOS TOCA: el 20/11 el proximo de MdL es la J6 en 28500 (visitantes)
    await p.goto(`${APP}/?hoy=2026-11-20`);
    const nos = p.locator('article.w-partido[data-equipo="MDL"] .eq-aviso');
    ok((await nos.getAttribute('data-tipo')) === 'nos_toca' && (await nos.textContent()).includes('Nos toca cambiar: equipación AMARILLA') && (await nos.textContent()).includes('partido perdido'), 'el 20/11 (J6 MdL en 28500): NOS TOCA CAMBIAR');
    ok(errores.length === 0, 'portada: sin errores de JavaScript', errores.join(' | '));
    await ctx.close();
  }

  // ---------------------------------------------------------------- Acceso, Mi zona y gestion
  const aMdA = A.proximoPartido(cal, new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' }), 'MDA');
  for (const [etiqueta, ancho, alto, movil] of [['375', 375, 812, true], ['escritorio', 1440, 900, false]]) {
    console.log(`\n== Acceso, Mi zona y gestion, ${etiqueta}`);
    const nuevo = () => nav.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: movil ? 2 : 1, isMobile: movil, hasTouch: movil, locale: 'es-ES' });
    const c = await nuevo();
    const p = await c.newPage();
    const errores = [];
    p.on('pageerror', (e) => errores.push(String(e)));
    const sinDesbordar = () => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    await p.goto(`${APP}/entrar`);
    ok(await p.getByRole('button', { name: 'Continuar con Google' }).isVisible() && await p.getByLabel('Tu correo').isVisible(), 'acceso: Google y codigo por correo');
    ok(await sinDesbordar(), 'acceso: sin desbordamiento');
    await captura(p, `real_acceso_${etiqueta}`);
    await p.getByLabel('Tu correo').fill('nadie@fuera.local');
    await p.getByRole('button', { name: 'Enviarme el código' }).click();
    await p.getByText('No hemos podido mandar el código').waitFor({ timeout: 5000 }).catch(() => {});
    ok(await p.getByText('No hemos podido mandar el código').isVisible(), 'acceso: correo fuera de la lista blanca, aviso generico (logica D68 intacta)');

    // jugador (dobla): Mi zona
    await entrar(p, jugadorEmail);
    ok(p.url().endsWith('/mi-zona'), 'un jugador entra en /mi-zona', p.url());
    ok(await p.getByRole('heading', { name: /Hola, Jon/ }).isVisible(), 'Mi zona: "Hola, <nombre>"');
    const agenda = p.locator('[aria-labelledby="t-agenda"]');
    ok((await agenda.locator('.mz-fila[data-tipo="entreno"]').count()) >= 1 && (await agenda.textContent()).includes('Respuesta: pendiente'), 'Tu agenda: entrenos con la respuesta "pendiente" (paso 2)');
    ok((await agenda.locator('.mz-fila[data-tipo="jugado"]').textContent()).includes('jugaste con MdA y MdL') && (await agenda.textContent()).includes('30 puntos'), 'Tu agenda: J1 jugada con MdA y MdL, 30 puntos');
    const domingo = p.locator('[aria-labelledby="t-partidos"]');
    ok((await domingo.locator('.eq-partido').count()) === 2, 'Mi zona (dobla): los dos partidos del proximo domingo');
    if (aMdA?.fecha === '2026-10-18') {
      ok((await domingo.textContent()).includes('no se puede doblar'), 'J2: misma hora, "no se puede doblar"');
      ok((await domingo.locator('.eq-aviso[data-tipo="cambian_ellos"]').count()) === 1, 'Equipacion del domingo: cambian ellos (Litros de Mahou)');
    }
    ok((await p.locator('[aria-labelledby="t-stats"]').textContent()).includes('30'), 'Tu temporada: 30 puntos');
    ok(!/nivel|posici[oó]n/i.test(await p.textContent('main, .mz')), 'Mi zona: ni niveles ni posiciones (D39)');
    ok(await sinDesbordar(), 'Mi zona: sin desbordamiento');
    await captura(p, `real_mizona_${etiqueta}`);
    ok(errores.length === 0, 'acceso y Mi zona: sin errores de JavaScript', errores.join(' | '));
    await c.close();

    // gestor: panel de la semana
    const cg = await nuevo();
    const g = await cg.newPage();
    const errG = [];
    g.on('pageerror', (e) => errG.push(String(e)));
    await entrar(g, gestorEmail);
    ok(g.url().endsWith('/gestion'), 'un gestor entra en /gestion', g.url());
    ok((await g.textContent('.gs-eyebrow')).includes('Panel de gestión') && /Jornada \d+/.test(await g.textContent('h1')), 'panel: "Jornada N" de la semana');
    ok((await g.locator('section[aria-label="Rutinas semanales"] .gs-caja').count()) === 3, 'panel: rutinas A, B y C');
    ok((await g.locator('[aria-labelledby="t-prox"] .eq-partido').count()) >= 1, 'panel: partidos del domingo');
    ok(await g.locator('[data-testid="hueco-sporteasy"]').isVisible(), 'panel: hueco del entreno con datos de SportEasy (paso 2)');
    ok((await g.locator('.gs-pendientes li').count()) >= 1, 'panel: pendientes de la semana');
    const menuEntero = await g.evaluate(() => [...document.querySelectorAll('nav[aria-label="Gestión"] a')].every((e) => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth + 1; }));
    ok(menuEntero, 'el menu de gestion no se corta');
    ok(await g.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'panel: sin desbordamiento');
    await captura(g, `real_gestion_${etiqueta}`);
    ok(errG.length === 0, 'gestion: sin errores de JavaScript', errG.join(' | '));
    await cg.close();
  }
} finally {
  if (nav) await nav.close();
  if (app) app.kill();
  await pila.parar();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
