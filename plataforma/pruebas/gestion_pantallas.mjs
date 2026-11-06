#!/usr/bin/env node
// Gestión de la estructura nueva (bloques 4 y 5), de extremo a extremo: pila local, web compilada y Chrome. Jugadores
// SINTÉTICOS (D39), calendario y reloj de prueba (D185: «hoy» es el lunes 19/10/2026), sin avisos reales (pila local).
//   - /gestion a 360 y 390 px: las secciones 1 · Quién va esta semana, 2 · Convocatoria del domingo, 3 · Pendiente y
//     «Plantilla y club»; sin desbordar, nada tapado, objetivos de al menos 44 px, ningún «(D» seguido de número en el
//     HTML; enlaces a todas las pantallas de gestión (la barra de subsecciones ya no existe); «Copiar WhatsApp» a quien falta.
//   - Gestión › No convocados: la racha y el total salen de las convocatorias aprobadas, las respuestas y las fichas
//     (disponible y fuera = +1, convocado = 0, solo entreno y tardío no suman); el interruptor del desempate, apagado.
//   - Convocatoria: «Quién lleva más tiempo fuera», «Ocultar niveles» (en la URL), líneas con nivel y «dobla».
//   - Gestión › Jugadores: buscador (en la URL) y fila desplegable con los datos privados.
//   - Pedido de ropa: entra cerrado; un solo estado con su causa; el interruptor lo abre y lo cierra; invisible para el
//     jugador con el interruptor apagado (y se deja apagado al terminar).
//   - Barrera (h): jugador y anónimo sin acceso a niveles, motivos ni contador de no convocados.
//
//   npm run pruebas:gestion
import fs from 'node:fs';
import path from 'node:path';
import { preparar, personas, sinteticos, contador, visto, sinDesbordar, pequenos, trasAccion, hasta, REPO } from './comun_e2e.mjs';
import { conCapturas } from './infra/app.mjs';
import { hoyMadrid } from './fechas_prueba.mjs';

const SALIDA = path.join(REPO, 'privado', 'mockups_liga', 'rediseno', 'estructura_nueva');
if (conCapturas()) fs.mkdirSync(SALIDA, { recursive: true });
const foto = (p, n) => (conCapturas() ? p.screenshot({ path: path.join(SALIDA, `${n}.png`), fullPage: true }).catch(() => {}) : Promise.resolve());
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
  const yo = await personas(e.pila, { jugadores: [['sint-ana', 'ana@pruebas.local']], gestores: [['Gestor', 'gestor@pruebas.local']] });
  const [campana] = await sql`select id, estado from public.campanas_ropa order by creado_en limit 1`;

  // ---------------------------------------------------------------- /gestion
  for (const ancho of [360, 390]) {
    console.log(`\n== /gestion a ${ancho} px (gestor sin ficha)`);
    const p = await e.sesion('gestor@pruebas.local', ancho);
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
    if (ancho === 390) {
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
  ok(await hasta(async () => (await pg.locator('section.tarjeta li.fila-jugador[data-person]').count()) === 1) && /q=prueba/.test(pg.url()), 'buscar «prueba, teo»: una fila, y lo buscado en la URL', String(await pg.locator('section.tarjeta li.fila-jugador[data-person]').count()));
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
