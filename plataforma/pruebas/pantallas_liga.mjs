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
    ok((await p.locator('.lg-lider').count()) === 4, 'liga: 4 listas en Totales (puntos, triples, tiros libres, faltas)');
    ok((await p.locator('.lg-lider .etiqueta', { hasText: 'dobla' }).count()) > 0, 'liga: marca "dobla" en nuestros jugadores que salen con MdA y MdL');
    ok(await menuEntero() && await sinDesbordar(), 'liga: menu entero y sin desbordamiento');
    await p.screenshot({ path: path.join(SALIDA, `real_c_liga_plegado_${etiqueta}.png`), fullPage: true });
    await p.locator('details.lg-ranking > summary').click();
    ok((await p.locator('details.lg-ranking tbody tr').count()) === 20, 'liga: el ranking desplegado tiene los 20 equipos con partidos');
    ok(await sinDesbordar(), 'liga: desplegado, sin desbordamiento de pagina');
    const cab = await p.$$eval('details.lg-ranking thead th', (ths) => ths.filter((t) => t.getBoundingClientRect().width > 0).map((t) => t.textContent.trim()));
    const cabEsperada = movil ? ['#', 'Equipo', 'G-P', '%V', 'Dif/p'] : ['#', 'Equipo', 'PJ', 'G', 'P', '%V', 'PF/p', 'PC/p', 'Dif/p', 'Pts'];
    ok(JSON.stringify(cab) === JSON.stringify(cabEsperada), movil ? 'ranking movil: solo #, Equipo+grupo, G-P, %V y Dif/p' : 'ranking escritorio: todas las columnas', cab.join(','));
    const sinScroll = await p.evaluate(() => { const d = document.querySelector('details.lg-ranking .tabla-desplazable'); return d.scrollWidth <= d.clientWidth + 1; });
    ok(sinScroll, 'ranking: la tabla cabe, sin scroll horizontal');
    const celdasEnPantalla = await p.evaluate(() => [...document.querySelectorAll('details.lg-ranking tr')].every((tr) => [...tr.children].filter((c) => c.getBoundingClientRect().width > 0).every((c) => c.getBoundingClientRect().right <= window.innerWidth + 1)));
    ok(celdasEnPantalla, 'ranking: ninguna celda visible se sale de la pantalla');
    const textoLideres = await p.textContent('.lg-sub');
    ok(/de los 20 equipos con partidos jugados/.test(textoLideres), 'liga: el texto de lideres cuenta los equipos con partidos (20), igual que el ranking', textoLideres);
    await p.screenshot({ path: path.join(SALIDA, `real_c_liga_desplegado_${etiqueta}.png`), fullPage: true });

    // ---- Indice, lideres (totales / por partido) y tabla "Todos los jugadores"
    await p.goto(`${APP}/gestion/liga`);
    const hrefs = await p.$$eval('nav.lg-indice a', (a) => a.map((x) => x.getAttribute('href') + '|' + x.textContent.trim()));
    ok(JSON.stringify(hrefs) === JSON.stringify(['#lideres|Líderes', '#todos|Todos los jugadores', '#ranking|Ranking de equipos']), 'liga: indice con anclas Lideres, Todos los jugadores y Ranking de equipos', hrefs.join(','));
    await p.locator('nav.lg-indice a', { hasText: 'Todos los jugadores' }).click();
    ok(p.url().endsWith('#todos') && (await p.evaluate(() => { const r = document.querySelector('#todos').getBoundingClientRect(); return r.top < window.innerHeight && r.bottom > 0; })), 'liga: el indice lleva a la tabla (#todos)');
    await p.goto(`${APP}/gestion/liga`);

    const L = p.locator('#lideres');
    const titulos = () => L.locator('.lg-lider h3').allTextContents();
    ok(JSON.stringify(await titulos()) === JSON.stringify(['Puntos', 'Triples', 'Tiros libres', 'Faltas']), 'lideres Totales: Puntos, Triples, Tiros libres y Faltas (sin "Media de puntos")', (await titulos()).join(','));
    await L.getByRole('button', { name: 'Por partido' }).click();
    ok(JSON.stringify(await titulos()) === JSON.stringify(['Puntos por partido', '2P por partido', '3P por partido', 'TL anotados por partido', 'TL%', 'Faltas por partido', 'Minutos por partido']), 'lideres Por partido: las 7 listas', (await titulos()).join(','));
    const valores = await L.locator('.lg-lider li > b:last-child').allTextContents();
    ok(valores.length > 0 && valores.every((v) => /^\d+,\d$|^\d+%$/.test(v)), 'lideres Por partido: valores con una decimal (o %)', valores.slice(0, 6).join(' '));
    ok((await L.locator('.lg-lider').first().textContent()).includes('28,0') && (await L.locator('.lg-lider').first().textContent()).includes('Esteban, Jon'), 'lideres Por partido: Puntos por partido arranca en 28,0 y el doblador sale con sus partidos sumados (15,0)');
    ok((await L.locator('.lg-nota').last().textContent()).includes('Mínimo de partidos «Automático»'), 'lideres Por partido: la nota explica el minimo automatico');
    ok((await p.locator('.lg-todos .lg-conmutador button.on').textContent()) === 'Totales', 'el interruptor de los lideres es independiente del de la tabla');
    await L.scrollIntoViewIfNeeded();
    await L.screenshot({ path: path.join(SALIDA, `real_c_lideres_por_partido_${etiqueta}.png`) });
    await L.getByRole('button', { name: 'Totales' }).click();
    ok((await titulos()).length === 4, 'lideres: vuelve a Totales');

    const T = p.locator('.lg-todos');
    const filasVisibles = () => (movil ? T.locator('.lg-compactas .lg-fila') : T.locator('tbody tr')).count();
    const panel = T.locator('#lg-filtros-panel');
    const abrirFiltros = async () => { if (movil && !(await panel.isVisible())) await T.locator('.lg-filtros-btn').click(); };
    const eqDe = () => (movil ? T.locator('.lg-fila-eq') : T.locator('tbody tr td:nth-child(2)')).allTextContents();
    const sumaPts = async () => (await (movil ? T.locator('.lg-fila-pts b') : T.locator('tbody tr td:nth-child(5)')).allTextContents()).reduce((n, v) => n + Number(v), 0);
    const posicion = await p.evaluate(() => { const t = document.querySelector('.lg-todos').getBoundingClientRect().top, l = document.querySelector('.lg-lideres').getBoundingClientRect().top, r = document.querySelector('details.lg-ranking').getBoundingClientRect().top; return l < t && t < r; });
    ok(posicion, 'tabla: debajo de los lideres y encima del ranking de equipos');
    if (movil) {
      ok(!(await panel.isVisible()), 'tabla movil: los filtros vienen plegados');
      ok(/Filtros \(0 activos\)/.test(await T.locator('.lg-filtros-btn').textContent()), 'tabla movil: boton "Filtros (0 activos)"');
      ok(await T.getByRole('button', { name: 'Por partido' }).isVisible() && await T.getByLabel('Ordenar por').first().isVisible(), 'tabla movil: Totales/Por partido y "Ordenar por" siempre visibles');
    } else {
      ok(!(await T.locator('.lg-filtros-btn').isVisible()) && await panel.isVisible(), 'tabla escritorio: filtros siempre visibles, sin boton de plegar');
    }
    await T.scrollIntoViewIfNeeded();
    if (movil) await T.screenshot({ path: path.join(SALIDA, 'real_d_tabla_375.png') });
    ok((await filasVisibles()) === 25, 'tabla: 25 filas de partida');
    await T.getByRole('button', { name: /Ver 25 más/ }).click();
    ok((await filasVisibles()) === 50, 'tabla: "ver 25 mas" carga otras 25');
    ok(/Mostrando 50 de \d+/.test(await T.locator('.lg-nota').first().textContent()), 'tabla: indica cuantas filas muestra');
    ok((await T.locator('.lg-nota').last().textContent()).includes('no hay faltas recibidas ni intentos de campo'), 'tabla: la nota al pie dice que no hay faltas recibidas ni intentos de campo');
    ok((await T.locator('.lg-nota').last().textContent()).includes('solo ficha MdA'), 'tabla: la nota al pie explica la «solo ficha» de los dobladores');
    const primerPts = async () => Number(await (movil ? T.locator('.lg-fila-pts b').first() : T.locator('tbody tr').first().locator('td').nth(4)).textContent());
    const maxPts = await p.evaluate(() => Math.max(...[...document.querySelectorAll('.lg-lider')[0].querySelectorAll('li b:last-child')].map((b) => Number(b.textContent))));
    ok((await primerPts()) === maxPts, 'tabla: por defecto ordenada por PTS descendente (el primero es el maximo anotador de la liga)', `${await primerPts()} / ${maxPts}`);
    if (!movil) {
      ok((await T.locator('thead th').first().evaluate((e) => getComputedStyle(e).position)) === 'sticky', 'tabla escritorio: cabecera fija al desplazar');
      await T.getByRole('button', { name: /^TL%/ }).click();
      ok((await T.locator('th[aria-sort="descending"]').count()) === 1 && (await T.locator('th[aria-sort="descending"]').textContent()).includes('TL%'), 'tabla escritorio: la cabecera pulsable ordena (TL% descendente)');
      await T.getByRole('button', { name: /^TL%/ }).click();
      ok((await T.locator('th[aria-sort="ascending"]').count()) === 1, 'tabla escritorio: segunda pulsacion, ascendente');
      await T.getByRole('button', { name: /^PTS/ }).click();
      ok((await T.locator('th[aria-sort="descending"]').textContent()).includes('PTS'), 'tabla escritorio: otra columna empieza en descendente (PTS)');
    } else {
      ok(!(await T.locator('table').isVisible()), 'tabla movil: sin tabla, filas compactas');
      await T.getByLabel('Ordenar por').first().selectOption('media');
      ok(/Media/.test(await T.locator('.lg-fila-val').first().textContent()), 'tabla movil: la fila compacta muestra la columna elegida y PTS');
      await T.getByLabel('Ordenar por').first().selectOption('pts');
    }
    // filtros: sin filtro, el doblador va con las fichas sumadas
    await abrirFiltros();
    await T.getByLabel('Buscar').fill('esteban, jon');
    const sumada = await T.locator('.lg-nuestro').first().textContent();
    ok((await filasVisibles()) === 1 && sumada.includes('dobla') && sumada.includes('MdA + MdL') && !sumada.includes('solo ficha'), 'tabla: sin filtro, una sola fila "MdA + MdL" con las fichas sumadas');
    ok(movil ? /Filtros \(1 activo\)/.test(await T.locator('.lg-filtros-btn').textContent()) : true, 'tabla movil: el boton cuenta los filtros activos');
    // con filtro de grupo/equipo: solo la ficha de ese grupo/equipo
    await T.locator('label', { hasText: /^Grupo/ }).locator('select').selectOption('G1');
    const fichaG1 = await T.locator('.lg-nuestro').first().textContent();
    ok((await filasVisibles()) === 1 && fichaG1.includes('dobla') && fichaG1.includes('solo ficha MdA') && !fichaG1.includes('MdL'), 'tabla: con filtro G1, el doblador muestra solo la ficha MdA («dobla» + "solo ficha MdA")', fichaG1);
    ok(movil ? /Filtros \(2 activos\)/.test(await T.locator('.lg-filtros-btn').textContent()) : true, 'tabla movil: "Filtros (2 activos)"');
    await T.locator('label', { hasText: /^Grupo/ }).locator('select').selectOption('G2');
    ok((await T.locator('.lg-nuestro').first().textContent()).includes('solo ficha MdL'), 'tabla: con filtro G2, solo la ficha MdL');
    await T.locator('label', { hasText: /^Grupo/ }).locator('select').selectOption('todos');
    await T.locator('label', { hasText: /^Equipo/ }).locator('select').selectOption('MdL');
    ok((await T.locator('.lg-nuestro').first().textContent()).includes('solo ficha MdL'), 'tabla: con filtro de equipo MdL, solo la ficha MdL');
    await T.getByLabel('Buscar').fill('');
    ok((await sumaPts()) === 59, 'tabla: con equipo MdL, la suma de PTS de las filas (59) = puntos a favor de MdL en la clasificacion', String(await sumaPts()));
    await T.locator('label', { hasText: /^Equipo/ }).locator('select').selectOption('MdA');
    ok((await sumaPts()) === 62, 'tabla: con equipo MdA, la suma de PTS de las filas (62) = puntos a favor de MdA en la clasificacion', String(await sumaPts()));
    await T.getByLabel('Solo Maccabis').check();
    await T.getByLabel('Buscar').fill('esteban, jon');
    const sumadaMacc = await T.locator('.lg-nuestro').first().textContent();
    ok(sumadaMacc.includes('MdA + MdL') && !sumadaMacc.includes('solo ficha'), 'tabla: con "Solo Maccabis" el doblador vuelve a las fichas sumadas');
    await T.getByLabel('Solo Maccabis').uncheck();
    await T.getByLabel('Buscar').fill('');
    await T.locator('label', { hasText: /^Equipo/ }).locator('select').selectOption('todos');
    // captura del filtro G1 (movil: filtros abiertos)
    await T.locator('label', { hasText: /^Grupo/ }).locator('select').selectOption('G1');
    await T.getByLabel('Buscar').fill('esteban, jon');
    if (movil) await T.screenshot({ path: path.join(SALIDA, 'real_d_tabla_375_filtro_g1.png') });
    await T.getByLabel('Buscar').fill('');
    await T.getByLabel('Solo Maccabis').check();
    const nNuestros = await filasVisibles();
    const todasNuestras = await (movil ? T.locator('.lg-compactas .lg-fila') : T.locator('tbody tr')).evaluateAll((l) => l.every((e) => e.classList.contains('lg-nuestro')));
    ok(nNuestros > 0 && todasNuestras, `tabla: "Solo Maccabis" deja solo a los de MdA y MdL (${nNuestros})`);
    await T.getByLabel('Solo Maccabis').uncheck();
    await T.locator('label', { hasText: /^Grupo/ }).locator('select').selectOption('G2');
    ok((await eqDe()).length > 0 && (await eqDe()).every((t) => /G2/.test(t)), 'tabla: el filtro de grupo G2 solo deja equipos del G2');
    await T.locator('label', { hasText: /^Equipo/ }).locator('select').selectOption('Craps');
    ok((await filasVisibles()) > 0 && (await eqDe()).every((t) => /Craps/.test(t)), 'tabla: el filtro de equipo (Craps)');
    await T.locator('label', { hasText: /^Equipo/ }).locator('select').selectOption('todos');
    await T.locator('label', { hasText: /^Grupo/ }).locator('select').selectOption('todos');
    ok((await T.locator('label', { hasText: /^Mínimo de partidos/ }).locator('select').inputValue()) === 'auto', 'tabla: el minimo de partidos viene en "Automatico"');
    // por partido
    await T.getByRole('button', { name: 'Por partido' }).click();
    ok(movil ? true : (await T.locator('thead').textContent()).includes('2P/p'), 'tabla: "Por partido" divide 2P, 3P, TL, faltas y minutos entre PJ (cabeceras con /p)');
    await T.getByRole('button', { name: 'Totales' }).click();
    ok(await sinDesbordar(), 'tabla: sin desbordamiento horizontal de la pagina');
    await T.scrollIntoViewIfNeeded();
    if (movil) {
      await T.locator('.lg-fila-cab').first().click();
      const det = await T.locator('.lg-fila.abierta .lg-fila-det').textContent();
      ok(['PJ', 'MIN', 'PTS', 'Media', '2P', '3P', 'TL', 'TL%', 'Faltas', 'F/P'].every((k) => det.includes(k)), 'tabla movil: al tocar la fila se despliega el resto de datos');
      await T.screenshot({ path: path.join(SALIDA, 'real_d_tabla_375_desplegada.png') });
      await T.locator('.lg-fila-cab').first().click();
    } else {
      await T.screenshot({ path: path.join(SALIDA, 'real_d_tabla_escritorio.png') });
    }
    // clic en jugador / equipo -> Scouting con ese equipo
    await T.getByLabel('Buscar').fill('esteban, jon');
    if (movil) await T.locator('.lg-fila-cab').first().click();
    await (movil ? T.locator('.lg-fila-det a').first() : T.locator('tbody tr a').first()).click();
    await p.waitForURL(/\/gestion\/scouting\?e=Md[AL]/);
    ok((await p.textContent('h2')).includes('Md'), 'tabla: clic en jugador/equipo abre Scouting con ese equipo');
    // Scouting: enlace a la tabla y nota
    await p.goto(`${APP}/gestion/scouting`);
    const enlaceTodos = p.getByRole('link', { name: 'Ver todos los jugadores de la liga' });
    ok(await enlaceTodos.isVisible(), 'scouting: boton "Ver todos los jugadores de la liga" junto al selector');
    ok((await p.textContent('.lg-nota')).includes('Solo aparecen los jugadores que figuran en las hojas de la FBM (han jugado al menos un partido)'), 'scouting: nota "solo aparecen los jugadores que figuran en las hojas de la FBM"');
    await enlaceTodos.click();
    await p.waitForURL(/\/gestion\/liga#todos/);
    ok(await p.locator('#todos .lg-todos').isVisible(), 'scouting: el boton lleva a Liga consolidada, seccion Todos los jugadores');
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
