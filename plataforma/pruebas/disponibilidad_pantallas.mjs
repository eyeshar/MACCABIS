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
//   - Ausencias por periodo (D150): sin respuesta y con una ausencia, «no van» en el Panel, el tablero (evento y domingo),
//     las respuestas y los grupos, con el motivo solo para gestores, y fuera de «Pedir recordatorio a Claude»; si responde,
//     gana su respuesta. Panel y tablero, con los mismos datos, dan las mismas cifras con ausencias, con «no suele
//     entrenar» y con «solo con ficha».
//   - Panel a 375 px: «Partidos del domingo» en tarjetas, sin desbordar; en escritorio, la tabla.
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
  // Para las ausencias (D150, al final): Vicaus y Noaus con ficha; Solsf y Pausf sin ficha (la lista de jugadores se lee
  // al arrancar: se crean aquí).
  await sinteticos(sql, [['sint-vic', 'Vicaus', true, true], ['sint-noa', 'Noaus', true, true], ['sint-sol', 'Solsf', false, false], ['sint-pau', 'Pausf', false, false]]);
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

  console.log('\n== Ausencias por periodo (D150): cuentan como «no va» en todas las pantallas');
  await sql`delete from public.respuestas where evento_id = ${mda.id} and person_id = 'sint-ugo'`;
  // Vic: ausencia y sin responder. Noa: ausencia pero dice «voy» al entreno (gana su respuesta). Luz («no suele entrenar»):
  // además, una ausencia sin fecha de vuelta (cuenta por la ausencia). Sol y Pau, sin ficha (Sol dice «voy», Pau ausente).
  const [desde, hasta] = [ent.fecha, J3].sort();
  await sql`insert into public.ausencias_periodo (person_id, desde, hasta, motivo, origen) values
    ('sint-vic', ${desde}, ${hasta}, 'viaje', 'jugador'), ('sint-noa', ${desde}, ${hasta}, 'trabajo', 'jugador'),
    ('sint-luz', ${desde}, null, 'lesion', 'gestor'), ('sint-pau', ${desde}, ${hasta}, 'otro', 'jugador')`;
  await sql`insert into public.respuestas (evento_id, person_id, respuesta, origen) values (${ent.id}, 'sint-noa', 'va', 'jugador'), (${ent.id}, 'sint-sol', 'va', 'sporteasy')`;
  const lista = async (pagina, prueba, k) => { await pagina.getByTestId(`${prueba}-${k}`).click(); const t = await pagina.getByTestId(`${prueba}-lista`).innerText(); await pagina.getByTestId(`${prueba}-${k}`).click(); return t; };

  for (const conFicha of [false, true]) {
    if (conFicha) {
      // «Solo con ficha» (D148): el entreno pasa a una pista con la marca; Sol y Pau dejan de estar invitados.
      await sql`update public.pistas set solo_con_ficha = true where slug = 'valdebernardo'`;
      await sql`update public.eventos set pista_id = (select id from public.pistas where slug = 'valdebernardo'), ubicacion_nombre = null where id = ${ent.id}`;
      ok((await sql`select public.solo_con_ficha_en(e) s from public.eventos e where id = ${ent.id}`)[0].s !== null, 'el entreno queda en una pista «solo con ficha»');
    }
    const cual = conFicha ? 'con «solo con ficha»' : 'pista sin marca';
    cp = await cifrasPanel();
    const noVan = await lista(pg, 'entreno-numeros', 'no'), vanP = await lista(pg, 'entreno-numeros', 'va'), sinP = await lista(pg, 'entreno-numeros', 'sin');
    ok(/Vicaus/.test(noVan) && /Ausente del .*\(Viaje\)/.test(noVan), `Panel (${cual}): Vic, sin responder y ausente, en «no van» con su ausencia y motivo`, noVan);
    ok(/Luz/.test(noVan) && /Ausente del .*sin fecha de vuelta \(Lesión\)/.test(noVan) && !(await pg.getByTestId('por-defecto-linea').count()), `Panel (${cual}): Luz cuenta por la ausencia (sin fecha de vuelta), no por defecto`, noVan);
    ok(/Noaus/.test(vanP) && !/Noaus/.test(noVan), `Panel (${cual}): Noa dijo «voy»: gana su respuesta`, vanP);
    ok(!/Vicaus|Luz/.test(sinP) && /Ana/.test(sinP), `Panel (${cual}): ni Vic ni Luz en «sin responder»; Ana sí`, sinP.replace(/\n/g, ' · '));
    ok(conFicha ? !/Solsf|Pausf/.test(noVan + vanP + sinP) : /Solsf/.test(vanP) && /Pausf/.test(noVan), conFicha ? 'Panel: Sol y Pau (sin ficha) fuera de los contadores' : 'Panel: sin la marca de la pista, Sol va y Pau no va (ausente)', noVan + ' | ' + vanP);
    ct = await cifrasTablero();
    ok(JSON.stringify(cp) === JSON.stringify(ct), `mismas cifras en el Panel y en el tablero del entreno, ${cual} (van ${ct.va} · dudan o sin responder ${ct.dudaYSin} · no van ${ct.no})`, `${JSON.stringify(cp)} / ${JSON.stringify(ct)}`);
    const vicT = pg.getByTestId('columna-no').locator('[data-person="sint-vic"]');
    ok(await visto(vicT) && /Ausente del/.test(await vicT.innerText()), `tablero (${cual}): Vic en «No van» con su ausencia`);
    ok((await pg.getByTestId('columna-va').locator('[data-person="sint-noa"]').count()) === 1, `tablero (${cual}): Noa en «Van»`);
  }

  // Domingo: el partido del MdA en el Panel (si es el domingo que enseña) y su tablero dan lo mismo; el tablero del domingo
  // pone a Vic en «No van».
  await pg.goto(`${APP}/gestion/tablero?evento=${mda.id}`);
  await visto(pg.getByTestId('columna-no'));
  const cMda = { va: await pg.getByTestId('columna-va').locator('[data-person]').count(), dudaYSin: await pg.getByTestId('columna-duda').locator('[data-person]').count(), no: await pg.getByTestId('columna-no').locator('[data-person]').count() };
  ok((await pg.getByTestId('columna-no').locator('[data-person="sint-vic"]').count()) === 1, 'tablero del partido: Vic (ausente, sin responder) en «No van»');
  await pg.goto(`${APP}/gestion`);
  if (await pg.getByTestId(`respuestas-${mda.id}`).count()) {
    const n = async (k) => Number((await pg.getByTestId(`respuestas-${mda.id}-${k}`).innerText()).match(/\d+/)[0]);
    const cPanel = { va: await n('va'), dudaYSin: (await n('duda')) + (await n('sin')), no: await n('no') };
    ok(JSON.stringify(cPanel) === JSON.stringify(cMda), `Panel y tablero del partido del MdA: mismas cifras (no van ${cMda.no})`, `${JSON.stringify(cPanel)} / ${JSON.stringify(cMda)}`);
  } else console.log('  (el Panel enseña otro domingo: el partido se comprueba en su tablero y en el del domingo)');
  await pg.goto(`${APP}/gestion/tablero?domingo=${J3}`);
  await visto(pg.getByTestId('tabla-novan'));
  const vicD = pg.getByTestId('tabla-novan').locator('[data-person="sint-vic"]');
  ok(await visto(vicD) && /Ausente del/.test(await vicD.innerText()), 'tablero del domingo: Vic en «No van», con su ausencia', await pg.getByTestId('tabla-novan').innerText().catch(() => ''));
  ok(!(await pg.getByTestId('tabla-juegan').locator('[data-person="sint-vic"]').count()), 'y no en «Duda o sin responder»');

  await pg.goto(`${APP}/gestion/eventos/${ent.id}/respuestas`);
  const filaVic = pg.locator('tr[data-respuesta]').filter({ hasText: 'Vicaus' });
  ok((await filaVic.getAttribute('data-respuesta')) === 'no', 'respuestas del entreno: Vic, «no va» por su ausencia', await filaVic.innerText());
  await pg.getByTestId('recordatorio').locator('summary').click();
  const recA = await pg.getByTestId('recordatorio').innerText();
  ok(/Ana/.test(recA) && !/Vicaus|Luz/.test(recA), '«Pedir recordatorio a Claude»: Ana sí; ni Vic ni Luz (ausencia sin fecha de vuelta)', recA.slice(0, 300));

  await pg.goto(`${APP}/gestion/grupos/${ent.id}`);
  const poolA = await pg.locator('.gr-sin').innerText();
  ok(/3 dicen «Voy»/.test(await pg.locator('.gs-titulo').innerText()) && /Noaus/.test(poolA) && !/Vicaus|Luz|Solsf/.test(poolA), 'grupos: «3 dicen «Voy»» (Teo, Bea y Noa); ni Vic ni Luz (ausentes) ni Sol (sin ficha)', poolA);

  console.log('\n== Panel a 375 px: «Partidos del domingo» en tarjetas');
  await pm.goto(`${APP}/gestion`);
  ok(await sinDesbordar(pm), 'Panel a 375 px, con ausencias y contadores: sin desbordar');
  const tarjeta = pm.locator('.gs-partidos tr.eq-partido').first();
  ok((await tarjeta.evaluate((el) => getComputedStyle(el).display)) === 'grid' && (await tarjeta.evaluate((el) => el.getBoundingClientRect().right <= document.documentElement.clientWidth)), 'cada partido es una tarjeta que cabe en el ancho');
  const resp = tarjeta.locator('td[data-label="Respuestas"]');
  if (await resp.locator('[data-testid="enlace-respuestas"]').count()) {
    ok(await resp.evaluate((td) => { const a = td.querySelector('[data-testid="enlace-respuestas"]').getBoundingClientRect(); return a.width > 0 && a.right <= td.getBoundingClientRect().right + 1; }), '«Ver respuestas y motivos» entero dentro de la tarjeta (no se corta)');
  }
  await pg.goto(`${APP}/gestion`);
  ok((await pg.locator('.gs-partidos tr.eq-partido').first().evaluate((el) => getComputedStyle(el).display)) === 'table-row', 'en escritorio, la tabla de siempre');

  console.log('\n== El jugador marcado, en su zona (375 px): nada de las marcas');
  const pj = await e.sesion('luz@pruebas.local', 375);
  for (const ruta of ['/', `/mi-zona/evento/${ent.id}`, '/mi-zona']) {
    await pj.goto(`${APP}${ruta}`);
    const html = await pj.content();
    ok(!/por defecto|suele entrenar|nunca a partidos|nunca_partidos|no_suele/i.test(html), `${ruta}: ni en la página ni en el HTML`);
    ok(!/Ausente del/.test(html), `${ruta}: tampoco la nota de una ausencia (solo gestores)`);
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
