#!/usr/bin/env node
// npm run pruebas:limpiar — quita lo que haya dejado una prueba de ESTE worktree (no deberia pasar: ver procesos.mjs).
// Solo toca procesos de este worktree:
//   - por carpeta: los que llevan en su linea de ordenes la carpeta de bases de este worktree (Postgres, PostgREST) o son
//     la app de pruebas en un puerto de su bloque (next start -p 22xxx-29xxx de este worktree; nunca un `next dev`);
//   - los Postgres de este worktree (su ejecutable) sin padre: el hijo `--forkchild` suspendido que queda en Windows
//     cuando muere el postmaster, que no lleva la carpeta en su linea de ordenes (matar.mjs);
//   - por puerto (Windows): lo que escucha en el bloque de este worktree, si es de este worktree. Si el puerto se
//     atribuye a un PID que ya no existe (un hijo heredo el socket), los hijos de ese PID que sean de este worktree.
// Nunca otros proyectos (Web TCPC), otros worktrees ni lo que no reconozca: lo dice y no lo toca. Una prueba de ESTE
// worktree que siga en marcha si se para (no lo lances mientras corre una).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { REPO, BASE } from './puertos.mjs';
import { matarArbol, pararPostgres, barrerPostgres, procesos, norm, BIN_PG } from './matar.mjs';

const PG = path.join(REPO, 'plataforma', 'pruebas', 'resultados', 'pg');
const pgDir = norm(PG) + '/', plat = norm(path.join(REPO, 'plataforma')) + '/', repo = norm(REPO) + '/';
const enBloque = (p) => p >= BASE && p < BASE + 100;
const appEnBloque = (cmd) => { const m = cmd.match(/next['"]?\s+start\s+-p\s+(\d+)/); return m && enBloque(Number(m[1])); };
const deEsteWorktree = (cmd) => norm(cmd).includes(repo);
const corto = (cmd) => cmd.replace(/\s+/g, ' ').slice(0, 140);

let parados = 0;
/** Postgres (postmaster con -D) se para con pg_ctl; lo demas, matando su arbol. */
function parar({ pid, cmd }, motivo) {
  console.log(`  parando ${pid} (${motivo}): ${corto(cmd)}`);
  const dir = !/--forkchild/.test(cmd) && norm(cmd).includes(norm(BIN_PG)) && cmd.match(/\s-D\s+(?:"([^"]+)"|(\S+))/);
  if (!(dir && pararPostgres(dir[1] || dir[2]))) matarArbol(pid);
  parados++;
}

// 1. Por carpeta
const todos = procesos().filter((p) => p.pid !== process.pid);
for (const p of todos) {
  const c = norm(p.cmd);
  if (c.includes(pgDir)) parar(p, 'carpeta de bases');
  else if (c.includes(plat) && appEnBloque(p.cmd)) parar(p, 'app de pruebas');
}

// 2. Postgres de este worktree sin padre
for (const p of barrerPostgres()) { console.log(`  parado ${p.pid} (Postgres sin padre): ${corto(p.cmd)}`); parados++; }

// 3. Por puerto (Windows: netstat da el PID de cada puerto que escucha)
if (process.platform === 'win32') {
  const escuchan = new Map();
  for (const l of execFileSync('netstat', ['-ano'], { encoding: 'utf8', windowsHide: true }).split(/\r?\n/)) {
    const m = l.trim().match(/^TCP\s+\S*:(\d+)\s+\S+\s+LISTENING\s+(\d+)$/);
    if (m && enBloque(Number(m[1]))) escuchan.set(Number(m[1]), Number(m[2]));
  }
  const ahora = procesos().filter((p) => p.pid !== process.pid);
  const porPid = new Map(ahora.map((p) => [p.pid, p]));
  for (const [puerto, pid] of escuchan) {
    const duenio = porPid.get(pid);
    if (duenio) {
      if (deEsteWorktree(duenio.cmd)) parar(duenio, `puerto ${puerto}`);
      else console.log(`  puerto ${puerto}: lo tiene ${pid} (${corto(duenio.cmd) || 'sin linea de ordenes'}), no es de este worktree: no se toca`);
      continue;
    }
    // PID muerto: el socket lo tiene algun hijo que lo heredo
    const hijos = ahora.filter((p) => p.ppid === pid);
    const nuestros = hijos.filter((p) => deEsteWorktree(p.cmd));
    for (const h of nuestros) parar(h, `puerto ${puerto}, heredado de ${pid}`);
    if (!nuestros.length) console.log(`  puerto ${puerto}: atribuido a ${pid}, que ya no existe, sin hijos de este worktree: no se toca`);
  }
}

// 4. Registros (procesos.mjs) de pruebas de este worktree que ya no existen: solo se borran sus carpetas y el registro;
//    sus PIDs no se matan (Windows puede haberlos dado ya a otro programa).
const vivo = (p) => { try { process.kill(p, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
for (const f of fs.readdirSync(os.tmpdir()).filter((f) => /^maccabis-pruebas-\d+\.json$/.test(f))) {
  const fichero = path.join(os.tmpdir(), f);
  let r; try { r = JSON.parse(fs.readFileSync(fichero, 'utf8')); } catch { continue; }
  const dirs = [...(r.dirs || []), ...(r.pg || [])];
  if (vivo(Number(f.match(/\d+/)[0])) || !dirs.length || !dirs.every((d) => norm(d).startsWith(pgDir))) continue;
  for (const d of dirs) { try { fs.rmSync(d, { recursive: true, force: true, maxRetries: 5 }); } catch {} }
  try { fs.rmSync(fichero, { force: true }); console.log(`  registro viejo borrado: ${f}`); } catch {}
}

// 5. Carpetas de base
let carpetas = 0;
if (fs.existsSync(PG)) for (const d of fs.readdirSync(PG)) { try { fs.rmSync(path.join(PG, d), { recursive: true, force: true, maxRetries: 5 }); carpetas++; } catch { console.log(`  no se puede borrar ${d} (¿en uso por una prueba que sigue en marcha?)`); } }
console.log(`${parados} proceso(s) parados y ${carpetas} carpeta(s) de base borradas (bloque de puertos ${BASE}-${BASE + 99}).`);
