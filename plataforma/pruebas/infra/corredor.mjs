#!/usr/bin/env node
// Pruebas por niveles (D149).
//
//   npm run pruebas:rapidas      NIVEL 1, en local, en cada PR (D167): las suites de lo tocado (frente a origin/main),
//                                elegidas solas, mas el humo (typecheck + arranque de la web).
//   npm run pruebas:completas    NIVEL 2: la bateria completa. La corre GitHub Actions en cada PR y es la puerta para
//                                mergear; en local, solo si Iván lo pide (D167).
//
// Opciones (tras `--`):
//   --lista             solo dice que pasaria y por que, sin ejecutar nada
//   --suite a,b         añade suites a mano (p. ej. --suite pruebas:grupos)
//   --grupo k/N         (completas) solo el grupo k de N, como en Actions
//   --locales           (completas) tambien las que solo pueden ir en local (Supabase real, fuentes_fbm...)
//   --capturas          hace las capturas de pantalla (por defecto no, para ir mas rapido)
//
// En Actions: las suites que compilan la web van una detras de otra (comparten plataforma/.next) y el resto en paralelo,
// cada una en su carril de puertos. En local (D167): nunca mas de UNA suite pesada (web o pila) a la vez, tampoco entre
// worktrees (un cerrojo en la carpeta temporal del sistema); las de logica, de dos en dos. Resultado en
// plataforma/pruebas/resultados/tanda/ (fuera de git).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { catalogo, claveRuta, ESTADISTICAS } from './catalogo.mjs';
import { REPO, BASE } from './puertos.mjs';
import { apuntarProceso, matarArbol, olvidarProceso } from './procesos.mjs';
import { barrerPostgres } from './matar.mjs';

const args = process.argv.slice(2);
const modo = args[0];
if (!['rapidas', 'completas'].includes(modo)) { console.error('uso: corredor.mjs rapidas|completas [--lista] [--suite a,b] [--grupo k/N] [--locales] [--capturas]'); process.exit(2); }
const opcion = (n) => { const i = args.indexOf(n); return i === -1 ? null : args[i + 1] ?? ''; };
const tiene = (n) => args.includes(n);
const EN_CI = !!process.env.CI;
const PLAT = path.join(REPO, 'plataforma');
const SALIDA = path.join(PLAT, 'pruebas', 'resultados', 'tanda');
const git = (...a) => { try { return execFileSync('git', a, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).trim(); } catch { return ''; } };
const todas = catalogo();
const porId = new Map(todas.map((s) => [s.id, s]));
const motivos = new Map();
const elegir = (id, motivo) => { if (porId.has(id) && !motivos.has(id)) motivos.set(id, motivo); };

// ------------------------------------------------------------------------------------------------ que se ejecuta
if (modo === 'completas') {
  for (const s of todas) {
    if (s.soloLocal && (EN_CI || !tiene('--locales'))) continue;
    elegir(s.id, 'bateria completa');
  }
  const grupo = opcion('--grupo');
  if (grupo) {
    const [k, n] = grupo.split('/').map(Number);
    // Reparto por tiempos: la mas larga al grupo con menos carga. Las web van en serie y pesan entero; el resto va de
    // cuatro en cuatro.
    const carga = Array(n).fill(0), de = new Map();
    for (const s of [...motivos.keys()].map((id) => porId.get(id)).sort((a, b) => b.segundos - a.segundos || a.id.localeCompare(b.id))) {
      const g = carga.indexOf(Math.min(...carga));
      carga[g] += s.tipo === 'web' ? s.segundos : s.segundos / 4;
      de.set(s.id, g + 1);
    }
    for (const id of [...motivos.keys()]) if (de.get(id) !== k) motivos.delete(id);
  }
} else {
  elegirRapidas();
}
for (const id of (opcion('--suite') || '').split(',').filter(Boolean)) {
  if (!porId.has(id)) { console.error(`No existe la suite ${id}`); process.exit(2); }
  elegir(id, 'pedida con --suite');
}

function cambiados() {
  // PRUEBAS_CAMBIOS=a,b simula los ficheros cambiados (para ver con --lista que elegiria)
  if (process.env.PRUEBAS_CAMBIOS) return process.env.PRUEBAS_CAMBIOS.split(',').map((f) => f.trim()).filter(Boolean);
  const base = git('merge-base', 'HEAD', git('rev-parse', '--verify', '--quiet', 'origin/main') ? 'origin/main' : 'main');
  return [...new Set([
    ...git('diff', '--name-only', base).split('\n'),
    ...git('ls-files', '--others', '--exclude-standard').split('\n'),
  ].filter(Boolean))];
}

/** Grafo inverso de imports de plataforma/src (que ficheros importan a cada uno). */
function importadores() {
  const SRC = path.join(PLAT, 'src');
  const ficheros = [];
  const recorrer = (d) => { for (const n of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, n.name); if (n.isDirectory()) recorrer(p); else if (/\.(tsx?|css)$/.test(n.name)) ficheros.push(p); } };
  recorrer(SRC);
  const resolver = (desde, spec) => {
    const base = spec.startsWith('@/') ? path.join(SRC, spec.slice(2)) : spec.startsWith('.') ? path.resolve(path.dirname(desde), spec) : null;
    if (!base) return null;
    for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    return null;
  };
  const inv = new Map();
  for (const f of ficheros) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
      const r = resolver(f, m[1]);
      if (r) { if (!inv.has(r)) inv.set(r, new Set()); inv.get(r).add(f); }
    }
  }
  return inv;
}

function elegirRapidas() {
  const cambios = cambiados();
  const rel = (p) => path.relative(REPO, p).replace(/\\/g, '/');
  const plataforma = cambios.filter((f) => f.startsWith('plataforma/') && !f.endsWith('.md'));
  if (plataforma.length) elegir('typecheck', 'hay cambios en plataforma/');
  if (cambios.some((f) => f.startsWith('plataforma/pruebas/infra/') || /^plataforma\/pruebas\/(pila|comun_e2e)\.mjs$/.test(f))) {
    console.log('AVISO: has tocado la infraestructura de pruebas: la batería completa la pasa GitHub Actions en el PR (D167); en local, solo si Iván lo pide.');
  }
  // 1. La propia suite tocada, o lo que importa directamente (src/lib, src/components, scripts/).
  for (const s of todas) {
    if (s.fuente && cambios.includes(s.fuente)) elegir(s.id, 'se ha tocado la suite');
    for (const imp of s.importa ?? []) {
      const sin = `plataforma/${imp}`.replace(/\.(m?js|tsx?)$/, '');
      const hit = cambios.find((f) => f.replace(/\.(m?js|tsx?)$/, '') === sin || f.startsWith(`${sin}/`));
      if (hit) elegir(s.id, `usa ${hit}`);
    }
  }
  // 2. Pantallas: de cada fichero tocado de src/ a las paginas que lo usan (hasta 4 saltos de imports) y de ahi a las
  //    suites que visitan esas rutas.
  const inv = importadores();
  const rutasTocadas = new Map();
  for (const f of plataforma.filter((x) => x.startsWith('plataforma/src/'))) {
    const vistos = new Set([path.join(REPO, f)]);
    let frontera = [...vistos];
    for (let salto = 0; salto < 4 && frontera.length; salto++) {
      frontera = frontera.flatMap((x) => [...(inv.get(x) ?? [])]).filter((x) => !vistos.has(x) && vistos.add(x));
    }
    for (const x of vistos) {
      const r = rel(x);
      if (!r.startsWith('plataforma/src/app/')) continue;
      const clave = claveRuta(path.posix.dirname(r.slice('plataforma/src/app'.length)));
      if (!rutasTocadas.has(clave)) rutasTocadas.set(clave, f);
    }
  }
  const web = todas.filter((s) => s.tipo === 'web');
  const pantallas = new Map();
  for (const [ruta, por] of rutasTocadas) {
    const suites = ruta === '/' ? web.filter((s) => ['pruebas:portada', 'pruebas:navegacion'].includes(s.id)) : web.filter((s) => s.rutas.includes(ruta));
    for (const s of suites) if (!pantallas.has(s.id)) pantallas.set(s.id, `pantalla ${ruta} (${por})`);
  }
  // D167: un fichero compartido llega a casi todas las pantallas; en local, como mucho 4 suites de pantallas (si son mas,
  // solo el humo) y el resto lo cubre la bateria de GitHub Actions del PR.
  const MAX_PANTALLAS = 4;
  const nuevas = [...pantallas].filter(([id]) => !motivos.has(id));
  const cortadas = nuevas.length > MAX_PANTALLAS;
  // las paginas tocadas a mano (no las alcanzadas por imports): con el limite, solo estas cuentan para estadisticas
  const directas = plataforma.filter((f) => f.startsWith('plataforma/src/app/')).map((f) => claveRuta(path.posix.dirname(f.slice('plataforma/src/app'.length))));
  if (cortadas) console.log(`AVISO: el cambio llega a ${nuevas.length} suites de pantallas: en local va solo el humo; las pantallas las prueba GitHub Actions en el PR (D167). Añade alguna con --suite si hace falta.`);
  else for (const [id, motivo] of nuevas) elegir(id, motivo);
  // 3. Estadisticas y liga: solo si se tocan datos, el pipeline, una migración de la liga o sus pantallas (D167).
  const PANT_EST = ['/liga', '/historia', '/plantilla', '/jugador', '/mis-numeros', '/liga/scouting', '/liga/consolidada'];
  const est = cambios.find((f) => /^(data\/|scripts\/|index\.html$|plataforma\/src\/data\/|plataforma\/scripts\/(cargar_liga|sincronizar_equipacion))/.test(f)
      || (/^plataforma\/supabase\/migrations\//.test(f) && /liga/i.test(f)))
    ?? (cortadas ? directas : [...rutasTocadas.keys()]).find((r) => PANT_EST.includes(r));
  if (est) {
    for (const id of ESTADISTICAS) elegir(id, `estadisticas y liga (${est})`);
    if (cambios.some((f) => /^(data\/|scripts\/|index\.html$)/.test(f))) for (const s of todas.filter((x) => x.dir === REPO)) elegir(s.id, 'datos o scripts de la raiz');
  }
  // 4. Migraciones o permisos (D167): las suites que prueban esa migración (las que nombran su versión) y, como el cambio
  //    escribe en producción o toca permisos, las de solo lectura contra el Supabase real. El resto de la pila, en Actions.
  const mig = cambios.find((f) => f.startsWith('plataforma/supabase/'));
  if (mig) {
    const versiones = cambios.map((f) => f.match(/^plataforma\/supabase\/migrations\/(\d{14})_/)?.[1]).filter(Boolean);
    for (const s of todas.filter((x) => x.tipo === 'pila' && x.fuente && !x.id.endsWith('-real'))) {
      const src = fs.readFileSync(path.join(REPO, s.fuente), 'utf8');
      const v = versiones.find((x) => src.includes(x));
      if (v) elegir(s.id, `prueba la migración ${v}`);
    }
    if (fs.existsSync(path.join(PLAT, '.env.local'))) for (const s of todas.filter((x) => x.id.endsWith('-real'))) elegir(s.id, `migracion o permisos (${mig}): solo lectura contra el real`);
  }
}

// en una tanda, test:privacidad deja el HTML renderizado a pruebas:privacidad (en completas ya va en la bateria, en su grupo)
if (modo === 'rapidas' && motivos.has('test:privacidad')) elegir('pruebas:privacidad', 'va con test:privacidad (el HTML renderizado)');
// Humo (D167): si se toca la web y ninguna suite elegida la arranca ya, una que compila, arranca y abre lo principal.
if (modo === 'rapidas' && cambiados().some((f) => /^plataforma\/(src|supabase|public)\/|^plataforma\/(next\.config|package)/.test(f)) && ![...motivos.keys()].some((id) => porId.get(id)?.tipo === 'web')) {
  elegir('pruebas:humo', 'humo: arranque de la web (D167)');
}
const plan = [...motivos.keys()].map((id) => porId.get(id));
console.log(`\n${modo === 'rapidas' ? 'NIVEL 1 (pruebas:rapidas)' : 'NIVEL 2 (pruebas:completas)'}: ${plan.length} suites · puertos ${BASE}-${BASE + 99}`);
for (const s of plan) console.log(`  ${s.id.padEnd(34)} ${s.tipo.padEnd(7)} ${motivos.get(s.id)}`);
const fuera = todas.filter((s) => s.soloLocal && !motivos.has(s.id));
if (modo === 'completas' && fuera.length) {
  console.log('  Solo en local (no van aqui):');
  for (const s of fuera) console.log(`    ${s.id.padEnd(32)} ${s.soloLocal}`);
}
if (tiene('--lista') || !plan.length) {
  if (!plan.length) console.log('  (nada que probar: no hay cambios de codigo frente a origin/main)');
  process.exit(0);
}

// ------------------------------------------------------------------------------------------------ ejecucion
fs.rmSync(SALIDA, { recursive: true, force: true });
fs.mkdirSync(SALIDA, { recursive: true });
const t0 = Date.now();
// typecheck sin next-env.d.ts (worktree o Actions recien clonados): lo genera `next typegen`.
if (motivos.has('typecheck') && !fs.existsSync(path.join(PLAT, 'next-env.d.ts'))) {
  execFileSync(process.execPath, [path.join(PLAT, 'node_modules', 'next', 'dist', 'bin', 'next'), 'typegen'], { cwd: PLAT, stdio: 'ignore', windowsHide: true });
}
// PostgREST, una vez y antes de nada (si no, varias suites lo descargan a la vez y se pisan)
if (plan.some((s) => s.tipo !== 'logica')) (await import('../pila.mjs')).descargarPostgrest();
// Un solo Chrome para toda la tanda: cada suite se conecta (PRUEBAS_NAVEGADOR_WS) en vez de abrir el suyo.
const servidor = plan.some((s) => s.tipo === 'web') ? await chromium.launchServer({ channel: 'chrome', headless: true }) : null;
if (servidor) apuntarProceso(servidor.process());
const resultados = [];
const ficheroLog = (s) => path.join(SALIDA, `${s.id.replace(/:/g, '_')}.log`);
// Si la tanda sale con suites en marcha (Ctrl+C), procesos.mjs mata sus arboles con su Postgres dentro: despues
// (este va detras) se barren los restos de Postgres sin padre (infra/matar.mjs).
let enMarcha = 0;
process.on('exit', () => { if (enMarcha) { try { barrerPostgres(); } catch {} } });
const ejecutar = (s, carril) => new Promise((listo) => {
  const ini = Date.now();
  enMarcha++;
  const log = fs.openSync(ficheroLog(s), 'w');
  const env = { ...process.env, PRUEBAS_EN_TANDA: '1', PRUEBAS_CARRIL: String(carril), PRUEBAS_CAPTURAS: tiene('--capturas') ? '1' : '0', ...(servidor ? { PRUEBAS_NAVEGADOR_WS: servidor.wsEndpoint() } : {}) };
  delete env.PRUEBAS_PUERTO_APP; // cada carril tiene su app
  const win = process.platform === 'win32';
  // npm por su npm-cli.js (sin shell); si el corredor no se lanzo con npm, el npm del sistema
  const [cmd, pre, shell] = process.env.npm_execpath ? [process.execPath, [process.env.npm_execpath], false] : [win ? 'npm.cmd' : 'npm', [], win];
  const hijo = apuntarProceso(spawn(cmd, [...pre, 'run', '-s', s.id], { cwd: s.dir, env, stdio: ['ignore', log, log], shell, detached: !win, windowsHide: true }));
  // al cortarla, los restos de Postgres sin padre se barren ya: la siguiente suite de este carril usa los mismos puertos
  const limite = setTimeout(() => { fs.appendFileSync(ficheroLog(s), '\nFALLO: mas de 10 minutos, se corta\n'); matarArbol(hijo.pid); barrerPostgres(); }, 10 * 60 * 1000);
  hijo.on('exit', (codigo) => {
    clearTimeout(limite); olvidarProceso(hijo.pid); fs.closeSync(log); enMarcha--;
    const seg = (Date.now() - ini) / 1000;
    const texto = fs.readFileSync(ficheroLog(s), 'utf8');
    const oks = (texto.match(/^\s*OK\b/gm) || []).length;
    const r = { id: s.id, seg, codigo, oks };
    resultados.push(r);
    console.log(`${codigo === 0 ? '  bien ' : '  MAL  '} ${s.id.padEnd(34)} ${seg.toFixed(1).padStart(6)} s${oks ? `  (${oks} OK)` : ''}`);
    if (codigo !== 0) {
      // los FALLO y, por si fue un error al arrancar, las ultimas lineas del registro
      const lineas = texto.split(/\r?\n/).filter((l) => l.trim());
      const fallos = lineas.filter((l) => /FALLO|PUERTO OCUPADO/.test(l)).slice(0, 15);
      console.log([...fallos, '...', ...lineas.slice(process.env.CI ? -60 : -12)].map((l) => `         ${l.slice(0, 300)}`).join('\n'));
    }
    listo(r);
  });
});

// Cerrojo de suite pesada para todo el equipo (D167): una carpeta en el temporal del sistema con quién la tiene. Si su
// dueño ya no existe (prueba cortada de golpe), se quita. Solo en local.
const CERROJO = path.join(os.tmpdir(), 'maccabis-pruebas-pesada');
let cerrojoMio = false;
const vivo = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
async function tomarCerrojo(s) {
  let avisado = false;
  for (;;) {
    try {
      fs.mkdirSync(CERROJO);
      fs.writeFileSync(path.join(CERROJO, 'dueno.json'), JSON.stringify({ pid: process.pid, worktree: REPO, suite: s.id, desde: new Date().toISOString() }));
      cerrojoMio = true;
      return;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let d = null; try { d = JSON.parse(fs.readFileSync(path.join(CERROJO, 'dueno.json'), 'utf8')); } catch { /* recién creada */ }
      if (d && !vivo(d.pid)) { fs.rmSync(CERROJO, { recursive: true, force: true }); continue; }
      if (!avisado && d) { console.log(`  (esperando: hay otra suite pesada en marcha, ${d.suite} en ${path.basename(d.worktree)}, desde ${d.desde.slice(11, 19)})`); avisado = true; }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}
const soltarCerrojo = () => { if (cerrojoMio) { cerrojoMio = false; try { fs.rmSync(CERROJO, { recursive: true, force: true }); } catch {} } };
process.on('exit', soltarCerrojo);

// En Actions: las que compilan la web, en serie en el carril 0; el resto en los carriles 1-4. En local (D167): todas las
// pesadas (web y pila) en serie en el carril 0 y con el cerrojo; las de logica en los carriles 1-2. La web espera al
// typecheck (lee .next/types mientras next build los reescribe).
const pesada = (s) => (EN_CI ? s.tipo === 'web' : s.tipo !== 'logica');
const web = plan.filter(pesada);
const otras = plan.filter((s) => !pesada(s)).sort((a, b) => (a.id === 'typecheck' ? -1 : b.id === 'typecheck' ? 1 : b.segundos - a.segundos));
let avisarTypecheck = () => {};
const typecheckHecho = motivos.has('typecheck') ? new Promise((r) => { avisarTypecheck = r; }) : Promise.resolve();
const colaOtras = async (carril) => {
  while (otras.length) {
    const s = otras.shift();
    await ejecutar(s, carril);
    if (s.id === 'typecheck') avisarTypecheck();
  }
};
const colaWeb = async () => {
  await typecheckHecho;
  for (const s of web) {
    if (!EN_CI) await tomarCerrojo(s);
    try { await ejecutar(s, 0); } finally { soltarCerrojo(); }
  }
};
await Promise.all([colaWeb(), ...(EN_CI ? [1, 2, 3, 4] : [1, 2]).map(colaOtras)]);
if (servidor) await servidor.close().catch(() => {});

const malas = resultados.filter((r) => r.codigo !== 0);
const total = (Date.now() - t0) / 1000;
const resumen = [`${modo} · ${new Date().toISOString()} · ${plan.length} suites · ${total.toFixed(0)} s · ${malas.length ? `${malas.length} CON FALLOS: ${malas.map((r) => r.id).join(', ')}` : 'todo en verde'}`,
  ...resultados.sort((a, b) => b.seg - a.seg).map((r) => `${r.codigo === 0 ? 'bien' : 'MAL '}\t${r.seg.toFixed(1)}\t${r.id}\t${r.oks}`)];
fs.writeFileSync(path.join(SALIDA, 'resumen.txt'), resumen.join('\n') + '\n');
console.log(`\n${resumen[0]}\nRegistros de cada suite en plataforma/pruebas/resultados/tanda/`);
process.exit(malas.length ? 1 : 0);
