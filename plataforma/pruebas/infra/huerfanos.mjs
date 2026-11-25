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

// ---------------------------------------------------------------------------------------------------------------------
// Sesiones de Claude Code abiertas (D204). SOLO SE LISTAN: `pruebas:limpiar` nunca cierra una sesión de Claude; eso lo
// decide Iván, una a una. El 25/11/2026 se contó por error la propia sesión de trabajo entre las «viejas»: por eso se
// marca cuál es la actual (la que tiene en su cadena de padres al proceso que pregunta).

/** El CLI de Claude Code (instalado con npm o el nativo de ~/.local/bin). No la aplicación de escritorio (WindowsApps). */
export const CLAUDE_CODE = /[\\/]@anthropic-ai[\\/]claude-code[\\/]|[\\/]\.local[\\/]bin[\\/]claude(\.exe)?(["\s]|$)/i;
const TERMINALES = [
  [/windowsterminal\.exe/i, 'Windows Terminal'], [/(^|[\\/"\s])code\.exe/i, 'VS Code'], [/cursor\.exe/i, 'Cursor'],
  [/openconsole\.exe|conhost\.exe/i, 'consola'], [/explorer\.exe/i, 'el escritorio (Explorador)'],
];
const nombre = (cmd) => (cmd.match(/([^\\/"\s]+\.exe)/i)?.[1] ?? cmd.split(/\s+/)[0] ?? '?');
/** FileTime de Windows (100 ns desde 1601) a Date; null si no hay. */
export const fechaDe = (t) => (t ? new Date(t / 1e4 - 11644473600000) : null);

/**
 * Las sesiones de Claude Code de una lista de procesos ({ pid, ppid, t, cmd, mem }), sin las anidadas en otra.
 * `yo`: el PID que pregunta (para marcar la sesión actual). `conVentana`: PIDs con ventana visible (Windows).
 * Devuelve [{ pid, inicio, actual, padre: { pid, nombre } | null, terminal: { pid, nombre, ventana (null: el Explorador,
 *            cuya ventana no dice nada) } | null,
 *            mcp: [{ pid, cmd }], mem }] (mem = la sesión y todo lo que cuelga de ella).
 */
export function sesionesClaude(lista, yo, conVentana = new Set()) {
  const porPid = new Map(lista.map((p) => [p.pid, p]));
  const hijos = new Map();
  for (const p of lista) { if (!hijos.has(p.ppid)) hijos.set(p.ppid, []); if (p.pid !== p.ppid) hijos.get(p.ppid).push(p); }
  const subir = (p) => { const out = []; let x = p; for (let n = 0; n < 40 && !huerfano(x, porPid); n++) { x = porPid.get(x.ppid); out.push(x); } return out; };
  const bajar = (p) => { const out = [], cola = [p]; while (cola.length) { const x = cola.shift(); for (const h of hijos.get(x.pid) ?? []) if (h.t >= x.t || !h.t || !x.t) { out.push(h); cola.push(h); } } return out; };
  const sesiones = lista.filter((p) => CLAUDE_CODE.test(p.cmd));
  const ids = new Set(sesiones.map((p) => p.pid));
  const mia = (() => { const y = porPid.get(yo); if (!y) return null; if (ids.has(y.pid)) return y.pid; return subir(y).find((x) => ids.has(x.pid))?.pid ?? null; })();
  return sesiones.filter((p) => !subir(p).some((x) => ids.has(x.pid))).map((p) => {
    const arriba = subir(p);
    const padre = arriba[0] ?? null;
    let terminal = null;
    for (const x of arriba) { const t = TERMINALES.find(([re]) => re.test(x.cmd)); if (t) { terminal = { pid: x.pid, nombre: t[1], ventana: /explorer\.exe/i.test(x.cmd) ? null : conVentana.has(x.pid) }; break; } }
    const abajo = bajar(p);
    return {
      pid: p.pid, inicio: fechaDe(p.t), actual: p.pid === mia,
      padre: padre ? { pid: padre.pid, nombre: nombre(padre.cmd) } : null,
      terminal,
      // El servidor de verdad (el node que corre su cli.js), no el `npx` que lo lanzó.
      mcp: abajo.filter((x) => /mcp/i.test(x.cmd) && /node(\.exe)?["\s]/i.test(x.cmd) && !/npx-cli\.js/i.test(x.cmd)).map((x) => ({ pid: x.pid, cmd: x.cmd })),
      mem: [p, ...abajo].reduce((s, x) => s + (x.mem || 0), 0),
    };
  }).sort((a, b) => (a.inicio?.getTime() ?? 0) - (b.inicio?.getTime() ?? 0));
}
