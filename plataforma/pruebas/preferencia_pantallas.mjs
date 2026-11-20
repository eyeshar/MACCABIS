#!/usr/bin/env node
// Preferencia de partido (D194) en pantalla: pila local, web compilada y Chrome (375 y 1280 px). Jugadores SINTÉTICOS y
// el calendario de prueba (D185), nunca datos reales. Nunca imprime notas ni motivos.
//   - Jugador: con «A los dos» sale «¿Prefieres alguno?»; estrella (una a la vez; volver a pulsar la quita), motivo
//     OBLIGATORIO («Guardar preferencia» no se pulsa sin él), «Otro» exige nota; «Sin guardar…» si toca algo y no guarda;
//     al irse por un enlace sin guardar, el diálogo «No has guardado tu preferencia»; guardada, «★ Tu preferido» en su
//     tarjeta. Con «Solo al de…» o una sola ficha, no sale nada.
//   - Gestor: ★ junto al jugador en el tablero de convocatoria y en las respuestas del evento; al pulsarla, el motivo y la
//     nota debajo, en línea (norma 13), y otro toque lo cierra; la leyenda.
//   - Privacidad: otro jugador no ve nada de la preferencia de nadie en la página del domingo (ni en el HTML).
//
//   npm run pruebas:preferencia-pantallas
import path from 'node:path';
import fs from 'node:fs';
import { preparar, personas, sinteticos, contador, visto, sinDesbordar, pequenos, trasAccion, hasta, REPO } from './comun_e2e.mjs';
import { hoyMadrid } from './fechas_prueba.mjs';
import { conCapturas } from './infra/app.mjs';

const { ok, fallos, sumar } = contador();
const CAPT = path.join(REPO, 'privado', 'mockups_liga', 'rediseno', 'preferencia');
const foto = async (p, n) => { if (!conCapturas()) return; fs.mkdirSync(CAPT, { recursive: true }); await p.screenshot({ path: path.join(CAPT, `real_${n}.png`), fullPage: true }).catch(() => {}); };
const e = await preparar();
const { sql, APP } = e;
try {
  const hoy = hoyMadrid();
  const [D] = await sql`select fecha::text, array_agg(id order by inicio, equipo) ids, array_agg(equipo order by inicio, equipo) eqs, count(distinct inicio)::int horas
    from public.eventos where tipo = 'liga' and estado = 'programado' and fecha > ${hoy} group by fecha having count(*) = 2 order by fecha limit 1`;
  ok(!!D && D.horas === 2, 'calendario de prueba: un domingo futuro con MdA y MdL a horas distintas', JSON.stringify(D ?? null));
  await sinteticos(sql, [['sint-pf-ana', 'Ana', true, true], ['sint-pf-beto', 'Beto', true, true], ['sint-pf-cira', 'Cira', true, false]]);
  const P = await personas(e.pila, {
    jugadores: [['sint-pf-ana', 'ana@pruebas.local'], ['sint-pf-beto', 'beto@pruebas.local'], ['sint-pf-cira', 'cira@pruebas.local']],
    gestores: [['Iván', 'gestor@pruebas.local', null]],
  });
  const URL_D = `${APP}/mi-zona/domingo/${D.fecha}`;
  const pref = async () => (await sql`select evento_id, motivo from public.preferencias_domingo where person_id = 'sint-pf-ana' and fecha = ${D.fecha}`)[0] ?? null;
  const [eqA, eqB] = D.eqs;

  console.log(`\n== Jugadora con las dos fichas (${D.fecha}), 375 px`);
  const pj = await e.sesion('ana@pruebas.local', 375);
  await pj.goto(URL_D);
  ok(!(await pj.getByTestId('preferencia').count()), 'sin responder: no sale «¿Prefieres alguno?»');
  await trasAccion(pj, () => pj.getByRole('button', { name: 'A los dos' }).click());
  ok(await visto(pj.getByTestId('preferencia')), '«A los dos»: sale «¿Prefieres alguno?» con las dos estrellas');
  ok(/Es una preferencia: intentaremos tenerla en cuenta, pero no es seguro\./.test(await pj.getByTestId('preferencia').innerText()), 'con la línea fija «Es una preferencia…»');
  ok(!(await pj.getByTestId('pf-guardar').count()), 'sin estrella: ni motivos ni botón');
  await pj.getByTestId(`pf-estrella-${eqB}`).click();
  ok(await pj.getByTestId(`pf-estrella-${eqB}`).getAttribute('aria-pressed') === 'true' && await pj.getByTestId(`pf-estrella-${eqA}`).getAttribute('aria-pressed') === 'false', `estrella en el ${eqB} (solo una)`);
  ok(await pj.getByTestId('pf-guardar').isDisabled(), 'sin motivo, «Guardar preferencia» no se puede pulsar (motivo obligatorio)');
  ok(await visto(pj.getByTestId('pf-sin-guardar')) && /Elige un motivo/.test(await pj.getByTestId('pf-pista').innerText()), '«Sin guardar…» y «Elige un motivo para guardar.»');
  const ninguna = !(await pref());
  ok(ninguna, 'nada guardado sin pulsar «Guardar»');
  await foto(pj, 'jugador_sin_motivo_375');
  await pj.getByTestId('pf-motivo-otro').click();
  ok(await pj.getByTestId('pf-guardar').isDisabled() && /Otro/.test(await pj.getByTestId('pf-pista').innerText()), '«Otro» sin nota: tampoco se puede guardar');
  await pj.getByTestId('pf-motivo-ninos').click();
  await pj.getByTestId('pf-nota').fill('Nota sintética de prueba');
  ok(!(await pj.getByTestId('pf-guardar').isDisabled()), 'con motivo, se puede guardar');
  ok(!(await pequenos(pj, '.pf-partido, .pf-chip, .pf-guardar')).length, 'estrellas, motivos y botón de al menos 44 px', JSON.stringify(await pequenos(pj, '.pf-partido, .pf-chip, .pf-guardar')));
  ok(await sinDesbordar(pj), '375 px sin desbordar');

  console.log('\n== Salir sin guardar');
  await pj.getByTestId('volver').click();
  ok(await visto(pj.getByTestId('pf-dialogo')) && /No has guardado tu preferencia/.test(await pj.getByTestId('pf-dialogo').innerText()), 'al irse por un enlace: «No has guardado tu preferencia»');
  ok(new URL(pj.url()).pathname === `/mi-zona/domingo/${D.fecha}`, 'y se queda en la página hasta que elija');
  await foto(pj, 'jugador_sin_guardar_375');
  await pj.getByRole('button', { name: 'Seguir aquí' }).click();
  ok(await hasta(async () => !(await pj.getByTestId('pf-dialogo').isVisible())), '«Seguir aquí» cierra el diálogo');

  console.log('\n== Guardar');
  await trasAccion(pj, () => pj.getByTestId('pf-guardar').click());
  ok(await hasta(async () => (await pref())?.evento_id === D.ids[1]), `guardada en la base: el ${eqB}, motivo «niños»`);
  ok(await hasta(async () => !(await pj.getByTestId('pf-sin-guardar').count())), 'ya no dice «Sin guardar»');
  await pj.reload();
  ok(await visto(pj.getByTestId('pf-tu-preferido')) && (await pj.getByTestId(`partido-${eqB}`).innerText()).includes('Tu preferido'), `al volver: «★ Tu preferido» en la tarjeta del ${eqB}`);
  ok(await pj.getByTestId(`pf-estrella-${eqB}`).getAttribute('aria-pressed') === 'true' && await pj.getByTestId('pf-motivo-ninos').getAttribute('aria-checked') === 'true', 'y la estrella y el motivo marcados');
  await foto(pj, 'jugador_preferencia_guardada_375');
  const pw = await e.sesion('ana@pruebas.local', 1280);
  await pw.goto(URL_D);
  ok(await visto(pw.getByTestId('preferencia')) && await sinDesbordar(pw), '1280 px: el bloque sin desbordar');
  await foto(pw, 'jugador_escritorio_1280');

  console.log('\n== Otro jugador no ve nada de la preferencia de Ana');
  await sql`insert into public.respuestas (evento_id, person_id, respuesta, origen) values (${D.ids[0]}, 'sint-pf-beto', 'va', 'jugador'), (${D.ids[1]}, 'sint-pf-beto', 'va', 'jugador')`;
  const pb = await e.sesion('beto@pruebas.local', 375);
  await pb.goto(URL_D);
  const html = await pb.content();
  ok(!/Tu preferido|pf-marca|Nota sintética|preferencias_domingo|"motivo":"ninos"/.test(html), 'en la página del domingo de Beto (ni en el HTML): ni «Tu preferido» ni la preferencia de Ana');

  console.log('\n== Tablero de convocatoria (gestor)');
  // 16 disponibles más (sintéticos, a los dos partidos): así nadie dobla y Ana juega en un solo equipo (quien dobla no
  // lleva marca: la preferencia no influye).
  const otros = Array.from({ length: 16 }, (_, i) => [`sint-pf-x${String(i).padStart(2, '0')}`, `Extra ${i}`, true, true]);
  await sinteticos(sql, otros);
  for (const [id] of otros) await sql`insert into public.respuestas (evento_id, person_id, respuesta, origen) values (${D.ids[0]}, ${id}, 'va', 'jugador'), (${D.ids[1]}, ${id}, 'va', 'jugador')`;
  const pg = await e.sesion('gestor@pruebas.local', 1280);
  await pg.goto(`${APP}/gestion/convocatoria?fecha=${D.fecha}`);
  ok(await visto(pg.getByTestId('pf-leyenda')) && /☆ MdA = prefería el MdA \(está en el otro\)/.test(await pg.getByTestId('pf-leyenda').innerText()), 'la leyenda «★ está en el partido que prefiere · ☆ MdA = prefería el MdA (está en el otro)»');
  const fila = pg.locator('[data-testid^="cv-equipo-"] li[data-person="sint-pf-ana"]').first();
  ok(await visto(fila.getByTestId('pf-marca')), 'Ana, con su marca en su fila', process.env.CI ? '' : JSON.stringify({ filas: await pg.locator('[data-testid^="cv-equipo-"] li[data-person]').evaluateAll((l) => l.map((x) => x.dataset.person)), marcas: await pg.getByTestId('pf-marca').count(), sin: (await pg.getByTestId('cv-sin-convocar').innerText()).slice(0, 200) }));
  const estrella = fila.locator('.pf-estrella');
  await estrella.click();
  ok(await visto(fila.getByTestId('pf-desplegado')) && /Niños · «Nota sintética de prueba»/.test(await fila.getByTestId('pf-desplegado').innerText()) && await estrella.getAttribute('aria-expanded') === 'true', 'al pulsarla: motivo y nota debajo, sin salir de la página');
  await foto(pg, 'gestion_convocatoria_1280');
  await estrella.click();
  ok(!(await fila.getByTestId('pf-desplegado').count()), 'otro toque lo cierra');
  ok(await sinDesbordar(pg), '1280 px sin desbordar');
  const pg3 = await e.sesion('gestor@pruebas.local', 375);
  await pg3.goto(`${APP}/gestion/convocatoria?fecha=${D.fecha}`);
  const f3 = pg3.locator('[data-testid^="cv-equipo-"] li[data-person="sint-pf-ana"]').first();
  await f3.locator('.pf-estrella').click();
  ok(await visto(f3.getByTestId('pf-desplegado')) && await sinDesbordar(pg3) && !(await pequenos(pg3, '.pf-estrella')).length, '375 px: desplegado, sin desbordar y estrella de 44 px');
  await foto(pg3, 'gestion_convocatoria_375');

  console.log('\n== Respuestas del evento (gestor)');
  await pg.goto(`${APP}/evento/${D.ids[1]}`);
  const filaR = pg.getByTestId('tabla-respuestas').locator('tr', { hasText: 'Ana' }).first();
  ok(await visto(filaR.getByTestId('pf-marca')) && (await filaR.locator('.pf-estrella').innerText()).trim() === '★', `en el evento del ${eqB} (el que prefiere): ★`);
  await filaR.locator('.pf-estrella').click();
  ok(/Prefiere el/.test(await filaR.getByTestId('pf-desplegado').innerText()), 'al pulsarla: «Prefiere el …», motivo y nota');
  await foto(pg, 'gestion_respuestas_1280');
  await pg.goto(`${APP}/evento/${D.ids[0]}`);
  const filaR0 = pg.getByTestId('tabla-respuestas').locator('tr', { hasText: 'Ana' }).first();
  ok((await filaR0.locator('.pf-estrella').innerText()).trim() === `☆ ${eqB}`, `en el otro evento: «☆ ${eqB}» (prefería el ${eqB})`);

  console.log('\n== Sin «A los dos», no sale');
  await trasAccion(pj, () => pj.getByRole('button', { name: new RegExp(`^Solo al de las .*\\(${eqA}\\)$`) }).click());
  ok(await hasta(async () => !(await pj.getByTestId('preferencia').count())), '«Solo al de…»: desaparece el bloque');
  ok(await hasta(async () => !(await pref())), 'y la base borra la preferencia sola');
  await pj.reload();
  ok(!(await pj.getByTestId('pf-tu-preferido').count()), 'y ya no hay «Tu preferido»');
  await foto(pj, 'jugador_solo_uno_375');
  const pc = await e.sesion('cira@pruebas.local', 375);
  await pc.goto(URL_D);
  const voy = pc.getByRole('button', { name: 'Voy', exact: true });
  if (await voy.count()) await trasAccion(pc, () => voy.first().click());
  ok(!(await pc.getByTestId('preferencia').count()), 'una sola ficha: nunca sale');

  ok(!e.errores.length, 'sin errores en la consola', e.errores.slice(0, 3).join(' | '));
} catch (err) {
  console.log(`  FALLO ${err.stack}`);
  sumar();
} finally {
  await e.parar();
}
console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK');
process.exit(fallos() ? 1 : 0);
