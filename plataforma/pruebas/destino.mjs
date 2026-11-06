#!/usr/bin/env node
// Guardia de destino (norma 19, D187; scripts/lib/destino.mjs), sin base ni red: cada script que escribe, revierte o crea
// cuentas en el real, lanzado como lo lanzaria una persona o la rutina A, con un destino que no cuadra, para ANTES de
// conectarse (codigo 3, «DESTINO NO COMPROBADO»), y apuntado a la pila (--pila y la conexion en 127.0.0.1) pasa la
// guardia. Cada script corre con infra/sin_red.mjs: cualquier conexion que no sea al servidor falso de la prueba falla y
// queda apuntada, asi que ni con la guardia rota llegaria al real (las URL «del real» llevan una contrasena falsa).
//
//   npm run pruebas:destino
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { REAL, servidorDe, apiDe, leerOpciones, comprobarDestino, DestinoIncorrecto, CODIGO_DESTINO } from '../scripts/lib/destino.mjs';
import { PUERTOS, exigirLibres } from './infra/puertos.mjs';

const PLAT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.join(PLAT, '..');
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };

const PUERTO = PUERTOS.aux(0);
const PILA = `postgres://postgres:postgres@127.0.0.1:${PUERTO}/postgres`;
const API_PILA = `http://127.0.0.1:${PUERTO}`;
const FALSA = 'contrasena-falsa-de-la-prueba';
const DEL_REAL = `postgres://postgres.${REAL.ref}:${FALSA}@${REAL.pooler}:5432/postgres`;
const OTRA = `postgres://postgres:${FALSA}@203.0.113.10:5432/postgres`;   // TEST-NET-3: no es de nadie

// --- 1. La comparacion, sin lanzar nada
console.log('\n== Qué servidor es cada conexión');
ok(servidorDe(PILA).tipo === 'pila', 'la pila local (127.0.0.1)');
ok(servidorDe(`postgres://u:p@localhost:${PUERTO}/x`).tipo === 'otro', 'localhost no vale como pila (solo 127.0.0.1)');
ok(servidorDe(DEL_REAL).tipo === 'real', 'el real por el pooler (postgres.<ref>)');
ok(servidorDe(`postgres://postgres:${FALSA}@${REAL.directo}:5432/postgres`).tipo === 'real', 'el real por la conexión directa (db.<ref>)');
ok(servidorDe(`postgres://postgres.otroproyecto:${FALSA}@${REAL.pooler}:5432/postgres`).tipo === 'otro', 'otro proyecto en el mismo pooler no es el real');
ok(servidorDe(OTRA).tipo === 'otro' && servidorDe(undefined).tipo === 'vacio' && servidorDe('x').tipo === 'ilegible', 'otro servidor, vacía e ilegible');
ok(!JSON.stringify([servidorDe(DEL_REAL), servidorDe(OTRA)]).includes(FALSA), 'la descripción nunca lleva la contraseña');
ok(apiDe(API_PILA).tipo === 'pila' && apiDe(REAL.api).tipo === 'real' && apiDe('https://otro.supabase.co').tipo === 'otro', 'las API: pila, real y otra');
const rechaza = (op, d) => { try { comprobarDestino(op, d); return false; } catch (e) { return e instanceof DestinoIncorrecto; } };
ok(rechaza({ pila: false, confirmado: null }, { url: PILA }), 'sin --pila ni --confirmar, para');
ok(rechaza({ pila: true, confirmado: REAL.ref }, { url: PILA }), '--pila y --confirmar a la vez, para');
ok(rechaza({ pila: true, confirmado: null }, { url: PILA, api: REAL.api, conApi: true }), '--pila con la API del real, para');
ok(rechaza({ pila: false, confirmado: REAL.ref }, { url: DEL_REAL, api: API_PILA, conApi: true }), 'el real con la API de la pila, para');
ok(comprobarDestino({ pila: false, confirmado: REAL.ref }, { url: DEL_REAL, api: REAL.api, conApi: true }).modo === 'real', 'el real confirmado con su ref y su API, sigue');
const op = leerOpciones(['foto', 'x.json', '--confirmar', 'abc', '--temporada', '2026-27']);
ok(op.confirmado === 'abc' && !op.pila && op.resto.join(' ') === 'foto x.json --temporada 2026-27', 'quita --confirmar <ref> de los argumentos');
ok(leerOpciones(['--confirmar=abc', '--pila']).confirmado === 'abc' && leerOpciones(['--pila']).pila, '--confirmar=<ref> y --pila');

// --- 2. Las piezas que no son scripts
console.log('\n== Rutina A y pila');
const rutina = fs.readFileSync(path.join(REPO, 'scripts', 'rutina_a_publicar.ps1'), 'utf8');
ok(rutina.match(/^\$RefReal = '([a-z0-9]+)'/m)?.[1] === REAL.ref, 'la rutina A lleva escrito el mismo ref del real que destino.mjs');
const llamadas = [...rutina.matchAll(/\$Plataforma ["']([^"']+)["']/g)].map((m) => m[1]).filter((c) => /^(npm|node) /.test(c));   // lo que lanza en plataforma/
ok(llamadas.length === 3 && llamadas.every((l) => l.includes('--confirmar $RefReal')), 'la rutina A confirma el real en db:liga, db:asistencia y verificar_produccion', llamadas.join(' | '));
const pilaSrc = fs.readFileSync(path.join(PLAT, 'pruebas', 'pila.mjs'), 'utf8');
ok(/comprobarDestino\(\{ pila: true[\s\S]*?\);\s*const sql = postgres\(url/.test(pilaSrc), 'pila.mjs comprueba que es local antes de conectarse');
ok(/return \{[^}]*dbUrl: url/.test(pilaSrc), 'la pila devuelve su conexión de Postgres (dbUrl)');

// --- 3. Cada script, lanzado de verdad
const SCRIPTS = [
  { id: 'db:migrar', f: 'scripts/db.mjs', a: ['migrar'] },
  { id: 'db:semilla', f: 'scripts/db.mjs', a: ['semilla'] },
  { id: 'db:gestor', f: 'scripts/db.mjs', a: ['gestor', 'gestor@pruebas.local', 'Gestor', 'Prueba'] },
  { id: 'db:correo', f: 'scripts/db.mjs', a: ['correo', 'sint-prueba', 'nuevo@pruebas.local'] },
  { id: 'db:revertir', f: 'scripts/db.mjs', a: ['revertir', '20261105100000'] },
  { id: 'db:liga', f: 'scripts/cargar_liga.mjs', a: [] },
  { id: 'db:privado', f: 'scripts/cargar_privado.mjs', a: ['--aplicar'] },
  { id: 'db:asistencia', f: 'scripts/cargar_asistencia.mjs', a: [] },
  { id: 'db:asistencia-eventos', f: 'scripts/cargar_asistencia_eventos.mjs', a: [] },
  { id: 'db:asistencia-vincular', f: 'scripts/vincular_asistencia_historica.mjs', a: [] },
  { id: 'db:eventos', f: 'scripts/cargar_eventos.mjs', a: [] },
  { id: 'cargar_reserva --aplicar', f: 'scripts/cargar_reserva.mjs', a: ['--aplicar'] },
  { id: 'avisos:programar --aplicar', f: 'scripts/programar_tarea_avisos.mjs', a: ['--aplicar'] },
  { id: 'avisos:programar --quitar', f: 'scripts/programar_tarea_avisos.mjs', a: ['--quitar'] },
  { id: 'db:d111-liga foto', f: 'scripts/d111_liga.mjs', a: ['foto', 'foto.json'], api: true },
  { id: 'db:d111-liga volcar', f: 'scripts/d111_liga.mjs', a: ['volcar', 'volcado.json'] },
  { id: 'db:d111-liga revertir', f: 'scripts/d111_liga.mjs', a: ['revertir', 'volcado.json'] },
  { id: 'verificar_real', f: 'pruebas/verificar_real.mjs', a: [], api: true },
  { id: 'verificar_produccion', f: 'pruebas/verificar_produccion.mjs', a: [], api: true },
  { id: 'verificar_chat_preview', f: 'pruebas/verificar_chat_preview.mjs', a: ['https://maccabis-abc123-web-tcpc.vercel.app'], api: true },
];
// Casos que tienen que parar (ninguno combina --confirmar <ref del real> con la conexión del real: ese seguiría).
const PARAN = [
  { que: 'sin --pila ni --confirmar', url: PILA, op: [] },
  { que: '--pila con otro servidor', url: OTRA, op: ['--pila'] },
  { que: '--pila sin conexión (el incidente del 06/11: no lee .env.local)', url: undefined, op: ['--pila'] },
  { que: 'la conexión del real sin confirmar', url: DEL_REAL, op: [] },
  { que: 'la conexión del real con --pila', url: DEL_REAL, op: ['--pila'] },
  { que: 'la conexión del real con otro ref', url: DEL_REAL, op: ['--confirmar', 'otroproyecto'] },
  { que: '--confirmar <ref del real> con la conexión de la pila', url: PILA, op: ['--confirmar', REAL.ref] },
  { que: '--pila y --confirmar a la vez', url: PILA, op: ['--pila', '--confirmar', REAL.ref] },
];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pruebas-destino-'));
const PRECARGA = pathToFileURL(path.join(PLAT, 'pruebas', 'infra', 'sin_red.mjs')).href;
const QUITAR = ['SUPABASE_DB_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'AVISOS_SECRETO', 'AVISOS_URL_TAREA', 'NODE_OPTIONS'];
let n = 0;
function lanzar(s, { url, api, op }) {
  const marca = path.join(tmp, `marca-${n++}.txt`);
  const env = { ...process.env, PRUEBAS_DESTINO_PUERTO: String(PUERTO), PRUEBAS_DESTINO_MARCA: marca };
  for (const k of QUITAR) delete env[k];
  if (url) env.SUPABASE_DB_URL = url;
  if (api) env.NEXT_PUBLIC_SUPABASE_URL = api;
  return new Promise((fin) => {
    const hijo = spawn(process.execPath, ['--import', PRECARGA, path.join(PLAT, s.f), ...s.a, ...op], { cwd: tmp, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let salida = '';
    hijo.stdout.on('data', (d) => { salida += d; });
    hijo.stderr.on('data', (d) => { salida += d; });
    const reloj = setTimeout(() => hijo.kill(), 60000);
    hijo.on('close', (codigo) => {
      clearTimeout(reloj);
      const intentos = fs.existsSync(marca) ? fs.readFileSync(marca, 'utf8').trim().split('\n') : [];
      fin({ codigo, salida, intentos });
    });
  });
}
async function enTandas(tareas, tanda = 6) {
  const r = [];
  for (let i = 0; i < tareas.length; i += tanda) r.push(...await Promise.all(tareas.slice(i, i + tanda).map((t) => t())));
  return r;
}

// Servidor falso de «la pila»: acepta y cierra. Solo sirve para ver que el script, pasada la guardia, va a 127.0.0.1.
await exigirLibres({ 'destino: servidor falso': PUERTO });
const llegadas = [];
const falso = net.createServer((c) => { llegadas.push(Date.now()); c.destroy(); });
await new Promise((r) => falso.listen(PUERTO, '127.0.0.1', r));
try {
  for (const s of SCRIPTS) {
    console.log(`\n== ${s.id}`);
    const casos = [...PARAN.map((c) => ({ ...c, api: s.api ? API_PILA : undefined }))];
    if (s.api) casos.push({ que: '--pila con la API del real', url: PILA, api: REAL.api, op: ['--pila'] });
    const res = await enTandas(casos.map((c) => () => lanzar(s, c)));
    casos.forEach((c, i) => {
      const r = res[i];
      ok(r.codigo === CODIGO_DESTINO && /DESTINO NO COMPROBADO/.test(r.salida) && r.intentos.length === 0 && !r.salida.includes(FALSA),
        `${c.que}: para sin conectarse`, `código ${r.codigo}, intentos ${r.intentos.join(',') || 0}: ${r.salida.trim().split('\n').slice(-2).join(' / ').slice(0, 300)}`);
    });
    const antes = llegadas.length;
    const r = await lanzar(s, { url: PILA, api: s.api ? API_PILA : undefined, op: ['--pila'] });
    ok(r.codigo !== CODIGO_DESTINO && /Destino comprobado: la pila local \(127\.0\.0\.1:\d+\)/.test(r.salida) && !/DESTINO NO COMPROBADO/.test(r.salida),
      'apuntado a la pila (--pila, 127.0.0.1): pasa la guardia', `código ${r.codigo}: ${r.salida.trim().split('\n').slice(-2).join(' / ').slice(0, 300)}`);
    ok(r.intentos.every((x) => x.startsWith('127.0.0.1:')), 'pasada la guardia, no sale de 127.0.0.1', r.intentos.join(','));
    if (llegadas.length > antes) console.log('        (se conectó al servidor falso de la pila)');
  }
} finally {
  falso.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exitCode = fallos ? 1 : 0;
