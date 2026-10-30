#!/usr/bin/env node
// npm run ci:estado — antes de mergear (D149): ¿la ultima ejecucion de «Pruebas completas» en GitHub Actions para ESTA
// rama y ESTE commit esta en verde? Sale con 0 solo si es asi. Usa `gh` con el token que ya guarda Git para github.com
// (GH_TOKEN; no hace falta `gh auth login`). Opcion: --esperar (espera a que termine, consultando cada 30 s).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const rama = git('rev-parse', '--abbrev-ref', 'HEAD');
const sha = git('rev-parse', 'HEAD');
if (rama === 'main') { console.log('En main no se ejecuta la batería (ya se probó en la rama).'); process.exit(0); }
let token = process.env.GH_TOKEN;
if (!token) {
  try { token = execFileSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8' }).match(/^password=(.*)$/m)?.[1]; } catch {}
}
// gh puede no estar en el PATH de esta consola recién instalado (winget): se busca en su sitio.
const candidatos = ['gh', path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'gh.exe'), 'C:/Program Files/GitHub CLI/gh.exe'];
const gh = candidatos.find((c) => { try { execFileSync(c, ['--version'], { stdio: 'ignore' }); return true; } catch { return false; } });
if (!gh) { console.error('No encuentro gh (GitHub CLI). Instálalo: winget install GitHub.cli'); process.exit(2); }
const remoto = git('remote', 'get-url', 'origin').replace(/^https:\/\/github\.com\/|\.git$/g, '');
const consultar = () => JSON.parse(execFileSync(gh, ['run', 'list', '-R', remoto, '--workflow', 'pruebas.yml', '--branch', rama, '--limit', '5', '--json', 'status,conclusion,headSha,url,createdAt,databaseId'], { encoding: 'utf8', env: { ...process.env, ...(token ? { GH_TOKEN: token } : {}) } }));
const esperar = process.argv.includes('--esperar');
for (;;) {
  const runs = consultar();
  const r = runs.find((x) => x.headSha === sha);
  if (!r) {
    const otra = runs[0];
    console.log(`Sin ejecución de «Pruebas completas» para ${rama} @ ${sha.slice(0, 7)}${otra ? ` (la última es de ${otra.headSha.slice(0, 7)}: ${otra.conclusion || otra.status})` : ''}. ¿Has hecho push?`);
    if (!esperar) process.exit(1);
  } else if (r.status !== 'completed') {
    console.log(`En marcha (${r.status}) desde ${r.createdAt}: ${r.url}`);
    if (!esperar) process.exit(1);
  } else {
    console.log(`${r.conclusion === 'success' ? 'VERDE' : 'ROJO (' + r.conclusion + ')'}: ${rama} @ ${sha.slice(0, 7)} · ${r.url}`);
    if (r.conclusion !== 'success') console.log(`Ver los fallos: gh run view ${r.databaseId} --log-failed`);
    process.exit(r.conclusion === 'success' ? 0 : 1);
  }
  await new Promise((ok) => setTimeout(ok, 30000));
}
