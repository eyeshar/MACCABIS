#!/usr/bin/env node
// Pruebas de la norma D134 (scripts/check_datos_publicados.js y el hook .githooks/commit-msg) en un repositorio de
// usar y tirar: commits de verdad con el hook activado, el modo rama de las suites y el caso que borró la J3 el 26/10
// (un merge de main en una rama de código que deja un liga.json regenerado en vez del de main).
//
//   npm run test:datos
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'maccabis-d134-'));
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };
const git = (...a) => execFileSync('git', a, { cwd: DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const intenta = (...a) => { try { git(...a); return true; } catch { return false; } };
const escribe = (f, t) => { fs.mkdirSync(path.dirname(path.join(DIR, f)), { recursive: true }); fs.writeFileSync(path.join(DIR, f), t); };
const commit = (msg) => intenta('commit', '-q', '-m', msg);
const env = { ...process.env, CHECK_DATOS_BASE: 'main' };
const rama = () => { try { execFileSync('node', ['scripts/check_datos_publicados.js'], { cwd: DIR, env, stdio: 'pipe' }); return true; } catch { return false; } };
const LIGA = 'data/liga_2026-27.json';

try {
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'pruebas@example.invalid'); git('config', 'user.name', 'Pruebas'); git('config', 'commit.gpgsign', 'false');
  for (const f of ['scripts/check_datos_publicados.js', '.githooks/commit-msg']) escribe(f, fs.readFileSync(path.join(RAIZ, f), 'utf8'));
  fs.chmodSync(path.join(DIR, '.githooks', 'commit-msg'), 0o755); // en Linux (GitHub Actions), un hook sin permiso de ejecucion se ignora
  escribe(LIGA, '{"jornadas":[1,2,3]}\n'); escribe('plataforma/src/data/liga.json', '{"jornadas":[1,2,3]}\n'); escribe('README.md', 'x\n');
  git('add', '-A'); git('commit', '-q', '-m', 'inicio');
  git('config', 'core.hooksPath', '.githooks');
  process.env.CHECK_DATOS_BASE = 'main';

  console.log('\n== main y las ramas de datos no se comprueban');
  escribe(LIGA, '{"jornadas":[1,2,3,4]}\n'); git('add', LIGA);
  ok(commit('cualquier cosa en main'), 'en main se puede commitear la liga (npm run jornada publica en main)');
  ok(rama(), 'npm run check:datos en main: OK');
  git('checkout', '-q', '-b', 'datos/j5'); escribe(LIGA, '{"jornadas":[1,2,3,4,5]}\n'); git('add', LIGA);
  ok(commit('liga con la J5'), 'en una rama «datos/…» también');
  git('checkout', '-q', 'main'); git('branch', '-q', '-D', 'datos/j5');

  console.log('\n== Una rama de código no cambia datos publicados sin «datos(…)»');
  git('checkout', '-q', '-b', 'feat/x');
  escribe('plataforma/src/app.ts', 'codigo\n'); git('add', '-A');
  ok(commit('feat: codigo'), 'un commit de código sin datos: pasa');
  ok(rama(), 'check:datos de la rama: OK');
  escribe(LIGA, '{"jornadas":[1,2]}\n'); git('add', LIGA);
  ok(!commit('feat: regenero la liga'), 'el hook rechaza un commit «feat» que cambia data/liga_2026-27.json');
  escribe('plataforma/src/data/estadisticas/season_2026-27.json', '{}\n'); git('add', '-A');
  ok(!commit('fix: copia'), 'y uno que cambia una copia protegida (plataforma/src/data/estadisticas/season_*.json)');
  git('reset', '-q', '--hard', 'HEAD');
  escribe('plataforma/src/data/otro.json', '{}\n'); git('add', '-A');
  ok(commit('feat: otro dato de la web'), 'un fichero de plataforma/src/data/ que no es de liga ni de temporada: pasa');
  escribe(LIGA, '{"jornadas":[1,2,3,4],"formato":2}\n'); git('add', LIGA);
  ok(commit('datos(2026-27): nuevo formato de la liga'), 'con un commit «datos(…)» explícito, sí');
  ok(rama(), 'y check:datos lo acepta (el cambio lleva su commit «datos(…)»)');

  console.log('\n== check:datos ve lo que se coló sin el hook (rebase, --no-verify)');
  git('checkout', '-q', '-b', 'feat/colado', 'main');
  escribe(LIGA, '{"jornadas":[1]}\n'); git('add', LIGA); git('commit', '-q', '--no-verify', '-m', 'feat: sin hook');
  ok(!rama(), 'check:datos falla: la liga cambia respecto a main sin commit «datos(…)»');
  git('checkout', '-q', 'main'); git('branch', '-q', '-D', 'feat/colado');

  console.log('\n== Merges: se toma SIEMPRE la versión de main');
  git('checkout', '-q', '-b', 'feat/y', 'main');
  escribe('plataforma/src/app.ts', 'y\n'); git('add', '-A'); git('commit', '-q', '-m', 'feat: y');
  git('checkout', '-q', 'main'); escribe(LIGA, '{"jornadas":[1,2,3,4,5]}\n'); escribe('plataforma/src/data/liga.json', '{"jornadas":[1,2,3,4,5]}\n'); git('add', '-A'); git('commit', '-q', '-m', 'datos(2026-27): jornada 5');
  git('checkout', '-q', 'feat/y');
  ok(intenta('merge', '--no-edit', '-q', 'main'), 'traer main a la rama (con su J5) pasa: la liga queda como en main');
  ok(rama(), 'check:datos tras traer main: OK');
  git('checkout', '-q', 'main'); escribe(LIGA, '{"jornadas":[1,2,3,4,5,6]}\n'); git('add', LIGA); git('commit', '-q', '-m', 'datos(2026-27): jornada 6');
  git('checkout', '-q', 'feat/y');
  intenta('merge', '--no-commit', '--no-ff', '-q', 'main');
  escribe(LIGA, '{"jornadas":[1,2,3]}\n'); git('add', LIGA); // regenerada con fuentes viejas (lo del 26/10)
  ok(!intenta('commit', '-q', '--no-edit'), 'el merge que deja una liga regenerada (sin la J4–J6) se rechaza: el caso de la J3');
  git('checkout', 'main', '--', LIGA);
  ok(intenta('commit', '-q', '--no-edit'), 'tomando la versión de main (git checkout main -- …), el merge pasa');
  ok(rama(), 'y check:datos: OK');
  git('checkout', '-q', 'main');
  ok(intenta('merge', '--no-ff', '-q', '-m', 'Merge feat/y', 'feat/y'), 'mergear la rama de código en main (sin tocar datos) pasa');
  ok(JSON.parse(fs.readFileSync(path.join(DIR, LIGA), 'utf8')).jornadas.length === 6, 'y main conserva su liga (J1–J6)');
} finally {
  fs.rmSync(DIR, { recursive: true, force: true });
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
