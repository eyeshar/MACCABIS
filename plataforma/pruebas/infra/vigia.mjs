// Vigia de una prueba (lo arranca procesos.mjs, desacoplado): cuando el proceso de la prueba ya no existe, mata lo que
// dejo apuntado y borra sus carpetas. Asi no quedan Postgres, PostgREST ni apps aunque la prueba muera de golpe.
//   node vigia.mjs <pid de la prueba> <fichero de registro>
import fs from 'node:fs';
import { matarArbol } from './matar.mjs';

const [pid, fichero] = [Number(process.argv[2]), process.argv[3]];
const vivo = (p) => { try { process.kill(p, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const t = setInterval(() => {
  if (vivo(pid)) return;
  clearInterval(t);
  let r = { pids: [], dirs: [] };
  try { r = JSON.parse(fs.readFileSync(fichero, 'utf8')); } catch { process.exit(0); } // salio bien: ya limpio y borro el registro
  for (const p of r.pids) matarArbol(p);
  setTimeout(() => {
    for (const d of r.dirs) { try { fs.rmSync(d, { recursive: true, force: true, maxRetries: 10 }); } catch {} }
    try { fs.rmSync(fichero, { force: true }); } catch {}
    process.exit(0);
  }, 1500);
}, 1000);
