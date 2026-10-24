#!/usr/bin/env node
// Grupos de entreno (D122).
//   - la sugerencia (pura): junta a los del mismo equipo del domingo, equilibra lineas y nivel, coloca a quien no juega
//     en los grupos mas cortos con la linea que falte y a quien dobla segun la regla (partido mas dificil; si igual, el
//     equipo con menos); sin partido, reparto equilibrado; cada grupo explica de donde sale;
//   - de extremo a extremo: sugerir, mover con la seleccion («Mover N a…»), renombrar, guardar, varios repartos,
//     duplicar, borrar y publicar; el jugador ve SOLO su grupo y sus compañeros (inicio y agenda) y nunca niveles; un
//     jugador no lee los repartos (RLS).
//
//   npm run pruebas:grupos
import { preparar, personas, sinteticos, contador, visto, sinDesbordar, foto } from './comun_e2e.mjs';
import { sugerirGrupos, mensajeGrupos } from '../src/lib/grupos/sugerir.ts';

const { ok, fallos, sumar } = contador();
const J = (id, posicion, nivel = 'C', base_reserva = false) => ({ person_id: id, nombre: id.toUpperCase(), posicion, nivel, base_reserva });

console.log('\n== La sugerencia (sin pantalla)');
const van = [
  J('a1', 'base', 'A'), J('a2', 'escolta', 'B'), J('a3', 'alero', 'C'), J('a4', 'pivot', 'A'), J('a5', 'ala_pivot', 'D'), J('a6', 'base', 'C'),
  J('l1', 'base', 'B'), J('l2', 'alero', 'C'), J('l3', 'pivot', 'B'), J('l4', 'escolta', 'E'),
  J('x1', 'escolta', 'C', true), J('x2', 'pivot', 'D'),
];
let g = sugerirGrupos({ van, tamano: 5, domingo: { fecha: '2026-11-08', equipos: { MdA: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'], MdL: ['l1', 'l2', 'l3', 'l4'] }, dificultad: { MdA: 'media', MdL: 'media' } } });
const deEquipo = (p) => (p.startsWith('a') ? 'A' : p.startsWith('l') ? 'L' : 'X');
ok(g.every((x) => new Set(x.personas.filter((p) => !p.startsWith('x')).map(deEquipo)).size <= 1), 'nadie del MdA comparte grupo con alguien del MdL (se juntan los del mismo equipo del domingo)', JSON.stringify(g));
ok(g.filter((x) => x.personas.some((p) => p.startsWith('a'))).length === 2 && g.filter((x) => x.personas.some((p) => p.startsWith('l'))).length === 1, '6 del MdA en 2 grupos y 4 del MdL en 1 (de 5)');
const gA = g.filter((x) => x.personas.some((p) => p.startsWith('a')));
ok(gA.every((x) => x.personas.filter((p) => ['a1', 'a6'].includes(p)).length === 1) && gA.every((x) => x.personas.filter((p) => ['a4', 'a5'].includes(p)).length === 1), 'dentro del MdA, equilibrados por línea: un base y un interior en cada grupo');
const conX1 = g.find((x) => x.personas.includes('x1'));
const conX2 = g.find((x) => x.personas.includes('x2'));
ok(conX1 && conX2 && /del domingo 8; completa X/.test(conX1.explica) && conX1.personas.length === 4 && conX2.personas.length === 4 && conX2 !== g.find((x) => x.personas.includes('l1')), 'quien no juega completa los grupos más cortos (los dos de 3 del MdA) y el grupo lo explica', `${conX1?.explica} | ${conX2?.explica}`);
ok(/completa X2/.test(conX2.explica) && conX2.personas.filter((p) => ['a4', 'a5', 'x2'].includes(p)).length === 2, 'el interior que no juega va al grupo al que le falta interior', JSON.stringify(conX2));
ok(g.every((x) => x.personas.length <= 5) && new Set(g.flatMap((x) => x.personas)).size === van.length, 'todos colocados una sola vez y ningún grupo pasa de 5');
ok(g.every((x) => /del domingo 8|Sin partido/.test(x.explica)), 'cada grupo dice de dónde sale («MdA del domingo 8»…)');
// Falta base: el que puede hacer de base va al grupo sin base.
g = sugerirGrupos({ van: [J('a1', 'escolta'), J('a2', 'alero'), J('a3', 'pivot'), J('b1', 'base'), J('b2', 'escolta'), J('b3', 'pivot'), J('r1', 'escolta', 'C', true)], tamano: 4, domingo: { fecha: '2026-11-08', equipos: { MdA: ['a1', 'a2', 'a3'], MdL: ['b1', 'b2', 'b3'] }, dificultad: { MdA: 'alta', MdL: 'baja' } } });
const sinBase = g.find((x) => x.personas.includes('a1'));
ok(sinBase.personas.includes('r1') && /completa R1, que puede hacer de base/.test(sinBase.explica), 'el base de reserva completa el grupo al que le falta base («completa Tomás, que puede hacer de base»)', JSON.stringify(sinBase));
// Quien dobla: con el partido mas dificil; si es igual, con el equipo que tenga menos.
g = sugerirGrupos({ van: [J('d', 'base'), J('a1', 'alero'), J('a2', 'pivot'), J('l1', 'alero')], tamano: 5, domingo: { fecha: '2026-11-08', equipos: { MdA: ['d', 'a1', 'a2'], MdL: ['d', 'l1'] }, dificultad: { MdA: 'baja', MdL: 'alta' } } });
ok(g.find((x) => x.personas.includes('d')).personas.includes('l1'), 'dobla y el MdL es más difícil: va con el MdL');
g = sugerirGrupos({ van: [J('d', 'base'), J('a1', 'alero'), J('a2', 'pivot'), J('l1', 'alero')], tamano: 5, domingo: { fecha: '2026-11-08', equipos: { MdA: ['d', 'a1', 'a2'], MdL: ['d', 'l1'] }, dificultad: { MdA: 'media', MdL: 'media' } } });
ok(g.find((x) => x.personas.includes('d')).personas.includes('l1'), 'dobla y la dificultad es igual: con el equipo que tiene menos (el MdL)');
g = sugerirGrupos({ van: van.slice(0, 10), tamano: 5, domingo: null });
ok(g.length === 2 && g.every((x) => x.personas.length === 5 && /Reparto equilibrado/.test(x.explica)) && g.every((x) => x.personas.some((p) => ['a1', 'a6', 'l1'].includes(p))), 'sin partido: reparto equilibrado (cada grupo con base)');
const msg = mensajeGrupos('Grupos del entreno del miércoles 28', [{ nombre: 'Azules', personas: ['a1', 'a2'] }], (x) => x.toUpperCase());
ok(msg === 'Grupos del entreno del miércoles 28:\nAzules: A1, A2' && !/nivel|explica|del domingo/i.test(msg), 'mensaje de WhatsApp: solo grupos y nombres');

const e = await preparar({ puerto: 3125 });
const { sql, APP } = e;
try {
  const P = await personas(e.pila, { jugadores: [['esteban-jon', 'jon@pruebas.local'], ['gianatti-adriano', 'adri@pruebas.local']], gestores: [['Iván', 'ivan@pruebas.local', null]] });
  const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  const [ent] = await sql`select id, fecha::text from public.eventos where tipo = 'entreno' and estado = 'programado' and fecha > ${hoy} order by fecha limit 1`;
  // Datos privados (posicion, nivel) solo en jugadores SINTETICOS (D39); Jon y Adriano (reales) van sin ellos.
  const POS = ['base', 'escolta', 'alero', 'ala_pivot', 'pivot'];
  const sint = Array.from({ length: 10 }, (_, i) => [`sint-g${i}`, `Prueba${i}`, true, i % 3 !== 0]);
  await sinteticos(sql, sint);
  for (const [i, s] of sint.entries()) {
    await sql`insert into public.jugadores_privado (person_id, posicion, nivel) values (${s[0]}, ${POS[i % 5]}, ${'ABCDE'[i % 5]})`;
    await sql`insert into public.respuestas (evento_id, person_id, respuesta) values (${ent.id}, ${s[0]}, 'va')`;
  }
  await sql`insert into public.respuestas (evento_id, person_id, respuesta) values (${ent.id}, 'esteban-jon', 'va'), (${ent.id}, 'gianatti-adriano', 'va') on conflict do nothing`;
  await sql`insert into public.respuestas (evento_id, person_id, respuesta) values (${ent.id}, 'vallesi-daniele', 'duda') on conflict (evento_id, person_id) do update set respuesta = 'duda'`;

  console.log('\n== Gestor (1280 px): sugerir, mover, renombrar, guardar');
  const pg = await e.sesion('ivan@pruebas.local', 1280);
  await pg.goto(`${APP}/gestion/grupos/${ent.id}`);
  ok(await visto(pg.getByRole('heading', { name: /Dudan/ })) && /Daniele/.test(await pg.locator('.gr-dudas').innerText()), 'los «Duda», aparte (para añadirlos a mano)');
  await pg.getByLabel('Jugadores por grupo').selectOption('5');
  await pg.getByRole('button', { name: 'Sugerir grupos' }).click();
  await pg.getByTestId('grupo').first().waitFor({ timeout: 15000 });
  const n = await pg.getByTestId('grupo').count();
  ok(n >= 2 && (await pg.locator('.gr-sin li').count()) === 0, `la sugerencia coloca a todos los que van (${n} grupos)`);
  ok(/del domingo|Reparto equilibrado|Sin partido/.test(await pg.locator('.gr-explica').first().innerText()), 'cada grupo explica de dónde sale');
  await pg.getByTestId('grupo').first().locator('li input[type=checkbox]').first().check();
  await pg.locator('.tb-barra').getByRole('combobox').selectOption({ index: 1 });
  await pg.locator('.tb-barra').getByRole('button', { name: 'Mover' }).click();
  ok((await pg.getByTestId('grupo').nth(1).locator('li').count()) > 0, '«Mover 1 a…» lo pasa de grupo');
  await pg.getByLabel('Nombre del grupo 1').fill('Azules');
  await pg.getByLabel('Nombre del reparto').fill('5 contra 5');
  await foto(pg, 'grupos_sugerencia_1280');
  await pg.getByRole('button', { name: 'Guardar como reparto nuevo' }).click();
  await pg.getByText('Reparto guardado.').waitFor({ timeout: 15000 });
  let rep = await sql`select id, nombre, grupos, publicado from public.grupos_repartos where evento_id = ${ent.id} and borrado_en is null`;
  ok(rep.length === 1 && rep[0].nombre === '5 contra 5' && rep[0].grupos[0].nombre === 'Azules' && rep[0].publicado === false, 'guardado, sin publicar (por defecto)', JSON.stringify(rep));

  console.log('\n== Varios repartos: duplicar y borrar');
  await pg.reload();
  await pg.getByRole('button', { name: 'Duplicar' }).click();
  await pg.waitForTimeout(1500);
  await pg.reload();
  ok((await sql`select count(*)::int n from public.grupos_repartos where evento_id = ${ent.id} and borrado_en is null`)[0].n === 2 && await visto(pg.getByRole('tab', { name: /5 contra 5 \(copia\)/ })), 'duplicar: dos repartos con nombre');
  await pg.getByRole('tab', { name: /5 contra 5 \(copia\)/ }).click();
  await pg.getByRole('button', { name: 'Borrar reparto' }).click();
  await pg.getByRole('button', { name: 'Sí, borrar' }).click();
  await pg.waitForTimeout(1500);
  ok((await sql`select count(*)::int n from public.grupos_repartos where evento_id = ${ent.id} and borrado_en is null`)[0].n === 1, 'borrar (confirmación en la página): queda uno');

  console.log('\n== Publicar a la plantilla: cada jugador ve SOLO su grupo y nunca niveles');
  await pg.reload();
  await pg.getByTestId('publicar').locator('input').click();
  await pg.waitForTimeout(1500);
  ok((await sql`select publicado from public.grupos_repartos where evento_id = ${ent.id} and borrado_en is null`)[0].publicado === true, 'publicado');
  const wa = await pg.getByTestId('mensaje-grupos').innerText();
  ok(/^Grupos del entreno del/.test(wa) && /Azules: /.test(wa) && !/nivel|del domingo|completa/i.test(wa), '«Copiar mensaje de WhatsApp»: grupos y nombres, nada más');
  rep = (await sql`select grupos from public.grupos_repartos where evento_id = ${ent.id} and publicado`)[0].grupos;
  const suyo = rep.find((x) => x.personas.includes('esteban-jon'));
  const mios = (await (await fetch(`${e.pila.url}/rest/v1/rpc/mis_grupos`, { method: 'POST', headers: { apikey: e.pila.anonKey, authorization: `Bearer ${P['esteban-jon'].token}`, 'content-type': 'application/json' }, body: '{}' })).json());
  ok(mios.length === 1 && mios[0].grupo === suyo.nombre && mios[0].companeros.length === suyo.personas.length - 1 && !JSON.stringify(mios).match(/nivel|explica|posicion/), 'mis_grupos (base): solo el nombre de su grupo y sus compañeros', JSON.stringify(mios));
  const leer = await (await fetch(`${e.pila.url}/rest/v1/grupos_repartos?select=grupos`, { headers: { apikey: e.pila.anonKey, authorization: `Bearer ${P['esteban-jon'].token}` } })).json();
  ok(Array.isArray(leer) && leer.length === 0, 'un jugador NO lee los repartos (RLS: solo gestores)');
  const pj = await e.sesion('jon@pruebas.local', 375);
  const tg = pj.getByTestId('tu-grupo').first();
  ok(await visto(tg) && (await tg.innerText()).includes(`Tu grupo: ${suyo.nombre}`), `inicio: «Tu grupo: ${suyo.nombre}» en el entreno`);
  const html = (await pj.content()).replace(/<script[\s\S]*?<\/script>/g, '');
  const otro = rep.find((x) => !x.personas.includes('esteban-jon'));
  ok(!/nivel/i.test(html) && (!otro || !html.includes(otro.nombre === suyo.nombre ? '§' : `Tu grupo: ${otro.nombre}`)), 'nunca niveles ni otros grupos');
  await pj.goto(`${APP}/agenda`);
  ok(await visto(pj.getByTestId('tu-grupo')), 'agenda: también «Tu grupo»');
  ok(await sinDesbordar(pj), 'a 375 px sin desbordamiento');
  const pg375 = await e.nuevaPagina(await e.contexto(375));
  await pg375.context().addCookies(await pg.context().cookies());
  await pg375.goto(`${APP}/gestion/grupos/${ent.id}`);
  ok(await sinDesbordar(pg375), 'grupos (gestor) a 375 px sin desbordamiento');
  await foto(pg375, 'grupos_sugerencia_375');
  ok(!e.errores.length, 'sin errores de consola', e.errores.slice(0, 5).join(' | '));
} catch (err) { console.error(err); sumar(); } finally {
  await e.parar();
}
console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK');
process.exit(fallos() ? 1 : 0);
