#!/usr/bin/env node
// Datos publicados intocables desde las ramas de código (D134, docs/NORMAS_DE_TRABAJO.md §12). Los ficheros de datos
// publicados (data/liga_*.json, data/season_*.json y sus copias en plataforma/src/data/) solo los generan
// `npm run jornada` y la rutina A (desde Maccabis-rutina-a), con commits «datos(…)». Ningún merge ni rebase de una rama
// de código los regenera ni los reescribe: en un conflicto se toma SIEMPRE la versión de main.
//
//   npm run check:datos                     la rama actual frente a origin/main (paso de las suites, antes de cada merge)
//   node scripts/check_datos_publicados.js --commit-msg <fichero>   lo que llama el hook .githooks/commit-msg
//
// Ramas de datos (no se comprueban): main y las que empiezan por «datos/» o «datos-». En cualquier otra rama, un fichero
// protegido solo puede cambiar respecto a main con un commit (no de merge) cuyo asunto empiece por «datos(». En un merge,
// cada fichero protegido tiene que quedar como en el lado de main (o como en la rama que se mergea, si allí lo cambió un
// commit «datos(…)»). CHECK_DATOS_BASE cambia la referencia de main (las pruebas usan «main»).
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROTEGIDOS = [
  ':(glob)data/liga_*.json', ':(glob)data/season_*.json',
  'plataforma/src/data/liga.json', 'plataforma/src/data/temporada.json', ':(glob)plataforma/src/data/estadisticas/season_*.json',
];
const DATOS = /^datos\(/;
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const intenta = (...a) => { try { return git(...a); } catch { return null; } };
const lineas = (s) => (s ? s.split('\n').filter(Boolean) : []);

function base() {
  if (process.env.CHECK_DATOS_BASE) return process.env.CHECK_DATOS_BASE;
  return intenta('rev-parse', '--verify', '--quiet', 'origin/main') ? 'origin/main' : 'main';
}
const rama = () => intenta('symbolic-ref', '--quiet', '--short', 'HEAD');
const esRamaDeDatos = (r) => r === 'main' || /^datos[/-]/.test(r ?? '');
const conCommitDatos = (desde, hasta, fichero) => lineas(intenta('log', '--no-merges', '--format=%s', `${desde}..${hasta}`, '--', fichero)).some((s) => DATOS.test(s));
const ladoMain = (ref, b) => intenta('merge-base', '--is-ancestor', ref, b) !== null;
const blob = (ref, f) => intenta('rev-parse', '--verify', '--quiet', `${ref}:${f}`);

const AYUDA = 'Norma D134: los datos publicados solo los generan `npm run jornada` y la rutina A, con un commit «datos(…)». '
  + 'En un merge o rebase se toma SIEMPRE la versión de main: git checkout <main> -- <fichero> (y git add).';

function fallar(motivos) {
  console.error('\ncheck:datos — FALLO: una rama de código cambia datos publicados (D134).');
  for (const m of motivos) console.error(`  · ${m}`);
  console.error(`\n${AYUDA}\n`);
  process.exit(1);
}

/** Modo rama (suites): lo que la rama cambia en los ficheros protegidos desde que se separó de main. */
function comprobarRama() {
  const r = rama(), b = base();
  if (esRamaDeDatos(r)) { console.log(`check:datos: ${r} es una rama de datos; no se comprueba.`); return; }
  const mb = intenta('merge-base', 'HEAD', b);
  if (!mb) { console.log(`check:datos: sin historia común con ${b}; no se comprueba.`); return; }
  const motivos = [];
  for (const f of lineas(git('diff', '--name-only', mb, 'HEAD', '--', ...PROTEGIDOS))) {
    if (!conCommitDatos(mb, 'HEAD', f)) motivos.push(`${f} cambia respecto a ${b} sin ningún commit «datos(…)» en la rama`);
  }
  for (const f of lineas(git('diff', '--name-only', 'HEAD', '--', ...PROTEGIDOS))) motivos.push(`${f} tiene cambios sin commit`);
  if (motivos.length) fallar(motivos);
  console.log(`check:datos: OK (${r ?? 'HEAD sin rama'} no cambia datos publicados respecto a ${b}).`);
}

/** Modo hook (commit-msg): lo que se va a commitear en los ficheros protegidos. */
function comprobarCommit(ficheroMensaje) {
  const mensaje = fs.readFileSync(ficheroMensaje, 'utf8').split('\n').find((l) => l.trim() && !l.startsWith('#')) ?? '';
  const r = rama(), b = base();
  const cambiados = lineas(git('diff', '--cached', '--name-only', '--', ...PROTEGIDOS));
  if (!cambiados.length) return;
  const mergeHead = intenta('rev-parse', '--verify', '--quiet', 'MERGE_HEAD');
  const motivos = [];
  if (mergeHead) {
    // Merge: cada fichero protegido queda como en el lado de main (o como en la rama mergeada si allí lo cambió un
    // commit «datos(…)»). Vale también cuando se mergea una rama de código EN main.
    const padres = ['HEAD', mergeHead];
    for (const f of cambiados) {
      const indice = intenta('rev-parse', '--verify', '--quiet', `:${f}`);
      const deMain = padres.filter((p) => ladoMain(p, b)).map((p) => blob(p, f));
      const otro = padres.find((p) => !ladoMain(p, b));
      const permitidoOtro = otro && blob(otro, f) === indice && conCommitDatos(intenta('merge-base', 'HEAD', mergeHead), otro, f);
      if (!deMain.includes(indice) && !permitidoOtro) motivos.push(`${f}: el merge no deja la versión de main`);
    }
  } else {
    if (esRamaDeDatos(r) || DATOS.test(mensaje)) return;
    for (const f of cambiados) motivos.push(`${f} cambia en un commit de la rama ${r ?? '(sin rama)'} que no es «datos(…)»`);
  }
  if (motivos.length) fallar(motivos);
}

const i = process.argv.indexOf('--commit-msg');
if (i >= 0) comprobarCommit(path.resolve(process.argv[i + 1]));
else comprobarRama();
