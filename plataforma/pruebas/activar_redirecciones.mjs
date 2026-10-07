#!/usr/bin/env node
// Prueba del ultimo paso («activar redirecciones y retirar la barra de GitHub Pages»), sobre una COPIA del repo: no toca nada.
// Comprueba que el script aplica solo lo previsto, que index.html sigue siendo valido y que, activado, cada pestaña salta
// a su pagina nueva. Revertirlo es un `git revert` (un solo commit): aqui se comprueba que con --raiz no cambia nada mas.
//
//   npm run pruebas:activacion
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'activacion-'));
fs.mkdirSync(path.join(tmp, 'data'));
for (const f of fs.readdirSync(path.join(REPO, 'data')).filter((x) => /\.(json|js)$/.test(x))) fs.copyFileSync(path.join(REPO, 'data', f), path.join(tmp, 'data', f));
fs.copyFileSync(path.join(REPO, 'index.html'), path.join(tmp, 'index.html'));
const script = path.join(REPO, 'scripts', 'activar_redirecciones.js');
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };

const antes = fs.readFileSync(path.join(tmp, 'index.html'), 'utf8'), antesR = fs.readFileSync(path.join(tmp, 'data', 'redireccion_web.js'), 'utf8');
console.log('== Simulacro (sin --aplicar)');
execFileSync(process.execPath, [script, '--raiz', tmp]);
ok(fs.readFileSync(path.join(tmp, 'index.html'), 'utf8') === antes && fs.readFileSync(path.join(tmp, 'data', 'redireccion_web.js'), 'utf8') === antesR, 'sin --aplicar no escribe nada');
ok(antes.includes('class="mcb"') && /var ESTA_ACTIVA = false;/.test(antesR), 'punto de partida: barra puesta y redireccion desactivada');

console.log('\n== Aplicado');
execFileSync(process.execPath, [script, '--raiz', tmp, '--aplicar']);
const html = fs.readFileSync(path.join(tmp, 'index.html'), 'utf8'), redir = fs.readFileSync(path.join(tmp, 'data', 'redireccion_web.js'), 'utf8');
ok(/var ESTA_ACTIVA = true;/.test(redir) && redir.replace('var ESTA_ACTIVA = true;', 'var ESTA_ACTIVA = false;') === antesR, 'redireccion_web.js: solo cambia ESTA_ACTIVA');
ok(!/class="mcb"|mcb-fila|mcbMenu|Volver a Maccabis/.test(html), 'index.html: ni rastro de la barra (CSS, marcado ni script)');
const cuenta = (s, re) => (s.match(re) || []).length;
ok(cuenta(html, /<style>/g) === cuenta(html, /<\/style>/g) && cuenta(html, /<script/g) === cuenta(html, /<\/script>/g), 'index.html: etiquetas <style> y <script> equilibradas');
ok(html.includes('function initDashboard') && html.includes('data/redireccion_web.js') && html.includes('<div id="app">'), 'index.html: sigue teniendo el panel y carga la redireccion');
ok(antes.length - html.length > 1500 && antes.length - html.length < 6000, `solo se quitan ${antes.length - html.length} caracteres`);
const otra = execFileSync(process.execPath, [script, '--raiz', tmp, '--aplicar']).toString();
ok(/ya estaban activas/.test(otra) && /ya estaba retirada/.test(otra) && fs.readFileSync(path.join(tmp, 'index.html'), 'utf8') === html, 'aplicarlo dos veces no rompe nada (idempotente)');

console.log('\n== Con la redireccion activada, cada pestaña antigua salta a su pagina nueva');
const DESTINO = 'http://127.0.0.1:1';
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const f = path.join(tmp, decodeURIComponent(u.pathname));
  if (fs.existsSync(f) && fs.statSync(f).isFile()) { res.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8' }); return fs.createReadStream(f).pipe(res); }
  res.writeHead(404); res.end();
}).listen(0, '127.0.0.1');
await new Promise((r) => srv.once('listening', r));
const base = `http://127.0.0.1:${srv.address().port}`;
const nav = await chromium.launch({ channel: 'chrome', headless: true });
const p = await nav.newPage();
const aDestino = '**/maccabis.vercel.app/**';
await p.route(aDestino, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: `<title>${r.request().url()}</title>` }));
for (const [antigua, nueva] of [['?p=liga&g=G2', '/liga?g=G2'], ['?p=rivales&g=MdL', '/liga/rivales?g=MdL'], ['?t=2023-24&p=equipo', '/liga/2023-24/equipo'], ['?t=2023-24&p=jugadores', '/plantilla?t=2023-24'], ['?t=2025-26&p=jugador&j=esteban-jon', '/jugador/esteban-jon?t=2025-26'], ['?p=historia', '/historia'], ['#2013-14', '/liga/2013-14/equipo']]) {
  await p.goto(`${base}/index.html${antigua}`, { waitUntil: 'commit' }).catch(() => {});
  await p.waitForURL(/maccabis\.vercel\.app/, { timeout: 8000 }).catch(() => {});
  ok(p.url() === `https://maccabis.vercel.app${nueva}`, `${antigua} -> ${nueva}`, p.url());
}
await nav.close(); srv.close(); fs.rmSync(tmp, { recursive: true, force: true });
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
