#!/usr/bin/env node
// Estado actual de las redirecciones de GitHub Pages (activadas en 7a9b041, docs/ACTIVAR_REDIRECCIONES.md): la redireccion esta
// activa, index.html ya no lleva la barra «← Volver a Maccabis» y cada pestaña antigua salta a su pagina nueva. Solo lee el repo.
//
//   npm run pruebas:activacion
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };

console.log('== Estado de los ficheros');
const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8'), redir = fs.readFileSync(path.join(REPO, 'data', 'redireccion_web.js'), 'utf8');
ok(/var ESTA_ACTIVA = true;/.test(redir), 'redireccion_web.js: ESTA_ACTIVA = true');
ok(!/class="mcb"|mcb-fila|mcbMenu|Volver a Maccabis/.test(html), 'index.html: ni rastro de la barra (CSS, marcado ni script)');
const cuenta = (s, re) => (s.match(re) || []).length;
ok(cuenta(html, /<style>/g) === cuenta(html, /<\/style>/g) && cuenta(html, /<script/g) === cuenta(html, /<\/script>/g), 'index.html: etiquetas <style> y <script> equilibradas');
ok(html.includes('function initDashboard') && html.includes('data/redireccion_web.js') && html.includes('<div id="app">'), 'index.html: sigue teniendo el panel y carga la redireccion');

console.log('\n== Cada pestaña antigua salta a su pagina nueva');
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const f = path.join(REPO, decodeURIComponent(u.pathname));
  if (f.startsWith(REPO) && fs.existsSync(f) && fs.statSync(f).isFile()) { res.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8' }); return fs.createReadStream(f).pipe(res); }
  res.writeHead(404); res.end();
}).listen(0, '127.0.0.1');
await new Promise((r) => srv.once('listening', r));
const base = `http://127.0.0.1:${srv.address().port}`;
const nav = await chromium.launch({ channel: 'chrome', headless: true });
const p = await nav.newPage();
await p.route('**/maccabis.vercel.app/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: `<title>${r.request().url()}</title>` }));
for (const [antigua, nueva] of [['?p=liga&g=G2', '/liga?g=G2'], ['?p=rivales&g=MdL', '/liga/rivales?g=MdL'], ['?t=2023-24&p=equipo', '/liga/2023-24/equipo'], ['?t=2023-24&p=jugadores', '/plantilla?t=2023-24'], ['?t=2025-26&p=jugador&j=esteban-jon', '/jugador/esteban-jon?t=2025-26'], ['?p=historia', '/historia'], ['#2013-14', '/liga/2013-14/equipo']]) {
  await p.goto(`${base}/index.html${antigua}`, { waitUntil: 'commit' }).catch(() => {});
  await p.waitForURL(/maccabis\.vercel\.app/, { timeout: 8000 }).catch(() => {});
  ok(p.url() === `https://maccabis.vercel.app${nueva}`, `${antigua} -> ${nueva}`, p.url());
}
await nav.close(); srv.close();
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
