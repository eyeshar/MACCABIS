// Vigia de una prueba (lo arranca procesos.mjs, desacoplado y, en Windows, fuera de su arbol): cuando el proceso de la
// prueba ya no existe, para lo que dejo apuntado (Postgres con pg_ctl, el resto matando su arbol), barre los restos de
// Postgres de este worktree y borra sus carpetas. Asi no quedan Postgres, PostgREST ni apps aunque la prueba muera de golpe.
//   node vigia.mjs <pid de la prueba> <fichero de registro>
import fs from 'node:fs';
import { limpiarRegistro } from './matar.mjs';

// Ctrl+C en la consola es para la prueba (que limpia sola), no para el vigia.
for (const s of ['SIGINT', 'SIGBREAK', 'SIGHUP']) { try { process.on(s, () => {}); } catch {} }
const [pid, fichero] = [Number(process.argv[2]), process.argv[3]];
const vivo = (p) => { try { process.kill(p, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const t = setInterval(() => {
  if (vivo(pid)) return;
  clearInterval(t);
  let r;
  try { r = JSON.parse(fs.readFileSync(fichero, 'utf8')); } catch { process.exit(0); } // salio bien: ya limpio y borro el registro
  limpiarRegistro(r);
  try { fs.rmSync(fichero, { force: true }); } catch {}
  process.exit(0);
}, 1000);
