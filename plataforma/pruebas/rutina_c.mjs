#!/usr/bin/env node
// Rutina C automática (D173) de extremo a extremo: pila local, web compilada de verdad y Chrome. Jugadores SINTÉTICOS (D39).
// La tarea de avisos se llama por HTTP como la llama pg_cron, con la hora simulada (?ahora=, solo con AVISOS_PRUEBAS_AHORA=1):
//   - PLAZO: `_limite_dudas` = martes 12:00 el partido y miércoles 12:00 el entreno (la comparación con la web, en pruebas:dudas);
//   - PROPUESTA AUTOMÁTICA en la primera pasada tras el cierre: borrador «Propuesta automática», push SOLO a Iván con lo que
//     trae; repetir la pasada no duplica nada; no pisa una aprobada ni un borrador tocado a mano; permisos (solo service_role);
//   - aviso del cierre a quien no ha respondido; martes 19:00 (Iván) y 21:00 (los tres) si sigue sin aprobar;
//   - PANTALLA a 375 px: revisión por equipo, «Aprobar y avisar» (aprueba y avisa ya: convocados y «esta vez no entras»),
//     salida simplificada («Avisados N de M»); Panel con la propuesta y «Carlos no recibirá los avisos de la convocatoria»;
//   - TRAS APROBAR: baja de un convocado → push «Sale … → propuesta: entra …» y la hoja de recambio a 375 px («Aplicar y
//     avisar»: guarda, avisa a quien entra y a quien sale, WhatsApp del cambio); «voy» tardío solo si un equipo está bajo
//     mínimos; la banda roja (_tras_cambio_jugador) desde el martes 12:00 y, aprobada, solo por un convocado o un «voy»;
//   - CAMBIO DE CALENDARIO tras aprobar (editar un partido): si alguien dobla y ahora es a la misma hora, push a los gestores;
//   - la migración 20261103100000 se revierte limpia (D111) y se vuelve a aplicar.
//
//   npm run pruebas:rutina-c
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import webpush from 'web-push';
import { preparar, sinteticos, personas, contador, visto, sinDesbordar, RAIZ } from './comun_e2e.mjs';
import { firmar } from './pila.mjs';
import { migrar } from '../scripts/db.mjs';
import { trasAccion, hasta } from './infra/esperas.mjs';
import * as H from '../src/lib/avisos/horario.ts';

const { ok, fallos, sumar } = contador();
const vapid = webpush.generateVAPIDKeys();
const secreto = crypto.randomBytes(32).toString('hex');
const servicio = await firmar({ role: 'service_role', iss: 'supabase-local' }, 3600 * 24);
const e = await preparar({
  envExtra: {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey, VAPID_SUBJECT: 'mailto:pruebas@maccabis.invalid',
    SUPABASE_SERVICE_ROLE_KEY: servicio, AVISOS_SECRETO: secreto, AVISOS_PRUEBAS_AHORA: '1', NODE_TLS_REJECT_UNAUTHORIZED: '0',
  },
});
const { sql, APP, pila } = e;
const iso = (t) => new Date(t).toISOString();
const M = (f, h) => H.madrid(f, h);
const api = async (ruta, { metodo = 'GET', cuerpo, token } = {}) => {
  const r = await fetch(`${pila.url}/rest/v1${ruta}`, { method: metodo, headers: { apikey: pila.anonKey, authorization: `Bearer ${token ?? pila.anonKey}`, 'content-type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  let datos = null; try { datos = await r.json(); } catch {}
  return { status: r.status, datos };
};
const rpc = (f, args, token) => api(`/rpc/${f}`, { metodo: 'POST', cuerpo: args, token });
const tarea = async (ahora) => { const t = await fetch(`${APP}/api/avisos/tarea?ahora=${encodeURIComponent(iso(ahora))}`, { method: 'POST', headers: { authorization: `Bearer ${secreto}` } }); return { status: t.status, json: await t.json() }; };
const avisos = (patron) => sql`select clave, user_id, person_id, titulo, cuerpo, url from public.avisos_registro where clave like ${patron} order by clave`;

// Domingos de prueba, lejos del calendario real (que acaba en mayo de 2027).
const D1 = '2027-07-04', D2 = '2027-07-11', D3 = '2027-07-18', D4 = '2027-07-25';
const martes = (d) => H.sumarDias(d, -5);

try {
  // 13 sintéticos con ficha del MdL (y 3 también del MdA): 11 dicen «voy» a D1, r12 no responde y r13 duda.
  const POS = [['base', 'A'], ['base', 'B'], ['escolta', 'A'], ['alero', 'B'], ['escolta', 'C'], ['alero', 'C'], ['pivot', 'A'], ['ala_pivot', 'B'], ['pivot', 'C'], ['ala_pivot', 'D'], ['pivot', 'E'], ['alero', 'D'], ['escolta', 'D']];
  const S = POS.map((_, i) => `sint-r${String(i + 1).padStart(2, '0')}`);
  await sinteticos(sql, S.map((id, i) => [id, `Rc${String(i + 1).padStart(2, '0')}`, i < 3, true]));
  for (const [i, id] of S.entries()) {
    await sql`insert into public.jugadores_privado (person_id, posicion, nivel, dobla) values (${id}, ${POS[i][0]}, ${POS[i][1]}, true) on conflict (person_id) do update set posicion = excluded.posicion, nivel = excluded.nivel`;
  }
  const P = await personas(pila, {
    jugadores: [['sint-r12', 'r12@pruebas.local']],
    gestores: [['Iván', 'gestor@pruebas.local', 'villaescusa-silva-ivan'], ['Carlos Prueba', 'carlos@pruebas.local', null]],
  });
  const ivan = P['gestor@pruebas.local'], carlos = P['carlos@pruebas.local'];
  // En el real la migración marca a Iván; aquí el gestor se crea después de migrar.
  await sql`update public.gestores set recibe_propuesta = true where nombre = 'Iván'`;
  await sql`insert into public.suscripciones_avisos (user_id, endpoint, p256dh, auth) values (${ivan.uid}, 'https://push.invalid/ivan', 'x', 'y')`;
  await sql`update public.respuestas_web_config set dudas_desde = now() - interval '30 days' where id = 1`;
  const evento = async (clave, equipo, fecha, inicio) => (await sql`insert into public.eventos (clave, tipo, equipo, rival, fecha, inicio, quedada, jornada, temporada) values (${clave}, 'liga', ${equipo}, 'Rival de Prueba', ${fecha}, ${inicio}, ${H.enMadrid(new Date(M(fecha, inicio).getTime() - 20 * 60000)).hora}, 40, '2026-27') returning id`)[0].id;
  const E1 = await evento('rc-d1-mdl', 'MdL', D1, '11:30');
  const E2 = await evento('rc-d2-mdl', 'MdL', D2, '11:30');
  const E3 = await evento('rc-d3-mdl', 'MdL', D3, '11:30');
  const E4A = await evento('rc-d4-mda', 'MdA', D4, '10:15'), E4L = await evento('rc-d4-mdl', 'MdL', D4, '12:45');
  const poner = (ev, p, resp, motivo = null) => sql`insert into public.respuestas (evento_id, person_id, respuesta, motivo, fuente, origen) values (${ev}, ${p}, ${resp}, ${motivo}, 'web', 'jugador') on conflict (evento_id, person_id) do update set respuesta = excluded.respuesta, motivo = excluded.motivo, origen = excluded.origen, cambiado_en = now()`;
  for (const id of S.slice(0, 11)) await poner(E1, id, 'va');
  await poner(E1, 'sint-r13', 'duda');

  // ---------------------------------------------------------------------------------------------- plazo en la base
  console.log('\n== Plazo (D173) en la base: martes 12:00 el partido, miércoles 12:00 el entreno del miércoles');
  const [{ l: l1 }] = await sql`select public._limite_dudas(${E1}) l`;
  ok(iso(l1) === iso(M(martes(D1), '12:00')), `partido del domingo ${D1}: martes ${martes(D1)} a las 12:00`, iso(l1));
  const [{ id: ent }] = await sql`insert into public.eventos (clave, tipo, equipo, fecha, inicio, temporada) values ('rc-ent', 'entreno', 'ambos', '2027-06-30', '20:30', '2026-27') returning id`;
  ok(iso((await sql`select public._limite_dudas(${ent}) l`)[0].l) === iso(M('2027-06-30', '12:00')), 'entreno del miércoles 30/06: ese miércoles a las 12:00');

  // ---------------------------------------------------------------------------------------------- permisos
  console.log('\n== Solo la tarea (service_role) propone y lee los datos del motor');
  const priv = (await sql`select has_function_privilege('authenticated', 'public.convocatoria_propuesta_auto(date, int, jsonb, jsonb, jsonb)', 'execute') a1, has_function_privilege('anon', 'public.convocatoria_propuesta_auto(date, int, jsonb, jsonb, jsonb)', 'execute') n1, has_function_privilege('service_role', 'public.convocatoria_propuesta_auto(date, int, jsonb, jsonb, jsonb)', 'execute') s1, has_function_privilege('authenticated', 'public.convocatoria_privados_tarea()', 'execute') a2, has_function_privilege('anon', 'public.convocatoria_privados_tarea()', 'execute') n2, has_function_privilege('service_role', 'public.convocatoria_privados_tarea()', 'execute') s2`)[0];
  ok(!priv.a1 && !priv.n1 && priv.s1 && !priv.a2 && !priv.n2 && priv.s2, 'convocatoria_propuesta_auto y convocatoria_privados_tarea: solo service_role (ni gestores, ni jugadores, ni anónimo)', JSON.stringify(priv));
  let r = await rpc('convocatoria_privados_tarea', {}, ivan.token);
  ok(r.status >= 400, 'un gestor con sesión no puede llamarla (va por su RLS de siempre)', String(r.status));
  r = await rpc('convocatoria_propuesta_auto', { p_fecha: D1, p_jornada: 40, p_equipos: {}, p_dificultad: {} }, P['sint-r12'].token);
  ok(r.status >= 400, 'ni un jugador', String(r.status));
  r = await rpc('convocatoria_privados_tarea', {}, servicio);
  ok(r.status === 200 && r.datos.some((x) => x.person_id === 'sint-r01' && x.nivel === 'A'), 'la tarea sí lee lo que necesita el motor');

  // ---------------------------------------------------------------------------------------------- propuesta automática
  console.log('\n== La primera pasada tras el cierre del martes: propuesta automática y push solo a Iván');
  let t = await tarea(M(martes(D1), '11:50'));
  ok(t.status === 200 && !(t.json.propuestas ?? []).includes(D1) && !(await sql`select 1 from public.convocatorias where fecha = ${D1}`).length, 'a las 11:50 (antes del cierre): nada', JSON.stringify(t.json));
  t = await tarea(M(martes(D1), '12:05'));
  ok(t.status === 200 && t.json.propuestas.includes(D1), 'a las 12:05: la tarea deja la propuesta', JSON.stringify(t.json));
  let [c1] = await sql`select estado, origen, equipos, automatica_en from public.convocatorias where fecha = ${D1}`;
  ok(c1.estado === 'borrador' && c1.origen === 'propuesta' && !!c1.automatica_en && c1.equipos.MdL.length === 10 && !c1.equipos.MdA, 'borrador «propuesta» con 10 del MdL (el MdA descansa); nunca aprobada', JSON.stringify({ e: c1.estado, n: c1.equipos.MdL?.length }));
  const enConv = new Set(c1.equipos.MdL.map((x) => x.person_id));
  ok(!enConv.has('sint-r13') && !enConv.has('sint-r12') && S.slice(0, 11).filter((id) => !enConv.has(id)).length === 1, 'solo los «va»: ni la duda (cerrada a «no va») ni quien no respondió; uno fuera por el tope de 10');
  const cambios = await sql`select por_nombre, por_user_id, accion, nota from public.convocatoria_cambios x join public.convocatorias c on c.id = x.convocatoria_id where c.fecha = ${D1}`;
  ok(cambios.length === 1 && cambios[0].por_nombre === 'Propuesta automática' && cambios[0].accion === 'propuesta' && cambios[0].nota === 'propuesta automática' && !cambios[0].por_user_id, 'en el historial: «Propuesta automática», nota «propuesta automática»');
  let pa = await avisos(`conv-auto:${D1}:%`);
  ok(pa.length === 1 && pa[0].user_id === ivan.uid && pa[0].titulo === 'Convocatoria del domingo 04/07 lista' && /^MdL 10 · /.test(pa[0].cuerpo) && pa[0].url === `/gestion/convocatoria?fecha=${D1}`, 'push SOLO a Iván: «Convocatoria del domingo 04/07 lista» · «MdL 10 · …», con enlace a la revisión', JSON.stringify(pa));
  ok(!/\b(nivel|[A-E][+-]?)\b/.test(pa[0].cuerpo.replace(/MdL|MdA/g, '')), 'sin niveles en el push', pa[0].cuerpo);
  const cierre = await avisos(`rec:cierre:${D1}:%`);
  ok(cierre.some((x) => x.person_id === 'sint-r12' && x.cuerpo === 'No has respondido: no entras en la propuesta de convocatoria. Si puedes jugar, di «voy» cuanto antes.') && !cierre.some((x) => S.slice(0, 11).includes(x.person_id)), 'al cierre, aviso a quien no ha respondido (r12), no a los «va»');
  ok((await sql`select respuesta from public.respuestas where evento_id = ${E1} and person_id = 'sint-r12'`).length === 0, 'y su respuesta no se toca (sigue «sin responder»)');
  ok((await sql`select respuesta, motivo from public.respuestas where evento_id = ${E1} and person_id = 'sint-r13'`)[0]?.motivo === 'no_confirmo', 'la duda pasa a «no va · no confirmó», como hoy');
  // repetir no duplica
  t = await tarea(M(martes(D1), '12:20'));
  const [c1b] = await sql`select automatica_en from public.convocatorias where fecha = ${D1}`;
  ok(t.status === 200 && !t.json.propuestas.includes(D1) && iso(c1b.automatica_en) === iso(c1.automatica_en) && (await avisos(`conv-auto:${D1}:%`)).length === 1 && (await sql`select count(*)::int n from public.convocatoria_cambios x join public.convocatorias c on c.id = x.convocatoria_id where c.fecha = ${D1}`)[0].n === 1, 'repetir la pasada (12:20) no duplica nada: ni propuesta, ni historial, ni push');

  console.log('\n== No pisa una aprobada ni un borrador tocado a mano');
  for (const id of S.slice(0, 11)) { await poner(E2, id, 'va'); await poner(E3, id, 'va'); }
  await sql`insert into public.convocatorias (fecha, jornada, estado, origen, equipos, aprobada_en) values (${D2}, 40, 'aprobada', 'blanco', ${sql.json({ MdL: [{ person_id: 'sint-r01' }] })}, now())`;
  const [{ id: c3 }] = await sql`insert into public.convocatorias (fecha, jornada, estado, origen, equipos) values (${D3}, 40, 'borrador', 'propuesta', ${sql.json({ MdL: [{ person_id: 'sint-r02' }] })}) returning id`;
  await sql`insert into public.convocatoria_cambios (convocatoria_id, por_nombre, accion, en) values (${c3}, 'Iván', 'propuesta', now() - interval '2 hours')`;
  await sql`insert into public.convocatoria_cambios (convocatoria_id, por_nombre, accion, person_id, motivo, nota, en) values (${c3}, 'Iván', 'anadir', 'sint-r02', 'otro', 'ajuste manual', now() - interval '1 hour')`;
  t = await tarea(M(martes(D2), '12:05'));
  ok(t.status === 200 && !t.json.propuestas.includes(D2) && (await sql`select equipos from public.convocatorias where fecha = ${D2}`)[0].equipos.MdL.length === 1, `la del ${D2}, ya aprobada: no se toca`);
  t = await tarea(M(martes(D3), '12:05'));
  const [c3b] = await sql`select equipos, automatica_en from public.convocatorias where fecha = ${D3}`;
  ok(t.status === 200 && !t.json.propuestas.includes(D3) && c3b.equipos.MdL.length === 1 && !c3b.automatica_en && !(await avisos(`conv-auto:${D3}:%`)).length, `la del ${D3}, con un «añadir» a mano después de su propuesta: no se toca ni se avisa`);
  r = await rpc('convocatoria_propuesta_auto', { p_fecha: D3, p_jornada: 40, p_equipos: { MdL: [] }, p_dificultad: {} }, servicio);
  ok(r.datos === 'tocada', 'la base también lo frena («tocada»)', JSON.stringify(r.datos));
  r = await rpc('convocatoria_propuesta_auto', { p_fecha: D2, p_jornada: 40, p_equipos: { MdL: [] }, p_dificultad: {} }, servicio);
  ok(r.datos === 'aprobada', 'y una aprobada («aprobada»)', JSON.stringify(r.datos));

  console.log('\n== Martes 19:00 (Iván) y 21:00 (los tres) si sigue sin aprobar');
  t = await tarea(M(martes(D1), '19:05'));
  let pend = await avisos(`conv-pend:19:${D1}:%`);
  ok(pend.length === 1 && pend[0].user_id === ivan.uid && /sin aprobar/.test(pend[0].titulo), 'a las 19:00, solo a Iván', JSON.stringify(pend));
  t = await tarea(M(martes(D1), '21:05'));
  pend = await avisos(`conv-pend:21:${D1}:%`);
  ok(pend.length === 2 && pend.some((x) => x.user_id === carlos.uid) && /Cualquiera de los tres/.test(pend[0].cuerpo), 'a las 21:00, a todos los gestores (también Carlos)', JSON.stringify(pend));
  t = await tarea(M(martes(D1), '21:20'));
  ok((await avisos(`conv-pend:%:${D1}:%`)).length === 3, 'repetir no duplica');

  // ---------------------------------------------------------------------------------------------- Panel y pantalla a 375 px
  console.log('\n== Panel: la propuesta se ve al entrar y avisa de quién no recibirá los avisos');
  const pg = await e.sesion('gestor@pruebas.local', 375);
  await pg.goto(`${APP}/gestion`);
  ok(await visto(pg.getByTestId('panel-propuesta')) && /lista para revisar/.test(await pg.getByTestId('panel-propuesta').innerText()), 'Panel: «Convocatoria del domingo … lista para revisar» con «Revisar y aprobar»');
  const sinAv = await pg.getByTestId('panel-gestores-sin-avisos').innerText().catch(() => '');
  ok(/Carlos no recibirá los avisos de la convocatoria/.test(sinAv) && !/Iván/.test(sinAv), '«Carlos no recibirá los avisos de la convocatoria» (Iván tiene un móvil con avisos)', sinAv);
  ok(await sinDesbordar(pg), 'Panel a 375 px sin desbordar');

  console.log('\n== Revisión y «Aprobar y avisar» desde el móvil (375 px)');
  await pg.goto(`${APP}/gestion/convocatoria?fecha=${D1}`);
  ok(await visto(pg.getByTestId('cv-revision')) && await visto(pg.getByTestId('cv-automatica')), 'arriba, la revisión con «Propuesta automática del …»');
  const rev = await pg.getByTestId('cv-rev-MdL').innerText();
  ok(/Bases/.test(rev) && /Exteriores/.test(rev) && /Interiores/.test(rev) && /Rival de Prueba/.test(rev) && /Dificultad/.test(rev), 'por equipo: convocados por línea, rival y dificultad', rev.slice(0, 300));
  const fueraTxt = await pg.getByTestId('cv-rev-fuera').innerText();
  ok(/Se quedan fuera \(1\)/.test(fueraTxt) && /Tope de 10/.test(fueraTxt), 'quién se queda fuera y por qué', fueraTxt);
  ok(await sinDesbordar(pg), 'sin desbordar a 375 px');
  const btn = pg.getByTestId('cv-aprobar');
  ok(await btn.evaluate((b) => b.getBoundingClientRect().height >= 44), 'el botón «Aprobar y avisar» es grande (al menos 44 px)');
  await btn.click();
  await pg.waitForURL((u) => u.pathname.endsWith('/convocatoria/salida'), { timeout: 20000 });
  const res = await pg.getByTestId('cv-aviso-resultado').innerText();
  ok(/Avisados \d+ de 11/.test(res), 'la salida: «Avisados N de 11 (…)» (10 convocados y 1 que no entra)', res);
  ok(!(await pg.getByText('Ya lo he pegado en el grupo').count()) && !(await pg.locator('.pastilla', { hasText: /Pendiente|Al día/ }).count()), 'sin «Ya lo he pegado» ni estados «pendiente / al día»');
  ok(await visto(pg.getByRole('button', { name: 'Copiar mensaje' })), 'el WhatsApp del grupo con «Copiar mensaje»');
  ok(await sinDesbordar(pg), 'salida sin desbordar a 375 px');
  const av = await sql`select person_id, titulo, cuerpo from public.avisos_registro where clave like ${`convocatoria:${D1}:%`}`;
  const fueraId = S.slice(0, 11).find((id) => !enConv.has(id));
  ok(av.length === 11 && av.filter((x) => x.titulo === 'Estás convocado · domingo 04/07' && x.cuerpo.startsWith('MdL a las 11:30 (quedada 11:10).')).length === 10, 'un aviso a cada convocado: «Estás convocado · domingo 04/07» / «MdL a las 11:30 (quedada 11:10).» (el único equipo al que podían ir)', JSON.stringify(av.slice(0, 2)));
  ok(av.find((x) => x.person_id === fueraId)?.cuerpo === 'Esta vez no entras en la convocatoria: somos muchos para un solo partido. Gracias por estar disponible, cuenta contigo para el siguiente.', 'y a quien dijo «voy» y no entra: «Esta vez no entras… un solo partido…»');
  ok(!/nivel|reserva|posici/i.test(av.map((x) => x.titulo + x.cuerpo).join(' ')), 'sin niveles ni «reserva» en ningún aviso');
  ok((await sql`select estado from public.convocatorias where fecha = ${D1}`)[0].estado === 'aprobada', 'queda aprobada');

  // ---------------------------------------------------------------------------------------------- tras aprobar
  console.log('\n== Baja de un convocado tras aprobar: push con el recambio propuesto y la hoja de recambio');
  const sale = 'sint-r07'; // pívot A, convocado
  ok(enConv.has(sale), 'r07 está convocado');
  await poner(E1, sale, 'no', 'trabajo');
  t = await tarea(M(H.sumarDias(martes(D1), 1), '10:00'));
  let baja = await avisos(`conv-baja:${D1}:MdL:${sale}:%`);
  ok(t.status === 200 && baja.length === 2 && baja.every((x) => /^Sale Rc07 \(MdL\)\. Propuesta: entra Rc\d\d\. Toca para elegir\.$/.test(x.cuerpo) && x.url.startsWith(`/gestion/convocatoria/recambio?fecha=${D1}&sale=${sale}&equipo=MdL`)), 'push a los dos gestores: «Sale Rc07 (MdL). Propuesta: entra …», con la hoja de recambio', JSON.stringify({ baja, t: t.json }));
  if (!baja.length) throw new Error('sin aviso de baja: no se puede seguir');
  ok(!/trabajo/.test(baja[0].cuerpo), 'el motivo de la baja no sale en el push');
  await tarea(M(H.sumarDias(martes(D1), 1), '10:20'));
  ok((await avisos(`conv-baja:${D1}:MdL:${sale}:%`)).length === 2, 'repetir no duplica');
  await pg.goto(`${APP}${baja[0].url}`);
  ok(await visto(pg.getByTestId('rc-hoja')), 'la hoja de recambio abre (375 px)');
  const propuesto = await pg.locator('input[name=entra]:checked').getAttribute('value');
  ok(propuesto === fueraId, 'preseleccionado el recambio del motor (el que se quedó fuera por el tope)', String(propuesto));
  ok((await pg.locator('input[name=entra]').count()) >= 2 && (await pg.locator('input[name=entra][value=""]').count()) === 1, 'lista a todos los disponibles para elegir otro, y «Ninguno»');
  ok(await sinDesbordar(pg), 'la hoja sin desbordar a 375 px');
  await pg.getByTestId('rc-aplicar').click();
  await hasta(async () => (await pg.getByTestId('rc-hecho').count()) > 0 || (await pg.locator('.aviso-error').count()) > 0, 30000);
  if (!(await pg.getByTestId('rc-hecho').count())) throw new Error(`la hoja no aplicó el recambio: ${await pg.locator('main').innerText().catch(() => '')}`.slice(0, 600));
  const wa = await pg.locator('#rc-whatsapp').innerText();
  ok(/Cambio en la convocatoria/.test(wa) && /sale Rc07/.test(wa) && new RegExp(`entra Rc${fueraId.slice(-2)}`).test(wa) && !/nivel|reserva/i.test(wa), 'WhatsApp del cambio para copiar («sale Rc07; entra …»), sin niveles', wa.slice(0, 200));
  const [c1c] = await sql`select equipos from public.convocatorias where fecha = ${D1}`;
  const ahoraIds = c1c.equipos.MdL.map((x) => x.person_id);
  ok(!ahoraIds.includes(sale) && ahoraIds.includes(fueraId) && ahoraIds.length === 10, 'guardado: sale r07, entra el recambio');
  const camb = await sql`select person_id, cuerpo from public.avisos_registro where clave like ${`convocatoria:${D1}:%`} and person_id in (${sale}, ${fueraId}) and titulo like 'Cambio en la convocatoria%'`;
  ok(camb.find((x) => x.person_id === sale)?.cuerpo === 'Ya no estás convocado este domingo.' && /^Entras en la convocatoria del MdL · 11:30, quedada 11:10\./.test(camb.find((x) => x.person_id === fueraId)?.cuerpo ?? ''), 'avisados: quien sale («Ya no estás convocado…») y quien entra («Entras en la convocatoria del MdL…»)', JSON.stringify(camb));

  console.log('\n== «Voy» tardío de alguien sin convocar: solo avisa si un equipo está bajo mínimos');
  await poner(E1, 'sint-r12', 'va');
  t = await tarea(M(H.sumarDias(martes(D1), 1), '11:00'));
  ok(!(await avisos(`conv-tardio:${D1}:%`)).length, 'con el MdL en sus mínimos: no avisa (queda en «Disponibles sin convocar»)');
  await sql`update public.convocatorias set equipos = jsonb_build_object('MdL', (equipos->'MdL') - 0 - 0 - 0 - 0) where fecha = ${D1}`;
  t = await tarea(M(H.sumarDias(martes(D1), 1), '11:15'));
  const tard = await avisos(`conv-tardio:${D1}:sint-r12:%`);
  ok(tard.length === 2 && /Rc12 dice «voy» y el MdL: 6 de 7/.test(tard[0].cuerpo), 'con el MdL en 6: push a los gestores «Rc12 dice «voy» y el MdL: 6 de 7…»', JSON.stringify(tard));

  console.log('\n== Banda roja (_tras_cambio_jugador): desde el martes 12:00; aprobada, solo por un convocado o un «voy»');
  const pasado = '2026-09-27';
  const [{ id: EP }] = await sql`insert into public.eventos (clave, tipo, equipo, rival, fecha, inicio, temporada) values ('rc-pasado', 'liga', 'MdL', 'Rival', ${pasado}, '11:30', '2026-27') returning id`;
  await sql`insert into public.convocatorias (fecha, estado, origen, equipos, aprobada_en) values (${pasado}, 'aprobada', 'blanco', ${sql.json({ MdL: [{ person_id: 'sint-r01' }] })}, now())`;
  const tras = async (p, a, d) => (await sql`select public._tras_cambio_jugador(${EP}, ${p}, ${a}, ${d}) x`)[0].x;
  ok(await tras('sint-r01', 'va', 'no') === true, 'aprobada: un convocado que dice «no voy» salta');
  ok(await tras('sint-r02', 'va', 'no') === false, 'aprobada: alguien sin convocar que dice «no voy» no salta');
  ok(await tras('sint-r02', 'sin_responder', 'va') === true, 'aprobada: un «voy» de alguien sin convocar salta (la tarea decide si importa)');
  ok(await tras('sint-r01', 'va', 'va') === false, 'sin cambio, nada');
  const [{ x: futuro }] = await sql`select public._tras_cambio_jugador(${E2}, 'sint-r01', 'va', 'no') x`;
  ok(futuro === false, 'antes del cierre del martes, nada');

  console.log('\n== Cambio de calendario tras aprobar: si alguien dobla y ahora es a la misma hora, push con el arreglo');
  await sql`insert into public.convocatorias (fecha, jornada, estado, origen, equipos, aprobada_en) values (${D4}, 40, 'aprobada', 'propuesta', ${sql.json({ MdA: [{ person_id: 'sint-r01' }, { person_id: 'sint-r02' }], MdL: [{ person_id: 'sint-r01' }, { person_id: 'sint-r04' }] })}, now())`;
  for (const id of S.slice(0, 11)) { await poner(E4A, id, 'va'); await poner(E4L, id, 'va'); }
  const pe = await e.sesion('gestor@pruebas.local', 1280);
  await pe.goto(`${APP}/gestion/eventos/${E4L}`);
  await pe.locator('#inicio').fill('10:15');
  await trasAccion(pe, () => pe.getByRole('button', { name: 'Guardar sin avisar' }).click());
  await hasta(async () => (await avisos(`conv-cal:${D4}:%`)).length > 0, 15000).catch(() => {});
  const cal = await avisos(`conv-cal:${D4}:%`);
  ok(cal.length === 2 && cal.every((x) => /Rc01 dobla y ahora los dos partidos son a la misma hora\. Propuesta: sale del MdL/.test(x.cuerpo) && x.url.includes('/gestion/convocatoria/recambio?')), 'push a los gestores: «Rc01 dobla y ahora los dos partidos son a la misma hora. Propuesta: sale del MdL…», con la hoja de recambio', JSON.stringify(cal));
  await pe.close();

  ok(e.errores.length === 0, 'sin errores de JavaScript en ninguna pantalla', e.errores.slice(0, 3).join(' | '));

  // ---------------------------------------------------------------------------------------------- migración reversible
  console.log('\n== Migración 20261103100000 reversible (D111)');
  const migs = path.join(RAIZ, 'supabase', 'migrations');
  const texto = fs.readFileSync(path.join(migs, '20261103100000_rutina_c_automatica.sql'), 'utf8').replace(/--.*$/gm, '');
  ok(!/\bdrop (table|column|function)\b|\btruncate\b|\bdelete\b/i.test(texto), 'sin borrados: dos columnas y dos funciones nuevas, y dos funciones internas reescritas');
  await sql.begin((tx) => tx.unsafe(fs.readFileSync(path.join(migs, '20261103100000_rutina_c_automatica.revertir.sql'), 'utf8')));
  const q = await sql`select (select count(*)::int from pg_proc where proname in ('convocatoria_propuesta_auto', 'convocatoria_privados_tarea')) f, (select count(*)::int from information_schema.columns where (table_name = 'convocatorias' and column_name = 'automatica_en') or (table_name = 'gestores' and column_name = 'recibe_propuesta')) c, (select count(*)::int from supabase_migrations.schema_migrations where version = '20261103100000') m`;
  const [{ l: lr }] = await sql`select public._limite_dudas(${E1}) l`;
  ok(q[0].f === 0 && q[0].c === 0 && q[0].m === 0 && iso(lr) === iso(M(martes(D1), '20:00')), 'revertida: sin las funciones ni las columnas, y el plazo vuelve al martes a las 20:00 (D141)', JSON.stringify(q[0]));
  ok((await sql`select count(*)::int n from public.convocatorias where fecha = ${D1}`)[0].n === 1, 'las convocatorias y sus cambios se quedan');
  await migrar(sql, { log: () => {} });
  const [{ l: la }] = await sql`select public._limite_dudas(${E1}) l`;
  ok((await sql`select count(*)::int n from pg_proc where proname in ('convocatoria_propuesta_auto', 'convocatoria_privados_tarea')`)[0].n === 2 && iso(la) === iso(M(martes(D1), '12:00')), 'vuelta a aplicar: las funciones están otra vez y el plazo es el martes a las 12:00');
} catch (err) {
  console.log(`  FALLO excepción -> ${err.stack ?? err}`);
  sumar();
} finally {
  await e.parar();
}
const n = fallos();
console.log(n ? `\n${n} FALLO(S)` : '\nTodo OK');
process.exit(n ? 1 : 0);
