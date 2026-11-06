#!/usr/bin/env node
// El calendario publico leido de la TABLA DE EVENTOS (paso 2, D94), con el calendario de PRUEBA (D185, nunca el real):
// /calendario.ics (67 eventos) lleva cada partido con su fecha, hora, pista y orden local/visitante, y es identico a su
// foto (fixtures/calendario_prueba.ics) salvo DTSTAMP. Despues se aplican los cambios oficiales del calendario de prueba
// (un aplazamiento, un cambio de hora y pista y un cambio de local a visitante) y el .ics los refleja, sin tocar el resto.
// Pila local + app compilada.
//
//   npm run pruebas:fuente-eventos

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { arrancar } from './pila.mjs';
import { aplicarCambiosEnBase, calendarioPrueba, cambioPrueba, cargarEventos } from './infra/calendario.mjs';
import { arrancarApp, esperarLibre } from './infra/app.mjs';
import { PUERTOS } from './infra/puertos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = PUERTOS.app, APP = `http://127.0.0.1:${PUERTO}`;
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };
const sinSello = (t) => t.split('\r\n').filter((l) => !l.startsWith('DTSTAMP:')).join('\r\n');
/** Los VEVENT por clave del evento («mda-j5»), con las líneas largas ya unidas. */
const eventos = (t) => Object.fromEntries(t.replace(/\r\n /g, '').split('BEGIN:VEVENT').slice(1).map((b) => [b.match(/UID:(\S+)-2026-27@/)[1], b]));
const NOMBRE = { MDA: 'MdA', MDL: 'MdL' };
const nombreDe = (b) => b.match(/SUMMARY:(.*) \(J\d+\)/)[1].split(' – ').find((x) => x !== 'MdA' && x !== 'MdL');
const hhmm = (h) => h.replace(':', '');

const pila = await arrancar();
let app;
try {
  const { sql, url, anonKey } = pila;
  await cargarEventos(sql, { log: () => {} });
  // Antes de arrancar (el calendario público se cachea 60 s): una nota «privada» en un entreno que no tenía ninguna.
  const ENTRENO_CON_NOTA = (await sql`select clave from public.eventos where tipo = 'entreno' and notas is null and estado <> 'cancelado' order by fecha limit 1`)[0].clave;
  await sql`update public.eventos set notas = 'NOTA-PRIVADA-DE-PRUEBA' where clave = ${ENTRENO_CON_NOTA}`;
  const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey, NEXT_TELEMETRY_DISABLED: '1' };
  app = await arrancarApp({ puerto: PUERTO, env });
  const NOTA = 'Cambiado solo esta semana.';   // la nota del entreno del 07/10 de los entrenos de prueba: nunca sale en lo público
  const foto = fs.readFileSync(path.join(RAIZ, 'pruebas', 'fixtures', 'calendario_prueba.ics'), 'utf8');
  const ahora = await (await fetch(`${APP}/calendario.ics`)).text();
  ok((ahora.match(/BEGIN:VEVENT/g) ?? []).length === 67, '/calendario.ics: 67 eventos (40 partidos + 27 entrenos)');
  ok(!ahora.includes(NOTA) && (await sql`select count(*)::int n from public.eventos where notas = ${NOTA}`)[0].n === 1, '/calendario.ics no lleva la nota del 07/10, que sigue guardada en el evento');

  // Cada partido del calendario de prueba, con su fecha, hora, pista y el local primero
  const ev0 = eventos(ahora);
  const bien = (b, p) => {
    const rival = nombreDe(b);
    return b.includes(`DTSTART;TZID=Europe/Madrid:${p.fecha.replace(/-/g, '')}T${hhmm(p.hora)}00`) && b.includes(`LOCATION:Moratalaz · Pista ${p.campo}`)
      && b.includes(`SUMMARY:${p.local ? `${NOMBRE[p.equipo]} – ${rival}` : `${rival} – ${NOMBRE[p.equipo]}`} (J${p.jornada})`);
  };
  const mal = calendarioPrueba().partidos.filter((p) => !p.descansa).filter((p) => { const b = ev0[`${p.equipo.toLowerCase()}-j${p.jornada}`]; return !b || !bien(b, p); });
  ok(mal.length === 0, 'los 40 partidos del calendario de prueba, con su fecha, hora, pista y el local primero', mal.map((p) => `${p.equipo} J${p.jornada}`).join(', '));
  ok(sinSello(ahora) === sinSello(foto), 'idéntico a su foto, fixtures/calendario_prueba.ics (salvo DTSTAMP)', (() => { const a = sinSello(ahora).split('\r\n'), b = sinSello(foto).split('\r\n'); const i = a.findIndex((l, k) => l !== b[k]); return i < 0 ? '' : `línea ${i}: «${a[i]}» ≠ «${b[i]}»`; })());

  const r = await fetch(`${APP}/`);
  ok(r.status === 200 && (await r.text()).includes('Dos equipos.'), 'la portada carga con la fuente nueva');
  // La nota sembrada antes de arrancar en el primer entreno de la temporada (la portada la pondría en minúsculas)
  const hoy = (await sql`select to_char(fecha, 'YYYY-MM-DD') f from public.eventos where clave = ${ENTRENO_CON_NOTA}`)[0].f;
  const portada = (await (await fetch(`${APP}/?hoy=${hoy}`)).text()).toLowerCase();
  ok(portada.includes('entrenamiento') && !portada.includes('nota-privada') && !ahora.toLowerCase().includes('nota-privada'),
    'una nota escrita en un entreno no sale ni en la portada de ese día ni en /calendario.ics');
  const club = await (await fetch(`${APP}/club/el-club`)).text();
  ok(club.includes('Valdebernardo') && club.includes('en obras'), '/club/el-club (D189): Valdebernardo (Faustina Valladolid) en obras, desde la tabla de pistas');

  console.log('\n== Cambios oficiales (lo que acepta la rutina B): aplazamiento, hora y pista, local a visitante');
  const tocados = await aplicarCambiosEnBase(sql);
  // La web se arranca otra vez (sin compilar): empieza sin la caché de 60 s del calendario público.
  app.parar();
  await esperarLibre(PUERTO);
  app = await arrancarApp({ puerto: PUERTO, env, compilarAntes: false });
  const despues = await (await fetch(`${APP}/calendario.ics`)).text();
  const ev1 = eventos(despues);
  const ap = cambioPrueba('aplazado'), hp = cambioPrueba('hora_y_pista');
  const kHp = `${hp.equipo.toLowerCase()}-j${hp.jornada}`;
  ok(ev1['mda-j5'].includes(`DTSTART;TZID=Europe/Madrid:${ap.despues.fecha.replace(/-/g, '')}T${hhmm(ap.despues.hora)}00`) && !despues.includes(`${ap.antes.fecha.replace(/-/g, '')}T${hhmm(ap.antes.hora)}00`),
    `aplazado: la J5 de MdA pasa del ${ap.antes.fecha} al ${ap.despues.fecha} a las ${ap.despues.hora}`);
  ok(ev1[kHp].includes(`T${hhmm(hp.despues.hora)}00`) && ev1[kHp].includes(`LOCATION:Moratalaz · Pista ${hp.despues.campo}`),
    `hora y pista: la J${hp.jornada} de MdL pasa a las ${hp.despues.hora} en la pista ${hp.despues.campo}`);
  const rivalJ5 = nombreDe(ev0['mdl-j5']);
  ok(ev0['mdl-j5'].includes(`SUMMARY:MdL – ${rivalJ5} (J5)`) && ev1['mdl-j5'].includes(`SUMMARY:${rivalJ5} – MdL (J5)`),
    'de local a visitante: la J5 de MdL pasa a «rival – MdL» (el local primero)');
  ok(/Equipación: Coinciden colores: cambia /.test(ev0['mdl-j5']) && /Equipación: Coinciden colores: cambiamos nosotros\\, de amarillo\./.test(ev1['mdl-j5']),   // en el .ics las comas van escapadas
    'de local a visitante: la equipación pasa de «cambia el rival» a «cambiamos nosotros, de amarillo»', ev1['mdl-j5'].match(/Equipación:.*?\\n/)?.[0]);
  const otros = Object.keys(ev0).filter((k) => !tocados.includes(k) && sinSello(ev0[k]) !== sinSello(ev1[k] ?? ''));
  ok(Object.keys(ev1).length === 67 && otros.length === 0, 'el resto de los 67 eventos, igual', otros.join(', '));
} finally {
  app?.parar();
  await pila.parar();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
