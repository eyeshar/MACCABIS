#!/usr/bin/env node
// Estructura nueva (D189), de extremo a extremo: pila local, web compilada y Chrome, con los cuatro tipos de usuario (sin
// sesion, jugador, gestor con ficha y gestor sin ficha):
//   - la barra de cada rol (jugador Semana · Calendario · Liga · Club; gestor + Gestión; sin sesion Inicio · Liga · Club ·
//     Acceso), la activa marcada (aria-current y raya), el titulo de la seccion en la cabecera y el avatar a «Yo»;
//   - a 360, 390 y 412 px y en escritorio: nada tapado por la barra (el final de la pagina queda por encima), objetivos de
//     al menos 44 px en la barra y en lo nuevo, sin desbordar, sin errores de consola;
//   - ningun «(D» seguido de numero en el HTML de las pantallas nuevas;
//   - las rutas viejas redirigen con 308 a su sitio nuevo (con la consulta);
//   - Semana (respuestas que faltan, «Gestión · N pendientes», tarjetas con la franja GESTIÓN solo para gestores), Calendario
//     (chips en la URL, «Días que no estoy»), Evento (vista de jugador sin motivos; pestañas solo para gestores) y Yo;
//   - un jugador no ve motivos, niveles ni las pestañas de gestor (barrera (h)).
//   - /gestion y /gestion/convocatoria, como gestor con ficha y sin ficha (390 px y escritorio): sin la barra de
//     subsecciones de Gestión ni la hoja «Más» de antes; solo la barra (o el menú) del rol.
//   - visibilidad en el móvil (fix/visibilidad-movil), a 360 px: Plantilla (Jugador, PJ, PTS, MED), la Clasificación (las 7) y
//     Temporadas › Equipo y Asistencia caben enteras sin desplazar; en Temporadas › Jugadores, jugador fijo y PJ, PTS y MED a la
//     vista; con sesión, G3-G6 en el selector de la Clasificación y sus casillas a la vista en Jugadores de la liga, sin tocar
//     nada (sin sesión, solo G1 y G2).
// Capturas a 390 px (solo en local) en privado/mockups_liga/rediseno/estructura_nueva/.
//
//   npm run pruebas:estructura
import fs from 'node:fs';
import path from 'node:path';
import { preparar, personas, contador, visto, sinDesbordar, REPO } from './comun_e2e.mjs';
import { conCapturas } from './infra/app.mjs';
import { hoyMadrid } from './fechas_prueba.mjs';
import { hasta } from './infra/esperas.mjs';

const { ok, fallos } = contador();
const DIR = path.join(REPO, 'privado', 'mockups_liga', 'rediseno', 'estructura_nueva');
const captura = async (p, nombre) => { if (!conCapturas()) return; fs.mkdirSync(DIR, { recursive: true }); await p.screenshot({ path: path.join(DIR, `${nombre}.png`), fullPage: true }).catch(() => {}); };
const sinCodigos = (html) => !/\(D\d{2,3}\b/.test(html.replace(/<script[\s\S]*?<\/script>/g, ''));

const e = await preparar();
const { sql, APP } = e;
try {
  const hoy = hoyMadrid();
  const P = await personas(e.pila, {
    jugadores: [['esteban-jon', 'jon@pruebas.local'], ['galan-domingo-guillermo', 'guille@pruebas.local']],
    gestores: [['Iván', 'ivan@pruebas.local', 'villaescusa-silva-ivan'], ['Carlos', 'carlos@pruebas.local', null]],
  });
  await sql`update public.jugadores set ficha_mda = true where person_id = 'villaescusa-silva-ivan'`;
  const [ent] = await sql`select id, fecha::text from public.eventos where tipo = 'entreno' and estado = 'programado' and fecha >= ${hoy} order by fecha limit 1`;
  const [par] = await sql`select id, fecha::text, equipo from public.eventos where tipo = 'liga' and estado = 'programado' and fecha >= ${hoy} and equipo = 'MdA' order by fecha limit 1`;
  // Guille no va al entreno, con un motivo que un jugador nunca debe ver.
  await sql`insert into public.respuestas (evento_id, person_id, respuesta, motivo, detalle, origen) values (${ent.id}, 'galan-domingo-guillermo', 'no', 'trabajo', 'MOTIVO-SECRETO', 'jugador')`;

  const ROLES = [
    { id: 'anonimo', email: null, barra: ['Inicio', 'Liga', 'Club', 'Acceso'] },
    { id: 'jugador', email: 'jon@pruebas.local', barra: ['Semana', 'Calendario', 'Liga', 'Club'] },
    { id: 'gestor', email: 'ivan@pruebas.local', barra: ['Semana', 'Calendario', 'Liga', 'Club', 'Gestión'] },
    { id: 'gestor-sin-ficha', email: 'carlos@pruebas.local', barra: ['Semana', 'Calendario', 'Liga', 'Club', 'Gestión'] },
  ];
  const textosBarra = (p) => p.locator('nav.nv-barra a').allTextContents();
  const tapado = (p) => p.evaluate(() => {
    const barra = document.querySelector('nav.nv-barra');
    if (!barra || getComputedStyle(barra).display === 'none') return false;
    window.scrollTo(0, document.documentElement.scrollHeight);
    const b = barra.getBoundingClientRect();
    const ultimos = [...document.querySelectorAll('#contenido *')].filter((x) => x.offsetParent && x.getBoundingClientRect().height > 0);
    const fin = Math.max(...ultimos.map((x) => x.getBoundingClientRect().bottom));
    return fin > b.top + 1;
  });
  const pequenosBarra = (p) => p.evaluate(() => [...document.querySelectorAll('nav.nv-barra a, .nv-cab a, .nv-cab button')].filter((x) => x.offsetParent).map((x) => x.getBoundingClientRect()).filter((r) => r.height < 44 || r.width < 44).length);

  for (const rol of ROLES) {
    for (const ancho of [360, 390, 412, 1280]) {
      const ctx = await e.contexto(ancho);
      const p = await e.nuevaPagina(ctx);
      if (rol.email) await e.entrar(p, rol.email);
      await p.goto(`${APP}/`);
      await hasta(async () => (await p.locator('html').getAttribute('data-sesion')) !== 'pendiente');
      const etiqueta = `${rol.id} a ${ancho} px`;
      if (ancho < 769) {
        const barra = (await textosBarra(p)).map((t) => t.trim());
        ok(JSON.stringify(barra) === JSON.stringify(rol.barra), `${etiqueta}: barra ${rol.barra.join(' · ')}`, barra.join(' · '));
        ok((await p.locator('nav.nv-barra a[aria-current="page"]').allTextContents()).map((t) => t.trim()).join() === rol.barra[0], `${etiqueta}: «${rol.barra[0]}» marcada en «/»`);
        ok((await p.getByTestId('titulo-seccion').textContent())?.trim() === rol.barra[0], `${etiqueta}: título de la sección en la cabecera`);
        ok(!(await tapado(p)), `${etiqueta}: el final de la página queda por encima de la barra`);
      } else {
        const menu = (await p.locator('nav.nv-menu a').allTextContents()).map((t) => t.trim());
        ok(JSON.stringify(menu) === JSON.stringify(rol.barra), `${etiqueta}: la misma estructura en la cabecera`, menu.join(' · '));
      }
      ok((await pequenosBarra(p)) === 0, `${etiqueta}: barra y cabecera con objetivos de 44 px`);
      ok(await sinDesbordar(p), `${etiqueta}: sin desbordar`);
      ok(rol.email ? await visto(p.getByTestId('avatar')) : (await p.getByTestId('avatar').count()) === 0, `${etiqueta}: ${rol.email ? 'avatar a «Yo»' : 'sin avatar'}`);
      ok((await p.locator('[data-testid="banda-gestion"]').count()) === (rol.id.startsWith('gestor') ? 1 : 0), `${etiqueta}: «Gestión · N pendientes» solo a los gestores`);
      if (ancho === 390) await captura(p, `barra-${rol.id}`);
      await ctx.close();
    }
  }

  console.log('\n== Redirecciones 308 de las rutas viejas');
  for (const [de, a] of [['/agenda', '/calendario'], ['/agenda?f=x', '/calendario?f=x'], [`/mi-zona/evento/${ent.id}`, `/evento/${ent.id}`], [`/gestion/eventos/${ent.id}/respuestas`, `/evento/${ent.id}`], ['/cuenta', '/yo'], ['/mis-numeros', '/yo'], ['/gestion/cuenta', '/yo']]) {
    const r = await fetch(`${APP}${de}`, { redirect: 'manual' });
    ok(r.status === 308 && (r.headers.get('location') ?? '').replace(APP, '') === a, `${de} → ${a} (308)`, `${r.status} ${r.headers.get('location')}`);
  }

  console.log('\n== Jugador: Semana, Calendario, Evento y Yo');
  const ctxJ = await e.contexto(390);
  const pj = await e.nuevaPagina(ctxJ);
  await e.entrar(pj, 'jon@pruebas.local');
  await pj.goto(`${APP}/`);
  ok(await visto(pj.getByRole('heading', { name: 'Esta semana' })), 'Semana: «Esta semana» y el rango');
  ok(await visto(pj.getByTestId('tarjeta-semana')), 'Semana: tarjetas de los próximos días');
  ok((await pj.getByTestId('franja-gestion').count()) === 0, 'Semana: un jugador no ve la franja GESTIÓN');
  const semanaHtml = await pj.content();
  ok(sinCodigos(semanaHtml) && !semanaHtml.includes('MOTIVO-SECRETO'), 'Semana: sin códigos «(Dnn)» ni motivos de nadie');
  await captura(pj, 'semana-jugador');
  await pj.goto(`${APP}/calendario`);
  ok(await visto(pj.getByTestId('tu-calendario')), 'Calendario: «Tenlo en el calendario de tu móvil»');
  ok(await visto(pj.getByTestId('dias-que-no-estoy')), 'Calendario: «Días que no estoy»');
  ok((await pj.locator('nav.nv-barra a[aria-current="page"]').textContent())?.trim() === 'Calendario', 'Calendario: marcado en la barra');
  await pj.getByRole('link', { name: 'Entrenos', exact: true }).click();
  await pj.waitForURL(/\/calendario\?f=entrenos/);
  ok((await pj.getByTestId('fila-agenda').count()) > 0 && (await pj.locator('[data-testid="fila-agenda"]:not([data-tipo="entreno"])').count()) === 0, 'Calendario: el chip «Entrenos» deja solo entrenos y va en la URL');
  ok(sinCodigos(await pj.content()), 'Calendario: sin códigos «(Dnn)»');
  await captura(pj, 'calendario-jugador');
  await pj.goto(`${APP}/evento/${ent.id}`);
  ok(await visto(pj.getByTestId('horas-evento')), 'Evento (jugador): quedada y hora en grande');
  ok((await pj.getByTestId('pestanas-evento').count()) === 0, 'Evento (jugador): sin pestañas de gestor');
  const evHtml = await pj.content();
  ok(!evHtml.includes('MOTIVO-SECRETO') && sinCodigos(evHtml), 'Evento (jugador): sin motivos de nadie ni códigos «(Dnn)»');
  ok(await visto(pj.getByTestId('volver')) && (await pj.getByTestId('volver').textContent()).includes('Calendario'), 'Evento: un único «‹ Calendario»');
  await captura(pj, 'evento-jugador');
  await pj.goto(`${APP}/evento/${ent.id}?tab=respuestas`);
  ok((await pj.getByTestId('tabla-respuestas').count()) === 0, 'Evento (jugador) con ?tab=respuestas: nada de gestor');
  await pj.goto(`${APP}/yo`);
  ok(await visto(pj.getByTestId('yo')) && await visto(pj.getByTestId('mi-cuenta')), 'Yo: nombre, lo tuyo y Mi cuenta');
  ok((await pj.locator('nav.nv-barra a[aria-current="page"]').count()) === 0 && (await pj.getByTestId('avatar').getAttribute('aria-current')) === 'page', 'Yo: marca el avatar, no la barra');
  await captura(pj, 'yo-jugador');
  await ctxJ.close();

  console.log('\n== Gestor con ficha: franja GESTIÓN y pestañas del evento');
  const ctxG = await e.contexto(390);
  const pg = await e.nuevaPagina(ctxG);
  await e.entrar(pg, 'ivan@pruebas.local');
  await pg.goto(`${APP}/`);
  ok(await visto(pg.getByTestId('franja-gestion')), 'Semana (gestor): franja GESTIÓN con los contadores');
  await captura(pg, 'semana-gestor');
  await pg.goto(`${APP}/evento/${ent.id}`);
  ok(await visto(pg.getByTestId('pestanas-evento')), 'Evento (gestor): pestañas');
  const pest = (await pg.getByTestId('pestanas-evento').locator('a').allTextContents()).map((t) => t.trim());
  ok(pest.join() === 'Respuestas,Grupos,Pase de lista,WhatsApp,Mi respuesta', `Evento (gestor, entreno): ${pest.join(' · ')}`);
  ok(await visto(pg.getByTestId('tabla-respuestas')) && (await pg.content()).includes('MOTIVO-SECRETO'), 'Evento (gestor): Respuestas por defecto, con los motivos');
  await captura(pg, 'evento-gestor-respuestas');
  await pg.getByRole('link', { name: 'WhatsApp' }).click();
  await pg.waitForURL(/tab=whatsapp/);
  ok(await visto(pg.getByTestId('pestana-whatsapp')) && await visto(pg.getByTestId('editar-evento')), 'Evento (gestor): WhatsApp con el mensaje y «Editar el evento»');
  await pg.goto(`${APP}/evento/${par.id}?tab=convocatoria`);
  ok(await visto(pg.getByTestId('pestana-convocatoria')), 'Evento (gestor, partido): pestaña Convocatoria');
  await ctxG.close();

  console.log('\n== Gestor sin ficha');
  const ctxC = await e.contexto(390);
  const pc = await e.nuevaPagina(ctxC);
  await e.entrar(pc, 'carlos@pruebas.local');
  await pc.goto(`${APP}/`);
  ok(await visto(pc.getByTestId('tarjeta-semana')) && (await pc.locator('[data-testid="tarjeta-semana"] .rs-botones, [data-testid="tarjeta-semana"] [data-testid="responder"]').count()) === 0, 'Semana (sin ficha): tarjetas sin botones de respuesta');
  ok(await visto(pc.getByTestId('franja-gestion')), 'Semana (sin ficha): la barra de respuestas en primer plano');
  await captura(pc, 'semana-gestor-sin-ficha');
  await pc.goto(`${APP}/calendario`);
  ok(await visto(pc.getByTestId('fila-agenda')), 'Calendario (sin ficha): los eventos del club');
  await pc.goto(`${APP}/evento/${par.id}`);
  const pestC = (await pc.getByTestId('pestanas-evento').locator('a').allTextContents()).map((t) => t.trim());
  ok(pestC.join() === 'Respuestas,Convocatoria,Pase de lista,WhatsApp', `Evento (sin ficha, partido): ${pestC.join(' · ')} (sin «Mi respuesta»)`);
  await ctxC.close();

  console.log('\n== Gestión sin la barra de subsecciones ni la hoja «Más» (gestor con ficha y sin ficha)');
  // Lo de antes de D189: la barra «GESTIÓN» bajo la cabecera (nav.zb-gestion), el desplegable de Gestión de escritorio
  // (.nv-boton-gestion, #nv-menu-gestion) y la hoja «Más» de la barra inferior (#nv-hoja-mas, .nv-hoja).
  const VIEJO = 'nav.zb, nav.zb-gestion, .zb-fila, nav[aria-label="Gestión"], .nv-boton-gestion, #nv-menu-gestion, .nv-panel-gestion, #nv-hoja-mas, .nv-hoja, [aria-controls="nv-hoja-mas"]';
  for (const [quien, email] of [['con ficha', 'ivan@pruebas.local'], ['sin ficha', 'carlos@pruebas.local']]) {
    for (const ancho of [390, 1280]) {
      const ctx = await e.contexto(ancho);
      const p = await e.nuevaPagina(ctx);
      await e.entrar(p, email);
      for (const ruta of ['/gestion', '/gestion/convocatoria']) {
        await p.goto(`${APP}${ruta}`);
        await hasta(async () => (await p.locator('html').getAttribute('data-sesion')) !== 'pendiente');
        const et = `${ruta}, gestor ${quien} a ${ancho} px`;
        ok(new URL(p.url()).pathname === ruta, `${et}: se abre`, p.url());
        ok((await p.locator(VIEJO).count()) === 0, `${et}: sin la barra de subsecciones ni la hoja «Más»`);
        const mas = await p.locator('header, nav').getByText('Más', { exact: true }).count() + await p.getByRole('button', { name: 'Más', exact: true }).count();
        ok(mas === 0, `${et}: ningún «Más» en la cabecera ni en la barra`);
        const nav = (await p.locator(ancho < 769 ? 'nav.nv-barra a' : 'nav.nv-menu a').allTextContents()).map((t) => t.trim());
        ok(nav.join() === 'Semana,Calendario,Liga,Club,Gestión', `${et}: solo ${ancho < 769 ? 'la barra' : 'el menú'} del gestor`, nav.join(' · '));
        ok((await p.locator(`nav.${ancho < 769 ? 'nv-barra' : 'nv-menu'} a[aria-current="page"]`).allTextContents()).map((t) => t.trim()).join() === 'Gestión', `${et}: «Gestión» marcada`);
      }
      await ctx.close();
    }
  }

  console.log('\n== Visibilidad en el móvil a 360 px: tablas sin desplazar y G3-G6 a la vista (fix/visibilidad-movil)');
  // De una tabla: las cabeceras que se ven ENTERAS sin desplazar (dentro de su caja y de la pantalla), si la caja desplaza y
  // cuántas de las primeras columnas van fijas.
  const columnas = (p, testid) => p.getByTestId(testid).first().evaluate((t) => {
    let caja = t.parentElement;
    while (caja && !['auto', 'scroll'].includes(getComputedStyle(caja).overflowX)) caja = caja.parentElement;
    const c = (caja ?? document.documentElement).getBoundingClientRect();
    const der = Math.min(c.right, window.innerWidth), izq = Math.max(c.left, 0);
    const celdas = [...t.tHead.rows[t.tHead.rows.length - 1].cells].filter((x) => x.getClientRects().length);
    const enteras = celdas.filter((x) => { const r = x.getBoundingClientRect(); return r.left >= izq - 1 && r.right <= der + 1; });
    return {
      todas: celdas.map((x) => x.textContent.trim()), enteras: enteras.map((x) => x.textContent.trim()),
      desplaza: caja ? caja.scrollWidth > caja.clientWidth + 1 : false,
      fijas: celdas.slice(0, 2).filter((x) => getComputedStyle(x).position === 'sticky').length,
    };
  });
  const enteraSinDesplazar = (c) => !c.desplaza && c.enteras.length === c.todas.length;
  const ctxM = await e.contexto(360);
  const pm = await e.nuevaPagina(ctxM);
  await e.entrar(pm, 'jon@pruebas.local');
  await pm.goto(`${APP}/club`);
  const plantilla = await columnas(pm, 'jugadores-tabla');
  ok(enteraSinDesplazar(plantilla) && plantilla.todas.join() === 'Jugador,PJ,Pts,Med', 'Club › Plantilla a 360 px: Jugador, PJ, PTS y MED enteras, sin desplazar', JSON.stringify(plantilla));
  ok(!/#\d/.test(await pm.getByTestId('jugadores-tabla').innerText()), 'Club › Plantilla: sin dorsales a 4 columnas');
  await pm.getByTestId('mas-columnas').click();
  const todas = await columnas(pm, 'jugadores-tabla');
  ok(todas.fijas === 2 && ['PJ', 'Pts', 'Med'].every((x) => todas.enteras.includes(x)), '«Más columnas»: # y jugador fijos, y PJ, PTS y MED a la vista sin desplazar', JSON.stringify(todas));
  await pm.goto(`${APP}/liga`);
  const clas = await columnas(pm, 'liga-clasificacion');
  ok(enteraSinDesplazar(clas) && clas.todas.length === 7, 'Liga › Clasificación a 360 px: #, Equipo, PJ, G, P, Dif y Pts enteras, sin desplazar', JSON.stringify(clas));
  await hasta(async () => (await pm.getByTestId('selector-grupo-liga').locator('button').count()) === 6);
  const botonesGrupo = await pm.getByTestId('selector-grupo-liga').locator('button').evaluateAll((bs) => bs.map((b) => ({ t: b.textContent.trim(), w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height })));
  ok(botonesGrupo.map((b) => b.t).join() === 'G1 · MdA,G2 · MdL,G3,G4,G5,G6' && botonesGrupo.every((b) => b.w >= 44 && b.h >= 44), 'Clasificación con sesión: G1 · MdA | G2 · MdL | G3 | G4 | G5 | G6, de 44 px', JSON.stringify(botonesGrupo));
  for (const [ruta, testid] of [['/liga/2026-27/equipo', 'equipo-partidos'], ['/liga/2026-27/asistencia', 'asistencia-tabla']]) {
    await pm.goto(`${APP}${ruta}`);
    const c = await columnas(pm, testid);
    ok(enteraSinDesplazar(c), `${ruta} a 360 px: la tabla cabe entera sin desplazar`, JSON.stringify(c));
  }
  await pm.goto(`${APP}/liga/2026-27/jugadores`);
  const jt = await columnas(pm, 'jugadores-tabla');
  ok(jt.fijas === 2 && ['PJ', 'Pts', 'Med'].every((x) => jt.enteras.includes(x)), 'Temporadas › Jugadores a 360 px: # y jugador fijos, y PJ, PTS y MED a la vista sin desplazar', JSON.stringify(jt));
  await pm.goto(`${APP}/liga/consolidada`);
  const casillas = await pm.getByTestId('selector-grupos').locator('label.lg-check').evaluateAll((ls) => ls.map((l) => {
    const r = l.getBoundingClientRect();
    return { g: l.dataset.grupo, t: l.innerText.trim(), visible: r.width > 0 && r.left >= 0 && r.right <= window.innerWidth, h: r.height, marcada: l.querySelector('input').checked };
  }));
  const ajenas = casillas.filter((x) => ['G3', 'G4', 'G5', 'G6'].includes(x.g));
  ok(ajenas.length === 4 && ajenas.every((x) => x.visible && x.h >= 44 && !x.marcada && x.t === x.g), 'Jugadores de la liga a 360 px: las casillas G3, G4, G5 y G6 a la vista sin tocar nada, desmarcadas y de 44 px', JSON.stringify(casillas));
  ok((await pm.getByTestId('selector-grupos').locator('details').count()) === 0 && !(await pm.getByTestId('selector-grupos').innerText()).includes('Cada casilla se aplica'), 'Jugadores de la liga: sin «Otros grupos» plegado ni el párrafo explicativo');
  ok(await sinDesbordar(pm), 'Jugadores de la liga a 360 px: sin desbordar');
  await ctxM.close();
  const ctxA = await e.contexto(360);
  const pa = await e.nuevaPagina(ctxA);
  await pa.goto(`${APP}/liga`);
  await hasta(async () => (await pa.locator('html').getAttribute('data-sesion')) !== 'pendiente');
  ok((await pa.getByTestId('selector-grupo-liga').locator('button').allTextContents()).map((x) => x.trim()).join() === 'G1 · MdA,G2 · MdL', 'sin sesión, la Clasificación solo ofrece G1 y G2 (D184/D186)');
  await pa.goto(`${APP}/liga?g=G5`);
  ok((await pa.getByTestId('selector-grupo-liga').locator('button[aria-pressed="true"]').textContent())?.trim() === 'G1 · MdA', 'sin sesión, /liga?g=G5 enseña G1');
  await ctxA.close();

  ok(e.errores.length === 0, 'sin errores de JavaScript ni de consola', e.errores.slice(0, 3).join(' | '));
} finally {
  await e.parar();
}
console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK');
process.exitCode = fallos() ? 1 : 0;
