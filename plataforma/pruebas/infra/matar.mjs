// Matar un proceso con todo su arbol, de forma sincrona (sirve dentro de process.on('exit')), y parar Postgres sin dejar
// hijos colgados.
//
// Por que Postgres aparte (Windows): el postmaster crea cada hijo (`postgres.exe --forkchild="backend" ...`) SUSPENDIDO,
// le pasa sus parametros y luego lo reanuda. Si se le mata con TerminateProcess (taskkill /F, que es lo que hacian
// embedded-postgres y este fichero) justo en ese momento, el hijo se queda suspendido para siempre: hereda el socket del
// puerto (netstat lo sigue atribuyendo al PID muerto), tiene la carpeta de la base abierta y, como su padre ya no
// existe, ni `taskkill /T` llega a el ni su linea de ordenes lleva la carpeta. Medido: 9 de 30 veces matando el
// postmaster con conexiones entrando; 0 de 30 con `pg_ctl stop`, que hace que el propio postmaster cierre a sus hijos.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PLAT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SO = { win32: 'windows', linux: 'linux', darwin: 'darwin' }[process.platform] || process.platform;
/** Binarios de Postgres de ESTE worktree (cada worktree tiene su node_modules): sirven para reconocer sus procesos. */
export const BIN_PG = path.join(PLAT, 'node_modules', '@embedded-postgres', `${SO}-${process.arch}`, 'native', 'bin');
const PG_CTL = path.join(BIN_PG, process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl');
export const norm = (s) => String(s || '').replace(/\\/g, '/').toLowerCase();

export function matarArbol(pid) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    else { try { process.kill(-pid, 'SIGKILL'); } catch { process.kill(pid, 'SIGKILL'); } }
  } catch { /* ya no estaba */ }
}

/** Para el Postgres de una carpeta con `pg_ctl stop` (el postmaster cierra a sus hijos y espera a que acaben). Devuelve
 *  true si lo paro; false si no habia ninguno o no pudo (entonces el que llama lo mata y barre). */
export function pararPostgres(dir) {
  const fichero = path.join(dir || '', 'postmaster.pid');
  let pid; try { pid = Number(fs.readFileSync(fichero, 'utf8').split(/\r?\n/)[0]); } catch { return false; }
  if (!vivo(pid) || !fs.existsSync(PG_CTL)) return false;
  try { execFileSync(PG_CTL, ['stop', '-D', dir, '-m', 'immediate', '-W'], { stdio: 'ignore', windowsHide: true }); } catch { return false; }
  // Sin `pg_ctl -w`: espera a que se borre postmaster.pid y, si el postmaster muere sin borrarlo (lo estaban matando a
  // la vez), esperaria sus 15 s enteros. Aqui se acaba tambien en cuanto el postmaster ya no existe.
  for (let i = 0; i < 150 && fs.existsSync(fichero); i++) { if (!vivo(pid)) return !fs.existsSync(fichero); dormir(100); }
  return !fs.existsSync(fichero);
}
const vivo = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const dormir = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** Procesos del sistema: { pid, ppid, t (creacion; para no confundir un PID reutilizado), cmd }. */
export function procesos() {
  if (process.platform === 'win32') {
    const orden = '[Console]::OutputEncoding = [Text.Encoding]::UTF8; ConvertTo-Json -Compress -InputObject @(Get-CimInstance Win32_Process | ' +
      "Select-Object ProcessId,ParentProcessId,@{n='t';e={if ($_.CreationDate) { $_.CreationDate.ToFileTimeUtc() } else { 0 }}},CommandLine)";
    const salida = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', orden], { encoding: 'utf8', maxBuffer: 1e8, windowsHide: true });
    return JSON.parse(salida).map((p) => ({ pid: p.ProcessId, ppid: p.ParentProcessId, t: p.t || 0, cmd: p.CommandLine || '' }));
  }
  return execFileSync('ps', ['-eo', 'pid=,ppid=,args='], { encoding: 'utf8', windowsHide: true }).split('\n').filter(Boolean)
    .map((l) => { const m = l.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/); return { pid: Number(m[1]), ppid: Number(m[2]), t: 0, cmd: m[3] }; });
}

/** Huerfano: su padre ya no existe (o el PID del padre lo tiene ahora otro proceso, creado despues que el). */
export function huerfano(p, porPid) {
  const padre = porPid.get(p.ppid);
  return !padre || p.ppid <= 1 || (padre.t && p.t && padre.t > p.t);
}

/** Deja limpio lo apuntado por una prueba (procesos.mjs al salir; vigia.mjs si murio de golpe): { pg, pids, dirs }. */
export function limpiarRegistro(r) {
  // Si alguno no se pudo parar con pg_ctl (su postmaster ya no estaba o no respondio: queda postmaster.pid), se barren
  // sus restos despues de matar. Si se paro bien no hace falta (el barrido cuesta ~1 s en Windows).
  const barrer = (r.pg || []).filter((d) => !pararPostgres(d) && fs.existsSync(path.join(d, 'postmaster.pid'))).length > 0;
  for (const pid of r.pids || []) matarArbol(pid);
  if (barrer) { try { barrerPostgres(); } catch {} }
  for (const d of r.dirs || []) { try { fs.rmSync(d, { recursive: true, force: true, maxRetries: 10 }); } catch {} }
}

/** Restos de Postgres de ESTE worktree (su ejecutable) que ya no tienen padre: un postmaster cuya prueba murio (se para
 *  con pg_ctl) o un hijo suspendido cuyo postmaster murio (se mata: no tiene hijos). Los de una prueba en marcha tienen
 *  el padre vivo y no se tocan; los de otros worktrees llevan otro ejecutable. Devuelve lo que paro. */
export function barrerPostgres() {
  const bin = norm(BIN_PG) + '/';
  const parados = [];
  for (let vuelta = 0; vuelta < 3; vuelta++) {
    const todos = procesos();
    const porPid = new Map(todos.map((p) => [p.pid, p]));
    const restos = todos.filter((p) => p.pid !== process.pid && norm(p.cmd).includes(bin) && huerfano(p, porPid));
    if (!restos.length) break;
    for (const p of restos) {
      const dir = !/--forkchild/.test(p.cmd) && p.cmd.match(/\s-D\s+(?:"([^"]+)"|(\S+))/);
      if (!(dir && pararPostgres(dir[1] || dir[2]))) matarArbol(p.pid);
      parados.push(p);
    }
  }
  return parados;
}
