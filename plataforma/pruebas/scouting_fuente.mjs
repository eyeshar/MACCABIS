#!/usr/bin/env node
// Una sola fuente del calendario y Liga con sesion (D162). Pila local + app compilada + Chrome.
//
//   npm run pruebas:scouting-fuente
//
// 1. FUENTE UNICA: se mueve en la TABLA DE EVENTOS el proximo MdA contra un rival (fecha, hora y pista; el caso real de
//    «MdA–Nabuco TD, J5»: Scouting decia la fecha vieja). La copia vieja sigue en liga_calendario y en los ficheros del
//    repo. FALLA si alguna pantalla (Scouting de gestor y de jugador, Liga, portada, /calendario.ics) enseña una fecha,
//    hora o pista distinta de la tabla.
// 2. CON SESION: /liga/scouting y /liga/consolidada las ve cualquier jugador con ficha o gestor; sin sesion redirigen a
//    /entrar sin datos, con noindex, fuera del sitemap y con Disallow en robots.txt; la API no da nada al anonimo ni a una
//    cuenta sin ficha. Las rutas viejas de gestion llevan a las nuevas.
// Va tambien en GitHub Actions: sin las hojas (infra/liga.mjs) Scouting enseña el equipo sin jugadores, y lo que se
// comprueba aqui (calendario y acceso) no depende de ellas.

import { contador, personas } from './comun_e2e.mjs';
import { arrancar } from './pila.mjs';
import { cargarEventos } from '../scripts/cargar_eventos.mjs';
import { arrancarApp, abrirNavegador } from './infra/app.mjs';
import { PUERTOS } from './infra/puertos.mjs';
import { ligaParaPruebas } from './infra/liga.mjs';
import { cargarLiga } from '../scripts/cargar_liga.mjs';
import { diaLargo, diaMes, sumarDias } from '../src/lib/dias.ts';

const { ok, fallos } = contador();
// Sin comun_e2e.preparar(): la tabla se cambia ANTES de arrancar la app (la cache de datos de la fuente se llena con la
// primera visita, y aqui el cambio se hace por SQL, no desde la web, que es lo que la vaciaria).
const pila = await arrancar();
const { sql } = pila;
let app = null, navegador = null;
const errores = [];
try {
  await cargarEventos(sql, { log: () => {} });
  const liga = ligaParaPruebas('2026-27');
  await cargarLiga(sql, liga, '2026-27', { log: () => {} });
  const gente = await personas(pila, {
    jugadores: [['esteban-jon', 'jugador@pruebas.local']],
    gestores: [['Gestor de pruebas', 'gestor@pruebas.local']],
  });
  const intruso = await pila.crearUsuario('intruso@pruebas.local', 'x');
  const tIntruso = await pila.firmar({ sub: intruso, role: 'authenticated', email: 'intruso@pruebas.local' });

  console.log('\n== Se mueve un partido en la tabla de eventos (la copia vieja sigue en liga_calendario y en el repo)');
  const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  const clave = (t) => String(t).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  // El proximo MdA de liga con al menos dos dias de margen (se adelanta un dia y la portada se mira el dia anterior).
  const [ev] = await sql`select id, jornada, rival, es_local, fecha::text, to_char(inicio, 'HH24:MI') hora, numero_pista from public.eventos
    where tipo = 'liga' and equipo = 'MdA' and estado <> 'cancelado' and fecha >= ${sumarDias(hoy, 3)}::date order by fecha limit 1`;
  ok(!!ev, `hay un MdA de liga por delante (J${ev?.jornada} ${ev?.fecha} ${ev?.hora} pista ${ev?.numero_pista})`);
  const viejo = { fecha: ev.fecha, hora: ev.hora, campo: String(ev.numero_pista) };
  const nuevo = { fecha: sumarDias(ev.fecha, -1), hora: ev.hora === '13:30' ? '12:15' : '13:30', campo: ev.numero_pista === 3 ? '2' : '3' };
  await sql`update public.eventos set fecha = ${nuevo.fecha}, inicio = ${nuevo.hora}, numero_pista = ${Number(nuevo.campo)} where id = ${ev.id}`;
  const [lc] = await sql`select fecha::text, hora, campo from public.liga_calendario where equipo = 'MDA' and jornada = ${ev.jornada}`;
  ok(lc && lc.fecha === viejo.fecha, `liga_calendario conserva la copia vieja (${lc?.fecha}): una pantalla que la lea, falla`);
  const rivalClas = Object.values(liga.publico.grupos.G1.clasificacion).find((c) => clave(c.equipo) === clave(ev.rival))?.equipo;
  ok(!!rivalClas, `el rival del calendario (${ev.rival}) casa con la clasificación (${rivalClas})`);
  app = await arrancarApp({ puerto: PUERTOS.app, env: { NEXT_PUBLIC_SUPABASE_URL: pila.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: pila.anonKey } });
  const APP = app.APP;
  navegador = await abrirNavegador();
  const contexto = (ancho) => navegador.newContext({ viewport: { width: ancho, height: 812 }, isMobile: true, hasTouch: true, locale: 'es-ES' });
  const nuevaPagina = async (ctx) => { const p = await ctx.newPage(); p.on('pageerror', (e) => errores.push(`${p.url()} ${e.message}`)); return p; };
  const codigoDe = async (email) => (await sql`select codigo from public._otp_pruebas where email = ${email}`)[0]?.codigo;
  async function sesion(email, ancho) {
    const p = await nuevaPagina(await contexto(ancho));
    await p.goto(`${APP}/entrar`);
    await p.getByLabel('Tu correo').fill(email);
    await p.getByRole('button', { name: 'Enviarme el código' }).click();
    await p.getByText('Código enviado a').waitFor({ timeout: 10000 });
    await p.getByLabel('Código del correo').fill((await codigoDe(email)) ?? '000000');
    await p.getByRole('button', { name: 'Entrar', exact: true }).click();
    await p.waitForURL((u) => !u.pathname.startsWith('/entrar') || u.pathname.startsWith('/entrar/elegir'), { timeout: 15000 });
    return p;
  }
  const sinViejo = (t) => !t.includes(`${diaMes(viejo.fecha)} ·`) && !t.includes(`${+viejo.fecha.slice(8)}/${+viejo.fecha.slice(5, 7)} ·`) && !t.includes(diaLargo(viejo.fecha));

  console.log('\n== Scouting (gestor y jugador): fecha, hora y pista de la tabla');
  const esperado = `J${ev.jornada} · ${+nuevo.fecha.slice(8)}/${+nuevo.fecha.slice(5, 7)} · ${nuevo.hora} · pista ${nuevo.campo}`;
  for (const [quien, email] of [['gestor', 'gestor@pruebas.local'], ['jugador', 'jugador@pruebas.local']]) {
    const p = await sesion(email, 375);
    await p.goto(`${APP}/liga/scouting?e=${encodeURIComponent(rivalClas)}`);
    ok(new URL(p.url()).pathname === '/liga/scouting', `${quien}: entra en Scouting rivales`, p.url());
    const d = (await p.locator('.lg-prox-d').textContent().catch(() => '')).trim();
    ok(d === esperado, `${quien}: Scouting dice «${esperado}» (la tabla)`, d);
    ok(sinViejo(d), `${quien}: Scouting no enseña la fecha vieja (${viejo.fecha})`, d);
    await p.goto(`${APP}/liga/scouting`);
    ok(!(await p.locator('h2', { hasText: 'Todavía no hay datos' }).count()) && (await p.locator('.lg-cab-equipo h2').count()) === 1, `${quien}: Scouting abre el próximo rival por defecto`);
    await p.goto(`${APP}/liga/consolidada`);
    ok(new URL(p.url()).pathname === '/liga/consolidada' && (await p.locator('#ranking').count()) === 1, `${quien}: entra en Liga consolidada`, p.url());
    const pestanas = await p.locator('nav[aria-label="Liga"] a').allTextContents();
    ok(pestanas.includes('Scouting rivales') && pestanas.includes('Liga consolidada'), `${quien}: la navegación de la Liga enseña Scouting rivales y Liga consolidada`, pestanas.join(', '));
    await p.goto(`${APP}/gestion/scouting?e=${encodeURIComponent(rivalClas)}`);
    ok(new URL(p.url()).pathname === '/liga/scouting' && p.url().includes('e='), `${quien}: /gestion/scouting lleva a /liga/scouting (con el equipo)`, p.url());
    await p.goto(`${APP}/gestion/liga`);
    ok(new URL(p.url()).pathname === '/liga/consolidada', `${quien}: /gestion/liga lleva a /liga/consolidada`, p.url());
    await p.context().close();
  }

  console.log('\n== Pantallas publicas: Liga, portada y /calendario.ics');
  const dia = sumarDias(nuevo.fecha, -1);
  const html = async (r) => (await fetch(`${APP}${r}`)).text();
  const nav = await contexto(375);
  const p = await nuevaPagina(nav);
  await p.goto(`${APP}/liga?hoy=${dia}`);
  const ligaTxt = (await p.locator('.e-eqp[data-eq="MDA"] .e-eqp-s').textContent().catch(() => '')).trim();
  ok(ligaTxt === `${diaLargo(nuevo.fecha)} · ${nuevo.hora} · pista ${nuevo.campo}`, `/liga: próximo MdA el ${diaLargo(nuevo.fecha)} a las ${nuevo.hora}, pista ${nuevo.campo}`, ligaTxt);
  const pestanasAnon = await p.locator('nav[aria-label="Liga"] a').allTextContents();
  ok(!pestanasAnon.includes('Scouting rivales') && !pestanasAnon.includes('Liga consolidada'), 'sin sesión, la Liga no enseña Scouting ni Liga consolidada', pestanasAnon.join(', '));
  await p.goto(`${APP}/?hoy=${dia}`);
  const portada = (await p.locator('article.w-partido[data-equipo="MDA"] .w-partido-cab .cifra').textContent().catch(() => '')).trim();
  ok(portada === `${diaMes(nuevo.fecha)} · ${nuevo.hora} · Pista ${nuevo.campo}`, `portada: «${diaMes(nuevo.fecha)} · ${nuevo.hora} · Pista ${nuevo.campo}»`, portada);
  const ics = await html('/calendario.ics');
  const vev = ics.split('BEGIN:VEVENT').find((b) => b.includes(`(J${ev.jornada})`) && /SUMMARY:.*MdA/.test(b) && b.includes('Moratalaz'));
  ok(!!vev && vev.includes(`DTSTART;TZID=Europe/Madrid:${nuevo.fecha.replace(/-/g, '')}T${nuevo.hora.replace(':', '')}00`) && vev.includes(`Pista ${nuevo.campo}`),
    `/calendario.ics: J${ev.jornada} de MdA el ${nuevo.fecha} ${nuevo.hora}, pista ${nuevo.campo}`, vev?.split('\r\n').filter((l) => /DTSTART|LOCATION/.test(l)).join(' | '));

  console.log('\n== Sin sesion: nada (D162)');
  for (const r of ['/liga/scouting', '/liga/consolidada', `/liga/scouting?e=${encodeURIComponent(rivalClas)}`]) {
    const res = await fetch(`${APP}${r}`, { redirect: 'manual' });
    const destino = res.headers.get('location') ?? '';
    const cuerpo = await res.text();
    ok(res.status >= 300 && res.status < 400 && destino.includes('/entrar'), `anónimo en ${r}: redirige a /entrar`, `${res.status} ${destino}`);
    ok(!cuerpo.includes('lg-tabla') && !cuerpo.includes('lg-max') && !cuerpo.includes('lg-prox'), `anónimo en ${r}: la respuesta no lleva datos de la liga`);
    ok((res.headers.get('x-robots-tag') ?? '').includes('noindex'), `${r}: cabecera X-Robots-Tag noindex`, res.headers.get('x-robots-tag'));
  }
  await p.goto(`${APP}/liga/scouting`);
  ok(new URL(p.url()).pathname === '/entrar', 'anónimo en el navegador: acaba en /entrar', p.url());
  const robots = await html('/robots.txt');
  ok(/Disallow: \/liga\/scouting/.test(robots) && /Disallow: \/liga\/consolidada/.test(robots), 'robots.txt: Disallow de /liga/scouting y /liga/consolidada');
  const sitemap = await html('/sitemap.xml');
  ok(!sitemap.includes('/liga/scouting') && !sitemap.includes('/liga/consolidada'), 'fuera del sitemap');
  const api = async (tabla, token) => {
    const r = await fetch(`${pila.url}/rest/v1/${tabla}?select=*&limit=5`, { headers: { apikey: pila.anonKey, authorization: `Bearer ${token ?? pila.anonKey}` } });
    const d = await r.json().catch(() => null);
    return r.status === 401 || r.status === 403 || (Array.isArray(d) && d.length === 0);
  };
  for (const t of ['liga_partidos', 'liga_estadisticas_jugador', 'v_liga_jugadores', 'liga_clasificacion', 'liga_calendario']) {
    ok(await api(t), `API: el anónimo no lee ${t}`);
    ok(await api(t, tIntruso), `API: una cuenta sin ficha ni gestión no lee ${t}`);
  }
  ok(!(await api('liga_clasificacion', gente['esteban-jon'].token)), 'API: un jugador con ficha lee liga_clasificacion');
  ok(await api('liga_calendario', gente['esteban-jon'].token), 'API: liga_calendario sigue solo para gestores (ya no la lee ninguna pantalla)');
  await nav.close();
  ok(errores.length === 0, 'sin errores de JavaScript', errores.join(' | '));
} finally {
  await navegador?.close().catch(() => {});
  app?.parar();
  await pila.parar();
}
console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK');
process.exit(fallos() ? 1 : 0);
