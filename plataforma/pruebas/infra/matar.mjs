// Matar un proceso con todo su arbol, de forma sincrona (sirve dentro de process.on('exit')).
import { execFileSync } from 'node:child_process';

export function matarArbol(pid) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    else { try { process.kill(-pid, 'SIGKILL'); } catch { process.kill(pid, 'SIGKILL'); } }
  } catch { /* ya no estaba */ }
}
