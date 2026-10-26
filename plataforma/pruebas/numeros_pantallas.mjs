#!/usr/bin/env node
// Contadores de personas desplegables y «← volver» (D139), de extremo a extremo: pila local, web compilada y Chrome.
//   - Cada contador es un botón con aria-expanded que despliega, en línea y debajo, los nombres de ese estado; otro toque lo cierra.
//   - Gestores: nombre + motivo y detalle (Respuestas del evento, Eventos, Panel, Convocatoria); jugadores: solo el nombre, nunca el motivo (D46).
//   - Los nombres con estadísticas son enlaces a su ficha; los que no, texto.
//   - A 375 px: sin desbordar y con zona táctil de al menos 44 px.
//   - «← volver» en las pantallas interiores, a la pantalla de origen con su filtro, su jornada y su pestaña; el botón atrás hace lo mismo.
//
//   npm run pruebas:numeros
import { preparar, personas, sinteticos, contador, visto, sinDesbordar, pequenos } from './comun_e2e.mjs';
import { adelantar, semanas } from './fechas_prueba.mjs';

const { ok, fallos, sumar } = contador();
const e = await preparar({ puerto: 3141 });
const { sql, APP } = e;
try {
  const F = await adelantar(sql, semanas('2026-10-25'));
  const J3 = F('2026-10-25');
  const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  if (F('2026-10-18') === hoy) await sql`update public.eventos set inicio = '00:01', fin = null where tipo = 'liga' and fecha = ${hoy}`;
  await sinteticos(sql, [['sint-noe', 'Noe', true, true], ['sint-zoe', 'Zoe', true, true], ['sint-ari', 'Ari', true, true]]);
  await sql`update public.jugadores set ficha_mda = true, ficha_mdl = true where person_id = 'esteban-jon'`;
  await personas(e.pila, {
    jugadores: [['esteban-jon', 'jon@pruebas.local']],
    gestores: [['Iván', 'gestor@pruebas.local', 'villaescusa-silva-ivan']],
  });
  const [ent] = await sql`select id, fecha::text from public.eventos where tipo = 'entreno' and estado = 'programado' and fecha > ${hoy} order by fecha limit 1`;
  const j3 = await sql`select id, equipo from public.eventos where tipo = 'liga' and fecha = ${J3} order by inicio`;
  const mda = j3.find((x) => x.equipo === 'MdA'), mdl = j3.find((x) => x.equipo === 'MdL');
  // Respuestas al entreno: Jon va; Noe no va (lesión, «rodilla»); Zoe duda; Ari sin responder.
  await sql`insert into public.respuestas (evento_id, person_id, respuesta, motivo, detalle, origen) values
    (${ent.id}, 'esteban-jon', 'va', null, null, 'jugador'), (${ent.id}, 'sint-noe', 'no', 'lesion', 'rodilla', 'jugador'), (${ent.id}, 'sint-zoe', 'duda', null, null, 'jugador')`;
  await sql`insert into public.respuestas (evento_id, person_id, respuesta, motivo, origen) values
    (${mda.id}, 'esteban-jon', 'va', null, 'jugador'), (${mda.id}, 'sint-noe', 'no', 'trabajo', 'jugador'), (${mdl.id}, 'sint-noe', 'no', 'trabajo', 'jugador')`;
  await sql`insert into public.convocatorias (fecha, jornada, estado, origen, equipos) values (${J3}, 3, 'aprobada', 'propuesta', ${sql.json({ MdA: [{ person_id: 'esteban-jon' }, { person_id: 'sint-zoe' }], MdL: [{ person_id: 'sint-ari' }] })})`;
  // El Panel enseña el próximo domingo con partido (puede ser anterior a la J3): su convocatoria también.
  // (el Panel lee el calendario publicado, que no siempre coincide con las fechas movidas de la base de pruebas: todos los domingos próximos).
  for (let i = 0; i < 70; i++) {
    const f = new Date(Date.parse(`${hoy}T12:00:00Z`) + i * 86400000);
    const fecha = f.toISOString().slice(0, 10);
    if (f.getUTCDay() === 0 && fecha !== J3) await sql`insert into public.convocatorias (fecha, jornada, estado, origen, equipos) values (${fecha}, 2, 'aprobada', 'propuesta', ${sql.json({ MdA: [{ person_id: 'esteban-jon' }, { person_id: 'sint-zoe' }], MdL: [{ person_id: 'sint-ari' }] })})`;
  }
  await sql`update public.respuestas_web_config set encendido = true, encendido_desde = now() where id = 1`;

  const abrir = async (p, id) => { await p.getByTestId(id).click(); };
  const estado = (p, id) => p.getByTestId(id).getAttribute('aria-expanded');

  // ------------------------------------------------------------------ gestor, escritorio
  console.log('\n== Gestor: Respuestas del evento (escritorio)');
  const pg = await e.sesion('gestor@pruebas.local', 1280);
  await pg.goto(`${APP}/gestion/eventos/${ent.id}/respuestas`);
  ok(await visto(pg.getByTestId('contadores-va')), 'las cajas de arriba son botones');
  ok(await estado(pg, 'contadores-va') === 'false' && !(await pg.getByTestId('contadores-lista').count()), 'cerradas al entrar (aria-expanded=false, sin lista)');
  await abrir(pg, 'contadores-no');
  ok(await estado(pg, 'contadores-no') === 'true', '«no van» se abre (aria-expanded=true)');
  const lista = await pg.getByTestId('contadores-lista').innerText();
  ok(/Noe/.test(lista) && /Lesión/.test(lista) && /rodilla/.test(lista), 'gestor: nombre, motivo y detalle («Noe · Lesión · rodilla»)', lista);
  const cajaY = await pg.getByTestId('contadores-no').boundingBox(), listaY = await pg.getByTestId('contadores-lista').boundingBox();
  ok(listaY.y > cajaY.y + cajaY.height - 2, 'la lista se despliega debajo de las cajas, en línea', JSON.stringify([cajaY, listaY]));
  ok(new URL(pg.url()).pathname.endsWith('/respuestas'), 'sin salir de la página');
  await abrir(pg, 'contadores-va');
  ok(await estado(pg, 'contadores-va') === 'true' && await estado(pg, 'contadores-no') === 'false' && /Jon/.test(await pg.getByTestId('contadores-lista').innerText()), 'abrir otro cierra el anterior: «van» muestra a Jon');
  const enlaceJon = pg.getByTestId('contadores-lista').getByRole('link', { name: 'Jon' });
  ok((await enlaceJon.count()) === 1 && (await enlaceJon.getAttribute('href')).startsWith('/jugador/esteban-jon'), 'el nombre con estadísticas es un enlace a su ficha');
  await abrir(pg, 'contadores-duda');
  ok(!(await pg.getByTestId('contadores-lista').getByRole('link', { name: 'Zoe' }).count()) && /Zoe/.test(await pg.getByTestId('contadores-lista').innerText()), 'quien no tiene ficha de estadísticas, texto (nunca un enlace roto)');
  await abrir(pg, 'contadores-duda');
  ok(await estado(pg, 'contadores-duda') === 'false' && !(await pg.getByTestId('contadores-lista').count()), 'otro toque lo cierra');
  await abrir(pg, 'contadores-sin');
  ok(/Ari/.test(await pg.getByTestId('contadores-lista').innerText()), '«sin responder» lista a Ari');
  ok(await visto(pg.getByTestId('avisos-numeros-sin')), 'los «sin avisos activados» también son un contador');
  await pg.getByTestId('avisos-numeros-sin').click();
  ok(await visto(pg.getByTestId('avisos-numeros-lista')), '…y se despliega');
  ok((await pg.getByTestId('tabla-respuestas').getByRole('link', { name: 'Jon' }).count()) === 1, 'en la tabla, el nombre de Jon es un enlace');

  console.log('\n== Gestor: Eventos (la celda Respuestas) y Panel');
  await pg.goto(`${APP}/gestion/eventos`);
  const celda = pg.locator(`tr[data-evento] td[data-label=Respuestas]`).filter({ has: pg.locator(`[data-testid="respuestas-${ent.id}-no"]`) });
  await celda.getByTestId(`respuestas-${ent.id}-no`).click();
  ok(/Noe/.test(await celda.getByTestId(`respuestas-${ent.id}-lista`).innerText()) && /Lesión/.test(await celda.innerText()), 'Eventos: el desplegable se abre en la propia fila, con el motivo');
  ok((await celda.getByTestId('enlace-respuestas').count()) === 1 && (await celda.getByTestId('enlace-respuestas').getAttribute('href')).endsWith('/respuestas'), 'y se conserva el enlace a las respuestas del evento');
  await celda.getByTestId(`respuestas-${ent.id}-no`).click();
  ok(!(await celda.getByTestId(`respuestas-${ent.id}-lista`).count()), 'se cierra con otro toque');
  await pg.goto(`${APP}/gestion`);
  ok(await visto(pg.getByTestId('entreno-numeros-no')), 'Panel: el entreno del miércoles tiene sus contadores');
  await pg.getByTestId('entreno-numeros-duda').click();
  ok(/Zoe/.test(await pg.getByTestId('entreno-numeros-lista').innerText()), 'Panel: «dudan» lista a Zoe');
  // Con el interruptor encendido la tarjeta es una franja compacta (D139): «Faltan por entrar» y «Con avisos», desplegables.
  ok(await visto(pg.getByTestId('entrada-numeros-faltan')), 'Panel: «faltan por entrar» desplegable');
  await pg.getByTestId('entrada-numeros-faltan').click();
  ok(await visto(pg.getByTestId('entrada-numeros-lista')), '…con quien falta');
  ok(await visto(pg.getByTestId('avisos-numeros-con')) && await visto(pg.getByTestId('avisos-numeros-sin')), 'Panel: «con avisos» y «sin avisos» desplegables');
  await pg.getByTestId('avisos-numeros-sin').click();
  ok(await visto(pg.getByTestId('avisos-numeros-lista')), '…con los nombres de quien no los tiene');
  ok(await visto(pg.locator('[data-testid^="convocados-"][aria-expanded]')), 'Panel: los convocados del domingo, desplegables');
  await pg.locator('[data-testid^="convocados-"][aria-expanded]').first().click();
  ok(/Jon|Zoe|Ari/.test(await pg.locator('[data-testid^="convocados-"][data-testid$="-lista"]').first().innerText()), '…con sus nombres');

  console.log('\n== Gestor: Convocatoria');
  await pg.goto(`${APP}/gestion/convocatoria?fecha=${J3}`);
  const errVa = await pg.getByTestId('cv-contadores-van').waitFor({ state: 'visible', timeout: 10000 }).then(() => '', (x) => String(x).slice(0, 400));
  ok(errVa === '', 'cabecera: van / sin responder / no van son botones', errVa + ' | ' + await pg.getByTestId('cv-contadores-van').evaluate((b) => { const r = b.getBoundingClientRect(); const s = getComputedStyle(b); return JSON.stringify({ w: r.width, h: r.height, d: s.display, v: s.visibility, o: s.opacity, p: b.parentElement.className }); }).catch((x) => 'sin elemento'));
  await pg.getByTestId('cv-contadores-no').click();
  ok(/Noe/.test(await pg.getByTestId('cv-contadores-lista').innerText()), '«no van» lista a Noe…');
  ok(/trabajo/i.test(await pg.getByTestId('cv-contadores-lista').innerText()), '…con su motivo (solo gestores)');
  await pg.getByTestId('cv-contadores-no').click();
  ok(!(await pg.getByTestId('cv-contadores-lista').count()), 'y se cierra');
  const botonConv = pg.getByTestId('cv-convocados-MdA-convocados');
  ok(await visto(botonConv), 'cada equipo: «N convocados» es un botón');
  await botonConv.click();
  ok(/Jon/.test(await pg.getByTestId('cv-convocados-MdA-lista').innerText()), '…con los convocados');
  ok(await visto(pg.getByTestId('cv-casillas-MdA-bases')), 'y las casillas de bases / exteriores / interiores también');

  // ------------------------------------------------------------------ «← volver»
  console.log('\n== «← volver»: origen con filtro, jornada y pestaña');
  await pg.goto(`${APP}/gestion/eventos?f=pendientes`);
  await pg.locator('.ev-titulo a').first().click();
  await pg.waitForURL(/\/gestion\/eventos\/[0-9a-f-]{36}$/);
  const v1 = pg.getByTestId('volver');
  ok(await visto(v1.filter({ hasText: /← Eventos/i }), 15000), 'Evento: «← Eventos»', await pg.locator('[data-testid=volver]').evaluateAll((l) => l.map((x) => x.outerHTML).join(' | ')));
  await v1.click();
  await pg.waitForURL(/\/gestion\/eventos\?f=pendientes$/);
  ok(true, 'volver conserva el filtro (?f=pendientes)');
  await pg.goto(`${APP}/gestion/convocatoria?fecha=${J3}`);
  await pg.getByRole('link', { name: /Datos de los jugadores/ }).first().click();
  await pg.waitForURL(/\/convocatoria\/datos/);
  await pg.getByTestId('volver').first().click();
  await pg.waitForURL(new RegExp(`/gestion/convocatoria\\?fecha=${J3}`));
  ok(true, 'Datos → volver: la convocatoria de la misma jornada');
  await pg.goto(`${APP}/gestion`);
  await pg.getByTestId('enlace-respuestas').first().click();
  await pg.waitForURL(/\/respuestas$/);
  ok(await visto(pg.getByTestId('volver').filter({ hasText: /← Panel/i }), 15000), 'Respuestas desde el Panel: «← Panel» (el origen real, no «Evento»)', await pg.locator('[data-testid=volver]').evaluateAll((l) => l.map((x) => x.outerHTML).join(' | ')) + ' ' + await pg.evaluate(() => sessionStorage.getItem('maccabis.rastro')));
  await pg.goBack();
  ok(new URL(pg.url()).pathname === '/gestion', 'y el botón atrás del navegador vuelve al mismo sitio');

  console.log('\n== Todas las pantallas interiores llevan «← volver»');
  const urls = [
    '/gestion/eventos', '/gestion/convocatoria', '/gestion/convocatoria/datos', `/gestion/convocatoria/salida?fecha=${J3}`, '/gestion/tablero', '/gestion/scouting', '/gestion/liga',
    '/gestion/jugadores', '/gestion/ropa', '/gestion/asistencia', '/gestion/grupos', '/gestion/eventos/nuevo', '/gestion/eventos/importar', '/gestion/eventos/pistas',
    `/gestion/eventos/${ent.id}`, `/gestion/eventos/${ent.id}/respuestas`, '/jugador/esteban-jon', '/cuenta', '/avisos', '/mi-zona/ausencias', '/planes/nuevo',
  ];
  const sin = [];
  for (const u of urls) {
    await pg.goto(`${APP}${u}`);
    if (!(await visto(pg.getByTestId('volver'), 4000))) sin.push(u);
  }
  ok(sin.length === 0, 'cada pantalla interior de Gestión, la ficha, Mi cuenta y Avisos tienen «← volver»', sin.join(', '));

  // ------------------------------------------------------------------ jugador, móvil
  console.log('\n== Jugador (375 px): solo nombres, nunca motivos');
  const pj = await e.sesion('jon@pruebas.local', 375);
  await pj.goto(`${APP}/mi-zona/evento/${ent.id}`);
  ok(await visto(pj.getByTestId('quien-va-numeros-no')), '«Quién va»: van / dudan / no van son botones');
  ok(!(await pj.getByTestId('quien-va-numeros-sin').evaluate((n) => n.tagName === 'BUTTON')), '«sin responder» es una cifra, sin lista de nombres');
  await pj.getByTestId('quien-va-numeros-no').click();
  const lj = await pj.getByTestId('quien-va-numeros-lista').innerText();
  ok(/Noe/.test(lj) && !/Lesi|rodilla|trabajo/i.test(lj), 'jugador: «no van» da solo el nombre (Noe), sin motivo ni detalle', lj);
  ok(!/rodilla/.test(await pj.content()), 'ni el detalle en el HTML de la página');
  ok(await sinDesbordar(pj), '375 px sin desbordar (abierto)');
  const chicos = await pequenos(pj, '.num-boton');
  ok(chicos.length === 0, 'los botones de los contadores miden al menos 44 px', JSON.stringify(chicos));
  ok(/← /.test(await pj.getByTestId('volver').innerText()), 'y lleva «← volver»');
  await pj.goto(`${APP}/mi-zona/domingo/${J3}`);
  ok(await visto(pj.getByTestId('convocados-MdA-convocados')), 'Domingo: «N convocados» es un botón');
  await pj.getByTestId('convocados-MdA-convocados').click();
  const lc = await pj.getByTestId('convocados-MdA-lista').innerText();
  ok(/Jon/.test(lc) && /Zoe/.test(lc) && !/trabajo|Noe/.test(lc), 'con los convocados (solo nombres)', lc);
  ok(await sinDesbordar(pj), 'Domingo a 375 px sin desbordar');
  // Gestor a 375 px
  const pm = await e.sesion('gestor@pruebas.local', 375);
  await pm.goto(`${APP}/gestion/eventos/${ent.id}/respuestas`);
  await pm.getByTestId('contadores-no').click();
  const chicosM = await pequenos(pm, '.num-boton');
  ok(await sinDesbordar(pm) && chicosM.length === 0, 'Gestor a 375 px: respuestas con la lista abierta, sin desbordar y con zona táctil ≥ 44 px', JSON.stringify(chicosM));
  await pm.goto(`${APP}/gestion/convocatoria?fecha=${J3}`);
  await pm.getByTestId('cv-contadores-no').click();
  ok(await sinDesbordar(pm), 'Convocatoria a 375 px con un contador abierto: sin desbordar');
  await pm.goto(`${APP}/gestion`);
  ok(await sinDesbordar(pm), 'Panel a 375 px sin desbordar');

  console.log('\n== /entrar: la casilla del código acepta de 6 a 8 dígitos');
  const ctxC = await e.contexto(375);
  const pc = await e.nuevaPagina(ctxC);
  for (const largo of [6, 8]) {
    await pc.context().clearCookies();
    await pc.goto(`${APP}/entrar`);
    await pc.getByLabel('Tu correo').fill('jon@pruebas.local');
    await pc.getByRole('button', { name: 'Enviarme el código' }).click();
    await pc.getByText('Código enviado a').waitFor({ timeout: 10000 });
    const casilla = pc.getByLabel('Código del correo');
    const codigo = largo === 6 ? (await sql`select codigo from public._otp_pruebas where email = 'jon@pruebas.local'`)[0].codigo : '12345678';
    if (largo === 8) await sql`update public._otp_pruebas set codigo = ${codigo} where email = 'jon@pruebas.local'`;
    ok(await casilla.getAttribute('maxlength') === '8' && await casilla.getAttribute('minlength') === '6', 'la casilla admite de 6 a 8 dígitos (sin maxLength=6)');
    await casilla.fill(codigo);
    ok((await casilla.inputValue()) === codigo, `caben los ${largo} dígitos`);
    await pc.getByRole('button', { name: 'Entrar', exact: true }).click();
    await pc.waitForURL((u) => !u.pathname.startsWith('/entrar'), { timeout: 15000 }).catch(() => {});
    ok(!new URL(pc.url()).pathname.startsWith('/entrar'), `entra con un código de ${largo} dígitos`, pc.url());
  }
  await ctxC.close();

  ok(!e.errores.length, 'sin errores en la consola', e.errores.slice(0, 3).join(' | '));
} catch (err) {
  console.log(`  FALLO ${err.stack}`);
  sumar();
} finally {
  await e.parar();
}
console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK');
process.exit(fallos() ? 1 : 0);
