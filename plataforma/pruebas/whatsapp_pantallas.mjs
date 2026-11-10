#!/usr/bin/env node
// WhatsApp a quien no ha respondido e Importar teléfonos (D178), de extremo a extremo: pila local, web compilada y Chrome.
// Jugadores SINTÉTICOS (D39) y teléfonos FALSOS (+34 600 000 0xx), nunca reales.
//   - Respuestas del entreno (gestor, en el móvil: 375 px): bloque «Mensaje a los que faltan» (D189) con la lista de la
//     regla única (D177: Luz, que no va por defecto, no sale) más quien sigue en «duda» (Dud), sin quien tiene una ausencia
//     por periodo ese día (Aus, en duda y de viaje); «Mensaje al grupo» con @ + mote (nunca el contacto); la ayuda con el
//     nombre de contacto; «WhatsApp» con wa.me y el mensaje individual (el de la duda, aparte); sin teléfono, «Falta
//     teléfono» desactivado.
//   - Importar teléfonos: CSV en memoria, tabla de revisión con el teléfono enmascarado (el entero no llega a la página),
//     nada se guarda sin confirmar; al confirmar, solo contacto y teléfono.
//   - Un jugador no abre ninguna de las dos páginas.
//
//   npm run pruebas:whatsapp-pantallas
import { preparar, personas, sinteticos, contador, visto, sinDesbordar, pequenos, trasAccion, hasta } from './comun_e2e.mjs';
import { hoyMadrid } from './fechas_prueba.mjs';

const { ok, fallos, sumar } = contador();
const e = await preparar();
const { sql, APP } = e;
try {
  const hoy = hoyMadrid();
  // Luz «no suele entrenar» (sin responder: no va por defecto); Rai y Sol sin responder (Rai con teléfono); Bea va.
  // D189: Dud sigue en «duda» (sale); Aus también, pero tiene una ausencia por periodo ese día (no sale).
  await sinteticos(sql, [['sint-luz', 'Luz', true, false], ['sint-rai', 'Rai', true, false], ['sint-sol', 'Sol', true, false], ['sint-bea', 'Bea', true, false], ['sint-dud', 'Dud', true, false], ['sint-aus', 'Aus', true, false]]);
  await sql`insert into public.jugadores_privado (person_id, no_suele_entrenar) values ('sint-luz', true)`;
  await sql`update public.jugadores set telefono = '+34600000011', whatsapp_contacto = 'Rai Baloncesto' where person_id = 'sint-rai'`;
  await personas(e.pila, { jugadores: [['sint-luz', 'luz@pruebas.local']], gestores: [['Iván', 'gestor@pruebas.local', 'villaescusa-silva-ivan']] });
  const [ent] = await sql`select id, fecha::text from public.eventos where tipo = 'entreno' and estado = 'programado' and fecha >= ${hoy} order by fecha limit 1`;
  await sql`insert into public.respuestas (evento_id, person_id, respuesta, origen) values (${ent.id}, 'sint-bea', 'va', 'jugador'), (${ent.id}, 'sint-dud', 'duda', 'jugador'), (${ent.id}, 'sint-aus', 'duda', 'jugador')`;
  await sql`update public.jugadores set telefono = '+34600000014' where person_id = 'sint-dud'`;
  await sql`insert into public.ausencias_periodo (person_id, desde, hasta, motivo, origen) values ('sint-aus', ${ent.fecha}, ${ent.fecha}, 'viaje', 'jugador')`;

  console.log('\n== Respuestas del entreno, en el móvil (375 px): «Sin responder»');
  const pg = await e.sesion('gestor@pruebas.local', 375);
  await pg.goto(`${APP}/gestion/eventos/${ent.id}/respuestas`);
  const bloque = pg.getByTestId('sin-responder');
  ok(await visto(bloque), 'sale el bloque «Sin responder»');
  const lista = await pg.getByTestId('sin-responder-lista').innerText();
  ok(/Rai/.test(lista) && /Sol/.test(lista) && !/Luz/.test(lista) && !/Bea/.test(lista), 'Rai y Sol salen; Luz (no va por defecto) y Bea (va), no', lista.slice(0, 300));
  // La pila trae la plantilla de data/ sin responder: se cuenta lo que hay, no un número fijo.
  const desglose = (await pg.getByTestId('faltan-desglose').innerText()).match(/(\d+) sin responder · (\d+) en duda/);
  const totalFaltan = (await bloque.locator('h2').innerText()).match(/· (\d+)$/)?.[1];
  ok(desglose && desglose[2] === '1' && Number(totalFaltan) === Number(desglose[1]) + 1, 'D189: «Mensaje a los que faltan · N» = sin responder + 1 en duda (Dud)', `${totalFaltan} | ${desglose?.[0]}`);
  ok(/Dud/.test(lista) && (await pg.getByTestId('sin-responder-lista').locator('li[data-falta="duda"]').count()) === 1 && !/Aus/.test(lista), 'D189: Dud (en duda) sale, marcado «duda»; Aus (en duda, con una ausencia ese día), no', lista.slice(0, 300));
  const grupo = await pg.getByTestId('mensaje-grupo').locator('pre').innerText();
  ok(/@Rai/.test(grupo) && /@Sol/.test(grupo) && !/@Luz/.test(grupo) && /aún no habéis respondido al entreno del /.test(grupo) && grupo.includes(`/mi-zona/evento/${ent.id}`), '«Mensaje al grupo»: @ + mote, el entreno y el enlace al evento', grupo);
  ok(!/Rai Baloncesto|600000011/.test(grupo), 'en el mensaje del grupo, ni el nombre de contacto ni el teléfono');
  ok(/, y @Dud sigues en «duda»\. Responded en la web/.test(grupo) && !/@Aus/.test(grupo), 'D189: el grupo también nombra a Dud («sigues en «duda»»), no a Aus', grupo);
  console.log(`  Mensaje al grupo (sintético): ${grupo}`);
  const ayuda = await pg.getByTestId('ayuda-menciones').innerText();
  ok(/Para que la mención avise, escribe @ en WhatsApp y busca:/.test(ayuda) && /Rai Baloncesto/.test(ayuda) && /Sol \(sin contacto guardado\)/.test(ayuda), 'la ayuda: «escribe @ y busca:» con el nombre de contacto (o que falta)', ayuda);
  const fila = (n) => pg.getByTestId('sin-responder-lista').locator('li').filter({ hasText: n });
  const rai = fila('Rai').getByTestId('boton-whatsapp');
  const href = await rai.getAttribute('href');
  ok(href?.startsWith('https://wa.me/34600000011?text=') && (await rai.getAttribute('target')) === '_blank', 'Rai: «WhatsApp» abre wa.me con su teléfono (sin + ni espacios)', href);
  const texto = decodeURIComponent(href?.split('text=')[1] ?? '');
  ok(/^Hola Rai, aún no has respondido al entreno del /.test(texto) && texto.includes(`/mi-zona/evento/${ent.id}`), 'y el mensaje individual: «Hola Rai, aún no has respondido al entreno del …» con el enlace', texto);
  const dudHref = await fila('Dud').getByTestId('boton-whatsapp').getAttribute('href');
  ok(/^Hola Dud, sigues en «duda» para el entreno del /.test(decodeURIComponent(dudHref?.split('text=')[1] ?? '')), 'D189: a Dud, el mensaje de la duda («sigues en «duda»… Confirma aquí»)', dudHref);
  ok(await visto(bloque.getByRole('button', { name: 'Enviar un recordatorio ahora' })), 'D189: el aviso al móvil («Enviar un recordatorio ahora»), en el mismo bloque');
  const sol = fila('Sol').getByTestId('boton-whatsapp');
  ok(await sol.isDisabled() && /Falta teléfono/.test(await sol.innerText()), 'Sol (sin teléfono): «Falta teléfono», desactivado');
  await pg.getByTestId('mensaje-grupo').getByRole('button', { name: 'Mensaje al grupo' }).click();
  ok(await visto(pg.getByTestId('mensaje-grupo').getByRole('button', { name: 'Copiado' })), '«Mensaje al grupo» copia el texto («Copiado»)');
  ok(await sinDesbordar(pg), 'a 375 px, sin desbordar');
  ok(!(await pequenos(pg, '[data-testid="boton-whatsapp"]')).length, 'los botones «WhatsApp» con al menos 44 px', JSON.stringify(await pequenos(pg, '[data-testid="boton-whatsapp"]')));

  console.log('\n== Importar teléfonos (CSV con teléfonos FALSOS)');
  const pd = await e.sesion('gestor@pruebas.local', 1280);
  await pd.goto(`${APP}/gestion/jugadores`);
  ok(!(await pd.locator('nav[aria-label="Gestión"]').count()), 'sin la barra de Gestión de antes (D189)');
  await pd.goto(`${APP}/gestion`);
  ok((await pd.locator('main a[href="/gestion/telefonos"]').count()) > 0, '/gestion enlaza «Importar teléfonos» (Plantilla y club, D189)');
  await pd.goto(`${APP}/gestion/jugadores`);
  ok(await visto(pd.locator('main a[href="/gestion/telefonos"]')), 'y Jugadores también');
  await pd.goto(`${APP}/gestion/telefonos`);
  ok(await visto(pd.getByTestId('telefonos-ahora')) && /\+34 6\*\* \*\*\* 011/.test(await pd.getByTestId('telefonos-ahora').innerText()), '«Ahora»: Rai con su teléfono enmascarado');
  const csv = ['mote;whatsapp_contacto;telefono;estado', 'Sol;Sol Baloncesto;+34 600 000 012;ok', 'Rai;Rai Baloncesto;+34600000011;ok', 'Fantasma;Nadie;+34600000013;'].join('\n');
  await pd.getByTestId('csv-telefonos').setInputFiles({ name: 'telefonos_prueba.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') });
  ok(await visto(pd.getByTestId('tabla-revision'), 15000), 'sale la tabla de revisión');
  const tabla = await pd.getByTestId('tabla-revision').innerText();
  console.log(`  Tabla de revisión (sintética):\n    ${tabla.split('\n').filter(Boolean).join('\n    ')}`);
  const filaR = (n) => pd.getByTestId('tabla-revision').locator('tr').filter({ hasText: n });
  ok((await filaR('Sol').getAttribute('data-estado')) === 'nuevo' && /\+34 6\*\* \*\*\* 012/.test(await filaR('Sol').innerText()), 'Sol: «Nuevo», +34 6** *** 012');
  ok((await filaR('Rai').getAttribute('data-estado')) === 'igual', 'Rai: «Igual»');
  ok((await filaR('Fantasma').getAttribute('data-estado')) === 'sin_coincidencia', 'Fantasma: «Sin coincidencia»');
  ok(/Luz/.test(await pd.getByTestId('sin-telefono').innerText()), '«Se quedan sin teléfono»: Luz');
  const html = await pd.content();
  ok(!/600000012|600 000 012|600000013/.test(html), 'el teléfono entero no llega a la página (solo enmascarado)');
  ok((await sql`select telefono from public.jugadores where person_id = 'sint-sol'`)[0].telefono === null, 'sin confirmar, nada guardado');
  await trasAccion(pd, () => pd.getByTestId('confirmar-telefonos').click());
  ok(await visto(pd.getByTestId('telefonos-guardados')) && /Guardado: 1 jugador \(Sol\)/.test(await pd.getByTestId('telefonos-guardados').innerText()), 'al confirmar: «Guardado: 1 jugador (Sol)»');
  ok(await hasta(async () => {
    const [s] = await sql`select telefono, whatsapp_contacto from public.jugadores where person_id = 'sint-sol'`;
    return s.telefono === '+34600000012' && s.whatsapp_contacto === 'Sol Baloncesto';
  }), 'en la base: el teléfono de Sol (internacional) y su contacto');
  ok((await sql`select count(*)::int n from public.jugadores where telefono = '+34600000013'`)[0].n === 0, 'la fila sin coincidencia no se guarda en nadie');
  await pg.goto(`${APP}/gestion/eventos/${ent.id}/respuestas`);
  ok((await fila('Sol').getByTestId('boton-whatsapp').getAttribute('href'))?.startsWith('https://wa.me/34600000012?text='), 'y el botón «WhatsApp» de Sol ya funciona');

  console.log('\n== Un jugador no entra');
  const pj = await e.sesion('luz@pruebas.local', 375);
  for (const ruta of ['/gestion/telefonos', `/gestion/eventos/${ent.id}/respuestas`]) {
    const r = await pj.goto(`${APP}${ruta}`);
    ok(!pj.url().includes(ruta) || r.status() >= 400, `${ruta}: no se abre para un jugador`, pj.url());
    ok(!/600000011|600000012|Rai Baloncesto/.test(await pj.content()), `${ruta}: ni teléfonos ni contactos en lo que recibe`);
  }
  ok(!e.errores.length, 'sin errores en la consola', e.errores.join(' | '));
} catch (err) {
  console.log(`  FALLO ${err.stack}`); sumar();
} finally {
  await e.parar();
}
console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK');
process.exit(fallos() ? 1 : 0);
