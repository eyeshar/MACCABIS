// Procesos node HUÉRFANOS de Maccabis (D202): los que quedan vivos cuando su sesión ya se cerró. Caso del 25/11/2026: una
// espera de `ci:estado -- --esperar` en segundo plano que se cortó por falta de memoria; murió la consola, pero npm y
// node siguieron. Lo usa `npm run pruebas:limpiar` (limpiar.mjs). Lógica pura (recibe la lista de procesos) para poder
// probarla sin procesos de verdad: pruebas:huerfanos.
//
// Huérfano = subiendo por sus padres, la cadena se corta (un padre que ya no existe) antes de llegar a algo que sigue
// abierto a propósito: el escritorio, una terminal, una sesión de Claude o VS Code, el Programador de tareas (la rutina
// A) o un servicio. Una prueba en marcha desde una sesión viva NUNCA es huérfana: su cadena llega a esa sesión.
// De Maccabis = node cuya línea de órdenes nombra una carpeta de Maccabis (Maccabis, Maccabis-<tema>), un script
// relativo que existe en una de ellas, o `npm run <orden>` de un package.json de Maccabis (nada genérico: dev, build…).
import fs from 'node:fs';
import path from 'node:path';
import { norm, huerfano } from './matar.mjs';

/** Lo que se queda abierto a propósito: si la cadena llega aquí, no es huérfano. */
export const ANCLA = /(^|[\\/"\s])(explorer|windowsterminal|openconsole|conhost|claude|code|cursor|sihost|winlogon|wininit|services|svchost|taskhostw|taskeng|powershell_ise)\.exe/i;
const GENERICAS = new Set(['dev', 'build', 'start', 'test', 'lint', 'install', 'ci']);

/** Las carpetas de Maccabis junto a esta (la principal y sus worktrees) y las órdenes de sus package.json. */
export function carpetasMaccabis(repo) {
  const padre = path.dirname(repo);
  const carpetas = fs.readdirSync(padre, { withFileTypes: true }).filter((d) => d.isDirectory() && /^maccabis(-.+)?$/i.test(d.name)).map((d) => path.join(padre, d.name));
  const ordenes = new Set();
  for (const c of carpetas) for (const pj of [path.join(c, 'package.json'), path.join(c, 'plataforma', 'package.json')]) {
    try { for (const k of Object.keys(JSON.parse(fs.readFileSync(pj, 'utf8')).scripts ?? {})) if (!GENERICAS.has(k)) ordenes.add(k); } catch { /* sin package.json */ }
  }
  return { carpetas, ordenes, existe: (rel) => carpetas.some((c) => fs.existsSync(path.join(c, rel)) || fs.existsSync(path.join(c, 'plataforma', rel))) };
}

/** ¿Es un node de Maccabis? `m` = carpetasMaccabis(...) (o su doble en la prueba). */
export function esNodeMaccabis(cmd, m) {
  const c = norm(cmd);
  if (!/(^|[\\/"\s])node(\.exe)?"?(\s|$)/.test(c)) return false;
  if (m.carpetas.some((d) => c.includes(norm(d) + '/') || c.includes(norm(d) + '"') || c.endsWith(norm(d)))) return true;
  const rel = c.match(/(?:^|\s|")((?:\.\.\/|\.\/)?(?:pruebas|scripts|plataforma)\/[\w./-]+\.(?:mjs|cjs|js|ts))/);
  if (rel && m.existe(rel[1])) return true;
  const run = c.match(/npm-cli\.js"?\s+run(?:-script)?\s+(?:-s\s+|--silent\s+)?([\w:.-]+)/);
  return Boolean(run && m.ordenes.has(run[1]));
}

/**
 * De una lista de procesos ({ pid, ppid, t, cmd }), los node de Maccabis huérfanos, sin repetir: si un huérfano cuelga de
 * otro también huérfano, solo el de arriba (matar su árbol se lleva al otro). Devuelve [{ pid, cmd, raiz }].
 */
export function nodesHuerfanos(lista, m) {
  const porPid = new Map(lista.map((p) => [p.pid, p]));
  const sinSesion = (p) => {
    for (let x = p, n = 0; x && n < 40; n++) {
      if (ANCLA.test(x.cmd)) return null;
      if (huerfano(x, porPid)) return x;   // la cadena se corta aquí sin llegar a una sesión
      x = porPid.get(x.ppid);
    }
    return null;
  };
  const elegidos = lista.filter((p) => esNodeMaccabis(p.cmd, m)).map((p) => ({ p, raiz: sinSesion(p) })).filter((x) => x.raiz);
  const ids = new Set(elegidos.map((x) => x.p.pid));
  const deArriba = elegidos.filter(({ p }) => {
    for (let x = porPid.get(p.ppid), n = 0; x && n < 40; x = porPid.get(x.ppid), n++) if (ids.has(x.pid)) return false;
    return true;
  });
  return deArriba.map(({ p, raiz }) => ({ pid: p.pid, cmd: p.cmd, raiz: raiz.pid === p.pid ? null : raiz }));
}
