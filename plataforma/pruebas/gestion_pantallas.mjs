#!/usr/bin/env node
// Gestión de la estructura nueva (bloques 4 y 5), de extremo a extremo: pila local, web compilada y Chrome. Jugadores
// SINTÉTICOS (D39), calendario y reloj de prueba (D185: «hoy» es el lunes 19/10/2026), sin avisos reales (pila local).
//   - /gestion a 360, 390 y 412 px y en escritorio (1280 px), como gestor sin ficha y como gestor con ficha (Beto); el
//     jugador y el anónimo no entran (los cuatro roles): las secciones 1 · Quién va esta semana, 2 · Convocatoria del domingo, 3 · Pendiente y
//     «Plantilla y club»; sin desbordar, nada tapado, objetivos de al menos 44 px, ningún «(D» seguido de número en el
//     HTML; enlaces a todas las pantallas de gestión (la barra de subsecciones ya no existe); «Copiar WhatsApp» a quien falta.
//   - Gestión › No convocados: la racha y el total salen de las convocatorias aprobadas, las respuestas y las fichas
//     (disponible y fuera = +1, convocado = 0, solo entreno y tardío no suman); el interruptor del desempate, apagado.
//   - Convocatoria: «Quién lleva más tiempo fuera», «Ocultar niveles» (en la URL), líneas con nivel y «dobla».
//   - Gestión › Jugadores: buscador (en la URL) y fila desplegable con los datos privados.
//   - Pedido de ropa: entra cerrado; un solo estado con su causa; el interruptor lo abre y lo cierra; invisible para el
//     jugador con el interruptor apagado (y se deja apagado al terminar); con la fecha límite pasada se puede cerrar.
//   - 3 · Pendiente: la convocatoria se va al aprobarla y la rutina B solo sale si el jueves pasó sin revisión registrada.
//   - Barrera (h): jugador y anónimo sin acceso a niveles, motivos ni contador de no convocados.
// Capturas a 390 px (solo en local, con capturas), como gestor sin ficha y con ficha (`<pantalla>-sin-ficha.png`,
// `<pantalla>-con-ficha.png`), en privado/mockups_liga/rediseno/estructura_nueva/.
//
//   npm run pruebas:gestion
import fs from 'node:fs';
import path from 'node:path';
import { preparar, personas, sinteticos, contador, visto, sinDesbordar, pequenos, trasAccion, hasta, REPO } from './comun_e2e.mjs';
import { conCapturas } from './infra/app.mjs';
import { hoyMadrid } from './fechas_prueba.mjs';

const SALIDA = path.join(REPO, 'privado', 'mockups_liga', 'rediseno', 'estructura_nueva');
if (conCapturas()) fs.mkdirSync(SALIDA, { recursive: true });
// Página entera con la ventana tan alta como la página: la barra fija sale abajo, no a media captura.
const foto1 = async (p, n) => {
  const v = p.viewportSize();
  await p.setViewportSize({ width: v.width, height: await p.evaluate(() => document.documentElement.scrollHeight) });
  await p.screenshot({ path: path.join(SALIDA, `${n}.png`) }).catch(() => {});
  await p.setViewportSize(v);
};
// Cada captura, como gestor sin ficha (la página de la prueba) y como gestor con ficha (Beto), en la misma URL y con
// los mismos desplegables abiertos.
let conFicha = null;
const foto = async (p, n) => {
  if (!conCapturas()) return;
  await foto1(p, `${n}-sin-ficha`);
  conFicha ??= await e.sesion('beto@pruebas.local', 390);
  await conFicha.goto(p.url());
  const abiertos = await p.locator('main details').evaluateAll((ds) => ds.map((d) => d.open));
  await conFicha.locator('main details').evaluateAll((ds, a) => ds.forEach((d, i) => { if (a[i]) d.open = true; }), abiertos);
  await foto1(conFicha, `${n}-con-ficha`);
};
const { ok, fallos, sumar } = contador();
const e = await preparar();
const { sql, APP } = e;
const hoy = hoyMadrid();
const conD = (html) => /\(D\d/.test(html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, ''));
try {
  // ---------------------------------------------------------------- datos sintéticos
  // Domingos jugados del calendario de prueba (antes del 19/10) y el próximo (J3, 25/10, MdA 09:00 y MdL 14:00).
  const ligaPas = await sql`select id, equipo, fecha::text, jornada from public.eventos where tipo = 'liga' and estado = 'programado' and fecha < ${hoy} order by fecha`;
  const fechasPas = [...new Set(ligaPas.map((x) => x.fecha))];
  const [J3] = (await sql`select min(fecha)::text f from public.eventos where tipo = 'liga' and estado = 'programado' and fecha >= ${hoy}`).map((x) => x.f);
  if (fechasPas.length < 2 || !J3) throw new Error('El calendario de prueba no tiene dos domingos jugados y uno por jugar.');
  const [D1, D2] = fechasPas.slice(-2);
  await sql`update public.jugadores set activo = false`;
  await sinteticos(sql, [['sint-ana', 'Ana', true, true], ['sint-beto', 'Beto', true, true], ['sint-teo', 'Teo', true, true], ['sint-ciro', 'Ciro', true, false, 'solo_entreno'], ['sint-flor', 'Flor', true, false]]);
  await sql`update public.jugadores set activo = true where person_id like 'sint-%'`;
  for (const [p, pos, nv] of [['sint-ana', 'base', 'A'], ['sint-beto', 'escolta', 'B'], ['sint-teo', 'pivot', 'C'], ['sint-ciro', 'alero', 'D'], ['sint-flor', 'alero', 'C']])
    await sql`insert into public.jugadores_privado (person_id, posicion, nivel, nota_ataque, nota_defensa, dobla) values (${p}, ${pos}, ${nv}, ${nv}, 'C', true) on conflict (person_id) do update set posicion = excluded.posicion, nivel = excluded.nivel`;
  // Cierre de cada domingo: el martes anterior a las 12:00 (Madrid, +02:00 en octubre).
  const cierre = (f) => { const d = new Date(`${f}T12:00:00+02:00`); d.setUTCDate(d.getUTCDate() - 5); return d; };
  const antes = (f) => new Date(cierre(f).getTime() - 26 * 3600e3).toISOString();
  const despues = (f) => new Date(cierre(f).getTime() + 3 * 3600e3).toISOString();
  const voy = async (f, p, cuando, equipo = 'MdA') => {
    for (const ev of ligaPas.filter((x) => x.fecha === f && x.equipo === equipo))
      await sql`insert into public.respuestas (evento_id, person_id, respuesta, origen, cambiado_en) values (${ev.id}, ${p}, 'va', 'jugador', ${cuando}) on conflict (evento_id, person_id) do update set respuesta = 'va', cambiado_en = excluded.cambiado_en`;
  };
  for (const f of [D1, D2]) {
    await voy(f, 'sint-ana', antes(f));                       // Ana: a tiempo y nunca entra → racha 2, total 2
    await voy(f, 'sint-beto', antes(f));                      // Beto: entra en D2 → racha 0, total 1
    await voy(f, 'sint-ciro', antes(f));                      // Ciro: solo entreno → 0 y 0
  }
  await voy(D1, 'sint-teo', antes(D1));                       // Teo: D1 a tiempo, D2 tarde → racha 1, total 1
  await voy(D2, 'sint-teo', despues(D2));
  await voy(D2, 'sint-flor', antes(D2), 'MdL');               // Flor: «voy» al MdL sin ficha del MdL → no cuenta
  for (const f of [D1, D2]) {
    const equipos = f === D2 ? { MdA: [{ person_id: 'sint-beto' }] } : { MdA: [] };
    await sql`insert into public.convocatorias (fecha, jornada, estado, origen, equipos, aprobada_en, aprobada_por_nombre) values (${f}, ${ligaPas.find((x) => x.fecha === f).jornada}, 'aprobada', 'propuesta', ${sql.json(equipos)}, ${new Date(cierre(f).getTime() + 8 * 3600e3).toISOString()}, 'Gestor')`;
  }
  // El próximo domingo: Ana y Beto al MdA, Teo a los dos; el entreno de la semana, sin responder (para «Copiar WhatsApp»).
  for (const ev of await sql`select id, equipo from public.eventos where tipo = 'liga' and fecha = ${J3}`) {
    for (const p of ev.equipo === 'MdA' ? ['sint-ana', 'sint-beto', 'sint-teo'] : ['sint-teo'])
      await sql`insert into public.respuestas (evento_id, person_id, respuesta, origen) values (${ev.id}, ${p}, 'va', 'jugador') on conflict do nothing`;
  }
  const yo = await personas(e.pila, { jugadores: [['sint-ana', 'ana@pruebas.local']], gestores: [['Gestor', 'gestor@pruebas.local'], ['Beto', 'beto@pruebas.local', 'sint-beto']] });
  const [campana] = await sql`select id, estado from public.campanas_ropa order by creado_en limit 1`;

  // ---------------------------------------------------------------- /gestion
  for (const [ancho, quien] of [[360, 'gestor'], [390, 'gestor'], [412, 'gestor'], [1280, 'gestor'], [360, 'beto'], [412, 'beto'], [1280, 'beto']]) {
    const rol = quien === 'beto' ? 'gestor con ficha' : 'gestor sin ficha';
    console.log(`\n== /gestion a ${ancho} px (${rol})`);
    const p = await e.sesion(`${quien}@pruebas.local`, ancho);
    await p.goto(`${APP}/gestion`);
    for (const [t, n] of [['gp-semana', '1 · Quién va esta semana'], ['gp-convocatoria', '2 · Convocatoria del domingo'], ['gp-pendiente', '3 · Pendiente'], ['gp-plantilla', 'Plantilla y club']])
      ok(await visto(p.getByTestId(t).getByRole('heading', { level: 2, name: n })), `sección «${n}»`);
    ok(await sinDesbordar(p), 'sin desbordar en horizontal');
    const chicos = await pequenos(p, 'main button, main .boton, main summary, main input, main select, main .gp-menu a, main .gp-filas a, main .gp-enlace');
    ok(!chicos.length, 'objetivos de al menos 44 px', JSON.stringify(chicos.slice(0, 6)));
    // Nada tapado: el centro de cada título de sección, tras llevarlo a la vista, es el propio título.
    const tapados = await p.evaluate(() => [...document.querySelectorAll('main h2')].filter((h) => {
      h.scrollIntoView({ block: 'center' });
      const r = h.getBoundingClientRect(); const x = document.elementFromPoint(r.left + Math.min(r.width / 2, 40), r.top + r.height / 2);
      return !(x && (x === h || h.contains(x)));
    }).map((h) => h.textContent));
    ok(!tapados.length, 'nada tapado por barras fijas', tapados.join(' | '));
    ok(!conD(await p.content()), 'ningún «(D» seguido de número en el HTML');
    if (ancho === 1280) {
      // Escritorio: la columna principal ocupa su sitio (no se queda en una tira de móvil) y la barra inferior del móvil no sale.
      const anchoMain = await p.locator('main').evaluate((m) => m.getBoundingClientRect().width);
      ok(anchoMain >= 900, `escritorio: el contenido usa el ancho (${Math.round(anchoMain)} px)`);
    }
    if (quien === 'beto') ok(await visto(p.getByTestId('gp-semana')) && !(await p.getByText('Acceso restringido').count()), 'el gestor con ficha ve Gestión igual que el sin ficha');
    if (ancho === 390 && quien === 'gestor') {
      const hrefs = await p.getByTestId('gp-plantilla').locator('a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
      const todas = ['/gestion/jugadores', '/gestion/no-convocados', '/gestion/asistencia', '/gestion/ropa', '/gestion/eventos', '/gestion/convocatoria', '/gestion/convocatoria/datos', '/gestion/tablero', '/gestion/grupos', '/gestion/eventos/pistas', '/gestion/eventos/importar', '/gestion/telefonos', '/gestion/clasificacion', '/gestion/eventos/nuevo'];
      const faltan = todas.filter((h) => !hrefs.includes(h));
      ok(!faltan.length, '«Plantilla y club» lleva a todas las pantallas de gestión (sin la barra de subsecciones)', faltan.join(', '));
      ok(/Tesorería/.test(await p.getByTestId('gp-plantilla').innerText()) && (await p.getByTestId('gp-plantilla').locator('[aria-disabled="true"]').count()) === 1, 'Tesorería, desactivada («por construir»)');
      const wa = p.locator('[data-testid^="whatsapp-"]').first();
      ok(await visto(wa) && /@Ana/.test(await wa.getAttribute('data-texto')), '«Copiar WhatsApp» con quien falta por responder (@ + mote)', await wa.getAttribute('data-texto').catch(() => ''));
      ok(await visto(p.locator('[data-testid^="faltan-"] a', { hasText: 'Avisar a los que faltan' })), '«Avisar a los que faltan» (a la pantalla de respuestas)');
      ok(/Sin empezar|Propuesta|Aprobada|Enviada/.test(await p.getByTestId('gp-estado-conv').innerText()), 'la convocatoria del domingo con su estado', await p.getByTestId('gp-estado-conv').innerText());
      await p.getByTestId('gp-conv-numeros-MdA').click();
      ok(/Ana/.test(await p.getByTestId('gp-conv-numeros-lista').innerText()), 'convocados por equipo, pulsables (MdA: Ana)');
      ok(await visto(p.getByTestId('gp-grupos').getByText('Grupos del miércoles')), 'debajo, «Grupos del miércoles» con su estado');
      const nm = await p.getByTestId('tarjeta-avisos').innerText();
      const m = /Con avisos: (\d+)\/(\d+)/.exec(nm);
      const activos = (await sql`select count(*)::int n from public.jugadores where activo and rol <> 'entrenador'`)[0].n;
      ok(!!m && +m[2] === activos, `«N de M» calculado en el momento (M = ${activos} jugadores activos ahora)`, m?.[0]);
      await foto(p, 'gestion-panel');
    }
    await p.context().close();
  }
  for (const ancho of [412, 1280]) {
    console.log(`\n== /gestion a ${ancho} px: el jugador y el anónimo no entran`);
    const pj = await e.sesion('ana@pruebas.local', ancho);
    const rj = await pj.goto(`${APP}/gestion`);
    ok((rj.status() >= 400 || !pj.url().includes('/gestion')) && !(await pj.getByTestId('gp-semana').count()), `jugador a ${ancho} px: sin Gestión`, `${rj.status()} ${pj.url()}`);
    ok(await sinDesbordar(pj), `jugador a ${ancho} px: lo que ve, sin desbordar`);
    await pj.context().close();
    const ctxA = await e.contexto(ancho);
    const pa = await e.nuevaPagina(ctxA);
    await pa.goto(`${APP}/gestion`);
    ok(pa.url().includes('/entrar') && !(await pa.getByTestId('gp-semana').count()), `anónimo a ${ancho} px: a /entrar`, pa.url());
    await ctxA.close();
  }

  // ---------------------------------------------------------------- 3 · Pendiente: nada caducado
  console.log('\n== 3 · Pendiente: ninguna tarea caducada');
  const pp = await e.sesion('gestor@pruebas.local', 390);
  const pendiente = async () => { await pp.goto(`${APP}/gestion`); return (await pp.getByTestId('gp-pendiente').innerText()).replace(/\s+/g, ' '); };
  let tp = await pendiente();
  ok(/Convocatoria de la J\d+: reparto/.test(tp), 'con la convocatoria del domingo sin aprobar, sale en Pendiente', tp.slice(0, 200));
  ok(/Rutina B del jue 15 oct sin registrar/.test(tp), 'el jueves 15/10 pasó sin revisión del calendario: «Rutina B del jue 15 oct sin registrar»', tp.slice(0, 300));
  ok(!/Contrastar la clasificación calculada/.test(tp), 'la tarea fija «Contrastar la clasificación…» ya no sale siempre');
  const jJ3 = (await sql`select jornada from public.eventos where tipo = 'liga' and fecha = ${J3} limit 1`)[0].jornada;
  await sql`insert into public.convocatorias (fecha, jornada, estado, origen, equipos, aprobada_en, aprobada_por_nombre) values (${J3}, ${jJ3}, 'aprobada', 'propuesta', ${sql.json({ MdA: [{ person_id: 'sint-ana' }] })}, '2026-10-19T08:00:00Z', 'Gestor')`;
  await sql`insert into public.importaciones (tipo, por_nombre, en, lineas, validas, aceptadas, ignoradas, bloqueadas) values ('calendario', 'Gestor', '2026-10-15T18:25:00Z', 44, 26, 0, 0, 0)`;
  tp = await pendiente();
  ok(!/Convocatoria de la J/.test(tp), 'aprobada la convocatoria, su tarea desaparece de Pendiente', tp.slice(0, 200));
  ok(!/Rutina B del/.test(tp) && /Revisado 15\/10, sin cambios/.test(await pp.getByTestId('gp-calendario').innerText()), 'con la revisión del jueves registrada (0 cambios): sin tarea y «Revisado 15/10, sin cambios»', await pp.getByTestId('gp-calendario').innerText());
  await sql`delete from public.convocatorias where fecha = ${J3}`;

  console.log('\n== Cambios del calendario: el historial, con fecha (D189)');
  await sql`insert into public.importaciones (tipo, por_nombre, en, lineas, validas, aceptadas, ignoradas, bloqueadas, detalle) values ('calendario', 'Gestor', '2026-10-08T18:20:00Z', 44, 26, 1, 0, 0, ${sql.json({ cambios: [{ evento: 'no-existe-j9', campo: 'hora', de: '09:00', a: '13:30' }] })})`;
  const [cam] = await sql`select id from public.eventos where tipo = 'liga' and fecha >= ${hoyMadrid()} order by fecha limit 1`;
  await sql`update public.eventos set cambio_visible_en = '2026-10-12T09:00:00Z', cambio_visible = ${sql.json({ antes: '15/11/2026, 09:00', campos: ['fecha', 'hora'] })} where id = ${cam.id}`;
  ok(await visto(pp.getByTestId('gp-historial-calendario').getByRole('link', { name: 'Historial ›' })), 'Gestión › Pendiente: «Historial ›» de los cambios del calendario');
  await pp.goto(`${APP}/gestion/eventos/historial`);
  const hist = pp.getByTestId('historial-calendario');
  const filasH = await hist.locator('li[data-tipo]').evaluateAll((l) => l.map((x) => `${x.getAttribute('data-tipo')}|${x.innerText.replace(/\s+/g, ' ')}`));
  ok(filasH.length === 3 && /^importacion[|]15 oct/.test(filasH[0]) && /Calendario revisado, sin cambios/.test(filasH[0]) && /^aviso[|]12 oct/.test(filasH[1]) && /cambia fecha, hora \(antes: 15\/11\/2026, 09:00\)/.test(filasH[1]) && /^importacion[|]8 oct/.test(filasH[2]) && /1 cambio aplicado/.test(filasH[2]) && /no-existe-j9: hora 09:00 → 13:30/.test(filasH[2]),
    'el historial: las dos importaciones (con y sin cambios) y el aviso, de lo más reciente a lo más antiguo y con su fecha', filasH.join(' || '));
  ok(await sinDesbordar(pp), 'el historial a 390 px, sin desbordar');
  await sql`update public.eventos set cambio_visible_en = null, cambio_visible = null where id = ${cam.id}`;
  await sql`delete from public.importaciones where tipo = 'calendario'`;
  await pp.context().close();

  const pg = await e.sesion('gestor@pruebas.local', 390);
  // ---------------------------------------------------------------- No convocados
  console.log('\n== Gestión › No convocados');
  await pg.goto(`${APP}/gestion/no-convocados`);
  const fila = (pid) => pg.getByTestId('nc-lista').locator(`li[data-person="${pid}"]`);
  const cifras = async (pid) => ({ racha: +(await fila(pid).getByTestId('nc-racha').innerText()), total: +(await fila(pid).getByTestId('nc-total').innerText()) });
  ok(JSON.stringify(await cifras('sint-ana')) === '{"racha":2,"total":2}', 'Ana: disponible a tiempo y fuera los dos domingos → racha 2, total 2', JSON.stringify(await cifras('sint-ana').catch(() => null)));
  ok(JSON.stringify(await cifras('sint-beto')) === '{"racha":0,"total":1}', 'Beto: convocado el último → racha 0 (total 1)', JSON.stringify(await cifras('sint-beto').catch(() => null)));
  ok(JSON.stringify(await cifras('sint-teo')) === '{"racha":1,"total":1}', 'Teo: el «voy» tardío no suma ni corta la racha → 1 y 1', JSON.stringify(await cifras('sint-teo').catch(() => null)));
  ok(!(await fila('sint-ciro').count()) && !(await fila('sint-flor').count()), 'solo entreno (Ciro) y «voy» sin ficha (Flor): no suman');
  ok((await pg.getByTestId('nc-interruptor').innerText()) === 'apagado', 'el desempate en la propuesta, apagado (sin la variable)');
  await fila('sint-teo').locator('summary').click();
  ok(/después del cierre: no suma/.test(await fila('sint-teo').innerText()) && /según la convocatoria aprobada/.test(await fila('sint-teo').innerText()), 'cada domingo dice qué pasó y de dónde sale');
  ok(await sinDesbordar(pg) && !conD(await pg.content()), 'a 390 px sin desbordar y sin «(D»');
  await foto(pg, 'gestion-no-convocados');

  // ---------------------------------------------------------------- Convocatoria
  console.log(`\n== Convocatoria del ${J3}`);
  await pg.goto(`${APP}/gestion/convocatoria?fecha=${J3}`);
  const mf = pg.getByTestId('cv-mas-fuera');
  ok(await visto(mf.locator('[data-person="sint-ana"]')) && /2\s*seguidos/.test(await mf.locator('[data-person="sint-ana"]').innerText()), '«Quién lleva más tiempo fuera»: Ana, 2 seguidos');
  ok(await visto(pg.getByRole('link', { name: 'Ajustar en el tablero' })), '«Ajustar en el tablero»');
  ok(await visto(pg.locator('.cv-chip .cv-nivel').first()), 'en la revisión, cada jugador con su nivel');
  await foto(pg, 'convocatoria-domingo');
  await pg.getByTestId('cv-ocultar-niveles').click();
  await pg.waitForURL(/niveles=no/);
  ok(await hasta(async () => (await pg.getByTestId('cv-pantalla').getAttribute('data-niveles')) === 'ocultos') && (await pg.locator('.cv-nivel').evaluateAll((xs) => xs.every((x) => !x.offsetParent))), '«Ocultar niveles»: ningún nivel a la vista, y queda en la URL');
  await foto(pg, 'convocatoria-sin-niveles');
  await pg.getByTestId('cv-ocultar-niveles').click();
  await pg.waitForURL((u) => !u.search.includes('niveles=no'));
  ok(!conD(await pg.content()), 'convocatoria sin «(D» en el HTML');

  // ---------------------------------------------------------------- Jugadores
  console.log('\n== Gestión › Jugadores: buscador y fila desplegable');
  await pg.goto(`${APP}/gestion/jugadores`);
  // «teo» también está en «Mateos» (plantilla real de data/): se busca por su nombre oficial, que es único.
  await pg.getByTestId('jg-buscar').fill('prueba, teo');
  ok(await hasta(async () => (await pg.locator('section.tarjeta li.fila-jugador[data-person]').count()) === 1 && /q=prueba/.test(pg.url())), 'buscar «prueba, teo»: una fila, y lo buscado en la URL', String(await pg.locator('section.tarjeta li.fila-jugador[data-person]').count()));
  await pg.locator('li[data-person="sint-teo"] summary').click();
  const dt = await pg.locator('li[data-person="sint-teo"]').getByTestId('jg-datos').innerText();
  ok(/Pívot/.test(dt) && /C global/.test(dt) && /Dobla/.test(dt) && /sin teléfono|Teléfono/.test(dt), 'fila desplegada: posición, niveles, dobla, acceso y teléfono', dt.replace(/\s+/g, ' ').slice(0, 160));
  ok(await sinDesbordar(pg) && !conD(await pg.content()), 'a 390 px sin desbordar y sin «(D»');
  await foto(pg, 'gestion-jugadores');

  // ---------------------------------------------------------------- Pedido de ropa
  console.log('\n== Pedido de ropa: entra cerrado, un solo estado y el interruptor');
  ok(campana?.estado === 'cerrada', 'la campaña está cerrada (apagado por defecto)', campana?.estado);
  const zona = async () => {
    const r = await fetch(`${e.pila.url}/rest/v1/rpc/mi_zona`, { method: 'POST', headers: { apikey: e.pila.anonKey, authorization: `Bearer ${yo['sint-ana'].token}`, 'content-type': 'application/json' }, body: '{}' });
    return (await r.json())?.campana ?? null;
  };
  ok((await zona())?.abierta_ahora === false, 'el jugador: mi_zona dice cerrada');
  const pj = await e.sesion('ana@pruebas.local', 390);
  await pj.goto(`${APP}/mi-zona/ropa/nuevo`);
  ok(await visto(pj.getByText('El pedido de ropa está cerrado')), 'el jugador no puede pedir (formulario cerrado)');
  await pj.goto(`${APP}/`);
  ok(!(await pj.locator('#ropa').count()) && !/Hacer mi pedido/.test(await pj.content()), 'y su inicio no enseña el pedido');
  await pg.goto(`${APP}/gestion/ropa`);
  ok((await pg.getByTestId('ropa-estado').getAttribute('data-causa')) === 'interruptor' && /^Cerrado a los jugadores · interruptor apagado/i.test((await pg.getByTestId('ropa-estado').innerText()).replace(/\s+/g, ' ').trim()), '«Cerrado a los jugadores · interruptor apagado»');
  ok(!(await pg.getByTestId('ropa-editar').evaluate((d) => d.open)), 'la edición de la campaña, plegada');
  const orden = await pg.locator('main h2').allInnerTexts();
  ok(orden.findIndex((t) => /Recuento/i.test(t)) < orden.findIndex((t) => /Dorsales/i.test(t)) && orden.findIndex((t) => /Pedidos/i.test(t)) < orden.findIndex((t) => /Dorsales/i.test(t)), 'primero el recuento y los pedidos', orden.join(' | '));
  await foto(pg, 'ropa-cerrado');
  await trasAccion(pg, () => pg.getByRole('button', { name: 'Abrir el pedido a los jugadores' }).click());
  ok(await hasta(async () => (await pg.getByTestId('ropa-estado').getAttribute('data-abierto')) === 'si'), 'el interruptor lo abre: «Abierto a los jugadores»');
  ok((await zona())?.abierta_ahora === true, 'y ahora el jugador sí lo ve (mi_zona)');
  await pj.goto(`${APP}/mi-zona/ropa/nuevo`);
  ok(await visto(pj.getByLabel('Nombre en la ropa')), 'y puede pedir');
  await foto(pg, 'ropa-abierto');
  await trasAccion(pg, () => pg.getByRole('button', { name: 'Cerrar el pedido a los jugadores' }).click());
  ok(await hasta(async () => (await pg.getByTestId('ropa-estado').getAttribute('data-abierto')) === 'no'), 'se vuelve a cerrar');
  ok((await zona())?.abierta_ahora === false && (await sql`select estado from public.campanas_ropa where id = ${campana.id}`)[0].estado === 'cerrada', 'y queda apagado al terminar (invisible para el jugador)');
  // Interruptor encendido y fecha límite pasada («Ropa 2026/27» el 06/11): cerrado a los jugadores, pero «abierta» en la base.
  // Tiene que poder cerrarse (antes solo salía «Abrir»).
  await sql`update public.campanas_ropa set estado = 'abierta', fecha_limite = '2026-10-10T21:59:59Z' where id = ${campana.id}`;
  await pg.goto(`${APP}/gestion/ropa`);
  ok((await pg.getByTestId('ropa-estado').getAttribute('data-causa')) === 'fecha' && await visto(pg.getByTestId('ropa-cerrar')), 'con la fecha límite pasada: «Cerrar el pedido a los jugadores» a la vista');
  await trasAccion(pg, () => pg.getByTestId('ropa-cerrar').click());
  ok(await hasta(async () => (await pg.getByTestId('ropa-estado').getAttribute('data-causa')) === 'interruptor') && (await sql`select estado from public.campanas_ropa where id = ${campana.id}`)[0].estado === 'cerrada', 'y al pulsarlo la campaña queda «cerrada» en la base');
  ok(!conD(await pg.content()), 'pedido de ropa sin «(D» en el HTML');

  // ---------------------------------------------------------------- Barrera (h)
  console.log('\n== Barrera (h): ni el jugador ni un anónimo ven niveles, motivos ni el contador de no convocados');
  const prohibido = /Quién lleva más tiempo fuera|No convocados|seguidos sin convocar|cv-nivel|nc-racha|data-niveles/;
  const [evJ3] = await sql`select id from public.eventos where tipo = 'liga' and equipo = 'MdA' and fecha = ${J3}`;
  for (const ruta of ['/', '/agenda', '/mi-zona', `/mi-zona/domingo/${J3}`, `/mi-zona/evento/${evJ3.id}`]) {
    await pj.goto(`${APP}${ruta}`);
    ok(!prohibido.test(await pj.content()), `jugador, ${ruta}: nada del registro ni de niveles en el HTML`);
  }
  for (const ruta of ['/gestion', '/gestion/no-convocados', `/gestion/convocatoria?fecha=${J3}`, '/gestion/jugadores', '/gestion/ropa']) {
    await pj.goto(`${APP}${ruta}`);
    ok(!new URL(pj.url()).pathname.startsWith('/gestion') && !prohibido.test(await pj.content()), `jugador: ${ruta.split('?')[0]} no se abre`, pj.url());
  }
  const anon = await e.nuevaPagina(await e.contexto(390));
  for (const ruta of ['/gestion', '/gestion/no-convocados', `/gestion/convocatoria?fecha=${J3}`]) {
    await anon.goto(`${APP}${ruta}`);
    ok(new URL(anon.url()).pathname.startsWith('/entrar') && !prohibido.test(await anon.content()), `anónimo: ${ruta.split('?')[0]} → /entrar`, anon.url());
  }
  const api = async (ruta, token) => { const r = await fetch(`${e.pila.url}/rest/v1${ruta}`, { headers: { apikey: e.pila.anonKey, authorization: `Bearer ${token ?? e.pila.anonKey}` } }); let d = null; try { d = await r.json(); } catch {} return { status: r.status, d }; };
  const negado = (r) => r.status === 401 || r.status === 403 || (r.status === 200 && Array.isArray(r.d) && r.d.length === 0);
  for (const [t, nom] of [[undefined, 'anónimo'], [yo['sint-ana'].token, 'jugador']]) {
    ok(negado(await api('/jugadores_privado?select=person_id,nivel', t)), `${nom}: no lee niveles (jugadores_privado)`);
    ok(negado(await api('/convocatorias?select=fecha,equipos', t)), `${nom}: no lee las convocatorias (de donde sale el registro)`);
    ok(negado(await api('/respuestas?select=person_id,motivo&motivo=not.is.null', t)), `${nom}: no lee motivos`);
  }
  ok(!e.errores.length, 'sin errores de JS en ninguna página', e.errores.slice(0, 4).join(' | '));
} catch (err) {
  console.log(`  FALLO ${err.stack}`); sumar();
} finally {
  await e.parar();
}
console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK');
process.exit(fallos() ? 1 : 0);
