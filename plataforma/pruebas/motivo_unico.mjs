#!/usr/bin/env node
// El motivo del «No voy» se elige UNA vez (04/11/2026, Guillermo). Estado «no · no_confirmo · sistema» (el cierre de las dudas
// pasó su «duda» a «no va»): en cada pantalla a la que lleva el aviso «Tu duda ha pasado a «no va»» (su url sale de la tarea
// de avisos de verdad) y en el inicio, a 375 px:
//   - «Voy» y «No voy» SIN marcar (el «no» lo puso el sistema, no el jugador) y la pastilla dice «No vas · no confirmaste a tiempo»;
//   - UN solo texto («Elige «No voy» para decir el motivo (una sola vez)…») y nada de «te pedimos el motivo»;
//   - al pulsar «No voy», UNA hoja con UN selector; con el motivo elegido se guarda a la primera, la hoja no vuelve y el texto se va.
//
//   npm run pruebas:motivo-unico
import crypto from 'node:crypto';
import webpush from 'web-push';
import { preparar, sinteticos, personas, contador } from './comun_e2e.mjs';
import { firmar } from './pila.mjs';
import { trasAccion, hasta } from './infra/esperas.mjs';
import { ahoraPrueba } from './infra/reloj.mjs';

const { ok, fallos } = contador();
const vapid = webpush.generateVAPIDKeys();
const secreto = crypto.randomBytes(32).toString('hex');
const servicio = await firmar({ role: 'service_role', iss: 'supabase-local' }, 3600 * 24);
const e = await preparar({
  envExtra: {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey, VAPID_SUBJECT: 'mailto:pruebas@maccabis.invalid',
    SUPABASE_SERVICE_ROLE_KEY: servicio, AVISOS_SECRETO: secreto, NODE_TLS_REJECT_UNAUTHORIZED: '0',
  },
});
const { sql, APP } = e;
const madridDe = (ms) => { const f = new Date(ahoraPrueba().getTime() + ms).toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }); return { fecha: f.slice(0, 10), hora: f.slice(11, 16) }; };
const TEXTO = 'Tu «duda» pasó a «no va» porque no confirmaste a tiempo. Elige «No voy» para decir el motivo (una sola vez) o «Voy» si al final puedes.';

try {
  await sinteticos(sql, [['sint-dos', 'Dos', true, true], ['sint-tres', 'Tres', true, true], ['sint-cuatro', 'Cuatro', false, true]]);
  await personas(e.pila, { jugadores: [['sint-dos', 'dos@pruebas.local'], ['sint-tres', 'tres@pruebas.local'], ['sint-cuatro', 'cuatro@pruebas.local']], gestores: [] });
  await sql`update public.respuestas_web_config set dudas_desde = pruebas.ahora() - interval '30 days' where id = 1`;
  // Un entreno que empieza dentro de 20 h (su límite pasó hace 4 h) y el próximo domingo de liga del calendario.
  const pronto = madridDe(20 * 3600000);
  const [{ id: ENT }] = await sql`insert into public.eventos (clave, tipo, equipo, titulo, fecha, inicio, oficial) values ('x-entreno', 'entreno', 'ambos', 'x-entreno', ${pronto.fecha}, ${pronto.hora}, true) returning id`;
  const hoy = madridDe(0).fecha;
  const [dom] = await sql`select fecha::text f from public.eventos where tipo = 'liga' and estado = 'programado' and oficial and fecha > ${hoy} order by fecha limit 1`;
  const [{ id: MDA }] = await sql`insert into public.eventos (clave, tipo, equipo, rival, titulo, fecha, inicio, oficial, jornada) values ('x-mda', 'liga', 'MdA', 'Rival', 'x-mda', ${dom.f}, '09:00', true, 9) returning id`;
  const liga = await sql`select id, equipo from public.eventos where tipo = 'liga' and estado = 'programado' and fecha = ${dom.f}`;
  const MDL = liga.find((l) => l.equipo === 'MdL').id;
  const poner = (ev, p) => sql`insert into public.respuestas (evento_id, person_id, respuesta, motivo, fuente, origen, puesto_por_nombre, cambiado_en) values (${ev}, ${p}, 'no', 'no_confirmo', 'web', 'sistema', 'Sistema', pruebas.ahora())
    on conflict (evento_id, person_id) do update set respuesta = 'no', motivo = 'no_confirmo', detalle = null, origen = 'sistema', puesto_por_nombre = 'Sistema', cambiado_en = pruebas.ahora()`;
  const motivos = async (evs, p) => (await sql`select respuesta, motivo, origen from public.respuestas where person_id = ${p} and evento_id = any(${evs})`);
  // Dos: solo el entreno. Tres: solo el domingo (todos sus partidos). Cuatro: las dos cosas.
  await poner(ENT, 'sint-dos');
  for (const l of liga) await poner(l.id, 'sint-tres');
  await poner(ENT, 'sint-cuatro');
  await poner(MDL, 'sint-cuatro');

  console.log('\n== A qué pantalla lleva el aviso «Tu duda ha pasado a no va»');
  const t = await fetch(`${APP}/api/avisos/tarea`, { method: 'POST', headers: { authorization: `Bearer ${secreto}` } });
  ok(t.status === 200, 'la tarea de avisos corre', JSON.stringify(await t.clone().json()));
  const urls = Object.fromEntries((await sql`select person_id, url from public.avisos_registro where clave like 'rec:paso:%'`).map((x) => [x.person_id, x.url]));
  ok(urls['sint-dos'] === `/mi-zona/evento/${ENT}`, 'un solo entreno: /mi-zona/evento/<id>', JSON.stringify(urls));
  ok(urls['sint-tres'] === `/mi-zona/domingo/${dom.f}`, 'los dos partidos de un domingo: /mi-zona/domingo/<fecha>', JSON.stringify(urls));
  ok(urls['sint-cuatro'] === `/mi-zona/evento/${MDL}`, 'un solo partido: /mi-zona/evento/<id> (la pantalla del evento responde también a un partido)', JSON.stringify(urls));

  // Lo común a las tres pantallas.
  const aclarar = async (p, que, ev) => {
    const vas = p.locator('.rw-vas, [data-testid="responder-proximo"]').first();
    const pulsados = await vas.locator('button[aria-pressed="true"]').count();
    ok(pulsados === 0, `${que}: «Voy» y «No voy» sin marcar (el «no» lo puso el sistema)`, `${pulsados} marcados`);
    ok(await p.getByTestId('paso-no-va').count() === 1 && (await p.getByTestId('paso-no-va').innerText()) === TEXTO, `${que}: un solo texto, el mismo`, await p.getByTestId('paso-no-va').allInnerTexts().then((x) => x.join(' | ')));
    ok(!/te pedimos el motivo/.test(await p.locator('main').innerText()), `${que}: sin «te pedimos el motivo» repetido`);
    ok(await p.locator('dialog[open]').count() === 0, `${que}: ningún selector de motivo a la vista`);
    await p.getByRole('button', { name: 'No voy', exact: true }).first().click();
    const hojas = await p.locator('dialog[open]').count(), grupos = await p.locator('dialog[open] fieldset.rw-motivos').count();
    ok(hojas === 1 && grupos === 1, `${que}: «No voy» abre UNA hoja con UN selector`, `${hojas} hojas, ${grupos} selectores`);
    await p.locator('dialog[open] label.rw-motivo', { hasText: 'Familia' }).click();
    await trasAccion(p, () => p.getByRole('button', { name: 'Guardar «no voy»' }).click());
    const filas = await motivos(ev, p.persona);
    ok(filas.length === ev.length && filas.every((x) => x.respuesta === 'no' && x.motivo === 'familia' && x.origen === 'jugador'), `${que}: con elegir el motivo UNA vez queda «no · familia · jugador»`, JSON.stringify(filas));
    await hasta(async () => (await p.locator('dialog[open]').count()) === 0 && (await p.getByTestId('paso-no-va').count()) === 0, 8000).catch(() => {});
    ok(await p.locator('dialog[open]').count() === 0, `${que}: la hoja no vuelve a abrirse`);
    ok(await p.getByTestId('paso-no-va').count() === 0, `${que}: el texto del paso a «no va» se va`);
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${que}: sin desbordamiento horizontal a 375 px`);
  };

  console.log('\n== /mi-zona/evento/<id> (entreno, 375 px)');
  const pd = await e.sesion('dos@pruebas.local', 375);
  pd.persona = 'sint-dos';
  await pd.goto(`${APP}${urls['sint-dos']}`);
  ok(/No vas · no confirmaste a tiempo/.test(await pd.locator('.rw-etiqueta').first().innerText()), 'la etiqueta dice «No vas · no confirmaste a tiempo»');
  await aclarar(pd, 'evento', [ENT]);
  ok(/No vas · Familia/.test(await pd.locator('.rw-etiqueta').first().innerText()), 'y después «No vas · Familia»');
  await pd.close();

  console.log('\n== /mi-zona/domingo/<fecha> (375 px)');
  const pt = await e.sesion('tres@pruebas.local', 375);
  pt.persona = 'sint-tres';
  await pt.goto(`${APP}${urls['sint-tres']}`);
  ok(/No vas · no confirmaste a tiempo/.test(await pt.locator('.rw-etiqueta').first().innerText()), 'la etiqueta dice «No vas · no confirmaste a tiempo»', await pt.locator('.rw-etiqueta').first().innerText());
  await aclarar(pt, 'domingo', liga.map((l) => l.id));
  await pt.close();

  console.log('\n== Inicio (375 px): «Tu próximo partido» y «Tu agenda»');
  const pc = await e.sesion('cuatro@pruebas.local', 375);
  pc.persona = 'sint-cuatro';
  await pc.goto(`${APP}/`);
  await pc.getByTestId('salto-partido').waitFor({ timeout: 20000 });
  const salto = await pc.getByTestId('salto-partido').innerText();
  ok(/no juegas \(no confirmaste a tiempo\)/.test(salto) && !/has dicho que no vas/.test(salto), '«Tu próximo partido»: «no juegas (no confirmaste a tiempo)», no «has dicho que no vas» (no lo dijo él)', salto);
  ok(salto.includes('Di el motivo (una sola vez) o pon «Voy»') && await pc.getByTestId('salto-motivo').getAttribute('href') === `/mi-zona/domingo/${dom.f}`, 'y un enlace al partido para decir el motivo, sin botones ni hoja duplicados en el inicio', salto);
  ok(await pc.getByTestId('paso-no-va').count() === 0 && await pc.locator('dialog[open]').count() === 0, 'el inicio no repite el texto ni abre ningún selector de motivo (los «Voy / No voy» que se ven son los del domingo siguiente, sin responder)');
  const filaEntreno = pc.getByTestId('fila-agenda').filter({ hasText: 'x-entreno' });
  ok(await filaEntreno.count() === 1 && /No vas/.test(await filaEntreno.innerText()) && !/Sin responder/.test(await filaEntreno.innerText()), '«Tu agenda»: el entreno sale «No vas» (no «Sin responder») y lleva a su pantalla', await filaEntreno.innerText().catch(() => ''));
  ok(await filaEntreno.getAttribute('href') === `/mi-zona/evento/${ENT}`, 'la fila del entreno lleva a /mi-zona/evento/<id>');
  await pc.getByTestId('salto-motivo').click();
  await pc.waitForURL(`**/mi-zona/domingo/${dom.f}`);
  await aclarar(pc, 'inicio → partido', [MDL]);
  await pc.close();
} catch (err) {
  console.log(`  FALLO excepción -> ${err.stack ?? err}`);
  process.exitCode = 1;
} finally {
  await e.parar();
}
const n = fallos();
console.log(n || process.exitCode ? `\n${n} FALLO(S)` : '\nTodo OK');
process.exit(n || process.exitCode ? 1 : 0);
