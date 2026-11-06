#!/usr/bin/env node
// «Claves del partido» (D174) en pantalla, de extremo a extremo: pila local, web compilada y Chrome a 375 px, en las tres
// ubicaciones (la pagina del rival en Scouting, la tarjeta de scouting del Panel y «Tu proximo partido» del jugador) y sin
// sesion (nada). Jugadores SINTETICOS; la liga, la de las hojas (local) o la publicada en data/ (Actions, sin jugadores).
//
//   npm run pruebas:claves-pantallas
import { preparar, personas, sinteticos, contador, visto, sinDesbordar } from './comun_e2e.mjs';
import { adelantar, semanas, hoyMadrid } from './fechas_prueba.mjs';
import { ligaParaPruebas } from './infra/liga.mjs';
import { cargarLiga } from '../scripts/cargar_liga.mjs';
import { clavesRival } from '../src/lib/scouting/claves.ts';
import liga from '../src/data/liga.json' with { type: 'json' };

const { ok, fallos } = contador();
const e = await preparar();
const { sql, APP } = e;
const ETIQ = /^(Cuidado|Aprovechar|Ojo|Contexto|Vigilar)\b/i;   // la etiqueta de la caja va en mayúsculas por CSS
// Lo que delata una clave en una pagina (la caja, la tarjeta y sus clases): sin sesion no puede salir.
const CLAVES_HTML = /claves-partido|claves-tarjeta|claves-lista|cl-clave|Pocos datos: \d/;
try {
  await cargarLiga(sql, ligaParaPruebas('2026-27'), '2026-27', { log: () => {} });
  const hoy = hoyMadrid();
  await adelantar(sql, semanas('2026-10-25'));
  await sinteticos(sql, [['sint-ana', 'Ana', true, true]]);
  const P = await personas(e.pila, { jugadores: [['sint-ana', 'ana@pruebas.local']], gestores: [['Gestor de pruebas', 'gestor@pruebas.local']] });
  void P;

  // Un rival de cada grupo con claves por lo que se sabe de los equipos (con las hojas habra mas) y uno con pocos datos.
  const claves = (g, equipo) => clavesRival({ equipo, nuestro: g === 'G1' ? 'MdA' : 'MdL', partidos: liga.grupos[g].resultados, jugadores: [], historial: null }, { tope: 0 });
  const rivales = (g) => Object.values(liga.grupos[g].equipos).filter((x) => !x.nuestro).map((x) => ({ nombre: x.nombre, r: claves(g, x.nombre) }));
  const conClaves = (g) => rivales(g).find((x) => x.r.equipo.length >= 2)?.nombre;
  const R1 = conClaves('G1'), R2 = conClaves('G2');
  const pocos = [...rivales('G1'), ...rivales('G2')].find((x) => x.r.pocosDatos);
  ok(!!R1 && !!R2, `hay un rival con claves en cada grupo (${R1} y ${R2})`);

  // El primer domingo con MdA y MdL a la vez juega contra ellos (en la tabla de eventos de la pila de pruebas).
  const [{ f: D1 }] = await sql`select fecha::text f from public.eventos where tipo = 'liga' and estado = 'programado' and fecha > ${hoy} group by fecha having count(distinct equipo) = 2 order by 1 limit 1`;
  await sql`update public.eventos set rival = ${R1.toUpperCase()} where tipo = 'liga' and fecha = ${D1} and equipo = 'MdA'`;
  await sql`update public.eventos set rival = ${R2.toUpperCase()} where tipo = 'liga' and fecha = ${D1} and equipo = 'MdL'`;

  console.log('\n== 1) Pagina del rival en Scouting (gestor y jugador, 375 px)');
  for (const [quien, email] of [['gestor', 'gestor@pruebas.local'], ['jugador', 'ana@pruebas.local']]) {
    const p = await e.sesion(email, 375);
    await p.goto(`${APP}/liga/scouting?e=${encodeURIComponent(R1)}`);
    const caja = p.getByTestId('claves-partido');
    ok(await visto(caja), `${quien}: la caja «Claves del partido» de ${R1} se ve`);
    ok((await caja.locator('h3').innerText()) === 'Claves del partido', `${quien}: con su título`);
    const li = await caja.getByTestId('claves-lista').locator('li').allInnerTexts();
    ok(li.length >= 2 && li.length <= 3, `${quien}: «Del equipo», de 2 a 3 claves (hay ${li.length})`, li.join(' | '));
    ok((await caja.locator('h4').allInnerTexts()).join('|') === 'Del equipo|Jugadores a vigilar', `${quien}: los dos bloques con su título`);
    const lj = await caja.locator('[data-testid="claves-jugadores"] li').allInnerTexts();
    ok(lj.length <= 3 && lj.every((t) => /^(Vigilar|Aprovechar)\b/i.test(t.trim())) && (lj.length > 0 || (await caja.getByTestId('claves-ninguna-jugadores').count()) === 1), `${quien}: «Jugadores a vigilar»: hasta 3 líneas (${lj.length}) o el aviso de que no hay`, lj.join(' | '));
    ok(li.every((t) => ETIQ.test(t.trim())), `${quien}: cada clave empieza por su etiqueta (Cuidado, Aprovechar, Ojo o Contexto)`, li.join(' | '));
    ok(li.every((t) => !/\d\.\d/.test(t)), `${quien}: cifras con coma decimal`, li.join(' | '));
    ok(await p.evaluate(() => { const c = document.querySelector('[data-testid="claves-partido"]'), t = document.querySelector('[data-testid="peligrosos"], [data-testid="tabla-scouting"]'); return !t || !!(c.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING); }), `${quien}: va arriba, antes de «Más peligrosos» y de la tabla`);
    ok(await sinDesbordar(p), `${quien}: 375 px sin desbordar`);
    ok(await caja.evaluate((c) => c.getBoundingClientRect().right <= window.innerWidth + 1 && c.getBoundingClientRect().left >= -1), `${quien}: la caja cabe en el ancho`);
    if (pocos) {
      await p.goto(`${APP}/liga/scouting?e=${encodeURIComponent(pocos.nombre)}`);
      const t = (await p.getByTestId('claves-pocos-datos').innerText().catch(() => '')).trim();
      ok(t === pocos.r.pocosDatos && (await p.getByTestId('claves-partido').locator('li').count()) === 0, `${quien}: ${pocos.nombre} con pocos datos: «${pocos.r.pocosDatos}» y ninguna clave`, t);
    }
    await p.goto(`${APP}/liga/scouting?e=${encodeURIComponent('MdA')}`);
    ok((await p.getByTestId('claves-partido').count()) === 0, `${quien}: de nuestro propio equipo no hay claves`);
    await p.context().close();
  }

  console.log('\n== 2) Tarjeta de scouting del Panel (gestor, 375 px): las 2 primeras, con enlace al scouting');
  {
    const p = await e.sesion('gestor@pruebas.local', 375);
    await p.goto(`${APP}/gestion`);
    const tarjetas = p.locator('.gs-scouting a');
    ok(await visto(tarjetas), 'hay tarjetas de scouting en el Panel');
    const n = await tarjetas.count();
    const conC = p.locator('.gs-scouting a [data-testid="claves-tarjeta"]');
    ok((await conC.count()) >= 1, `las tarjetas llevan sus claves (${await conC.count()} de ${n})`);
    for (let i = 0; i < await conC.count(); i++) {
      const lineas = await conC.nth(i).locator('.cl-linea').allInnerTexts();
      ok(lineas.length >= 1 && lineas.length <= 2 && lineas.every((t) => ETIQ.test(t.trim()) || /^Pocos datos/.test(t.trim())), `tarjeta ${i + 1}: la primera de cada bloque (como mucho 2), con etiqueta`, lineas.join(' | '));
    }
    const href = await tarjetas.first().getAttribute('href');
    ok(/^\/liga\/scouting\?e=/.test(href ?? ''), 'la tarjeta enlaza al scouting del rival', href);
    ok(await sinDesbordar(p), '375 px: sin desbordar');
    await p.context().close();
  }

  console.log('\n== 3) «El rival» del partido del jugador (375 px, D189): las 2 primeras, con enlace al scouting');
  {
    const p = await e.sesion('ana@pruebas.local', 375);
    // Desde la Semana, la tarjeta del domingo lleva a su partido (o al domingo, si juega los dos): ahí, «El rival».
    await p.goto(`${APP}/`);
    await p.getByTestId('tarjeta-semana').filter({ has: p.locator('.chip-eq') }).first().locator('a.sm-t-que').click();
    await p.waitForURL((u) => /^\/(evento|mi-zona\/domingo)\//.test(u.pathname));
    const tarjeta = p.locator('main');
    ok(await visto(p.getByTestId('el-rival')), '«El rival» se ve');
    const cs = tarjeta.getByTestId('claves-tarjeta');
    ok((await cs.count()) === 2, `una por rival (MdA y MdL): ${await cs.count()}`);
    for (let i = 0; i < await cs.count(); i++) {
      const lineas = await cs.nth(i).locator('.cl-linea').allInnerTexts();
      ok(lineas.length >= 1 && lineas.length <= 2 && lineas.every((t) => ETIQ.test(t.trim())) && !/^Vigilar/i.test(lineas[0].trim()), `tarjeta ${i + 1}: la primera del equipo y, si hay, la primera de los jugadores a vigilar`, lineas.join(' | '));
      ok(lineas.length === 1 || /^(Vigilar|Aprovechar)/i.test(lineas[1].trim()), `tarjeta ${i + 1}: la segunda línea es de un jugador`, lineas.join(' | '));
      const enlace = cs.nth(i).getByRole('link', { name: 'Ver el scouting' });
      ok(/^\/liga\/scouting\?e=/.test((await enlace.getAttribute('href')) ?? ''), `tarjeta ${i + 1}: enlace «Ver el scouting» al rival`, await enlace.getAttribute('href'));
      ok(await enlace.evaluate((a) => a.getBoundingClientRect().height >= 44), `tarjeta ${i + 1}: el enlace es tocable (≥ 44 px)`);
    }
    const primera = await cs.first().locator('.cl-linea').first().innerText();
    await cs.first().getByRole('link', { name: 'Ver el scouting' }).click();
    await p.waitForURL((u) => u.pathname === '/liga/scouting');
    const sinEtiqueta = (t) => t.trim().replace(/^\w+:?\s+/, '');
    ok(sinEtiqueta(await p.getByTestId('claves-lista').locator('li').first().innerText()) === sinEtiqueta(primera), 'el enlace lleva al scouting del rival, y su primera clave es la misma de la tarjeta');
    await p.goto(`${APP}/`);
    ok(await sinDesbordar(p), '375 px: sin desbordar');
    await p.context().close();
  }

  console.log('\n== Sin sesion: ni una clave (D162)');
  for (const r of ['/', '/liga', `/liga/scouting?e=${encodeURIComponent(R1)}`, '/entrar']) {
    const res = await fetch(`${APP}${r}`, { redirect: 'follow' });
    const html = await res.text();
    ok(!CLAVES_HTML.test(html), `anónimo en ${r}: el HTML no lleva claves del partido`);
  }
  ok(e.errores.length === 0, 'sin errores de JavaScript', e.errores.join(' | '));
} finally {
  await e.parar();
}
console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK');
process.exit(fallos() ? 1 : 0);
