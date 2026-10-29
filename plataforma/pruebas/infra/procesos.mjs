// Que ninguna prueba deje procesos ni bases encendidas (D150), tambien si falla, se interrumpe (Ctrl+C) o la matan.
//   - Cada proceso hijo (Postgres, PostgREST, la app) y cada carpeta de base se apuntan aqui.
//   - Al salir el proceso de la prueba (bien, con error o con Ctrl+C) se matan con su arbol y se borran las carpetas.
//   - Si la matan de golpe (TaskStop, cerrar la ventana), un vigia aparte ve que ya no esta y hace lo mismo.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { matarArbol } from './matar.mjs';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const registro = { pids: [], dirs: [] };
const FICHERO = path.join(os.tmpdir(), `maccabis-pruebas-${process.pid}.json`);
let vigia = null;

function guardar() {
  fs.writeFileSync(FICHERO, JSON.stringify(registro));
  if (!vigia) {
    vigia = spawn(process.execPath, [path.join(AQUI, 'vigia.mjs'), String(process.pid), FICHERO], { detached: true, stdio: 'ignore', windowsHide: true });
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

/** Arranca un proceso apuntado (en Linux, con su propio grupo para poder matar el arbol). */
export function lanzar(cmd, args, opciones = {}) {
  return apuntarProceso(spawn(cmd, args, { ...opciones, detached: process.platform !== 'win32', windowsHide: true }));
}

function limpiarTodo() {
  for (const pid of registro.pids.splice(0)) matarArbol(pid);
  for (const d of registro.dirs.splice(0)) { try { fs.rmSync(d, { recursive: true, force: true, maxRetries: 5 }); } catch {} }
  try { fs.rmSync(FICHERO, { force: true }); } catch {}
}
process.on('exit', limpiarTodo);
for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
  try { process.on(s, () => { console.error(`\nInterrumpida (${s}): parando la pila y la app...`); process.exit(130); }); } catch {}
}
