#!/usr/bin/env node
// Migracion de Liga (paso 2, entrega 1): la web nueva (/liga...) tiene que dar LOS MISMOS NUMEROS que la de GitHub Pages
// (index.html), temporada a temporada. Se abren las dos con Chrome, se leen las celdas visibles de cada tabla y se comparan.
// Sin Postgres: la web publica no usa Supabase.
//
//   npm run build && npm run pruebas:cuadre
//
// Escribe el cuadre en privado/cuadre/liga.md (fuera de git; el resumen va en el PR) y capturas en privado/mockups_liga/rediseno/liga/.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { desfasadas } from '../scripts/sincronizar_equipacion.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.join(RAIZ, '..');
const SALIDA = path.join(REPO, 'privado', 'mockups_liga', 'rediseno', 'liga');
fs.mkdirSync(SALIDA, { recursive: true });
fs.mkdirSync(path.join(REPO, 'privado', 'cuadre'), { recursive: true });
const PUERTO = 3210, PUERTO_PAGES = 3211;
const APP = `http://127.0.0.1:${PUERTO}`, PAGES = `http://127.0.0.1:${PUERTO_PAGES}`;
const HOY = '2026-10-07';
const indice = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'index.json'), 'utf8'));
const TEMPORADAS = indice.seasons.map((s) => s.id);
const RIV = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'rivales_2026-27_web.json'), 'utf8')).rivales;
const conFicha = (g) => RIV.find((r) => r.grupo === g && !r.sin_rastro).id;

let fallos = 0, comprobaciones = 0, elementos = 0;
const ok = (c, m, d = '') => { comprobaciones++; if (!c) { fallos++; console.log(`  FALLO ${m}${d ? ' -> ' + d : ''}`); } };
const seccion = (t) => console.log(`\n== ${t}`);
const esperar = async (url, ms = 60000) => { const fin = Date.now() + ms; while (Date.now() < fin) { try { const r = await fetch(url); if (r.status < 500) return; } catch {} await new Promise((r) => setTimeout(r, 300)); } throw new Error(`${url} no arranca`); };

// Web anterior: el repo tal cual, como la sirve GitHub Pages.
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png' };
const pages = http.createServer((req, res) => {
  const f = path.join(REPO, decodeURIComponent(new URL(req.url, PAGES).pathname));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] ?? 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(PUERTO_PAGES, '127.0.0.1');

const next = path.join(RAIZ, 'node_modules', 'next', 'dist', 'bin', 'next');
const app = spawn(process.execPath, [next, 'start', '-p', String(PUERTO), '-H', '127.0.0.1'], { cwd: RAIZ, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, stdio: 'ignore' });
let nav;
const salir = async (code) => { try { await nav?.close(); } catch {} app.kill(); pages.close(); process.exit(code); };

// ---------------------------------------------------------------------------------------------- lectura de celdas visibles
const norm = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();
/** Filas de una tabla como listas de celdas visibles (las columnas que la web anterior oculta con CSS no cuentan). */
const filas = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s + ' tr')].map((tr) =>
  [...tr.children].filter((c) => c.getClientRects().length).map((c) => c.innerText.replace(/\s+/g, ' ').trim().toLowerCase())).filter((r) => r.length), sel);
const textos = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length).map((e) => e.innerText.replace(/\s+/g, ' ').trim().toLowerCase()), sel);
function igual(a, b, que) {
  elementos += Array.isArray(a) ? a.length : 1;
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa === sb) { ok(true, que); return true; }
  let i = 0; const A = Array.isArray(a) ? a : [a], B = Array.isArray(b) ? b : [b];
  while (i < Math.max(A.length, B.length) && JSON.stringify(A[i]) === JSON.stringify(B[i])) i++;
  ok(false, que, `difiere en el elemento ${i}: anterior=${JSON.stringify(A[i])} nueva=${JSON.stringify(B[i])}`);
  return false;
}

const cuadre = []; // filas del cuadre de jugadores: [temporada, jugador, anterior, nueva]
try {
  seccion('Copias generadas de src/data/ = fuente en data/');
  ok(desfasadas().length === 0, 'plataforma/src/data/ (incluida estadisticas/) coincide con data/ (npm run datos:sync)', desfasadas().join(', '));
  await esperar(`${APP}/liga`);
  nav =await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 1000 } });
  const errores = [];
  const nueva = await ctx.newPage(), vieja = await ctx.newPage();
  for (const p of [nueva, vieja]) { p.on('pageerror', (e) => errores.push(String(e))); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errores.push(m.text()); }); }

  const abrirVieja = async (t, pestana, extra = '') => {
    await vieja.goto(`${PAGES}/index.html?t=${t}&p=${pestana}${extra}`, { waitUntil: 'networkidle' });
    await vieja.waitForSelector('#app', { state: 'visible' });
    const b = vieja.locator(`.tab[data-p="${pestana}"]`);
    if (await b.isVisible()) await b.click();
  };
  const abrirNueva = (t, pestana) => nueva.goto(`${APP}/liga/${t}/${pestana}`, { waitUntil: 'networkidle' });
  const clic = async (page, sel, texto) => { await page.locator(sel, { hasText: new RegExp(`^${texto}$`, 'i') }).first().click(); };

  // ------------------------------------------------------------------------------------------ Equipo
  seccion('Equipo: balance, racha, partidos y boxscore (las 12 temporadas)');
  for (const t of TEMPORADAS) {
    await abrirVieja(t, 'equipo'); await abrirNueva(t, 'equipo');
    igual(await textos(vieja, '#kpis .kpi'), await textos(nueva, '[data-testid="equipo-kpis"] .e-kpi'), `${t} equipo: KPIs`);
    igual(await textos(vieja, '#form .pill'), await textos(nueva, '[data-testid="equipo-racha"] .e-pastilla'), `${t} equipo: racha`);
    const fa = await filas(vieja, '#tbody'), fb = await filas(nueva, '[data-testid="equipo-partidos"] tbody');
    igual(fa, fb, `${t} equipo: ${fa.length} partidos`);
    // boxscore de los 3 primeros partidos con boxscore
    const n = await vieja.locator('#tbody tr.gmrow').count();
    for (let i = 0; i < Math.min(3, n); i++) {
      await vieja.locator('#tbody tr.gmrow').nth(i).click();
      await nueva.locator('[data-testid="equipo-partidos"] tbody tr.e-fila-click').nth(i).click();
      igual(await filas(vieja, '#tbody .boxrow'), await filas(nueva, '[data-testid="boxscore"]'), `${t} equipo: boxscore del partido ${i + 1}`);
      await vieja.locator('#tbody tr.gmrow').nth(i).click();
      await nueva.locator('[data-testid="equipo-partidos"] tbody tr.e-fila-click').nth(i).click();
    }
  }
  // filtros y orden (2025/26): MdA, playoff y orden por diferencia
  await abrirVieja('2025-26', 'equipo'); await abrirNueva('2025-26', 'equipo');
  await vieja.click('#segTeam button[data-t="MDA"]'); await clic(nueva, '.e-segmento button', 'MdA');
  igual(await textos(vieja, '#kpis .kpi'), await textos(nueva, '[data-testid="equipo-kpis"] .e-kpi'), '2025-26 equipo MdA: KPIs');
  await vieja.click('#tbl th[data-k="dif"]'); await nueva.locator('[data-testid="equipo-partidos"] th button', { hasText: /^Dif$/ }).click();
  igual(await filas(vieja, '#tbody'), await filas(nueva, '[data-testid="equipo-partidos"] tbody'), '2025-26 equipo MdA ordenado por Dif');

  // ------------------------------------------------------------------------------------------ Jugadores
  seccion('Jugadores: tabla de plantilla (las 12 temporadas), filtros y orden');
  for (const t of TEMPORADAS) {
    await abrirVieja(t, 'jugadores'); await abrirNueva(t, 'jugadores');
    const fa = (await filas(vieja, '#ptbody')), fb = (await filas(nueva, '[data-testid="jugadores-tabla"] tbody'));
    igual(fa, fb, `${t} jugadores: ${fa.length} jugadores`);
    if (['2025-26', '2023-24', '2017-18'].includes(t)) {
      // los 5 primeros por puntos, para el cuadre del PR
      for (let i = 0; i < Math.min(5, fa.length); i++) cuadre.push([t, fa[i][1], fa[i].slice(2).join(' · '), (fb[i] ?? []).slice(2).join(' · ')]);
    }
  }
  await abrirVieja('2025-26', 'jugadores'); await abrirNueva('2025-26', 'jugadores');
  await vieja.click('#segTeamP button[data-t="MDL"]'); await clic(nueva, '.e-segmento button', 'MdL');
  await vieja.evaluate(() => { const r = document.getElementById('minpj'); r.value = 5; r.dispatchEvent(new Event('input')); });
  await nueva.locator('input[type=range]').evaluate((el) => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(el, '5'); el.dispatchEvent(new Event('input', { bubbles: true })); });
  await vieja.click('#ptbl th[data-k="min"]'); await nueva.locator('[data-testid="jugadores-tabla"] th button', { hasText: /^Min$/ }).click();
  igual(await filas(vieja, '#ptbody'), await filas(nueva, '[data-testid="jugadores-tabla"] tbody'), '2025-26 jugadores MdL, 5+ partidos, por minutos');
  igual(await textos(vieja, '#ptag'), await textos(nueva, '.e-tag'), '2025-26 jugadores: contador');

  // ------------------------------------------------------------------------------------------ Rankings
  seccion('Rankings: todas las tarjetas (las 12 temporadas)');
  for (const t of TEMPORADAS) {
    await abrirVieja(t, 'rankings'); await abrirNueva(t, 'rankings');
    const lee = (page, sel, fila, nombre, val) => page.evaluate(([s, f, n, v]) => [...document.querySelectorAll(s)].map((c) => [c.querySelector('h4,h3').innerText.replace(/\s+/g, ' ').toLowerCase(), ...[...c.querySelectorAll(f)].map((r) => r.querySelector(n).innerText.toLowerCase() + '=' + r.querySelector(v).innerText)]), [sel, fila, nombre, val]);
    igual(await lee(vieja, '#rankgrid .rankcard', '.rankrow', '.nm', '.vl'), await lee(nueva, '[data-testid="rankings"] .e-rankcard', '.e-rankrow', '.e-rank-nom', '.e-rank-val'), `${t} rankings: top 10`);
  }
  await abrirVieja('2025-26', 'rankings'); await abrirNueva('2025-26', 'rankings');
  await vieja.click('#segTop button[data-n="5"]'); await clic(nueva, '.e-segmento button', 'Top 5');
  await vieja.click('#segTeamR button[data-t="MDA"]'); await clic(nueva, '.e-segmento button', 'MdA');
  {
    const lee = (page, sel, fila, nombre, val) => page.evaluate(([s, f, n, v]) => [...document.querySelectorAll(s)].map((c) => [c.querySelector('h4,h3').innerText.replace(/\s+/g, ' ').toLowerCase(), ...[...c.querySelectorAll(f)].map((r) => r.querySelector(n).innerText.toLowerCase() + '=' + r.querySelector(v).innerText)]), [sel, fila, nombre, val]);
    igual(await lee(vieja, '#rankgrid .rankcard', '.rankrow', '.nm', '.vl'), await lee(nueva, '[data-testid="rankings"] .e-rankcard', '.e-rankrow', '.e-rank-nom', '.e-rank-val'), '2025-26 rankings MdA, top 5');
  }

  // ------------------------------------------------------------------------------------------ Cuartos
  seccion('Por cuartos');
  for (const t of TEMPORADAS) {
    await abrirVieja(t, 'cuartos');
    const hay = await vieja.locator('.tab[data-p="cuartos"]').isVisible();
    const r = await nueva.goto(`${APP}/liga/${t}/cuartos`, { waitUntil: 'networkidle' });
    if (!hay) { ok(/\/liga\/[^/]+\/equipo$/.test(nueva.url()), `${t} cuartos: no existe, la web nueva lleva a Equipo`, nueva.url()); continue; }
    ok(r.status() === 200, `${t} cuartos: existe en las dos`);
    for (const eq of (await vieja.locator('#segTeamQ').isVisible()) ? ['ALL', 'MDA', 'MDL'] : ['ALL']) {
      if (eq !== 'ALL') { await vieja.click(`#segTeamQ button[data-t="${eq}"]`); await clic(nueva, '.e-segmento button', eq === 'MDA' ? 'MdA' : 'MdL'); }
      igual(await textos(vieja, '#qcards .kpi'), await textos(nueva, '[data-testid="cuartos-kpis"] .e-kpi'), `${t} cuartos ${eq}: tarjetas`);
      igual(await textos(vieja, '#qchart .qbar'), await textos(nueva, '[data-testid="cuartos-grafico"] .e-qbar'), `${t} cuartos ${eq}: anotados y encajados`);
    }
  }

  // ------------------------------------------------------------------------------------------ Asistencia
  seccion('Asistencia (solo asistidos, total y %)');
  for (const t of TEMPORADAS) {
    await abrirVieja(t, 'asistencia');
    const hay = await vieja.locator('.tab[data-p="asistencia"]').isVisible();
    await nueva.goto(`${APP}/liga/${t}/asistencia`, { waitUntil: 'networkidle' });
    if (!hay) { ok(/\/equipo$/.test(nueva.url()), `${t} asistencia: no existe, la web nueva lleva a Equipo`); continue; }
    for (const [v, nombreV] of [['part', 'Partidos'], ['entr', 'Entrenamientos']]) {
      if (v === 'entr') { await vieja.click('#segAsis button[data-a="entr"]'); await clic(nueva, '.e-segmento button', nombreV); }
      igual(await filas(vieja, '#asisBody'), await filas(nueva, '[data-testid="asistencia-tabla"] tbody'), `${t} asistencia ${nombreV}`);
    }
    const cab = await textos(nueva, '[data-testid="asistencia-tabla"] thead th');
    ok(!cab.some((c) => /excusa|lesi|conv|sel/.test(c)), `${t} asistencia: sin columnas de motivos`, cab.join(','));
  }

  // ------------------------------------------------------------------------------------------ MdA
  seccion('MdA (23/24 y 24/25)');
  for (const t of TEMPORADAS) {
    await abrirVieja(t, 'mda');
    const hay = await vieja.locator('.tab[data-p="mda"]').isVisible();
    await nueva.goto(`${APP}/liga/${t}/mda`, { waitUntil: 'networkidle' });
    if (!hay) { ok(/\/equipo$/.test(nueva.url()), `${t} mda: no existe, la web nueva lleva a Equipo`); continue; }
    igual(await filas(vieja, '#mdaBody'), await filas(nueva, '[data-testid="mda-tabla"] tbody'), `${t} MdA: resumen`);
    igual(await textos(vieja, '#mdaCuartos .qbar'), await textos(nueva, '[data-testid="mda-cuartos"] .e-qbar'), `${t} MdA: cuartos`);
    igual((await textos(vieja, '#mdaNota'))[0], (await textos(nueva, '.e-nota'))[0], `${t} MdA: nota`);
  }

  // ------------------------------------------------------------------------------------------ Liga 26/27
  seccion('Liga 26/27: clasificacion, resultados de todas las jornadas y fichas de equipo');
  await vieja.goto(`${PAGES}/index.html?p=liga&hoy=${HOY}`, { waitUntil: 'networkidle' });
  await vieja.waitForSelector('#lgTabla tbody tr');
  await nueva.goto(`${APP}/liga?hoy=${HOY}`, { waitUntil: 'networkidle' });
  igual(await textos(vieja, '#lgProx .eqp .v'), await textos(nueva, '[data-testid="liga-proximos"] .e-eqp-v'), 'proximos partidos: rival');
  igual(await textos(vieja, '#lgProx .eqp .s'), await textos(nueva, '[data-testid="liga-proximos"] .e-eqp-s'), 'proximos partidos: dia, hora y pista');
  igual(await textos(vieja, '#lgProx .eqp .eqcol'), await textos(nueva, '[data-testid="liga-proximos"] .e-eqcol'), 'proximos partidos: colores');
  for (const g of ['G1', 'G2']) {
    if (g === 'G2') { await vieja.click('#segLgGrupo button[data-g="G2"]'); await clic(nueva, '.e-segmento button', 'G2 · MdL'); }
    igual(await filas(vieja, '#lgTabla'), await filas(nueva, '[data-testid="liga-clasificacion"]'), `${g}: clasificacion`);
    const js = await vieja.locator('#lgJor button').allInnerTexts();
    for (const j of js) {
      await vieja.locator('#lgJor button', { hasText: new RegExp(`^${j}$`) }).click();
      await nueva.locator('.e-jornadas button', { hasText: new RegExp(`^${j}$`) }).click();
      igual(await textos(vieja, '#lgRes .lgpart'), await textos(nueva, '[data-testid="liga-resultados"] .e-partido'), `${g} ${j}: resultados`);
    }
    const equipos = await vieja.locator('#lgSel option').allInnerTexts();
    for (const e of equipos) {
      await vieja.selectOption('#lgSel', e); await nueva.selectOption('#lg-equipo', e);
      const kv = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((k) => k.innerText.replace(/\s+/g, ' ').toLowerCase()), sel);
      igual(await kv(vieja, '#lgFicha .kpi'), await kv(nueva, '[data-testid="liga-ficha"] .e-kpi'), `${g} ${e}: ficha, indicadores`);
      igual(await kv(vieja, '#lgFicha .lgmini'), await kv(nueva, '[data-testid="liga-ficha"] .e-mini'), `${g} ${e}: ficha, casa y fuera`);
    }
  }

  // ------------------------------------------------------------------------------------------ Rivales
  seccion('Rivales 26/27: tarjetas y fichas');
  for (const g of ['MdA', 'MdL']) {
    await vieja.goto(`${PAGES}/index.html?p=rivales&g=${g}`, { waitUntil: 'networkidle' });
    await vieja.waitForSelector('#rvGrid .rvcard');
    await nueva.goto(`${APP}/liga/rivales?g=${g}`, { waitUntil: 'networkidle' });
    igual(await textos(vieja, '#rvEsencial li'), await textos(nueva, '[data-testid="rivales-esencial"] li'), `${g}: lo esencial`);
    igual(await textos(vieja, '#rvGrid .rvcard'), await textos(nueva, '[data-testid="rivales-lista"] .e-rv'), `${g}: tarjetas`);
    const ids = await vieja.locator('#rvGrid .rvcard[data-id]').evaluateAll((els) => els.map((e) => e.dataset.id));
    for (const id of ids.slice(0, 20)) {
      await vieja.locator(`#rvGrid .rvcard[data-id="${id}"]`).click();
      await nueva.goto(`${APP}/liga/rivales?g=${g}&r=${id}`, { waitUntil: 'networkidle' });
      igual(await filas(vieja, '#rvModal .tbl-wrap tbody'), await filas(nueva, '[data-testid="rivales-ficha"] tbody'), `${g} ${id}: trayectoria y cara a cara`);
      igual(await textos(vieja, '#rvModal .rvgp'), await textos(nueva, '[data-testid="rivales-ficha"] .e-gp'), `${g} ${id}: balance`);
      await vieja.keyboard.press('Escape');
    }
  }

  // ------------------------------------------------------------------------------------------ redirecciones
  seccion('URL antiguas de GitHub Pages -> pagina nueva');
  const fuenteRedir = fs.readFileSync(path.join(REPO, 'data', 'redireccion_web.js'), 'utf8');
  const { createRequire } = await import('node:module');
  const R = createRequire(import.meta.url)(path.join(REPO, 'data', 'redireccion_web.js'));
  ok(R.ESTA_ACTIVA === false, 'la redireccion esta desactivada hasta el OK final de Ivan (GitHub Pages sigue publicada)');
  ok(/<script src="data\/redireccion_web\.js"><\/script>/.test(fs.readFileSync(path.join(REPO, 'index.html'), 'utf8')), 'index.html carga data/redireccion_web.js');
  const antiguas = [
    '', '?t=2023-24', '#2013-14', '?t=2013-14&p=jugadores', '?p=equipo&t=2016-17', '?t=2025-26&p=rankings', '?p=cuartos', '?p=asistencia&t=2025-26', '?p=mda&t=2024-25',
    '?p=liga', '?p=liga&g=G2', `?p=liga&hoy=${HOY}`, '?p=rivales', '?p=rivales&g=MdL', `?p=rivales&g=MdA&r=${conFicha('MdA')}`,
  ];
  for (const a of antiguas) {
    const [search, hash] = a.startsWith('#') ? ['', a] : [a, ''];
    const d = R.nuevaUrl(search, hash);
    ok(d !== null, `antigua ${a || '(portada de GitHub Pages)'} tiene destino`, String(d));
    if (d) { const r = await fetch(APP + d, { redirect: 'follow' }); ok(r.status === 200, `antigua ${a || '(sin parametros)'} -> ${d}: 200`, String(r.status)); }
  }
  for (const a of ['?p=historia', '?p=jugador&j=esteban-jon&t=2025-26', '?j=esteban-jon']) ok(R.nuevaUrl(a, '') === null, `${a}: aun no migrada, sigue en GitHub Pages`);
  // con la redireccion activada, la propia pagina antigua salta a la nueva
  await vieja.route('**/data/redireccion_web.js', (route) => route.fulfill({ contentType: 'text/javascript', body: fuenteRedir.replace('var ESTA_ACTIVA = false', 'var ESTA_ACTIVA = true').replace("'https://maccabis.vercel.app'", `'${APP}'`) }));
  await vieja.goto(`${PAGES}/index.html?t=2023-24&p=rankings`, { waitUntil: 'commit' });
  await vieja.waitForURL(`${APP}/liga/2023-24/rankings`, { timeout: 15000 }).catch(() => {});
  ok(vieja.url() === `${APP}/liga/2023-24/rankings`, 'activada: ?t=2023-24&p=rankings salta a /liga/2023-24/rankings', vieja.url());
  await vieja.goto(`${PAGES}/index.html?p=historia`, { waitUntil: 'networkidle' });
  ok(vieja.url().startsWith(PAGES), 'activada: ?p=historia se queda en GitHub Pages (aun no migrada)', vieja.url());
  await vieja.unroute('**/data/redireccion_web.js');

  // ------------------------------------------------------------------------------------------ movil, consola y capturas
  seccion('Movil a 375 px, errores de consola y capturas');
  const rutas = ['/liga', '/liga/rivales', `/liga/rivales?g=MdL&r=${conFicha('MdL')}`, ...TEMPORADAS.flatMap((t) => ['equipo', 'jugadores', 'rankings', 'cuartos', 'asistencia', 'mda'].map((p) => `/liga/${t}/${p}`))];
  const movil = await nav.newPage({ viewport: { width: 375, height: 800 } });
  movil.on('pageerror', (e) => errores.push(String(e)));
  movil.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errores.push(m.text()); });
  let desbordan = [];
  for (const r of rutas) {
    await movil.goto(APP + r, { waitUntil: 'networkidle' });
    const d = await movil.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (d > 0) desbordan.push(`${r} (+${d}px)`);
  }
  ok(desbordan.length === 0, `sin desbordamiento horizontal en ${rutas.length} paginas a 375 px`, desbordan.join(', '));
  // con la ficha de un rival y el boxscore abiertos tambien
  await movil.goto(`${APP}/liga/rivales?g=MdA&r=${conFicha('MdA')}`, { waitUntil: 'networkidle' });
  ok((await movil.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0, 'ficha de rival abierta a 375 px sin desbordamiento');
  await movil.goto(`${APP}/liga/2025-26/equipo`, { waitUntil: 'networkidle' });
  await movil.locator('tr.e-fila-click').first().click();
  ok((await movil.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0, 'boxscore abierto a 375 px sin desbordamiento');
  for (const [r, n] of [['/liga', 'liga'], ['/liga/rivales', 'rivales'], ['/liga/2025-26/equipo', 'equipo'], ['/liga/2025-26/jugadores', 'jugadores'], ['/liga/2025-26/rankings', 'rankings'], ['/liga/2025-26/cuartos', 'cuartos'], ['/liga/2025-26/asistencia', 'asistencia'], ['/liga/2023-24/mda', 'mda'], ['/liga/2013-14/jugadores', 'jugadores_2013']]) {
    await movil.goto(APP + r + (r === '/liga' ? '?hoy=' + HOY : ''), { waitUntil: 'networkidle' });
    await movil.screenshot({ path: path.join(SALIDA, `${n}_375.png`), fullPage: true });
    await nueva.setViewportSize({ width: 1280, height: 900 });
    await nueva.goto(APP + r + (r === '/liga' ? '?hoy=' + HOY : ''), { waitUntil: 'networkidle' });
    await nueva.screenshot({ path: path.join(SALIDA, `${n}_escritorio.png`), fullPage: true });
  }
  ok(errores.length === 0, 'sin errores de consola ni de JS', errores.slice(0, 3).join(' | '));

  // ------------------------------------------------------------------------------------------ resumen
  const md = ['# Cuadre Liga: web nueva vs GitHub Pages', '', `Comprobaciones: ${comprobaciones}, fallos: ${fallos}`, '', '| Temporada | Jugador | GitHub Pages (PJ, Pts, Med, Min, ...) | Web nueva |', '|---|---|---|---|', ...cuadre.map((c) => `| ${c[0]} | ${c[1]} | ${c[2]} | ${c[3]} |`)];
  fs.writeFileSync(path.join(REPO, 'privado', 'cuadre', 'liga.md'), md.join('\n') + '\n');
  console.log(`\n${comprobaciones} comprobaciones (${elementos} filas o bloques comparados), ${fallos} fallo(s). Cuadre en privado/cuadre/liga.md`);
  await salir(fallos ? 1 : 0);
} catch (e) {
  console.error(e);
  await salir(1);
}
