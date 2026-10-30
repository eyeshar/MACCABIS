#!/usr/bin/env node
// Disponibilidad por defecto (D146) de extremo a extremo: pila local, web compilada y Chrome. Jugadores SINTÉTICOS (D39).
//   - Datos de los jugadores: las dos casillas, su línea de ayuda (la diferencia con el «solo entreno» del rol) y guardar.
//   - Panel, «Entreno del miércoles»: «N no van por defecto (no suelen entrenar): nombres», cuentan en «no van» con la nota,
//     y «Pasar a «sin responder»» solo para ese entreno (y deshacerlo).
//   - Respuestas del entreno: «No va (por defecto)», fuera de «Pedir recordatorio a Claude»; si responde «voy», va.
//   - Partido: la marca «no suele entrenar» no cuenta; «nunca a partidos» sin responder no sale como pendiente.
//   - Tablero de un entreno: las mismas cifras que el Panel (también tras «pasar a sin responder»); de un partido, sin los «nunca a partidos».
//   - Grupos: no salen en «van» salvo que hayan dicho «voy».
//   - Convocatoria: un «nunca a partidos» que dice «voy» sale en «Disponibles sin convocar» con su motivo (regla 1.7).
//   - El jugador marcado, en su zona (375 px): nada de las marcas.
//
//   npm run pruebas:disponibilidad-pantallas
import { preparar, personas, sinteticos, contador, visto, sinDesbordar, pequenos } from './comun_e2e.mjs';
import { adelantar, semanas } from './fechas_prueba.mjs';

const { ok, fallos, sumar } = contador();
const e = await preparar();
const { sql, APP } = e;
try {
  const F = await adelantar(sql, semanas('2026-10-25'));
  const J3 = F('2026-10-25');
  const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  // Luz y Teo «no suelen entrenar» (Teo responde «voy»); Ugo es «nunca a partidos» (con fichas, para probar el motor);
  // Ana y Bea, sin marca (Bea dice «voy»).
  await sinteticos(sql, [['sint-luz', 'Luz', true, false], ['sint-teo', 'Teo', true, true], ['sint-ugo', 'Ugo', true, true], ['sint-ana', 'Ana', true, true], ['sint-bea', 'Bea', true, true]]);
  for (const [p, pos, niv, nse, nap] of [['sint-luz', 'base', 'B', true, false], ['sint-teo', 'pivot', 'C', true, false], ['sint-ugo', 'alero', 'A', false, true], ['sint-ana', 'escolta', 'C', false, false], ['sint-bea', 'alero', 'D', false, false]]) {
    await sql`insert into public.jugadores_privado (person_id, posicion, nivel, dobla, no_suele_entrenar, nunca_partidos) values (${p}, ${pos}, ${niv}, ${!nap}, ${nse}, ${nap})`;
  }
  await personas(e.pila, { jugadores: [['sint-luz', 'luz@pruebas.local']], gestores: [['Iván', 'gestor@pruebas.local', 'villaescusa-silva-ivan']] });
  const [ent] = await sql`select id, fecha::text from public.eventos where tipo = 'entreno' and estado = 'programado' and fecha >= ${hoy} order by fecha limit 1`;
  const [mda] = await sql`select id from public.eventos where tipo = 'liga' and equipo = 'MdA' and fecha = ${J3}`;
  await sql`insert into public.respuestas (evento_id, person_id, respuesta, origen) values (${ent.id}, 'sint-teo', 'va', 'jugador'), (${ent.id}, 'sint-bea', 'va', 'jugador'), (${mda.id}, 'sint-bea', 'va', 'jugador')`;

  const pg = await e.sesion('gestor@pruebas.local', 1280);

  console.log('\n== Datos de los jugadores');
  await pg.goto(`${APP}/gestion/convocatoria/datos`);
  ok(await visto(pg.getByTestId('ayuda-defecto')), 'sale la línea de ayuda de la disponibilidad por defecto');
  const ayuda = await pg.getByTestId('ayuda-defecto').innerText();
  ok(/No suele entrenar/.test(ayuda) && /nunca a partidos/.test(ayuda) && /cubrir un hueco/.test(ayuda) && /no lo ven nunca/.test(ayuda), 'explica las dos marcas y la diferencia con el «solo entreno» de Jugadores', ayuda);
  const ficha = (p) => pg.locator(`form.cv-ficha[data-person="${p}"]`);
  ok(await ficha('sint-luz').locator('[data-campo="no_suele_entrenar"]').isChecked() && !(await ficha('sint-luz').locator('[data-campo="nunca_partidos"]').isChecked()), 'Luz: «No suele entrenar» marcada');
  ok(await ficha('sint-ugo').locator('[data-campo="nunca_partidos"]').isChecked() && !(await ficha('sint-ugo').locator('input[type=checkbox]').nth(1).isChecked()), 'Ugo: «Solo entreno: nunca a partidos» marcada y Dobla = no');
  await ficha('sint-ana').locator('[data-campo="nunca_partidos"]').check();
  await ficha('sint-ana').getByRole('button', { name: 'Guardar' }).click();
  ok(await visto(ficha('sint-ana').getByText('Guardado')), 'guardar una marca nueva: «Guardado»');
  ok((await sql`select nunca_partidos, no_suele_entrenar from public.jugadores_privado where person_id = 'sint-ana'`)[0]?.nunca_partidos === true, 'y queda en la base');
  await ficha('sint-ana').locator('[data-campo="nunca_partidos"]').uncheck();
  await ficha('sint-ana').getByRole('button', { name: 'Guardar' }).click();
  await visto(ficha('sint-ana').getByText('Guardado'));
  ok((await sql`select nunca_partidos from public.jugadores_privado where person_id = 'sint-ana'`)[0]?.nunca_partidos === false, 'y se puede quitar');

  console.log('\n== Panel: «Entreno del miércoles»');
  await pg.goto(`${APP}/gestion`);
  ok(await visto(pg.getByTestId('por-defecto-linea')), 'sale el aviso de los «no van por defecto»');
  const linea = await pg.getByTestId('por-defecto-linea').innerText();
  ok(/^1 no va por defecto \(no suele entrenar\): Luz\./.test(linea), '«1 no va por defecto (no suele entrenar): Luz» (Teo respondió «voy»: no sale)', linea);
  ok(await visto(pg.getByTestId('respuestas-entreno')), 'el recuadro enseña las respuestas (las de verdad: Teo y Bea)');
  await pg.getByTestId('entreno-numeros-no').click();
  const noVan = await pg.getByTestId('entreno-numeros-lista').innerText();
  ok(/Luz/.test(noVan) && /Por defecto: no suele entrenar/.test(noVan), 'Luz cuenta en «no van», con la nota «Por defecto: no suele entrenar»', noVan);
  await pg.getByTestId('entreno-numeros-sin').click();
  const sinR = await pg.getByTestId('entreno-numeros-lista').innerText();
  ok(/Ana/.test(sinR) && !/Luz/.test(sinR), 'en «sin responder» está Ana (sin marca) y no Luz', sinR);
  await pg.getByTestId('entreno-numeros-va').click();
  const van = await pg.getByTestId('entreno-numeros-lista').innerText();
  ok(/Teo/.test(van) && /Bea/.test(van), 'Teo («no suele entrenar» pero dijo «voy») va', van);
  await pg.getByTestId('por-defecto').getByText('Cambiar para este entreno').click();
  await pg.locator('[data-quitar="sint-luz"]').click();
  ok(await visto(pg.getByTestId('por-defecto-quitados')), 'tras «Pasar a «sin responder»», Luz sale como «sin responder solo en este entreno»');
  ok((await sql`select count(*)::int n from public.entreno_defecto_quitado where evento_id = ${ent.id} and person_id = 'sint-luz'`)[0].n === 1, 'y queda en la base, solo para este entreno');
  await pg.reload();
  await pg.getByTestId('entreno-numeros-sin').click();
  ok(/Luz/.test(await pg.getByTestId('entreno-numeros-lista').innerText()), 'ahora cuenta en «sin responder»');
  ok(!(await pg.getByTestId('por-defecto-linea').count()), 'y ya no sale en la línea de «no van por defecto»');
  await pg.getByTestId('por-defecto').getByText('Cambiar para este entreno').click();
  await pg.locator('[data-devolver="sint-luz"]').click();
  ok(await visto(pg.getByTestId('por-defecto-linea')), '«Volver a «no va (por defecto)»» lo deshace');
  ok((await sql`select count(*)::int n from public.entreno_defecto_quitado`)[0].n === 0, 'y borra la excepción');
  const pm = await e.sesion('gestor@pruebas.local', 375);
  await pm.goto(`${APP}/gestion`);
  await pm.getByTestId('por-defecto').getByText('Cambiar para este entreno').click();
  ok(await sinDesbordar(pm), 'Panel a 375 px: sin desbordar');
  const chicos = await pequenos(pm, '[data-testid="por-defecto"] button, [data-testid="por-defecto"] summary');
  ok(!chicos.length, 'y los botones del aviso tienen al menos 44 px', JSON.stringify(chicos));

  console.log('\n== Tablero del entreno: las mismas cifras que el Panel');
  const cifrasPanel = async () => {
    await pg.goto(`${APP}/gestion`);
    const n = async (k) => Number((await pg.getByTestId(`entreno-numeros-${k}`).innerText()).match(/\d+/)[0]);
    return { va: await n('va'), dudaYSin: (await n('duda')) + (await n('sin')), no: await n('no') };
  };
  const cifrasTablero = async () => {
    await pg.goto(`${APP}/gestion/tablero?evento=${ent.id}`);
    await visto(pg.getByTestId('columna-no'));
    const c = async (k) => pg.getByTestId(`columna-${k}`).locator('[data-person]').count();
    return { va: await c('va'), dudaYSin: await c('duda'), no: await c('no') };
  };
  let cp = await cifrasPanel(), ct = await cifrasTablero();
  ok(JSON.stringify(cp) === JSON.stringify(ct), `mismas cifras en el Panel y en el tablero (van ${ct.va} · dudan o sin responder ${ct.dudaYSin} · no van ${ct.no})`, `${JSON.stringify(cp)} / ${JSON.stringify(ct)}`);
  const luzNo = pg.getByTestId('columna-no').locator('[data-person="sint-luz"]');
  ok(await visto(luzNo) && /Por defecto: no suele entrenar/.test(await luzNo.innerText()), 'Luz, en «No van» del tablero, con «Por defecto: no suele entrenar»');
  ok(await visto(pg.getByTestId('columna-va').locator('[data-person="sint-teo"]')), 'Teo (dijo «voy») en «Van»');
  await sql`insert into public.entreno_defecto_quitado (evento_id, person_id, por_nombre) values (${ent.id}, 'sint-luz', 'Iván')`;
  cp = await cifrasPanel(); ct = await cifrasTablero();
  ok(JSON.stringify(cp) === JSON.stringify(ct) && await visto(pg.getByTestId('columna-duda').locator('[data-person="sint-luz"]')), 'pasada a «sin responder» para este entreno: Luz en «Duda o sin responder», y siguen cuadrando', `${JSON.stringify(cp)} / ${JSON.stringify(ct)}`);
  await sql`delete from public.entreno_defecto_quitado`;
  await pg.goto(`${APP}/gestion/tablero?evento=${mda.id}`);
  await visto(pg.getByTestId('columna-no'));
  ok(!(await pg.locator('[data-person="sint-ugo"]').count()) && (await pg.getByTestId('columna-duda').locator('[data-person="sint-luz"]').count()) === 1, 'tablero de un partido: Ugo («nunca a partidos», sin responder) no sale; Luz sí, como «sin responder»');

  console.log('\n== Respuestas del entreno y «Pedir recordatorio a Claude» (interruptor apagado)');
  await pg.goto(`${APP}/gestion/eventos/${ent.id}/respuestas`);
  const filaLuz = pg.locator('tr[data-respuesta]').filter({ hasText: 'Luz' });
  ok((await filaLuz.getAttribute('data-respuesta')) === 'no' && /No va \(por defecto\)/.test(await filaLuz.innerText()) && /no suele entrenar/.test(await filaLuz.innerText()), 'Luz: «No va (por defecto)» con su nota', await filaLuz.innerText());
  ok((await pg.locator('tr[data-respuesta]').filter({ hasText: 'Teo' }).getAttribute('data-respuesta')) === 'va', 'Teo: va (manda su respuesta)');
  await pg.getByTestId('recordatorio').locator('summary').click();
  const rec = await pg.getByTestId('recordatorio').innerText();
  ok(/Ana/.test(rec) && !/Luz/.test(rec), 'el recordatorio para Claude lleva a Ana y NO a Luz', rec.slice(0, 300));

  console.log('\n== Partido: la marca «no suele entrenar» no cuenta; «nunca a partidos» no es pendiente');
  await pg.goto(`${APP}/gestion/eventos/${mda.id}/respuestas`);
  const tabla = await pg.getByTestId('tabla-respuestas').innerText();
  ok((await pg.locator('tr[data-respuesta]').filter({ hasText: 'Luz' }).getAttribute('data-respuesta')) === 'sin_responder', 'Luz, en el partido: «sin responder» (como siempre)');
  ok(!/\bUgo\b/.test(tabla), 'Ugo («nunca a partidos») no sale como pendiente del partido');
  await pg.getByTestId('recordatorio').locator('summary').click();
  const recP = await pg.getByTestId('recordatorio').innerText();
  ok(/Luz/.test(recP) && !/Ugo/.test(recP), 'y el recordatorio del partido lleva a Luz y no a Ugo', recP.slice(0, 300));

  console.log('\n== Grupos del entreno');
  await pg.goto(`${APP}/gestion/grupos/${ent.id}`);
  ok(/2 dicen «Voy»/.test(await pg.locator('.gs-titulo').innerText()), '«2 dicen «Voy»» (Teo y Bea)', await pg.locator('.gs-titulo').innerText());
  const pool = await pg.locator('.gr-sin').innerText();
  ok(/Teo/.test(pool) && /Bea/.test(pool) && !/Luz/.test(pool), 'en «Van sin grupo» están Teo y Bea, no Luz', pool);

  console.log('\n== Convocatoria: un «nunca a partidos» que dice «voy» no se propone (regla 1.7)');
  await sql`insert into public.respuestas (evento_id, person_id, respuesta, origen) values (${mda.id}, 'sint-ugo', 'va', 'jugador')`;
  await pg.goto(`${APP}/gestion/convocatoria?fecha=${J3}`);
  ok(await visto(pg.getByText('Solo entreno: nunca a partidos')), 'vista previa: sale en «Disponibles sin convocar» con «Solo entreno: nunca a partidos»');
  await pg.getByRole('button', { name: 'Usar propuesta' }).click();
  ok(await visto(pg.getByTestId('cv-estado').getByText('Borrador')), '«Usar propuesta» → borrador');
  ok(await visto(pg.getByText('Solo entreno: nunca a partidos')), 'y en el borrador sigue fuera, con su motivo');
  const fila = await sql`select equipos from public.convocatorias where fecha = ${J3}`;
  ok(!JSON.stringify(fila[0]?.equipos ?? {}).includes('sint-ugo'), 'y la propuesta guardada no lo lleva', JSON.stringify(fila[0]?.equipos ?? null));

  console.log('\n== El jugador marcado, en su zona (375 px): nada de las marcas');
  const pj = await e.sesion('luz@pruebas.local', 375);
  for (const ruta of ['/', `/mi-zona/evento/${ent.id}`, '/mi-zona']) {
    await pj.goto(`${APP}${ruta}`);
    const html = await pj.content();
    ok(!/por defecto|suele entrenar|nunca a partidos|nunca_partidos|no_suele/i.test(html), `${ruta}: ni en la página ni en el HTML`);
    ok(await sinDesbordar(pj), `${ruta}: sin desbordar a 375 px`);
  }
  const r = await pj.goto(`${APP}/gestion/convocatoria/datos`);
  ok(!/\/gestion\/convocatoria\/datos/.test(pj.url()) || r.status() >= 400, 'Datos de los jugadores no se abre para un jugador', pj.url());
  ok(!e.errores.length, 'sin errores en la consola', e.errores.join(' | '));
} catch (err) {
  console.log(`  FALLO ${err.stack}`); sumar();
} finally {
  await e.parar();
}
console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK');
process.exit(fallos() ? 1 : 0);
