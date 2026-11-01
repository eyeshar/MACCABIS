// Que ninguna prueba deje procesos ni bases encendidas (D149), tambien si falla, se interrumpe (Ctrl+C) o la matan.
//   - Cada proceso hijo (Postgres, PostgREST, la app) y cada carpeta de base se apuntan aqui.
//   - Al salir el proceso de la prueba (bien, con error o con Ctrl+C): cada Postgres se para con pg_ctl (nunca matando
//     el postmaster: en Windows deja hijos suspendidos, ver matar.mjs), el resto se mata con su arbol, se barren los
//     restos de Postgres de este worktree sin padre y se borran las carpetas.
//   - Si la matan de golpe (TaskStop, cerrar la ventana, el corredor con taskkill /T), un vigia aparte ve que ya no esta
//     y hace lo mismo. En Windows el vigia se lanza fuera del arbol de la prueba: si no, taskkill /T se lo llevaba.
//   - Ningun hijo abre ventana de consola en Windows (windowsHide; pruebas:procesos lo comprueba).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cp, { spawn } from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { matarArbol, limpiarRegistro } from './matar.mjs';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const registro = { pids: [], dirs: [], pg: [] };
const FICHERO = path.join(os.tmpdir(), `maccabis-pruebas-${process.pid}.json`);
let vigia = null;

function guardar() {
  fs.writeFileSync(FICHERO, JSON.stringify(registro));
  if (!vigia) {
    const args = [path.join(AQUI, 'vigia.mjs'), String(process.pid), FICHERO];
    // Windows: `start /b` desde un cmd que termina al momento; el vigia queda con el padre muerto, fuera del arbol. El cmd
    // NO va detached: con DETACHED_PROCESS no tiene consola y el node del vigia recibia una nueva, visible (una ventana
    // vacia de node.exe durante toda la prueba). Sin detached y con windowsHide, el cmd tiene una consola oculta propia
    // que el vigia comparte; Ctrl+C en la consola de la prueba no le llega igual que antes.
    vigia = process.platform === 'win32'
      ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `"start "" /b ${[process.execPath, ...args].map((a) => `"${a}"`).join(' ')}"`], { detached: false, stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: true })
      : spawn(process.execPath, args, { detached: true, stdio: 'ignore', windowsHide: true });
    vigia.unref();
  }
}

export { matarArbol };

/** Apunta un proceso hijo. En cuanto termina se borra del registro: nunca se mata un PID que Windows ya haya dado a otro. */
export function apuntarProceso(hijo) {
  if (!hijo?.pid) return hijo;
  const pid = hijo.pid;
  registro.pids.push(pid); guardar();
  hijo.once('exit', () => olvidarProceso(pid));
  return hijo;
}
export function apuntarCarpeta(dir) { registro.dirs.push(dir); guardar(); return dir; }
export function olvidarProceso(pid) { if (registro.pids.includes(pid)) { registro.pids = registro.pids.filter((p) => p !== pid); guardar(); } }
export function olvidarCarpeta(dir) { registro.dirs = registro.dirs.filter((d) => d !== dir); guardar(); }
/** Carpeta de un Postgres: al salir se para con pg_ctl. Se apunta ANTES de arrancarlo (si la prueba muere mientras
 *  arranca, su PID aun no esta apuntado, pero pg_ctl lo encuentra por la carpeta). */
export function apuntarPostgres(dir) { registro.pg.push(dir); guardar(); return dir; }
export function olvidarPostgres(dir) { registro.pg = registro.pg.filter((d) => d !== dir); guardar(); }

/** Lanza un proceso apuntado (en Linux, con su propio grupo para poder matar el arbol). */
export function lanzar(cmd, args, opciones = {}) {
  return apuntarProceso(spawn(cmd, args, { ...opciones, detached: process.platform !== 'win32', windowsHide: true }));
}

/** Ejecuta `fn` con `windowsHide: true` en todo `spawn` de child_process que se haga mientras dura (para librerias que
 *  no lo ponen, como embedded-postgres con initdb y postgres). Al terminar, `spawn` vuelve a ser el de siempre. */
export async function conVentanasOcultas(fn) {
  const original = cp.spawn;
  cp.spawn = function spawnOculto(cmd, args, opciones) {
    return Array.isArray(args) ? original.call(cp, cmd, args, { ...opciones, windowsHide: true }) : original.call(cp, cmd, { ...args, windowsHide: true });
  };
  syncBuiltinESMExports();
  try { return await fn(); } finally { cp.spawn = original; syncBuiltinESMExports(); }
}

function limpiarTodo() {
  const r = { pg: registro.pg.splice(0), pids: registro.pids.splice(0), dirs: registro.dirs.splice(0) };
  limpiarRegistro(r);
  try { fs.rmSync(FICHERO, { force: true }); } catch {}
}
// Delante de los de async-exit-hook (embedded-postgres): Postgres se para con pg_ctl antes que nada.
process.prependListener('exit', limpiarTodo);
// embedded-postgres usa async-exit-hook, que al vaciarse el bucle (beforeExit) sale con process.exit(0) y pisa
// process.exitCode: una suite que marca el fallo asi (npm run pruebas, pruebas:dudas) salia con 0 aunque fallara. Este
// va antes y sale con el codigo que haya puesto la suite.
process.prependListener('beforeExit', () => process.exit(process.exitCode ?? 0));
for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
  try { process.prependListener(s, () => { console.error(`\nInterrumpida (${s}): parando la pila y la app...`); process.exit(130); }); } catch {}
}
