#!/usr/bin/env node
// npm run pruebas:limpiar — quita lo que haya dejado una prueba de ESTE worktree (no deberia pasar: ver procesos.mjs).
// Solo toca procesos cuya linea de ordenes lleva la carpeta de bases de este worktree (Postgres, PostgREST) o que son
// la app de pruebas en un puerto de su bloque (next start -H 127.0.0.1 -p 22xxx-29xxx de este worktree). Nunca otros
// proyectos (Web TCPC), otros worktrees ni un `next dev`.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { REPO, BASE } from './puertos.mjs';
import { matarArbol } from './matar.mjs';

const PG = path.join(REPO, 'plataforma', 'pruebas', 'resultados', 'pg');
const procesos = () => {
  if (process.platform === 'win32') {
    const salida = execFileSync('powershell', ['-NoProfile', '-Command', 'Get-CimInstance Win32_Process | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress'], { encoding: 'utf8', maxBuffer: 1e8 });
    return JSON.parse(salida).map((p) => ({ pid: p.ProcessId, cmd: p.CommandLine || '' }));
  }
  return execFileSync('ps', ['-eo', 'pid=,args='], { encoding: 'utf8' }).split('\n').filter(Boolean).map((l) => { const m = l.trim().match(/^(\d+)\s+(.*)$/); return { pid: Number(m[1]), cmd: m[2] }; });
};
const norm = (s) => s.replace(/\\/g, '/').toLowerCase();
const pgDir = norm(PG), plat = norm(path.join(REPO, 'plataforma'));
const enBloque = (cmd) => { const m = cmd.match(/next['"]?\s+start\s+-p\s+(\d+)/); return m && Number(m[1]) >= BASE && Number(m[1]) < BASE + 100; };
const restos = procesos().filter(({ pid, cmd }) => pid !== process.pid && (norm(cmd).includes(pgDir) || (norm(cmd).includes(plat) && enBloque(cmd))));
for (const { pid, cmd } of restos) { console.log(`  parando ${pid}: ${cmd.slice(0, 140)}`); matarArbol(pid); }
let carpetas = 0;
if (fs.existsSync(PG)) for (const d of fs.readdirSync(PG)) { try { fs.rmSync(path.join(PG, d), { recursive: true, force: true, maxRetries: 3 }); carpetas++; } catch { console.log(`  no se puede borrar ${d} (¿en uso por una prueba que sigue en marcha?)`); } }
console.log(`${restos.length} proceso(s) parados y ${carpetas} carpeta(s) de base borradas (bloque de puertos ${BASE}-${BASE + 99}).`);
