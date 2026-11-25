#!/usr/bin/env node
// Qué node cuenta como huérfano de Maccabis para `pruebas:limpiar` (D202, infra/huerfanos.mjs), con listas de procesos
// inventadas (lógica pura: no lanza ni mata nada). Los casos salen de lo visto el 25/11/2026: la espera de ci:estado
// que sobrevivió a su consola (huérfana), un next start de otro proyecto (no es nuestro), una sesión de Claude viva con
// sus servidores y pruebas (no se toca), la rutina A desde el Programador de tareas (no se toca).
//
//   npm run pruebas:huerfanos
// vigila: pruebas/infra/limpiar.mjs
// vigila: pruebas/infra/huerfanos.mjs
import fs from 'node:fs';
import { nodesHuerfanos, esNodeMaccabis, sesionesClaude } from './infra/huerfanos.mjs';

let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };
const RAIZ = 'C:\\Users\\Ana\\Proyectos';
const M = {
  carpetas: [`${RAIZ}\\Maccabis`, `${RAIZ}\\Maccabis-tema`],
  ordenes: new Set(['ci:estado', 'pruebas:rapidas', 'jornada']),
  existe: (rel) => ['scripts/ci_estado.mjs', 'pruebas/rls_eventos_real.mjs'].includes(rel),
};
const NPM = '"F:\\node\\node.exe" "F:\\node\\node_modules\\npm\\bin\\npm-cli.js"';
// Árbol fijo del sistema: wininit (su padre ya no existe) > services > svchost; explorer (su padre tampoco).
const base = [
  { pid: 10, ppid: 4, t: 1, cmd: 'wininit.exe' },
  { pid: 11, ppid: 10, t: 2, cmd: 'C:\\WINDOWS\\system32\\services.exe' },
  { pid: 12, ppid: 11, t: 3, cmd: 'C:\\WINDOWS\\system32\\svchost.exe -k netsvcs' },
  { pid: 20, ppid: 2, t: 4, cmd: 'C:\\WINDOWS\\Explorer.EXE' },
  { pid: 21, ppid: 12, t: 5, cmd: '"C:\\Program Files\\WindowsApps\\Microsoft.WindowsTerminal\\WindowsTerminal.exe"' },
  { pid: 22, ppid: 21, t: 6, cmd: 'powershell.exe' },
  { pid: 23, ppid: 22, t: 7, cmd: 'C:\\Users\\Ana\\.local\\bin\\claude.exe' },
];
const pids = (l) => nodesHuerfanos([...base, ...l], M).map((x) => x.pid).sort((a, b) => a - b).join(',');

console.log('\n== Qué es de Maccabis');
ok(esNodeMaccabis(`"F:\\node\\node.exe" ${RAIZ}\\Maccabis-tema\\plataforma\\node_modules\\next\\dist\\bin\\next start -p 27800`, M), 'next start de un worktree de Maccabis (la ruta en la línea de órdenes)');
ok(esNodeMaccabis('node scripts/ci_estado.mjs --esperar', M), 'node con un script relativo que existe en Maccabis');
ok(esNodeMaccabis(`${NPM} run -s ci:estado -- --esperar`, M), 'npm run de una orden de Maccabis');
ok(!esNodeMaccabis(`"node" "C:\\Users\\Ana\\Proyectos\\Web-TCPC-wt\\apps\\web\\node_modules\\.bin\\..\\next\\dist\\bin\\next" start -p 3107`, M), 'NO: next start de Web TCPC');
ok(!esNodeMaccabis(`${NPM} run dev`, M), 'NO: npm run dev (genérico, puede ser de cualquiera)');
ok(!esNodeMaccabis(`"node" "C:\\Users\\Ana\\AppData\\Local\\npm-cache\\_npx\\x\\node_modules\\@playwright\\mcp\\cli.js"`, M), 'NO: un servidor MCP');
ok(!esNodeMaccabis(`${RAIZ}\\Maccabis\\plataforma\\node_modules\\@embedded-postgres\\windows-x64\\native\\bin\\postgres.exe -D x`, M), 'NO: Postgres (lo trata aparte limpiar.mjs)');
ok(!esNodeMaccabis(`node ${RAIZ}\\Maccabistas\\x.mjs`, M), 'NO: otra carpeta que solo empieza igual');

console.log('\n== Qué es huérfano');
// 25/11: bash (padre muerto) > bash > npm run ci:estado > cmd > node ci_estado
const ci = [
  { pid: 100, ppid: 99, t: 50, cmd: '/usr/bin/bash' },
  { pid: 101, ppid: 100, t: 51, cmd: '/usr/bin/bash -c npm run -s ci:estado' },
  { pid: 102, ppid: 101, t: 52, cmd: `${NPM} run -s ci:estado -- --esperar` },
  { pid: 103, ppid: 102, t: 53, cmd: 'C:\\WINDOWS\\system32\\cmd.exe /d /s /c node scripts/ci_estado.mjs --esperar' },
  { pid: 104, ppid: 103, t: 54, cmd: 'node scripts/ci_estado.mjs --esperar' },
];
ok(pids(ci) === '102', 'la espera de ci:estado sin su consola: huérfana, y solo el de arriba (su árbol se lleva al otro)', pids(ci));
const viva = ci.map((p) => (p.pid === 100 ? { ...p, ppid: 23 } : p));
ok(pids(viva) === '', 'la misma, con la sesión de Claude viva: no se toca', pids(viva));
const tarea = [{ pid: 200, ppid: 12, t: 60, cmd: 'powershell.exe -File scripts\\rutina_a_publicar.ps1' }, { pid: 201, ppid: 200, t: 61, cmd: `${NPM} run jornada -- --no-interactivo` }];
ok(pids(tarea) === '', 'la rutina A lanzada por el Programador de tareas (svchost): no se toca', pids(tarea));
const ajeno = [{ pid: 300, ppid: 298, t: 70, cmd: '/usr/bin/bash' }, { pid: 301, ppid: 300, t: 71, cmd: `"node" "C:\\Users\\Ana\\Proyectos\\Web-TCPC-wt\\apps\\web\\node_modules\\next\\dist\\bin\\next" start -p 3107` }];
ok(pids(ajeno) === '', 'un next start huérfano de Web TCPC: no es nuestro, no se toca', pids(ajeno));
const reusado = [{ pid: 400, ppid: 401, t: 80, cmd: `node ${RAIZ}\\Maccabis\\plataforma\\pruebas\\pila.mjs` }, { pid: 401, ppid: 20, t: 90, cmd: 'notepad.exe' }];
ok(pids(reusado) === '400', 'su padre murió y Windows dio el PID a otro programa (más nuevo): huérfano', pids(reusado));
const terminal = [{ pid: 500, ppid: 22, t: 100, cmd: `${NPM} run pruebas:rapidas` }, { pid: 501, ppid: 500, t: 101, cmd: 'node pruebas/rls_eventos_real.mjs' }];
ok(pids(terminal) === '', 'unas pruebas lanzadas a mano desde una terminal abierta: no se tocan', pids(terminal));

console.log('\n== Sesiones de Claude Code (D204): solo se listan, marcando la actual');
// 23: la del árbol fijo (claude nativo de ~/.local/bin) en una pestaña de Windows Terminal; dentro, la terminal de sus
// herramientas (700, el que pregunta) y un claude anidado (900, no cuenta aparte). 600: otra, instalada con npm, en otra
// pestaña, con sus MCP (el npx y el servidor). 800: una cuya terminal ya se cerró. 950: la aplicación de escritorio.
const CC = '"C:\\Users\\Ana\\AppData\\Roaming\\npm\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe" --dangerously-skip-permissions';
const ses = [
  { pid: 700, ppid: 23, t: 200, cmd: 'powershell.exe -NoProfile -NonInteractive', mem: 1 },
  { pid: 900, ppid: 23, t: 201, cmd: CC, mem: 1 },
  { pid: 601, ppid: 21, t: 110, cmd: 'powershell.exe', mem: 0 },
  { pid: 600, ppid: 601, t: 111, cmd: CC, mem: 300 * 2 ** 20 },
  { pid: 602, ppid: 600, t: 112, cmd: 'C:\\WINDOWS\\system32\\cmd.exe /d /s /c "npx ^"@playwright/mcp@latest^""', mem: 0 },
  { pid: 603, ppid: 602, t: 113, cmd: '"F:\\node\\node.exe" "F:\\node\\node_modules\\npm\\bin\\npx-cli.js" "@playwright/mcp@latest"', mem: 0 },
  { pid: 604, ppid: 603, t: 114, cmd: '"node" "C:\\Users\\Ana\\AppData\\Local\\npm-cache\\_npx\\x\\node_modules\\@playwright\\mcp\\cli.js"', mem: 100 * 2 ** 20 },
  { pid: 800, ppid: 799, t: 120, cmd: CC, mem: 0 },
  { pid: 950, ppid: 20, t: 130, cmd: '"C:\\Program Files\\WindowsApps\\Claude_6.1_x64__x\\app\\claude.exe"', mem: 0 },
];
const s = sesionesClaude([...base, ...ses], 700, new Set([21]));
const de = (pid) => s.find((x) => x.pid === pid);
ok(s.map((x) => x.pid).join(',') === '23,600,800', 'tres sesiones, por fecha: sin la aplicación de escritorio ni la anidada', s.map((x) => x.pid).join(','));
ok(de(23)?.actual && !de(600)?.actual && !de(800)?.actual, 'la actual es la que tiene en su cadena al que pregunta (y solo esa)');
ok(de(23)?.terminal?.nombre === 'Windows Terminal' && de(23).terminal.pid === 21 && de(23).terminal.ventana === true && de(23).padre?.nombre === 'powershell.exe', 'de qué cuelga: su pestaña (powershell) de Windows Terminal, con ventana visible', JSON.stringify(de(23)));
ok(de(800)?.terminal === null && de(800)?.padre === null, 'la de la terminal cerrada: sin padre ni terminal viva', JSON.stringify(de(800)));
ok(de(600)?.mcp.map((m) => m.pid).join(',') === '604' && Math.round(de(600).mem / 2 ** 20) === 400, 'sus MCP (el servidor, no el npx) y la memoria con todo lo que cuelga', JSON.stringify(de(600)));
const sinVentana = sesionesClaude([...base, ...ses], 700, new Set());
ok(sinVentana.find((x) => x.pid === 600)?.terminal?.ventana === false, 'sin ventana visible, lo dice');
// Nunca se cierra una sesión: lo que lista no pasa por parar() ni por matarArbol() (comprobado en el código de limpiar.mjs).
const fuente = fs.readFileSync(new URL('./infra/limpiar.mjs', import.meta.url), 'utf8');
const cuerpo = fuente.slice(fuente.indexOf('function listarSesiones'), fuente.indexOf('\n}\n', fuente.indexOf('function listarSesiones')));
ok(cuerpo.length > 100 && !/parar\(|matarArbol|\.kill\(|taskkill|Stop-Process/.test(cuerpo), 'limpiar.mjs solo las lista: nada que las pare en listarSesiones()');
ok((fuente.match(/sesionesClaude\(/g) ?? []).length === 1, 'y sesionesClaude() solo se usa ahí');

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
