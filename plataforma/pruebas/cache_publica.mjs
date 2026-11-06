#!/usr/bin/env node
// Cache de la web publica (D175): las paginas que se sirven ya hechas (estaticas o con revalidate) NO llevan nada de nadie.
//   - Todas las paginas prerenderizadas de la compilacion (sale de .next/prerender-manifest.json), pedidas SIN sesion y CON
//     la cookie de una persona: ninguna contiene su nombre, su correo ni su id, y todas son iguales con y sin cookie;
//   - el orden no importa: pedirlas con sesion antes no contamina lo que ve un anonimo despues;
//   - «/» con sesion es otra pagina (el inicio personal, reescrita por el proxy) y va SIN cache; sin sesion, la portada
//     publica cacheable; lo dinamico con sesion (agenda, scouting…) tampoco se cachea;
//   - ?hoy=, ?g=, ?persona=, ?t= van a su pagina gemela dinamica (sin cache) y se ven igual que siempre (desde el bloque 6,
//     ?persona= en /club/historia y ?t= en /club; /plantilla y /historia redirigen alli con 308);
//   - /api/sesion: sin cookie, nadie; con cookie, la persona, y nunca en cache;
//   - en Chrome: la cabecera y el pie con y sin sesion, sin parpadeo de «Acceso» para quien ya ha entrado;
//   - el matcher del proxy lleva el nombre de la cookie del proyecto de Supabase de .env.local (si no, la web publica
//     pasaria por una funcion o, peor, el inicio personal no se reescribiria).
//
//   npm run pruebas:cache-publica
import fs from 'node:fs';
import path from 'node:path';
import { preparar, personas, sinteticos, contador, visto, RAIZ } from './comun_e2e.mjs';
import { jornadaPublicada, comprobarHtml } from './verificar_jornada.mjs';

const { ok, fallos } = contador();
const e = await preparar();
const { sql, APP } = e;

const NOMBRE = 'Zeta', CORREO = 'zeta@pruebas.local';
try {
  await sinteticos(sql, [['sint-zeta', NOMBRE, true, true]]);
  const P = await personas(e.pila, { jugadores: [['sint-zeta', CORREO]] });
  const uid = P['sint-zeta'].uid;
  const MARCAS = [NOMBRE, CORREO, uid, 'Prueba, Zeta'];
  const cc = (x) => x.headers.get('cache-control') ?? '';
  /** Primer punto en que dos HTML difieren (para el mensaje). */
  const difiere = (a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return `en ${i}: «${a.slice(Math.max(0, i - 40), i + 60)}» ≠ «${b.slice(Math.max(0, i - 40), i + 60)}»`; };
  /** Las paginas cacheadas se rehacen como mucho cada minuto: se pide sin sesion, con sesion y sin sesion otra vez, y solo
   *  vale si los dos anonimos coinciden (nadie la rehizo entre medias). */
  const mismaConYSin = async (ruta, cookie) => {
    for (let i = 0; i < 4; i++) {
      const a1 = await (await fetch(`${APP}${ruta}`)).text();
      const s = await (await fetch(`${APP}${ruta}`, { headers: { cookie } })).text();
      const a2 = await (await fetch(`${APP}${ruta}`)).text();
      if (a1 === a2) return { igual: s === a1, dif: s === a1 ? '' : difiere(s, a1) };
    }
    return { igual: false, dif: 'la página cambiaba entre dos peticiones seguidas' };
  };

  console.log('\n== El matcher del proxy lleva el nombre de la cookie');
  const proxy = fs.readFileSync(path.join(RAIZ, 'src', 'proxy.ts'), 'utf8');
  ok(/key: "sb-127-auth-token"/.test(proxy), 'la pila local de las pruebas (sb-127-auth-token) está en el matcher');
  try {
    const env = fs.readFileSync(path.join(RAIZ, '.env.local'), 'utf8');
    const ref = env.match(/^NEXT_PUBLIC_SUPABASE_URL=https:\/\/([a-z0-9]+)\.supabase\.co/m)?.[1];
    ok(Boolean(ref) && proxy.includes(`key: "sb-${ref}-auth-token"`) && proxy.includes(`key: "sb-${ref}-auth-token.0"`), `el proyecto de .env.local (${ref ?? '?'}) está en el matcher, con y sin trozos`);
  } catch { console.log('  (sin plataforma/.env.local: no se comprueba el proyecto de producción)'); }

  // Las paginas prerenderizadas de ESTA compilacion.
  const manifiesto = JSON.parse(fs.readFileSync(path.join(RAIZ, '.next', 'prerender-manifest.json'), 'utf8'));
  const rutas = Object.keys(manifiesto.routes).filter((r) => !/^\/_/.test(r));
  ok(['/', '/liga', '/club', '/club/historia', '/club/el-club'].every((r) => rutas.includes(r)), `cacheadas: ${rutas.join(' ')}`);

  console.log('\n== Anónimo, antes que nadie');
  const anonimo = {};
  for (const r of rutas) {
    const x = await fetch(`${APP}${r}`);
    const t = await x.text();
    anonimo[r] = { t, html: (x.headers.get('content-type') ?? '').includes('text/html') };
    if (anonimo[r].html) ok(x.status === 200 && /s-maxage/.test(cc(x)) && !x.headers.get('set-cookie') && !MARCAS.some((m) => t.includes(m)), `${r}: 200, cacheable, sin cookies ni datos de nadie`, `${x.status} ${cc(x)}`);
  }

  // Sesion de verdad (entrando con codigo) y sus cookies, para pedir con fetch.
  const ctx = await e.contexto(1280);
  const p = await e.nuevaPagina(ctx);
  await e.entrar(p, CORREO);
  const cookie = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join('; ');
  ok(/sb-127-auth-token/.test(cookie), 'la sesión deja la cookie sb-127-auth-token');

  console.log('\n== Con la cookie de una persona: lo cacheado no cambia ni lleva nada suyo');
  for (const r of rutas) {
    if (r === '/' || !anonimo[r].html) continue;
    const x = await fetch(`${APP}${r}`, { headers: { cookie } });
    const t = await x.text();
    ok(x.status === 200 && !MARCAS.some((m) => t.includes(m)), `${r}: con sesión, sin su nombre, su correo ni su id`, `${x.status}`);
    const m = await mismaConYSin(r, cookie);
    ok(m.igual, `${r}: el mismo HTML con y sin sesión`, m.dif);
  }

  console.log('\n== «/» con y sin sesión');
  let x = await fetch(`${APP}/`, { headers: { cookie } });
  let t = await x.text();
  ok(x.status === 200 && t.includes('Hola,') && t.includes(NOMBRE) && !/s-maxage/.test(cc(x)) && /no-store|private/.test(cc(x)), '«/» con sesión: el inicio personal, sin cache', `${x.status} ${cc(x)}`);
  x = await fetch(`${APP}/`);
  t = await x.text();
  ok(!MARCAS.some((m) => t.includes(m)) && t.includes('Dos equipos.') && !t.includes('Hola,'), '«/» sin sesión, después: sigue siendo la portada pública (nada contaminado)');
  x = await fetch(`${APP}/?hoy=2026-10-06`);
  ok(x.status === 200 && (await x.text()).includes('Dos equipos.') && !/s-maxage/.test(cc(x)), '/?hoy=…: la portada pública, dinámica (gemela)', cc(x));
  x = await fetch(`${APP}/?hoy=2026-10-06`, { headers: { cookie } });
  ok(x.status === 200 && (await x.text()).includes(NOMBRE), '/?hoy=… con sesión: el inicio personal');
  x = await fetch(`${APP}/inicio`);
  t = await x.text();
  ok(x.status === 200 && t.includes('Dos equipos.') && !MARCAS.some((m) => t.includes(m)), '/inicio sin sesión: la portada pública, sin datos de nadie');

  console.log('\n== Con consulta: gemelas dinámicas, sin cache, con lo de siempre');
  for (const [r, texto] of [['/liga?g=G2', 'G2 · MdL'], ['/club/historia?persona=eric', 'historia-ficha'], ['/club?t=2025-26', '2025'], ['/liga?hoy=2026-10-06', 'Próximos partidos']]) {
    x = await fetch(`${APP}${r}`);
    t = await x.text();
    ok(x.status === 200 && t.includes(texto) && !/s-maxage/.test(cc(x)), `${r}: 200 y sin cache`, `${x.status} ${cc(x)}`);
  }

  // La rutina A comprueba la jornada con una sola peticion a /liga (verificar_jornada.mjs web, D179): su lectura del HTML
  // tiene que valer con la pagina de verdad.
  console.log('\n== /liga trae la última jornada publicada (lo que mira la rutina A sin navegador)');
  const lj = comprobarHtml(await (await fetch(`${APP}/liga`)).text(), jornadaPublicada(JSON.parse(fs.readFileSync(path.join(RAIZ, 'src', 'data', 'liga.json'), 'utf8'))));
  ok(lj.length > 2 && lj.every((x) => x.ok), `/liga: ${lj.length} comprobaciones de verificar_jornada`, lj.filter((x) => !x.ok).map((x) => x.texto).join(' / '));

  console.log('\n== Lo dinámico con sesión no se cachea');
  for (const r of ['/agenda', '/cuenta', '/liga/scouting', '/mis-numeros']) {
    x = await fetch(`${APP}${r}`, { headers: { cookie }, redirect: 'manual' });
    await x.text();
    ok(!/s-maxage|public/.test(cc(x)), `${r}: sin cache pública (${cc(x)})`);
  }

  console.log('\n== /api/sesion');
  x = await fetch(`${APP}/api/sesion`);
  let j = await x.json();
  ok(x.status === 200 && j.usuario === null && j.chat === null && j.verLiga === false && /no-store/.test(cc(x)), 'sin cookie: nadie, sin cache');
  x = await fetch(`${APP}/api/sesion`, { headers: { cookie } });
  j = await x.json();
  ok(j.usuario?.corto === NOMBRE && j.usuario?.esJugador === true && j.verLiga === true && /no-store/.test(cc(x)) && /private/.test(cc(x)), 'con cookie: ella, jugadora con acceso a la liga, y nunca en cache', JSON.stringify(j).slice(0, 120));

  console.log('\n== En Chrome');
  const anon = await e.nuevaPagina(await e.contexto(1280));
  await anon.goto(`${APP}/liga`);
  ok(await visto(anon.locator('header .nv-acceso')), 'sin sesión: «Acceso» en la cabecera');
  ok(await anon.evaluate(() => document.documentElement.dataset.sesion === undefined || document.documentElement.dataset.sesion === 'listo'), 'sin cookie la cabecera no espera a nada');
  ok(await visto(anon.getByRole('link', { name: 'Acceso jugadores y gestores' })), 'sin sesión: el pie lleva el acceso');
  ok((await anon.locator('.e-nav a').allInnerTexts()).every((s) => !/Jugadores de la liga|Scouting|consolidada/i.test(s)), 'sin sesión: la liga no enseña «Jugadores de la liga» (Liga consolidada) ni Scouting');

  // Las gemelas dinamicas (rewrite) se ven bajo la direccion de siempre: la navegacion marca la pestaña de siempre.
  await anon.goto(`${APP}/liga?g=G2`);
  ok((await anon.locator('.e-nav a[href="/liga"]').getAttribute('aria-current')) === 'page' && new URL(anon.url()).pathname === '/liga', '/liga?g=G2 (gemela dinámica): sigue siendo /liga y su pestaña está marcada');

  // Con sesion, en paginas cacheadas (la cookie la puso entrar()).
  for (const ruta of ['/liga', '/club', '/club/historia']) {
    await p.goto(`${APP}${ruta}`);
    ok(await visto(p.locator('header .nv-avatar'), 10000) && (await p.locator('header .nv-avatar-nombre').innerText()) === NOMBRE, `${ruta} con sesión: su nombre en la cabecera`);
    ok((await p.locator('header .nv-acceso').count()) === 0, `${ruta} con sesión: ni rastro de «Acceso»`);
    ok(await visto(p.getByRole('link', { name: 'Tu agenda' }), 5000), `${ruta} con sesión: el pie lleva «Tu agenda»`);
  }
  await p.goto(`${APP}/liga`);
  ok(await visto(p.locator('nav[aria-label="Liga"]').getByRole('link', { name: 'Jugadores de la liga' }), 8000), '/liga con sesión: aparece la pestaña «Jugadores de la liga»');
  ok(await p.evaluate(() => document.documentElement.dataset.sesion === 'listo'), 'la cabecera ya no está escondida');
  // «/» con sesion, cargada de golpe: el proxy la reescribe a /inicio y la navegacion sigue viendo «/».
  await p.goto(`${APP}/`);
  ok(new URL(p.url()).pathname === '/' && (await p.locator('nav[aria-label="Principal"] a[href="/"]').getAttribute('aria-current')) === 'page', '«/» con sesión (reescrita a /inicio): sigue siendo «/» y "Inicio" está marcado', p.url());
  await p.goto(`${APP}/liga`);
  // Navegar sin recargar no vuelve a pedir la sesion; «Salir» la quita.
  let pedidas = 0;
  p.on('request', (r) => { if (r.url().endsWith('/api/sesion')) pedidas++; });
  await p.locator('header .nv-menu').getByRole('link', { name: 'Historia', exact: true }).click();
  await p.waitForURL(/\/historia/);
  ok(await visto(p.locator('header .nv-avatar')) && pedidas === 0, 'navegar dentro de la web no vuelve a pedir la sesión', `pedidas ${pedidas}`);
  await p.locator('header .nv-avatar').click();
  await p.getByRole('button', { name: 'Salir' }).first().click();
  await p.waitForURL(/\/entrar/);
  ok(await visto(p.locator('header .nv-acceso')), 'tras «Salir», la cabecera vuelve a «Acceso»');
  await p.goto(`${APP}/liga`);
  ok(await visto(p.locator('header .nv-acceso')) && (await p.locator('header .nv-avatar').count()) === 0, 'y en una página cacheada sigue sin sesión');

  ok(e.errores.length === 0, 'sin errores de JS ni de consola', e.errores.slice(0, 3).join(' | '));
} finally {
  await e.parar();
}
console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK');
process.exit(fallos() ? 1 : 0);
