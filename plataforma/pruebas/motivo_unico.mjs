#!/usr/bin/env node
// El motivo del «No voy» se elige UNA vez (04/11/2026, Guillermo): un entreno pasado el límite cuya duda el sistema pasó a
// «no va · no confirmó» (origen sistema) se corrige con una sola hoja de motivo en cada pantalla donde se responde.
//
//   npm run pruebas:motivo-unico
import { preparar, sinteticos, personas, contador } from './comun_e2e.mjs';
import { trasAccion } from './infra/esperas.mjs';

const { ok, fallos } = contador();
const e = await preparar({});
const { sql, APP } = e;
const madridDe = (ms) => { const f = new Date(Date.now() + ms).toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }); return { fecha: f.slice(0, 10), hora: f.slice(11, 16) }; };

try {
  await sinteticos(sql, [['sint-dos', 'Dos', true, true]]);
  await personas(e.pila, { jugadores: [['sint-dos', 'dos@pruebas.local']], gestores: [] });
  await sql`update public.respuestas_web_config set dudas_desde = now() - interval '30 days' where id = 1`;
  // Entreno que empieza dentro de 20 h: su límite (24 h antes) pasó hace 4 h.
  const pronto = madridDe(20 * 3600000);
  const [{ id }] = await sql`insert into public.eventos (clave, tipo, equipo, titulo, fecha, inicio, oficial) values ('x-entreno', 'entreno', 'ambos', 'x-entreno', ${pronto.fecha}, ${pronto.hora}, true) returning id`;
  const poner = () => sql`insert into public.respuestas (evento_id, person_id, respuesta, motivo, fuente, origen, puesto_por_nombre) values (${id}, 'sint-dos', 'no', 'no_confirmo', 'web', 'sistema', 'Sistema')
    on conflict (evento_id, person_id) do update set respuesta = 'no', motivo = 'no_confirmo', detalle = null, origen = 'sistema', puesto_por_nombre = 'Sistema'`;
  const estado = async () => (await sql`select respuesta, motivo, origen from public.respuestas where evento_id = ${id} and person_id = 'sint-dos'`)[0];

  console.log('\n== /mi-zona/evento/<id> (375 px)');
  await poner();
  const p = await e.sesion('dos@pruebas.local', 375);
  p.on('console', (m) => { if (m.type() === 'error') console.log('   [consola]', m.text().slice(0, 200)); });
  await p.goto(`${APP}/mi-zona/evento/${id}`);
  const hojas = () => p.locator('dialog[open]').count();
  const grupos = () => p.locator('dialog[open] fieldset.rw-motivos').count();
  ok(await hojas() === 0, 'al entrar no hay ninguna hoja abierta');
  const pantalla = await p.locator('.rw-vas').innerText();
  ok(pantalla.includes('pasó a «no va» porque no confirmaste a tiempo. Toca «No voy» para decir el motivo (una sola vez)') && !/te pedimos el motivo/.test(pantalla), 'con «no · no confirmó» la pantalla dice UNA vez qué hacer (no repite «te pedimos el motivo»)', pantalla);
  ok(await p.getByRole('button', { name: 'No voy', exact: true }).getAttribute('aria-pressed') === 'true' && await hojas() === 0, '«No voy» sale marcado (lo puso el sistema) y no hay selector de motivo a la vista');
  await p.getByRole('button', { name: 'No voy', exact: true }).click();
  ok(await hojas() === 1 && await grupos() === 1, 'al pulsar «No voy» se abre UNA hoja con UN selector de motivo', `${await hojas()} hojas, ${await grupos()} selectores`);
  await p.locator('dialog[open] label.rw-motivo', { hasText: 'Familia' }).click();
  await trasAccion(p, () => p.getByRole('button', { name: 'Guardar «no voy»' }).click());
  const est = await estado();
  ok(est.respuesta === 'no' && est.motivo === 'familia' && est.origen === 'jugador', 'una sola vez basta: queda «no · familia · jugador»', JSON.stringify(est));
  ok(await hojas() === 0, 'y la hoja no vuelve a abrirse', `${await hojas()} hojas abiertas`);
  ok(/No vas · Familia/.test(await p.locator('.rw-etiqueta').first().innerText()), 'la etiqueta dice «No vas · Familia»', await p.locator('.rw-etiqueta').first().innerText());
  ok(await p.getByTestId('paso-no-va').count() === 0, 'ya no sale el aviso «Tu duda pasó a no va»');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'sin desbordamiento horizontal a 375 px');
  await p.close();
} catch (err) {
  console.log(`  FALLO excepción -> ${err.stack ?? err}`);
  process.exitCode = 1;
} finally {
  await e.parar();
}
const n = fallos();
console.log(n || process.exitCode ? `\n${n} FALLO(S)` : '\nTodo OK');
process.exit(n || process.exitCode ? 1 : 0);
