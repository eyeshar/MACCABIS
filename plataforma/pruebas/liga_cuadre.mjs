#!/usr/bin/env node
// Migracion de Liga (paso 2, entrega 1): la web nueva (/liga...) tiene que dar LOS MISMOS NUMEROS que la de GitHub Pages
// (index.html), temporada a temporada. Se abren las dos con Chrome, se leen las celdas visibles de cada tabla y se comparan.
// Sin Postgres: la web publica no usa Supabase.
//
//   npm run pruebas:cuadre        (compila la web si hace falta; secciones en paralelo: CUADRE_HILOS, por defecto 6)
//
// Escribe el cuadre en privado/cuadre/liga.md (fuera de git; el resumen va en el PR) y capturas en privado/mockups_liga/rediseno/liga/.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { AsyncLocalStorage } from 'node:async_hooks';
import { desfasadas } from '../scripts/sincronizar_equipacion.mjs';
import { arrancarApp, abrirNavegador, conCapturas } from './infra/app.mjs';
import { PUERTOS, exigirLibres } from './infra/puertos.mjs';
import { entornoPila } from './pila.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.join(RAIZ, '..');
const SALIDA = path.join(REPO, 'privado', 'mockups_liga', 'rediseno', 'liga');
if (conCapturas()) fs.mkdirSync(SALIDA, { recursive: true });
fs.mkdirSync(path.join(REPO, 'privado', 'cuadre'), { recursive: true });
const PUERTO = PUERTOS.app, PUERTO_PAGES = PUERTOS.app2;
await exigirLibres({ 'web anterior': PUERTO_PAGES });
const APP = `http://127.0.0.1:${PUERTO}`, PAGES = `http://127.0.0.1:${PUERTO_PAGES}`;
const HOY = '2026-10-07';
const indice = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'index.json'), 'utf8'));
const TEMPORADAS = indice.seasons.map((s) => s.id);
const R = createRequire(import.meta.url)(path.join(REPO, 'data', 'redireccion_web.js'));
const RIV = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'rivales_2026-27_web.json'), 'utf8')).rivales;
const PRIMERO = Object.fromEntries(TEMPORADAS.map((t) => [t, JSON.parse(fs.readFileSync(path.join(REPO, 'data', `season_${t}.json`), 'utf8')).players[0].person_id]));
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

// La web publica no usa la base: se compila (si hace falta) con el mismo entorno que las demas suites, sin arrancar pila.
const app = await arrancarApp({ puerto: PUERTO, env: await entornoPila() });
let nav;
const salir = async (code) => { try { await nav?.close(); } catch {} app.parar(); pages.close(); process.exit(code); };

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

// Cada seccion es una tarea; lo que imprime va a su propia salida (AsyncLocalStorage) y se vuelca al final en orden.
const salidaDe = new AsyncLocalStorage();
const logConsola = console.log.bind(console);
console.log = (...a) => { const s = salidaDe.getStore(); if (s) s.push(a.join(' ')); else logConsola(...a); };
const tareas = [];
const tarea = (nombre, fn) => tareas.push({ nombre, fn });

const cuadre = []; // filas del cuadre de jugadores: [temporada, jugador, anterior, nueva]
try {
  seccion('Copias generadas de src/data/ = fuente en data/');
  ok(desfasadas().length === 0, 'plataforma/src/data/ (incluida estadisticas/) coincide con data/ (npm run datos:sync)', desfasadas().join(', '));
  await esperar(`${APP}/liga`);
  nav = await abrirNavegador();
  const errores = [];
  // Las secciones van en paralelo (D149): cada una con su pareja de pestañas (web anterior y nueva) y su salida aparte, que
  // se imprime al final en el orden de siempre. Las comprobaciones son las mismas que cuando iban una detras de otra.
  const paginas = async () => {
    const ctx = await nav.newContext({ viewport: { width: 1280, height: 1000 } });
    const nueva = await ctx.newPage(), vieja = await ctx.newPage();
    // El cuadre compara con la web anterior tal cual: aunque la redireccion este activada, aqui no salta.
    await vieja.route('**/data/redireccion_web.js', (route) => route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(REPO, 'data', 'redireccion_web.js'), 'utf8').replace('var ESTA_ACTIVA = true', 'var ESTA_ACTIVA = false') }));
    for (const p of [nueva, vieja]) { p.on('pageerror', (e) => errores.push(String(e))); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errores.push(m.text()); }); }
    const abrirVieja = async (t, pestana, extra = '') => {
      await vieja.goto(`${PAGES}/index.html?t=${t}&p=${pestana}${extra}`, { waitUntil: 'networkidle' });
      await vieja.waitForSelector('#app', { state: 'visible' });
      const b = vieja.locator(`.tab[data-p="${pestana}"]`);
      if (await b.isVisible()) await b.click();
    };
    const abrirNueva = (t, pestana) => nueva.goto(pestana === 'jugadores' ? `${APP}/plantilla?t=${t}` : `${APP}/liga/${t}/${pestana}`, { waitUntil: 'networkidle' });
    return { ctx, nueva, vieja, abrirVieja, abrirNueva };
  };
  const clic = async (page, sel, texto) => { await page.locator(sel, { hasText: new RegExp(`^${texto}$`, 'i') }).first().click(); };

  // ------------------------------------------------------------------------------------------ Equipo
  for (const t of TEMPORADAS) tarea(`Equipo ${t}`, async ({ vieja, nueva, abrirVieja, abrirNueva }) => {
    if (t === TEMPORADAS[0]) seccion('Equipo: balance, racha, partidos y boxscore (las 12 temporadas)');
    {
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
  });
  tarea('Equipo: filtros', async ({ vieja, nueva, abrirVieja, abrirNueva }) => {
    // filtros y orden (2025/26): MdA, playoff y orden por diferencia
    await abrirVieja('2025-26', 'equipo'); await abrirNueva('2025-26', 'equipo');
    await vieja.click('#segTeam button[data-t="MDA"]'); await clic(nueva, '.e-segmento button', 'MdA');
    igual(await textos(vieja, '#kpis .kpi'), await textos(nueva, '[data-testid="equipo-kpis"] .e-kpi'), '2025-26 equipo MdA: KPIs');
    await vieja.click('#tbl th[data-k="dif"]'); await nueva.locator('[data-testid="equipo-partidos"] th button', { hasText: /^Dif$/ }).click();
    igual(await filas(vieja, '#tbody'), await filas(nueva, '[data-testid="equipo-partidos"] tbody'), '2025-26 equipo MdA ordenado por Dif');
  });

  // ------------------------------------------------------------------------------------------ Jugadores
  tarea('Jugadores', async ({ vieja, nueva, abrirVieja, abrirNueva }) => {
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
  });

  // ------------------------------------------------------------------------------------------ Rankings
  tarea('Rankings', async ({ vieja, nueva, abrirVieja, abrirNueva }) => {
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
  });

  // ------------------------------------------------------------------------------------------ Cuartos
  tarea('Cuartos', async ({ vieja, nueva, abrirVieja, abrirNueva }) => {
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
  });

  // ------------------------------------------------------------------------------------------ Asistencia
  tarea('Asistencia', async ({ vieja, nueva, abrirVieja, abrirNueva }) => {
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
  });

  // ------------------------------------------------------------------------------------------ MdA
  tarea('MdA', async ({ vieja, nueva, abrirVieja, abrirNueva }) => {
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
  });

  // ------------------------------------------------------------------------------------------ Liga 26/27
  tarea('Liga 26/27', async ({ vieja, nueva, abrirVieja, abrirNueva }) => {
    seccion('Liga 26/27: clasificacion, resultados de todas las jornadas y fichas de equipo');
    await vieja.goto(`${PAGES}/index.html?p=liga&hoy=${HOY}`, { waitUntil: 'networkidle' });
    await vieja.waitForSelector('#lgTabla tbody tr');
    await nueva.goto(`${APP}/liga?hoy=${HOY}`, { waitUntil: 'networkidle' });
    // D129: la web nueva ya no dice «vs/en» ni «en casa/fuera» (el cartel va en el orden del calendario oficial); se
    // comparan el rival, el dia, la hora y la pista.
    const rivalVieja = (t) => t.replace(/^md[al] (vs|en) /, '');
    const rivalNueva = (t) => t.split(' – ').find((x) => !/^md[al]$/.test(x)) ?? t;
    igual((await textos(vieja, '#lgProx .eqp .v')).map(rivalVieja), (await textos(nueva, '[data-testid="liga-proximos"] .e-eqp-v')).map(rivalNueva), 'proximos partidos: rival');
    igual((await textos(vieja, '#lgProx .eqp .s')).map((t) => t.replace(/ · (en casa|fuera)$/, '')), await textos(nueva, '[data-testid="liga-proximos"] .e-eqp-s'), 'proximos partidos: dia, hora y pista (sin «casa/fuera», D129)');
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
        // D129: el bloque «En casa / Fuera» ya no está en la web nueva (todos juegan en Moratalaz): no se compara.
      }
    }
  });

  // ------------------------------------------------------------------------------------------ Rivales
  tarea('Rivales', async ({ vieja, nueva, abrirVieja, abrirNueva }) => {
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
  });

  // ------------------------------------------------------------------------------------------ Ficha de jugador
  let fichas = 0;
  for (const t of TEMPORADAS) {
    tarea(`Ficha de jugador ${t}`, async ({ vieja, nueva, abrirVieja }) => {
      if (t === TEMPORADAS[0]) seccion('Ficha de jugador: todos los jugadores de las 12 temporadas');
      await abrirVieja(t, 'jugador');
      const ids = await vieja.locator('#selPlayer option').evaluateAll((os) => os.map((o) => o.textContent));
      const pids = JSON.parse(fs.readFileSync(path.join(REPO, 'data', `season_${t}.json`), 'utf8')).players;
      const orden = pids.slice().sort((a, b) => a.nombre.localeCompare(b.nombre));
      ok(orden.length === ids.length, `${t} ficha: ${ids.length} jugadores en el selector`);
      for (let i = 0; i < orden.length; i++) {
        await vieja.selectOption('#selPlayer', { index: i });
        await nueva.goto(`${APP}/jugador/${orden[i].person_id}?t=${t}`, { waitUntil: 'domcontentloaded' });
        const a = [await textos(vieja, '#playerCard .playerhead'), await textos(vieja, '#playerCard .kpi'), await filas(vieja, '#playerCard tbody'), await textos(vieja, '#playerCard .note')];
        const b = [await textos(nueva, '.e-cabjugador'), await textos(nueva, '[data-testid="ficha"] .e-kpi'), await filas(nueva, '[data-testid="ficha-partidos"] tbody'), await textos(nueva, '[data-testid="ficha"] > .e-nota')];
        fichas++;
        igual(a, b, `${t} ficha de ${orden[i].person_id}`);
      }
    });
  }
  // enlace por person_id
  tarea('Ficha de jugador: enlace', async ({ vieja, nueva, abrirVieja, abrirNueva }) => {
    await nueva.goto(`${APP}/plantilla?t=2025-26`, { waitUntil: 'networkidle' });
    ok((await nueva.locator('[data-testid="jugadores-tabla"] tbody a[href^="/jugador/"]').count()) === 24, 'plantilla 25/26: los 24 nombres enlazan a su ficha');
    await nueva.locator('[data-testid="jugadores-tabla"] tbody a').first().click();
    await nueva.waitForURL(/\/jugador\/esteban-jon\?t=2025-26/);
    ok(/Jon Esteban/i.test(await nueva.locator('.e-nombre-ficha').innerText()), 'clic en el nombre abre la ficha de esa persona (person_id)');
    const r404 = await fetch(`${APP}/jugador/no-existe`); ok(r404.status === 404, 'ficha de una persona que no existe: 404');
    const rfuera = await fetch(`${APP}/jugador/esteban-jon?t=2013-14`, { redirect: 'manual' }); ok(rfuera.status >= 300 && rfuera.status < 400, 'ficha en una temporada en la que no jugo: lleva a una temporada suya');
  });

  // ------------------------------------------------------------------------------------------ Historia
  tarea('Historia', async ({ vieja, nueva, abrirVieja, abrirNueva }) => {
    // Desde D137 (26/10/2026) la 26/27 es «en curso» en /historia y GitHub Pages (que solo redirige) se queda con la 26/27
    // «prevista»: ya no se compara fila a fila con la web antigua. El cuadre de la rejilla con season_2026-27.json y la
    // plantilla con ficha lo hace npm run check:historia (scripts/test_historia_en_curso.js).
    seccion('Historia del club: tramos, tira temporal y enlaces de la ficha de cada persona (D137: ya no se compara con GitHub Pages)');
    await nueva.goto(`${APP}/historia`, { waitUntil: 'networkidle' });
    const kp = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((e) => e.innerText.replace(/\s+/g, ' ').trim().toLowerCase()), sel);
    const seps = await kp(nueva, '[data-testid="historia-rejilla"] tr.e-hsep');
    ok(seps.length === 5 && seps.some((x) => /^cuerpo técnico/.test(x)) && !seps.some((x) => /llegan/.test(x)), 'D22/D137: 4 tramos de veteranía y el cuerpo técnico aparte, sin «Llegan en 26/27»', seps.join(' | '));
    ok(/26\/27\s*en curso/.test((await kp(nueva, '[data-testid="historia-rejilla"] thead th.e-hcurso'))[0] || ''), 'D137: la columna 26/27 dice «en curso»');
    await clic(nueva, '.e-segmento button', 'Año de incorporación');
    const sepsD = await kp(nueva, '[data-testid="historia-rejilla"] tr.e-hsep');
    ok(sepsD.length === 1 && /cuerpo técnico/.test(sepsD[0]), 'D22: en el modo de incorporacion no hay tramos de veteranía; solo la sección de cuerpo técnico');
    await clic(nueva, '.e-segmento button', 'Veteranía');
    await clic(nueva, '.e-segmento button', 'Por temporada');
    ok((await nueva.locator('[data-testid="historia-tira"] .e-htcard').count()) === 14, 'historia: tira temporal con 14 temporadas (la 26/27 en curso)');
    await clic(nueva, '.e-segmento button', 'Rejilla');
    const pids = await nueva.locator('[data-testid="historia-rejilla"] tr[data-pid]').evaluateAll((trs) => trs.map((t) => t.dataset.pid));
    ok(pids.length === 90, `historia: ${pids.length} personas en la rejilla (91 identidades menos un «solo entreno» sin temporadas)`);
    // D166: 386 barras + las 25 temporadas «en el club, sin estadísticas» que salen de la asistencia de SportEasy (OK de Iván)
    const barras = await nueva.locator('[data-testid="historia-rejilla"] tr[data-pid] td.e-hcell:not(:empty)').count();
    ok(barras === 411, `historia: ${barras} barras en la rejilla (386 + 25 de SportEasy)`);
    const castro = await nueva.locator('[data-testid="historia-rejilla"] tr[data-pid="castro-moya-henry-luis"] td.e-hcell').evaluateAll((tds) => tds.map((td) => td.childElementCount > 0));
    ok(castro[2020 - 2013] === true, 'historia: Henry Luis Castro Moya ya tiene la barra de 20/21 (estaba en SportEasy)');
    let sinEnlace = 0, enlaces = 0; const rotos = [], porPedir = [];
    // las fichas de las 87 personas, repartidas en 6 pestañas (una detras de otra eran 3 minutos)
    const TROZOS = 6;
    await Promise.all(Array.from({ length: TROZOS }, async (_, k) => {
      const extra = k ? await paginas() : null;
      const pag = extra ? extra.nueva : nueva;
      if (extra) { await pag.goto(`${APP}/historia`, { waitUntil: 'networkidle' }); await pag.locator('[data-testid="historia-rejilla"] tr[data-pid]').first().waitFor(); }
      for (const pid of pids.filter((_, n) => n % TROZOS === k)) {
        await pag.locator(`[data-testid="historia-rejilla"] tr[data-pid="${pid}"]`).click();
        // cada anio con estadisticas enlaza a una pagina que existe; los de solo presencia no son enlaces
        const hrefs = await pag.locator('[data-testid="historia-ficha"] a.e-hy').evaluateAll((as) => as.map((x) => x.getAttribute('href')));
        const conStats = await pag.locator('[data-testid="historia-ficha"] .e-hy-stats').count();
        sinEnlace += await pag.locator('[data-testid="historia-ficha"] .e-hy-sinenlace').count();
        ok(hrefs.length === conStats - await pag.locator('[data-testid="historia-ficha"] .e-hy-sinenlace').count(), `${pid}: solo las temporadas con estadísticas son enlaces`);
        ok(await pag.locator('[data-testid="historia-ficha"] a.e-hy:not(.e-hy-stats)').count() === 0, `${pid}: ningún año de solo presencia es un enlace`);
        for (const h of hrefs) { enlaces++; porPedir.push([pid, h]); }
        await pag.keyboard.press('Escape');
      }
      await extra?.ctx.close();
    }));
    // y los enlaces, al final, de 8 en 8
    const estado = new Map();
    await Promise.all(Array.from({ length: 8 }, async () => {
      for (let par = porPedir.shift(); par; par = porPedir.shift()) {
        const [pid, h] = par;
        if (!estado.has(h)) estado.set(h, fetch(APP + h).then((r) => r.status));
        const st = await estado.get(h);
        if (st !== 200) rotos.push(`${pid} ${h} ${st}`);
      }
    }));
    ok(rotos.length === 0, `historia: ${enlaces} enlaces desde las fichas de persona, ninguno da 404`, rotos.slice(0, 3).join(' | '));
    ok(sinEnlace === 0, 'historia: toda temporada con estadisticas tiene destino (ficha o resumen MdA)', String(sinEnlace));
    // casos pedidos por Ivan: Eric y Pupo (solo mote), Barreiro (cuerpo tecnico), Lonchas (fila sin ficha en un boxscore)
    for (const [pid, dice] of [['eric', /de paso/i], ['pupo', /de paso/i], ['cardoza-jaylin', /de paso/i], ['barreiro-carballal-carlos-jose', /entrenador/i]]) {
      await nueva.goto(`${APP}/historia?persona=${pid}`, { waitUntil: 'networkidle' });
      ok(dice.test(await nueva.locator('[data-testid="historia-ficha"]').innerText()) && (await nueva.locator('[data-testid="historia-ficha"] a.e-hy').count()) === 0, `${pid}: ficha de persona sin estadisticas y sin enlaces`);
    }
    await abrirVieja('2019-20', 'equipo'); await abrirNueva('2019-20', 'equipo');
    const box = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'season_2019-20.json'), 'utf8')).box;
    const claves = Object.entries(box).filter(([, f]) => f.some((g) => /lonchas/i.test((g.mote || '') + g.nombre))).map(([k]) => k);
    ok(claves.length > 0, `Lonchas aparece como fila sin ficha en ${claves.length} boxscores de 2019/20 (no es una persona de la Historia)`);
    for (const k of claves) {
      const [pn, eq] = k.split('_');
      await vieja.locator(`#tbody tr.gmrow[data-pn="${pn}"][data-eq="${eq}"]`).click();
      // la web nueva ordena igual: abrir por posicion en la tabla
      const idx = await vieja.locator('#tbody tr.gmrow').evaluateAll((trs, [p, e]) => trs.findIndex((t) => t.dataset.pn === p && t.dataset.eq === e), [pn, eq]);
      await nueva.locator('[data-testid="equipo-partidos"] tbody tr.e-fila-click').nth(idx).click();
      igual(await filas(vieja, '#tbody .boxrow'), await filas(nueva, '[data-testid="boxscore"]'), `2019-20 boxscore ${k} (con Lonchas)`);
      await vieja.locator(`#tbody tr.gmrow[data-pn="${pn}"][data-eq="${eq}"]`).click();
      await nueva.locator('[data-testid="equipo-partidos"] tbody tr.e-fila-click').nth(idx).click();
    }
  });

  // ------------------------------------------------------------------------------------------ alias (D20)
  tarea('alias (D20)', async ({ vieja, nueva, abrirVieja, abrirNueva }) => {
    seccion('person_id antiguos (alias): redirigen a la identidad canonica');
    const personas = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'personas.json'), 'utf8')).personas;
    const tieneFicha = new Set(TEMPORADAS.flatMap((t) => JSON.parse(fs.readFileSync(path.join(REPO, 'data', `season_${t}.json`), 'utf8')).players.map((x) => x.person_id)));
    const alias = personas.flatMap((p) => p.alias_ids.map((a) => [a, p]));
    ok(alias.length >= 6, `${alias.length} alias en el registro (Castro Mayo, Mar Calvo...)`);
    for (const [a, p] of alias) {
      const r = await fetch(`${APP}/jugador/${a}?t=2024-25`, { redirect: 'manual' });
      ok(r.status >= 300 && r.status < 400 && (r.headers.get('location') || '').includes(`/jugador/${p.person_id}`), `/jugador/${a} -> /jugador/${p.person_id}`, `${r.status} ${r.headers.get('location')}`);
      const fin = await fetch(`${APP}/jugador/${a}?t=2024-25`, { redirect: 'follow' });
      ok(fin.status === (tieneFicha.has(p.person_id) ? 200 : 404), `/jugador/${a}: ficha canonica ${tieneFicha.has(p.person_id) ? 'existe (200)' : 'sin estadisticas (404)'}`, String(fin.status));
      const d = R.nuevaUrl(`?t=2024-25&p=jugador&j=${a}`, '');
      ok(d === `/jugador/${a}?t=2024-25`, `enlace antiguo de GitHub Pages con el alias ${a} tiene destino`, String(d));
    }
    const rh = await fetch(`${APP}/historia?persona=castro-mayo-henry-luis`);
    ok(rh.status === 200 && (await rh.text()).includes('Henry Luis Castro Moya'), '/historia?persona=<alias> abre la ficha de la identidad canonica');
  });

  // ------------------------------------------------------------------------------------------ redirecciones
  tarea('redirecciones', async ({ vieja, nueva, abrirVieja, abrirNueva }) => {
    seccion('URL antiguas de GitHub Pages -> pagina nueva');
    const fuenteRedir = fs.readFileSync(path.join(REPO, 'data', 'redireccion_web.js'), 'utf8');
    ok(typeof R.ESTA_ACTIVA === 'boolean', `la redireccion esta ${R.ESTA_ACTIVA ? 'ACTIVADA' : 'desactivada hasta el OK final de Ivan (GitHub Pages sigue publicada)'}`);
    ok(/<script src="data\/redireccion_web\.js"><\/script>/.test(fs.readFileSync(path.join(REPO, 'index.html'), 'utf8')), 'index.html carga data/redireccion_web.js');
    const antiguas = [
      '', '?t=2023-24', '#2013-14', '?t=2013-14&p=jugadores', '?p=equipo&t=2016-17', '?t=2025-26&p=rankings', '?p=cuartos', '?p=asistencia&t=2025-26', '?p=historia', '?p=jugador', '?p=jugador&j=esteban-jon&t=2025-26', '?j=esteban-jon', '?t=2023-24&p=jugador&j=villaescusa-silva-ivan', '?p=mda&t=2024-25',
      '?p=liga', '?p=liga&g=G2', `?p=liga&hoy=${HOY}`, '?p=rivales', '?p=rivales&g=MdL', `?p=rivales&g=MdA&r=${conFicha('MdA')}`,
    ];
    for (const a of antiguas) {
      const [search, hash] = a.startsWith('#') ? ['', a] : [a, ''];
      const d = R.nuevaUrl(search, hash);
      ok(d !== null, `antigua ${a || '(portada de GitHub Pages)'} tiene destino`, String(d));
      if (d) { const r = await fetch(APP + d, { redirect: 'follow' }); ok(r.status === 200, `antigua ${a || '(sin parametros)'} -> ${d}: 200`, String(r.status)); }
    }
    ok(['?p=historia', '?p=jugador&j=esteban-jon', '?j=esteban-jon', '?p=liga', '?t=2023-24&p=mda'].every((a) => R.nuevaUrl(a, '')), 'todas las pestañas de GitHub Pages tienen destino (ya no queda nada sin migrar)');
    // con la redireccion activada, la propia pagina antigua salta a la nueva
    await vieja.route('**/data/redireccion_web.js', (route) => route.fulfill({ contentType: 'text/javascript', body: fuenteRedir.replace('var ESTA_ACTIVA = false', 'var ESTA_ACTIVA = true').replace("'https://maccabis.vercel.app'", `'${APP}'`) }));
    await vieja.goto(`${PAGES}/index.html?t=2023-24&p=rankings`, { waitUntil: 'commit' });
    await vieja.waitForURL(`${APP}/liga/2023-24/rankings`, { timeout: 15000 }).catch(() => {});
    ok(vieja.url() === `${APP}/liga/2023-24/rankings`, 'activada: ?t=2023-24&p=rankings salta a /liga/2023-24/rankings', vieja.url());
    await vieja.goto(`${PAGES}/index.html?p=historia`, { waitUntil: 'commit' });
    await vieja.waitForURL(`${APP}/historia`, { timeout: 15000 }).catch(() => {});
    ok(vieja.url() === `${APP}/historia`, 'activada: ?p=historia salta a /historia', vieja.url());
    await vieja.unroute('**/data/redireccion_web.js');
  });

  // ------------------------------------------------------------------------------------------ movil, consola y capturas
  tarea('movil, consola y capturas', async ({ vieja, nueva, abrirVieja, abrirNueva }) => {
    seccion('Movil a 375 px, errores de consola y capturas');
    const rutas = ['/liga', '/liga/rivales', `/liga/rivales?g=MdL&r=${conFicha('MdL')}`, ...TEMPORADAS.flatMap((t) => ['equipo', 'rankings', 'cuartos', 'asistencia', 'mda'].map((p) => `/liga/${t}/${p}`)), '/historia', '/historia?persona=eric', ...TEMPORADAS.map((t) => `/plantilla?t=${t}`), ...TEMPORADAS.map((t) => `/jugador/${PRIMERO[t]}?t=${t}`)];
    const movil = await nav.newPage({ viewport: { width: 375, height: 800 } });
    movil.on('pageerror', (e) => errores.push(String(e)));
    movil.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errores.push(m.text()); });
    let desbordan = [];
    // las ~70 paginas, repartidas en 4 pestañas a 375 px
    await Promise.all([0, 1, 2, 3].map(async (k) => {
      const pag = k ? await nav.newPage({ viewport: { width: 375, height: 800 } }) : movil;
      if (k) { pag.on('pageerror', (e) => errores.push(String(e))); pag.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errores.push(m.text()); }); }
      for (const r of rutas.filter((_, n) => n % 4 === k)) {
        await pag.goto(APP + r, { waitUntil: 'networkidle' });
        const d = await pag.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (d > 0) desbordan.push(`${r} (+${d}px)`);
      }
      if (k) await pag.close();
    }));
    ok(desbordan.length === 0, `sin desbordamiento horizontal en ${rutas.length} paginas a 375 px`, desbordan.join(', '));
    // con la ficha de un rival y el boxscore abiertos tambien
    await movil.goto(`${APP}/liga/rivales?g=MdA&r=${conFicha('MdA')}`, { waitUntil: 'networkidle' });
    ok((await movil.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0, 'ficha de rival abierta a 375 px sin desbordamiento');
    await movil.goto(`${APP}/liga/2025-26/equipo`, { waitUntil: 'networkidle' });
    await movil.locator('tr.e-fila-click').first().click();
    ok((await movil.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0, 'boxscore abierto a 375 px sin desbordamiento');
    // solo capturas (sin comprobaciones): fuera de las tandas y de Actions
    if (conCapturas()) for (const [r, n] of [['/liga', 'liga'], ['/liga/rivales', 'rivales'], ['/liga/2025-26/equipo', 'equipo'], ['/liga/2025-26/rankings', 'rankings'], ['/liga/2025-26/cuartos', 'cuartos'], ['/liga/2025-26/asistencia', 'asistencia'], ['/liga/2023-24/mda', 'mda'], ['/plantilla?t=2013-14', 'plantilla_2013'], ['/plantilla', 'plantilla'], ['/jugador/esteban-jon?t=2025-26', 'ficha'], ['/jugador/esteban-jon?t=2023-24', 'ficha_2324']]) {
      await movil.goto(APP + r + (r === '/liga' ? '?hoy=' + HOY : ''), { waitUntil: 'networkidle' });
      await movil.screenshot({ path: path.join(SALIDA, `${n}_375.png`), fullPage: true });
      await nueva.setViewportSize({ width: 1280, height: 900 });
      await nueva.goto(APP + r + (r === '/liga' ? '?hoy=' + HOY : ''), { waitUntil: 'networkidle' });
      await nueva.screenshot({ path: path.join(SALIDA, `${n}_escritorio.png`), fullPage: true });
    }
  });

  // ------------------------------------------------------------------------------------------ todas las tareas
  const HILOS = Number(process.env.CUADRE_HILOS) || 6;
  const salidas = tareas.map(() => []);
  // las mas largas, primero (la salida sale igualmente en el orden de las secciones)
  const LARGAS = ['Historia', 'movil, consola y capturas', 'Jugadores', 'Rivales'];
  const prioridad = (t) => (LARGAS.includes(t.nombre) ? LARGAS.indexOf(t.nombre) : LARGAS.length);
  const orden = tareas.map((_, i) => i).sort((a, b) => prioridad(tareas[a]) - prioridad(tareas[b]) || a - b);
  await Promise.all(Array.from({ length: Math.min(HILOS, tareas.length) }, async () => {
    while (orden.length) {
      const i = orden.shift();
      const p = await paginas();
      const ini = Date.now();
      await salidaDe.run(salidas[i], async () => {
        try { await tareas[i].fn(p); } catch (e) { ok(false, `${tareas[i].nombre}: se interrumpio`, String(e.message).split(/\r?\n/)[0]); }
      });
      tareas[i].seg = (Date.now() - ini) / 1000;
      await p.ctx.close();
    }
  }));
  for (const s of salidas) for (const l of s) console.log(l);
  console.log(`  ${fichas} fichas comparadas`);
  console.log(`  tareas mas largas: ${tareas.slice().sort((x, y) => y.seg - x.seg).slice(0, 4).map((t) => `${t.nombre} ${t.seg.toFixed(0)} s`).join(', ')}`);
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
