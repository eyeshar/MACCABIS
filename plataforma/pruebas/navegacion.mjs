#!/usr/bin/env node
// Navegacion unica (D89; desde D189 la de la estructura nueva), de extremo a extremo: la misma cabecera en toda la web y
// por rol (sin sesion, jugador, gestor con y sin ficha), barra inferior en movil (Semana · Calendario · Liga · Club, y
// Gestión para los gestores; sin sesion Inicio · Liga · Club · Acceso), sin hoja «Más», sin desplegables ni barra de
// Gestión, el avatar a «Yo», Gestion en el tema oscuro, y la barra de vuelta de la web de estadisticas (GitHub Pages).
// Pila local (Postgres + PostgREST con nuestras migraciones) + app compilada + Chrome.
//
//   npm run pruebas:navegacion
//
// Deja capturas reales en privado/mockups_liga/rediseno/nav1b/.

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { arrancar } from './pila.mjs';
import { arrancarApp, abrirNavegador } from './infra/app.mjs';
import { PUERTOS, exigirLibres } from './infra/puertos.mjs';
import { trasAccion, hasta, gotoConSesion, sesionLista } from './infra/esperas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.join(RAIZ, '..');
const SALIDA = path.join(REPO, 'privado', 'mockups_liga', 'rediseno', 'nav1b');
fs.mkdirSync(SALIDA, { recursive: true });

const PUERTO = PUERTOS.app, PUERTO_WEB = PUERTOS.app2;
await exigirLibres({ 'web anterior': PUERTO_WEB });
const APP = `http://127.0.0.1:${PUERTO}`;
const WEB = `http://127.0.0.1:${PUERTO_WEB}`;
/** Con la redireccion activada (scripts/activar_redirecciones.js) GitHub Pages ya no tiene barra: se omiten sus pruebas. */
const REDIR_ACTIVA = /var ESTA_ACTIVA = true;/.test(fs.readFileSync(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'), 'data', 'redireccion_web.js'), 'utf8'));
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
const GESTION = ['/gestion', '/gestion/jugadores', '/gestion/ropa', '/gestion/ropa/nuevo'];
// D162: Scouting rivales y Liga consolidada, dentro de la Liga, para cualquier jugador con sesion (y los gestores).
const LIGA_SESION = ['/liga/scouting', '/liga/consolidada'];
const ROLES = {
  anon: { paginas: PUBLICAS },
  jugador: { email: 'jugador@pruebas.local', paginas: [...PUBLICAS, '/calendario', '/yo', ...LIGA_SESION] },
  gestor: { email: 'gestor@pruebas.local', paginas: [...PUBLICAS, '/calendario', '/yo', ...LIGA_SESION, ...GESTION] },
};
const TAMANOS = [['375', 375, 812, true], ['escritorio', 1440, 900, false]];

const pila = await arrancar();
let app, nav;
try {
  const { sql, url, anonKey } = pila;
  const { ligaParaPruebas } = await import('./infra/liga.mjs'); // en Actions, sin hojas (D149)
  const { cargarLiga } = await import('../scripts/cargar_liga.mjs');
  await cargarLiga(sql, ligaParaPruebas('2026-27'), '2026-27', { log: () => {} });
  const { cargarEventos } = await import('./infra/calendario.mjs');
  await cargarEventos(sql, { log: () => {} }); // el calendario publico lee de la tabla de eventos (paso 2, D94)
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
  app = await arrancarApp({ puerto: PUERTO, env });
  ok(true, 'next build');

  console.log('\n== HTTP');
  let r = await fetch(`${APP}/gestion/cuenta`, { redirect: 'manual' });
  ok(r.status === 308 && new URL(r.headers.get('location'), APP).pathname === '/yo', '/gestion/cuenta redirige a /yo (una sola pagina de cada persona, D189)', `${r.status} ${r.headers.get('location')}`);
  r = await fetch(`${APP}/cuenta`, { redirect: 'manual' });
  ok(r.status === 308 && new URL(r.headers.get('location'), APP).pathname === '/yo', '/cuenta redirige a /yo (308)', `${r.status} ${r.headers.get('location')}`);
  r = await fetch(`${APP}/yo`, { redirect: 'manual' });
  ok(r.status >= 300 && r.status < 400 && (r.headers.get('location') || '').includes('/entrar'), '/yo sin sesion redirige a /entrar');
  ok((r.headers.get('x-robots-tag') || '').includes('noindex'), '/yo: X-Robots-Tag noindex (exige login, D85)');
  ok((await (await fetch(`${APP}/robots.txt`)).text()).includes('Disallow: /yo'), 'robots.txt: Disallow /yo');

  nav = await abrirNavegador();
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
    await p.getByLabel('Código del correo').fill((await codigoDe(email)) ?? '000000');
    await p.getByRole('button', { name: 'Entrar', exact: true }).click();
    await p.waitForURL((u) => !u.pathname.startsWith('/entrar') || u.pathname.startsWith('/entrar/elegir'), { timeout: 15000 });
    await sesionLista(p);
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
      const p = gotoConSesion(await ctx.newPage());
      const errores = [];
      p.on('pageerror', (e) => errores.push(String(e)));
      p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
      if (conf.email) {
        await entrar(p, conf.email);
        if (rol === 'gestor') ok(new URL(p.url()).pathname === '/', 'gestor que tambien es jugador: entra en su Semana (con «Gestión · N pendientes», D189)', p.url());
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
          blank: [...document.querySelectorAll('header a, nav a')].filter((a) => a.target === '_blank').length,
          inicio: [...document.querySelectorAll('header a[href="/"], nav[aria-label="Secciones"] a[href="/"]')].some((a) => a.getBoundingClientRect().height > 0),
          externos: [...document.querySelectorAll('nav[aria-label="Principal"] a[href^="https://eyeshar.github.io/"]')].map((a) => ({ svg: a.querySelectorAll('svg').length, t: a.target })),
        }));
        if (d.cabeceras !== 1) problemas.viejas.push(`${ruta}: ${d.cabeceras} cabeceras`);
        if (d.viejas) problemas.viejas.push(`${ruta}: ${d.viejas} piezas de las cabeceras antiguas`);
        if (d.desborda) problemas.desborda.push(ruta);
        if (d.blank) problemas.blank.push(ruta);
        if (!d.inicio) problemas.sinInicio.push(ruta);
        if (!movil && (d.externos.length !== 0 || d.externos.some((x) => x.svg || x.t))) problemas.blank.push(`${ruta}: Liga/Plantilla/Historia con icono o target`);
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
        const peq = await p.evaluate(() => [...document.querySelectorAll('header.nv-cab a, header.nv-cab button, nav[aria-label="Secciones"] a, nav[aria-label="Secciones"] button')]
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

      // ---- Lo que ve cada rol (D189: barra Semana · Calendario · Liga · Club [· Gestión]; sin sesion Inicio · Liga · Club · Acceso)
      // Con sesion, «/» es la Semana (sin pie): el pie de la web publica se mira en /club.
      await p.goto(`${APP}/club`);
      const pie = await p.locator('footer#pie a').evaluateAll((a) => a.map((x) => `${x.textContent.trim()}|${x.getAttribute('href')}`));
      const piePrevisto = { anon: ['Acceso jugadores y gestores|/entrar'], jugador: ['Tu calendario|/calendario'], gestor: ['Tu calendario|/calendario', 'Gestión|/gestion'] }[rol];
      const pieZonas = pie.filter((x) => /\|\/(entrar|calendario|gestion)$/.test(x));
      await p.goto(`${APP}/`);
      ok(JSON.stringify(pieZonas) === JSON.stringify(piePrevisto), `pie de la portada con la misma sesion que la cabecera (${rol}): ${piePrevisto.map((x) => x.split('|')[0]).join(' y ')}`, pie.join(', '));
      const cab = p.locator('header.nv-cab');
      const barra = p.locator('nav[aria-label="Secciones"]');
      const avatar = cab.getByTestId('avatar');
      const previsto = { anon: ['Inicio', 'Liga', 'Club', 'Acceso'], jugador: ['Semana', 'Calendario', 'Liga', 'Club'], gestor: ['Semana', 'Calendario', 'Liga', 'Club', 'Gestión'] }[rol];
      const items = movil ? await barra.locator(':scope > a').allTextContents() : await p.$$eval('nav[aria-label="Principal"] a', (a) => a.map((x) => x.textContent));
      ok(JSON.stringify(items.map((t) => t.trim())) === JSON.stringify(previsto), `${movil ? 'barra inferior' : 'cabecera'}: ${previsto.join(' · ')} (D189)`, items.join(','));
      const marcado = async () => (movil ? barra.locator('a[aria-current="page"]') : p.locator('nav[aria-label="Principal"] a[aria-current="page"]')).allTextContents();
      ok((await marcado()).map((t) => t.trim()).join() === previsto[0], `en «/», «${previsto[0]}» marcado (aria-current)`);
      ok((await p.locator('.nv-hoja, #nv-hoja-mas, #nv-menu-gestion, #nv-menu-usuario, nav[aria-label="Gestión"]').count()) === 0 && (await p.getByRole('button', { name: 'Más' }).count()) === 0, 'sin hoja «Más», sin desplegables y sin barra de Gestión (D189)');
      if (rol === 'anon') {
        ok((await avatar.count()) === 0 && (await p.locator('a[href="/entrar"]').count()) > 0, 'sin sesion: sin avatar, con «Acceso» a /entrar');
      } else {
        ok(await avatar.isVisible() && (await avatar.getAttribute('href')) === '/yo' && (await avatar.textContent()).includes(rol === 'jugador' ? 'J' : 'E'), `${rol}: avatar con su inicial, a «Yo»`);
        if (!movil) ok((await avatar.textContent()).includes(rol === 'jugador' ? 'Jon' : 'Edu'), `${rol}: su nombre en la cabecera`);
        ok((await p.locator('a[href="/entrar"]').count()) === 0, `${rol}: la portada reconoce la sesion (sin «Acceso»)`);
      }
      await p.goto(`${APP}/club`);
      ok((await marcado()).map((t) => t.trim()).join() === 'Club', 'en /club, «Club» marcado');
      if (rol !== 'anon') {
        await p.goto(`${APP}/calendario`);
        ok((await marcado()).map((t) => t.trim()).join() === 'Calendario', 'en /calendario, «Calendario» marcado');
        if (movil) ok((await p.getByTestId('titulo-seccion').textContent()).trim() === 'Calendario', 'movil: el titulo de la seccion en la cabecera');
      }
      await p.goto(`${APP}/`);
      await foto(p, `cabecera_${rol}_${etiqueta}`, false);

      // ---- Gestion: sin barra propia; todas sus pantallas desde /gestion y de vuelta con «‹»
      if (rol === 'gestor') {
        for (const ruta of GESTION) {
          await p.goto(`${APP}${ruta}`);
          ok((await marcado()).map((t) => t.trim()).join() === 'Gestión', `${ruta}: «Gestión» marcado`);
          const claro = await p.evaluate(() => [...document.querySelectorAll('main *')].filter((e) => e.offsetParent !== null && !e.closest('.foto'))
            // Superficies claras (tarjetas, tablas, campos): las del tema claro antiguo. Los botones primarios y la
            // etiqueta "Cerrado" van en tinta clara a proposito, como "Ver calendario" en la portada.
            .filter((e) => !e.matches('.boton, .etiqueta-cerrada'))
            .filter((e) => /^rgb\((2[0-5]\d), (2[0-5]\d), (2[0-5]\d)\)$/.test(getComputedStyle(e).backgroundColor)).map((e) => `${e.tagName}.${e.className}`));
          ok(claro.length === 0 && await p.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(14, 13, 18)', `${ruta}: tema oscuro (ningun fondo blanco o claro)`, [...new Set(claro)].join(', '));
          if (ruta !== '/gestion') ok(await p.getByTestId('volver').first().isVisible(), `${ruta}: un «‹» de vuelta`);
        }
        if (!movil) {
          // Contraste de la clasificación con la oficial (D164, rutina B): pegar y «Contrastar», sin guardar nada.
          await p.goto(`${APP}/gestion/clasificacion`);
          await p.fill('#oficial', 'G1;MACCABI DE ACOSTAR;99;3;3;0;192;71;0');
          await p.getByRole('button', { name: 'Contrastar' }).click();
          const res = p.locator('[data-testid="contraste-resultado"]');
          ok(await hasta(async () => (await res.count()) === 1) && /DIFIERE/.test(await res.textContent()) && (await res.textContent()).includes('G1 MdA: puntos calculada'), '/gestion/clasificacion: lo pegado se contrasta solo y dice «DIFIERE» con la diferencia', await res.textContent().catch(() => ''));
        }
        await p.goto(`${APP}/gestion`);
        await fotoEstatica(p, `gestion_${etiqueta}`);
        await p.goto(`${APP}/gestion/jugadores`);
        await fotoEstatica(p, `gestion_jugadores_${etiqueta}`);
      }

      // ---- Yo (D189: sustituye a Mi cuenta) y Salir
      if (rol !== 'anon') {
        await p.goto(`${APP}/mi-zona`);
        ok(new URL(p.url()).pathname === '/' && (await p.locator('nav[aria-label="Mi zona"]').count()) === 0, '/mi-zona lleva a «/» (la Semana) y no hay barra propia de Mi zona');
        ok(await p.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(14, 13, 18)', 'Semana: tema oscuro');
        await fotoEstatica(p, `inicio_${rol}_${etiqueta}`);
        await avatar.click();
        await p.waitForURL((u) => u.pathname === '/yo');
        const t = await p.textContent('main');
        ok(t.includes(conf.email) && t.includes('Instalar en el móvil') && (rol === 'gestor' ? t.includes('Gestor') : !t.includes('Gestor')), `Yo: una pagina para ${rol} (correo, papel e instalar en el movil)`);
        ok((await avatar.getAttribute('aria-current')) === 'page', 'Yo: el avatar queda marcado');
        if (rol === 'gestor') await fotoEstatica(p, `yo_${etiqueta}`);
        await p.getByRole('button', { name: 'Salir' }).click();
        await p.waitForURL((u) => u.pathname === '/entrar');
        await p.goto(`${APP}/`);
        ok(await hasta(() => p.locator(movil ? 'nav.nv-barra a[href="/entrar"]' : 'nav.nv-menu a[href="/entrar"]').isVisible()), 'Salir (en Yo): la cabecera vuelve a «Acceso»');
      }
      ok(errores.length === 0, 'sin errores de JavaScript', errores.join(' | '));
      await ctx.close();
    }
  }

  // Gestor sin ficha de jugador: la misma barra que un gestor (D189), sin respuestas propias.
  console.log('\n== Gestor sin ficha de jugador');
  {
    const ctx = await nav.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, locale: 'es-ES' });
    const p = gotoConSesion(await ctx.newPage());
    await entrar(p, soloGestor);
    await p.goto(`${APP}/club`);
    const pie = await p.locator('footer#pie a').evaluateAll((a) => a.map((x) => `${x.textContent.trim()}|${x.getAttribute('href')}`).filter((x) => /\|\/(entrar|calendario|gestion)$/.test(x)));
    ok(JSON.stringify(pie) === JSON.stringify(['Gestión|/gestion']), 'pie de la portada (gestor sin ficha): solo "Gestión"', pie.join(', '));
    const textos = await p.locator('nav[aria-label="Secciones"] > a').allTextContents();
    ok(JSON.stringify(textos.map((t) => t.trim())) === JSON.stringify(['Semana', 'Calendario', 'Liga', 'Club', 'Gestión']), 'barra inferior: Semana · Calendario · Liga · Club · Gestión', textos.join(','));
    await ctx.close();
  }

  // ---------------------------------------------------------------- GitHub Pages
  for (const [etiqueta, ancho, alto, movil] of (REDIR_ACTIVA ? [] : TAMANOS)) {
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
  app?.parar();
  await pila.parar();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
