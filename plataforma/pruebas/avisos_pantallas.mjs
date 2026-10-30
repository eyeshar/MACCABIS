#!/usr/bin/env node
// Avisos de equipacion en las pantallas (D79), de extremo a extremo: web publica (/liga) y plataforma (pila local con nuestras migraciones + app Next.js compilada + Chrome).
//
//   npm run pruebas:avisos
//
// Con "hoy" fijado a 06/10/2026 (el proximo partido de MdA y MdL es la J2 del 18/10): MdA–Litros de Mahou = aviso,
// MdL–Quinto Tiempo = sin aviso. Deja capturas reales en privado/mockups_liga/real_e_aviso_{publico,mizona,gestion}_*.png.
// En la web publica "hoy" se fija con ?hoy=AAAA-MM-DD (solo para pruebas); en la plataforma se usa la fecha real, asi
// que las comprobaciones de la plataforma calculan el proximo partido con la misma funcion que la app.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { arrancar } from './pila.mjs';
import { arrancarApp, abrirNavegador } from './infra/app.mjs';
import { PUERTOS, exigirLibres } from './infra/puertos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.join(RAIZ, '..');
const SALIDA = path.join(REPO, 'privado', 'mockups_liga');
const DEUDA = path.join(SALIDA, 'deuda-octubre');
fs.mkdirSync(SALIDA, { recursive: true });
const require = createRequire(import.meta.url);
const A = require(path.join(REPO, 'data', 'avisos_equipacion.js'));
const equip = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'equipaciones_2026-27.json'), 'utf8'));
const cal = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'calendario_2026-27.json'), 'utf8'));
const hoyReal = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
const bonito = (n) => A.equipoPorNombre(equip, n)?.nombre ?? n;
// "MdA – Litros de Mahou" (el local primero, como en Mi zona y en el calendario oficial)
const cruce = (nuestro, p) => (p.local ? `${nuestro} – ${bonito(p.rival)}` : `${bonito(p.rival)} – ${nuestro}`);
const proxReal = (e) => A.proximoPartido(cal, hoyReal, e);
const avisoReal = (e) => { const p = proxReal(e); return p ? A.avisoPartido(equip, p) : null; };
// El inicio personal (D117) enseña el próximo partido que AÚN NO HA EMPEZADO: un domingo, pasada la hora del partido, ya
// es el siguiente (antes la prueba fallaba los domingos a partir de las 9:00).
const ahoraHHMM = new Date().toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const proxInicio = (e) => {
  const p = proxReal(e);
  if (!p || p.fecha !== hoyReal || !p.hora || p.hora > ahoraHHMM) return p;
  return A.proximoPartido(cal, new Date(new Date(`${hoyReal}T12:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10), e);
};
const avisoInicio = (e) => { const p = proxInicio(e); return p ? A.avisoPartido(equip, p) : null; };

const PUERTO = PUERTOS.app;
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
  nav = await abrirNavegador();

  // =================== PLATAFORMA
  const { sql, url, anonKey } = pila;
  const { ligaParaPruebas } = await import('./infra/liga.mjs'); // en Actions, sin hojas (D149)
  const { cargarLiga } = await import('../scripts/cargar_liga.mjs');
  await cargarLiga(sql, ligaParaPruebas('2026-27'), '2026-27', { log: () => {} });
  const { cargarEventos } = await import('../scripts/cargar_eventos.mjs');
  await cargarEventos(sql, { log: () => {} }); // el calendario publico lee de la tabla de eventos (paso 2, D94)
  const gestorEmail = 'gestor@pruebas.local', jugadorEmail = 'jugador@pruebas.local';
  const gId = await pila.crearUsuario(gestorEmail, 'no-se-usa');
  await sql`insert into public.gestores (user_id, nombre, email) values (${gId}, 'Gestor de pruebas', ${gestorEmail})`;
  await sql`update public.jugadores set email = ${jugadorEmail}, ficha_mda = true, ficha_mdl = false where person_id = 'esteban-jon'`;
  const codigoDe = async (email) => (await sql`select codigo from public._otp_pruebas where email = ${email}`)[0]?.codigo;

  console.log('\n== Compilacion');
  const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey, NEXT_TELEMETRY_DISABLED: '1' };
  app = await arrancarApp({ puerto: PUERTO, env });
  ok(true, 'next build');

  // =================== WEB PUBLICA (/liga, que sustituye a la pestana de GitHub Pages)
  for (const [etiqueta, ancho, alto, movil] of [['375', 375, 800, true], ['escritorio', 1280, 900, false]]) {
    console.log(`
== Web publica /liga, ${etiqueta}`);
    const ctx = await nav.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: movil ? 2 : 1, isMobile: movil, hasTouch: movil, locale: 'es-ES' });
    const p = await ctx.newPage();
    const errores = [];
    p.on('pageerror', (e) => errores.push(String(e)));
    await p.goto(`${APP}/liga?hoy=2026-10-06`);
    await p.locator('.e-eqp[data-eq]').first().waitFor({ timeout: 15000 });
    const mda = p.locator('.e-eqp[data-eq="MDA"]'), mdl = p.locator('.e-eqp[data-eq="MDL"]');
    ok((await p.locator('.e-eqp[data-eq]').count()) === 2, 'tarjeta "Proximos partidos": uno de MdA y otro de MdL');
    ok((await mda.textContent()).includes('Litros de Mahou') && (await mda.textContent()).includes('18 de octubre'), 'MdA: Litros de Mahou, 18 de octubre');
    ok((await mda.locator('.eq-aviso').getAttribute('data-tipo')) === 'cambian_ellos' && (await mda.locator('.eq-etq').textContent()).includes('Coinciden colores: cambia Litros de Mahou'), 'MdA-Litros de Mahou (local): CAMBIAN ELLOS, etiqueta informativa');
    ok((await mda.textContent()).includes('Jugamos de negro; Litros de Mahou (camiseta negra) va en segundo lugar y debe cambiar. Llevad la amarilla por si acaso.'), 'MdA: texto de "cambian ellos"');
    ok((await mda.textContent()).includes('camiseta negra'), 'MdA: se ve el color del rival');
    ok(!/camiseta (negro|blanco|amarillo|rojo)/.test(await p.locator('main').innerText()), '/liga: ningún «camiseta negro» (Próximos partidos)');
    ok((await mdl.textContent()).includes('Quinto Tiempo') && (await mdl.locator('.eq-aviso').count()) === 0, 'MdL-Quinto Tiempo: sin aviso');
    ok((await mdl.textContent()).includes('camiseta naranja'), 'MdL: color del rival visible aunque no haya aviso');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), '/liga: sin desbordamiento horizontal');
    await p.screenshot({ path: path.join(SALIDA, `real_e_aviso_publico_cambian_ellos_${etiqueta}.png`) });
    // NOS TOCA: el 20/11 el proximo de MdL es la J6 en 28500 (negro), vamos de visitantes = segundos en el calendario
    await p.goto(`${APP}/liga?hoy=2026-11-20`);
    const nos = p.locator('.e-eqp[data-eq="MDL"]');
    await nos.waitFor({ timeout: 15000 });
    // D129: sin «en / vs» ni «casa/fuera»: el cartel tal cual sale en el calendario oficial (28500 figura primero).
    ok((await nos.locator('.e-eqp-v').textContent()) === '28500 – MdL' && !/en casa|fuera/.test(await nos.textContent()), 'el 20/11 MdL juega contra 28500 (J6): «28500 – MdL», sin «casa/fuera»');
    ok((await nos.locator('.eq-aviso').getAttribute('data-tipo')) === 'nos_toca' && (await nos.locator('.eq-etq').textContent()).includes('Nos toca cambiar: equipación AMARILLA'), 'MdL en 28500: NOS TOCA CAMBIAR');
    ok((await nos.textContent()).includes('Vamos en segundo lugar contra 28500 (camiseta negra). Obligatorio: si no cambiamos, partido perdido (Bases 47 JDM, 5.11).'), 'MdL en 28500: texto con la cita de las Bases');
    await p.screenshot({ path: path.join(SALIDA, `real_e_aviso_publico_nos_toca_${etiqueta}.png`) });
    // pasada la J2 el 20/10: J3 sin avisos
    await p.goto(`${APP}/liga?hoy=2026-10-20`);
    await p.locator('.e-eqp[data-eq]').first().waitFor({ timeout: 15000 });
    const t = await p.locator('.e-proximos').textContent();
    ok((await p.locator('.e-proximos .eq-aviso').count()) === 0 && t.includes('Los Khinkis Rusos') && t.includes('Suanzes Motor'), 'el 20/10 (J3: Khinkis y Suanzes): ningun aviso');
    ok(errores.length === 0, '/liga: sin errores de JavaScript', errores.join(' | '));
    await ctx.close();
  }

  async function entrar(p, email) {
    await p.goto(`${APP}/entrar`);
    await p.getByLabel('Tu correo').fill(email);
    await p.getByRole('button', { name: 'Enviarme el código' }).click();
    await p.getByText('Código enviado a').waitFor({ timeout: 10000 });
    await p.getByLabel('Código del correo').fill((await codigoDe(email)) ?? '000000');
    await p.getByRole('button', { name: 'Entrar', exact: true }).click();
    await p.waitForURL((u) => !u.pathname.startsWith('/entrar') || u.pathname.startsWith('/entrar/elegir'), { timeout: 15000 });
  }

  const eti = (a) => a?.hay ? a.etiqueta : null;
  for (const [etiqueta, ancho, alto, movil] of [['375', 375, 800, true], ['escritorio', 1280, 900, false]]) {
    console.log(`\n== Plataforma, ${etiqueta}`);
    const nuevo = () => nav.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: movil ? 2 : 1, isMobile: movil, hasTouch: movil, locale: 'es-ES' });
    const sinDesbordar = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

    // ---- Mi zona (jugador de MdA)
    await sql`update public.jugadores set ficha_mda = true, ficha_mdl = false where person_id = 'esteban-jon'`;
    const cj = await nuevo();
    const pj = await cj.newPage();
    const errJ = [];
    pj.on('pageerror', (e) => errJ.push(String(e)));
    await entrar(pj, jugadorEmail);
    // Desde D117, «Tu próximo partido» del inicio personal («/»; /mi-zona redirige ahi).
    await pj.goto(`${APP}/mi-zona`);
    const zona = pj.getByTestId('proximo-partido');
    const aMdA = proxReal('MDA'), aMdL = proxReal('MDL'), iMdA = proxInicio('MDA'), iMdL = proxInicio('MDL');
    ok((await zona.locator('.in-partido-uno').count()) === 1, 'Mi zona: solo el proximo partido de SU equipo (ficha MdA)');
    ok((await zona.textContent()).includes(bonito(iMdA.rival)) && !(await zona.textContent()).includes(bonito(iMdL.rival)), `Mi zona: el MdA contra ${bonito(iMdA.rival)} y no el de MdL`);
    ok((await zona.locator('.eq-aviso').count()) === (eti(avisoInicio('MDA')) ? 1 : 0), 'Mi zona: aviso si y solo si el proximo rival de MdA choca', String(await zona.locator('.eq-aviso').count()));
    if (eti(avisoInicio('MDA'))) ok((await zona.locator('.eq-aviso').textContent()).includes('Coinciden colores: cambia') && (await zona.locator('.eq-aviso').getAttribute('data-tipo')) === 'cambian_ellos', 'Mi zona: aviso informativo "cambian ellos" (somos locales)');
    ok((await zona.locator('[data-testid="color-rival-inicio"]').first().textContent()).includes('camiseta'), 'Mi zona: color del rival visible (aparte de «Te pones»)');
    ok(!/camiseta (negro|blanco|amarillo|rojo)/.test(await pj.locator('main').innerText()) && !/\((negro|blanco|amarillo|rojo)\)/.test(await pj.locator('main').innerText()), 'Mi zona: ningún «camiseta negro» ni color suelto sin concordar');
    ok(await sinDesbordar(pj), 'Mi zona: sin desbordamiento horizontal');
    await zona.scrollIntoViewIfNeeded();
    await pj.screenshot({ path: path.join(SALIDA, `real_e_aviso_mizona_${etiqueta}.png`), fullPage: true });
    // jugador de MdL: su partido, sin el de MdA
    await sql`update public.jugadores set ficha_mda = false, ficha_mdl = true where person_id = 'esteban-jon'`;
    await pj.goto(`${APP}/mi-zona`);
    ok((await zona.locator('.in-partido-uno').count()) === 1 && (await zona.textContent()).includes(bonito(iMdL.rival)), 'Mi zona (ficha MdL): solo el proximo partido de MdL');
    await sql`update public.jugadores set ficha_mda = true, ficha_mdl = true where person_id = 'esteban-jon'`;
    await pj.goto(`${APP}/mi-zona`);
    ok((await zona.locator('.in-partido-uno').count()) === (aMdA.fecha === aMdL.fecha ? 2 : 1), 'Mi zona (dobla): los partidos de su proximo domingo');
    ok(errJ.length === 0, 'Mi zona: sin errores de JavaScript', errJ.join(' | '));
    await cj.close();

    // ---- Gestion
    const cg = await nuevo();
    const pg = await cg.newPage();
    const errG = [];
    pg.on('pageerror', (e) => errG.push(String(e)));
    await entrar(pg, gestorEmail);
    if (pg.url().includes('/elegir')) await pg.goto(`${APP}/gestion`);
    await pg.goto(`${APP}/gestion`);
    const prox = pg.locator('[aria-labelledby="t-prox"]');
    // El inicio de gestion enseña solo el proximo domingo con partido: si un equipo descansa (MdA en la J4), sale uno.
    const domingo = [proxReal('MDA'), proxReal('MDL')].filter(Boolean).map((x) => x.fecha).sort()[0];
    const juegan = ['MDA', 'MDL'].filter((e) => proxReal(e)?.fecha === domingo);
    ok((await prox.locator('.eq-partido').count()) === juegan.length, `Inicio de gestion: los partidos del proximo domingo (${juegan.join(' y ')})`);
    const nAvisos = juegan.map(avisoReal).filter((a) => a?.hay).length;
    ok((await prox.locator('.eq-aviso').count()) === nAvisos, `Inicio de gestion: ${nAvisos} aviso(s), los de los rivales que chocan`, String(await prox.locator('.eq-aviso').count()));
    ok(await sinDesbordar(pg), 'Inicio de gestion: sin desbordamiento horizontal');
    await pg.screenshot({ path: path.join(SALIDA, `real_e_aviso_gestion_${etiqueta}.png`), fullPage: true });
    // Tarjetas por debajo de 640 px, tabla en escritorio (deuda-octubre).
    const fila = prox.locator('.gs-tabla tr.eq-partido').first();
    ok((await fila.evaluate((el) => getComputedStyle(el).display)) === (movil ? 'grid' : 'table-row'), `Partidos del domingo: ${movil ? 'tarjetas' : 'tabla'} a ${etiqueta}`);
    if (movil) ok((await prox.locator('.gs-tabla tr.eq-partido').first().evaluate((el) => el.getBoundingClientRect().width <= 375 - 24)), 'Partidos del domingo: la tarjeta cabe en 375 px');
    fs.mkdirSync(DEUDA, { recursive: true });
    await prox.screenshot({ path: path.join(DEUDA, `panel_partidos_domingo_${etiqueta}.png`) });

    await pg.goto(`${APP}/gestion/scouting`);
    const bloque = pg.locator('.lg-prox');
    ok((await bloque.textContent()).includes('Próximo partido contra nosotros') && (await pg.textContent('h2')).includes(A.equipoPorNombre(equip, aMdA.rival).nombre), 'Scouting: por defecto, el proximo rival de MdA con su tarjeta de proximo partido');
    ok((await pg.locator('[data-testid="color-equipo"]').textContent()).includes('camiseta'), 'Scouting: se ve el color del rival (camiseta y pantalon)');
    ok((await bloque.locator('.eq-aviso').count()) === (eti(avisoReal('MDA')) ? 1 : 0), 'Scouting (MdA): el aviso sale en la tarjeta del proximo partido si choca');
    await pg.screenshot({ path: path.join(SALIDA, `real_e_aviso_gestion_scouting_cambian_ellos_${etiqueta}.png`), fullPage: true });
    await pg.getByRole('link', { name: /^MdL:/ }).click();
    await pg.waitForURL(/v=mdl/);
    ok((await pg.locator('.lg-prox .eq-aviso').count()) === (eti(avisoReal('MDL')) ? 1 : 0), 'Scouting (MdL): el aviso sale solo si choca');
    // NOS TOCA en Scouting: el proximo partido contra Chavalitros es la J10 (17/01), en su campo
    await pg.selectOption('select[name="e"]', 'Chavalitros');
    await pg.getByRole('button', { name: 'Ver' }).click();
    await pg.waitForURL(/e=Chavalitros/);
    const cajaNos = pg.locator('.lg-prox .eq-nos_toca');
    ok((await cajaNos.count()) === 1 && (await cajaNos.textContent()).includes('⚠ Nos toca cambiar: equipación AMARILLA') && (await cajaNos.textContent()).includes('partido perdido (Bases 47 JDM, 5.11)'), 'Scouting (Chavalitros, J10 fuera): NOS TOCA CAMBIAR con la advertencia de partido perdido');
    ok((await cajaNos.evaluate((e) => getComputedStyle(e).backgroundColor)) === 'rgb(255, 212, 0)', 'Scouting: el aviso "nos toca" es amarillo intenso');
    await pg.screenshot({ path: path.join(SALIDA, `real_e_aviso_gestion_scouting_nos_toca_${etiqueta}.png`), fullPage: true });
    await pg.selectOption('select[name="e"]', 'Craps');
    await pg.getByRole('button', { name: 'Ver' }).click();
    await pg.waitForURL(/e=Craps/);
    ok((await pg.locator('[data-testid="color-equipo"]').textContent()).includes('camiseta negra'), 'Scouting: ficha de Craps con su color (negro)');
    await pg.selectOption('select[name="e"]', 'MdA');
    await pg.getByRole('button', { name: 'Ver' }).click();
    await pg.waitForURL(/e=MdA/);
    ok((await pg.locator('[data-testid="color-equipo"]').textContent()).includes('camiseta negra'), 'Scouting: nuestro equipo con su 1.ª equipacion (negra)');
    ok(await sinDesbordar(pg), 'Scouting: sin desbordamiento horizontal');
    ok(errG.length === 0, 'Gestion: sin errores de JavaScript', errG.join(' | '));
    await cg.close();
  }
} finally {
  if (nav) await nav.close();
  app?.parar();
  await pila.parar();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
