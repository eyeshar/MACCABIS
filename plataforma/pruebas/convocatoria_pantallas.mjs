#!/usr/bin/env node
// Convocatoria v1 (D107), de extremo a extremo a 375 px: pila local (Postgres + PostgREST con nuestras migraciones), la
// web compilada y Chrome con sesión de gestor y de jugador. Datos SINTÉTICOS: la plantilla real queda inactiva y se
// crean 18 jugadores «Sint NN» con posiciones y niveles inventados (D39: nada real en las pruebas).
//
//   - Proponer: cabecera, contadores, una tarjeta por equipo, dificultad con su porqué, casillas por línea, sin desbordar.
//   - Cambiar a mano con motivo: pasar al otro equipo (vista previa de las líneas antes de guardar), queda en el historial.
//   - Añadir a uno que dijo «no voy»: lo encuentra en toda la plantilla, avisa antes de guardar, entra con su aviso.
//   - Aprobar y copiar el mensaje: WhatsApp con encuentro, pista, dirección y dorsal, sin niveles; «al día»; el aviso de
//     la web «en espera» (interruptor apagado); SportEasy pendiente; cambiar tras aprobar → pendiente y «qué cambia».
//   - Un domingo con un solo equipo (J4): una sola tarjeta.
//   - Privacidad: el jugador no entra en Gestión; en Mi zona solo «Convocado» con equipo, hora y encuentro.
//
//   npm run pruebas:convocatoria-pantallas

import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import webpush from 'web-push';
import { arrancar } from './pila.mjs';
import { cargarEventos } from '../scripts/cargar_eventos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = path.join(RAIZ, '..', 'privado', 'mockups_liga', 'rediseno', 'convocatoria');
fs.mkdirSync(SALIDA, { recursive: true });
const PUERTO = 3109;
const APP = `http://127.0.0.1:${PUERTO}`;
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };
const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
async function esperar(url, ms = 90000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) { try { const r = await fetch(url); if (r.status < 500) return; } catch {} await new Promise((r) => setTimeout(r, 300)); }
  throw new Error(`${url} no arranca`);
}

// 18 sinteticos: 4 bases, 8 exteriores (2 de reserva), 6 interiores; el 18 dice «no voy» (trabajo) a los dos partidos.
const SINT = [
  ['base', 'A'], ['base', 'B'], ['base', 'C'], ['base', 'D'],
  ['escolta', 'A'], ['escolta', 'B', true], ['alero', 'B'], ['alero', 'C'], ['escolta', 'C', true], ['alero', 'D'], ['escolta', 'D'], ['alero', 'E'],
  ['pivot', 'A'], ['ala_pivot', 'B'], ['pivot', 'C'], ['ala_pivot', 'C'], ['pivot', 'D'], ['ala_pivot', 'E'],
].map(([posicion, nivel, reserva], i) => ({ id: `sint-${String(i + 1).padStart(2, '0')}`, nombre: `Sint ${String(i + 1).padStart(2, '0')}`, posicion, nivel, reserva: !!reserva }));

const pila = await arrancar();
let app, nav;
try {
  const { sql, url, anonKey } = pila;
  await cargarEventos(sql, { log: () => {} });
  // Domingos que vienen: el primero con dos partidos a distinta hora y el primero con uno solo.
  const liga = await sql`select id, equipo, fecha::text, inicio::text from public.eventos where tipo = 'liga' and estado = 'programado' and fecha >= ${hoy} order by fecha, inicio`;
  const porFecha = new Map();
  for (const e of liga) porFecha.set(e.fecha, [...(porFecha.get(e.fecha) ?? []), e]);
  const fechas = [...porFecha.keys()];
  const F2 = fechas.find((f) => porFecha.get(f).length === 2 && porFecha.get(f)[0].inicio !== porFecha.get(f)[1].inicio);
  const F1 = fechas.find((f) => porFecha.get(f).length === 1);
  if (!F2 || !F1) throw new Error('No quedan domingos con dos partidos y con uno en el calendario de pruebas.');
  const proximo = fechas[0];

  // Plantilla real fuera (inactiva) y los sinteticos dentro, con sus datos privados inventados y sus respuestas.
  await sql`update public.jugadores set activo = false`;
  for (const s of SINT) {
    await sql`insert into public.jugadores (person_id, nombre_oficial, nombre_visible, ficha_mda, ficha_mdl) values (${s.id}, ${'Sintetico, ' + s.nombre}, ${s.nombre}, true, true)`;
    await sql`insert into public.jugadores_privado (person_id, posicion, base_reserva, nivel, dobla) values (${s.id}, ${s.posicion}, ${s.reserva}, ${s.nivel}, true)`;
    for (const e of [...porFecha.get(F2), ...porFecha.get(F1), ...porFecha.get(proximo)]) {
      const no = s.id === 'sint-18';
      await sql`insert into public.respuestas (evento_id, person_id, respuesta, motivo) values (${e.id}, ${s.id}, ${no ? 'no' : 'va'}, ${no ? 'trabajo' : null}) on conflict do nothing`;
    }
  }
  // Deuda de rotacion (regla 4.2, D109): Sint 17 dijo «voy» en los 2 ultimos domingos ya jugados y no salio convocado
  // (los sinteticos no estan en las hojas de estadistica); Sint 16, solo en uno.
  const jugados = [...new Set((await sql`select fecha::text from public.eventos where tipo = 'liga' and estado = 'programado' and fecha < ${hoy} order by fecha desc`).map((r) => r.fecha))].slice(0, 2);
  for (const [i, f] of jugados.entries()) {
    for (const ev of await sql`select id from public.eventos where tipo = 'liga' and estado = 'programado' and fecha = ${f}`) {
      await sql`insert into public.respuestas (evento_id, person_id, respuesta) values (${ev.id}, 'sint-17', 'va') on conflict do nothing`;
      if (i === 0) await sql`insert into public.respuestas (evento_id, person_id, respuesta) values (${ev.id}, 'sint-16', 'va') on conflict do nothing`;
    }
  }
  const jugadorEmail = 'sint01@pruebas.local', gestorEmail = 'gestor@pruebas.local';
  await sql`update public.jugadores set email = ${jugadorEmail} where person_id = 'sint-01'`;
  await pila.crearUsuario(jugadorEmail, 'x');
  const gUid = await pila.crearUsuario(gestorEmail, 'x');
  await sql`insert into public.gestores (user_id, nombre, email) values (${gUid}, 'Gestor', ${gestorEmail})`;
  const codigoDe = async (email) => (await sql`select codigo from public._otp_pruebas where email = ${email}`)[0]?.codigo;

  console.log('\n== Compilación');
  // Claves de la pila local (nunca las reales de .env.local): servicio firmado para la pila y VAPID de prueba.
  const vapid = webpush.generateVAPIDKeys();
  const env = {
    ...process.env, NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey, NEXT_TELEMETRY_DISABLED: '1',
    SUPABASE_SERVICE_ROLE_KEY: await pila.firmar({ role: 'service_role', iss: 'supabase-local' }, 3600 * 24),
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey, VAPID_SUBJECT: 'mailto:pruebas@maccabis.invalid',
  };
  const next = path.join(RAIZ, 'node_modules', 'next', 'dist', 'bin', 'next');
  execFileSync(process.execPath, [next, 'build'], { cwd: RAIZ, env, stdio: 'ignore' });
  ok(true, 'next build');
  app = spawn(process.execPath, [next, 'start', '-p', String(PUERTO), '-H', '127.0.0.1'], { cwd: RAIZ, env, stdio: 'ignore' });
  await esperar(APP);
  nav = await chromium.launch({ channel: 'chrome', headless: true });
  const errores = [];
  const nuevaPagina = async (ctx) => {
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errores.push(`${p.url()} ${e.message}`));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) errores.push(`${p.url()} ${m.text()}`); });
    p.on('dialog', (d) => d.accept());
    return p;
  };
  async function entrar(p, email) {
    await p.goto(`${APP}/entrar`);
    await p.getByLabel('Tu correo').fill(email);
    await p.getByRole('button', { name: 'Enviarme el código' }).click();
    await p.getByText('Código enviado a').waitFor({ timeout: 10000 });
    await p.getByLabel('Código de 6 dígitos').fill((await codigoDe(email)) ?? '000000');
    await p.getByRole('button', { name: 'Entrar', exact: true }).click();
    await p.waitForURL((u) => !u.pathname.startsWith('/entrar') || u.pathname.startsWith('/entrar/elegir'), { timeout: 15000 });
  }
  const visto = async (loc) => { try { await loc.first().waitFor({ state: 'visible', timeout: 10000 }); return true; } catch { return false; } };
  const sinDesbordar = async (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const pequenos = async (p, sel) => p.evaluate((s) => [...document.querySelectorAll(s)].filter((x) => x.offsetParent).map((x) => { const r = x.getBoundingClientRect(); return { t: x.textContent.trim().slice(0, 30), h: Math.round(r.height) }; }).filter((x) => x.h < 44), sel);
  const foto = (p, n) => p.screenshot({ path: path.join(SALIDA, `${n}.png`), fullPage: true }).catch(() => {});
  const equipoDe = async (p, eq) => p.locator(`[data-testid="cv-equipo-${eq}"] li[data-person]`).evaluateAll((xs) => xs.map((x) => x.getAttribute('data-person')));

  const ctxG = await nav.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  await ctxG.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: APP });
  const pg = await nuevaPagina(ctxG);
  await entrar(pg, gestorEmail);

  console.log(`\n== Proponer (${F2}, dos partidos a distinta hora)`);
  await pg.goto(`${APP}/gestion/convocatoria?fecha=${F2}`);
  ok(await visto(pg.getByRole('heading', { level: 1, name: /Jornada \d+/ })), 'cabecera con la jornada');
  ok(/\d\d\/\d\d/.test(await pg.getByTestId('cv-fecha').innerText()), 'y la fecha');
  const cont = await pg.getByTestId('cv-contadores').innerText();
  ok(/17\s*van/.test(cont) && /0\s*sin responder/.test(cont) && /1\s*no van/.test(cont), 'contadores: 17 van / 0 sin responder / 1 no van', cont.replace(/\s+/g, ' '));
  ok(await visto(pg.getByRole('link', { name: 'Recordar a los que no han respondido →' })), 'enlace «Recordar a los que no han respondido» (respuestas del paso 3)');
  ok(await visto(pg.getByRole('button', { name: 'Usar propuesta' })) && await visto(pg.getByRole('button', { name: 'Empezar en blanco (a mano)' })), 'botones «Usar propuesta» y «Empezar en blanco (a mano)»');
  ok((await pg.locator('[data-testid^="cv-equipo-"]').count()) === 2, 'una tarjeta por equipo (dos)');
  ok(/del G\d tras la J\d|Sin partidos jugados|Pocos datos \(\d partidos? tras la J\d\)/.test(await pg.getByTestId('cv-porque-MdA').innerText()), 'dificultad propuesta con su porqué (con menos de 3 partidos, «pocos datos»)', await pg.getByTestId('cv-porque-MdA').innerText());
  ok(/encuentro \d\d:\d\d/i.test(await pg.getByTestId('cv-equipo-MdA').innerText()), 'hora de encuentro (20 minutos antes)');
  ok(await visto(pg.getByTestId('cv-casillas-MdA').getByText('bases')), 'casillas por línea (bases, exteriores, interiores)');
  if (jugados.length === 2) {
    const cuerpo = await pg.locator('main').innerText();
    ok(cuerpo.includes('Sint 17 entra por rotación (2 domingos fuera).') && !/Sint 16 entra por rotación/.test(cuerpo), 'deuda de rotación: «Sint 17 entra por rotación (2 domingos fuera)»; Sint 16 (1 domingo) no (regla 4.2)');
  } else ok(true, 'deuda de rotación: aún no hay 2 domingos jugados en el calendario (se comprueba en el motor)');
  ok(await sinDesbordar(pg), 'a 375 px sin desbordar');
  await foto(pg, 'convocatoria_propuesta_375');
  await pg.getByRole('button', { name: 'Usar propuesta' }).click();
  ok(await visto(pg.getByTestId('cv-estado').getByText('Borrador')), '«Usar propuesta» → borrador', (await pg.locator('[role=alert], [role=status]').allInnerTexts()).join(' | ') + ' ' + errores.join(' | '));
  const a0 = await equipoDe(pg, 'MdA'), l0 = await equipoDe(pg, 'MdL');
  ok(a0.length >= 7 && l0.length >= 7 && a0.length <= 10 && l0.length <= 10, `propuesta guardada: ${a0.length} y ${l0.length}`);
  const cortos = await pequenos(pg, '.cv-boton, .boton, .ev-radios label');
  ok(!cortos.length, 'botones de al menos 44 px', JSON.stringify(cortos));

  console.log('\n== Cambiar a mano con motivo');
  const mover = a0.find((x) => !l0.includes(x));
  await pg.locator(`[data-testid="cv-equipo-MdA"] li[data-person="${mover}"]`).getByRole('button', { name: /Cambiar/ }).click();
  const hoja = pg.getByTestId('cv-hoja');
  ok(await visto(hoja.getByRole('heading', { name: /Cambiar a mano/ })), 'se abre «Cambiar a mano»');
  await hoja.getByText('Pasar al MdL').click();
  ok(await visto(hoja.getByTestId('cv-vista-previa')), 'vista previa de cómo quedan las líneas antes de guardar');
  ok(await hoja.getByRole('button', { name: 'Guardar cambio' }).isDisabled(), 'sin motivo no se puede guardar');
  await hoja.getByText('Equilibrar', { exact: true }).click();
  await hoja.getByLabel('Nota (opcional)').fill('prueba sintética');
  ok(await sinDesbordar(pg), 'la hoja a 375 px sin desbordar');
  await foto(pg, 'convocatoria_cambiar_375');
  await hoja.getByRole('button', { name: 'Guardar cambio' }).click();
  await hoja.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  await pg.waitForTimeout(500);
  ok((await equipoDe(pg, 'MdL')).includes(mover) && !(await equipoDe(pg, 'MdA')).includes(mover), 'el jugador pasa al MdL');
  const [cambio] = await sql`select accion, motivo, nota, equipo from public.convocatoria_cambios where person_id = ${mover} order by en desc limit 1`;
  ok(cambio?.accion === 'mover' && cambio.motivo === 'equilibrar' && cambio.nota === 'prueba sintética' && cambio.equipo === 'MdL', 'guardado con su motivo y su nota', JSON.stringify(cambio));
  await pg.locator('.cv-historial summary').click();
  ok(await visto(pg.locator('.cv-historial').getByText(/cambia de equipo a Sint \d+ \(MdL\) · Equilibrar/)), 'aparece en el historial');

  console.log('\n== Añadir a uno que dijo «no voy»');
  ok(!(await pg.getByTestId('cv-sin-convocar').getByText('Sint 18').count()), 'el que dijo «no voy» no sale en «disponibles sin convocar»');
  await pg.getByRole('button', { name: '+ Añadir jugador a MdL' }).click();
  await hoja.getByLabel('Busca en toda la plantilla').fill('sint 18');
  ok(await visto(hoja.getByText('No va · trabajo')), 'lo encuentra en toda la plantilla con su estado («No va · trabajo»)');
  await hoja.getByRole('button', { name: /Sint 18/ }).click();
  ok(await visto(hoja.getByTestId('cv-aviso-previo').getByText(/dijo «no voy»/)), 'avisa antes de guardar: dijo «no voy»');
  await hoja.getByText('Lo ha pedido', { exact: true }).click();
  await hoja.getByRole('button', { name: 'Guardar cambio' }).click();
  await hoja.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  await pg.waitForTimeout(500);
  ok((await equipoDe(pg, 'MdL')).includes('sint-18'), 'entra en el MdL');
  ok(await visto(pg.getByTestId('cv-equipo-MdL').locator('.cv-aviso').getByText('Sint 18 dijo «no voy» a este partido.')), 'y su aviso (regla 0.1) en la tarjeta');
  ok(await sinDesbordar(pg), 'a 375 px sin desbordar tras los cambios');
  await foto(pg, 'convocatoria_editada_375');

  console.log('\n== Aprobar y copiar el mensaje');
  await pg.getByRole('button', { name: 'Aprobar convocatoria' }).click();
  try { await pg.waitForURL(/\/gestion\/convocatoria\/salida/, { timeout: 15000, waitUntil: 'commit' }); }
  catch { throw new Error(`Aprobar no llega a la salida: ${pg.url()} ${(await pg.locator('[role=alert], [role=status]').allInnerTexts()).join(' | ')} ${errores.join(' | ')}`); }
  const msg = await pg.locator('#cv-mensaje').innerText();
  ok(/^Convocatoria del domingo \d\d\/\d\d \(J\d+\)/.test(msg), 'mensaje: «Convocatoria del domingo DD/MM (Jn)»', msg.slice(0, 60));
  ok(/encuentro \d\d:\d\d/.test(msg) && /Valdebernardo/.test(msg) && /\(local\)|\(visitante\)/.test(msg), 'con hora, encuentro, pista, dirección y local/visitante');
  ok(/Convocados \(\d+\): .*Sint 18/.test(msg) && /Recordad: el dorsal es obligatorio\./.test(msg), 'con la lista de convocados y el dorsal obligatorio');
  ok(!/nivel|\b[A-E]\)|Escolta|Pívot|Base de reserva|Dobla/.test(msg), 'sin niveles, posiciones ni «Dobla»');
  await pg.getByRole('button', { name: 'Copiar mensaje' }).click();
  const copiado = await pg.evaluate(() => navigator.clipboard.readText());
  ok(copiado.replace(/\r\n/g, '\n') === (await pg.locator('#cv-mensaje').textContent()) && copiado.startsWith('Convocatoria del domingo'), '«Copiar mensaje» lo deja en el portapapeles, tal cual', JSON.stringify(copiado.slice(0, 80)));
  ok(await visto(pg.getByTestId('cv-salida-whatsapp').getByText('Pendiente')), 'WhatsApp: pendiente');
  await pg.getByRole('button', { name: 'Ya lo he pegado en el grupo' }).click();
  ok(await visto(pg.getByTestId('cv-salida-whatsapp').getByText('Al día')), 'tras pegarlo: al día');
  ok(await visto(pg.getByTestId('cv-salida-aviso').getByText('En espera')), 'aviso «Estás convocado»: en espera (interruptor apagado)');
  ok(await visto(pg.getByTestId('cv-salida-sporteasy').getByText('Pendiente')), 'SportEasy: pendiente');
  ok(await sinDesbordar(pg), 'salida a 375 px sin desbordar');
  await foto(pg, 'convocatoria_salida_375');

  console.log('\n== Cambiar tras aprobar: WhatsApp vuelve a pendiente y dice qué cambia');
  await pg.goto(`${APP}/gestion/convocatoria?fecha=${F2}`);
  await pg.locator('[data-testid="cv-equipo-MdL"] li[data-person="sint-18"]').getByRole('button', { name: /Cambiar/ }).click();
  await hoja.getByText('Quitar de la convocatoria').click();
  await hoja.getByText('Otro', { exact: true }).click();
  await hoja.getByRole('button', { name: 'Guardar cambio' }).click();
  await hoja.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  await pg.goto(`${APP}/gestion/convocatoria/salida?fecha=${F2}`);
  const msg2 = await pg.locator('#cv-mensaje').innerText();
  ok(/^Cambio en la convocatoria del domingo .*: sale Sint 18 del MdL\./.test(msg2), '«Cambio en la convocatoria…: sale Sint 18 del MdL»', msg2.slice(0, 90));
  ok(await visto(pg.getByTestId('cv-salida-whatsapp').getByText('Pendiente')), 'WhatsApp vuelve a pendiente');

  console.log(`\n== Un solo equipo (${F1})`);
  await pg.goto(`${APP}/gestion/convocatoria?fecha=${F1}`);
  ok((await pg.locator('[data-testid^="cv-equipo-"]').count()) === 1, 'una sola tarjeta (el otro descansa)');
  ok(/solo juega el Md[AL]/.test(await pg.getByTestId('cv-fecha').innerText()), '«solo juega el …»');
  ok(await sinDesbordar(pg), 'a 375 px sin desbordar');
  await foto(pg, 'convocatoria_un_equipo_375');

  console.log('\n== Domingo sin respuestas (fase puente, sin importar)');
  const F0 = fechas.find((f) => ![F2, F1, proximo].includes(f));
  await pg.goto(`${APP}/gestion/convocatoria?fecha=${F0}`);
  const cont0 = await pg.getByTestId('cv-contadores').innerText();
  ok(/0\s*van/.test(cont0) && /0\s*no van/.test(cont0), `${F0}: 0 van y 0 no van`, cont0.replace(/\s+/g, ' '));
  ok(await visto(pg.getByTestId('cv-importacion').getByText(/Última importación:\s*ninguna/)) && await visto(pg.getByTestId('cv-importacion').getByText('Para este domingo todavía no hay ninguna respuesta importada.')), '«Última importación: ninguna» y que este domingo no tiene respuestas importadas');
  ok(await visto(pg.getByTestId('cv-importacion').getByRole('link', { name: 'Importar respuestas →' })), 'con el enlace a Importar');
  const cajas0 = await pg.locator('.cv-aviso').allInnerTexts();
  ok(cajas0.length === porFecha.get(F0).length && cajas0.every((t) => t.startsWith('Todavía no hay disponibles para este domingo.')), `un solo mensaje por equipo (${cajas0.length}), ninguna caja por regla`, cajas0.join(' | ').slice(0, 200));
  ok(!(await pg.locator('.cv-aviso-error').count()), 'ninguna caja roja');
  await foto(pg, 'convocatoria_sin_respuestas_375');
  const [{ n: nImp }] = await sql`select count(*)::int n from public.importaciones`;
  ok(nImp === 0, 'la prueba no ha importado nada (la línea dice «ninguna» de verdad)');

  console.log('\n== Datos de los jugadores (solo gestores)');
  await pg.goto(`${APP}/gestion/convocatoria/datos`);
  ok((await pg.locator('form.cv-ficha').count()) === 18, '18 fichas (solo los activos; los sintéticos)');
  // Sin ningún jugador fijo (D110: en 2026/27 no hay entrenador-jugador): la página carga con todas las reglas vacías.
  const [{ n: nFijos }] = await sql`select count(*)::int n from public.jugadores_privado where regla = 'fijo'`;
  const reglas = await pg.locator('form.cv-ficha').getByLabel('Regla personal').evaluateAll((xs) => xs.map((x) => x.value));
  ok(nFijos === 0 && reglas.length === 18 && reglas.every((v) => v !== 'fijo-MdA' && v !== 'fijo-MdL'), 'sin ningún jugador fijo: la página carga y ninguna ficha sale «Fijo» (D110)', `${nFijos} fijos; ${reglas.join(',')}`);
  const f5 = pg.locator('form.cv-ficha[data-person="sint-05"]');
  await f5.getByLabel('Regla personal').selectOption('fijo-MdA');
  await f5.getByRole('button', { name: 'Guardar' }).click();
  ok(await visto(f5.getByText('Guardado')), 'guardar una regla personal («Fijo al MdA»)');
  ok((await sql`select regla, regla_equipo from public.jugadores_privado where person_id = 'sint-05'`)[0].regla_equipo === 'MdA', 'queda en la base');
  ok(await sinDesbordar(pg), 'a 375 px sin desbordar');
  await foto(pg, 'convocatoria_datos_375');

  console.log('\n== Lo que ve el jugador');
  // Convocatoria aprobada del proximo domingo con el jugador dentro (si no es ya la de la prueba).
  if (proximo !== F2) {
    await sql`insert into public.convocatorias (fecha, jornada, estado, origen, equipos) values (${proximo}, 1, 'aprobada', 'propuesta', ${sql.json({ [porFecha.get(proximo)[0].equipo]: [{ person_id: 'sint-01' }] })})`;
  }
  const enProximo = (await sql`select equipos from public.convocatorias where fecha = ${proximo}`)[0].equipos;
  const suEquipo = Object.keys(enProximo).find((e) => enProximo[e].some((c) => c.person_id === 'sint-01'));
  const ctxJ = await nav.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const pj = await nuevaPagina(ctxJ);
  await entrar(pj, jugadorEmail);
  await pj.goto(`${APP}/gestion/convocatoria`);
  ok(!new URL(pj.url()).pathname.startsWith('/gestion'), 'un jugador NO entra en /gestion/convocatoria', pj.url());
  await pj.goto(`${APP}/gestion/convocatoria/datos`);
  ok(!new URL(pj.url()).pathname.startsWith('/gestion'), 'ni en los datos de los jugadores');
  await pj.goto(`${APP}/mi-zona`);
  // Desde D117, «Tu próximo partido» del inicio personal (/mi-zona redirige a «/»).
  ok(suEquipo && (await pj.getByTestId('estado-partido').innerText()) === `Convocado · ${suEquipo}`, `inicio: «Convocado · ${suEquipo}»`, await pj.getByTestId('estado-partido').innerText().catch(() => ''));
  const casillas = await pj.getByTestId('proximo-partido').locator('.in-partido-uno .in-casilla').allInnerTexts();
  ok(casillas.length === 2 && /Quedada\s*\d\d:\d\d/i.test(casillas[0]) && /Partido\s*\d\d:\d\d/i.test(casillas[1]), 'con la hora y el encuentro (Quedada / Partido)', casillas.join(' | '));
  const texto = await pj.locator('main').innerText();
  ok(!/nivel|Nivel [A-E]|Dificultad|Base de reserva|Dobla|propuesta/i.test(texto.replace(/doblas/g, '')), 'sin niveles, dificultad, datos privados ni propuestas');
  ok(await sinDesbordar(pj), 'Mi zona a 375 px sin desbordar');
  await foto(pj, 'mizona_convocado_375');

  ok(!errores.length, 'sin errores en la consola', errores.slice(0, 3).join(' | '));
} finally {
  await nav?.close().catch(() => {});
  app?.kill();
  await pila.parar();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
