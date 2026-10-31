#!/usr/bin/env node
// «No vas (puesto por defecto)» en la zona del propio jugador (D152, completa D146): pila local, web compilada y Chrome a
// 375 px, con jugadores SINTÉTICOS (D39) y el interruptor «respuestas en la web» ENCENDIDO.
//   - Quien «no suele entrenar» y no ha respondido: en su inicio, su agenda y el entreno, «No vas (puesto por defecto)»
//     con «Sí voy»; «Sí voy» guarda «voy» (en la base y en la pantalla) desde el inicio y desde el entreno.
//   - No sale si ya respondió, si tiene una ausencia que cubre el día, si un gestor se lo quitó para ese entreno (vuelve a
//     «Te falta…») ni si no está invitado (entreno «solo con ficha» y sin ficha); ni a quien no tiene la marca.
//   - Nunca se nombra la marca ni nada privado: ni en la página ni en el HTML (tampoco a los demás, que lo siguen viendo
//     como «sin responder», D146).
//   - Con el interruptor apagado, nada (se responde en SportEasy).
//
//   npm run pruebas:aviso-defecto
import { preparar, personas, sinteticos, contador, visto, sinDesbordar, pequenos, hasta, trasAccion } from './comun_e2e.mjs';

const { ok, fallos, sumar } = contador();
const e = await preparar();
const { sql, APP } = e;
// Lo que nunca puede llegar a una pantalla de jugador: el nombre de la marca, las columnas, la nota de gestión, niveles.
const PRIVADO = /suele entrenar|no_suele|nunca_partidos|nunca a partidos|quitados|Por defecto:|mi_disponibilidad|"nivel"|"posicion"/i;
try {
  const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  // Dos entrenos en los próximos 14 días (lo que enseña el inicio): los dos primeros de la temporada, a hoy + 2 y + 9.
  let ents = await sql`select id from public.eventos where tipo = 'entreno' order by fecha limit 2`;
  for (const [i, x] of ents.entries()) await sql`update public.eventos set fecha = (${hoy}::date + ${2 + i * 7}::int), estado = 'programado' where id = ${x.id}`;
  ents = await sql`select id, fecha::text from public.eventos where id in ${sql(ents.map((x) => x.id))} order by fecha`;
  const [e1, e2] = ents;
  ok(!!e1 && !!e2, `dos entrenos próximos (${e1?.fecha} y ${e2?.fecha})`);

  // Luz, Teo, Vic, Rai y Sol «no suelen entrenar» (Sol sin ficha); Ana, sin marca. Niveles y posiciones, de mentira (D39).
  await sinteticos(sql, [['sint-luz', 'Luz', true, false], ['sint-teo', 'Teo', true, true], ['sint-vic', 'Vic', true, true], ['sint-rai', 'Rai', false, true], ['sint-sol', 'Sol', false, false], ['sint-ana', 'Ana', true, true]]);
  for (const [p, nse] of [['sint-luz', true], ['sint-teo', true], ['sint-vic', true], ['sint-rai', true], ['sint-sol', true], ['sint-ana', false]]) {
    await sql`insert into public.jugadores_privado (person_id, posicion, nivel, no_suele_entrenar) values (${p}, 'base', 'B', ${nse})`;
  }
  const P = await personas(e.pila, { jugadores: [['sint-luz', 'luz@pruebas.local'], ['sint-teo', 'teo@pruebas.local'], ['sint-vic', 'vic@pruebas.local'], ['sint-rai', 'rai@pruebas.local'], ['sint-sol', 'sol@pruebas.local'], ['sint-ana', 'ana@pruebas.local']], gestores: [['Gestor', 'gestor@pruebas.local']] });
  // Rai ya respondió «no voy» al primero; Vic tiene una ausencia que cubre los dos; a Teo un gestor se lo quitó en el primero.
  await sql`insert into public.respuestas (evento_id, person_id, respuesta, motivo, origen) values (${e1.id}, 'sint-rai', 'no', 'trabajo', 'jugador')`;
  await sql`insert into public.ausencias_periodo (person_id, desde, hasta, motivo, origen) values ('sint-vic', ${e1.fecha}, ${e2.fecha}, 'viaje', 'jugador')`;
  await sql`insert into public.entreno_defecto_quitado (evento_id, person_id, por_nombre) values (${e1.id}, 'sint-teo', 'Gestor')`;

  console.log('\n== La función de la base: a cada uno, solo lo suyo');
  const rpc = async (token) => {
    const r = await fetch(`${e.pila.url}/rest/v1/rpc/mi_disponibilidad_defecto`, { method: 'POST', headers: { apikey: e.pila.anonKey, authorization: `Bearer ${token ?? e.pila.anonKey}`, 'content-type': 'application/json' }, body: '{}' });
    return { status: r.status, datos: await r.json().catch(() => null) };
  };
  let r = await rpc(P['sint-luz'].token);
  ok(r.status === 200 && r.datos?.no_suele_entrenar === true && r.datos.quitados.length === 0 && Object.keys(r.datos).sort().join() === 'no_suele_entrenar,quitados', 'Luz: su marca y ningún quitado; nada más (ni nivel ni posición)', JSON.stringify(r));
  r = await rpc(P['sint-teo'].token);
  ok(r.datos?.no_suele_entrenar === true && r.datos.quitados.join() === e1.id, 'Teo: el entreno en que se lo quitaron (solo el suyo)', JSON.stringify(r.datos));
  r = await rpc(P['sint-ana'].token);
  ok(r.datos?.no_suele_entrenar === false && r.datos.quitados.length === 0, 'Ana (sin marca): false, y no ve la de Teo', JSON.stringify(r.datos));
  r = await rpc(P['gestor@pruebas.local'].token);
  ok(r.status === 200 && r.datos?.no_suele_entrenar === false && r.datos.quitados.length === 0, 'un gestor sin ficha de jugador: false (no le da la de nadie)', JSON.stringify(r.datos));
  r = await rpc();
  ok(r.status >= 400, 'anónimo: no la puede ejecutar', String(r.status));

  console.log('\n== Interruptor apagado: nada (se responde en SportEasy)');
  await sql`update public.respuestas_web_config set encendido = false where id = 1`;
  const luz = await e.sesion('luz@pruebas.local', 375);
  await luz.goto(`${APP}/`);
  ok(!(await luz.getByTestId('por-defecto').count()) && !/puesto por defecto/.test(await luz.content()), 'inicio: ni la tarjeta ni el texto');

  await sql`update public.respuestas_web_config set encendido = true, encendido_desde = now() where id = 1`;
  console.log('\n== Luz (no suele entrenar, sin responder): «No vas (puesto por defecto)» y «Sí voy»');
  await luz.goto(`${APP}/`);
  ok(await visto(luz.getByTestId('por-defecto')), 'inicio: sale el bloque de entrenos puestos por defecto');
  const tarjeta = (p, ev) => p.getByTestId('tarjeta-por-defecto').filter({ has: p.locator(`a[href="/mi-zona/evento/${ev.id}"]`) });
  ok((await tarjeta(luz, e1).count()) === 1 && (await tarjeta(luz, e2).count()) === 1, 'una tarjeta por entreno (los dos)');
  const t1 = await tarjeta(luz, e1).innerText();
  ok(/No vas \(puesto por defecto\)/.test(t1) && /Te hemos puesto que no vas\. Si vienes, cámbialo aquí\./.test(t1), '«No vas (puesto por defecto)» y «Te hemos puesto que no vas. Si vienes, cámbialo aquí.»', t1);
  ok(!(await luz.getByTestId('tarjeta-pendiente').filter({ has: luz.locator(`a[href="/mi-zona/evento/${e1.id}"]`) }).count()), 'los entrenos no salen en «Te faltan…» (ya cuentan como «no va»)');
  const filaAgenda = luz.locator(`a[data-testid="fila-agenda"][href="/mi-zona/evento/${e1.id}"]`);
  ok(/No vas \(puesto por defecto\)/.test(await filaAgenda.first().innerText()), '«Tu agenda»: la pastilla dice «No vas (puesto por defecto)»');
  ok(!PRIVADO.test(await luz.content()), 'inicio: nada de la marca ni privado, tampoco en el HTML');
  ok(await sinDesbordar(luz), 'inicio a 375 px: sin desbordar');
  ok(!(await pequenos(luz, '[data-testid="si-voy"]')).length, '«Sí voy» con al menos 44 px', JSON.stringify(await pequenos(luz, '[data-testid="si-voy"]')));
  await luz.goto(`${APP}/agenda`);
  ok(/No vas \(puesto por defecto\)/.test(await luz.locator(`a[data-testid="fila-agenda"][href="/mi-zona/evento/${e2.id}"]`).innerText()) && !PRIVADO.test(await luz.content()), 'Agenda: también, y sin nada privado en el HTML');
  await luz.goto(`${APP}/mi-zona/evento/${e2.id}`);
  ok(/No vas \(puesto por defecto\)/.test(await luz.locator('.rw-vas .rw-etiqueta').innerText()) && await visto(luz.getByTestId('por-defecto')), 'el entreno: «¿Vas?» con «No vas (puesto por defecto)» y «Te hemos puesto que no vas…»');
  ok(!PRIVADO.test(await luz.content()), 'el entreno: nada de la marca ni privado, tampoco en el HTML');
  ok(await sinDesbordar(luz), 'el entreno a 375 px: sin desbordar');

  console.log('\n== «Sí voy» guarda su respuesta');
  await trasAccion(luz, () => luz.getByTestId('si-voy').click());
  ok(await hasta(async () => (await sql`select respuesta, origen from public.respuestas where evento_id = ${e2.id} and person_id = 'sint-luz'`)[0]?.respuesta === 'va'), 'desde el entreno: en la base, «voy» (respuesta suya, de la web)');
  await luz.reload();
  ok(/^Vas$/.test((await luz.locator('.rw-vas .rw-etiqueta').innerText()).trim()) && !(await luz.getByTestId('por-defecto').count()), 'y la pantalla ya dice «Vas» (sin «puesto por defecto»)');
  ok(await visto(luz.locator('.rw-btn-va.marcada')), 'con los botones de siempre para cambiarlo');
  await luz.goto(`${APP}/`);
  ok((await tarjeta(luz, e2).count()) === 0 && (await tarjeta(luz, e1).count()) === 1, 'en el inicio ya no sale ese entreno; el otro, sí');
  await trasAccion(luz, () => tarjeta(luz, e1).getByTestId('si-voy').click());
  ok(await hasta(async () => (await sql`select respuesta from public.respuestas where evento_id = ${e1.id} and person_id = 'sint-luz'`)[0]?.respuesta === 'va'), 'desde el inicio: también guarda «voy»');
  await luz.reload();
  ok(!(await tarjeta(luz, e1).count()), 'y su tarjeta desaparece');

  console.log('\n== Los casos en que no sale');
  // En el PRIMER entreno no le sale (en los demás puede salirle: son otros entrenos).
  const sinDefecto = async (email, que, extra) => {
    const p = await e.sesion(email, 375);
    await p.goto(`${APP}/`);
    ok(!(await tarjeta(p, e1).count()) && !PRIVADO.test(await p.content()), `${que}: inicio sin la tarjeta de ese entreno ni nada privado`);
    await p.goto(`${APP}/agenda`);
    ok(!/puesto por defecto/.test(await p.locator(`a[data-testid="fila-agenda"][href="/mi-zona/evento/${e1.id}"]`).innerText()) && !PRIVADO.test(await p.content()), `${que}: en la agenda, ese entreno sin «puesto por defecto»`);
    await p.goto(`${APP}/mi-zona/evento/${e1.id}`);
    const html = await p.content();
    ok(!/puesto por defecto/.test(html) && !(await p.getByTestId('si-voy').count()) && !PRIVADO.test(html), `${que}: el entreno, sin «puesto por defecto» ni «Sí voy» ni nada privado`);
    if (extra) await extra(p);
    await p.context().close();
  };
  await sinDefecto('rai@pruebas.local', 'Rai (ya respondió «no voy» al primero)', async (p) => {
    await p.goto(`${APP}/mi-zona/evento/${e1.id}`);
    ok(/No vas · Trabajo/.test(await p.locator('.rw-vas .rw-etiqueta').innerText()), 'Rai: su respuesta, con su motivo (solo él lo ve)');
    await p.goto(`${APP}/mi-zona/evento/${e2.id}`);
    ok(/No vas \(puesto por defecto\)/.test(await p.locator('.rw-vas .rw-etiqueta').innerText()), 'Rai: en el otro, al que no respondió, sí sale');
  });
  await sinDefecto('vic@pruebas.local', 'Vic (ausencia que cubre el día)', async (p) => {
    await p.goto(`${APP}/mi-zona/evento/${e1.id}`);
    ok(/Ausente/.test(await p.locator('.rw-vas .rw-etiqueta').innerText()), 'Vic: «Ausente», como siempre');
  });
  await sinDefecto('teo@pruebas.local', 'Teo (un gestor se lo quitó en el primero)', async (p) => {
    await p.goto(`${APP}/`);
    ok(await visto(p.getByTestId('tarjeta-pendiente').filter({ has: p.locator(`a[href="/mi-zona/evento/${e1.id}"]`) })), 'Teo: el primero vuelve a «Te faltan…» con sus botones');
  });
  await sinDefecto('ana@pruebas.local', 'Ana (sin la marca)', async (p) => {
    await p.goto(`${APP}/mi-zona/evento/${e2.id}`);
    const quien = await p.locator('.rw-quien').innerText().catch(() => '');
    ok(!/puesto por defecto/.test(await p.content()), 'Ana: en «Quién va» del entreno no hay rastro del defecto de nadie', quien.slice(0, 200));
  });
  // Sol no tiene ficha: con el entreno en una pista «solo con ficha» (D148) no está invitado.
  await sql`update public.pistas set solo_con_ficha = true where slug = 'valdebernardo'`;
  await sql`update public.eventos set pista_id = (select id from public.pistas where slug = 'valdebernardo'), ubicacion_nombre = null where id in ${sql([e1.id, e2.id])}`;
  const sol = await e.sesion('sol@pruebas.local', 375);
  for (const ruta of ['/', '/agenda']) {
    await sol.goto(`${APP}${ruta}`);
    ok(!(await sol.locator(`[href="/mi-zona/evento/${e1.id}"], [href="/mi-zona/evento/${e2.id}"]`).count()) && !PRIVADO.test(await sol.content()), `Sol (sin ficha, entrenos «solo con ficha»): ${ruta} sin esos entrenos (ni su «puesto por defecto»)`);
  }
  await sql`update public.pistas set solo_con_ficha = false where slug = 'valdebernardo'`;
  await sol.goto(`${APP}/`);
  ok((await tarjeta(sol, e1).count()) === 1 && (await tarjeta(sol, e2).count()) === 1, 'sin la marca de la pista, Sol sí está invitado y le sale en los dos');

  ok(!e.errores.length, 'sin errores en la consola', e.errores.join(' | '));
} catch (err) {
  console.log(`  FALLO ${err.stack}`); sumar();
} finally {
  await e.parar();
}
console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK');
process.exit(fallos() ? 1 : 0);
