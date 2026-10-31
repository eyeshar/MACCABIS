#!/usr/bin/env node
// Ubicacion en todos los eventos (D119). El buscador de OpenStreetMap se SIMULA (un servidor local con respuestas fijas):
// las pruebas nunca llaman a OpenStreetMap.
//   - enlaces de Google Maps: largo (con nombre y coordenadas) y corto (maps.app.goo.gl: se guarda tal cual);
//   - /api/lugares: solo con sesion, identifica la web (User-Agent), cache (la misma busqueda no vuelve a salir);
//   - «Proponer un plan» con el buscador: sugerencias, elegir, «Ver en Google Maps», «Cambiar sitio»;
//   - «Cómo llegar» correcto en la ficha (https://www.google.com/maps/search/?api=1&query=<lat>,<lng>), en el mensaje
//     de WhatsApp de Gestion y en el .ics personal.
//
//   npm run pruebas:ubicacion
import http from 'node:http';
import { preparar, personas, contador, visto, sinDesbordar, foto, PUERTOS } from './comun_e2e.mjs';
import { enlaceGoogle, leerEnlaceGoogle, deNominatim } from '../src/lib/ubicacion.ts';
import { mensajeWhatsApp, pistaEfectiva } from '../src/lib/eventos/dominio.ts';
import { calendarioPersonal } from '../src/lib/calendario/icsPersonal.ts';

const { ok, fallos, sumar } = contador();
const MAPA = (lat, lng) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

console.log('\n== Enlaces de Google Maps (sin red)');
let g = leerEnlaceGoogle('https://www.google.com/maps/place/Bar+La+Esquina/@40.4012345,-3.6345678,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d40.4011111!4d-3.6344444');
ok(g?.nombre === 'Bar La Esquina' && g.lat === 40.4011111 && g.lng === -3.6344444 && g.enlace === null, 'largo: nombre del sitio y coordenadas exactas (!3d/!4d mandan sobre @)', JSON.stringify(g));
g = leerEnlaceGoogle('https://www.google.es/maps/@40.39,-3.63,15z');
ok(g?.lat === 40.39 && g.lng === -3.63, 'largo sin nombre: coordenadas del mapa', JSON.stringify(g));
g = leerEnlaceGoogle('https://maps.google.com/?q=40.3975,-3.6316');
ok(g?.lat === 40.3975 && g.lng === -3.6316, '?q=lat,lng', JSON.stringify(g));
g = leerEnlaceGoogle('https://maps.app.goo.gl/AbCdEf123');
ok(g?.enlace === 'https://maps.app.goo.gl/AbCdEf123' && g.lat === null, 'corto (maps.app.goo.gl): se guarda el enlace tal cual', JSON.stringify(g));
ok(leerEnlaceGoogle('https://example.com/maps/@40,-3') === null && leerEnlaceGoogle('calle mayor 1') === null, 'lo que no es Google Maps no se lee como enlace');
ok(enlaceGoogle({ nombre: 'X', direccion: null, lat: 40.1, lng: -3.2, enlace: null }) === MAPA(40.1, -3.2), '«Cómo llegar» con coordenadas: query=<lat>,<lng>');
ok(enlaceGoogle({ nombre: 'X', direccion: 'Calle Mayor 1, Madrid', lat: null, lng: null, enlace: null })?.startsWith('https://www.google.com/maps/search/?api=1&query=X%2C%20Calle%20Mayor'), 'sin coordenadas: la dirección');
ok(enlaceGoogle({ nombre: 'X', direccion: null, lat: null, lng: null, enlace: 'https://maps.app.goo.gl/AbC' }) === 'https://maps.app.goo.gl/AbC', 'solo enlace corto: el enlace');
const nom = deNominatim({ lat: '40.4047802', lon: '-3.6219452', name: 'Centro Deportivo Municipal Faustina Valladolid', display_name: 'CDM Faustina Valladolid, 2, Calle de la Ladera de los Almendros, Valdebernardo, Vicálvaro, Madrid', address: { road: 'Calle de la Ladera de los Almendros', house_number: '2', suburb: 'Valdebernardo', city: 'Madrid' } });
ok(nom.nombre === 'Centro Deportivo Municipal Faustina Valladolid' && nom.direccion === 'Calle de la Ladera de los Almendros, 2, Valdebernardo, Madrid' && nom.lat === 40.4047802, 'sugerencia de OpenStreetMap: nombre y dirección legible', JSON.stringify(nom));

console.log('\n== Mensaje de WhatsApp y .ics: el enlace de Google Maps');
const pistas = [{ id: 'p1', slug: 'cdm-moratalaz', nombre: 'CDM Moratalaz', nombre_corto: 'Moratalaz', direccion: 'C/ Valdebernardo, 2, 28030 Madrid', uso: 'partido', estado: 'habitual', es_de_serie: false, num_pistas: 3, nota: null, lat: 40.3975133, lng: -3.6315708 }];
const ev = { id: 'e1', clave: 'mda-j3', temporada: '2026-27', tipo: 'liga', equipo: 'MdA', titulo: null, jornada: 3, rival: 'Rival', es_local: true, fecha: '2026-10-25', inicio: '09:00', fin: null, quedada: '08:40', pista_id: 'p1', numero_pista: 2, notas: null, origen: 'ayuntamiento', serie: null, estado: 'programado' };
let msg = mensajeWhatsApp(ev, pistas, 'nuevo');
ok(msg.includes(`Cómo llegar: ${MAPA(40.3975133, -3.6315708)}`), 'WhatsApp de un partido en Moratalaz: «Cómo llegar» con sus coordenadas', msg);
msg = mensajeWhatsApp({ ...ev, tipo: 'amistoso', pista_id: null, titulo: 'Amistoso', ubicacion_nombre: 'Pabellón X', ubicacion_direccion: 'Calle Y 3', ubicacion_lat: 40.5, ubicacion_lng: -3.7 }, pistas, 'nuevo');
ok(msg.includes('en Pabellón X — Calle Y 3') && msg.includes(`Cómo llegar: ${MAPA(40.5, -3.7)}`), 'WhatsApp con una ubicación libre: sitio, dirección y enlace', msg);
ok(pistaEfectiva({ tipo: 'amistoso', pista_id: null, numero_pista: null, ubicacion_nombre: 'Pabellón X' }, pistas).texto === 'Pabellón X', 'la «pista» de un evento con ubicación libre es su sitio');
const ics = calendarioPersonal([{ id: 'e1', tipo: 'liga', equipo: 'MdA', oficial: true, titulo: null, rival: 'Rival', rival_texto: null, es_local: true, jornada: 3, fecha: '2026-10-25', inicio: '09:00:00', fin: null, quedada: '08:40:00', estado: 'programado', lugar_nombre: 'Moratalaz', lugar_direccion: 'C/ Valdebernardo, 2', lugar_lat: 40.3975133, lugar_lng: -3.6315708, lugar_enlace: null, numero_pista: 2, secuencia: 0, actualizado_en: '2026-10-24T10:00:00Z', respuesta: 'va', convocado: true, convocatoria_aprobada: true }], 'https://maccabis.vercel.app');
const desplegado = ics.replace(/\r\n /g, '').replace(/\\,/g, ',').replace(/\\n/g, '\n');
ok(desplegado.includes(`Cómo llegar: ${MAPA(40.3975133, -3.6315708)}`) && /GEO:40.3975133;-3.6315708/.test(ics), '.ics personal: «Cómo llegar» y GEO');

// ---------------------------------------------------------------- servicio de OpenStreetMap simulado
const peticiones = [];
const RESPUESTA = [
  { lat: '40.4011111', lon: '-3.6344444', name: 'Bar La Esquina', display_name: 'Bar La Esquina, Calle de Arroyo Fontarrón, Moratalaz, Madrid', address: { road: 'Calle de Arroyo Fontarrón', house_number: '10', suburb: 'Moratalaz', city: 'Madrid' } },
  { lat: '40.4100000', lon: '-3.6400000', name: 'Bar La Esquina 2', display_name: 'Bar La Esquina 2, Calle Mayor, Madrid', address: { road: 'Calle Mayor', city: 'Madrid' } },
];
const osm = http.createServer((req, res) => {
  peticiones.push({ url: req.url, ua: req.headers['user-agent'] ?? '' });
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(/esquina/i.test(decodeURIComponent(req.url)) ? RESPUESTA : []));
});
await new Promise((r) => osm.listen(PUERTOS.aux(0), '127.0.0.1', r));

const e = await preparar({ envExtra: { LUGARES_URL: `http://127.0.0.1:${PUERTOS.aux(0)}` } });
const { sql, APP } = e;
try {
  await personas(e.pila, { jugadores: [['esteban-jon', 'jon@pruebas.local']], gestores: [['Iván', 'ivan@pruebas.local', null]] });

  console.log('\n== /api/lugares: solo con sesión, identifica la web y usa la caché');
  ok((await fetch(`${APP}/api/lugares?q=bar%20esquina`)).status === 401, 'sin sesión: 401');
  const pj = await e.sesion('jon@pruebas.local', 375);
  const buscar = (q) => pj.evaluate(async (x) => (await fetch(`/api/lugares?q=${encodeURIComponent(x)}`)).json(), q);
  let r = await buscar('bar esquina');
  ok(r.lugares?.length === 2 && r.lugares[0].nombre === 'Bar La Esquina' && r.lugares[0].lat === 40.4011111, 'con sesión: sugerencias (del servicio simulado)', JSON.stringify(r).slice(0, 200));
  ok(peticiones.length === 1 && /Maccabis\/1\.0 \(https:\/\/maccabis\.vercel\.app/.test(peticiones[0].ua) && /countrycodes=es/.test(peticiones[0].url), 'pide al servicio identificando la web (User-Agent) y en España', JSON.stringify(peticiones[0]));
  r = await buscar('Bar Esquina');
  ok(r.cache === true && peticiones.length === 1, 'la misma búsqueda sale de la caché (no se vuelve a pedir)');

  console.log('\n== «Proponer un plan» con el buscador (375 px)');
  await pj.goto(`${APP}/planes/nuevo`);
  await pj.locator('.pl-tipo', { hasText: 'Quedada' }).click();
  await pj.getByLabel('Título', { exact: true }).fill('Cena de equipo');
  const manana = new Date(Date.now() + 5 * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  await pj.getByLabel('Día', { exact: true }).fill(manana);
  await pj.getByLabel('Empieza', { exact: true }).fill('21:30');
  await pj.getByRole('combobox', { name: 'Dónde' }).fill('bar esquina');
  ok(await visto(pj.getByRole('option', { name: /Bar La Esquina/ })), 'escribes y salen las sugerencias');
  ok(await visto(pj.getByRole('option', { name: /Usar «bar esquina»/ })), 'y la opción de usarlo tal cual');
  ok(await sinDesbordar(pj), 'a 375 px sin desbordamiento (con el buscador abierto)');
  await foto(pj, 'proponer_plan_buscador_375', false);
  await pj.getByRole('option', { name: /Bar La Esquina Calle/ }).first().click();
  const elegido = pj.getByTestId('lugar-elegido');
  ok(await visto(elegido.getByText('Bar La Esquina')) && (await elegido.getByRole('link', { name: 'Ver en Google Maps' }).getAttribute('href')) === MAPA(40.4011111, -3.6344444), 'al elegir: el sitio con su dirección y «Ver en Google Maps»');
  await elegido.getByRole('button', { name: 'Cambiar sitio' }).click();
  ok(await visto(pj.getByRole('combobox', { name: 'Dónde' })), '«Cambiar sitio» vuelve al buscador');
  await pj.getByRole('combobox', { name: 'Dónde' }).fill('https://www.google.com/maps/place/Pizzeria+Roma/@40.42,-3.70,17z/data=!3d40.4211!4d-3.7011');
  ok(await visto(elegido.getByText('Pizzeria Roma')) && (await elegido.getByRole('link', { name: 'Ver en Google Maps' }).getAttribute('href')) === MAPA(40.4211, -3.7011), 'pegar un enlace largo de Google Maps: nombre y coordenadas');
  await pj.getByRole('button', { name: 'Publicar plan' }).click();
  await pj.waitForURL(/\/planes\/[0-9a-f-]{36}/, { timeout: 15000 });
  const ficha = pj.getByTestId('ficha-plan');
  ok(await visto(ficha.getByText('Pizzeria Roma')) && (await ficha.getByRole('link', { name: 'Cómo llegar' }).getAttribute('href')) === MAPA(40.4211, -3.7011), 'la ficha del plan: «Cómo llegar» con las coordenadas');
  ok(await sinDesbordar(pj), 'ficha a 375 px sin desbordamiento');
  await foto(pj, 'ficha_plan_375');
  const [fila] = await sql`select ubicacion_nombre, ubicacion_lat, ubicacion_lng, ubicacion_enlace from public.eventos where titulo = 'Cena de equipo'`;
  ok(fila.ubicacion_nombre === 'Pizzeria Roma' && fila.ubicacion_lat === 40.4211 && fila.ubicacion_enlace === null, 'guardado en el evento: nombre y coordenadas', JSON.stringify(fila));

  console.log('\n== Enlace corto: se guarda tal cual');
  await pj.goto(`${APP}/planes/nuevo`);
  await pj.locator('.pl-tipo', { hasText: 'Otro plan' }).click();
  await pj.getByLabel('Título', { exact: true }).fill('Ver la final');
  await pj.getByLabel('Día', { exact: true }).fill(manana);
  await pj.getByLabel('Empieza', { exact: true }).fill('20:00');
  await pj.getByRole('combobox', { name: 'Dónde' }).fill('https://maps.app.goo.gl/AbCdEf123');
  ok(await visto(pj.getByText('Enlace de Google Maps guardado tal cual')), 'el corto no trae coordenadas: «guardado tal cual»');
  await pj.getByRole('button', { name: 'Publicar plan' }).click();
  await pj.waitForURL(/\/planes\/[0-9a-f-]{36}/, { timeout: 15000 });
  ok((await pj.getByTestId('ficha-plan').getByRole('link', { name: 'Cómo llegar' }).getAttribute('href')) === 'https://maps.app.goo.gl/AbCdEf123', '«Cómo llegar» abre el enlace corto');

  console.log('\n== Escritorio (1280 px) y Gestión');
  const pd = await e.nuevaPagina(await e.contexto(1280));
  await pd.context().addCookies(await pj.context().cookies());
  await pd.goto(`${APP}/planes/nuevo`);
  await pd.getByRole('combobox', { name: 'Dónde' }).fill('bar esquina');
  await visto(pd.getByRole('option', { name: /Bar La Esquina/ }));
  await foto(pd, 'proponer_plan_buscador_1280', false);
  const idCena = (await sql`select id from public.eventos where titulo = 'Cena de equipo'`)[0].id;
  await pd.goto(`${APP}/planes/${idCena}`);
  await foto(pd, 'ficha_plan_1280');
  ok(await sinDesbordar(pd), 'ficha a 1280 px sin desbordamiento');
  const pg = await e.sesion('ivan@pruebas.local', 1280);
  const [mda3] = await sql`select e.id from public.eventos e where e.clave = 'mda-j3'`;
  await sql`update public.eventos set pista_id = (select id from public.pistas where slug = 'cdm-moratalaz'), numero_pista = 2 where id = ${mda3.id}`;
  await pg.goto(`${APP}/gestion/eventos/${mda3.id}`);
  const wa = await pg.getByTestId('mensaje-whatsapp').innerText().catch(() => '');
  ok(wa.includes(MAPA(40.3975133, -3.6315708)), 'Gestión: el mensaje de WhatsApp del partido lleva el enlace de Google Maps', wa.slice(0, 300));
  await pg.goto(`${APP}/gestion/eventos/nuevo`);
  await pg.getByLabel('Pista').selectOption('__libre');
  ok(await visto(pg.getByRole('combobox', { name: 'Sitio' })), 'crear evento: «Otro sitio» abre el buscador');
  await pg.getByRole('combobox', { name: 'Sitio' }).fill('bar esquina');
  await pg.getByRole('option', { name: /Bar La Esquina Calle/ }).first().click();
  ok(await visto(pg.getByTestId('lugar-elegido').getByText('Bar La Esquina')), 'y queda elegido');
  await pg.goto(`${APP}/gestion/eventos/pistas`);
  ok((await pg.locator('input[name="coordenadas"]').first().inputValue()).includes(','), 'Pistas: cada pista con sus coordenadas');
  ok(!e.errores.length, 'sin errores de consola', e.errores.slice(0, 5).join(' | '));
} catch (err) { console.error(err); sumar(); } finally {
  await e.parar();
  osm.close();
}
console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK');
process.exit(fallos() ? 1 : 0);
