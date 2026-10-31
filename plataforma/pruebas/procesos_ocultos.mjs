// Ninguna prueba ni utilidad abre ventanas de consola en Windows (Iván, 31/10/2026). Comprobacion estatica, sin arrancar
// nada:
//   - Toda llamada a spawn/spawnSync/exec/execSync/execFile/execFileSync/fork de child_process en plataforma/pruebas,
//     plataforma/scripts, scripts/ (raiz) y chat-worker lleva `windowsHide: true` en sus opciones. Sin ella, un hijo de
//     consola lanzado desde un proceso sin consola (el vigia, la tarea programada, una sesion de Claude Code) abre una
//     ventana vacia de node.exe/cmd.exe.
//   - embedded-postgres (que no la pone) arranca initdb y postgres dentro de `conVentanasOcultas` (infra/procesos.mjs).
//   - El vigia de Windows no se lanza `detached`: con DETACHED_PROCESS el cmd que lo arranca no tiene consola y el
//     node del vigia recibia una nueva, visible durante toda la prueba.
//   npm run pruebas:procesos
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PLAT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.join(PLAT, '..');
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };

const LLAMADAS = /(?<![.\w])(spawnSync|spawn|execFileSync|execFile|execSync|exec|fork)\s*\(/g;

/** Llamadas de child_process de un codigo fuente sin `windowsHide`: [{ linea, texto }]. Solo mira ficheros que
 *  importan child_process (en los demas, `exec(` es otra cosa). */
export function sinOcultar(src) {
  if (!/child_process/.test(src)) return [];
  const fuera = [];
  for (const m of src.matchAll(LLAMADAS)) {
    const antes = src.slice(Math.max(0, m.index - 12), m.index);
    if (/function\s+$/.test(antes)) continue;                       // una funcion propia que se llame asi
    let i = m.index + m[0].length, prof = 1;
    while (i < src.length && prof > 0) { const c = src[i++]; if (c === '(') prof++; else if (c === ')') prof--; }
    const llamada = src.slice(m.index, i);
    if (!/windowsHide:\s*true/.test(llamada)) fuera.push({ linea: src.slice(0, m.index).split('\n').length, texto: llamada.split('\n')[0].slice(0, 90) });
  }
  return fuera;
}

console.log('== El comprobador');
ok(sinOcultar("import { spawn } from 'node:child_process';\nspawn('a', [], { stdio: 'ignore' });").length === 1, 'detecta un spawn sin windowsHide');
ok(sinOcultar("import { execFileSync } from 'node:child_process';\nexecFileSync('git', ['x'], {\n  encoding: 'utf8',\n  windowsHide: true,\n});").length === 0, 'acepta una llamada en varias líneas con windowsHide');
ok(sinOcultar("const { execSync } = require('child_process');\nexecSync('git ls-files', { cwd: f(x) });").length === 1, 'detecta execSync con require y paréntesis dentro');
ok(sinOcultar("import { exec } from 'node:child_process';\n/re/.exec(s); cosa.spawn(1);").length === 0, 'no confunde RegExp.exec ni métodos de otros objetos');
ok(sinOcultar("const x = 1; exec(1);").length === 0, 'sin child_process no mira nada');

console.log('\n== Procesos hijos con la ventana oculta');
const DIRS = ['plataforma/pruebas', 'plataforma/scripts', 'scripts', 'chat-worker'];
const SALTAR = new Set(['node_modules', 'resultados', '.bin', '.next', '.wrangler']);
const ficheros = [];
const recorrer = (d) => {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (SALTAR.has(e.name)) continue;
    const f = path.join(d, e.name);
    if (e.isDirectory()) recorrer(f);
    else if (/\.(mjs|cjs|js|ts)$/.test(e.name)) ficheros.push(f);
  }
};
DIRS.forEach((d) => recorrer(path.join(REPO, d)));
const ESTE = fileURLToPath(import.meta.url);
ficheros.splice(ficheros.indexOf(ESTE), 1);                                   // sus propios ejemplos
const malos = ficheros.flatMap((f) => sinOcultar(fs.readFileSync(f, 'utf8')).map((x) => `${path.relative(REPO, f).replace(/\\/g, '/')}:${x.linea} ${x.texto}`));
const conHijos = ficheros.filter((f) => /child_process/.test(fs.readFileSync(f, 'utf8'))).length;
ok(conHijos >= 15, `se revisan los ficheros que lanzan procesos (${conHijos} de ${ficheros.length})`);
ok(malos.length === 0, 'todas las llamadas a spawn/exec/execFile/fork llevan windowsHide: true', '\n      ' + malos.join('\n      '));

console.log('\n== Lo que lanzan otros por nosotros');
const pila = fs.readFileSync(path.join(PLAT, 'pruebas', 'pila.mjs'), 'utf8');
ok(/conVentanasOcultas\(\(\)\s*=>\s*pg\.initialise\(\)\)/.test(pila) && /conVentanasOcultas\(\(\)\s*=>\s*pg\.start\(\)\)/.test(pila), 'embedded-postgres arranca initdb y postgres con la ventana oculta (conVentanasOcultas)');
const procesos = fs.readFileSync(path.join(PLAT, 'pruebas', 'infra', 'procesos.mjs'), 'utf8');
const vigiaWin = procesos.match(/spawn\(process\.env\.ComSpec[^\n]*/)?.[0] ?? '';
ok(/detached:\s*false/.test(vigiaWin) && /windowsHide:\s*true/.test(vigiaWin), 'el vigía de Windows no va detached (si no, su node recibe una consola nueva y visible)', vigiaWin.slice(0, 120));
{
  const { conVentanasOcultas } = await import('./infra/procesos.mjs');
  const cp = (await import('node:child_process')).default;
  const visto = [];
  const original = cp.spawn;
  cp.spawn = (c, a, o) => { visto.push(o?.windowsHide); return { pid: 0 }; };
  try {
    await conVentanasOcultas(async () => { cp.spawn('x', [], { stdio: 'pipe' }); });
    cp.spawn('y', [], {});
  } finally { cp.spawn = original; }
  ok(visto[0] === true && visto[1] === undefined, 'conVentanasOcultas pone windowsHide solo mientras dura y lo deja como estaba', JSON.stringify(visto));
}

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
