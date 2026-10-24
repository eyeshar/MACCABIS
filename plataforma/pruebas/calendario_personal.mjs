#!/usr/bin/env node
// Calendario personal suscribible (D120), de extremo a extremo: pila local, web compilada (con su secreto de prueba) y
// Chrome.
//   - «Tu calendario en el móvil» (Agenda y Mi cuenta): Google Calendar, iPhone (webcal://) y «Copiar enlace»;
//   - el .ics: solo SUS eventos (un plan solo del MdL no le sale a quien solo tiene ficha del MdA), con su estado y sin
//     datos prohibidos (motivos, niveles, nombres de otros, respuestas ajenas);
//   - al cambiar la hora de un evento cambian SEQUENCE y LAST-MODIFIED con el mismo UID; cancelado: STATUS:CANCELLED;
//   - «Cambiar mi enlace»: el anterior da 404; un jugador inactivo: 404; limite de peticiones: 429;
//   - ETag / 304, Cache-Control corto, noindex y Disallow /cal; el .ics valida contra el estándar (RFC 5545).
//
//   npm run pruebas:calendario-personal
import crypto from 'node:crypto';
import { preparar, personas, sinteticos, contador, visto, sinDesbordar, foto } from './comun_e2e.mjs';
import { adelantar, semanas } from './fechas_prueba.mjs';

const { ok, fallos, sumar } = contador();

/** Validacion RFC 5545 de lo que usamos: CRLF, lineas de 75 octetos como mucho, BEGIN/END anidados, propiedades
 *  obligatorias, TZID definidos, DTEND despues de DTSTART, SEQUENCE entero y STATUS valido. */
function validar(ics) {
  const errores = [];
  if (!ics.endsWith('\r\n')) errores.push('no acaba en CRLF');
  if (/[^\r]\n/.test(ics)) errores.push('salto de línea sin CR');
  const fisicas = ics.split('\r\n').slice(0, -1);
  for (const l of fisicas) if (Buffer.byteLength(l) > 75) { errores.push(`línea de más de 75 octetos: ${l.slice(0, 40)}`); break; }
  const lineas = ics.replace(/\r\n[ \t]/g, '').split('\r\n').filter(Boolean);
  const pila = [];
  let ev = null;
  const tzid = new Set(lineas.filter((l) => l.startsWith('TZID:')).map((l) => l.slice(5)));
  for (const l of lineas) {
    if (!/^[A-Z][A-Z0-9-]*(;[^:]+)?:/.test(l)) { errores.push(`línea mal formada: ${l.slice(0, 40)}`); continue; }
    if (l.startsWith('BEGIN:')) { pila.push(l.slice(6)); if (l === 'BEGIN:VEVENT') ev = {}; continue; }
    if (l.startsWith('END:')) { if (pila.pop() !== l.slice(4)) errores.push(`END sin su BEGIN: ${l}`); if (l === 'END:VEVENT') { for (const p of ['UID', 'DTSTAMP', 'DTSTART']) if (!ev[p]) errores.push(`VEVENT sin ${p}`); if (ev.DTEND && ev.DTSTART && ev.DTEND.slice(-15) <= ev.DTSTART.slice(-15)) errores.push(`DTEND no posterior en ${ev.UID}`); ev = null; } continue; }
    const nombre = l.split(/[;:]/)[0];
    const m = /TZID=([^:;]+)/.exec(l);
    if (m && !tzid.has(m[1])) errores.push(`TZID sin VTIMEZONE: ${m[1]}`);
    if (ev) { ev[nombre] = l; if (nombre === 'SEQUENCE' && !/^SEQUENCE:\d+$/.test(l)) errores.push(`SEQUENCE no entero: ${l}`); if (nombre === 'STATUS' && !/^STATUS:(CONFIRMED|CANCELLED|TENTATIVE)$/.test(l)) errores.push(`STATUS no válido: ${l}`); }
  }
  if (pila.length) errores.push(`BEGIN sin cerrar: ${pila.join(',')}`);
  for (const p of ['VERSION:2.0', 'PRODID:']) if (!lineas.some((l) => l.startsWith(p))) errores.push(`falta ${p}`);
  return errores;
}
const eventosDe = (ics) => ics.replace(/\r\n /g, '').split('BEGIN:VEVENT').slice(1).map((b) => Object.fromEntries(b.split('\r\n').filter((l) => /^[A-Z-]+[;:]/.test(l)).map((l) => [l.split(/[;:]/)[0], l.slice(l.indexOf(':') + 1)])));

const e = await preparar({ puerto: 3123, envExtra: { CALENDARIO_SECRETO: crypto.randomBytes(32).toString('hex') } });
const { sql, APP } = e;
try {
  const F = await adelantar(sql, semanas('2026-10-25'));
  // La dueña del calendario es SINTETICA (Ana, MdA y MdL) para poder darle posicion y nivel (D39) y comprobar que no salen.
  await sinteticos(sql, [['sint-ana', 'Ana', true, true]]);
  const P = await personas(e.pila, { jugadores: [['sint-ana', 'ana@pruebas.local'], ['galan-domingo-guillermo', 'guille@pruebas.local'], ['gianatti-adriano', 'adri@pruebas.local']] });
  const rpc = (f, args, token) => fetch(`${e.pila.url}/rest/v1/rpc/${f}`, { method: 'POST', headers: { apikey: e.pila.anonKey, authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(args) }).then((r) => r.json());
  const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  const [ent] = await sql`select id, fecha::text from public.eventos where tipo = 'entreno' and estado = 'programado' and fecha > ${hoy} order by fecha limit 1`;
  const planMdL = await rpc('crear_plan', { p: { tipo: 'pachanga', titulo: 'Pachanga del MdL', fecha: ent.fecha, inicio: '19:00', equipo: 'MdL' } }, P['gianatti-adriano'].token);
  const planTodos = await rpc('crear_plan', { p: { tipo: 'quedada', titulo: 'Cañas', fecha: ent.fecha, inicio: '22:40', equipo: 'ambos', ubicacion_nombre: 'Bar La Esquina', ubicacion_lat: 40.4011, ubicacion_lng: -3.6344 } }, P['gianatti-adriano'].token);
  // Datos que NUNCA deben salir: el motivo y el detalle de otro, su nivel.
  await sql`insert into public.respuestas (evento_id, person_id, respuesta, motivo, detalle) values (${ent.id}, 'gianatti-adriano', 'no', 'lesion', 'Rodilla izquierda')`;
  await sql`insert into public.respuestas (evento_id, person_id, respuesta) values (${ent.id}, 'sint-ana', 'va')`;
  await sql`insert into public.jugadores_privado (person_id, posicion, nivel) values ('sint-ana', 'pivot', 'A')`;
  await sql`insert into public.convocatorias (fecha, jornada, estado, origen, equipos, aprobada_en) values (${F('2026-10-25')}, 3, 'aprobada', 'propuesta', ${sql.json({ MdA: [{ person_id: 'sint-ana' }], MdL: [] })}, now())`;

  console.log('\n== «Tu calendario en el móvil» en la Agenda (375 px)');
  const pj = await e.sesion('ana@pruebas.local', 375);
  await pj.goto(`${APP}/agenda`);
  const bloque = pj.getByTestId('tu-calendario');
  ok(await visto(bloque), 'el bloque está en la Agenda');
  const google = await bloque.getByRole('link', { name: 'Añadir a Google Calendar' }).getAttribute('href');
  const iphone = await bloque.getByRole('link', { name: 'Añadir al iPhone' }).getAttribute('href');
  ok(google.startsWith('https://calendar.google.com/calendar/render?cid=webcal%3A%2F%2F') && iphone.startsWith('webcal://') && /\/cal\/[A-Za-z0-9_-]{40,}\.ics$/.test(iphone), 'Google (suscripción con el webcal) e iPhone (webcal://)', `${google} | ${iphone}`);
  ok(await visto(bloque.getByRole('button', { name: 'Copiar enlace' })) && await visto(bloque.getByText(/Los cambios llegan a tu calendario en unas horas \(Google puede tardar hasta un día\)\. Para cambios de última hora, mira los avisos\./)), '«Copiar enlace» y la línea honesta');
  ok(await sinDesbordar(pj), 'Agenda a 375 px sin desbordamiento');
  await foto(pj, 'agenda_calendario_375');
  const urlJon = iphone.replace(/^webcal:/, 'http:');
  const tokenHash = crypto.createHash('sha256').update(urlJon.match(/\/cal\/([^.]+)\.ics/)[1]).digest('hex');
  ok((await sql`select count(*)::int n from public.calendario_tokens where hash = ${tokenHash}`)[0].n === 1 && (await sql`select count(*)::int n from public.calendario_tokens where hash = ${urlJon.match(/\/cal\/([^.]+)\.ics/)[1]}`)[0].n === 0, 'en la base solo está el HASH del enlace, no el enlace');

  console.log('\n== El .ics de Jon: solo lo suyo, válido y sin datos prohibidos');
  let r = await fetch(urlJon);
  let ics = await r.text();
  ok(r.status === 200 && /text\/calendar/.test(r.headers.get('content-type')), '200 text/calendar');
  ok(/noindex/.test(r.headers.get('x-robots-tag') ?? '') && /max-age=(\d{1,4})\b/.test(r.headers.get('cache-control') ?? '') && Number(/max-age=(\d+)/.exec(r.headers.get('cache-control'))[1]) <= 3600 && r.headers.get('etag'), 'noindex, Cache-Control corto y ETag', `${r.headers.get('cache-control')} ${r.headers.get('etag')}`);
  const val = validar(ics);
  ok(!val.length, 'valida contra el estándar (RFC 5545)', val.slice(0, 5).join(' | '));
  ok(/REFRESH-INTERVAL;VALUE=DURATION:PT1H/.test(ics) && /X-PUBLISHED-TTL:PT1H/.test(ics) && /BEGIN:VTIMEZONE[\s\S]*TZID:Europe\/Madrid/.test(ics), 'REFRESH-INTERVAL y X-PUBLISHED-TTL de 1 hora; VTIMEZONE de Europe/Madrid');
  let evs = eventosDe(ics);
  ok(evs.some((x) => x.UID === `${planMdL}@personal.maccabis`) && evs.some((x) => x.UID === `${planTodos}@personal.maccabis`), 'sus planes (los dos: tiene ficha del MdL)');
  const entJ = evs.find((x) => x.UID === `${ent.id}@personal.maccabis`);
  const plano = (t) => t.replace(/\\n/g, '\n').replace(/\\,/g, ',');
  ok(entJ && /Tu estado: Vas/.test(plano(entJ.DESCRIPTION)) && /Quedada: \d\d:\d\d/.test(plano(entJ.DESCRIPTION)) && /En la web: https:\/\/maccabis\.vercel\.app\/mi-zona\/evento\//.test(plano(entJ.DESCRIPTION)), 'cada evento: su estado («Vas»), la quedada y el enlace a la ficha', entJ?.DESCRIPTION);
  const j3 = evs.find((x) => /J3/.test(x.SUMMARY ?? '') && /MdA/.test(x.SUMMARY));
  ok(j3 && /Tu estado: Convocado \(MdA\)/.test(plano(j3.DESCRIPTION)), 'el partido de la J3: «Convocado (MdA)»', j3?.DESCRIPTION);
  const cana = evs.find((x) => x.UID === `${planTodos}@personal.maccabis`);
  ok(cana && /Cómo llegar: https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=40\.4011,-3\.6344/.test(plano(cana.DESCRIPTION)) && /LOCATION/.test(Object.keys(cana).join()), 'el plan con su sitio y «Cómo llegar»');
  const otros = (await sql`select nombre_visible from public.jugadores where person_id <> 'sint-ana'`).map((x) => x.nombre_visible).filter((n) => n.length > 3);
  const textoIcs = plano(ics.replace(/\r\n /g, ''));
  const nombresAjenos = otros.filter((n) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(textoIcs.replace(/^(UID|DTSTAMP|DTSTART|DTEND|LAST-MODIFIED|URL|GEO)[^\n\r]*$/gm, '')));
  ok(!nombresAjenos.length, 'ningún nombre de otro jugador', nombresAjenos.join(', '));
  ok(!/Rodilla|Lesi[oó]n|lesion|motivo|nivel|Nivel|pivot|Pívot/.test(textoIcs), 'ni motivos, ni niveles, ni posiciones, ni respuestas ajenas');

  console.log('\n== Guillermo (solo MdA): el plan del MdL no le sale');
  const pg = await e.sesion('guille@pruebas.local', 1280);
  await pg.goto(`${APP}/cuenta`);
  ok(await visto(pg.getByTestId('tu-calendario')), 'el bloque también está en Mi cuenta');
  await foto(pg, 'cuenta_calendario_1280');
  const urlG = (await pg.getByTestId('tu-calendario').getByRole('link', { name: 'Añadir al iPhone' }).getAttribute('href')).replace(/^webcal:/, 'http:');
  const icsG = await (await fetch(urlG)).text();
  const evsG = eventosDe(icsG);
  ok(!evsG.some((x) => x.UID === `${planMdL}@personal.maccabis`) && evsG.some((x) => x.UID === `${planTodos}@personal.maccabis`), 'Guillermo ve el plan de toda la plantilla y NO el del MdL');
  ok(!evsG.some((x) => /MdL/.test(x.SUMMARY ?? '')), 'ni partidos del MdL');
  ok(!validar(icsG).length, 'su .ics también valida');

  console.log('\n== Cambios: SEQUENCE y LAST-MODIFIED con el mismo UID; cancelado = STATUS:CANCELLED');
  const antes = eventosDe(await (await fetch(urlJon)).text()).find((x) => x.UID === `${ent.id}@personal.maccabis`);
  await new Promise((res) => setTimeout(res, 1100));
  await sql`update public.eventos set inicio = '19:30', fin = '21:30' where id = ${ent.id}`;
  const despues = eventosDe(await (await fetch(urlJon)).text()).find((x) => x.UID === `${ent.id}@personal.maccabis`);
  ok(despues && Number(despues.SEQUENCE) === Number(antes.SEQUENCE) + 1 && despues['LAST-MODIFIED'] > antes['LAST-MODIFIED'] && /T193000$/.test(despues.DTSTART), `cambia la hora: SEQUENCE ${antes.SEQUENCE} → ${despues?.SEQUENCE}, LAST-MODIFIED nuevo, mismo UID`, JSON.stringify({ antes, despues }).slice(0, 300));
  await sql`update public.eventos set estado = 'cancelado' where id = ${ent.id}`;
  const canc = eventosDe(await (await fetch(urlJon)).text()).find((x) => x.UID === `${ent.id}@personal.maccabis`);
  ok(canc && canc.STATUS === 'CANCELLED' && Number(canc.SEQUENCE) > Number(despues.SEQUENCE), 'cancelado: sigue en el calendario con STATUS:CANCELLED (no desaparece de golpe)');
  r = await fetch(urlJon, { headers: { 'if-none-match': (await fetch(urlJon)).headers.get('etag') } });
  ok(r.status === 304, 'sin cambios, If-None-Match responde 304');

  console.log('\n== «Cambiar mi enlace», jugador inactivo y límite de peticiones');
  await pj.goto(`${APP}/agenda`);
  await pj.getByTestId('cambiar-enlace').click();
  await pj.getByTestId('cambiar-enlace-confirmar').getByRole('button', { name: 'Sí, cambiarlo' }).click();
  await pj.waitForTimeout(1500);
  await pj.reload();
  const nuevo = (await pj.getByTestId('tu-calendario').getByRole('link', { name: 'Añadir al iPhone' }).getAttribute('href')).replace(/^webcal:/, 'http:');
  ok(nuevo !== urlJon && (await fetch(urlJon)).status === 404 && (await fetch(nuevo)).status === 200, 'el enlace regenerado funciona y el anterior da 404 (sin diálogos del navegador: confirmación en la página)');
  await sql`update public.jugadores set activo = false where person_id = 'galan-domingo-guillermo'`;
  ok((await fetch(urlG)).status === 404, 'un jugador que deja de estar activo: 404');
  ok((await fetch(`${APP}/cal/esto-no-es-un-enlace.ics`)).status === 404 && (await fetch(`${APP}/cal/${'a'.repeat(43)}.ics`)).status === 404, 'un enlace inventado: 404');
  await sql`update public.calendario_tokens set ventana_inicio = now(), peticiones = 120 where person_id = 'sint-ana'`;
  ok((await fetch(nuevo)).status === 429, 'más de 120 lecturas en una hora: 429');
  const robots = await (await fetch(`${APP}/robots.txt`)).text();
  const sitemap = await (await fetch(`${APP}/sitemap.xml`)).text();
  ok(/Disallow: \/cal/.test(robots) && !/\/cal\//.test(sitemap), 'robots.txt: Disallow /cal; fuera del sitemap');
  ok(!e.errores.length, 'sin errores de consola', e.errores.slice(0, 5).join(' | '));
} catch (err) { console.error(err); sumar(); } finally {
  await e.parar();
}
console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK');
process.exit(fallos() ? 1 : 0);
