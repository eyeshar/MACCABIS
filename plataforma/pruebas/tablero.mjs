#!/usr/bin/env node
// Tablero de asistencias y convocatoria (D121), de extremo a extremo: pila local, web compilada y Chrome.
//   - domingo: una linea por jugador con su estado en cada partido (Convocado / Convocar / no va / duda / sin ficha);
//     «Juegan (N) · M sin convocar»; convocar y quitar desde la casilla; doblaje marcado; los cuatro «Agrupar por» (que
//     no cambian la convocatoria y se recuerdan); acciones en grupo entre bloques; avisos recalculados; una aprobada que
//     se toca pasa a «cambiada»; «No van» con motivo; deshacer; registro de cambios;
//   - evento suelto: Van · Duda o sin responder · No van; cambiar respuestas guarda «puesta por», «No van» pide motivo,
//     funciona con el interruptor apagado;
//   - D153: ni el domingo ni el evento hablan de SportEasy (sin bloque de importacion ni «fase puente»);
//   - un jugador no accede (ni a la pantalla ni a la base); 375 y 1280 px.
//   - D159: el selector «Ver» trae TODOS los eventos de la temporada (futuros primero); «Van / Disponible» en la barra
//     (también el domingo) con motivo opcional; en la ficha del evento y en «Respuestas y motivos», cambiar a mano la
//     respuesta de cada invitado en un toque (va, duda, no va, sin responder; motivo opcional), «puesta por» el gestor;
//     la migración de gestor_responder es aditiva y su .revertir.sql la deshace limpia.
//
//   npm run pruebas:tablero
import { preparar, personas, sinteticos, contador, visto, sinDesbordar, foto } from './comun_e2e.mjs';
import { adelantar, semanas } from './fechas_prueba.mjs';
import { trasAccion, hasta } from './infra/esperas.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrar } from '../scripts/db.mjs';

const MIG = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations', '20261031190000_respuesta_a_mano');

const { ok, fallos, sumar } = contador();
const e = await preparar();
const { sql, APP } = e;
try {
  const F = await adelantar(sql, semanas('2026-10-25'));
  const J3 = F('2026-10-25');
  // Los datos privados (posicion, nivel) van en jugadores SINTETICOS (D39); Jon (real) solo para ver que un jugador no entra.
  await sinteticos(sql, [['sint-ana', 'Ana', true, true], ['sint-bea', 'Bea', true, true], ['sint-carla', 'Carla', true, false], ['sint-dani', 'Dani', true, true], ['sint-eva', 'Eva', true, true], ['sint-flor', 'Flor', true, true]]);
  const P = await personas(e.pila, { jugadores: [['esteban-jon', 'jon@pruebas.local']], gestores: [['Iván', 'ivan@pruebas.local', null]] });
  const id = async (clave) => (await sql`select id from public.eventos where clave = ${clave}`)[0].id;
  const mda = await id('mda-j3'), mdl = await id('mdl-j3');
  const resp = async (ev, pid, r, m = null) => sql`insert into public.respuestas (evento_id, person_id, respuesta, motivo) values (${ev}, ${pid}, ${r}, ${m}) on conflict (evento_id, person_id) do update set respuesta = excluded.respuesta, motivo = excluded.motivo`;
  await resp(mda, 'sint-ana', 'va'); await resp(mdl, 'sint-ana', 'va');
  await resp(mda, 'sint-bea', 'va'); await resp(mdl, 'sint-bea', 'no', 'horario');
  await resp(mda, 'sint-carla', 'va');
  await resp(mda, 'sint-dani', 'no', 'trabajo'); await resp(mdl, 'sint-dani', 'no', 'trabajo');
  await resp(mda, 'sint-eva', 'duda');
  await resp(mda, 'sint-flor', 'va'); await resp(mdl, 'sint-flor', 'va');
  await sql`insert into public.jugadores_privado (person_id, posicion, nivel, base_reserva) values
    ('sint-ana', 'base', 'A', false), ('sint-bea', 'pivot', 'B', false), ('sint-carla', 'escolta', 'C', true),
    ('sint-eva', 'alero', 'D', false), ('sint-flor', 'ala_pivot', 'B', false), ('sint-dani', 'alero', 'C', false)`;
  const conv = async () => (await sql`select estado, equipos, whatsapp_estado from public.convocatorias where fecha = ${J3}`)[0] ?? null;
  const enEq = (c, eq, pid) => (c?.equipos?.[eq] ?? []).some((x) => x.person_id === pid);

  console.log('\n== Un jugador no accede (pantalla y base)');
  const pj = await e.sesion('jon@pruebas.local', 375);
  await pj.goto(`${APP}/gestion/tablero?domingo=${J3}`);
  ok(new URL(pj.url()).pathname === '/', 'la pantalla le devuelve a su inicio', pj.url());
  const r = await fetch(`${e.pila.url}/rest/v1/rpc/tablero_responder`, { method: 'POST', headers: { apikey: e.pila.anonKey, authorization: `Bearer ${P['esteban-jon'].token}`, 'content-type': 'application/json' }, body: JSON.stringify({ p_evento: mda, p_personas: ['esteban-jon'], p_respuesta: 'no', p_motivo: 'otro' }) });
  ok(r.status >= 400 && /solo_gestores/.test(await r.text()), 'la base rechaza tablero_responder a un jugador');
  const reg = await (await fetch(`${e.pila.url}/rest/v1/tablero_registro?select=id`, { headers: { apikey: e.pila.anonKey, authorization: `Bearer ${P['esteban-jon'].token}` } })).json();
  ok(Array.isArray(reg) && reg.length === 0, 'y no lee el registro del tablero');
  const rm = await fetch(`${e.pila.url}/rest/v1/rpc/gestor_responder`, { method: 'POST', headers: { apikey: e.pila.anonKey, authorization: `Bearer ${P['esteban-jon'].token}`, 'content-type': 'application/json' }, body: JSON.stringify({ p_evento: mda, p_personas: ['esteban-jon'], p_respuesta: 'va' }) });
  ok(rm.status >= 400 && /solo_gestores/.test(await rm.text()), 'la base rechaza gestor_responder (respuestas a mano, D159) a un jugador');
  const ra = await fetch(`${e.pila.url}/rest/v1/rpc/gestor_responder`, { method: 'POST', headers: { apikey: e.pila.anonKey, 'content-type': 'application/json' }, body: JSON.stringify({ p_evento: mda, p_personas: ['esteban-jon'], p_respuesta: 'va' }) });
  ok(ra.status >= 400, 'y a anónimo', `HTTP ${ra.status}`);

  console.log('\n== Domingo de partidos (1280 px): una línea por jugador');
  const pg = await e.sesion('ivan@pruebas.local', 1280);
  await pg.goto(`${APP}/gestion/tablero?domingo=${J3}`);
  ok(await visto(pg.getByTestId('tabla-juegan')), 'tabla «Juegan»');
  ok(!(await pg.getByTestId('bloque-importacion').count()) && !/SportEasy|[Ff]ase puente/.test(await pg.locator('main').innerText()), 'domingo: sin bloque de importación ni nada de SportEasy (D153)');
  const personasEnPantalla = await pg.locator('[data-vista=domingo] tr[data-person]').evaluateAll((t) => t.map((x) => x.getAttribute('data-person')));
  ok(personasEnPantalla.length > 10 && new Set(personasEnPantalla).size === personasEnPantalla.length, `una línea por jugador (${personasEnPantalla.length}, sin repetidos entre «Juegan» y «No van»)`);
  const fila = (pid) => pg.locator(`tr[data-person="${pid}"]`);
  const celdaDe = (pid, eq) => fila(pid).locator(`td[data-label="${eq}"] .tb-celda`);
  ok((await celdaDe('sint-ana', 'MdA').innerText()) === 'Convocar' && (await celdaDe('sint-ana', 'MdL').innerText()) === 'Convocar', 'Ana (va a los dos): «Convocar» en los dos');
  ok((await celdaDe('sint-bea', 'MdL').innerText()) === 'No va' && await celdaDe('sint-bea', 'MdL').isDisabled(), 'Bea: «No va» en el MdL (apagada, sin acción)');
  ok((await celdaDe('sint-carla', 'MdL').innerText()) === 'Sin ficha', 'Carla: «Sin ficha» en el MdL');
  ok((await celdaDe('sint-eva', 'MdA').innerText()) === 'Duda' && (await fila('sint-eva').locator('td[data-label="Duda o sin responder"]').innerText()) === 'Duda', 'Eva: «Duda» en la casilla y la marca «Duda o sin responder»');
  const novan = pg.getByTestId('tabla-novan');
  ok(await visto(novan.locator('tr[data-person="sint-dani"]')) && /Trabajo/.test(await novan.locator('tr[data-person="sint-dani"]').innerText()), '«No van»: Dani, con su motivo (solo gestores)');
  ok(!(await pg.locator('thead th', { hasText: 'Sin convocar' }).count()), 'no hay columna «Sin convocar»');
  const nJ = Number(await pg.getByTestId('n-juegan').innerText()), nS0 = Number(await pg.getByTestId('n-sin-convocar').innerText());
  ok(nJ === personasEnPantalla.length - (await novan.locator('tr[data-person]').count()) && nS0 === nJ, `cabecera «Juegan (${nJ}) · ${nS0} sin convocar»`);
  ok((await pg.locator('[data-bloque] .tb-bloque').allInnerTexts()).some((t) => /^bases/i.test(t)) && await visto(fila('sint-carla').getByText('base de reserva')), 'agrupado por posición (por defecto): Bases · Exteriores · Interiores; el base de reserva va en Exteriores con su marca');
  ok((await pg.locator('tbody[data-bloque="exterior"] tr[data-person="sint-carla"]').count()) === 1, 'Carla (escolta, base de reserva) en Exteriores');

  console.log('\n== Selector «Ver»: todos los eventos de la temporada, los futuros primero (D159)');
  const hoyS = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  const evs = await sql`select id, fecha::text, tipo, estado from public.eventos where temporada = '2026-27' and oficial and borrado_en is null order by fecha, inicio nulls last`;
  const opts = await pg.locator('#tb-ver option').evaluateAll((o) => o.map((x) => ({ v: x.value, g: x.parentElement.getAttribute('label') })));
  const optEv = opts.filter((o) => o.v.startsWith('evento:'));
  ok(optEv.length === evs.length && evs.every((x) => optEv.some((o) => o.v === `evento:${x.id}`)), `«Ver» trae los ${evs.length} eventos oficiales de la temporada (antes, solo los de las 5 semanas siguientes)`, `${optEv.length} en el selector`);
  const lejano = evs.filter((x) => x.fecha > new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10)).at(-1);
  ok(!lejano || optEv.some((o) => o.v === `evento:${lejano.id}`), 'incluye los de más de cinco semanas', lejano?.fecha);
  const domFut = [...new Set(evs.filter((x) => x.tipo === 'liga' && x.estado === 'programado').map((x) => x.fecha))];
  ok(opts.filter((o) => o.v.startsWith('domingo:')).length === domFut.length, `y los ${domFut.length} domingos de partidos (futuros y ya jugados)`);
  const grupos = [...new Set(opts.map((o) => o.g))];
  ok(grupos[0] === 'Próximos domingos de partidos' && grupos.indexOf('Próximos eventos') < (grupos.includes('Eventos pasados') ? grupos.indexOf('Eventos pasados') : 99), 'los futuros primero (Próximos domingos · Próximos eventos), después los pasados', grupos.join(' | '));
  const fechaDe = (o) => evs.find((x) => `evento:${x.id}` === o.v).fecha;
  const fechasFut = optEv.filter((o) => o.g === 'Próximos eventos').map(fechaDe);
  ok(fechasFut.every((f, i) => i === 0 || fechasFut[i - 1] <= f) && fechasFut.every((f) => f >= hoyS), 'los próximos, del más cercano al más lejano');
  const fechasPas = optEv.filter((o) => o.g === 'Eventos pasados').map(fechaDe);
  ok(fechasPas.every((f, i) => i === 0 || fechasPas[i - 1] >= f) && fechasPas.every((f) => f < hoyS), `los pasados (${fechasPas.length}), del más reciente al más antiguo`);

  console.log('\n== Convocar y quitar desde la casilla; doblaje marcado');
  await trasAccion(pg, () => celdaDe('sint-ana', 'MdA').click());
  let c = await conv();
  ok(enEq(c, 'MdA', 'sint-ana') && (await celdaDe('sint-ana', 'MdA').innerText()) === 'Convocado', 'tocar «Convocar»: convocado al MdA (guardado)');
  ok(Number(await pg.getByTestId('n-sin-convocar').innerText()) === nS0 - 1, 'el contador de sin convocar baja');
  const cambios = await sql`select accion, motivo, nota, detalle from public.convocatoria_cambios order by en`;
  ok(cambios.some((x) => x.accion === 'anadir' && x.motivo === 'otro' && x.nota === 'ajuste manual'), 'el cambio queda con su motivo («ajuste manual», D107)', JSON.stringify(cambios));
  await trasAccion(pg, () => celdaDe('sint-ana', 'MdL').click());
  ok(enEq(await conv(), 'MdL', 'sint-ana') && await visto(fila('sint-ana').getByText('dobla')), 'convocado en los dos: «dobla»');
  await trasAccion(pg, () => celdaDe('sint-ana', 'MdL').click());
  ok(!enEq(await conv(), 'MdL', 'sint-ana') && (await celdaDe('sint-ana', 'MdL').innerText()) === 'Convocar', 'tocar «Convocado» lo quita');

  console.log('\n== Agrupar por: cambia solo cómo se ve (y se recuerda)');
  const antes = JSON.stringify((await conv()).equipos);
  const bloques = async () => (await pg.locator('[data-testid=tabla-juegan] tbody[data-bloque]').evaluateAll((b) => b.map((x) => x.getAttribute('data-bloque'))));
  await pg.getByRole('button', { name: 'Equipo', exact: true }).click();
  const be = await bloques();
  ok(be.includes('mda') && be.includes('sin') && !be.includes('dos') && !be.includes('mdl'), 'Equipo: «Convocados al MdA» y «Sin convocar o en duda» (sin bloques vacíos)', be.join(','));
  await pg.getByRole('button', { name: 'Nombre', exact: true }).click();
  const nombres = await pg.locator('[data-testid=tabla-juegan] tr[data-person] .tb-jugador b').allInnerTexts();
  ok((await bloques()).length === 1 && JSON.stringify(nombres) === JSON.stringify([...nombres].sort((a, b) => a.localeCompare(b, 'es'))), 'Nombre: alfabético');
  await pg.getByRole('button', { name: 'Nivel', exact: true }).click();
  ok((await bloques()).includes('A') && (await bloques()).includes('sin'), 'Nivel: de A a E (solo gestores)');
  ok(JSON.stringify((await conv()).equipos) === antes, 'agrupar no toca la convocatoria');
  await pg.reload();
  // Lo recordado se lee del navegador al cargar: se espera a que la pagina lo aplique (antes se miraba al instante y fallaba a veces).
  const recordado = await pg.waitForFunction(() => [...document.querySelectorAll('button')].some((x) => x.textContent.trim() === 'Nivel' && x.getAttribute('aria-pressed') === 'true'), null, { timeout: 8000 }).then(() => true, () => false);
  ok(recordado, 'se recuerda en este navegador');
  await pg.getByRole('button', { name: 'Posición', exact: true }).click();

  console.log('\n== Acciones en grupo entre bloques y avisos recalculados');
  await fila('sint-bea').locator('input[type=checkbox]').check();
  await fila('sint-carla').locator('input[type=checkbox]').check();
  await fila('sint-flor').locator('input[type=checkbox]').check();
  ok(await visto(pg.getByTestId('barra-acciones')) && /3/.test(await pg.getByTestId('barra-acciones').locator('.tb-n').innerText()), 'barra fija con la selección (3, de Interiores y Exteriores)');
  await foto(pg, 'tablero_domingo_posicion_seleccion_1280', false);
  await trasAccion(pg, () => pg.getByTestId('barra-acciones').getByRole('button', { name: 'Al MdA' }).click());
  c = await conv();
  ok(['sint-bea', 'sint-carla', 'sint-flor'].every((p) => enEq(c, 'MdA', p)), '«Al MdA»: los tres convocados');
  const resMdA = await pg.getByTestId('resumen-MdA').innerText();
  ok(/4 convocados/.test(resMdA) && /mínimo es 7/.test(resMdA), 'resumen del MdA recalculado: 4 convocados y el aviso del mínimo', resMdA);
  ok(/1 base/.test(resMdA) && /reserva|ext\./.test(resMdA), 'con sus líneas (bases, exteriores, interiores)');
  await fila('sint-eva').locator('input[type=checkbox]').check();
  await trasAccion(pg, () => pg.getByTestId('barra-acciones').getByRole('button', { name: 'Al MdA' }).click());
  ok(!enEq(await conv(), 'MdA', 'sint-eva') && /disponible/.test(await pg.getByTestId('tb-mensaje').innerText()), '«Al MdA» solo afecta a quien está disponible (Eva tiene «duda»)');
  await pg.getByTestId('barra-acciones').getByRole('button', { name: 'Quitar selección' }).click();
  ok(await visto(pg.getByTestId('registro-cambios').getByText(/Convocar \(MdA\): /)), 'registro de cambios: quién, a quién, cuándo');

  console.log('\n== Deshacer (un nivel) y una aprobada que se toca pasa a «cambiada»');
  await trasAccion(pg, () => celdaDe('sint-ana', 'MdL').click());
  await trasAccion(pg, () => pg.getByTestId('tb-mensaje').getByRole('button', { name: 'Deshacer' }).click());
  ok(!enEq(await conv(), 'MdL', 'sint-ana'), '«Deshacer» devuelve la convocatoria como estaba');
  await sql`update public.convocatorias set estado = 'aprobada', aprobada_en = now() - interval '1 minute', aprobada_por_nombre = 'Iván', whatsapp_estado = 'al_dia', whatsapp_base = equipos where fecha = ${J3}`;
  await pg.reload();
  ok((await pg.getByTestId('estado-convocatoria').innerText()) === 'Aprobada', 'convocatoria «Aprobada»');
  await trasAccion(pg, () => celdaDe('sint-ana', 'MdL').click());
  c = await conv();
  await pg.reload();
  ok(c.whatsapp_estado === 'pendiente' && /cambiada/.test(await pg.getByTestId('estado-convocatoria').innerText()), 'tocarla: «Aprobada · cambiada» y sus salidas pendientes (como hoy)');

  console.log('\n== «No van» en el domingo, con un motivo para el grupo');
  await fila('sint-eva').locator('input[type=checkbox]').check();
  await pg.getByTestId('barra-acciones').getByRole('button', { name: 'No van' }).click();
  ok(await pg.getByRole('button', { name: 'Guardar «No van»' }).isDisabled(), 'pide un motivo de la lista (sin diálogos del navegador)');
  await pg.getByTestId('barra-acciones').locator('label', { hasText: 'Familia' }).click();
  await trasAccion(pg, () => pg.getByRole('button', { name: 'Guardar «No van»' }).click());
  const edu = await sql`select e.equipo, r.respuesta, r.motivo, r.origen, r.puesto_por_nombre from public.respuestas r join public.eventos e on e.id = r.evento_id where r.person_id = 'sint-eva' and e.fecha = ${J3}`;
  ok(edu.length === 2 && edu.every((x) => x.respuesta === 'no' && x.motivo === 'familia' && x.origen === 'gestor' && x.puesto_por_nombre === 'Iván'), 'Eva: «no · familia» en los dos partidos, puesta por Iván (con el interruptor apagado)', JSON.stringify(edu));
  await pg.reload();
  ok(await visto(pg.getByTestId('tabla-novan').locator('tr[data-person="sint-eva"]')), 'y pasa al bloque «No van»');

  console.log('\n== «Van / Disponible» en el domingo, con motivo opcional (D159)');
  await pg.getByTestId('tabla-novan').locator('tr[data-person="sint-eva"] input[type=checkbox]').check();
  await pg.getByTestId('barra-acciones').getByRole('button', { name: 'Van / Disponible' }).click();
  await pg.getByTestId('barra-acciones').getByLabel('Motivo (opcional)').fill('me lo dijo por WhatsApp');
  await trasAccion(pg, () => pg.getByRole('button', { name: 'Guardar «Van»' }).click());
  const evaVa = await sql`select r.respuesta, r.motivo, r.detalle, r.origen, r.puesto_por_nombre from public.respuestas r join public.eventos e on e.id = r.evento_id where r.person_id = 'sint-eva' and e.fecha = ${J3}`;
  ok(evaVa.length === 2 && evaVa.every((x) => x.respuesta === 'va' && x.motivo === null && x.detalle === 'me lo dijo por WhatsApp' && x.origen === 'gestor' && x.puesto_por_nombre === 'Iván'), 'Eva: «va» en sus dos partidos, con el motivo opcional y puesta por Iván', JSON.stringify(evaVa));
  await pg.reload();
  ok(await visto(pg.getByTestId('tabla-juegan').locator('tr[data-person="sint-eva"]')) && await visto(pg.getByTestId('registro-cambios').getByText(/Van: Eva \(me lo dijo por WhatsApp\)/)), 'vuelve a «Juegan» y el registro dice quién y por qué');
  await pg.getByTestId('tabla-juegan').locator('tr[data-person="sint-eva"] input[type=checkbox]').check();
  await pg.getByTestId('barra-acciones').getByRole('button', { name: 'Van / Disponible' }).click();
  ok(!(await pg.getByRole('button', { name: 'Guardar «Van»' }).isDisabled()), 'sin motivo también se puede guardar');
  await pg.getByTestId('barra-acciones').getByRole('button', { name: 'Cancelar' }).click();
  await pg.getByTestId('barra-acciones').getByRole('button', { name: 'Quitar selección' }).click();
  await pg.evaluate(() => window.scrollTo(0, 0));

  console.log('\n== 375 px: la tabla se desplaza dentro de su caja, con el jugador fijo');
  const p375 = await e.nuevaPagina(await e.contexto(375));
  await p375.context().addCookies(await pg.context().cookies());
  await p375.goto(`${APP}/gestion/tablero?domingo=${J3}`);
  await p375.locator('tr[data-person="sint-flor"] input[type=checkbox]').check();
  const caja = await p375.getByTestId('tabla-juegan').evaluate((x) => ({ sw: x.scrollWidth, cw: x.clientWidth, fija: getComputedStyle(x.querySelector('.tb-fijo')).position }));
  ok(await sinDesbordar(p375) && caja.sw > caja.cw && caja.fija === 'sticky', 'sin desbordar la página; desplazamiento horizontal dentro de la caja y la columna del jugador fija', JSON.stringify(caja));
  await foto(p375, 'tablero_domingo_posicion_seleccion_375');
  ok(await sinDesbordar(pg), '1280 px sin desbordamiento');

  console.log('\n== Evento suelto (entreno): Van · Duda o sin responder · No van');
  const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  const [ent] = await sql`select id, fecha::text from public.eventos where tipo = 'entreno' and estado = 'programado' and fecha > ${hoy} order by fecha limit 1`;
  await resp(ent.id, 'sint-ana', 'va');
  await pg.goto(`${APP}/gestion/tablero?evento=${ent.id}`);
  const colVa = pg.getByTestId('columna-va'), colDuda = pg.getByTestId('columna-duda'), colNo = pg.getByTestId('columna-no');
  await colVa.waitFor({ timeout: 15000 }).catch(() => {});
  ok(!(await pg.getByTestId('bloque-importacion').count()) && !/SportEasy|[Ff]ase puente/.test(await pg.locator('main').innerText()), 'evento: sin «fase puente» ni nada de SportEasy (D153)');
  ok(await visto(colVa.locator('[data-person="sint-ana"]')) && (await colDuda.locator('[data-person]').count()) > 5, 'tres columnas con su número; Ana en «Van», los sin responder en «Duda o sin responder»');
  await colDuda.locator('[data-person="sint-bea"] input').check();
  await colDuda.locator('[data-person="sint-flor"] input').check();
  await pg.getByTestId('barra-acciones').getByRole('button', { name: 'Van / Disponible' }).click();
  await trasAccion(pg, () => pg.getByRole('button', { name: 'Guardar «Van»' }).click());
  const rv = await sql`select person_id, respuesta, origen, puesto_por_nombre, cambiado_en from public.respuestas where evento_id = ${ent.id} and person_id in ('sint-bea', 'sint-flor')`;
  ok(rv.length === 2 && rv.every((x) => x.respuesta === 'va' && x.origen === 'gestor' && x.puesto_por_nombre === 'Iván' && x.cambiado_en), '«Van»: guardado como «puesta por Iván», con fecha y hora (interruptor apagado)');
  await pg.reload();
  ok(await visto(colVa.locator('[data-person="sint-bea"]').getByText('puesta por Iván')), 'y se ve «puesta por Iván»');
  await colVa.locator('[data-person="sint-bea"] input').check();
  await pg.getByTestId('barra-acciones').getByRole('button', { name: 'No van' }).click();
  await pg.getByTestId('barra-acciones').locator('label', { hasText: 'Viaje' }).click();
  await trasAccion(pg, () => pg.getByRole('button', { name: 'Guardar «No van»' }).click());
  ok((await sql`select respuesta, motivo from public.respuestas where evento_id = ${ent.id} and person_id = 'sint-bea'`)[0].motivo === 'viaje', '«No van» con su motivo (viaje)');
  await trasAccion(pg, () => pg.getByTestId('tb-mensaje').getByRole('button', { name: 'Deshacer' }).click());
  ok((await sql`select respuesta from public.respuestas where evento_id = ${ent.id} and person_id = 'sint-bea'`)[0].respuesta === 'va', '«Deshacer» la deja como estaba («va»)');
  await pg.reload();
  await foto(pg, 'tablero_entreno_1280');
  const pe375 = await e.nuevaPagina(await e.contexto(375));
  await pe375.context().addCookies(await pg.context().cookies());
  await pe375.goto(`${APP}/gestion/tablero?evento=${ent.id}`);
  ok(await visto(pe375.getByRole('tab', { name: /Van/ })) && await sinDesbordar(pe375), 'móvil: pestañas grandes con el número, sin desbordamiento');
  await pe375.getByRole('tab', { name: /No van/ }).click();
  ok(await pe375.getByTestId('columna-no').isVisible() && !(await pe375.getByTestId('columna-va').isVisible()), 'cada pestaña muestra su lista');
  await foto(pe375, 'tablero_entreno_375');

  console.log('\n== Cambiar a mano la respuesta de cada invitado, en un toque (D159)');
  const rDani = async () => (await sql`select respuesta, motivo, origen, puesto_por_nombre from public.respuestas where evento_id = ${ent.id} and person_id = 'sint-dani'`)[0] ?? null;
  await pg.goto(`${APP}/gestion/eventos/${ent.id}/respuestas`);
  const manoDani = pg.locator('[data-testid=cambiar-a-mano][data-person="sint-dani"]');
  ok(await visto(manoDani) && (await manoDani.getAttribute('data-valor')) === ((await rDani())?.respuesta ?? 'sin_responder'), '«Respuestas y motivos»: cada invitado con sus cuatro botones (va, duda, no va, sin responder) y el actual marcado');
  await trasAccion(pg, () => manoDani.getByRole('button', { name: /^No va ·/ }).click());
  let d = await rDani();
  ok(d?.respuesta === 'no' && d.motivo === null && d.origen === 'gestor' && d.puesto_por_nombre === 'Iván', 'un toque en «No va»: guardado sin motivo (opcional), puesto por Iván (interruptor apagado)', JSON.stringify(d));
  await trasAccion(pg, () => manoDani.getByLabel(/^Por qué no va \(opcional\)/).selectOption('lesion'));
  d = await rDani();
  ok(d?.respuesta === 'no' && d.motivo === 'lesion', 'el motivo opcional se guarda al elegirlo (lesión)', JSON.stringify(d));
  await trasAccion(pg, () => manoDani.getByRole('button', { name: /^Sin resp\. ·/ }).click());
  ok((await rDani())?.respuesta === 'sin_responder', '«Sin resp.» lo deja sin responder');
  const regMano = await sql`select por_nombre, despues, motivo from public.tablero_registro where evento_id = ${ent.id} and 'sint-dani' = any(personas) order by en`;
  ok(regMano.length >= 3 && regMano.at(-1).despues === 'sin_responder' && regMano.some((x) => x.motivo === 'lesion') && regMano.every((x) => x.por_nombre === 'Iván'), 'cada cambio queda en el registro del tablero (quién, qué), y se puede deshacer allí', JSON.stringify(regMano));
  await pg.goto(`${APP}/gestion/eventos/${ent.id}`);
  const fichaMano = pg.getByTestId('respuestas-a-mano');
  ok(await visto(fichaMano) && (await fichaMano.locator('[data-testid=cambiar-a-mano]').count()) > 5, 'la ficha del evento también: «Respuestas · cambiar a mano» con todos los invitados');
  await trasAccion(pg, () => fichaMano.locator('[data-testid=cambiar-a-mano][data-person="sint-dani"]').getByRole('button', { name: /^Va ·/ }).click());
  d = await rDani();
  ok(d?.respuesta === 'va' && d.origen === 'gestor' && d.puesto_por_nombre === 'Iván', 'un toque en «Va» desde la ficha: guardado, puesto por Iván');
  ok(await sinDesbordar(pg), 'ficha a 1280 px sin desbordamiento');
  const pf375 = await e.nuevaPagina(await e.contexto(375));
  await pf375.context().addCookies(await pg.context().cookies());
  await pf375.goto(`${APP}/gestion/eventos/${ent.id}`);
  const b375 = await pf375.getByTestId('respuestas-a-mano').locator('[data-testid=cambiar-a-mano][data-person="sint-dani"] button').first().boundingBox();
  ok(await sinDesbordar(pf375) && b375 && b375.height >= 44, 'móvil (375 px): sin desbordar y botones de 44 px', JSON.stringify(b375));
  await foto(pf375, 'evento_respuestas_a_mano_375');
  await pf375.goto(`${APP}/gestion/eventos/${ent.id}/respuestas`);
  ok(await sinDesbordar(pf375), '«Respuestas y motivos» a 375 px sin desbordar');
  await pg.goto(`${APP}/gestion/eventos/${mda}/respuestas`);
  const manoAna = pg.locator('[data-testid=cambiar-a-mano][data-person="sint-ana"]');
  ok((await manoAna.count()) === 2 && /MdA/i.test((await manoAna.allInnerTexts()).join(' ')) && /MdL/i.test((await manoAna.allInnerTexts()).join(' ')), 'vista del domingo: un juego de botones por partido (MdA y MdL), con su etiqueta');

  console.log('\n== Arrastrar y soltar (escritorio; nunca la única forma)');
  await pg.goto(`${APP}/gestion/tablero?domingo=${J3}`);
  const antesA = enEq(await conv(), 'MdL', 'sint-flor');
  // Arrastre HTML5 con un DataTransfer de verdad (los mismos eventos que el raton: dragstart, dragover y drop).
  await trasAccion(pg, () => pg.evaluate(() => { const dt = new DataTransfer(); const de = document.querySelector('tr[data-person="sint-flor"]'); const a = document.querySelector('[data-testid="resumen-MdL"]'); de.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt })); a.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt })); a.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt })); }));
  ok(!antesA && enEq(await conv(), 'MdL', 'sint-flor'), 'arrastrar a Flor al resumen del MdL lo convoca al MdL');
  ok(!e.errores.length, 'sin errores de consola', e.errores.slice(0, 5).join(' | '));

  console.log('\n== Migración de gestor_responder: aditiva y reversible (D111)');
  const texto = fs.readFileSync(`${MIG}.sql`, 'utf8').replace(/--.*$/gm, '');
  ok(fs.existsSync(`${MIG}.revertir.sql`) && !/\bdrop\b|\btruncate\b|\bdelete\s+from\b|\bupdate\s+public\b|alter\s+table|create\s+or\s+replace/i.test(texto), 'solo crea una función nueva (sin DROP, DELETE, UPDATE, ALTER ni reemplazar nada) y tiene su .revertir.sql');
  const fn = async () => (await sql`select to_regprocedure('public.gestor_responder(uuid, text[], text, text, text)') is not null f, (select count(*)::int from supabase_migrations.schema_migrations where version = '20261031190000') v`)[0];
  ok((await fn()).f && (await fn()).v === 1, 'aplicada y registrada');
  await sql.begin((tx) => tx.unsafe(fs.readFileSync(`${MIG}.revertir.sql`, 'utf8')));
  const tras = await fn();
  ok(!tras.f && tras.v === 0 && (await sql`select count(*)::int n from public.respuestas where person_id = 'sint-dani'`)[0].n > 0, 'revertir: quita la función y su registro, sin tocar las respuestas', JSON.stringify(tras));
  await migrar(sql, { log: () => {} });
  ok((await fn()).f && (await fn()).v === 1, 'y se vuelve a aplicar limpia');
} catch (err) { console.error(err); sumar(); } finally {
  await e.parar();
}
console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK');
process.exit(fallos() ? 1 : 0);
