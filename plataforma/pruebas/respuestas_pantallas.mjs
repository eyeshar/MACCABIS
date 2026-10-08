#!/usr/bin/env node
// Paso 3 (D99), de extremo a extremo: pila local (Postgres + PostgREST con nuestras migraciones), la web compilada con
// claves VAPID de prueba, un servicio de avisos FALSO por HTTPS (para ver lo que se envia y simular una suscripcion
// caducada, 410) y Chrome con sesion de jugador y de gestor.
//
//   - Interruptor APAGADO: Mi zona y el evento informan sin botones («Por ahora, responde en SportEasy»), sin Ausencias;
//     la banda y /avisos sí; el aviso de prueba sale.
//   - ENCENDIDO: «Te faltan N respuestas», Voy / No voy (hoja con motivo obligatorio, Esc) / Duda, domingo con «Solo al
//     de las 09:00», ausencia con calendario y aviso de «tenías voy», «Quién va» sin motivos.
//   - Gestión: respuestas en la web, «Responder por él», banda roja y «Visto», vista de domingo, editar evento con
//     encuentro calculado y aviso de cambio, tarjeta del interruptor; tarea protegida con secreto.
//   - Suscripción caducada (410): se desactiva sola. 375 px sin desbordamiento y botones de al menos 44 px.
//
//   npm run pruebas:respuestas-pantallas

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import crypto from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import webpush from 'web-push';
import { arrancar } from './pila.mjs';
import { cargarEventos } from '../scripts/cargar_eventos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.join(RAIZ, '..');
const SALIDA = path.join(REPO, 'privado', 'mockups_liga', 'rediseno', 'paso3');
fs.mkdirSync(SALIDA, { recursive: true });
const PUERTO = 3107, PUERTO_PUSH = 3443;
const APP = `http://127.0.0.1:${PUERTO}`;
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };
const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
async function esperar(url, ms = 90000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) { try { const r = await fetch(url); if (r.status < 500) return; } catch {} await new Promise((r) => setTimeout(r, 300)); }
  throw new Error(`${url} no arranca`);
}

// ---------------------------------------------------------------- servicio de avisos falso (HTTPS, certificado propio)
const dirCert = fs.mkdtempSync(path.join(os.tmpdir(), 'maccabis-push-'));
const openssl = ['C:/Program Files/Git/usr/bin/openssl.exe', 'C:/Program Files/Git/mingw64/bin/openssl.exe', 'openssl'].find((x) => x === 'openssl' || fs.existsSync(x));
execFileSync(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(dirCert, 'k.pem'), '-out', path.join(dirCert, 'c.pem'), '-days', '1', '-subj', '/CN=127.0.0.1'], { stdio: 'ignore' });
const recibidos = [];
const push = https.createServer({ key: fs.readFileSync(path.join(dirCert, 'k.pem')), cert: fs.readFileSync(path.join(dirCert, 'c.pem')) }, (req, res) => {
  recibidos.push(req.url);
  req.resume();
  req.on('end', () => { res.writeHead(req.url.includes('caducada') ? 410 : 201); res.end(); });
});
await new Promise((r) => push.listen(PUERTO_PUSH, '127.0.0.1', r));
const clavesMovil = () => {
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  return { p256dh: ecdh.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') };
};

const pila = await arrancar();
let app, nav;
try {
  const { sql, url, anonKey } = pila;
  await cargarEventos(sql, { log: () => {} });
  const id = async (clave) => (await sql`select id from public.eventos where clave = ${clave}`)[0].id;
  // Un entreno abierto en los próximos días (para el bloque «Te faltan»), J3 (horas distintas) y J2 (misma hora).
  const [e1] = await sql`select id, fecha::text from public.eventos where tipo = 'entreno' and estado = 'programado' and fecha > ${hoy} order by fecha limit 1`;
  const E = { entreno: e1.id, entrenoFecha: e1.fecha, mdaJ3: await id('mda-j3'), mdlJ3: await id('mdl-j3'), mdaJ2: await id('mda-j2') };
  const jugadorEmail = 'jon@pruebas.local', gestorEmail = 'gestor@pruebas.local';
  await sql`update public.jugadores set email = ${jugadorEmail} where person_id = 'esteban-jon'`;
  const jUid = await pila.crearUsuario(jugadorEmail, 'x');
  const gUid = await pila.crearUsuario(gestorEmail, 'x');
  await sql`insert into public.gestores (user_id, nombre, email) values (${gUid}, 'Iván', ${gestorEmail})`;
  // Iván es gestor y jugador (su ficha): solo él maneja el interruptor (D103). Carlos, otro gestor: solo lectura.
  await sql`update public.jugadores set email = ${gestorEmail} where person_id = 'villaescusa-silva-ivan'`;
  const cUid = await pila.crearUsuario('carlos-gestor@pruebas.local', 'x');
  await sql`insert into public.gestores (user_id, nombre, email) values (${cUid}, 'Carlos', 'carlos-gestor@pruebas.local')`;
  const codigoDe = async (email) => (await sql`select codigo from public._otp_pruebas where email = ${email}`)[0]?.codigo;

  console.log('\n== Compilación con claves de avisos de prueba');
  const vapid = webpush.generateVAPIDKeys();
  const servicio = await pila.firmar({ role: 'service_role', iss: 'supabase-local' }, 3600 * 24);
  const secreto = crypto.randomBytes(32).toString('hex');
  const env = {
    ...process.env, NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey, NEXT_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey, VAPID_SUBJECT: 'mailto:pruebas@maccabis.invalid',
    SUPABASE_SERVICE_ROLE_KEY: servicio, AVISOS_SECRETO: secreto, NODE_TLS_REJECT_UNAUTHORIZED: '0',
  };
  const next = path.join(RAIZ, 'node_modules', 'next', 'dist', 'bin', 'next');
  execFileSync(process.execPath, [next, 'build'], { cwd: RAIZ, env, stdio: 'ignore' });
  ok(true, 'next build');
  app = spawn(process.execPath, [next, 'start', '-p', String(PUERTO), '-H', '127.0.0.1'], { cwd: RAIZ, env, stdio: 'ignore' });
  await esperar(APP);
  nav = await chromium.launch({ channel: 'chrome', headless: true });
  const errores = [];
  const nuevaPagina = async (ctx) => { const p = await ctx.newPage(); p.on('pageerror', (e) => errores.push(`${p.url()} ${e.message}`)); p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) errores.push(`${p.url()} ${m.text()}`); }); return p; };
  async function entrar(p, email) {
    await p.goto(`${APP}/entrar`);
    await p.getByLabel('Tu correo').fill(email);
    await p.getByRole('button', { name: 'Enviarme el código' }).click();
    await p.getByText('Código enviado a').waitFor({ timeout: 10000 });
    await p.getByLabel('Código de 6 dígitos').fill((await codigoDe(email)) ?? '000000');
    await p.getByRole('button', { name: 'Entrar', exact: true }).click();
    await p.waitForURL((u) => !u.pathname.startsWith('/entrar') || u.pathname.startsWith('/entrar/elegir'), { timeout: 15000 });
  }
  const visto = async (loc) => { try { await loc.first().waitFor({ state: 'visible', timeout: 8000 }); return true; } catch { return false; } };
  const oculto = async (loc) => { try { await loc.first().waitFor({ state: 'hidden', timeout: 5000 }); return true; } catch { return false; } };
  const sinDesbordar = async (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const tactiles = async (p, sel) => p.evaluate((s) => [...document.querySelectorAll(s)].filter((x) => x.offsetParent).map((x) => { const r = x.getBoundingClientRect(); return { t: x.textContent.trim().slice(0, 30), h: Math.round(r.height), w: Math.round(r.width) }; }).filter((x) => x.h < 44 || x.w < 44), sel);
  const foto = (p, n) => p.screenshot({ path: path.join(SALIDA, `${n}.png`), fullPage: true }).catch(() => {});
  const mensajes = async (p) => (await p.locator('.ev-mensaje').allInnerTexts()).join(' ');
  const urlsMensajes = (t) => [...t.matchAll(/https?:\/\/[^\s)]+/g)].map((m) => m[0]);

  console.log('\n== Tarea de avisos: protegida con secreto');
  ok((await fetch(`${APP}/api/avisos/tarea`, { method: 'POST' })).status === 401, 'sin secreto: 401');
  ok((await fetch(`${APP}/api/avisos/tarea`, { method: 'POST', headers: { authorization: 'Bearer otro-secreto-que-no-es-el-bueno-0000000000' } })).status === 401, 'con un secreto equivocado: 401');
  let t = await fetch(`${APP}/api/avisos/tarea`, { method: 'POST', headers: { authorization: `Bearer ${secreto}` } });
  let tj = await t.json();
  ok(t.status === 200 && tj.encendido === false && tj.encolados === 0, 'con el secreto: 200; interruptor apagado → ningún recordatorio', JSON.stringify(tj));

  console.log('\n== Jugador con el interruptor APAGADO (móvil, 375 px)');
  const ctxJ = await nav.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const pj = await nuevaPagina(ctxJ);
  await entrar(pj, jugadorEmail);
  await pj.goto(`${APP}/mi-zona`);
  ok(await visto(pj.getByText('Activa los avisos en este móvil')), 'banda amarilla «Activa los avisos en este móvil»');
  ok(await visto(pj.getByText('Por ahora, responde en SportEasy.')), '«Por ahora, responde en SportEasy»');
  ok((await pj.locator('.rw-banda svg').count()) === 1 && !(await pj.locator('.rw-banda').innerText()).includes('🔔'), 'la banda lleva la campana dibujada (icono), no el emoji 🔔');
  ok(!(await pj.locator('.rw-btn').count()) && !(await pj.getByText(/Te faltan|Te falta 1/).count()), 'sin botones para responder ni «Te faltan…»');
  ok(!(await pj.locator('nav[aria-label="Mi zona"]').getByText('Ausencias').count()) && !(await pj.getByText('Marcar días que no estoy').count()), 'sin «Ausencias» en la barra ni «Marcar días que no estoy»');
  ok(await sinDesbordar(pj), 'Mi zona a 375 px sin desbordamiento');
  await foto(pj, 'mizona_apagado_375');
  await pj.goto(`${APP}/mi-zona/ausencias`);
  ok(new URL(pj.url()).pathname === '/mi-zona', '/mi-zona/ausencias apagado → vuelve a Mi zona');
  await pj.goto(`${APP}/mi-zona/evento/${E.entreno}`);
  ok(await visto(pj.getByRole('heading', { name: '¿Vas?' })) && await visto(pj.getByText('Por ahora, responde en SportEasy.')) && !(await pj.locator('.rw-btn').count()), 'evento: la información, sin botones, con «Por ahora, responde en SportEasy»');
  ok(await visto(pj.getByText(/encuentro \d\d:\d\d/)), 'evento: «HH:MM–HH:MM · encuentro HH:MM»');
  await pj.goto(`${APP}/avisos`);
  ok(await visto(pj.getByText('Solo te avisamos si te falta responder')) && await visto(pj.getByText('Nunca de noche.')), '/avisos: el texto de arriba');
  ok(await visto(pj.getByRole('button', { name: 'Activar avisos en este móvil' })), '/avisos (Chrome, no iPhone): «Activar avisos en este móvil»');
  ok(await visto(pj.getByText('Si dijiste «No permitir»')), '/avisos: bloque «Si dijiste No permitir»');
  ok(await sinDesbordar(pj), '/avisos a 375 px sin desbordamiento');
  await foto(pj, 'avisos_375');
  // iPhone en Safari sin instalar: los tres pasos
  const ctxI = await nav.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' });
  await ctxI.addCookies(await ctxJ.cookies());
  const pi = await nuevaPagina(ctxI);
  await pi.goto(`${APP}/avisos`);
  ok(await visto(pi.getByText('En iPhone, primero instálala')) && (await pi.locator('.av-paso').count()) === 3 && await visto(pi.getByText('«Añadir a pantalla de inicio»')), 'iPhone en Safari: tres pasos (Compartir → Añadir a pantalla de inicio → abrir desde el icono)', `${pi.url()} ${(await pi.locator('main').innerText()).slice(0, 300)}`);
  await foto(pi, 'avisos_iphone_375');
  const ctxC = await nav.newContext({ viewport: { width: 375, height: 812 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1' });
  await ctxC.addCookies(await ctxJ.cookies());
  const pc = await nuevaPagina(ctxC);
  await pc.goto(`${APP}/avisos`);
  ok(await visto(pc.getByText('Abre esta página en Safari')), 'iPhone con Chrome: «Abre esta página en Safari»');
  await ctxI.close(); await ctxC.close();

  console.log('\n== Aviso de prueba (funciona apagado) y suscripción caducada (410)');
  const k1 = clavesMovil(), k2 = clavesMovil();
  await sql`insert into public.suscripciones_avisos (user_id, person_id, endpoint, p256dh, auth, navegador) values
    (${jUid}, 'esteban-jon', ${`https://127.0.0.1:${PUERTO_PUSH}/ok/jon`}, ${k1.p256dh}, ${k1.auth}, 'Android · Chrome'),
    (${jUid}, 'esteban-jon', ${`https://127.0.0.1:${PUERTO_PUSH}/caducada/jon`}, ${k2.p256dh}, ${k2.auth}, 'iPhone · Safari · instalada')`;
  // El boton «Mandarme un aviso de prueba» solo aparece si ESTE navegador esta suscrito (Chrome sin permisos de avisos
  // no lo esta): el envio del aviso de prueba se prueba por el mismo camino, el registro + la tarea.
  const antesPush = recibidos.length;
  await sql`insert into public.avisos_registro (clave, tipo, user_id, titulo, cuerpo, url, programado_para) values ('prueba:test', 'prueba', ${jUid}, 'Aviso de prueba', 'Así te llegarán los avisos de Maccabis.', '/avisos', now())`;
  t = await fetch(`${APP}/api/avisos/tarea`, { method: 'POST', headers: { authorization: `Bearer ${secreto}` } });
  tj = await t.json();
  ok(t.status === 200 && tj.enviados === 1 && recibidos.length - antesPush === 2, `el aviso de prueba sale con el interruptor apagado (llega a los 2 móviles: ${recibidos.slice(antesPush).join(', ')})`, JSON.stringify(tj));
  const subs = await sql`select endpoint, activa, motivo_baja, ultimo_envio_ok from public.suscripciones_avisos where person_id = 'esteban-jon' order by endpoint`;
  ok(subs.find((s) => s.endpoint.includes('/caducada/'))?.activa === false && subs.find((s) => s.endpoint.includes('/caducada/'))?.motivo_baja === 'caducada', 'la suscripción que responde 410 se desactiva sola');
  ok(subs.find((s) => s.endpoint.includes('/ok/'))?.activa === true && subs.find((s) => s.endpoint.includes('/ok/'))?.ultimo_envio_ok, 'la buena sigue activa y guarda el último envío correcto');
  const [reg] = await sql`select enviado_en, resultado, enviados, fallidos from public.avisos_registro where clave = 'prueba:test'`;
  ok(reg.enviado_en && reg.resultado === 'enviado' && reg.enviados === 1 && reg.fallidos === 1, 'el registro guarda enviado, resultado y cuántos');
  t = await fetch(`${APP}/api/avisos/tarea`, { method: 'POST', headers: { authorization: `Bearer ${secreto}` } });
  ok((await t.json()).enviados === 0 && recibidos.length - antesPush === 2, 'repetir la tarea no reenvía nada');

  console.log('\n== ENCENDIDO: el jugador responde');
  await sql`update public.respuestas_web_config set encendido = true, encendido_desde = now() where id = 1`;
  await pj.goto(`${APP}/mi-zona`);
  ok(await visto(pj.getByText(/Te faltan \d+ respuestas|Te falta 1 respuesta/).first()), '«Te faltan N respuestas»');
  ok(await visto(pj.locator('nav[aria-label="Mi zona"]').getByText('Ausencias')) && await visto(pj.getByText('Marcar días que no estoy')), 'aparecen «Ausencias» y «Marcar días que no estoy»');
  ok(!(await pj.getByText('Por ahora, responde en SportEasy').count()) && !(await pj.getByText('(SportEasy)').count()), 'ya no se habla de SportEasy');
  const tarjeta = pj.locator('.rw-tarjeta').filter({ has: pj.locator(`a[href="/mi-zona/evento/${E.entreno}"]`) });
  ok(await tarjeta.count() === 1, 'el próximo entreno tiene su tarjeta con los botones');
  const pequenos = await tactiles(pj, '.rw-btn, .rw-banda, .rw-marcar, .zb a');
  ok(!pequenos.length, 'botones y enlaces de Mi zona de al menos 44 px', JSON.stringify(pequenos));
  ok(await sinDesbordar(pj), 'Mi zona encendido a 375 px sin desbordamiento');
  // D105: saludo, banda «Activa los avisos», «Te faltan N», «Tu agenda» y después lo demás; «Lo último que jugaste» nunca sobre el saludo.
  const ordenMovil = () => pj.evaluate(() => {
    const falso = !document.querySelector('#ultimo');
    if (falso) { const s = document.createElement('section'); s.id = 'ultimo'; s.className = 'mz-sec'; s.textContent = 'Lo último que jugaste'; document.querySelector('.mz-ancha').append(s); }
    const y = (sel) => { const e = document.querySelector(sel); return e ? Math.round(e.getBoundingClientRect().top + scrollY) : null; };
    const r = { hola: y('.mz-hola'), banda: y('.rw-banda'), faltan: y('.rw-faltan'), agenda: y('#agenda'), marcar: y('.rw-marcar'), domingo: y('#domingo'), ropa: y('#ropa'), ultimo: y('#ultimo'), temporada: y('#temporada') };
    if (falso) document.querySelector('#ultimo').remove();
    return r;
  });
  const om = await ordenMovil();
  const crece = (...xs) => xs.every((x) => x != null) && xs.every((x, i) => i === 0 || x > xs[i - 1]);
  ok(crece(om.hola, om.banda, om.faltan, om.agenda, om.marcar, om.domingo, om.ropa, om.ultimo, om.temporada), 'Mi zona en el móvil: saludo → banda → «Te faltan» → «Tu agenda» → … → «Lo último que jugaste» → temporada', JSON.stringify(om));
  await foto(pj, 'mizona_encendido_375');
  await tarjeta.getByRole('button', { name: 'Voy', exact: true }).click();
  await pj.waitForTimeout(1500);
  ok((await sql`select respuesta from public.respuestas where evento_id = ${E.entreno} and person_id = 'esteban-jon'`)[0]?.respuesta === 'va', '«Voy» en la tarjeta: guardado');

  console.log('\n== Hoja «No voy»: motivo obligatorio, Esc, diálogo accesible');
  await pj.goto(`${APP}/mi-zona/evento/${E.entreno}`);
  ok(await visto(pj.getByText('Si no vas, te pedimos el motivo. Puedes cambiar tu respuesta cuando quieras.')), 'el texto «Si no vas, te pedimos el motivo…»');
  ok(await visto(pj.getByRole('heading', { name: 'Quién va' })) && await visto(pj.getByText(/sin responder/).first()), '«Quién va» con nombres y el número de los que no han respondido');
  await pj.getByRole('button', { name: 'No voy', exact: true }).click();
  const dlg = pj.getByRole('dialog');
  ok(await dlg.isVisible() && await visto(dlg.getByRole('heading', { name: /^No voy al entreno del / })), 'abre «No voy al entreno del …» como diálogo');
  ok(await visto(dlg.getByText('Solo lo ven los gestores.')) && (await dlg.getByRole('radio').count()) === 5 && await visto(dlg.getByPlaceholder('Ej.: turno de tarde')), 'cinco motivos, «Solo lo ven los gestores» y detalle «Ej.: turno de tarde»');
  ok(await dlg.getByRole('button', { name: 'Guardar «no voy»' }).isDisabled(), '«Guardar «no voy»» desactivado hasta elegir motivo');
  await pj.keyboard.press('Escape');
  await pj.waitForTimeout(300);
  ok(await oculto(dlg) && (await pj.evaluate(() => document.activeElement?.textContent)) === 'No voy', 'Esc la cierra y devuelve el foco al botón', String(await pj.evaluate(() => document.activeElement?.outerHTML.slice(0, 120))));
  await pj.getByRole('button', { name: 'No voy', exact: true }).click();
  await dlg.getByText('Trabajo').click();
  await dlg.getByPlaceholder('Ej.: turno de tarde').fill('Turno de tarde');
  await foto(pj, 'hoja_novoy_375');
  await dlg.getByRole('button', { name: 'Guardar «no voy»' }).click();
  await pj.waitForTimeout(1500);
  const [rn] = await sql`select respuesta, motivo, detalle from public.respuestas where evento_id = ${E.entreno} and person_id = 'esteban-jon'`;
  ok(rn.respuesta === 'no' && rn.motivo === 'trabajo' && rn.detalle === 'Turno de tarde', '«no voy» guardado con motivo y detalle');
  ok(await sinDesbordar(pj), 'evento a 375 px sin desbordamiento');
  await foto(pj, 'evento_375');
  // Otro jugador con motivo: Jon no lo ve
  await sql`select public._escribir_respuesta(${E.entreno}, 'gianatti-adriano', 'no', 'lesion', 'Rodilla izquierda', 'sporteasy', null, null, null)`;
  await pj.reload();
  const textoEvento = await pj.locator('main').innerText();
  ok(textoEvento.includes('Adriano') && !textoEvento.includes('Rodilla') && !/Lesi[oó]n/.test(textoEvento.split('Quién va')[1] ?? ''), '«Quién va»: Adriano en «No van», sin su motivo');

  console.log('\n== Domingo con horas distintas (J3, 25/10)');
  await pj.goto(`${APP}/mi-zona/domingo/2026-10-25`);
  ok((await pj.locator('.rw-partido').count()) === 2 && await visto(pj.getByText('Estar disponible no es estar convocado: en la convocatoria te decimos en qué equipo juegas.')), 'las dos tarjetas de partido y la nota de convocatoria');
  for (const o of ['A los dos', 'Solo al de las 09:00 (MdA)', 'Solo al de las 14:00 (MdL)', 'No voy', 'Duda']) ok(await visto(pj.getByRole('button', { name: o })), `opción «${o}»`);
  await pj.getByRole('button', { name: 'Solo al de las 09:00 (MdA)' }).click();
  await pj.waitForTimeout(1500);
  const d3 = Object.fromEntries((await sql`select e.equipo, r.respuesta, r.motivo from public.respuestas r join public.eventos e on e.id = r.evento_id where e.fecha = '2026-10-25' and e.tipo = 'liga' and r.person_id = 'esteban-jon'`).map((x) => [x.equipo, `${x.respuesta}${x.motivo ? '·' + x.motivo : ''}`]));
  ok(d3.MdA === 'va' && d3.MdL === 'no·horario', '«Solo al de las 09:00» → va en MdA y «no · horario» en MdL', JSON.stringify(d3));
  ok(await sinDesbordar(pj) && !(await tactiles(pj, '.rw-opcion')).length, 'domingo a 375 px sin desbordamiento y opciones de 44 px o más');
  await foto(pj, 'domingo_375');
  await pj.goto(`${APP}/mi-zona/evento/${E.mdaJ3}`);
  ok(new URL(pj.url()).pathname === '/mi-zona/domingo/2026-10-25', 'abrir un partido de un domingo con dos horas lleva al domingo');
  await pj.goto(`${APP}/mi-zona/domingo/2026-10-18`);
  ok(await visto(pj.getByRole('button', { name: 'Voy', exact: true })) && !(await pj.getByRole('button', { name: 'A los dos' }).count()), 'misma hora (J2): Voy / No voy / Duda');
  ok(await sinDesbordar(pj), 'domingo con misma hora a 375 px sin desbordamiento');
  await foto(pj, 'domingo_misma_hora_375');

  console.log('\n== Ausencias');
  await pj.goto(`${APP}/mi-zona/ausencias/nueva`);
  ok(await sinDesbordar(pj), 'nueva ausencia a 375 px sin desbordamiento');
  // Mes de la J3: avanzar hasta octubre/noviembre según hoy
  while (!(await pj.getByText('Octubre 2026').count())) await pj.getByRole('button', { name: 'Mes siguiente' }).click();
  await pj.getByRole('button', { name: /^domingo 25 de octubre/ }).click();
  await pj.getByRole('button', { name: /^miércoles 28 de octubre/ }).click();
  await pj.locator('label.rw-motivo', { hasText: 'Viaje' }).click();
  await pj.getByText(/Pondremos «no voy» en/).waitFor({ timeout: 10000 });
  ok(await visto(pj.getByText(/Pondremos «no voy» en \d+ eventos?/)), 'resumen «Pondremos «no voy» en N eventos: …»');
  ok(await visto(pj.getByText(/Tenías «voy» en .*pasará a «no voy»/)), 'aviso «Tenías «voy» en …: pasará a «no voy»» (el MdA del 25)');
  ok(await visto(pj.getByText('Si la borras, esos eventos vuelven a «sin responder».')), 'nota del borrado');
  ok((await pj.locator('.rw-cal-dia.en-franja').count()) === 4, 'la franja 25–28 queda marcada (4 días)');
  ok((await pj.locator('.rw-cal-punto').count()) > 0, 'un punto señala los días con evento');
  await foto(pj, 'ausencia_nueva_375');
  await pj.getByRole('button', { name: 'Guardar ausencia' }).click();
  await pj.waitForURL(/\/mi-zona\/ausencias/, { timeout: 15000 });
  ok(await visto(pj.getByText('Ausencia guardada.')) && await visto(pj.getByText(/Del domingo 25 oct al miércoles 28 oct/)), 'la ausencia sale en «Mis ausencias»');
  const d3b = (await sql`select r.respuesta, r.motivo from public.respuestas r join public.eventos e on e.id = r.evento_id where e.fecha = '2026-10-25' and e.tipo = 'liga' and r.person_id = 'esteban-jon'`);
  ok(d3b.every((x) => x.respuesta === 'no' && x.motivo === 'viaje'), 'los partidos del 25 pasan a «no · viaje»');
  ok(await sinDesbordar(pj), 'Mis ausencias a 375 px sin desbordamiento');
  await foto(pj, 'ausencias_375');
  pj.once('dialog', (d) => d.accept());
  await pj.getByRole('button', { name: 'Borrar' }).click();
  await pj.waitForTimeout(1500);
  ok((await sql`select count(*)::int n from public.respuestas r join public.eventos e on e.id = r.evento_id where e.fecha = '2026-10-25' and r.person_id = 'esteban-jon' and r.respuesta = 'sin_responder'`)[0].n === 2, 'al borrarla, el domingo vuelve a «sin responder»');
  await pj.goto(`${APP}/mi-zona`);
  ok(await visto(pj.locator('.rw-estado').first()), '«Tu agenda» con estado por evento');
  const htmlJ = await pj.content();
  ok(!/nivel|posici[oó]n|Rodilla/i.test(htmlJ), 'nada de niveles, posiciones ni motivos ajenos en Mi zona');

  console.log('\n== Gestión');
  const ctxG = await nav.newContext({ viewport: { width: 1280, height: 900 } });
  const pg = await nuevaPagina(ctxG);
  await entrar(pg, gestorEmail);
  await sql`insert into public.alertas_gestores (evento_id, person_id, antes, despues) values (${E.mdaJ2}, 'esteban-jon', 'va', 'no')`;
  await pg.goto(`${APP}/gestion/eventos/${E.entreno}/respuestas`);
  ok(await pg.getByTestId('origen-respuestas').innerText() === 'Respuestas en la web', 'etiqueta «Respuestas en la web»');
  ok((await pg.getByTestId('contadores').innerText()).includes('van') && (await pg.getByTestId('contadores').innerText()).includes('sin responder'), 'cajas van / dudan / no van / sin responder');
  const tabla = await pg.getByTestId('tabla-respuestas').innerText();
  ok(/Trabajo · Turno de tarde/.test(tabla) && /Lesión · Rodilla izquierda/.test(tabla), 'los gestores ven motivo y detalle');
  ok(/en la web/.test(tabla) && /leído de SportEasy/.test(tabla), 'cada respuesta dice su origen');
  ok(!(await pg.getByTestId('recordatorio').count()) && await visto(pg.getByRole('button', { name: 'Enviar un recordatorio ahora' })), 'sin «Pedir recordatorio a Claude»; con «Enviar un recordatorio ahora»');
  ok(await visto(pg.getByTestId('recordatorios-automaticos').getByText('Lunes a las 19:00')), 'lateral «Recordatorios automáticos»');
  ok(await visto(pg.getByTestId('sin-avisos').getByText(/Sin avisos activados · \d+/)) && await visto(pg.getByTestId('sin-avisos').getByRole('button', { name: /Copiar mensaje/ })), 'tarjeta «Sin avisos activados · N» con «Copiar mensaje»');
  const fila = pg.locator('tr', { hasText: 'Daniele' });
  if (!(await visto(fila.getByRole('button', { name: /^Responder por / })))) console.log('   tabla:', (await pg.locator('main').innerText()).slice(0, 1500));
  ok(await visto(pg.locator('tr', { hasText: 'Daniele' }).getByRole('button', { name: /^Responder por / })) && !(await pg.locator('tr', { hasText: 'Carlos (entrenador)' }).count()), 'encendido: «Responder por él» aparece; Carlos (entrenador) no está en la lista de quien responde');
  await fila.getByRole('button', { name: /^Responder por / }).click();
  await fila.getByLabel('Respuesta').selectOption('duda');
  await fila.getByRole('button', { name: 'Guardar' }).click();
  await pg.waitForTimeout(1500);
  const [pp] = await sql`select respuesta, origen, puesto_por_nombre from public.respuestas where evento_id = ${E.entreno} and person_id = 'vallesi-daniele'`;
  ok(pp?.respuesta === 'duda' && pp.origen === 'gestor' && pp.puesto_por_nombre === 'Iván', '«Responder por él» guarda la respuesta con «puesto por Iván»');
  await pg.reload();
  ok(/puesto por Iván/.test(await pg.getByTestId('tabla-respuestas').innerText()), 'y la lista lo dice («puesto por Iván»)');
  await foto(pg, 'gestion_respuestas_escritorio');
  await pg.goto(`${APP}/gestion/eventos/${E.mdaJ2}/respuestas`);
  ok(await visto(pg.getByTestId('banda-roja')), 'banda roja con el cambio después del martes');
  await pg.getByTestId('banda-roja').getByRole('button', { name: 'Visto' }).click();
  await pg.waitForTimeout(1500);
  await pg.reload();
  ok(!(await pg.getByTestId('banda-roja').count()), '«Visto» la quita');
  await pg.goto(`${APP}/gestion/eventos/${E.mdaJ3}/respuestas`);
  const cajas3 = await pg.getByTestId('contadores').innerText();
  ok(/a los dos/.test(cajas3) && /solo 09:00/.test(cajas3) && /solo 14:00/.test(cajas3), 'domingo: vista de día con «a los dos / solo 09:00 / solo 14:00»', cajas3);
  await sql`insert into public.respuestas_domingo (fecha, person_id, opcion, solo_evento, origen) values ('2026-10-25', 'vallesi-daniele', 'solo', ${E.mdlJ3}, 'gestor')
            on conflict (fecha, person_id) do update set opcion = 'solo', solo_evento = excluded.solo_evento, vigente = true`;
  await pg.reload();
  ok(/Solo 14:00 \(MdL\)/.test(await pg.locator('tr', { hasText: 'Daniele' }).innerText()), 'la respuesta guardada del domingo se lee tal cual: «Solo 14:00 (MdL)» (D103)');
  await foto(pg, 'gestion_domingo_escritorio');

  console.log('\n== Editar evento: encuentro calculado y aviso de cambio');
  await pg.goto(`${APP}/gestion/eventos/${E.entreno}`);
  const textoEditar = await pg.locator('main').innerText();
  ok(/serie miércoles 20:30–22:30/.test(textoEditar) && !/entreno-semanal/.test(textoEditar), 'Editar evento: «serie miércoles 20:30–22:30», sin el nombre interno «entreno-semanal»', textoEditar.match(/Este evento es parte de.{0,80}/)?.[0]);
  const enlacesEvento = urlsMensajes(await mensajes(pg));
  ok(enlacesEvento.every((u) => u.startsWith('https://maccabis.vercel.app')), 'y los mensajes del evento llevan la dirección de producción', enlacesEvento.join(' '));
  ok(await visto(pg.getByTestId('encuentro')) && !(await pg.locator('input[name="quedada"][type="time"]').count()), 'el encuentro se muestra calculado (no es un campo libre)');
  ok(await visto(pg.getByTestId('bloque-recordatorios').getByText('Sin recordatorios para este evento')), 'bloque «Recordatorios» con «Sin recordatorios para este evento»');
  await pg.getByLabel('Empieza').fill('20:00');
  ok((await pg.getByTestId('encuentro').innerText()) === '19:40', 'cambiar la hora recalcula el encuentro (20:00 → 19:40)');
  ok(await visto(pg.getByTestId('vista-previa-aviso')) && /Sigues en «Voy»: si ya no puedes, cámbialo\./.test(await pg.getByTestId('vista-previa-aviso').innerText()), 'recuadro amarillo con la vista previa del aviso y a cuántos llega');
  ok(await visto(pg.getByRole('button', { name: 'Guardar sin avisar' })) && await pg.getByRole('button', { name: 'Guardar y avisar' }).isEnabled(), '«Guardar sin avisar» y «Guardar y avisar»');
  await foto(pg, 'gestion_editar_escritorio');
  await pg.getByRole('button', { name: 'Guardar y avisar' }).click();
  await pg.getByTestId('aviso-guardado').waitFor({ timeout: 20000 });
  const [cv] = await sql`select cambio_visible, inicio::text from public.eventos where id = ${E.entreno}`;
  ok(cv.inicio.startsWith('20:00') && cv.cambio_visible?.campos?.includes('hora'), 'guardado: hora nueva y «cambio visible» para la línea amarilla');
  const avisosCambio = await sql`select person_id, titulo, cuerpo from public.avisos_registro where tipo = 'cambio' and ${E.entreno} = any(eventos)`;
  ok(avisosCambio.length > 20 && avisosCambio.every((a) => a.titulo.startsWith('Cambio en el entreno del')), `«Guardar y avisar»: un aviso por invitado (${avisosCambio.length})`);
  ok((await sql`select count(*)::int n from public.respuestas where evento_id = ${E.entreno} and respuesta <> 'sin_responder'`)[0].n >= 2, 'cambiar la hora mantiene las respuestas');
  await pj.goto(`${APP}/mi-zona/evento/${E.entreno}`);
  const linea = (await visto(pj.locator('.rw-cambio'))) ? await pj.locator('.rw-cambio').first().innerText() : '';
  ok(/^Cambió la hora el \d\d\/\d\d \(antes: 20:30–22:30\)$/.test(linea), 'el jugador ve la línea amarilla «Cambió la hora el DD/MM (antes: …)»', linea);
  await pg.goto(`${APP}/gestion`);
  ok(await visto(pg.getByTestId('tarjeta-activar')) && (await pg.getByTestId('estado-interruptor').innerText()) === 'Encendido', 'Panel: tarjeta «Respuestas en la web: activar» (Encendido)');
  ok(await visto(pg.getByRole('button', { name: 'Desactivar' })), 'con «Desactivar»');
  ok(/\d+\/27 jugadores ya han entrado en la web/.test(await pg.getByTestId('tarjeta-activar').innerText()) && /mínimo 20/.test(await pg.getByTestId('tarjeta-activar').innerText()), 'condición 2: «N/27 jugadores ya han entrado» (mínimo 20)', (await pg.getByTestId('tarjeta-activar').innerText()).slice(0, 400));
  ok(!/Preparar convocatoria|llega en el paso 2/.test(await pg.locator('main').innerText()), 'el panel ya no dice «Preparar convocatoria: llega en el paso 2»');
  const enlacesPanel = urlsMensajes(await mensajes(pg));
  ok(enlacesPanel.length > 0 && enlacesPanel.every((u) => u.startsWith('https://maccabis.vercel.app')), 'los mensajes de WhatsApp del panel llevan siempre https://maccabis.vercel.app', enlacesPanel.join(' '));
  await foto(pg, 'gestion_panel_escritorio');
  const pg375 = await nuevaPagina(await nav.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true }));
  await pg375.context().addCookies(await ctxG.cookies());
  for (const ruta of ['/gestion', `/gestion/eventos/${E.entreno}/respuestas`, `/gestion/eventos/${E.mdaJ3}/respuestas`, `/gestion/eventos/${E.entreno}`]) {
    await pg375.goto(`${APP}${ruta}`);
    ok(await sinDesbordar(pg375), `${ruta} a 375 px sin desbordamiento`);
  }
  await foto(pg375, 'gestion_editar_375');

  console.log('\n== Importar calendario: «Aplicar y avisar» / «Aplicar sin avisar» (D103)');
  const cal = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'calendario_2026-27.json'), 'utf8'));
  const dma = (f) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`;
  const NOMBRE = { MDA: 'Maccabi de Acostar', MDL: 'Maccabi de Levantar' };
  const bloque = cal.partidos.map((p) => {
    const g = p.equipo === 'MDA' ? 'G1' : 'G2';
    if (p.descansa) return `${g};${p.jornada};${NOMBRE[p.equipo]} descansa;;${dma(p.fecha)};;`;
    const [l, v] = p.local ? [NOMBRE[p.equipo], p.rival] : [p.rival, NOMBRE[p.equipo]];
    return `${g};${p.jornada};${l};${v};${dma(p.fecha)};${p.hora};${p.campo}`;
  });
  const importar = async (lineas, boton) => {
    await pg.goto(`${APP}/gestion/eventos/importar`);
    await pg.locator('#cal-texto').fill(lineas.join('\n'));
    await pg.getByRole('button', { name: 'Comparar' }).click();
    await pg.waitForFunction(() => document.querySelector('[data-testid=titulo-resultado]')?.textContent === '1 cambio');
    await pg.locator('[data-testid=tabla-cambios] tbody tr').getByRole('button', { name: 'Aceptar' }).click();
    ok(await visto(pg.getByRole('button', { name: /^Aplicar y avisar \(1\)/ })) && await visto(pg.getByRole('button', { name: 'Aplicar sin avisar' })), 'encendido: «Aplicar y avisar» (por defecto) y «Aplicar sin avisar»');
    await pg.getByRole('button', { name: boton }).click();
    await pg.getByText(/Aplicado: 1 cambio aceptado/).waitFor({ timeout: 20000 });
  };
  const mdlJ2 = await id('mdl-j2');
  const sinAvisar = bloque.map((l) => (l.startsWith('G2;2;') ? l.replace(';10:15;', ';10:30;') : l));
  await importar(sinAvisar, 'Aplicar sin avisar');
  ok((await sql`select count(*)::int n from public.avisos_registro where tipo = 'cambio' and ${mdlJ2} = any(eventos)`)[0].n === 0 && !(await sql`select cambio_visible from public.eventos where id = ${mdlJ2}`)[0].cambio_visible, '«Aplicar sin avisar»: cambia la hora (MdL J2 10:30) sin avisos ni línea amarilla');
  const conAvisar = sinAvisar.map((l) => (l.startsWith('G1;2;') ? l.replace(';10:15;', ';11:30;') : l));
  await importar(conAvisar, /^Aplicar y avisar/);
  const avJ2 = await sql`select titulo, cuerpo from public.avisos_registro where tipo = 'cambio' and ${E.mdaJ2} = any(eventos)`;
  ok(avJ2.length > 10 && avJ2.every((a) => a.titulo === 'Cambio en el partido del domingo 18' && /11:30/.test(a.cuerpo)), `«Aplicar y avisar»: aviso de cambio a los invitados del MdA (${avJ2.length})`, JSON.stringify(avJ2[0]));
  const [vj2] = await sql`select cambio_visible, inicio::text from public.eventos where id = ${E.mdaJ2}`;
  ok(vj2.inicio.startsWith('11:30') && vj2.cambio_visible?.campos?.includes('hora') && /10:15/.test(vj2.cambio_visible.antes), 'y la línea amarilla «Cambió la hora … (antes: 10:15)»', JSON.stringify(vj2.cambio_visible));

  console.log('\n== Otro gestor (Carlos): la tarjeta del interruptor en solo lectura; copia a SportEasy sin notificar');
  const ctxCg = await nav.newContext({ viewport: { width: 1280, height: 900 } });
  const pcg = await nuevaPagina(ctxCg);
  await entrar(pcg, 'carlos-gestor@pruebas.local');
  await pcg.goto(`${APP}/gestion`);
  ok(await visto(pcg.getByTestId('solo-lectura')) && await pcg.getByRole('button', { name: 'Desactivar' }).isDisabled() && await pcg.locator('.ev-jornadas button').first().isDisabled(), 'Carlos ve la tarjeta en solo lectura (botones y casillas desactivados)');
  await pg.goto(`${APP}/gestion`);
  ok(await visto(pg.getByTestId('tarjeta-activar')) && !(await pg.getByTestId('solo-lectura').count()) && await pg.getByRole('button', { name: 'Desactivar' }).isEnabled(), 'Iván sí la maneja');
  await pcg.goto(`${APP}/gestion/eventos`);
  ok(/Selección manual/.test(await pcg.getByTestId('copia-sin-notificar').innerText()) && /«Enviar una notificación» apagado/.test(await pcg.getByTestId('copia-sin-notificar').innerText()), 'tarjeta «Copia a SportEasy»: formulario completo, «Selección manual» y sin notificación (D104)');
  await ctxCg.close();

  console.log('\n== Apagar: fase puente sin perder nada');
  await sql`update public.respuestas_web_config set encendido = false where id = 1`;
  await pj.goto(`${APP}/mi-zona/evento/${E.entreno}`);
  ok(await visto(pj.getByText('Por ahora, responde en SportEasy.')) && !(await pj.locator('.rw-btn').count()), 'apagado otra vez: sin botones');
  await pg.goto(`${APP}/gestion/eventos/${E.entreno}/respuestas`);
  ok(await pg.getByTestId('origen-respuestas').innerText() === 'Leído de SportEasy' && await visto(pg.getByTestId('recordatorio')), 'Gestión vuelve a «Leído de SportEasy» y «Pedir recordatorio a Claude»');

  await pg.goto(`${APP}/gestion/eventos/${E.entreno}/respuestas`);
  ok(!(await pg.getByRole('button', { name: /^Responder por / }).count()), 'apagado: «Responder por él» no aparece en la lista de respuestas');

  ok(!errores.length, 'sin errores de JS en ninguna página', errores.slice(0, 5).join(' | '));
} finally {
  await nav?.close().catch(() => {});
  app?.kill();
  push.close();
  await pila.parar();
  fs.rmSync(dirCert, { recursive: true, force: true });
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
