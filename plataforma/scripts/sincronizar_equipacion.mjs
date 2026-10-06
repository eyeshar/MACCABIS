#!/usr/bin/env node
// Copia a plataforma/src/data/ los tres ficheros de los avisos de equipacion (D79): la plataforma se despliega
// con plataforma/ como raiz, asi que no puede importar ../data. La fuente unica sigue siendo data/.
//
//   npm run equipacion:sync            copia
//   npm run equipacion:sync -- --check  falla si las copias no coinciden (lo usa pruebas:equipacion)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATOS = path.join(RAIZ, '..', 'data');
const DESTINO = path.join(RAIZ, 'src', 'data');
export const COPIAS = [
  ['avisos_equipacion.js', 'avisosEquipacion.js'],
  ['equipaciones_2026-27.json', 'equipaciones.json'],
  ['calendario_2026-27.json', 'calendario.json'],
];

export function desfasadas() {
  return COPIAS.filter(([o, d]) => {
    const f = path.join(DESTINO, d);
    return !fs.existsSync(f) || !fs.readFileSync(f).equals(fs.readFileSync(path.join(DATOS, o)));
  }).map(([, d]) => d);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const d = desfasadas();
    if (d.length) { console.error(`Copias desfasadas en src/data/: ${d.join(', ')} (npm run equipacion:sync)`); process.exit(1); }
    console.log('Copias de src/data/ al dia.');
  } else {
    fs.mkdirSync(DESTINO, { recursive: true });
    for (const [o, d] of COPIAS) fs.copyFileSync(path.join(DATOS, o), path.join(DESTINO, d));
    console.log(`Copiados ${COPIAS.length} ficheros a src/data/.`);
  }
}
