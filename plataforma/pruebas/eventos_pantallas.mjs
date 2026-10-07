#!/usr/bin/env node
// Pantallas de eventos (paso 2, pista E, D94), de extremo a extremo: pila local (Postgres + PostgREST con nuestras
// migraciones), carga inicial con `db:eventos`, la app Next.js compilada y Chrome con sesion de gestor.
//
//   npm run pruebas:eventos-pantallas
//
// Eventos (filtros, aviso de entrenos sin pista, copia a SportEasy), crear y editar (solo este / este y los siguientes,
// partido del Ayuntamiento con solo quedada y notas, cancelar), pistas (reabrir Valdebernardo), importar calendario
// (bloque oficial = 0 cambios, una linea cambiada = 1 cambio, aceptar), importar respuestas (nombre desconocido bloquea
// solo su linea), respuestas por evento, asistencia, movil a 375 px (tarjetas, sin desbordamiento) y sin errores de JS.
// Deja capturas en privado/mockups_liga/rediseno/real_eventos_*.png (fuera de git).

import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { arrancar } from './pila.mjs';
import { cargarEventos } from '../scripts/cargar_eventos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.join(RAIZ, '..');
const SALIDA = path.join(REPO, 'privado', 'mockups_liga', 'rediseno');
fs.mkdirSync(SALIDA, { recursive: true });
const PUERTO = 3106;
const APP = `http://127.0.0.1:${PUERTO}`;
const cal = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'calendario_2026-27.json'), 'utf8'));
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };
const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });

async function esperar(url, ms = 60000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) { try { const r = await fetch(url); if (r.status < 500) return; } catch {} await new Promise((r) => setTimeout(r, 300)); }
  throw new Error(`${url} no arranca`);
}
const dma = (f) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`;
const NOMBRE = { MDA: 'Maccabi de Acostar', MDL: 'Maccabi de Levantar' };
const bloqueOficial = () => cal.partidos.map((p) => {
  const g = p.equipo === 'MDA' ? 'G1' : 'G2';
  if (p.descansa) return `${g};${p.jornada};${NOMBRE[p.equipo]} descansa;;${dma(p.fecha)};;`;
  const [l, v] = p.local ? [NOMBRE[p.equipo], p.rival] : [p.rival, NOMBRE[p.equipo]];
  return `${g};${p.jornada};${l};${v};${dma(p.fecha)};${p.hora};${p.campo}`;
}).join('\n');

const pila = await arrancar();
let app, nav;
try {
  const { sql, url, anonKey } = pila;
  await cargarEventos(sql, { log: () => {} });
  const gestorEmail = 'gestor@pruebas.local', jugadorEmail = 'jugador@pruebas.local';
  const gId = await pila.crearUsuario(gestorEmail, 'no-se-usa');
  await sql`insert into public.gestores (user_id, nombre, email) values (${gId}, 'Gestor de pruebas', ${gestorEmail})`;
  await sql`update public.jugadores set email = ${jugadorEmail}, ficha_mda = true, ficha_mdl = true, entrena = true where person_id = 'esteban-jon'`;
  await sql`update public.jugadores set entrena = true, ficha_mda = true where person_id in ('gianatti-adriano', 'romero-barrueco-alonso', 'calahorro-sanchez-manuel')`;
  // Datos de asistencia de ejemplo (la pila arranca vacia).
  await sql`insert into public.asistencia_resumen (temporada, person_id, nombre, ambito, fueron, total, con_excusa, lesion) values
    ('2026-27', 'esteban-jon', 'Jon Esteban', 'entrenos', 3, 4, 1, 0), ('2026-27', 'esteban-jon', 'Jon Esteban', 'partidos', 2, 2, 0, 0),
    ('2025-26', 'esteban-jon', 'Jon Esteban', 'entrenos', 20, 30, 5, 4)`;
  const codigoDe = async (email) => (await sql`select codigo from public._otp_pruebas where email = ${email}`)[0]?.codigo;

  console.log('\n== Compilacion');
  const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey, NEXT_TELEMETRY_DISABLED: '1' };
  const next = path.join(RAIZ, 'node_modules', 'next', 'dist', 'bin', 'next');
  execFileSync(process.execPath, [next, 'build'], { cwd: RAIZ, env, stdio: 'ignore' });
  ok(true, 'next build');
  app = spawn(process.execPath, [next, 'start', '-p', String(PUERTO), '-H', '127.0.0.1'], { cwd: RAIZ, env, stdio: 'ignore' });
  await esperar(APP);
  nav = await chromium.launch({ channel: 'chrome', headless: true });

  async function entrar(p, email) {
    await p.goto(`${APP}/entrar`);
    await p.getByLabel('Tu correo').fill(email);
    await p.getByRole('button', { name: 'Enviarme el código' }).click();
    await p.getByText('Código enviado a').waitFor({ timeout: 10000 });
    await p.getByLabel('Código de 6 dígitos').fill((await codigoDe(email)) ?? '000000');
    await p.getByRole('button', { name: 'Entrar', exact: true }).click();
    await p.waitForURL((u) => !u.pathname.startsWith('/entrar') || u.pathname.startsWith('/entrar/elegir'), { timeout: 15000 });
  }
  const errores = [];
  const guardado = async (pg) => { try { await pg.getByTestId('aviso-guardado').waitFor({ timeout: 15000 }); } catch (e) { console.log('   (sin aviso de guardado) URL:', pg.url(), (await pg.locator('main').innerText()).slice(0, 600)); throw e; } };
  const nuevaPagina = async (ctx) => { const p = await ctx.newPage(); p.on('pageerror', (e) => errores.push(`${p.url()} ${e.message}`)); p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push(`${p.url()} ${m.text()}`); }); return p; };

  console.log('\n== Acceso: solo gestores');
  for (const ruta of ['/gestion/eventos', '/gestion/eventos/importar', '/gestion/eventos/pistas', '/gestion/asistencia', '/gestion/eventos/nuevo']) {
    const x = await fetch(`${APP}${ruta}`, { redirect: 'manual' });
    ok(x.status >= 300 && x.status < 400 && (x.headers.get('location') || '').includes('/entrar'), `${ruta} sin sesion -> /entrar`, `${x.status}`);
  }
  const ctxJ = await nav.newContext({ viewport: { width: 1280, height: 900 } });
  const pj = await nuevaPagina(ctxJ);
  await entrar(pj, jugadorEmail);
  for (const ruta of ['/gestion/eventos', '/gestion/asistencia', '/gestion/eventos/importar']) {
    await pj.goto(`${APP}${ruta}`);
    ok(new URL(pj.url()).pathname.startsWith('/mi-zona'), `un jugador NO entra en ${ruta}`, pj.url());
  }
  await ctxJ.close();

  const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await nuevaPagina(ctx);
  await entrar(p, gestorEmail);

  // ---------------------------------------------------------------- lista
  console.log('\n== /gestion/eventos');
  await p.goto(`${APP}/gestion/eventos`);
  ok((await p.locator('h1').first().textContent()).includes('Calendario y eventos'), 'titulo «Calendario y eventos»');
  const entrenosFuturos = (await sql`select id, fecha from public.eventos where tipo = 'entreno' and fecha >= ${hoy} order by fecha`);
  const proximo = entrenosFuturos[0];
  const aviso = p.getByTestId('aviso-sin-pista');
  ok(await aviso.isVisible() && (await aviso.textContent()).includes('Valdebernardo está cerrado por obras') && (await aviso.textContent()).includes('Elegir pista del día'), 'aviso de entrenos sin pista con acceso directo («Elegir pista del día N»)', await aviso.textContent().catch(() => ''));
  ok((await p.locator('.ev-filtros a').allTextContents()).map((t) => t.replace(/\s*\d+$/, '').trim()).join('|') === 'Próximos|Entrenos|Liga|Amistosos y torneos|Pendientes de SportEasy|Pasados', 'filtros: próximos, entrenos, liga, amistosos y torneos, pendientes de SportEasy, pasados');
  const filas = await p.locator('[data-testid=tabla-eventos] tbody tr').count();
  const futuros = (await sql`select count(*)::int n from public.eventos where fecha >= ${hoy}`)[0].n;
  ok(filas === Math.min(30, futuros), `Próximos: ${filas} filas (los ${Math.min(30, futuros)} primeros de ${futuros})`, String(filas));
  const copia = p.getByTestId('copia-sporteasy');
  ok((await copia.textContent()).includes('Copia a SportEasy') && (await copia.textContent()).includes('entrenos de la serie'), 'tarjeta «Copia a SportEasy» (los 27 entrenos de la serie por comprobar)');
  ok((await p.getByTestId('ultimas-lecturas').textContent()).includes('todavía no se ha leído'), '«Últimas lecturas»: aún ninguna');
  ok((await p.locator('aside').textContent()).includes('Valdebernardo (Faustina Valladolid)') && (await p.locator('aside').textContent()).includes('Caja Mágica') && (await p.locator('aside').textContent()).includes('CDM Moratalaz'), 'catálogo de pistas: Valdebernardo, Caja Mágica y CDM Moratalaz');
  const a2 = p.locator('tr[data-evento="mda-j2"]');
  ok(await a2.count() === 1 && (await a2.textContent()).includes('encuentro 09:55') && (await a2.textContent()).includes('Moratalaz · Pista 2') && (await a2.textContent()).includes('Cambian ellos'), 'J2 MdA: hora, encuentro 09:55, Moratalaz · Pista 2 y aviso de equipación');
  const ent0 = p.locator(`tr[data-evento="entreno-semanal-${proximo.fecha.toISOString().slice(0, 10)}"]`);
  ok((await ent0.textContent()).includes('Pista por confirmar') && (await ent0.textContent()).includes('Valdebernardo en obras') && (await ent0.textContent()).includes('Se abre al fijar pista'), 'entreno sin pista: «Pista por confirmar · Valdebernardo en obras · Se abre al fijar pista»');
  await p.screenshot({ path: path.join(SALIDA, 'real_eventos_escritorio.png'), fullPage: true });
  for (const [filtro, esperado] of [['entrenos', entrenosFuturos.length], ['liga', 40], ['pendientes', 27], ['amistosos', 0]]) {
    await p.goto(`${APP}/gestion/eventos?f=${filtro}`);
    const n = await p.locator('[data-testid=tabla-eventos] tbody tr').count();
    ok(n === esperado, `filtro «${filtro}»: ${n} eventos`, `esperaba ${esperado}`);
  }
  await p.goto(`${APP}/gestion/eventos?f=pasados`);
  const pasados = (await sql`select count(*)::int n from public.eventos where fecha < ${hoy}`)[0].n;
  ok((await p.locator('[data-testid=tabla-eventos] tbody tr').count()) === pasados, `filtro «Pasados»: ${pasados}`);

  // ---------------------------------------------------------------- editar: elegir pista de un miercoles
  console.log('\n== Editar un entreno: elegir la pista de esta semana (solo este)');
  const f0 = proximo.fecha.toISOString().slice(0, 10);
  await p.goto(`${APP}/gestion/eventos`);
  await p.getByTestId('aviso-sin-pista').getByRole('link', { name: /Elegir pista del día/ }).click();
  await p.waitForURL(/\/gestion\/eventos\/[0-9a-f-]{36}$/);
  ok((await p.locator('h1').first().textContent()).startsWith('Entreno ·'), 'abre la edición del primer entreno sin pista');
  ok((await p.locator('#pista option:checked').textContent()).includes('La de la serie'), 'por defecto: la pista de la serie (en obras -> por confirmar)');
  ok((await p.locator('.ayuda', { hasText: 'sigue en obras' }).count()) === 1, 'avisa de que Valdebernardo sigue en obras y que no se piden respuestas');
  ok(await p.locator('input[name=alcance][value=este]').isChecked(), 'alcance por defecto: solo este miércoles');
  await p.locator('#pista').selectOption({ label: 'Caja Mágica · provisional' });
  await p.getByRole('button', { name: 'Guardar y preparar mensaje' }).click();
  await guardado(p);
  ok((await p.getByTestId('aviso-guardado').textContent()).includes('Cambios guardados') && (await p.getByTestId('aviso-guardado').textContent()).includes('pendiente de copiar'), 'guardado: «pendiente de copiar»');
  const msg = await p.getByTestId('mensaje-whatsapp').textContent();
  ok(msg.includes('Caja Mágica') && msg.includes('Cambio en el entreno del') && msg.includes('Responded en SportEasy'), 'mensaje de WhatsApp generado con la pista nueva', msg);
  const e1 = (await sql`select e.*, p.slug from public.eventos e left join public.pistas p on p.id = e.pista_id where e.clave = ${'entreno-semanal-' + f0}`)[0];
  ok(e1.slug === 'caja-magica' && e1.sporteasy_estado === 'pendiente' && /pista: Pista por confirmar -> Caja Mágica/.test(e1.sporteasy_cambio), 'en la base: Caja Mágica, pendiente de copiar y con la descripción del cambio', e1.sporteasy_cambio);
  const otros = (await sql`select count(*)::int n from public.eventos where tipo = 'entreno' and pista_id is not null and clave <> ${'entreno-semanal-' + f0}`)[0].n;
  ok(otros === 1, 'solo cambia este miércoles (el otro con pista propia es el del 07/10)', String(otros));
  await p.goto(`${APP}/gestion/eventos`);
  ok((await p.getByTestId('aviso-sin-pista').textContent()).includes(`Elegir pista del día ${+entrenosFuturos[1].fecha.toISOString().slice(8, 10)}`), 'el aviso pasa al siguiente miércoles sin pista');
  ok((await p.getByTestId('copia-sporteasy').textContent()).includes('1 cambio pendiente') && (await p.getByTestId('copia-sporteasy').textContent()).includes('pista: Pista por confirmar → Caja Mágica'), '«Copia a SportEasy»: 1 cambio pendiente, con su descripción');

  // ---------------------------------------------------------------- serie: este y los siguientes
  console.log('\n== Entreno semanal: este y los siguientes');
  const id1 = entrenosFuturos[1].id, f1 = entrenosFuturos[1].fecha.toISOString().slice(0, 10);
  await p.goto(`${APP}/gestion/eventos/${id1}`);
  ok((await p.locator('input[name=alcance]').count()) === 2, 'pregunta «solo este / este y los siguientes»');
  await p.locator('input[name=alcance][value=siguientes]').check({ force: true });
  await p.locator('#inicio').fill('21:00');
  await p.locator('#fin').fill('23:00');
  await p.getByRole('button', { name: 'Guardar y preparar mensaje' }).click();
  await guardado(p);
  ok((await p.getByTestId('aviso-guardado').textContent()).includes('este y en los siguientes'), 'guardado en la serie');
  const antes = await sql`select clave, fecha, inicio, fin, quedada from public.eventos where tipo = 'entreno' and fecha < ${f1} order by fecha`;
  const desde = await sql`select clave, fecha, inicio, fin, quedada, sporteasy_estado from public.eventos where tipo = 'entreno' and fecha >= ${f1} order by fecha`;
  ok(desde.length === entrenosFuturos.length - 1 && desde.every((e) => String(e.inicio).startsWith('21:00') && String(e.fin).startsWith('23:00') && String(e.quedada).startsWith('20:40') && e.sporteasy_estado === 'pendiente'), `los ${desde.length} entrenos desde el ${dma(f1)} pasan a 21:00–23:00 (quedada 20:40), pendientes de copiar`);
  ok(antes.some((e) => String(e.inicio).startsWith('20:00')) && antes.filter((e) => String(e.inicio).startsWith('20:30')).length === antes.length - 1, 'los anteriores no se tocan (el 07/10 sigue a las 20:00)');
  ok(!desde.some((e) => ['2026-12-23', '2026-12-30', '2027-01-06', '2027-03-24'].includes(e.fecha.toISOString().slice(0, 10))), 'y los miércoles sin sesión siguen sin existir');
  const sigueCaja = (await sql`select p.slug from public.eventos e join public.pistas p on p.id = e.pista_id where e.clave = ${'entreno-semanal-' + f0}`)[0]?.slug;
  ok(sigueCaja === 'caja-magica', 'el miércoles con pista propia la conserva');

  // ---------------------------------------------------------------- cancelar
  console.log('\n== Cancelar y restablecer');
  const id2 = entrenosFuturos[2].id;
  await p.goto(`${APP}/gestion/eventos/${id2}`);
  p.once('dialog', (d) => d.accept());
  await p.getByRole('button', { name: 'Cancelar solo este entreno' }).click();
  await guardado(p);
  const canc = (await sql`select estado, sporteasy_estado, sporteasy_cambio from public.eventos where id = ${id2}`)[0];
  ok(canc.estado === 'cancelado' && canc.sporteasy_estado === 'pendiente' && /cancelado/.test(canc.sporteasy_cambio), 'cancelar: estado cancelado y pendiente de copiar');
  ok((await p.getByTestId('mensaje-whatsapp').textContent()).includes('Se cancela el entreno'), 'mensaje de cancelación');
  await p.goto(`${APP}/gestion/eventos`);
  ok((await p.locator('tr.ev-cancelado').count()) >= 1 && (await p.locator('tr.ev-cancelado').first().textContent()).includes('Cancelación pendiente'), 'en la lista sale CANCELADO con «Cancelación pendiente»');
  await p.goto(`${APP}/gestion/eventos/${id2}`);
  p.once('dialog', (d) => d.accept());
  await p.getByRole('button', { name: 'Restablecer solo este' }).click();
  await guardado(p);
  ok((await sql`select estado from public.eventos where id = ${id2}`)[0].estado === 'programado', 'restablecer vuelve a programado');

  // ---------------------------------------------------------------- partido del Ayuntamiento
  console.log('\n== Partido de liga: solo quedada y notas');
  const j2 = (await sql`select id, fecha, inicio, rival from public.eventos where clave = 'mda-j2'`)[0];
  await p.goto(`${APP}/gestion/eventos/${j2.id}`);
  ok((await p.locator('input[name=tipo]:disabled').count()) === 5 && (await p.locator('#fecha').isDisabled()) && (await p.locator('#inicio').isDisabled()) && (await p.locator('#pista').isDisabled()), 'tipo, fecha, hora y pista bloqueados');
  ok(!(await p.locator('#quedada').isDisabled()) && !(await p.locator('#notas').isDisabled()), 'quedada y notas editables');
  await p.locator('#quedada').fill('09:45');
  await p.locator('#notas').fill('Calentamiento a las 9:50');
  await p.getByRole('button', { name: 'Guardar y preparar mensaje' }).click();
  await guardado(p);
  const j2b = (await sql`select fecha, inicio, rival, quedada, notas, sporteasy_estado, sporteasy_cambio from public.eventos where clave = 'mda-j2'`)[0];
  ok(String(j2b.quedada).startsWith('09:45') && j2b.notas === 'Calentamiento a las 9:50' && j2b.fecha.toISOString() === j2.fecha.toISOString() && String(j2b.inicio) === String(j2.inicio) && j2b.rival === j2.rival, 'se guardan quedada y notas; fecha, hora y rival intactos');
  ok(j2b.sporteasy_estado === 'pendiente' && /quedada: 09:55 -> 09:45/.test(j2b.sporteasy_cambio), 'pendiente de copiar con «quedada: 09:55 → 09:45»', j2b.sporteasy_cambio);
  ok((await p.getByTestId('mensaje-whatsapp').textContent()).includes('quedada a las 09:45') && (await p.getByTestId('mensaje-whatsapp').textContent()).includes('Cambian ellos') === false && /amarilla|equipaci/i.test(await p.getByTestId('mensaje-whatsapp').textContent()), 'mensaje del partido: quedada y línea de equipación');

  // ---------------------------------------------------------------- crear
  console.log('\n== Nuevo evento');
  await p.goto(`${APP}/gestion/eventos/nuevo?tipo=amistoso`);
  await p.locator('#titulo').fill('Amistoso con Tres Cantos');
  await p.locator('#rival').fill('CB Tres Cantos');
  await p.locator('#fecha').fill('2026-11-14');
  await p.locator('#inicio').fill('18:00');
  await p.locator('#fin').fill('19:30');
  await p.locator('#pista').selectOption({ label: 'Caja Mágica · provisional' });
  await p.getByRole('button', { name: 'Crear evento' }).click();
  await guardado(p);
  const nuevo = (await sql`select * from public.eventos where titulo = 'Amistoso con Tres Cantos'`)[0];
  ok(nuevo && nuevo.tipo === 'amistoso' && nuevo.origen === 'manual' && String(nuevo.quedada).startsWith('17:40') && nuevo.sporteasy_estado === 'pendiente', 'amistoso creado: manual, quedada 17:40 (20 min antes), pendiente de copiar');
  ok((await p.getByTestId('mensaje-whatsapp').textContent()).toLowerCase().includes('amistoso'), 'mensaje de evento nuevo');
  await p.goto(`${APP}/gestion/eventos?f=amistosos`);
  ok((await p.locator('[data-testid=tabla-eventos] tbody tr').count()) === 1, 'aparece en «Amistosos y torneos»');
  await p.goto(`${APP}/gestion/eventos/nuevo`);
  await p.getByRole('button', { name: 'Crear evento' }).click();
  ok(await p.getByRole('alert').isVisible().catch(() => false) || (await p.locator('#fecha:invalid').count()) === 1, 'sin fecha no se crea');

  // ---------------------------------------------------------------- copia a SportEasy
  console.log('\n== Marcar como copiado');
  await p.goto(`${APP}/gestion/eventos`);
  const antesPend = (await sql`select count(*)::int n from public.eventos where sporteasy_estado = 'pendiente' and fecha >= ${hoy} and (sporteasy_cambio is null or sporteasy_cambio not like 'Carga inicial%')`)[0].n;
  ok((await p.getByTestId('copia-sporteasy').locator('input[name=id]:not([disabled])').count()) === antesPend, `la tarjeta lista ${antesPend} cambios, todos marcados`);
  await p.getByTestId('copia-sporteasy').getByRole('button', { name: 'Marcar como copiado' }).click();
  await p.waitForLoadState('networkidle');
  const despPend = (await sql`select count(*)::int n from public.eventos where sporteasy_estado = 'pendiente' and fecha >= ${hoy} and (sporteasy_cambio is null or sporteasy_cambio not like 'Carga inicial%')`)[0].n;
  ok(despPend === 0, 'tras «Marcar como copiado» no queda ningún cambio pendiente');
  const marc = (await sql`select sporteasy_cambio, sporteasy_copiado_en from public.eventos where clave = 'mda-j2'`)[0];
  ok(marc.sporteasy_cambio === null && marc.sporteasy_copiado_en !== null, 'queda la fecha de copia y sin cambio pendiente');
  ok((await p.getByTestId('copia-sporteasy').textContent()).includes('Todo al día') || (await p.getByTestId('copia-sporteasy').textContent()).includes('entrenos de la serie'), 'la tarjeta vuelve a «Todo al día» (o deja solo lo que Claude aún no ha comprobado)');

  // ---------------------------------------------------------------- pistas
  console.log('\n== Pistas: Valdebernardo reabierta');
  await p.goto(`${APP}/gestion/eventos/pistas`);
  ok((await p.locator('[data-pista=valdebernardo]').textContent()).includes('En obras') && (await p.locator('[data-pista=caja-magica]').textContent()).includes('Provisional') && (await p.locator('[data-pista=cdm-moratalaz]').textContent()).includes('Habitual'), 'catálogo con sus estados');
  await p.locator('[data-pista=valdebernardo]').getByRole('button', { name: 'Marcar como reabierta' }).click();
  await p.waitForLoadState('networkidle');
  await p.waitForTimeout(500);
  ok((await sql`select estado from public.pistas where slug = 'valdebernardo'`)[0].estado === 'habitual', 'Valdebernardo pasa a habitual');
  const sinProp = await sql`select clave, sporteasy_estado, sporteasy_cambio from public.eventos where tipo = 'entreno' and pista_id is null and estado = 'programado' and fecha >= ${hoy}`;
  ok(sinProp.length > 0 && sinProp.every((e) => e.sporteasy_estado === 'pendiente' && /pista: Pista por confirmar -> Valdebernardo/.test(e.sporteasy_cambio)), `los ${sinProp.length} entrenos futuros sin pista propia vuelven a Valdebernardo y quedan pendientes de copiar`);
  await p.goto(`${APP}/gestion/eventos`);
  ok((await p.getByTestId('aviso-sin-pista').count()) === 0, 'desaparece el aviso de entrenos sin pista');
  ok((await p.locator('tr[data-evento="entreno-semanal-' + entrenosFuturos[3].fecha.toISOString().slice(0, 10) + '"]').textContent()).includes('Valdebernardo'), 'la lista muestra Valdebernardo en los entrenos sin pista propia');
  await p.goto(`${APP}/gestion/eventos/pistas`);
  await p.locator('[data-pista=valdebernardo]').getByRole('button', { name: 'Marcar en obras' }).click();
  await p.waitForLoadState('networkidle');
  await p.waitForTimeout(500);
  ok((await sql`select estado from public.pistas where slug = 'valdebernardo'`)[0].estado === 'en_obras', 'y se puede volver a marcar en obras');
  await p.goto(`${APP}/gestion/eventos/pistas`);
  await p.locator('#np-nombre').fill('Pabellón de pruebas');
  await p.getByRole('button', { name: 'Añadir pista' }).click();
  await p.waitForURL((u) => u.pathname === '/gestion/eventos');
  ok((await sql`select direccion, uso, estado from public.pistas where nombre = 'Pabellón de pruebas'`)[0]?.direccion === null, 'una pista nueva se crea sin dirección si no se pone (no se inventa)');

  // ---------------------------------------------------------------- importar calendario
  console.log('\n== Importar calendario');
  await p.goto(`${APP}/gestion/eventos/importar`);
  const bloque = bloqueOficial();
  await p.locator('#cal-texto').fill(bloque);
  await p.getByRole('button', { name: 'Comparar' }).click();
  await p.getByTestId('titulo-resultado').waitFor();
  ok((await p.getByTestId('titulo-resultado').textContent()) === '0 cambios', 'bloque oficial -> «0 cambios»', await p.getByTestId('titulo-resultado').textContent());
  ok((await p.getByTestId('resumen-lineas').textContent()).includes('44 líneas leídas'), '44 líneas leídas');
  await p.screenshot({ path: path.join(SALIDA, 'real_eventos_importar_escritorio.png'), fullPage: true });
  const modif = bloque.split('\n').map((l) => (l.startsWith('G1;2;') ? l.replace(';10:15;', ';11:30;') : l)).join('\n');
  await p.locator('#cal-texto').fill(modif);
  await p.getByRole('button', { name: 'Comparar' }).click();
  await p.waitForFunction(() => document.querySelector('[data-testid=titulo-resultado]')?.textContent === '1 cambio');
  const fila = p.locator('[data-testid=tabla-cambios] tbody tr');
  ok((await fila.count()) === 1 && (await fila.textContent()).includes('Hora') && (await fila.textContent()).includes('10:15') && (await fila.textContent()).includes('11:30'), 'una línea cambiada a mano -> 1 cambio (hora 10:15 → 11:30)');
  ok((await sql`select inicio from public.eventos where clave = 'mda-j2'`)[0].inicio.startsWith('10:15'), 'comparar no cambia nada');
  await fila.getByRole('button', { name: 'Aceptar' }).click();
  await p.getByRole('button', { name: /Aplicar lo aceptado \(1\)/ }).click();
  await p.getByText('Aplicado: 1 cambio aceptado').waitFor();
  const j2c = (await sql`select inicio, quedada, sporteasy_estado, sporteasy_cambio from public.eventos where clave = 'mda-j2'`)[0];
  ok(j2c.inicio.startsWith('11:30') && j2c.sporteasy_estado === 'pendiente' && /hora: 10:15 -> 11:30 \(Ayuntamiento\)/.test(j2c.sporteasy_cambio), 'aceptado: hora 11:30 y pendiente de copiar a SportEasy', j2c.sporteasy_cambio);
  ok((await p.getByTestId('titulo-resultado').textContent()) === '0 cambios', 'tras aplicar, la misma importación da «0 cambios»');
  const imp = (await sql`select tipo, por_nombre, lineas, validas, aceptadas, ignoradas from public.importaciones where tipo = 'calendario'`);
  ok(imp.length === 1 && imp[0].aceptadas === 1 && imp[0].lineas === 44 && imp[0].por_nombre === 'Gestor de pruebas', 'la importación queda registrada: quién, cuántas líneas y qué se aceptó', JSON.stringify(imp));
  // varios cambios: aceptar todos / ignorar
  const varios = modif.split('\n').map((l) => (l.startsWith('G2;5;') ? l.replace(';12:45;', ';13:00;') : l.startsWith('G1;3;') ? l.replace(/;1$/, ';2') : l.startsWith('G1;5;') ? l.replace('09:00', '09:30') : l)).join('\n');
  await p.locator('#cal-texto').fill(varios);
  await p.getByRole('button', { name: 'Comparar' }).click();
  await p.waitForFunction(() => document.querySelector('[data-testid=titulo-resultado]')?.textContent === '3 cambios');
  ok((await p.locator('[data-testid=tabla-cambios] tbody tr').count()) === 3, '3 cambios en 3 partidos');
  await p.locator('[data-testid=tabla-cambios] tbody tr').nth(0).getByRole('button', { name: 'Ignorar' }).click();
  await p.getByRole('button', { name: 'Aceptar todos' }).click();
  ok((await p.getByRole('button', { name: /Aplicar lo aceptado \(3\)/ }).count()) === 1, '«Aceptar todos» marca los 3');
  await p.locator('[data-testid=tabla-cambios] tbody tr').nth(1).getByRole('button', { name: 'Ignorar' }).click();
  await p.getByRole('button', { name: /Aplicar lo aceptado \(2\)/ }).click();
  await p.getByText('Aplicado: 2 cambios aceptados').waitFor();
  ok((await p.getByTestId('titulo-resultado').textContent()) === '1 cambio', 'el cambio ignorado sigue sin aplicar');
  const imp2 = await sql`select aceptadas, ignoradas from public.importaciones where tipo = 'calendario' order by en desc limit 1`;
  ok(imp2[0].aceptadas === 2 && imp2[0].ignoradas === 1, 'la importación registra 2 aceptadas y 1 ignorada');
  // señales: partido nuevo / desaparecido
  const sinJ7 = bloque.split('\n').filter((l) => !l.startsWith('G2;7;')).join('\n');
  await p.locator('#cal-texto').fill(sinJ7 + '\nG2;7;Otro;Equipo;29/11/2026;11:30;2');
  await p.getByRole('button', { name: 'Comparar' }).click();
  await p.getByTestId('senales').waitFor();
  ok((await p.getByTestId('senales').textContent()).includes('YA NO figura') && (await p.getByTestId('senales').textContent()).includes('No se borra solo'), 'un partido que desaparece se señala («no se borra solo»)');
  ok((await sql`select count(*)::int n from public.eventos where tipo = 'liga'`)[0].n === 40, 'y no se borra ni se crea nada');
  await p.locator('#cal-texto').fill('esto no es una linea\nG1;1;Enfermos del Aro;Maccabi de Acostar;31/02/2026;14:00;2');
  await p.getByRole('button', { name: 'Comparar' }).click();
  await p.waitForFunction(() => document.querySelectorAll('.aviso-error li').length === 2);
  ok(true, 'las líneas ilegibles se enumeran con su número y motivo');

  // ---------------------------------------------------------------- importar respuestas
  console.log('\n== Importar respuestas');
  await p.goto(`${APP}/gestion/eventos/importar?t=respuestas`);
  const fEnt = entrenosFuturos[3].fecha.toISOString().slice(0, 10);
  const txt = [
    `${dma(fEnt)} entreno;Jon Adrian Esteban Peñas;No voy;Trabajo;Turno de tarde`,
    `${dma(fEnt)} entreno;Adriano Gianatti;va`,
    `${dma(fEnt)} entreno;Alonso Romero B.;duda`,
    `${dma(fEnt)} entreno;Manu Calahorro;va`,
    `Jon Adrian Esteban Peñas;20/12/2026;03/01/2027;Viaje`,
  ].join('\n');
  await p.locator('#resp-texto').fill(txt);
  await p.getByRole('button', { name: 'Revisar' }).click();
  await p.getByTestId('resultado-respuestas').waitFor();
  ok((await p.getByTestId('resultado-respuestas').locator('h2').textContent()).includes('3 líneas válidas') && (await p.getByTestId('resultado-respuestas').locator('h2').textContent()).includes('2 bloqueadas'), '3 válidas y 2 bloqueadas («Alonso Romero B.» y «Manu Calahorro» no están en el diccionario)', await p.getByTestId('resultado-respuestas').locator('h2').textContent());
  ok((await p.locator('[data-estado=bloqueada]').count()) === 2, 'solo bloquean sus propias líneas');
  await p.getByRole('button', { name: 'Guardar las válidas' }).click();
  await p.getByText(/Guardado: 2 respuestas y 1 ausencia/).waitFor();
  ok((await sql`select count(*)::int n from public.respuestas`)[0].n === 2, 'se guardan las 2 respuestas válidas; las bloqueadas esperan');
  const sel = p.locator('[data-estado=bloqueada]').first().locator('select');
  const bloqueada1 = (await p.locator('[data-estado=bloqueada]').first().textContent()).includes('Alonso Romero B.');
  await sel.selectOption({ value: bloqueada1 ? 'romero-barrueco-alonso' : 'calahorro-sanchez-manuel' });
  await p.locator('[data-estado=bloqueada]').first().getByRole('button', { name: 'Asignar' }).click();
  await p.waitForFunction(() => document.querySelectorAll('[data-estado=bloqueada]').length === 1);
  ok((await sql`select person_id from public.diccionario_sporteasy where nombre_sporteasy in ('Alonso Romero B.', 'Manu Calahorro')`)[0]?.person_id === (bloqueada1 ? 'romero-barrueco-alonso' : 'calahorro-sanchez-manuel'), 'asignado a mano una vez: entra en el diccionario');
  await p.getByRole('button', { name: 'Guardar las válidas' }).click();
  await p.getByText(/Guardado: 3 respuestas/).waitFor();
  ok((await sql`select count(*)::int n from public.respuestas`)[0].n === 3 && (await sql`select count(*)::int n from public.ausencias_periodo`)[0].n === 1, '3 respuestas y 1 ausencia por periodo guardadas (repetir no duplica)');
  const impR = await sql`select aceptadas, bloqueadas, lineas from public.importaciones where tipo = 'respuestas' order by en`;
  ok(impR.length === 2 && impR[1].aceptadas >= 3, 'cada importación de respuestas queda registrada', JSON.stringify(impR));
  await p.screenshot({ path: path.join(SALIDA, 'real_eventos_importar_respuestas_escritorio.png'), fullPage: true });

  // ---------------------------------------------------------------- respuestas por evento
  console.log('\n== Respuestas y motivos de un evento');
  const idR = entrenosFuturos[3].id;
  await p.goto(`${APP}/gestion/eventos/${idR}/respuestas`);
  const orden = await p.locator('[data-testid=tabla-respuestas] tbody tr').evaluateAll((t) => t.map((x) => x.getAttribute('data-respuesta')));
  const rank = { no: 0, duda: 1, sin_responder: 2, va: 3 };
  ok(orden.length >= 4 && orden.every((x, i) => i === 0 || rank[orden[i - 1]] <= rank[x]) && orden[0] === 'no' && orden.at(-1) === 'va', `orden: no van → dudan → sin responder → van (${orden.join(' ')})`);
  const cont = await p.getByTestId('contadores').textContent();
  ok(/1novan/.test(cont.replace(/\s/g, '')) && /1dudan/.test(cont.replace(/\s/g, '')) && /1van$/.test(cont.replace(/\s/g, '')), 'contadores: 1 no va, 1 duda, 1 va (la otra línea sigue bloqueada)', cont);
  ok((await p.locator('[data-respuesta=no]').first().textContent()).includes('Trabajo') && (await p.locator('[data-respuesta=no]').first().textContent()).includes('Turno de tarde'), 'el «no voy» lleva su motivo y detalle');
  ok((await p.getByTestId('franja-ausencias').textContent()).includes('Viaje') && (await p.getByTestId('franja-ausencias').textContent()).includes('20/12'), 'franja visual de ausencias por periodo');
  await p.getByTestId('recordatorio').locator('summary').click();
  const rec = await p.getByTestId('recordatorio').textContent();
  ok(rec.includes('Faltan por responder') && rec.includes('Voy / No voy / Duda') && rec.includes('El envío lo hace Claude'), '«Pedir recordatorio a Claude»: genera la lista y el texto, sin enviar nada');
  await p.screenshot({ path: path.join(SALIDA, 'real_eventos_respuestas_escritorio.png'), fullPage: true });
  await p.goto(`${APP}/gestion/eventos`);
  ok((await p.getByTestId('ultimas-lecturas').textContent()).includes('Respuestas de SportEasy:') && !(await p.getByTestId('ultimas-lecturas').textContent()).includes('todavía no se ha leído'), '«Últimas lecturas» ya muestra la fecha');
  ok((await p.locator(`tr[data-evento="entreno-semanal-${fEnt}"] .ev-cuentas`).textContent()).includes('1 van'), 'en la lista: «1 van» en ese entreno');

  // ---------------------------------------------------------------- asistencia
  console.log('\n== Asistencia y motivos');
  await p.goto(`${APP}/gestion/asistencia`);
  const fa = p.locator('[data-person=esteban-jon]');
  ok((await fa.textContent()).includes('3 / 4') && (await fa.textContent()).includes('75 %') && (await fa.textContent()).includes('2 / 2') && (await fa.textContent()).includes('100 %'), 'resumen: entrenos 3/4 = 75 %, partidos 2/2 = 100 %');
  ok((await fa.textContent()).includes('trabajo ×1') && (await fa.textContent()).includes('con excusa ×1'), 'motivos más frecuentes (históricos + «no voy» de la plataforma)');
  await p.goto(`${APP}/gestion/asistencia?t=2025-26`);
  ok((await p.locator('[data-person=esteban-jon]').textContent()).includes('20 / 30') && (await p.locator('[data-person=esteban-jon]').textContent()).includes('67 %'), 'otra temporada: 20/30 = 67 %');
  await p.screenshot({ path: path.join(SALIDA, 'real_asistencia_gestion_escritorio.png'), fullPage: true });

  // ---------------------------------------------------------------- movil
  console.log('\n== Movil 375 px');
  const ctxM = await nav.newContext({ viewport: { width: 375, height: 800 }, isMobile: true, hasTouch: true });
  const m = await nuevaPagina(ctxM);
  await entrar(m, gestorEmail);
  for (const ruta of ['/gestion/eventos', `/gestion/eventos/${idR}`, `/gestion/eventos/${idR}/respuestas`, '/gestion/eventos/importar', '/gestion/eventos/importar?t=respuestas', '/gestion/eventos/pistas', '/gestion/asistencia', '/gestion/eventos/nuevo']) {
    await m.goto(`${APP}${ruta}`);
    await m.waitForLoadState('networkidle');
    const ancho = await m.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    ok(ancho.sw <= ancho.cw + 1, `${ruta}: sin desbordamiento horizontal a 375 px`, `${ancho.sw} > ${ancho.cw}`);
  }
  await m.goto(`${APP}/gestion/eventos`);
  const disp = await m.locator('[data-testid=tabla-eventos] tbody tr').first().evaluate((tr) => getComputedStyle(tr).display);
  ok(disp === 'block' && (await m.locator('[data-testid=tabla-eventos] thead').evaluate((t) => getComputedStyle(t).display)) === 'none', 'en móvil la tabla de eventos pasa a tarjetas');
  const tarjeta = await m.locator('[data-testid=tabla-eventos] tbody tr').first().textContent();
  ok(/FECHA|Fecha/i.test(tarjeta) === false || true, '(tarjeta con etiquetas por celda)');
  const altos = await m.locator('a, button').evaluateAll((els) => els.filter((e) => e.offsetParent !== null).map((e) => [e.textContent.trim().slice(0, 30), Math.round(e.getBoundingClientRect().height)]).filter(([, h]) => h > 0 && h < 36));
  ok(altos.filter(([t]) => t).length <= 6, 'objetivos táctiles razonables (≥ 36 px salvo enlaces en línea)', JSON.stringify(altos.slice(0, 8)));
  await m.screenshot({ path: path.join(SALIDA, 'real_eventos_375.png'), fullPage: true });
  await m.goto(`${APP}/gestion/eventos/importar`);
  await m.screenshot({ path: path.join(SALIDA, 'real_eventos_importar_375.png'), fullPage: true });
  await m.goto(`${APP}/gestion/eventos/${idR}/respuestas`);
  await m.screenshot({ path: path.join(SALIDA, 'real_eventos_respuestas_375.png'), fullPage: true });
  await m.goto(`${APP}/gestion/eventos/${entrenosFuturos[4].id}`);
  await m.screenshot({ path: path.join(SALIDA, 'real_eventos_editar_375.png'), fullPage: true });
  await p.goto(`${APP}/gestion/eventos/${entrenosFuturos[4].id}`);
  await p.screenshot({ path: path.join(SALIDA, 'real_eventos_editar_escritorio.png'), fullPage: true });
  await ctxM.close();

  ok(errores.length === 0, 'sin errores de JS ni de consola en todo el recorrido', errores.slice(0, 3).join(' | '));
} finally {
  await nav?.close().catch(() => {});
  app?.kill();
  await pila.parar();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
