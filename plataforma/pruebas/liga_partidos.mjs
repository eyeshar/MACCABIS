#!/usr/bin/env node
// Liga sin «casa/fuera», equipos y partidos enlazados (D129), de extremo a extremo: pila local (Postgres + PostgREST
// reales con nuestras migraciones) con la liga cargada (`db:liga`), la app Next.js compilada de verdad y Chrome.
//
//   npm run pruebas:liga-partidos
//
// Comprueba, en los dos grupos: que cada equipo de la clasificacion y de los resultados enlaza a su ficha (la de Rivales
// 26/27 o la de MdA/MdL) y que la ficha se abre; que cada partido enlaza a su pagina; la pagina de partido con hoja
// (parciales del acta, estadisticas por equipo, boxscore de los nuestros) y sin hoja (incomparecencia o sin descargar:
// solo el marcador); que «Rival por jugador · solo gestores» solo lo ve un gestor (ni anonimos ni jugadores); que no
// queda «en casa / fuera» a la vista; y el color de la racha (G verde, P rojo; el numero, del ultimo resultado).
//
// Para la pagina «sin hoja» se añaden a la copia de la liga (src/data/liga.json) dos partidos de prueba en la J22 (que
// aun no se ha jugado) durante la compilacion, y se deja el fichero como estaba al terminar.
// Capturas (375 y 1280 px) en <privado>/mockups_liga/convocatoria-proyeccion/liga/ (MACCABIS_PRIVADO o privado/ del
// repositorio; fuera de git: la de gestor lleva nombres de jugadores de otros equipos).
// Puertos: los del carril de este worktree (infra/puertos.mjs, D149).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { arrancar } from './pila.mjs';
import { leerLiga, cargarLiga } from '../scripts/cargar_liga.mjs';
import { arrancarApp, abrirNavegador, compilar } from './infra/app.mjs';
import { PUERTOS } from './infra/puertos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.join(RAIZ, '..');
const SALIDA = path.join(process.env.MACCABIS_PRIVADO || path.join(REPO, 'privado'), 'mockups_liga', 'convocatoria-proyeccion', 'liga');
fs.mkdirSync(SALIDA, { recursive: true });
const PUERTO = PUERTOS.app;
const APP = `http://127.0.0.1:${PUERTO}`;
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };

async function esperar(url, ms = 90000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) { try { const r = await fetch(url); if (r.status < 500) return; } catch {} await new Promise((r) => setTimeout(r, 300)); }
  throw new Error(`${url} no arranca`);
}

// ---- Datos esperados (se leen de los datos, que crecen cada jornada)
const LIGA_JSON = path.join(RAIZ, 'src', 'data', 'liga.json');
// Si una ejecucion anterior murio a medias (sin pasar por el finally), su respaldo devuelve el fichero a como estaba.
const RESPALDO = path.join(RAIZ, 'pruebas', '.liga.json.respaldo');
if (fs.existsSync(RESPALDO)) { fs.copyFileSync(RESPALDO, LIGA_JSON); fs.rmSync(RESPALDO); }
const original = fs.readFileSync(LIGA_JSON);
const liga = JSON.parse(original.toString('utf8'));
const season = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'season_2026-27.json'), 'utf8'));
const GR = { G1: liga.grupos.G1, G2: liga.grupos.G2 };
const nuestroId = (g) => Object.values(GR[g].equipos).find((e) => e.nuestro).id;
const conHojaNuestro = GR.G1.resultados.find((r) => r.est && [r.local_id, r.visitante_id].includes(nuestroId('G1')));
const conHojaAjeno = GR.G2.resultados.find((r) => r.est && ![r.local_id, r.visitante_id].includes(nuestroId('G2')));
const conRachaP = Object.values(GR.G1.equipos).find((e) => e.racha?.tipo === 'P') ?? Object.values(GR.G2.equipos).find((e) => e.racha?.tipo === 'P');
const conRachaG = Object.values(GR.G1.equipos).find((e) => e.racha?.tipo === 'G');
const grupoDe = (id) => (GR.G1.equipos[id] ? 'G1' : 'G2');
// Partidos de prueba sin hoja (J22: aun no se ha jugado; no salen en las listas, solo por su enlace).
const eqs = (g) => Object.values(GR[g].equipos).filter((e) => !e.nuestro).map((e) => e.id);
const [a1, b1] = eqs('G1'), [a2, b2] = eqs('G2');
const INCOMP = { id: `g1-j22-${a1}-${b1}`, jornada: 22, fecha: '2027-05-30', local: GR.G1.equipos[a1].nombre, local_id: a1, visitante: GR.G1.equipos[b1].nombre, visitante_id: b1, incomparecencia: true, no_presentado: GR.G1.equipos[b1].nombre };
const SIN_HOJA = { id: `g2-j22-${a2}-${b2}`, jornada: 22, fecha: '2027-05-30', local: GR.G2.equipos[a2].nombre, local_id: a2, visitante: GR.G2.equipos[b2].nombre, visitante_id: b2, pl: 41, pv: 37 };
const CASA_FUERA = /\ben casa\b|\bfuera de casa\b|·\s*fuera\b|\bEn casa\b|\bFuera\b(?! de)/;

const pila = await arrancar();
let app, nav;
try {
  const { sql, url, anonKey } = pila;
  await cargarLiga(sql, leerLiga('2026-27'), '2026-27', { log: () => {} });
  const gestorEmail = 'gestor@pruebas.local', jugadorEmail = 'jugador@pruebas.local';
  const gId = await pila.crearUsuario(gestorEmail, 'no-se-usa');
  await sql`insert into public.gestores (user_id, nombre, email) values (${gId}, 'Gestor de pruebas', ${gestorEmail})`;
  await sql`update public.jugadores set email = ${jugadorEmail} where person_id = 'esteban-jon'`;
  await pila.crearUsuario(jugadorEmail, 'no-se-usa');
  const codigoDe = async (email) => (await sql`select codigo from public._otp_pruebas where email = ${email}`)[0]?.codigo;

  console.log('\n== Compilacion (con dos partidos de prueba sin hoja en la J22)');
  const conPrueba = structuredClone(liga);
  conPrueba.grupos.G1.resultados.push(INCOMP);
  conPrueba.grupos.G2.resultados.push(SIN_HOJA);
  fs.writeFileSync(RESPALDO, original);
  fs.writeFileSync(LIGA_JSON, JSON.stringify(conPrueba, null, 1) + '\n');
  const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey, NEXT_TELEMETRY_DISABLED: '1' };
  try { compilar(env, ['NEXT_PUBLIC_SUPABASE_URL']); }
  finally { fs.writeFileSync(LIGA_JSON, original); fs.rmSync(RESPALDO, { force: true }); }
  ok(fs.readFileSync(LIGA_JSON).equals(original), 'next build; src/data/liga.json queda como estaba');
  app = await arrancarApp({ puerto: PUERTO, env, compilarAntes: false });
  nav = await abrirNavegador();
  // Con otra sesion compilando a la vez (D114) el equipo va cargado: margen amplio para cada navegacion.
  const nuevoContexto = async (op) => { const c = await nav.newContext(op); c.setDefaultNavigationTimeout(90000); c.setDefaultTimeout(30000); return c; };

  async function entrar(p, email) {
    await p.goto(`${APP}/entrar`);
    await p.getByLabel('Tu correo').fill(email);
    await p.getByRole('button', { name: 'Enviarme el código' }).click();
    await p.getByText('Código enviado a').waitFor({ timeout: 10000 });
    await p.getByLabel('Código del correo').fill((await codigoDe(email)) ?? '000000');
    await p.getByRole('button', { name: 'Entrar', exact: true }).click();
    await p.waitForURL((u) => !u.pathname.startsWith('/entrar') || u.pathname.startsWith('/entrar/elegir'), { timeout: 15000 });
  }
  const textoVisible = (p) => p.evaluate(() => document.body.innerText);
  const href = (l) => l.getAttribute('href');

  // ------------------------------------------------------------------------------------------ anonimo
  for (const [etiqueta, ancho, alto, movil] of [['375', 375, 800, true], ['1280', 1280, 900, false]]) {
    console.log(`\n== Sin sesion, ${etiqueta} px`);
    const ctx = await nuevoContexto({ viewport: { width: ancho, height: alto }, deviceScaleFactor: movil ? 2 : 1, isMobile: movil, hasTouch: movil, locale: 'es-ES' });
    const p = await ctx.newPage();
    const errores = [];
    p.on('pageerror', (e) => errores.push(String(e)));
    const sinDesbordar = () => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

    for (const g of ['G1', 'G2']) {
      await p.goto(`${APP}/liga?g=${g}`);
      const G = GR[g];
      // Clasificacion: cada equipo es un enlace de verdad a su ficha (nada de botones punteados sin destino).
      const enlacesClas = await p.locator('[data-testid="liga-clasificacion"] tbody tr td.e-eq a').evaluateAll((as) => as.map((a) => [a.textContent, a.getAttribute('href')]));
      const esperados = G.clasificacion.map((x) => [x.equipo, x.nuestro ? `/liga/2026-27/equipo?eq=${G.nuestro}` : `/liga/rivales?g=${g === 'G1' ? 'MdA' : 'MdL'}&r=${encodeURIComponent(x.id)}`]);
      ok(JSON.stringify(enlacesClas) === JSON.stringify(esperados), `${g}: los ${G.clasificacion.length} equipos de la clasificacion enlazan a su ficha`, JSON.stringify(enlacesClas.slice(0, 2)));
      ok((await p.locator('.e-enlace-boton').count()) === 0, `${g}: ningun nombre de equipo es un boton punteado sin destino`);
      // Resultados de cada jornada: los dos equipos y el marcador enlazados.
      for (const j of G.jornadas_cargadas) {
        await p.locator('.e-jornadas button', { hasText: new RegExp(`^J${j}$`) }).click();
        const filas = await p.locator('[data-testid="liga-resultados"] .e-partido').evaluateAll((ds) => ds.map((d) => ({ id: d.dataset.partido, enlaces: [...d.querySelectorAll('a')].map((a) => a.getAttribute('href')) })));
        const rs = G.resultados.filter((r) => r.jornada === j);
        const bien = filas.length === rs.length && filas.every((f, i) => f.id === rs[i].id && f.enlaces.length === 3
          && f.enlaces[1] === `/liga/2026-27/partido/${rs[i].id}` && f.enlaces[0] === esperados.find((e) => e[0] === rs[i].local)[1] && f.enlaces[2] === esperados.find((e) => e[0] === rs[i].visitante)[1]);
        ok(bien, `${g} J${j}: ${rs.length} partidos, cada uno con sus dos equipos enlazados a su ficha y el marcador a su pagina`, JSON.stringify(filas[0]));
      }
      // Todas las fichas se abren (tambien las de los equipos sin rastro en los JDM).
      if (!movil) {
        for (const [nombre, h] of esperados) {
          await p.goto(APP + h);
          if (h.startsWith('/liga/rivales')) {
            const f = p.locator('[data-testid="rivales-ficha"]');
            ok(await f.isVisible() && (await f.locator('h3').first().textContent()) === nombre, `${g}: la ficha de ${nombre} se abre en Rivales 26/27`);
          } else {
            ok((await p.locator('.e-segmento button[aria-pressed="true"]').first().textContent()) === nombre && (await p.locator('[data-testid="equipo-partidos"] tbody tr').count()) > 0,
              `${g}: la ficha de ${nombre} es su pestaña Equipo, con ${nombre} ya elegido`);
          }
        }
      }
    }

    // Racha: el numero toma el color del ultimo resultado y cada letra el suyo.
    await p.goto(`${APP}/liga?g=${grupoDe(conRachaP.id)}`);
    await p.selectOption('#lg-equipo', conRachaP.nombre);
    const color = (sel) => p.locator(sel).evaluate((e) => getComputedStyle(e).color);
    const racha = p.locator('[data-testid="liga-ficha"] .e-kpi', { hasText: 'Racha' });
    ok((await racha.locator('.e-kpi-val').textContent()) === `${conRachaP.racha.n}P` && await racha.evaluate((e) => e.classList.contains('loss')), `racha de ${conRachaP.nombre}: «${conRachaP.racha.n}P» con el tono de derrota`);
    ok((await racha.locator('.e-kpi-val').evaluate((e) => getComputedStyle(e).color)) === 'rgb(227, 93, 79)', `«${conRachaP.racha.n}P» sale en rojo (antes, en verde)`, await racha.locator('.e-kpi-val').evaluate((e) => getComputedStyle(e).color));
    const letras = await racha.locator('.e-pastilla').evaluateAll((ps) => ps.map((x) => [x.textContent, getComputedStyle(x).color]));
    ok(letras.length > 0 && letras.every(([t, c]) => (t === 'G' ? c !== 'rgb(227, 93, 79)' : c === 'rgb(227, 93, 79)')), 'cada letra de los ultimos resultados: P en rojo y G en verde', JSON.stringify(letras));
    if (movil) await p.locator('[data-testid="liga-ficha"]').screenshot({ path: path.join(SALIDA, `racha_P_${etiqueta}.png`) });
    await p.goto(`${APP}/liga?g=${grupoDe(conRachaG.id)}`);
    await p.selectOption('#lg-equipo', conRachaG.nombre);
    ok((await racha.locator('.e-kpi-val').evaluate((e) => getComputedStyle(e).color)) !== 'rgb(227, 93, 79)' && await racha.evaluate((e) => e.classList.contains('win')), `racha de ${conRachaG.nombre} («${conRachaG.racha.n}G») en verde`);
    ok((await p.locator('[data-testid="liga-ficha"] .e-mini').count()) === 0 && !/en casa|fuera/i.test(await p.locator('[data-testid="liga-ficha"]').innerText()), 'la ficha de equipo ya no tiene el bloque «En casa / Fuera»');
    // Sin «casa/fuera» a la vista en /liga (proximos partidos incluidos), en la portada ni en las fichas de rival.
    await p.goto(`${APP}/liga`);
    ok(!CASA_FUERA.test(await textoVisible(p)), '/liga: sin «en casa» ni «fuera» en ningun texto (proximos partidos incluidos)', (await textoVisible(p)).match(CASA_FUERA)?.[0]);
    ok(await sinDesbordar(), '/liga: sin desbordamiento horizontal');
    await p.screenshot({ path: path.join(SALIDA, `liga_${etiqueta}.png`), fullPage: true });
    await p.goto(`${APP}/?hoy=2026-10-07`);
    ok(!CASA_FUERA.test(await textoVisible(p)), 'portada: sin «En casa / Fuera» en la proxima jornada', (await textoVisible(p)).match(CASA_FUERA)?.[0]);
    const marcadorPortada = p.locator('section[aria-label="Últimos resultados"] a.w-marcador').first();
    ok((await marcadorPortada.count()) === 1 && /^\/liga\/2026-27\/partido\/g[12]-j\d\d-/.test(await href(marcadorPortada)), 'portada: el marcador de los ultimos resultados enlaza a la pagina del partido');
    ok((await p.locator('.w-clas-grupo[data-grupo="G1"] tbody a.w-enlace-eq').count()) >= 5, 'portada: los equipos de la clasificacion enlazan a su ficha');

    // Ficha de rival: su Liga 26/27 con la racha de colores y los partidos enlazados.
    const rivalP = conRachaP;
    await p.goto(`${APP}/liga/rivales?g=${grupoDe(rivalP.id) === 'G1' ? 'MdA' : 'MdL'}&r=${rivalP.id}`);
    const ft = p.locator('[data-testid="rival-temporada"]');
    ok(await ft.isVisible() && (await ft.locator('[data-testid="racha-num"]').evaluate((e) => getComputedStyle(e).color)) === 'rgb(227, 93, 79)', `ficha de rival (${rivalP.nombre}): Liga 26/27 con la racha «${rivalP.racha.n}P» en rojo`);
    const enlacesRival = await ft.locator('.e-partido a.e-m').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    ok(enlacesRival.length > 0 && enlacesRival.every((h) => /^\/liga\/2026-27\/partido\//.test(h)), `ficha de rival: sus ${enlacesRival.length} partidos enlazan a su pagina`);
    ok(!CASA_FUERA.test(await p.locator('[data-testid="rivales-ficha"]').innerText()), 'ficha de rival: sin «casa/fuera»');
    await p.screenshot({ path: path.join(SALIDA, `ficha_rival_${etiqueta}.png`), fullPage: false });
    const sinRastro = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'rivales_2026-27_web.json'), 'utf8')).rivales.find((r) => r.sin_rastro);
    if (sinRastro) {
      await p.goto(`${APP}/liga/rivales?g=${sinRastro.grupo}&r=${sinRastro.id}`);
      ok(await p.locator('[data-testid="rivales-ficha"]').isVisible() && (await p.locator('[data-testid="rivales-ficha"]').innerText()).includes('Sin rastro en los JDM'), `ficha de un rival sin rastro en los JDM (${sinRastro.nombre}): se abre (antes el enlace no llevaba a nada)`);
    }

    // ---- Pagina de partido CON hoja, de MdA
    const r = conHojaNuestro;
    await p.goto(`${APP}/liga/2026-27/partido/${r.id}`);
    const pag = p.locator('[data-testid="pagina-partido"]');
    ok(await pag.isVisible() && (await p.locator('[data-testid="partido-marcador"]').textContent()) === `${r.pl} – ${r.pv}`, `partido ${r.local} – ${r.visitante}: marcador ${r.pl} – ${r.pv}`);
    ok((await href(p.locator('[data-testid="partido-local"]'))) === (r.local_id === 'mda' ? '/liga/2026-27/equipo?eq=MDA' : `/liga/rivales?g=MdA&r=${r.local_id}`)
      && (await href(p.locator('[data-testid="partido-visitante"]'))) === (r.visitante_id === 'mda' ? '/liga/2026-27/equipo?eq=MDA' : `/liga/rivales?g=MdA&r=${r.visitante_id}`), 'los dos equipos enlazan a su ficha');
    const cab = await p.locator('.e-pt-cab').innerText();
    const cal = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'calendario_2026-27.json'), 'utf8')).partidos.find((x) => x.equipo === 'MDA' && x.jornada === r.jornada);
    ok(cab.toLowerCase().includes(`jornada ${r.jornada}`) && cab.includes(cal.hora) && cab.toLowerCase().includes(`pista ${cal.campo}`), `cabecera: jornada, fecha, hora (${cal.hora}) y pista (${cal.campo})`, cab);
    const sp = season.partidos.find((x) => x.equipo === 'MDA' && x.fecha === r.fecha);
    const cuartos = await p.locator('[data-testid="partido-cuartos"] tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.children].slice(1).map((c) => c.textContent)));
    const nosL = r.local_id === 'mda';
    const qL = nosL ? sp.q_us : sp.q_them, qV = nosL ? sp.q_them : sp.q_us;
    ok(JSON.stringify(cuartos) === JSON.stringify([[...qL.map(String), String(r.pl)], [...qV.map(String), String(r.pv)]]), 'parciales por cuarto del acta, en el orden del cartel', JSON.stringify(cuartos));
    const est = await p.locator('[data-testid="partido-equipos"] tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.children].map((c) => c.textContent)));
    const pc = (a, i) => (i ? `${Math.round((100 * a) / i)} %` : '—');
    const esperadoEst = [['Puntos', 'pts'], ['Tiros de 2 anotados', 't2'], ['Tiros de 3 anotados', 't3']].map(([t, k]) => [t, String(r.est.local[k]), String(r.est.visitante[k])])
      .concat([['Tiros libres', `${r.est.local.tl}/${r.est.local.tl_int} · ${pc(r.est.local.tl, r.est.local.tl_int)}`, `${r.est.visitante.tl}/${r.est.visitante.tl_int} · ${pc(r.est.visitante.tl, r.est.visitante.tl_int)}`], ['Faltas cometidas', String(r.est.local.faltas), String(r.est.visitante.faltas)]]);
    ok(JSON.stringify(est) === JSON.stringify(esperadoEst), 'estadisticas por equipo (puntos, 2P, 3P, TL y faltas) = las de la hoja', JSON.stringify(est));
    const box = await p.locator('[data-testid="boxscore"] tbody tr').count();
    ok(box === season.box[`${sp.pn}_MDA`].length, `boxscore de los nuestros (${box} filas), igual que el de la pestaña Equipo`);
    ok((await p.locator('[data-testid="rival-por-jugador-seccion"]').count()) === 0 && !(await textoVisible(p)).includes('Rival por jugador'), 'sin sesion: NO sale «Rival por jugador»');
    ok(!CASA_FUERA.test(await textoVisible(p)) && await sinDesbordar(), 'sin «casa/fuera» y sin desbordamiento horizontal');
    ok((await p.locator('nav.e-nav a[aria-current="page"]').textContent()) === 'Liga 26/27' && (await p.locator('.e-temporada').count()) === 0, 'navegacion: «Liga 26/27» marcada, sin selector de temporada ni pestañas');
    await p.screenshot({ path: path.join(SALIDA, `partido_con_hoja_${etiqueta}.png`), fullPage: true });

    // ---- Pagina de partido CON hoja entre dos rivales: sin parciales ni boxscore (no hay acta ni jugadores nuestros)
    await p.goto(`${APP}/liga/2026-27/partido/${conHojaAjeno.id}`);
    ok((await p.locator('[data-testid="partido-equipos"]').count()) === 1 && (await p.locator('[data-testid="partido-cuartos"]').count()) === 0 && (await p.locator('[data-testid="boxscore"]').count()) === 0
      && (await p.locator('.e-pt-cab').innerText()).includes('no consta'), `partido entre rivales (${conHojaAjeno.local} – ${conHojaAjeno.visitante}): estadisticas por equipo; sin parciales, boxscore ni pista (no constan)`);

    // ---- SIN hoja: incomparecencia y hoja sin descargar
    await p.goto(`${APP}/liga/2026-27/partido/${INCOMP.id}`);
    ok((await p.locator('[data-testid="partido-sin-hoja"]').innerText()).includes(`no se presentó ${INCOMP.no_presentado}`) && (await p.locator('[data-testid="partido-marcador"]').textContent()) === 'incomp.'
      && (await p.locator('.e-tabla').count()) === 0, 'incomparecencia: la pagina lo dice y no enseña tablas');
    await p.goto(`${APP}/liga/2026-27/partido/${SIN_HOJA.id}`);
    ok((await p.locator('[data-testid="partido-sin-hoja"]').innerText()).includes('Falta la hoja') && (await p.locator('[data-testid="partido-marcador"]').textContent()) === '41 – 37'
      && (await p.locator('.e-tabla').count()) === 0, 'hoja sin descargar: la pagina lo dice y enseña solo el marcador');
    await p.screenshot({ path: path.join(SALIDA, `partido_sin_hoja_${etiqueta}.png`), fullPage: true });
    const no = await fetch(`${APP}/liga/2026-27/partido/g1-j99-no-existe`);
    ok(no.status === 404, 'un partido que no existe: 404');
    ok(errores.length === 0, 'sin errores de JavaScript', errores.join(' | '));
    await ctx.close();
  }

  // ------------------------------------------------------------------------------------------ jugador y gestor
  console.log('\n== Jugador con sesion (no gestor)');
  {
    const ctx = await nuevoContexto({ viewport: { width: 375, height: 800 } });
    const p = await ctx.newPage();
    await entrar(p, jugadorEmail);
    await p.goto(`${APP}/liga/2026-27/partido/${conHojaNuestro.id}`);
    ok(await p.locator('[data-testid="pagina-partido"]').isVisible() && (await p.locator('[data-testid="rival-por-jugador-seccion"]').count()) === 0 && !(await p.content()).includes('Rival por jugador'),
      'un jugador ve la pagina de partido, pero NO «Rival por jugador» (ni en el HTML)');
    await ctx.close();
  }

  const [{ id: pid }] = await sql`select id from public.liga_partidos where temporada = '2026-27' and grupo = 'G1' and jornada = ${conHojaNuestro.jornada} and local = ${conHojaNuestro.local} and visitante = ${conHojaNuestro.visitante}`;
  const rivalNombre = conHojaNuestro.local_id === 'mda' ? conHojaNuestro.visitante : conHojaNuestro.local;
  const filasRival = await sql`select nombre from public.liga_estadisticas_jugador where partido_id = ${pid} and equipo = ${rivalNombre}`;
  for (const [etiqueta, ancho, alto] of [['375', 375, 800], ['1280', 1280, 900]]) {
    console.log(`\n== Gestor, ${etiqueta} px`);
    const ctx = await nuevoContexto({ viewport: { width: ancho, height: alto }, deviceScaleFactor: ancho < 640 ? 2 : 1, locale: 'es-ES' });
    const p = await ctx.newPage();
    await entrar(p, gestorEmail);
    await p.goto(`${APP}/liga/2026-27/partido/${conHojaNuestro.id}`);
    const s = p.locator('[data-testid="rival-por-jugador-seccion"]');
    ok(await s.isVisible() && (await s.locator('h2').textContent()).includes('Rival por jugador · solo gestores'), 'un gestor ve «Rival por jugador · solo gestores»');
    const tablas = await s.locator('[data-testid="rival-por-jugador"]').count();
    const filas = await s.locator('[data-testid="rival-por-jugador"] tbody tr').count();
    ok(tablas === 1 && filas === filasRival.length && filas > 0, `solo el rival (${rivalNombre}): ${filasRival.length} jugadores, leidos de Supabase`, `${tablas} tablas, ${filas} filas`);
    ok(!(await s.innerText()).includes('MdA'), 'los nuestros no salen en la seccion de rivales (ya estan en el boxscore)');
    await p.screenshot({ path: path.join(SALIDA, `partido_gestor_${etiqueta}.png`), fullPage: true });
    await p.goto(`${APP}/liga/2026-27/partido/${conHojaAjeno.id}`);
    ok((await p.locator('[data-testid="rival-por-jugador"]').count()) === 2, `partido entre rivales: el gestor ve los dos equipos por jugador`);
    await p.goto(`${APP}/liga/2026-27/partido/${SIN_HOJA.id}`);
    ok((await p.locator('[data-testid="rival-por-jugador-seccion"]').count()) === 0, 'sin hoja: tampoco hay seccion de rivales (no hay datos)');
    // Liga consolidada: cada equipo enlaza a su ficha
    await p.goto(`${APP}/gestion/liga`);
    const enl = await p.locator('details.lg-ranking tbody a.lg-enlace').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    ok(enl.length > 0 && enl.every((h) => /^\/liga\/(rivales\?g=Md[AL]&r=|2026-27\/equipo\?eq=MD[AL])/.test(h)), `Liga consolidada: los ${enl.length} equipos del ranking enlazan a su ficha`);
    await p.goto(`${APP}/gestion/scouting`);
    ok(!CASA_FUERA.test(await p.locator('.lg-prox').innerText()), 'Scouting: proximo partido sin «en casa / fuera»');
    await ctx.close();
  }
} finally {
  if (!fs.readFileSync(LIGA_JSON).equals(original)) fs.writeFileSync(LIGA_JSON, original);
  fs.rmSync(RESPALDO, { force: true });
  if (nav) await nav.close();
  app?.parar();
  await pila.parar();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
