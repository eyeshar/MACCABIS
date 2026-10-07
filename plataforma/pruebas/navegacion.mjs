#!/usr/bin/env node
// Navegacion unica (D89, D90), de extremo a extremo: la misma cabecera en toda la web y por rol (sin sesion, jugador,
// gestor), desplegables accesibles, barra inferior y hoja "Mas" en movil, barras propias de Mi zona y Gestion, Mi zona a
// dos columnas, Gestion en el tema oscuro, "Mi cuenta" unica, y la barra de vuelta de la web de estadisticas (GitHub
// Pages). Pila local (Postgres + PostgREST con nuestras migraciones) + app compilada + Chrome.
//
//   npm run pruebas:navegacion
//
// Deja capturas reales en privado/mockups_liga/rediseno/nav1b/.

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { arrancar } from './pila.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.join(RAIZ, '..');
const SALIDA = path.join(REPO, 'privado', 'mockups_liga', 'rediseno', 'nav1b');
fs.mkdirSync(SALIDA, { recursive: true });

const PUERTO = 3106, PUERTO_WEB = 3107;
const APP = `http://127.0.0.1:${PUERTO}`;
const WEB = `http://127.0.0.1:${PUERTO_WEB}`;
const PORTADA_PROD = 'https://maccabis.vercel.app/';
// La web de GitHub Pages tal cual (raiz del repo), servida en local.
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png' };
const servidorWeb = http.createServer((req, res) => {
  const f = path.join(REPO, decodeURIComponent(new URL(req.url, WEB).pathname));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] ?? 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(PUERTO_WEB, '127.0.0.1');

let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };
async function esperar(url, ms = 60000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) { try { const r = await fetch(url); if (r.status < 500) return; } catch {} await new Promise((r) => setTimeout(r, 300)); }
  throw new Error(`${url} no arranca`);
}

const PUBLICAS = ['/', '/club', '/privacidad'];
const GESTION = ['/gestion', '/gestion/jugadores', '/gestion/ropa', '/gestion/ropa/nuevo', '/gestion/scouting', '/gestion/liga'];
const ROLES = {
  anon: { paginas: PUBLICAS },
  jugador: { email: 'jugador@pruebas.local', paginas: [...PUBLICAS, '/mi-zona', '/cuenta'] },
  gestor: { email: 'gestor@pruebas.local', paginas: [...PUBLICAS, '/mi-zona', '/cuenta', ...GESTION] },
};
const TAMANOS = [['375', 375, 812, true], ['escritorio', 1440, 900, false]];

const pila = await arrancar();
let app, nav;
try {
  const { sql, url, anonKey } = pila;
  const { leerLiga, cargarLiga } = await import('../scripts/cargar_liga.mjs');
  await cargarLiga(sql, leerLiga('2026-27'), '2026-27', { log: () => {} });
  // Jugador: Jon (dobla). Gestor que ademas es jugador (como Ivan o Edu): Edu. Gestor sin ficha de jugador: aparte.
  const gId = await pila.crearUsuario(ROLES.gestor.email, 'no-se-usa');
  await sql`insert into public.gestores (user_id, nombre, email) values (${gId}, 'Edu', ${ROLES.gestor.email})`;
  await sql`update public.jugadores set email = ${ROLES.gestor.email} where person_id = 'martin-ortega-rico-eduardo'`;
  await sql`update public.jugadores set email = ${ROLES.jugador.email} where person_id = 'esteban-jon'`;
  const soloGestor = 'gestor2@pruebas.local';
  const g2 = await pila.crearUsuario(soloGestor, 'no-se-usa');
  await sql`insert into public.gestores (user_id, nombre, email) values (${g2}, 'Carlos', ${soloGestor})`;
  const codigoDe = async (email) => (await sql`select codigo from public._otp_pruebas where email = ${email}`)[0]?.codigo;

  console.log('== Compilacion');
  const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey, NEXT_TELEMETRY_DISABLED: '1' };
  const next = path.join(RAIZ, 'node_modules', 'next', 'dist', 'bin', 'next');
  execFileSync(process.execPath, [next, 'build'], { cwd: RAIZ, env, stdio: 'ignore' });
  ok(true, 'next build');
  app = spawn(process.execPath, [next, 'start', '-p', String(PUERTO), '-H', '127.0.0.1'], { cwd: RAIZ, env, stdio: 'ignore' });
  await esperar(APP);

  console.log('\n== HTTP');
  let r = await fetch(`${APP}/gestion/cuenta`, { redirect: 'manual' });
  ok(r.status >= 300 && r.status < 400 && new URL(r.headers.get('location'), APP).pathname === '/cuenta', '/gestion/cuenta redirige a /cuenta (una sola pagina de cuenta)', `${r.status} ${r.headers.get('location')}`);
  r = await fetch(`${APP}/cuenta`, { redirect: 'manual' });
  ok(r.status >= 300 && r.status < 400 && (r.headers.get('location') || '').includes('/entrar'), '/cuenta sin sesion redirige a /entrar');
  ok((r.headers.get('x-robots-tag') || '').includes('noindex'), '/cuenta: X-Robots-Tag noindex (exige login, D85)');
  ok((await (await fetch(`${APP}/robots.txt`)).text()).includes('Disallow: /cuenta'), 'robots.txt: Disallow /cuenta');

  nav = await chromium.launch({ channel: 'chrome', headless: true });
  const foto = (p, n, completa = true) => p.screenshot({ path: path.join(SALIDA, `${n}.png`), fullPage: completa });
  const fotoEstatica = async (p, n) => {
    const s = await p.addStyleTag({ content: 'body{position:relative}.nv-barra{position:absolute!important;bottom:0}' });
    await foto(p, n);
    await s.evaluate((e) => e.remove());
  };
  async function entrar(p, email) {
    await p.goto(`${APP}/entrar`);
    await p.getByLabel('Tu correo').fill(email);
    await p.getByRole('button', { name: 'Enviarme el código' }).click();
    await p.getByText('Código enviado a').waitFor({ timeout: 10000 });
    await p.getByLabel('Código de 6 dígitos').fill((await codigoDe(email)) ?? '000000');
    await p.getByRole('button', { name: 'Entrar', exact: true }).click();
    await p.waitForURL((u) => !u.pathname.startsWith('/entrar') || u.pathname.startsWith('/entrar/elegir'), { timeout: 15000 });
  }
  // Firma de la cabecera: lo que se ve en ella, sin el elemento activo (que cambia de pagina en pagina).
  const firma = (p) => p.evaluate(() => {
    const cab = document.querySelector('header.nv-cab');
    if (!cab) return null;
    const enl = [...cab.querySelectorAll('a, button')].filter((e) => !e.closest('[hidden]')).map((e) => `${e.tagName}|${(e.getAttribute('href') || '')}|${e.textContent.trim()}`);
    const barra = [...document.querySelectorAll('nav[aria-label="Secciones"] > a, nav[aria-label="Secciones"] > button')].map((e) => `${e.getAttribute('href') || 'boton'}|${e.textContent.trim()}`);
    return JSON.stringify({ enl, barra });
  });

  for (const [etiqueta, ancho, alto, movil] of TAMANOS) {
    for (const [rol, conf] of Object.entries(ROLES)) {
      console.log(`\n== ${rol}, ${etiqueta}`);
      const ctx = await nav.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: movil ? 2 : 1, isMobile: movil, hasTouch: movil, locale: 'es-ES' });
      const p = await ctx.newPage();
      const errores = [];
      p.on('pageerror', (e) => errores.push(String(e)));
      p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
      if (conf.email) {
        await entrar(p, conf.email);
        if (rol === 'gestor') ok(p.url().endsWith('/entrar/elegir'), 'gestor que tambien es jugador: elige zona al entrar', p.url());
      }

      const firmas = new Map();
      const problemas = { desborda: [], tapa: [], blank: [], sinInicio: [], viejas: [], pequenos: [] };
      for (const ruta of conf.paginas) {
        await p.goto(`${APP}${ruta}`);
        ok(new URL(p.url()).pathname === ruta, `${ruta}: se abre con la sesion de ${rol}`, p.url());
        firmas.set(ruta, await firma(p));
        const d = await p.evaluate(() => ({
          cabeceras: document.querySelectorAll('header.nv-cab').length,
          viejas: document.querySelectorAll('.gs-cab, .mz-cab, .w-cab, .w-barra, .mz-barra, .gs-lateral, .w-menu-movil').length,
          desborda: document.documentElement.scrollWidth > window.innerWidth + 1,
          blank: [...document.querySelectorAll('header a, nav a, .zb a')].filter((a) => a.target === '_blank').length,
          inicio: [...document.querySelectorAll('header a[href="/"], nav[aria-label="Secciones"] a[href="/"]')].some((a) => a.getBoundingClientRect().height > 0),
          externos: [...document.querySelectorAll('nav[aria-label="Principal"] a[href^="https://eyeshar.github.io/"]')].map((a) => ({ svg: a.querySelectorAll('svg').length, t: a.target })),
        }));
        if (d.cabeceras !== 1) problemas.viejas.push(`${ruta}: ${d.cabeceras} cabeceras`);
        if (d.viejas) problemas.viejas.push(`${ruta}: ${d.viejas} piezas de las cabeceras antiguas`);
        if (d.desborda) problemas.desborda.push(ruta);
        if (d.blank) problemas.blank.push(ruta);
        if (!d.inicio) problemas.sinInicio.push(ruta);
        if (!movil && (d.externos.length !== 2 || d.externos.some((x) => x.svg || x.t))) problemas.blank.push(`${ruta}: Liga/Plantilla/Historia con icono o target`);
        if (movil) {
          // La barra inferior no tapa contenido: al final de la pagina, el contenido acaba por encima de ella.
          await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          const t = await p.evaluate(() => {
            const b = document.querySelector('nav[aria-label="Secciones"]').getBoundingClientRect();
            const c = document.getElementById('contenido').getBoundingClientRect();
            return { barra: b.top, contenido: c.bottom, fija: getComputedStyle(document.querySelector('nav[aria-label="Secciones"]')).position };
          });
          if (t.fija !== 'fixed' || t.contenido > t.barra + 1) problemas.tapa.push(`${ruta}: contenido hasta ${Math.round(t.contenido)}, barra en ${Math.round(t.barra)}`);
          await p.evaluate(() => window.scrollTo(0, 0));
        }
        const peq = await p.evaluate(() => [...document.querySelectorAll('header.nv-cab a, header.nv-cab button, nav[aria-label="Secciones"] a, nav[aria-label="Secciones"] button, .zb a')]
          .filter((e) => !e.closest('[hidden]') && getComputedStyle(e).display !== 'none').map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim().slice(0, 24), h: Math.round(r.height), w: Math.round(r.width) }; })
          .filter((x) => x.h > 0 && (x.h < 44 || x.w < 44)));
        if (peq.length) problemas.pequenos.push(`${ruta}: ${JSON.stringify(peq.slice(0, 3))}`);
      }
      ok(problemas.viejas.length === 0, 'una sola cabecera en todas las paginas, sin las cabeceras ni barras antiguas de cada zona', problemas.viejas.join(' | '));
      ok(new Set(firmas.values()).size === 1 && [...firmas.values()][0], `la cabecera es la misma en ${conf.paginas.join(', ')}`, [...new Set(firmas.values())].join(' ### ').slice(0, 400));
      ok(problemas.sinInicio.length === 0, 'desde cualquier pagina la portada esta a un clic (escudo/Inicio)', problemas.sinInicio.join(', '));
      ok(problemas.blank.length === 0, 'ningun target=_blank en la navegacion; Liga, Plantilla e Historia sin icono de externo', problemas.blank.join(', '));
      ok(problemas.desborda.length === 0, 'sin desbordamiento horizontal', problemas.desborda.join(', '));
      ok(problemas.pequenos.length === 0, 'objetivos tactiles de la navegacion de al menos 44 px', problemas.pequenos.join(' | '));
      if (movil) ok(problemas.tapa.length === 0, 'la barra inferior (fija) no tapa el contenido', problemas.tapa.join(' | '));

      // ---- Lo que ve cada rol
      await p.goto(`${APP}/`);
      const pie = await p.locator('footer#pie a').evaluateAll((a) => a.map((x) => `${x.textContent.trim()}|${x.getAttribute('href')}`));
      const piePrevisto = { anon: ['Acceso jugadores y gestores|/entrar'], jugador: ['Mi zona|/mi-zona'], gestor: ['Mi zona|/mi-zona', 'Gestión|/gestion'] }[rol];
      const pieZonas = pie.filter((x) => /\|\/(entrar|mi-zona|gestion)$/.test(x));
      ok(JSON.stringify(pieZonas) === JSON.stringify(piePrevisto), `pie de la portada con la misma sesion que la cabecera (${rol}): ${piePrevisto.map((x) => x.split('|')[0]).join(' y ')}`, pie.join(', '));
      const cab = p.locator('header.nv-cab');
      const barra = p.locator('nav[aria-label="Secciones"]');
      const acceso = cab.getByRole('link', { name: 'Acceso' });
      const miZonaVisible = movil ? await barra.getByRole('link', { name: 'Mi zona' }).isVisible() : await cab.getByRole('link', { name: 'Mi zona' }).isVisible();
      const botonGestion = cab.getByRole('button', { name: /GESTIÓN/ });
      const botonUsuario = cab.locator('button.nv-avatar');
      if (rol === 'anon') {
        ok(await acceso.isVisible() && (await acceso.getAttribute('href')) === '/entrar', 'sin sesion: boton "Acceso" a /entrar');
        ok(!miZonaVisible && (await p.getByRole('link', { name: 'Mi zona' }).count()) === 0, 'sin sesion: no ve Mi zona');
        ok((await botonGestion.count()) === 0 && (await p.locator('#nv-menu-gestion, .nv-hoja-gestion').count()) === 0, 'sin sesion: no ve Gestion');
        if (movil) ok(await barra.getByRole('link', { name: 'Acceso' }).isVisible(), 'movil sin sesion: "Acceso" en la barra inferior');
      } else {
        ok((await acceso.count()) === 0, `${rol}: la portada reconoce la sesion (sin "Acceso")`);
        ok(miZonaVisible, `${rol}: ve Mi zona`);
        ok(await botonUsuario.isVisible() && (await botonUsuario.textContent()).includes(rol === 'jugador' ? 'J' : 'E'), `${rol}: boton con su inicial${movil ? '' : ' y nombre'}`);
        if (!movil) ok((await botonUsuario.textContent()).includes(rol === 'jugador' ? 'Jon' : 'Edu'), `${rol}: su nombre en la cabecera`);
        if (rol === 'jugador') ok((await botonGestion.count()) === 0 && (await p.locator('#nv-menu-gestion, .nv-hoja-gestion').count()) === 0, 'jugador: no ve Gestion');
        else ok(movil ? (await p.locator('.nv-hoja-gestion').count()) === 1 : await botonGestion.isVisible(), 'gestor: ve Gestion');
      }
      if (!movil) {
        const menu = await p.$$eval('nav[aria-label="Principal"] a', (a) => a.map((x) => x.textContent.trim()));
        ok(['Inicio', 'Partidos', 'Liga', 'Plantilla', 'Historia', 'El club'].every((t, i) => menu[i] === t), 'menu: Inicio · Partidos · Liga · Plantilla · Historia · El club', menu.join(','));
        ok((await p.locator('nav[aria-label="Principal"] a[href="/"]').getAttribute('aria-current')) === 'page', 'en la portada, "Inicio" marcado (aria-current)');
        await p.goto(`${APP}/club`);
        ok((await p.locator('nav[aria-label="Principal"] a[href="/club"]').getAttribute('aria-current')) === 'page', 'en /club, "El club" marcado');
        await p.goto(`${APP}/`);
      }

      // ---- Menu de usuario (teclado: Enter abre, flechas recorren, Esc cierra y devuelve el foco)
      if (rol !== 'anon') {
        await botonUsuario.focus();
        await p.keyboard.press('Enter');
        const panel = p.locator('#nv-menu-usuario');
        ok(await panel.isVisible() && (await botonUsuario.getAttribute('aria-expanded')) === 'true', 'menu de usuario: abre con el teclado (aria-expanded)');
        const txt = await panel.textContent();
        ok(txt.includes(rol === 'jugador' ? 'Jon Esteban' : 'Eduardo Martín-Ortega Rico') && txt.includes(rol === 'jugador' ? 'Jugador · MdA y MdL' : 'Gestor · Jugador · MdA y MdL'), 'menu de usuario: nombre completo y "Jugador · MdA y MdL" (segun sus fichas)', txt);
        ok(['Mi cuenta', 'Instalar en el móvil', 'Salir'].every((t) => txt.includes(t)), 'menu de usuario: Mi cuenta, Instalar en el móvil y Salir');
        await p.keyboard.press('ArrowDown');
        const enMenu = () => p.waitForFunction(() => document.activeElement?.closest('#nv-menu-usuario') !== null, null, { timeout: 2000 }).then(() => true, () => false);
        const primera = await enMenu() && await p.evaluate(() => document.activeElement.textContent.trim());
        await p.keyboard.press('ArrowDown');
        const segunda = await p.evaluate(() => document.activeElement?.textContent.trim());
        ok(primera === 'Mi cuenta' && segunda === 'Instalar en el móvil', 'menu de usuario: las flechas recorren sus entradas', `${primera} -> ${segunda}`);
        if (!movil && rol === 'jugador') await foto(p, `cabecera_jugador_menu_usuario_${etiqueta}`, false);
        if (movil && rol === 'gestor') await foto(p, `cabecera_gestor_menu_usuario_${etiqueta}`, false);
        await p.keyboard.press('Escape');
        ok(await panel.isHidden() && await botonUsuario.evaluate((b) => b === document.activeElement), 'menu de usuario: Esc lo cierra y devuelve el foco al boton');
        await botonUsuario.click();
        await p.locator('main').first().click({ position: { x: 5, y: 5 } });
        ok(await panel.isHidden(), 'menu de usuario: se cierra con clic fuera');
      }

      // ---- Desplegable de Gestion (escritorio)
      if (rol === 'gestor' && !movil) {
        await botonGestion.focus();
        await p.keyboard.press('ArrowDown');
        const pg = p.locator('#nv-menu-gestion');
        ok(await pg.isVisible() && await p.waitForFunction(() => document.activeElement?.closest('#nv-menu-gestion') !== null, null, { timeout: 2000 }).then(() => true, () => false), 'menu de Gestion: abre con el teclado y lleva el foco dentro');
        const grupos = await pg.locator('.nv-grupo-titulo').allTextContents();
        ok(JSON.stringify(grupos.map((g) => g.toUpperCase())) === JSON.stringify(['LA SEMANA', 'PLANTILLA', 'COMPETICIÓN']), 'menu de Gestion: tres columnas (La semana, Plantilla, Competición)', grupos.join(','));
        const columnas = await pg.locator('.nv-grupo').evaluateAll((g) => g.map((x) => Math.round(x.getBoundingClientRect().left)));
        ok(new Set(columnas).size === 3, 'menu de Gestion: los tres grupos en columnas', columnas.join(','));
        const enlaces = await pg.locator('a.nv-entrada').evaluateAll((a) => a.map((x) => [x.querySelector('b').textContent.trim(), x.getAttribute('href'), x.querySelector('span')?.textContent.trim()]));
        ok(JSON.stringify(enlaces.map((e) => e[0])) === JSON.stringify(['Panel de la semana', 'Jugadores', 'Pedido de ropa', 'Scouting rivales', 'Liga consolidada']) && enlaces.every((e) => e[2]), 'menu de Gestion: entradas existentes con enlace y una linea de descripcion', JSON.stringify(enlaces));
        const paso2 = await pg.locator('.nv-paso2').evaluateAll((s) => s.map((x) => ({ t: x.textContent, a: x.getAttribute('aria-disabled'), tag: x.tagName, href: x.getAttribute('href') })));
        ok(paso2.length === 3 && ['Eventos y pistas', 'Convocatoria', 'Asistencia y motivos'].every((t, i) => paso2[i].t.includes(t) && paso2[i].t.includes('paso 2')) && paso2.every((x) => x.a === 'true' && x.tag !== 'A' && !x.href), 'menu de Gestion: Eventos, Convocatoria y Asistencia con "paso 2", sin enlace (aria-disabled)', JSON.stringify(paso2));
        ok((await pg.textContent()).includes('Mi cuenta') === false, '"Mi cuenta" ya no esta en el menu de Gestion (solo en el de usuario)');
        await foto(p, `cabecera_gestor_menu_gestion_${etiqueta}`, false);
        await p.keyboard.press('Escape');
        ok(await pg.isHidden() && await botonGestion.evaluate((b) => b === document.activeElement), 'menu de Gestion: Esc lo cierra y devuelve el foco');
        await botonGestion.click();
        await botonUsuario.click();
        ok(await pg.isHidden() && await p.locator('#nv-menu-usuario').isVisible(), 'abrir un menu cierra el otro (clic fuera)');
        await p.keyboard.press('Escape');
        await p.goto(`${APP}/gestion/liga`);
        ok((await botonGestion.getAttribute('data-dentro')) !== null && (await botonGestion.evaluate((b) => getComputedStyle(b).backgroundColor)) === 'rgb(243, 197, 25)', 'dentro de /gestion, el boton GESTIÓN va relleno de amarillo');
        await p.goto(`${APP}/`);
        ok((await botonGestion.evaluate((b) => getComputedStyle(b).backgroundColor)) !== 'rgb(243, 197, 25)', 'fuera de /gestion, el boton GESTIÓN va con borde, sin relleno');
      }

      // ---- Hoja "Mas" (movil)
      if (movil) {
        const mas = barra.getByRole('button', { name: 'Más' });
        const textos = await barra.locator(':scope > a, :scope > button').allTextContents();
        ok(JSON.stringify(textos.map((t) => t.trim())) === JSON.stringify(['Inicio', 'Partidos', 'Liga', rol === 'anon' ? 'Acceso' : 'Mi zona', 'Más']), 'barra inferior: Inicio · Partidos · Liga · Mi zona/Acceso · Más', textos.join(','));
        await mas.click();
        const hoja = p.getByRole('dialog', { name: 'Más' });
        ok(await hoja.isVisible() && (await mas.getAttribute('aria-expanded')) === 'true', '"Más" abre la hoja desde abajo');
        ok(await p.waitForFunction(() => document.activeElement?.closest('#nv-hoja-mas') !== null, null, { timeout: 2000 }).then(() => true, () => false), 'la hoja recibe el foco');
        const ht = await hoja.textContent();
        ok(['Plantilla', 'Historia', 'El club'].every((t) => ht.includes(t)) && /la web/i.test(ht), 'hoja: LA WEB con Plantilla, Historia y El club');
        if (rol === 'gestor') {
          const g = hoja.locator('.nv-hoja-gestion');
          ok(await g.isVisible() && (await g.locator('a.nv-entrada').count()) === 5 && (await g.locator('.nv-paso2[aria-disabled="true"]').count()) === 3, 'hoja (gestor): GESTIÓN con las mismas entradas y etiquetas "paso 2"');
        } else ok((await hoja.locator('.nv-hoja-gestion').count()) === 0, `hoja (${rol}): sin Gestion`);
        if (rol !== 'anon') ok(ht.includes('Mi cuenta') && ht.includes('Salir'), 'hoja: Mi cuenta y Salir');
        else ok(!ht.includes('Salir'), 'hoja sin sesion: sin Mi cuenta ni Salir');
        if (rol !== 'anon') await foto(p, `hoja_mas_${rol}_${etiqueta}`, false);
        await p.keyboard.press('Escape');
        ok(await hoja.isHidden() && await mas.evaluate((b) => b === document.activeElement), 'hoja: Esc la cierra y devuelve el foco');
        await mas.click();
        await p.locator('.nv-velo').click({ position: { x: 10, y: 10 } });
        ok(await hoja.isHidden(), 'hoja: se cierra tocando fuera');
        await foto(p, `cabecera_${rol}_${etiqueta}`, false);
      } else if (rol !== 'gestor') await foto(p, `cabecera_${rol}_${etiqueta}`, false);

      // ---- Mi zona
      if (rol !== 'anon') {
        await p.goto(`${APP}/mi-zona`);
        const bz = p.locator('nav[aria-label="Mi zona"]');
        ok(JSON.stringify((await bz.locator('a').allTextContents()).map((t) => t.trim())) === JSON.stringify(['Resumen', 'Mi agenda', 'Mis estadísticas', 'Pedido de ropa']), 'Mi zona: barra propia (Resumen · Mi agenda · Mis estadísticas · Pedido de ropa)');
        await p.evaluate(() => window.scrollTo(0, 700));
        await p.waitForTimeout(150);
        ok(Math.abs((await bz.evaluate((b) => b.getBoundingClientRect().top))) < 1, 'Mi zona: la barra queda fija arriba al hacer scroll');
        await bz.getByRole('link', { name: 'Mis estadísticas' }).click();
        await p.waitForTimeout(400);
        const alFinal = await p.evaluate(() => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2);
        ok(((await p.locator('#temporada').evaluate((s) => s.getBoundingClientRect().top)) < 200 || alFinal) && (await bz.getByRole('link', { name: 'Mis estadísticas' }).getAttribute('aria-current')) !== null, 'Mi zona: "Mis estadísticas" lleva a su seccion y la marca');
        ok(await p.evaluate(() => { const s = document.getElementById('temporada').getBoundingClientRect(); const b = document.querySelector('nav[aria-label="Mi zona"]').getBoundingClientRect(); return s.top >= b.bottom - 2; }), 'Mi zona: la seccion no queda debajo de la barra');
        const pos = await p.evaluate(() => Object.fromEntries(['hola', 'agenda', 'domingo', 'ropa', 'temporada'].map((id) => { const e = id === 'hola' ? document.querySelector('.mz-hola') : document.getElementById(id); const r = e.getBoundingClientRect(); return [id, { x: Math.round(r.left), y: Math.round(r.top + scrollY), d: Math.round(r.right) }]; })));
        if (movil) ok(pos.hola.y < pos.agenda.y && pos.agenda.y < pos.domingo.y && pos.domingo.y < pos.ropa.y && pos.ropa.y < pos.temporada.y, 'Mi zona movil: una columna (saludo, agenda, domingo, ropa, temporada)', JSON.stringify(pos));
        else ok(pos.domingo.x > pos.agenda.d && pos.ropa.x === pos.domingo.x && pos.temporada.x === pos.agenda.x && pos.hola.x === pos.agenda.x, 'Mi zona escritorio: dos columnas (ancha: saludo, agenda y temporada; estrecha: domingo y ropa)', JSON.stringify(pos));
        const anchoMz = await p.evaluate(() => document.querySelector('.mz').getBoundingClientRect().width);
        if (!movil) ok(anchoMz > 1100, 'Mi zona escritorio: dentro del ancho maximo de la portada, no una columna de movil', String(anchoMz));
        const cuerpo = await p.textContent('main');
        ok(!/Marcar d[ií]as/i.test(cuerpo) && !/\[N\]/.test(cuerpo), 'Mi zona: sin "Marcar días que no estoy" (paso 3) ni cifras de ejemplo [N]');
        ok(await p.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(14, 13, 18)', 'Mi zona: tema oscuro de la portada');
        await p.evaluate(() => window.scrollTo(0, 0));
        await fotoEstatica(p, `mizona_${rol}_${etiqueta}`);
      }

      // ---- Gestion
      if (rol === 'gestor') {
        for (const ruta of GESTION) {
          await p.goto(`${APP}${ruta}`);
          const bg = p.locator('nav[aria-label="Gestión"]');
          const d = await bg.evaluate((b) => ({ fondo: getComputedStyle(b).backgroundColor, etq: b.querySelector('.zb-etq')?.textContent, grupos: b.querySelectorAll('.zb-grupo').length, paso2: [...b.querySelectorAll('.zb-paso2')].map((x) => [x.textContent.trim(), x.getAttribute('aria-disabled'), x.tagName]) }));
          const actual = await bg.locator('a[aria-current="page"]').allTextContents();
          ok(d.fondo === 'rgb(42, 36, 16)' && d.etq === 'GESTIÓN' && d.grupos === 3 && d.paso2.length === 3 && d.paso2.every((x) => x[1] === 'true' && x[2] !== 'A' && x[0].includes('paso 2')) && actual.length === 1, `${ruta}: barra de Gestion (#2A2410, GESTIÓN, 3 grupos, "paso 2" sin enlace, la actual marcada: ${actual[0]})`, JSON.stringify(d));
          const claro = await p.evaluate(() => [...document.querySelectorAll('main *')].filter((e) => e.offsetParent !== null && !e.closest('.foto'))
            // Superficies claras (tarjetas, tablas, campos): las del tema claro antiguo. Los botones primarios y la
            // etiqueta "Cerrado" van en tinta clara a proposito, como "Ver calendario" en la portada.
            .filter((e) => !e.matches('.boton, .etiqueta-cerrada'))
            .filter((e) => /^rgb\((2[0-5]\d), (2[0-5]\d), (2[0-5]\d)\)$/.test(getComputedStyle(e).backgroundColor)).map((e) => `${e.tagName}.${e.className}`));
          ok(claro.length === 0 && await p.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(14, 13, 18)', `${ruta}: tema oscuro (ningun fondo blanco o claro)`, [...new Set(claro)].join(', '));
          if (!movil) {
            const f = await bg.locator('.zb-fila').evaluate((x) => x.scrollWidth <= x.clientWidth + 1);
            ok(f, `${ruta}: en escritorio la barra de Gestion cabe entera (sin cortar "Liga consolidada")`);
          }
          if (movil) {
            const f = await bg.locator('.zb-fila').evaluate((x) => ({ desplaza: getComputedStyle(x).overflowX, sw: x.scrollWidth, cw: x.clientWidth }));
            ok(f.desplaza === 'auto' && f.sw > f.cw, `${ruta}: en movil la barra de Gestion es una fila con scroll horizontal`, JSON.stringify(f));
          }
        }
        await p.goto(`${APP}/gestion`);
        await p.evaluate(() => window.scrollTo(0, 600));
        await p.waitForTimeout(100);
        ok(Math.abs(await p.locator('nav[aria-label="Gestión"]').evaluate((b) => b.getBoundingClientRect().top)) < 1, 'Gestion: la barra queda fija arriba al hacer scroll');
        await p.evaluate(() => window.scrollTo(0, 0));
        await fotoEstatica(p, `gestion_${etiqueta}`);
        await p.goto(`${APP}/gestion/liga`);
        await fotoEstatica(p, `gestion_liga_${etiqueta}`);
        await p.goto(`${APP}/gestion/jugadores`);
        await fotoEstatica(p, `gestion_jugadores_${etiqueta}`);
      }

      // ---- Mi cuenta y Salir
      if (rol !== 'anon') {
        if (movil) { await barra.getByRole('button', { name: 'Más' }).click(); await p.getByRole('dialog', { name: 'Más' }).getByRole('link', { name: 'Mi cuenta' }).click(); }
        else { await botonUsuario.click(); await p.locator('#nv-menu-usuario').getByRole('link', { name: 'Mi cuenta' }).click(); }
        await p.waitForURL((u) => u.pathname === '/cuenta');
        const t = await p.textContent('main');
        ok(t.includes(conf.email) && t.includes('Instalar en el móvil') && (rol === 'gestor' ? t.includes('Gestor') : !t.includes('Gestor')), `Mi cuenta: una pagina para ${rol} (correo, papel e instalar en el movil)`);
        if (rol === 'gestor') await fotoEstatica(p, `cuenta_${etiqueta}`);
        if (movil) { await barra.getByRole('button', { name: 'Más' }).click(); await p.getByRole('dialog', { name: 'Más' }).getByRole('button', { name: 'Salir' }).click(); }
        else { await botonUsuario.click(); await p.locator('#nv-menu-usuario').getByRole('button', { name: 'Salir' }).click(); }
        await p.waitForURL((u) => u.pathname === '/entrar');
        await p.goto(`${APP}/`);
        ok(await p.locator('header.nv-cab').getByRole('link', { name: 'Acceso' }).isVisible(), 'Salir (menu de usuario): la cabecera vuelve a "Acceso"');
      }
      ok(errores.length === 0, 'sin errores de JavaScript', errores.join(' | '));
      await ctx.close();
    }
  }

  // Gestor sin ficha de jugador: Gestion sin Mi zona.
  console.log('\n== Gestor sin ficha de jugador');
  {
    const ctx = await nav.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, locale: 'es-ES' });
    const p = await ctx.newPage();
    await entrar(p, soloGestor);
    ok(p.url().endsWith('/gestion'), 'entra en /gestion', p.url());
    const textos = await p.locator('nav[aria-label="Secciones"] > a, nav[aria-label="Secciones"] > button').allTextContents();
    await p.goto(`${APP}/`);
    const pie = await p.locator('footer#pie a').evaluateAll((a) => a.map((x) => `${x.textContent.trim()}|${x.getAttribute('href')}`).filter((x) => /\|\/(entrar|mi-zona|gestion)$/.test(x)));
    ok(JSON.stringify(pie) === JSON.stringify(['Gestión|/gestion']), 'pie de la portada (gestor sin ficha): solo "Gestión"', pie.join(', '));
    ok(JSON.stringify(textos.map((t) => t.trim())) === JSON.stringify(['Inicio', 'Partidos', 'Liga', 'Gestión', 'Más']) && (await p.getByRole('link', { name: 'Mi zona' }).count()) === 0, 'barra inferior con "Gestión" en lugar de Mi zona; sin Mi zona', textos.join(','));
    await ctx.close();
  }

  // ---------------------------------------------------------------- GitHub Pages
  for (const [etiqueta, ancho, alto, movil] of TAMANOS) {
    console.log(`\n== Web de estadisticas (GitHub Pages), ${etiqueta}`);
    const ctx = await nav.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: movil ? 2 : 1, isMobile: movil, hasTouch: movil, locale: 'es-ES' });
    const p = await ctx.newPage();
    const errores = [];
    p.on('pageerror', (e) => errores.push(String(e)));
    await p.goto(`${WEB}/index.html`);
    await p.locator('.tab.on').waitFor({ timeout: 15000 });
    const pestanas = await p.locator('.tab').evaluateAll((t) => t.map((x) => x.dataset.p));
    const MARCA = { liga: 'Liga', jugadores: 'Plantilla', historia: 'Historia' };
    const malas = [];
    for (const t of pestanas) {
      await p.goto(`${WEB}/index.html?p=${t}`);
      await p.locator('.tab.on').waitFor({ timeout: 15000 });
      const d = await p.evaluate(() => {
        const b = document.getElementById('mcb');
        if (!b) return null;
        return {
          fija: getComputedStyle(b).position, primera: document.body.firstElementChild === b,
          volver: b.querySelector('.mcb-volver')?.getAttribute('href'), volverTxt: b.querySelector('.mcb-volver')?.textContent.trim(),
          enlaces: [...b.querySelectorAll('nav a')].map((a) => [a.textContent.trim(), a.getAttribute('href'), a.getAttribute('aria-current'), a.target]),
          nota: b.textContent.includes('Estadísticas · versión anterior de la web'),
          cabe: b.scrollWidth <= window.innerWidth + 1, activa: document.querySelector('.tab.on')?.dataset.p,
        };
      });
      if (!d) { malas.push(`${t}: sin barra`); continue; }
      const marcadas = d.enlaces.filter((e) => e[2] === 'page').map((e) => e[0]);
      const esperado = MARCA[d.activa] ? [MARCA[d.activa]] : [];
      const menuOk = JSON.stringify(d.enlaces.map((e) => [e[0], e[1]])) === JSON.stringify([['Inicio', PORTADA_PROD], ['Partidos', `${PORTADA_PROD}#calendario`], ['Liga', '?p=liga'], ['Plantilla', '?p=jugadores'], ['Historia', '?p=historia'], ['El club', `${PORTADA_PROD}club`]]);
      if (d.fija !== 'sticky' || !d.primera || d.volver !== PORTADA_PROD || d.volverTxt !== '← Volver a Maccabis' || !menuOk || !d.nota || !d.cabe || d.enlaces.some((e) => e[3]) || JSON.stringify(marcadas) !== JSON.stringify(esperado)) malas.push(`${t}: ${JSON.stringify(d)}`);
    }
    ok(malas.length === 0, `la barra existe en las ${pestanas.length} pestañas: "← Volver a Maccabis" a la portada, el mismo menu (activa marcada), el texto y sin target=_blank`, malas.join(' | ').slice(0, 600));
    await p.goto(`${WEB}/index.html?p=equipo`);
    await p.locator('.tab.on').waitFor();
    await p.evaluate(() => window.scrollTo(0, 1500));
    ok(Math.abs(await p.locator('#mcb').evaluate((b) => b.getBoundingClientRect().top)) < 1, 'la barra queda fija arriba al hacer scroll');
    await p.evaluate(() => window.scrollTo(0, 0));
    if (movil) {
      ok(await p.locator('#mcbMenu').isHidden() && await p.locator('.mcb-volver').isVisible() && await p.locator('#mcbMas').isVisible(), 'movil: barra compacta (Volver y menu desplegable)');
      await p.locator('#mcbMas').click();
      ok(await p.locator('#mcbMenu').isVisible() && (await p.locator('#mcbMas').getAttribute('aria-expanded')) === 'true', 'movil: el menu se despliega');
      await foto(p, `github_pages_barra_menu_${etiqueta}`, false);
      await p.keyboard.press('Escape');
      ok(await p.locator('#mcbMenu').isHidden(), 'movil: Esc cierra el menu');
      await p.locator('#mcbMas').click();
    }
    await p.locator('#mcbMenu').getByRole('link', { name: 'Plantilla' }).click();
    ok((await p.locator('.tab.on').getAttribute('data-p')) === 'jugadores' && (await p.locator('#mcbMenu a[data-p="jugadores"]').getAttribute('aria-current')) === 'page' && p.url().includes('p=jugadores'), '"Plantilla" abre su pestaña y queda marcada');
    await p.locator('.tab[data-p="rankings"]').click();
    ok((await p.locator('#mcbMenu a[aria-current]').count()) === 0, 'una pestaña sin equivalente en el menu (Rankings) no marca nada');
    await p.goto(`${WEB}/index.html?p=liga`);
    await p.locator('.tab.on').waitFor();
    await foto(p, `github_pages_barra_${etiqueta}`, false);
    ok(errores.length === 0, 'GitHub Pages: sin errores de JavaScript', errores.join(' | '));
    await ctx.close();
  }
} finally {
  servidorWeb.close();
  if (nav) await nav.close();
  if (app) app.kill();
  await pila.parar();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
