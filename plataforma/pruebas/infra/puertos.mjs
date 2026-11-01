// Puertos de las pruebas (D149). Cada worktree de Maccabis tiene su bloque de 100 puertos en 22000-29999: lejos de los de
// Web TCPC (3000-3500, 4173, 5432) y de Supabase local (54321...), y por debajo de los que el sistema da a las conexiones
// salientes (Linux: 32768-60999; Windows: 49152-65535), que podrian caer en un puerto de la prueba. Dos worktrees pasan
// pruebas a la vez sin chocar.
// El bloque se reparte en 5 carriles de 20; `pruebas:completas` usa varios carriles a la vez (una suite por carril).
//
//   PRUEBAS_PUERTO_BASE   fija el bloque (p. ej. 25000) en vez de derivarlo de la carpeta del worktree
//   PRUEBAS_CARRIL        0-4 (lo pone el corredor; por defecto 0)
//   PRUEBAS_PUERTO_APP    otro puerto solo para la app (compatibilidad con lo de antes)
//
// Si un puerto que va a usar una prueba está ocupado, la prueba se para al momento con «puerto X ocupado por otro
// proceso»: nunca prueba contra lo que esté escuchando ahí (así llegó a probarse contra la app de Web TCPC en el 3100).
import crypto from 'node:crypto';
import net from 'node:net';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ranura = parseInt(crypto.createHash('sha1').update(REPO.toLowerCase()).digest('hex').slice(0, 8), 16) % 80;
export const BASE = Number(process.env.PRUEBAS_PUERTO_BASE) || 22000 + ranura * 100;
export const CARRIL = Math.min(4, Math.max(0, Number(process.env.PRUEBAS_CARRIL) || 0));
const b = BASE + CARRIL * 20;

/** Puertos de este carril. `app` y `app2` para webs; `aux(n)` (n = 0-9) para dobles de servicios (push, mapas, chat...). */
export const PUERTOS = {
  pasarela: b, pg: b + 1, rest: b + 2,
  app: Number(process.env.PRUEBAS_PUERTO_APP) || b + 3,
  app2: b + 4,
  aux: (n) => { if (!(n >= 0 && n <= 9)) throw new Error(`aux(${n}): solo hay 10 puertos auxiliares por carril`); return b + 10 + n; },
};

function escucha(puerto) {
  return new Promise((ok) => {
    const s = net.connect({ host: '127.0.0.1', port: puerto });
    const fin = (r) => { s.destroy(); ok(r); };
    s.setTimeout(700, () => fin(false));
    s.once('connect', () => fin(true));
    s.once('error', () => fin(false));
  });
}
function sePuedeAbrir(puerto) {
  return new Promise((ok) => {
    const srv = net.createServer();
    srv.once('error', () => ok(false));
    srv.listen({ port: puerto, host: '127.0.0.1', exclusive: true }, () => srv.close(() => ok(true)));
  });
}
/** Quién tiene el puerto (solo Windows; en Linux se deja sin nombre). */
function quien(puerto) {
  if (process.platform !== 'win32') return '';
  try {
    const linea = execFileSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8', windowsHide: true }).split(/\r?\n/)
      .find((l) => /LISTENING/.test(l) && new RegExp(`:${puerto}\\s`).test(l));
    const pid = linea?.trim().split(/\s+/).pop();
    if (!pid) return '';
    const exe = execFileSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true }).split(',')[0].replace(/"/g, '');
    return ` (PID ${pid}, ${exe})`;
  } catch { return ''; }
}

/** Comprueba que todos los puertos estén libres; si alguno no, para la prueba con un mensaje claro (código 3). */
export async function exigirLibres(puertos) {
  for (const [nombre, p] of Object.entries(puertos)) {
    if ((await escucha(p)) || !(await sePuedeAbrir(p))) {
      console.error(`\nPUERTO OCUPADO: puerto ${p} (${nombre}) ocupado por otro proceso${quien(p)}. La prueba se para sin usarlo.\n` +
        `  Si es de otro proyecto o de otra sesión, no lo cierres: usa otro bloque con PRUEBAS_PUERTO_BASE (p. ej. ${BASE >= 26000 ? BASE - 4000 : BASE + 4000}).\n` +
        `  Si es un resto de una prueba de este worktree: npm run pruebas:limpiar`);
      process.exit(3);
    }
  }
}
