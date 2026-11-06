#!/usr/bin/env node
// Liga y Club de la estructura nueva (bloque 6 de docs/ESTRUCTURA_NUEVA.md), de extremo a extremo: pila local, la web
// compilada de verdad y Chrome a 360 y 390 px (y escritorio para las pestañas).
//   - pestañas de la Liga (Clasificación · Rivales · Jugadores de la liga · Temporadas; la tercera, solo con sesión, D162)
//     y del Club (Plantilla · Historia · El club), en una sola fila y con la suya marcada;
//   - /plantilla y /historia redirigen con 308 a /club y /club/historia, también con su consulta (?t=, ?persona=), y las
//     páginas nuevas siguen estáticas (D175) y sus gemelas dinámicas;
//   - el primer dato se ve sin desplazar a 390 × 844 en Liga y en Temporadas, sin nada encima que lo tape;
//   - en las tablas anchas, la primera columna (o «#» + nombre) sigue a la vista tras desplazar del todo a la derecha;
//   - ningún «(D» seguido de número en el HTML de estas páginas; objetivos táctiles de al menos 44 px;
//   - Club › Plantilla a 4 columnas con «Más columnas», con los mismos números que Liga › Temporadas › Jugadores;
//     Historia con 2 cifras y «Filtros» plegados; El club con las dos instalaciones sin mezclar (D88);
//   - sin desbordamiento horizontal ni errores de JS.
// Capturas a 390 px (solo fuera de las tandas y de Actions): privado/mockups_liga/rediseno/estructura_nueva/.
//
//   npm run pruebas:liga-club
import fs from 'node:fs';
import path from 'node:path';
import { preparar, personas, sinteticos, contador, visto, pequenos, sinDesbordar, REPO, RAIZ } from './comun_e2e.mjs';
import { conCapturas } from './infra/app.mjs';
import { cargarLiga } from '../scripts/cargar_liga.mjs';
import { ligaParaPruebas } from './infra/liga.mjs';

const { ok, fallos } = contador();
const SALIDA = path.join(REPO, 'privado', 'mockups_liga', 'rediseno', 'estructura_nueva');
if (conCapturas()) fs.mkdirSync(SALIDA, { recursive: true });
const foto = (p, n) => (conCapturas() ? p.screenshot({ path: path.join(SALIDA, `${n}.png`), fullPage: true }).catch(() => {}) : Promise.resolve());

const e = await preparar();
const { sql, APP } = e;
try {
  await cargarLiga(sql, ligaParaPruebas('2026-27'), '2026-27', { log: () => {} });
  // En Actions no hay hojas (datos por jugador de terceros, fuera de git): sin ellas el Scouting no tiene tabla que
  // desplazar. Se cargan partidos con jugadores SINTETICOS a partir de los resultados publicados (solo marcadores).
  if (!(await sql`select count(*)::int n from public.liga_estadisticas_jugador`)[0].n) {
    const pub = JSON.parse(fs.readFileSync(path.join(RAIZ, 'src', 'data', 'liga.json'), 'utf8'));
    for (const g of ['G1', 'G2']) {
      for (const r of pub.grupos[g].resultados.filter((x) => x.pl != null && x.pv != null)) {
        const [pt] = await sql`insert into public.liga_partidos (temporada, grupo, jornada, fecha, local, visitante, pts_local, pts_visitante, nuestro)
          values ('2026-27', ${g}, ${r.jornada}, ${r.fecha}, ${r.local}, ${r.visitante}, ${r.pl}, ${r.pv}, ${['MdA', 'MdL'].includes(r.local) || ['MdA', 'MdL'].includes(r.visitante)})
          on conflict do nothing returning id`;
        if (!pt) continue;
        for (const [eq, pts] of [[r.local, r.pl], [r.visitante, r.pv]]) {
          for (let i = 0; i < 6; i++) {
            const p = Math.floor(pts / 6) + (i < pts % 6 ? 1 : 0);
            await sql`insert into public.liga_estadisticas_jugador (partido_id, equipo, dorsal, nombre, segundos, pts, p2a, p3a, tla, tli, faltas)
              values (${pt.id}, ${eq}, ${String(i + 4)}, ${`SINT, JUGADOR ${i + 1}`}, 1200, ${p}, ${Math.floor(p / 2)}, 0, ${p % 2}, ${p % 2}, 1)`;
          }
        }
      }
    }
  }
  await sinteticos(sql, [['sint-liga', 'Ligera', true, true]]);
  const CORREO = 'ligera@pruebas.local';
  await personas(e.pila, { jugadores: [['sint-liga', CORREO]] });
  const liga = JSON.parse(fs.readFileSync(path.join(RAIZ, 'src', 'data', 'liga.json'), 'utf8'));
  const partidoG1 = liga.grupos.G1.resultados[0].id;
  const T = '2025-26';
  const cc = (x) => x.headers.get('cache-control') ?? '';

  console.log('\n== Redirecciones 308 de las rutas viejas (con su consulta)');
  for (const [vieja, nueva] of [['/plantilla', '/club'], ['/plantilla?t=2025-26', '/club?t=2025-26'], ['/historia', '/club/historia'], ['/historia?persona=eric', '/club/historia?persona=eric'], ['/plantilla/con-parametros', '/club'], ['/historia/con-parametros', '/club/historia']]) {
    const x = await fetch(`${APP}${vieja}`, { redirect: 'manual' });
    const destino = x.headers.get('location') ?? '';
    ok(x.status === 308 && new URL(destino, APP).pathname + new URL(destino, APP).search === nueva, `${vieja} → 308 ${nueva}`, `${x.status} ${destino}`);
  }
  // Liga › Temporadas › Jugadores es otra vez su pestaña (antes llevaba a /plantilla?t=).
  let x = await fetch(`${APP}/liga/${T}/jugadores`, { redirect: 'manual' });
  ok(x.status === 200, `/liga/${T}/jugadores: su propia pestaña (200, sin redirigir)`, String(x.status));

  console.log('\n== Estáticas (D175) y gemelas dinámicas');
  for (const r of ['/club', '/club/historia', '/club/el-club', '/liga']) {
    x = await fetch(`${APP}${r}`);
    await x.text();
    ok(x.status === 200 && /s-maxage/.test(cc(x)), `${r}: 200 y servida desde la caché`, `${x.status} ${cc(x)}`);
  }
  for (const [r, texto] of [['/club?t=2025-26', '· temporada 2025'], ['/club/historia?persona=eric', 'historia-ficha']]) {
    x = await fetch(`${APP}${r}`);
    const t = await x.text();
    ok(x.status === 200 && t.includes(texto) && !/s-maxage/.test(cc(x)), `${r}: la gemela dinámica (sin caché) con lo pedido`, `${x.status} ${cc(x)}`);
  }

  // Sesion de jugador (para la pestaña «Jugadores de la liga», el Scouting y sus páginas).
  const ctxS = await e.contexto(390, 844);
  const ps = await e.nuevaPagina(ctxS);
  await e.entrar(ps, CORREO);
  const cookie = (await ctxS.cookies()).map((c) => `${c.name}=${c.value}`).join('; ');

  console.log('\n== Ningún «(D» seguido de número en el HTML');
  const PUBLICAS = ['/liga', '/liga?g=G2', '/liga/rivales', `/liga/${T}/equipo`, `/liga/${T}/jugadores`, `/liga/${T}/rankings`, `/liga/${T}/cuartos`, `/liga/${T}/asistencia`, '/liga/2023-24/mda', `/liga/2026-27/partido/${partidoG1}`, '/club', '/club?t=2013-14', '/club/historia', '/club/el-club'];
  const CON_SESION = ['/liga/scouting', '/liga/consolidada', '/liga/consolidada?vista=resultados', `/liga/2026-27/partido/${partidoG1}`];
  for (const [r, conCookie] of [...PUBLICAS.map((r) => [r, false]), ...CON_SESION.map((r) => [r, true])]) {
    x = await fetch(`${APP}${r}`, conCookie ? { headers: { cookie } } : {});
    const t = await x.text();
    const m = t.match(/\(D\d+/);
    ok(x.status === 200 && !m, `${r}${conCookie ? ' (con sesión)' : ''}: sin códigos «(Dnn)»`, m ? `${x.status} «${t.slice(Math.max(0, m.index - 50), m.index + 20)}»` : String(x.status));
  }

  /** Comprobaciones de una página en un tamaño. */
  const fila = (p, sel, todasALaVista = true) => p.evaluate(([s, v]) => { const ls = [...document.querySelectorAll(s)]; return ls.length > 0 && ls.every((a) => Math.abs(a.getBoundingClientRect().top - ls[0].getBoundingClientRect().top) < 2 && (!v || (a.getBoundingClientRect().left >= 0 && a.getBoundingClientRect().right <= window.innerWidth + 1))); }, [sel, todasALaVista]);
  const marcada = (p, sel) => p.evaluate((s) => [...document.querySelectorAll(`${s} a[aria-current="page"]`)].map((a) => a.textContent.trim()), sel);
  /** El elemento se ve entero sin desplazar y lo que hay en su centro es él (nada fijo encima: cabecera ni barra). */
  const aLaVista = (p, sel) => p.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return 'no está';
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) return `fuera (${Math.round(r.top)}–${Math.round(r.bottom)} de ${window.innerHeight})`;
    const encima = document.elementFromPoint(r.left + Math.min(20, r.width / 2), r.top + r.height / 2);
    return encima && el.contains(encima) ? true : `tapado por ${encima?.tagName}.${encima?.className}`;
  }, sel);
  /** Tras desplazar la caja de la tabla del todo a la derecha, la celda fija sigue a la vista (no se ha ido con el resto). */
  const columnaFija = (p, tabla, n = 1) => p.evaluate(([s, k]) => {
    const t = document.querySelector(s);
    if (!t) return 'no está';
    let caja = t.parentElement;
    while (caja && caja !== document.body && getComputedStyle(caja).overflowX === 'visible') caja = caja.parentElement;
    if (!caja || caja.scrollWidth <= caja.clientWidth + 1) return 'sin desplazamiento';
    caja.scrollLeft = caja.scrollWidth;
    const celda = t.querySelector(`tbody tr:not([class*="sep"]) > :nth-child(${k})`);
    const c = caja.getBoundingClientRect(), r = celda.getBoundingClientRect();
    const fija = getComputedStyle(celda).position === 'sticky' && r.left >= c.left - 1 && r.left < c.left + 60;
    caja.scrollLeft = 0;
    return fija ? true : `se va (${Math.round(r.left)} frente a ${Math.round(c.left)})`;
  }, [tabla, n]);

  for (const ancho of [360, 390]) {
    console.log(`\n== Sin sesión, ${ancho} px`);
    const ctx = await e.contexto(ancho, 844);
    const p = await e.nuevaPagina(ctx);
    await p.setViewportSize({ width: ancho, height: 844 });
    const cap = ancho === 390;

    // ---- Liga
    await p.goto(`${APP}/liga`);
    ok(JSON.stringify(await p.locator('nav[aria-label="Liga"] a').allTextContents()) === JSON.stringify(['Clasificación', 'Rivales', 'Temporadas']), 'liga sin sesión: Clasificación · Rivales · Temporadas (Jugadores de la liga, solo con sesión)', (await p.locator('nav[aria-label="Liga"] a').allTextContents()).join(' · '));
    ok(await fila(p, 'nav[aria-label="Liga"] a'), 'liga: las pestañas en una sola fila');
    ok(JSON.stringify(await marcada(p, 'nav[aria-label="Liga"]')) === '["Clasificación"]', '/liga: «Clasificación» marcada');
    ok((await p.locator('.e-cab .w-eyebrow, .e-sub').count()) === 0 && (await p.locator('h1').innerText()).trim().split('\n').length === 1, 'liga: título de una línea, sin el bloque «Maccabis · desde 2013… Estadísticas Maccabis»');
    ok(!(await p.locator('main').innerText()).includes('JDM MOR DOM'), 'liga: sin la cadena «JDM MOR DOM MAÑ BC SEN MAS G1»');
    ok((await p.locator('[data-testid="liga-aviso"]').getAttribute('open')) === null && /Calculada con las hojas de la FBM · pendiente de contrastar con la oficial/.test(await p.locator('[data-testid="liga-aviso"] summary').innerText()), 'liga: el aviso de la clasificación, una línea plegada');
    if (ancho === 390) {
      const v = await aLaVista(p, '[data-testid="liga-clasificacion"] tbody tr');
      ok(v === true, 'liga 390×844: la primera fila de la clasificación se ve sin desplazar', String(v));
    }
    ok((await p.locator('[data-testid="liga-clasificacion"] tbody tr.e-nos').count()) === 1, 'liga: nuestra fila resaltada');
    const orden = await p.evaluate(() => { const y = (s) => document.querySelector(s)?.getBoundingClientRect().top ?? -1; return [y('[data-testid="liga-clasificacion"]'), y('[data-testid="liga-resultados"]'), y('[data-testid="liga-proximos"]')]; });
    ok(orden[0] < orden[1] && orden[1] < orden[2], 'liga: clasificación, debajo resultados por jornada y después próximos', orden.join(' < '));
    const fechas = await p.locator('[data-testid="liga-proximos"] .e-eqp-s').allTextContents();
    ok(fechas.length === 2, 'liga: próximos de MdA y MdL');
    // La fila entera es pulsable: un clic en la celda de los puntos abre la ficha del equipo.
    const href = await p.locator('[data-testid="liga-clasificacion"] tbody tr').nth(1).locator('a').first().getAttribute('href');
    await p.locator('[data-testid="liga-clasificacion"] tbody tr').nth(1).locator('td.e-pts').click();
    await p.waitForURL((u) => u.pathname + u.search === href, { timeout: 10000 }).catch(() => {});
    ok(new URL(p.url()).pathname + new URL(p.url()).search === href, 'liga: la fila entera de la clasificación abre la ficha del equipo', `${p.url()} / ${href}`);
    await p.goto(`${APP}/liga`);
    ok(await sinDesbordar(p), 'liga: sin desbordamiento horizontal');
    const peq = await pequenos(p, 'nav[aria-label="Liga"] a, [data-testid="liga-aviso"] summary, .e-segmento button, .e-jornadas button');
    ok(peq.length === 0, 'liga: pestañas, aviso, grupos y jornadas de al menos 44 px', JSON.stringify(peq.slice(0, 4)));
    if (cap) await foto(p, 'liga-clasificacion');

    await p.goto(`${APP}/liga?g=G2`);
    ok(JSON.stringify(await marcada(p, 'nav[aria-label="Liga"]')) === '["Clasificación"]' && new URL(p.url()).pathname === '/liga', '/liga?g=G2 (gemela): sigue en /liga con «Clasificación» marcada');

    await p.goto(`${APP}/liga/2026-27/partido/${partidoG1}`);
    const cab = await p.evaluate(() => { const y = (s) => document.querySelector(s)?.getBoundingClientRect().top ?? -1; return [y('[data-testid="partido-marcador"]'), y('.e-pt-meta')]; });
    ok(cab[0] >= 0 && cab[0] < cab[1], 'partido: el marcador primero, la jornada y la pista debajo', cab.join(' < '));
    ok((await p.locator('[data-testid="volver"]').count()) === 1 && (await p.locator('[data-testid="volver"]').innerText()).startsWith('‹ Clasificación'), 'partido: un único «‹» a la clasificación');
    if (cap) await foto(p, 'liga-partido');

    await p.goto(`${APP}/liga/rivales`);
    ok(JSON.stringify(await marcada(p, 'nav[aria-label="Liga"]')) === '["Rivales"]', '/liga/rivales: «Rivales» marcada');
    ok((await p.locator('[data-testid="rival-scouting"], [data-testid="scouting-proximo"]').count()) === 0, 'rivales sin sesión: ni rastro del Scouting (D162)');
    if (cap) await foto(p, 'liga-rivales');

    // ---- Temporadas
    await p.goto(`${APP}/liga/${T}/equipo`);
    ok(JSON.stringify(await marcada(p, 'nav[aria-label="Liga"]')) === '["Temporadas"]', 'temporadas: «Temporadas» marcada');
    ok(JSON.stringify(await p.locator('nav[aria-label="Pestañas de la temporada"] a').allTextContents()) === JSON.stringify(['Equipo', 'Jugadores', 'Rankings', 'Por cuartos', 'Asistencia']), 'temporadas: Equipo · Jugadores · Rankings · Por cuartos · Asistencia', (await p.locator('nav[aria-label="Pestañas de la temporada"] a').allTextContents()).join(' · '));
    ok(await fila(p, 'nav[aria-label="Pestañas de la temporada"] a', false), 'temporadas: las subpestañas en una fila (se desplazan en ella si no caben)');
    const juntos = await p.evaluate(() => { const s = document.querySelector('#e-sel-temporada'), q = document.querySelector('.e-segmento[aria-label="Equipo"]'); if (!s || !q) return false; return s.closest('.e-controles') === q.closest('.e-controles') && Math.abs(s.getBoundingClientRect().top - q.getBoundingClientRect().top) < 40; });
    ok(juntos, 'temporadas: temporada y equipo en la misma fila de controles');
    if (ancho === 390) {
      const v = await aLaVista(p, '[data-testid="equipo-kpis"] .e-kpi');
      ok(v === true, 'temporadas 390×844: la primera cifra (Balance) se ve sin desplazar', String(v));
    }
    let f = await columnaFija(p, '[data-testid="equipo-partidos"]');
    ok(f === true, 'temporadas › equipo: la primera columna fija al desplazar', String(f));
    const opciones = await p.locator('#e-sel-temporada option').allTextContents();
    ok(opciones.at(-1)?.includes('2013') || opciones[0]?.includes('2013'), 'temporadas: desde 2013/14', opciones.join(','));
    ok(await sinDesbordar(p), 'temporadas: sin desbordamiento horizontal');
    const peqT = await pequenos(p, 'nav[aria-label="Pestañas de la temporada"] a, #e-sel-temporada');
    ok(peqT.length === 0, 'temporadas: subpestañas y selector de al menos 44 px', JSON.stringify(peqT.slice(0, 4)));
    if (cap) await foto(p, 'liga-temporadas-equipo');
    await p.goto(`${APP}/liga/${T}/jugadores`);
    ok(JSON.stringify(await marcada(p, 'nav[aria-label="Pestañas de la temporada"]')) === '["Jugadores"]', 'temporadas › jugadores: su pestaña marcada');
    f = await columnaFija(p, '[data-testid="jugadores-tabla"]', 2);
    ok(f === true, 'temporadas › jugadores: «#» y el nombre fijos al desplazar', String(f));
    const completa = await p.$$eval('[data-testid="jugadores-tabla"] tbody tr', (trs) => trs.map((tr) => [...tr.children].map((c) => c.textContent.trim())));
    const cabCompleta = await p.$$eval('[data-testid="jugadores-tabla"] thead th', (ths) => ths.map((t) => t.textContent.trim()));
    const [iNom, iPJ] = [cabCompleta.indexOf('Jugador'), cabCompleta.indexOf('PJ')];
    if (cap) await foto(p, 'liga-temporadas-jugadores');

    // ---- Club
    await p.goto(`${APP}/club?t=${T}`);
    ok(JSON.stringify(await p.locator('nav[aria-label="Club"] a').allTextContents()) === JSON.stringify(['Plantilla', 'Historia', 'El club']) && JSON.stringify(await marcada(p, 'nav[aria-label="Club"]')) === '["Plantilla"]', 'club: Plantilla · Historia · El club, con Plantilla marcada (también en la gemela ?t=)');
    ok(await fila(p, 'nav[aria-label="Club"] a'), 'club: las pestañas en una sola fila');
    const cabs = await p.$$eval('[data-testid="jugadores-tabla"] thead th', (ths) => ths.map((t) => t.textContent.trim()));
    ok(JSON.stringify(cabs) === JSON.stringify(['Jugador', 'PJ', 'Pts', 'Med']), 'plantilla: ranking a 4 columnas (Jugador, PJ, Pts, Med)', cabs.join(','));
    // Los mismos números que Temporadas › Jugadores (nombre, PJ, Pts y Med de cada fila, en el mismo orden).
    const compacta = await p.$$eval('[data-testid="jugadores-tabla"] tbody tr', (trs) => trs.map((tr) => [...tr.children].map((c) => c.textContent.trim())));
    const iguales = compacta.length > 0 && compacta.length === completa.length && compacta.every((r, i) => r[0].replace(/^\d+/, '') === completa[i][iNom] && r.slice(1).join('|') === completa[i].slice(iPJ, iPJ + 3).join('|'));
    ok(iguales, `plantilla: los ${compacta.length} jugadores con los mismos números que Liga › Temporadas › Jugadores`);
    await p.getByTestId('mas-columnas').click();
    ok((await p.locator('[data-testid="jugadores-tabla"] thead th').count()) > 4 && (await p.getByTestId('mas-columnas').innerText()) === 'Menos columnas', 'plantilla: «Más columnas» enseña el resto');
    f = await columnaFija(p, '[data-testid="jugadores-tabla"]', 2);
    ok(f === true, 'plantilla con todas las columnas: «#» y el nombre fijos al desplazar', String(f));
    const peqC = await pequenos(p, 'nav[aria-label="Club"] a, [data-testid="mas-columnas"]');
    ok(peqC.length === 0, 'club: pestañas y «Más columnas» de al menos 44 px', JSON.stringify(peqC.slice(0, 4)));
    await p.getByTestId('mas-columnas').click();
    await p.goto(`${APP}/club`);
    ok(await sinDesbordar(p), 'plantilla: sin desbordamiento horizontal');
    if (cap) await foto(p, 'club-plantilla');

    await p.goto(`${APP}/club/historia`);
    ok(JSON.stringify(await marcada(p, 'nav[aria-label="Club"]')) === '["Historia"]', 'club › historia: «Historia» marcada');
    ok((await p.locator('[data-testid="historia-kpis"] .e-kpi').count()) === 2, 'historia: 2 cifras');
    ok(await p.getByLabel('Buscar persona').isVisible() && (await p.getByTestId('historia-filtros').getAttribute('open')) === null && !(await p.locator('.e-segmento[aria-label="Orden"]').isVisible()), 'historia: buscador a la vista y «Filtros» plegados');
    const nombreFijo = await p.evaluate(() => {
      const caja = document.querySelector('.e-hgrid-wrap'); caja.scrollLeft = caja.scrollWidth;
      const c = caja.getBoundingClientRect(), r = document.querySelector('.e-hgrid tbody tr[data-pid] td.e-hname').getBoundingClientRect();
      caja.scrollLeft = 0; return caja.scrollWidth > caja.clientWidth && r.left >= c.left - 1 && r.left < c.left + 30;
    });
    ok(nombreFijo, 'historia: la rejilla con los nombres fijos al desplazar');
    await p.getByLabel('Buscar persona').fill('esteban');
    ok((await p.locator('.e-hgrid tbody tr[data-pid]').count()) >= 1, 'historia: el buscador filtra');
    ok(await sinDesbordar(p), 'historia: sin desbordamiento horizontal');
    const peqH = await pequenos(p, '[data-testid="historia-filtros"] summary, nav[aria-label="Club"] a');
    ok(peqH.length === 0, 'historia: «Filtros» de al menos 44 px', JSON.stringify(peqH));
    if (cap) await foto(p, 'club-historia');

    await p.goto(`${APP}/club/el-club`);
    ok(JSON.stringify(await marcada(p, 'nav[aria-label="Club"]')) === '["El club"]', 'club › el club: «El club» marcada');
    const entrenos = await p.getByTestId('club-entrenos').innerText(), partidos = await p.getByTestId('club-partidos').innerText();
    ok(entrenos.includes('Valdebernardo (Faustina Valladolid)') && !entrenos.includes('Calle de Valdebernardo, 2') && partidos.includes('Centro Deportivo Municipal Moratalaz') && !partidos.includes('Faustina'), 'el club: las dos instalaciones, cada una en su sitio y sin mezclar (D88)');
    ok(await sinDesbordar(p), 'el club: sin desbordamiento horizontal');
    if (cap) await foto(p, 'club-el-club');
    await ctx.close();
  }

  console.log('\n== Con sesión de jugador, 390 px');
  const p = ps;
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto(`${APP}/liga`);
  await visto(p.locator('nav[aria-label="Liga"] a', { hasText: 'Jugadores de la liga' }), 8000);
  ok(JSON.stringify(await p.locator('nav[aria-label="Liga"] a').allTextContents()) === JSON.stringify(['Clasificación', 'Rivales', 'Jugadores de la liga', 'Temporadas']), 'liga con sesión: las 4 pestañas', (await p.locator('nav[aria-label="Liga"] a').allTextContents()).join(' · '));
  ok(await fila(p, 'nav[aria-label="Liga"] a'), 'liga con sesión: las 4 pestañas en una fila, todas a la vista');
  await p.goto(`${APP}/liga/rivales`);
  await visto(p.getByTestId('scouting-proximo'), 8000);
  ok((await p.getByTestId('rival-scouting').count()) > 0 && (await p.getByTestId('rival-scouting').first().getAttribute('href')).startsWith('/liga/scouting?e='), 'rivales con sesión: cada rival con su Scouting');
  await p.getByTestId('scouting-proximo').click();
  await p.waitForURL(/\/liga\/scouting$/);
  ok(JSON.stringify(await marcada(p, 'nav[aria-label="Liga"]')) === '["Rivales"]', 'scouting: dentro de «Rivales»');
  let f = await columnaFija(p, '[data-testid="tabla-scouting"]');
  ok(f === true, 'scouting: la primera columna fija al desplazar', String(f));
  await foto(p, 'liga-rivales-scouting');
  await p.goto(`${APP}/liga/consolidada`);
  ok(JSON.stringify(await marcada(p, 'nav[aria-label="Liga"]')) === '["Jugadores de la liga"]', 'consolidada: «Jugadores de la liga» marcada');
  const chips = await p.locator('[data-testid="chips-lideres"] button').allTextContents();
  ok(JSON.stringify(chips) === JSON.stringify(['Puntos', '2P', '3P', 'TL', 'TL%', 'Faltas', 'Minutos']), 'jugadores de la liga: chips Puntos, 2P, 3P, TL, TL%, Faltas, Minutos', chips.join(','));
  ok((await p.locator('#lideres .lg-lider').count()) === 1, 'jugadores de la liga: UNA lista');
  const peqL = await pequenos(p, '[data-testid="chips-lideres"] button, #lideres .lg-conmutador button, nav[aria-label="Liga"] a');
  ok(peqL.length === 0, 'jugadores de la liga: chips y conmutador de al menos 44 px', JSON.stringify(peqL.slice(0, 4)));
  ok(await sinDesbordar(p), 'jugadores de la liga: sin desbordamiento horizontal');
  await foto(p, 'liga-jugadores-de-la-liga');
  await p.goto(`${APP}/liga/consolidada?vista=resultados`);
  await foto(p, 'liga-jugadores-resultados');

  ok(e.errores.length === 0, 'sin errores de JS ni de consola', e.errores.slice(0, 3).join(' | '));
} finally {
  await e.parar();
}
console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK');
process.exit(fallos() ? 1 : 0);
