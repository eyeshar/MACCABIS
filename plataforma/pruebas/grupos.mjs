#!/usr/bin/env node
// Grupos de entreno (D122, D143, D144).
//   - la sugerencia (pura): grupos nivelados por nivel y lineas, sin el equipo del domingo. Caso ANONIMO (J1…J17) con la
//     forma del entreno del 28/10: 17 de 6 en 6 → 6, 6, 5; un base (o de reserva) por grupo, interiores parejos, nivel
//     medio parejo y A repartidos; «Otra sugerencia» igual de nivelada; determinista; casos limite;
//   - de extremo a extremo: sugerir, resumen por grupo que se recalcula al mover, aviso de «sin nivel», mover con la
//     seleccion («Mover N a…»), renombrar, guardar, varios repartos, duplicar, borrar y publicar; el jugador ve SOLO su
//     grupo y sus compañeros (inicio y agenda) y nunca niveles; un jugador no lee los repartos (RLS);
//   - «Vista para el equipo»: solo titulo, grupos y nombres; ningun dato privado en la pagina (ni oculto con CSS); se
//     desactiva con el mismo interruptor, al recargar vuelve la vista normal y a 375 px no desborda.
//
//   npm run pruebas:grupos
import { preparar, personas, sinteticos, contador, visto, sinDesbordar, foto } from './comun_e2e.mjs';
import { sugerirGrupos, mensajeGrupos, resumenGrupo, tamanos } from '../src/lib/grupos/sugerir.ts';

const { ok, fallos, sumar } = contador();
const J = (id, posicion, nivel = 'C', base_reserva = false) => ({ person_id: id, nombre: id.toUpperCase(), posicion, nivel, base_reserva });
const VALOR = { A: 5, B: 4, C: 3, D: 2, E: 1 };
const valor = (j) => (j.nivel ? VALOR[j.nivel] : 3);
const esBase = (j) => j.base_reserva || j.posicion === 'base';
const esInterior = (j) => !esBase(j) && ['pivot', 'ala_pivot'].includes(j.posicion);
const ordenadas = (xs) => [...xs].sort((a, b) => b - a).join('/');
/** Cifras de un reparto: tamaños, bases, interiores, A y nivel medio por grupo. */
function cifras(grupos, lista) {
  const por = new Map(lista.map((j) => [j.person_id, j]));
  const gs = grupos.map((g) => g.personas.map((p) => por.get(p)));
  const media = gs.map((g) => g.reduce((s, j) => s + valor(j), 0) / g.length);
  return {
    tam: gs.map((g) => g.length), bases: gs.map((g) => g.filter(esBase).length), interiores: gs.map((g) => g.filter(esInterior).length),
    A: gs.map((g) => g.filter((j) => j.nivel === 'A').length), media, rango: Math.max(...media) - Math.min(...media),
    todos: new Set(gs.flat().map((j) => j.person_id)).size === lista.length && gs.flat().length === lista.length,
  };
}

console.log('\n== La sugerencia (sin pantalla): caso anónimo con la forma del 28/10');
// 4 A, 3 B, 8 C, 1 D, 1 E; 4 bases de reserva (una A), 8 interiores, 5 exteriores; ninguno sin posicion.
const caso = [
  J('j01', 'escolta', 'A', true), J('j02', 'escolta', 'B', true), J('j03', 'alero', 'B', true), J('j04', 'escolta', 'C', true),
  J('j05', 'ala_pivot', 'A'), J('j06', 'pivot', 'B'), J('j07', 'pivot', 'C'), J('j08', 'pivot', 'C'), J('j09', 'ala_pivot', 'C'), J('j10', 'ala_pivot', 'C'), J('j11', 'pivot', 'C'), J('j12', 'ala_pivot', 'E'),
  J('j13', 'alero', 'A'), J('j14', 'escolta', 'A'), J('j15', 'escolta', 'C'), J('j16', 'alero', 'C'), J('j17', 'alero', 'D'),
];
ok(caso.length === 17 && caso.filter((j) => j.nivel === 'A').length === 4 && caso.filter(esInterior).length === 8 && caso.filter(esBase).length === 4, 'el caso de prueba tiene la forma pedida (17; 4 A; 8 interiores; 4 bases de reserva)');
const s0 = sugerirGrupos({ van: caso, tamano: 6 });
let c = cifras(s0.grupos, caso);
ok(ordenadas(c.tam) === '6/6/5' && c.todos, '17 de 6 en 6: tres grupos de 6, 6 y 5, todos colocados una sola vez', JSON.stringify(c.tam));
ok(ordenadas(c.interiores) === '3/3/2', 'interiores 3/3/2', JSON.stringify(c.interiores));
ok(ordenadas(c.bases) === '2/1/1', 'bases de reserva 2/1/1 (un base en cada grupo)', JSON.stringify(c.bases));
ok(ordenadas(c.A) === '2/1/1', 'jugadores A 2/1/1', JSON.stringify(c.A));
const conDosA = c.A.indexOf(2);
ok(c.bases[conDosA] !== 2 && c.media[conDosA] < Math.max(...c.media), 'el grupo con dos A no es el de dos bases ni el de nivel medio más alto', JSON.stringify(c));
ok(c.rango <= 0.5, `diferencia de nivel medio entre grupos ≤ 0,5 (${c.rango.toFixed(2)})`);
ok(JSON.stringify(sugerirGrupos({ van: [...caso].reverse(), tamano: 6 })) === JSON.stringify(s0), 'determinista: mismos datos (en cualquier orden), mismo resultado');
ok(s0.variante === 0 && s0.variantes > 1, `hay otras combinaciones igual de niveladas (${s0.variantes})`);
const s1 = sugerirGrupos({ van: caso, tamano: 6, variante: 1 });
ok(s1.variante === 1 && JSON.stringify(s1.grupos) !== JSON.stringify(s0.grupos), '«Otra sugerencia» (variante 1) da otra combinación');
let todasBien = true;
for (let v = 0; v < s0.variantes; v++) {
  const x = cifras(sugerirGrupos({ van: caso, tamano: 6, variante: v }).grupos, caso);
  const k = x.A.indexOf(2);
  if (!(ordenadas(x.interiores) === '3/3/2' && ordenadas(x.bases) === '2/1/1' && ordenadas(x.A) === '2/1/1' && x.rango <= 0.5 && x.bases[k] !== 2 && x.media[k] < Math.max(...x.media))) todasBien = false;
}
ok(todasBien, `las ${s0.variantes} sugerencias cumplen lo mismo (igual de niveladas)`);
ok(JSON.stringify(sugerirGrupos({ van: caso, tamano: 6, variante: s0.variantes })) === JSON.stringify(s0), 'al pasar de la última vuelve a la primera');
ok(s0.grupos.every((g, i) => g.nombre === `Grupo ${i + 1}` && Object.keys(g).join() === 'nombre,personas'), 'cada grupo lleva solo nombre y personas (sin criterio ni texto del domingo)');

console.log('\n== Casos límite');
ok(JSON.stringify(tamanos(17, 6)) === '[6,6,5]' && JSON.stringify(tamanos(12, 4)) === '[4,4,4]' && JSON.stringify(tamanos(13, 5)) === '[5,4,4]' && JSON.stringify(tamanos(5, 6)) === '[5]' && JSON.stringify(tamanos(0, 5)) === '[]', 'tamaños lo más iguales posible (17/6 → 6,6,5; 13/5 → 5,4,4)');
// Menos bases que grupos (1 base, 3 grupos): cada grupo con 0 o 1, interiores parejos.
const pocos = [J('b1', 'base', 'B'), J('i1', 'pivot', 'A'), J('i2', 'pivot', 'C'), J('i3', 'ala_pivot', 'C'), J('i4', 'ala_pivot', 'D'), J('e1', 'alero', 'A'), J('e2', 'alero', 'B'), J('e3', 'escolta', 'C'), J('e4', 'escolta', 'C'), J('e5', 'escolta', 'D'), J('e6', 'alero', 'E'), J('e7', 'alero', 'C')];
c = cifras(sugerirGrupos({ van: pocos, tamano: 4 }).grupos, pocos);
ok(ordenadas(c.tam) === '4/4/4' && ordenadas(c.bases) === '1/0/0' && ordenadas(c.interiores) === '2/1/1' && c.rango <= 0.5 && c.todos, `N múltiplo exacto (12 de 4 en 4) y menos bases que grupos: bases 1/0/0, interiores 2/1/1, rango ${c.rango.toFixed(2)}`, JSON.stringify(c));
// Sin nivel y sin posicion: cuentan como C y como comodin; todos colocados.
const raros = [J('n1', null, null), J('n2', 'pivot', null), J('n3', null, 'A'), J('n4', 'base', 'C'), J('n5', 'alero', 'C'), J('n6', 'base', 'B'), J('n7', 'pivot', 'D'), J('n8', null, 'C')];
const sr = sugerirGrupos({ van: raros, tamano: 4 });
c = cifras(sr.grupos, raros);
ok(ordenadas(c.tam) === '4/4' && c.todos && ordenadas(c.bases) === '1/1' && ordenadas(c.interiores) === '1/1', 'sin nivel o sin posición: todos colocados, un base y un interior por grupo', JSON.stringify(c));
ok(resumenGrupo([{ posicion: null, base_reserva: false, nivel: null }, { posicion: 'pivot', base_reserva: false, nivel: 'A' }]) === 'Nivel medio 4,0 · 1 interior · 0 bases', 'resumen: sin nivel cuenta como C (3) y sin posición no es de ninguna línea');
ok(resumenGrupo([J('x', 'pivot', 'A'), J('y', 'ala_pivot', 'B'), J('z', 'alero', 'C', true), J('w', 'base', 'C')]) === 'Nivel medio 3,8 · 2 interiores · 2 bases', 'resumen: «Nivel medio 3,8 · 2 interiores · 2 bases» (los de reserva cuentan como base)');
// Todos sin nivel.
const sinNiv = Array.from({ length: 10 }, (_, i) => J(`s${i}`, ['base', 'escolta', 'alero', 'ala_pivot', 'pivot'][i % 5], null));
c = cifras(sugerirGrupos({ van: sinNiv, tamano: 5 }).grupos, sinNiv);
ok(ordenadas(c.tam) === '5/5' && c.rango === 0 && ordenadas(c.bases) === '1/1' && ordenadas(c.interiores) === '2/2' && c.todos, 'todos sin nivel: grupos de 5 y 5 con líneas parejas', JSON.stringify(c));
// Un solo grupo.
const uno = sugerirGrupos({ van: caso.slice(0, 5), tamano: 6 });
ok(uno.grupos.length === 1 && uno.grupos[0].personas.length === 5 && uno.variantes === 1, 'un solo grupo (5 de 6 en 6): un grupo y ninguna otra sugerencia');
ok(sugerirGrupos({ van: [], tamano: 5 }).grupos.length === 0, 'nadie que vaya: ningún grupo');
const msg = mensajeGrupos('Grupos del entreno del miércoles 28', [{ nombre: 'Azules', personas: ['a1', 'a2'] }], (x) => x.toUpperCase());
ok(msg === 'Grupos del entreno del miércoles 28:\nAzules: A1, A2' && !/nivel|del domingo/i.test(msg), 'mensaje de WhatsApp: solo grupos y nombres');

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
  const privado = {};
  for (const [i, s] of sint.entries()) {
    privado[s[0]] = { posicion: POS[i % 5], base_reserva: i === 6, nivel: 'ABCDE'[i % 5] };
    await sql`insert into public.jugadores_privado (person_id, posicion, nivel, base_reserva) values (${s[0]}, ${POS[i % 5]}, ${'ABCDE'[i % 5]}, ${i === 6})`;
    await sql`insert into public.respuestas (evento_id, person_id, respuesta) values (${ent.id}, ${s[0]}, 'va')`;
  }
  await sql`insert into public.respuestas (evento_id, person_id, respuesta) values (${ent.id}, 'esteban-jon', 'va'), (${ent.id}, 'gianatti-adriano', 'va') on conflict do nothing`;
  await sql`insert into public.respuestas (evento_id, person_id, respuesta) values (${ent.id}, 'vallesi-daniele', 'duda') on conflict (evento_id, person_id) do update set respuesta = 'duda'`;
  const datoDe = (p) => privado[p] ?? { posicion: null, base_reserva: false, nivel: null };
  /** El resumen de cada grupo en pantalla coincide con el calculado con los datos de la base. */
  const resumenesBien = async (pg) => {
    const gs = await pg.getByTestId('grupo').evaluateAll((xs) => xs.map((x) => ({ ids: [...x.querySelectorAll('li[data-person]')].map((li) => li.dataset.person), r: x.querySelector('[data-testid=gr-resumen]')?.textContent ?? '' })));
    return gs.every((g) => g.r === resumenGrupo(g.ids.map(datoDe))) ? true : JSON.stringify(gs);
  };

  console.log('\n== Gestor (1280 px): sugerir, resumen, otra sugerencia, mover, renombrar, guardar');
  const pg = await e.sesion('ivan@pruebas.local', 1280);
  await pg.goto(`${APP}/gestion/grupos/${ent.id}`);
  ok(await visto(pg.getByRole('heading', { name: /Dudan/ })) && /Daniele/.test(await pg.locator('.gr-dudas').innerText()), 'los «Duda», aparte (para añadirlos a mano)');
  const html0 = await pg.content();
  ok(!/"nivel"|base_reserva|"posicion"/.test(html0), 'posición, base de reserva y nivel no viajan en el HTML de la página (llegan aparte)');
  ok(!/domingo|MdL|MdA/i.test(await pg.locator('.gr').innerText()), 'ninguna referencia al domingo en la pantalla');
  ok(await visto(pg.getByTestId('gr-sin-nivel')) && (await pg.getByTestId('gr-sin-nivel').innerText()) === '2 jugadores sin nivel: la sugerencia los cuenta como C.', 'aviso arriba: «2 jugadores sin nivel: la sugerencia los cuenta como C.»');
  ok(/sin nivel/.test(await pg.locator('li[data-person="esteban-jon"]').innerText()), 'la tarjeta del que no tiene nivel dice «sin nivel»');
  await pg.getByLabel('Jugadores por grupo').selectOption('5');
  await pg.getByRole('button', { name: 'Sugerir grupos' }).click();
  await pg.getByTestId('grupo').first().waitFor({ timeout: 15000 });
  const n = await pg.getByTestId('grupo').count();
  ok(n === 3 && (await pg.locator('.gr-sin li').count()) === 0, `la sugerencia coloca a los 12 que van en 3 grupos (${n}) de 4`);
  const r1 = await resumenesBien(pg);
  ok(r1 === true && /^Nivel medio \d,\d · \d+ interior(es)? · \d+ bases?$/.test(await pg.getByTestId('gr-resumen').first().innerText()), 'cada grupo con su resumen («Nivel medio 3,5 · 1 interior · 1 base»)', r1);
  const antes = await pg.getByTestId('grupo').evaluateAll((xs) => xs.map((x) => [...x.querySelectorAll('li[data-person]')].map((li) => li.dataset.person).join()).join('|'));
  await pg.getByRole('button', { name: 'Otra sugerencia' }).click();
  await pg.getByText(/^Sugerencia 2 de \d+/).waitFor({ timeout: 15000 });
  const despues = await pg.getByTestId('grupo').evaluateAll((xs) => xs.map((x) => [...x.querySelectorAll('li[data-person]')].map((li) => li.dataset.person).join()).join('|'));
  ok(antes !== despues && (await resumenesBien(pg)) === true, '«Otra sugerencia»: otra combinación, con su resumen');
  await pg.getByTestId('grupo').first().locator('li input[type=checkbox]').first().check();
  await pg.locator('.tb-barra').getByRole('combobox').selectOption({ index: 1 });
  await pg.locator('.tb-barra').getByRole('button', { name: 'Mover' }).click();
  ok((await pg.getByTestId('grupo').nth(1).locator('li').count()) === 5, '«Mover 1 a…» lo pasa de grupo');
  const r2 = await resumenesBien(pg);
  ok(r2 === true, 'el resumen se recalcula al mover a mano', r2);
  await pg.getByLabel('Nombre del grupo 1').fill('Azules');
  await pg.getByLabel('Nombre del reparto').fill('5 contra 5');
  await foto(pg, 'grupos_sugerencia_1280');
  await pg.getByRole('button', { name: 'Guardar como reparto nuevo' }).click();
  await pg.getByText('Reparto guardado.').waitFor({ timeout: 15000 });
  let rep = await sql`select id, nombre, grupos, publicado from public.grupos_repartos where evento_id = ${ent.id} and borrado_en is null`;
  ok(rep.length === 1 && rep[0].nombre === '5 contra 5' && rep[0].grupos[0].nombre === 'Azules' && rep[0].publicado === false && !JSON.stringify(rep[0].grupos).includes('explica'), 'guardado, sin publicar (por defecto) y sin criterio', JSON.stringify(rep));

  console.log('\n== Vista para el equipo (1280 px)');
  const interruptor = pg.getByTestId('vista-equipo-interruptor');
  ok(await visto(interruptor) && (await interruptor.getAttribute('aria-checked')) === 'false', 'interruptor «Vista para el equipo» visible junto a los grupos, apagado');
  await interruptor.click();
  await pg.getByTestId('vista-equipo').waitFor({ timeout: 5000 });
  const vista = pg.getByTestId('vista-equipo');
  const texto = await pg.locator('body').innerText();
  ok((await vista.getByRole('heading', { level: 2 }).textContent()) === '5 contra 5' && /^Entreno del (lunes|martes|miércoles|jueves|viernes|sábado|domingo) \d{1,2} de [a-z]+$/.test(await vista.locator('.ge-fecha').textContent()), 'título del reparto con la fecha del entreno («Entreno del miércoles 4 de noviembre»)', await vista.locator('.ge-fecha').textContent());
  const nombres = ['Azules', 'Jon', 'Adriano', 'Prueba0', 'Prueba6', 'Daniele'];
  ok(nombres.every((x) => texto.includes(x)) && /Dudan/.test(texto), 'grupos con su nombre y los nombres de los jugadores; «Dudan» con nombres', texto);
  ok(!/nivel|Nivel medio|interior|\bbases?\b|base de reserva|sin posición|Escolta|Alero|Ala-pívot|Pívot|\bduda\b/i.test(texto), 'el texto de la página no lleva nivel, posición, «base de reserva», «sin nivel», «duda» ni el resumen', texto);
  const letras = await pg.evaluate(() => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const out = []; while (w.nextNode()) { const t = w.currentNode.textContent.trim(); if (/^(nivel )?[A-E]$/i.test(t)) out.push(t); } return out; });
  ok(!letras.length, 'ninguna letra de nivel como etiqueta (en ningún nodo de texto, visible o no)', letras.join());
  const html = await pg.content();
  ok(!/nivel|base_reserva|base de reserva|"posicion"|escolta|alero|ala_pivot|pivot|Pívot|sin posición|tb-marca|Nivel medio/i.test(html), 'el HTML (con el inspector) no tiene niveles ni posiciones ocultos con CSS');
  const fuera = ['Sugerir grupos', 'Otra sugerencia', 'Quitar grupo', '+ Añadir grupo', 'Guardar reparto', 'Copiar mensaje de WhatsApp', 'Van sin grupo', 'Publicar a la plantilla', 'Los grupos no cuentan'];
  ok(fuera.every((x) => !html.includes(x)) && (await pg.locator('.gr input[type=checkbox]').count()) === 0, 'sin botones, casillas, ayuda ni «Van sin grupo»');
  ok(!(await pg.locator('.nv-cab').first().isVisible()) && !(await pg.locator('.gs-titulo').isVisible()), 'sin la cabecera de la web ni la de la página (pantallazo limpio)');
  ok((await sql`select grupos from public.grupos_repartos where evento_id = ${ent.id} and borrado_en is null`)[0].grupos[0].nombre === 'Azules', 'no guarda ni toca nada');
  await foto(pg, 'grupos_vista_equipo_1280');
  await interruptor.click();
  ok(await visto(pg.getByRole('button', { name: 'Sugerir grupos' })) && (await resumenesBien(pg)) === true && await visto(pg.locator('.tb-marca')) && await pg.locator('.nv-cab').first().isVisible(), 'otro clic en el interruptor: vuelve todo (botones, etiquetas, resumen y cabecera)');
  await interruptor.click();
  await pg.getByTestId('vista-equipo').waitFor({ timeout: 5000 });
  await pg.reload();
  ok(await visto(pg.getByRole('button', { name: 'Sugerir grupos' })) && (await pg.getByTestId('vista-equipo').count()) === 0 && (await pg.getByTestId('vista-equipo-interruptor').getAttribute('aria-checked')) === 'false', 'al recargar sale la vista normal');

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
  ok(/^Grupos del entreno del/.test(wa) && /Azules: /.test(wa) && !/nivel|del domingo|interior|base/i.test(wa), '«Copiar mensaje de WhatsApp»: grupos y nombres, nada más');
  rep = (await sql`select grupos from public.grupos_repartos where evento_id = ${ent.id} and publicado`)[0].grupos;
  const suyo = rep.find((x) => x.personas.includes('esteban-jon'));
  const mios = (await (await fetch(`${e.pila.url}/rest/v1/rpc/mis_grupos`, { method: 'POST', headers: { apikey: e.pila.anonKey, authorization: `Bearer ${P['esteban-jon'].token}`, 'content-type': 'application/json' }, body: '{}' })).json());
  ok(mios.length === 1 && mios[0].grupo === suyo.nombre && mios[0].companeros.length === suyo.personas.length - 1 && !JSON.stringify(mios).match(/nivel|explica|posicion/), 'mis_grupos (base): solo el nombre de su grupo y sus compañeros', JSON.stringify(mios));
  const leer = await (await fetch(`${e.pila.url}/rest/v1/grupos_repartos?select=grupos`, { headers: { apikey: e.pila.anonKey, authorization: `Bearer ${P['esteban-jon'].token}` } })).json();
  ok(Array.isArray(leer) && leer.length === 0, 'un jugador NO lee los repartos (RLS: solo gestores)');
  const pj = await e.sesion('jon@pruebas.local', 375);
  const tg = pj.getByTestId('tu-grupo').first();
  ok(await visto(tg) && (await tg.innerText()).includes(`Tu grupo: ${suyo.nombre}`), `inicio: «Tu grupo: ${suyo.nombre}» en el entreno`);
  const htmlJ = (await pj.content()).replace(/<script[\s\S]*?<\/script>/g, '');
  const otro = rep.find((x) => !x.personas.includes('esteban-jon'));
  ok(!/nivel/i.test(htmlJ) && (!otro || !htmlJ.includes(otro.nombre === suyo.nombre ? '§' : `Tu grupo: ${otro.nombre}`)), 'nunca niveles ni otros grupos');
  await pj.goto(`${APP}/agenda`);
  ok(await visto(pj.getByTestId('tu-grupo')), 'agenda: también «Tu grupo»');
  ok(await sinDesbordar(pj), 'a 375 px sin desbordamiento');

  console.log('\n== Gestor a 375 px: vista normal y vista para el equipo');
  const pg375 = await e.nuevaPagina(await e.contexto(375));
  await pg375.context().addCookies(await pg.context().cookies());
  await pg375.goto(`${APP}/gestion/grupos/${ent.id}`);
  await pg375.getByTestId('gr-resumen').first().waitFor({ timeout: 10000 });
  ok(await sinDesbordar(pg375), 'grupos (gestor) a 375 px sin desbordamiento');
  await foto(pg375, 'grupos_sugerencia_375');
  await pg375.getByTestId('vista-equipo-interruptor').click();
  await pg375.getByTestId('vista-equipo').waitFor({ timeout: 5000 });
  ok(await sinDesbordar(pg375), 'vista para el equipo a 375 px sin desbordamiento');
  const alto = await pg375.getByTestId('vista-equipo').evaluate((x) => x.getBoundingClientRect().bottom);
  ok(alto <= 812, `la vista para el equipo cabe en una pantalla de móvil (${Math.round(alto)} px de 812)`);
  ok(!(await pg375.locator('.nv-barra').first().isVisible()), 'sin la barra inferior de la web');
  await foto(pg375, 'grupos_vista_equipo_375', false);
  ok(!e.errores.length, 'sin errores de consola', e.errores.slice(0, 5).join(' | '));
} catch (err) { console.error(err); sumar(); } finally {
  await e.parar();
}
console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK');
process.exit(fallos() ? 1 : 0);
