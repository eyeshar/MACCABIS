#!/usr/bin/env node
// El calendario publico leido de la TABLA DE EVENTOS (paso 2, D94) es identico al de antes: /calendario.ics (67 eventos)
// = el de produccion del 07/10/2026 (fixtures/calendario_antes_paso2.ics) salvo DTSTAMP. Y un cambio de pista hecho por
// un gestor se ve en el .ics. Pila local + app compilada.
//
//   npm run pruebas:fuente-eventos

import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { arrancar } from './pila.mjs';
import { cargarEventos } from '../scripts/cargar_eventos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = 3107, APP = `http://127.0.0.1:${PUERTO}`;
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };
const sinSello = (t) => t.split('\r\n').filter((l) => !l.startsWith('DTSTAMP:')).join('\r\n');
async function esperar(url, ms = 60000) { const fin = Date.now() + ms; while (Date.now() < fin) { try { const r = await fetch(url); if (r.status < 500) return; } catch {} await new Promise((r) => setTimeout(r, 300)); } throw new Error('no arranca'); }

const pila = await arrancar();
let app;
try {
  const { sql, url, anonKey } = pila;
  await cargarEventos(sql, { log: () => {} });
  const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey, NEXT_TELEMETRY_DISABLED: '1' };
  const next = path.join(RAIZ, 'node_modules', 'next', 'dist', 'bin', 'next');
  try { execFileSync(process.execPath, [next, 'build'], { cwd: RAIZ, env, stdio: 'pipe' }); } catch (e) { console.log(String(e.stdout).slice(-1500), String(e.stderr).slice(-1500)); throw e; }
  app = spawn(process.execPath, [next, 'start', '-p', String(PUERTO), '-H', '127.0.0.1'], { cwd: RAIZ, env, stdio: 'ignore' });
  await esperar(APP);
  const antes = fs.readFileSync(path.join(RAIZ, 'pruebas', 'fixtures', 'calendario_antes_paso2.ics'), 'utf8');
  const ahora = await (await fetch(`${APP}/calendario.ics`)).text();
  ok((ahora.match(/BEGIN:VEVENT/g) ?? []).length === 67, '/calendario.ics: 67 eventos (40 partidos + 27 entrenos)');
  ok(sinSello(ahora) === sinSello(antes), 'idéntico al de producción antes del paso 2 (salvo DTSTAMP)', (() => { const a = sinSello(ahora).split('\r\n'), b = sinSello(antes).split('\r\n'); const i = a.findIndex((l, k) => l !== b[k]); return i < 0 ? '' : `línea ${i}: «${a[i]}» ≠ «${b[i]}»`; })());
  // Un gestor fija la pista del 14/10: el .ics lo refleja (la cache se vacia al guardar desde la web; aqui se fuerza por SQL y se espera el TTL corto de la cache de datos)
  const r = await fetch(`${APP}/`);
  ok(r.status === 200 && (await r.text()).includes('Dos equipos.'), 'la portada carga con la fuente nueva');
  const club = await (await fetch(`${APP}/club`)).text();
  ok(club.includes('Valdebernardo') && club.includes('en obras'), '/club: Valdebernardo (Faustina Valladolid) en obras, desde la tabla de pistas');
} finally {
  app?.kill();
  await pila.parar();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
