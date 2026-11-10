#!/usr/bin/env node
// Hoja «No voy»: el motivo se elige al PRIMER toque (bug de Enyel, 10/11/2026). Al abrir la hoja, `showModal()` ponía el
// foco en el primer motivo («Lesión») y Safari le pintaba el recuadro de foco: parecía preseleccionado y el toque en otro
// motivo no parecía marcarlo. Ahora el foco va al título de la hoja.
// En /evento/<id> (Responder) y en /mi-zona/domingo/<fecha> (ElegirDomingo), en WebKit (iPhone, con toques), a 360 px con
// toques y a 1280 px con clics (Chromium):
//   - al abrir, el foco está en el título y ningún motivo tiene foco ni aparece marcado salvo el guardado;
//   - abrir la hoja (primera vez en la página) → tocar un motivo distinto del preseleccionado → queda marcado a la primera
//     (el radio, la clase «elegido» y uno solo marcado);
//   - «Guardar» guarda ESE motivo (respuestas, pila local);
//   - con el motivo preseleccionado sin tocar, «Guardar» sigue guardando el de antes;
//   - sin motivo previo, el primer toque también marca.
//
//   npm run pruebas:no-voy-primer-toque
//
// vigila: src/components/respuestas/HojaNoVoy.tsx
// vigila: src/components/respuestas/Responder.tsx
// vigila: src/components/respuestas/ElegirDomingo.tsx
import { webkit, devices } from 'playwright';
import { preparar, sinteticos, personas, contador } from './comun_e2e.mjs';
import { trasAccion, hasta } from './infra/esperas.mjs';
import { ahoraPrueba, relojNavegador } from './infra/reloj.mjs';

const { ok, fallos } = contador();
const e = await preparar();
const wk = await webkit.launch();
const { sql, APP } = e;
const madridDe = (ms) => { const f = new Date(ahoraPrueba().getTime() + ms).toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }); return { fecha: f.slice(0, 10), hora: f.slice(11, 16) }; };

try {
  const jug = [['sint-iphone', 'Iphone'], ['sint-movil', 'Movil'], ['sint-escritorio', 'Escritorio']];
  await sinteticos(sql, jug.map(([p, n]) => [p, n, true, true]));
  await personas(e.pila, { jugadores: jug.map(([p]) => [p, `${p.slice(5)}@pruebas.local`]), gestores: [] });
  // Dos entrenos dentro de 3 y 4 días: uno con «no · trabajo» ya guardado por el jugador y otro sin responder.
  const ent = async (clave, dias) => {
    const f = madridDe(dias * 86400000);
    return (await sql`insert into public.eventos (clave, tipo, equipo, titulo, fecha, inicio, oficial) values (${clave}, 'entreno', 'ambos', ${clave}, ${f.fecha}, '20:30', true) returning id`)[0].id;
  };
  const CON = await ent('x-con-motivo', 3), SIN = await ent('x-sin-motivo', 4);
  const hoy = madridDe(0).fecha;
  const [dom] = await sql`select fecha::text f from public.eventos where tipo = 'liga' and estado = 'programado' and oficial and fecha > ${hoy} order by fecha limit 1`;
  const liga = (await sql`select id from public.eventos where tipo = 'liga' and estado = 'programado' and fecha = ${dom.f}`).map((x) => x.id);
  const ponerNo = async (ev, p, motivo) => sql`insert into public.respuestas (evento_id, person_id, respuesta, motivo, fuente, origen, cambiado_en)
      values (${ev}, ${p}, 'no', ${motivo}, 'web', 'jugador', pruebas.ahora())
    on conflict (evento_id, person_id) do update set respuesta = 'no', motivo = ${motivo}, detalle = null, origen = 'jugador', cambiado_en = pruebas.ahora()`;
  const guardado = async (evs, p) => sql`select respuesta, motivo from public.respuestas where person_id = ${p} and evento_id = any(${evs})`;

  const hoja = (p) => p.locator('dialog[open]');
  const marcado = async (p) => p.evaluate(() => {
    const d = document.querySelector('dialog[open]');
    return { radios: [...d.querySelectorAll('input[name="motivo"]:checked')].map((x) => x.value), elegidos: [...d.querySelectorAll('label.rw-motivo.elegido input')].map((x) => x.value) };
  });
  const pulsar = (p, loc, tactil) => (tactil ? loc.tap() : loc.click());

  // Abre la página en frío (primera apertura de la hoja), toca «No voy», comprueba lo preseleccionado y toca `elegir`.
  const caso = async (p, que, url, evs, { previo, elegir, tactil }) => {
    await p.goto(`${APP}${url}`);
    const btn = p.getByRole('button', { name: 'No voy', exact: true }).first();
    await btn.waitFor({ timeout: 20000 });
    await pulsar(p, btn, tactil);
    await hoja(p).waitFor();
    const antes = await marcado(p);
    const foco = await p.evaluate(() => {
      const a = document.activeElement, d = document.querySelector('dialog[open]');
      return { tag: a?.tagName, enTitulo: a === d.querySelector('h2'), motivoConFoco: [...d.querySelectorAll('input[name="motivo"]')].filter((x) => x.matches(':focus, :focus-visible')).map((x) => x.value) };
    });
    ok(foco.enTitulo && foco.motivoConFoco.length === 0, `${que}: al abrir, el foco está en el título (ningún motivo con foco que parezca elegido)`, JSON.stringify(foco));
    ok(JSON.stringify(antes.radios) === JSON.stringify(previo ? [previo] : []), `${que}: al abrir, preseleccionado ${previo ?? 'ninguno'}`, JSON.stringify(antes));
    // Sin esperas: el toque llega en cuanto la hoja está abierta, como el de una persona.
    await pulsar(p, hoja(p).locator('label.rw-motivo', { hasText: new RegExp(`^${elegir.texto}$`) }), tactil);
    const tras = await marcado(p);
    ok(JSON.stringify(tras.radios) === JSON.stringify([elegir.id]) && JSON.stringify(tras.elegidos) === JSON.stringify([elegir.id]),
      `${que}: al PRIMER ${tactil ? 'toque' : 'clic'} en «${elegir.texto}» queda marcado (y solo ese)`, JSON.stringify(tras));
    await trasAccion(p, () => pulsar(p, hoja(p).getByRole('button', { name: 'Guardar «no voy»' }), tactil));
    await hasta(async () => (await guardado(evs, p.persona)).every((x) => x.motivo === elegir.id), 8000).catch(() => {});
    const filas = await guardado(evs, p.persona);
    ok(filas.length === evs.length && filas.every((x) => x.respuesta === 'no' && x.motivo === elegir.id), `${que}: se guarda «no · ${elegir.id}»`, JSON.stringify(filas));
  };

  // «Guardar» con el motivo preseleccionado, sin tocarlo.
  const porDefecto = async (p, que, url, evs, previo, tactil) => {
    await p.goto(`${APP}${url}`);
    const btn = p.getByRole('button', { name: 'No voy', exact: true }).first();
    await btn.waitFor({ timeout: 20000 });
    await pulsar(p, btn, tactil);
    await hoja(p).waitFor();
    const g = hoja(p).getByRole('button', { name: 'Guardar «no voy»' });
    ok(!(await g.isDisabled()), `${que}: con el motivo preseleccionado, «Guardar» activo`);
    await trasAccion(p, () => pulsar(p, g, tactil));
    await hasta(async () => (await hoja(p).count()) === 0, 8000).catch(() => {});
    const filas = await guardado(evs, p.persona);
    ok((await hoja(p).count()) === 0 && filas.length === evs.length && filas.every((x) => x.respuesta === 'no' && x.motivo === previo), `${que}: «Guardar» sin tocar guarda «no · ${previo}» y cierra`, JSON.stringify(filas));
  };

  const F = { id: 'familia', texto: 'Familia' }, V = { id: 'viaje', texto: 'Viaje' }, L = { id: 'lesion', texto: 'Lesión' };
  const paginaIphone = async (email) => {
    const ctx = await wk.newContext({ ...devices['iPhone 13'], locale: 'es-ES' });
    await relojNavegador(ctx);
    const p = await e.nuevaPagina(ctx);
    await e.entrar(p, email);
    return p;
  };
  for (const [persona, ancho, tactil] of [['sint-iphone', 0, true], ['sint-movil', 360, true], ['sint-escritorio', 1280, false]]) {
    const modo = ancho ? `${ancho} px${tactil ? ' con toques' : ' con clics'}` : 'WebKit iPhone con toques';
    console.log(`\n== ${modo}`);
    const email = `${persona.slice(5)}@pruebas.local`;
    const p = ancho ? await e.sesion(email, ancho) : await paginaIphone(email);
    p.persona = persona;
    await ponerNo(CON, persona, 'trabajo');
    await caso(p, `evento con motivo (${modo})`, `/evento/${CON}`, [CON], { previo: 'trabajo', elegir: F, tactil });
    await porDefecto(p, `evento, motivo por defecto (${modo})`, `/evento/${CON}`, [CON], 'familia', tactil);
    await caso(p, `evento sin responder (${modo})`, `/evento/${SIN}`, [SIN], { previo: null, elegir: V, tactil });
    for (const l of liga) await ponerNo(l, persona, 'trabajo');
    await caso(p, `domingo con motivo (${modo})`, `/mi-zona/domingo/${dom.f}`, liga, { previo: 'trabajo', elegir: L, tactil });
    await porDefecto(p, `domingo, motivo por defecto (${modo})`, `/mi-zona/domingo/${dom.f}`, liga, 'lesion', tactil);
    await p.context().close();
  }
  // WebKit avisa así de una precarga `?_rsc=` que se corta al navegar con goto (no es un error de la página).
  const errores = e.errores.filter((x) => !/\?_rsc=\S* due to access control checks/.test(x));
  ok(errores.length === 0, 'sin errores de JS', errores.slice(0, 3).join(' | '));
} catch (err) {
  console.log(`  FALLO excepción -> ${err.stack ?? err}`);
  process.exitCode = 1;
} finally {
  await wk.close().catch(() => {});
  await e.parar();
}
const n = fallos();
console.log(n || process.exitCode ? `\n${n} FALLO(S)` : '\nTodo OK');
process.exit(n || process.exitCode ? 1 : 0);
