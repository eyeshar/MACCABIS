#!/usr/bin/env node
// Copia a plataforma/src/data/ los datos publicos que usa la plataforma: los tres de los avisos de equipacion (D75) y,
// desde el redisenio (D76), la liga y la temporada 26/27 por equipo y por jugador de Maccabis (ya publicas en GitHub
// Pages), los entrenos y un resumen de la historia generado de data/season_*.json y data/historia_club.json.
// La plataforma se despliega con plataforma/ como raiz, asi que no puede importar ../data. La fuente unica sigue
// siendo data/.
//
//   npm run datos:sync                 copia (alias historico: npm run equipacion:sync)
//   npm run datos:sync -- --check      falla si las copias no coinciden (lo usan pruebas:equipacion y pruebas:portada)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATOS = path.join(RAIZ, '..', 'data');
const DESTINO = path.join(RAIZ, 'src', 'data');
/** Estadisticas por temporada y rivales de la liga (paso 2, migracion de GitHub Pages): las mismas data/season_<t>.json que
 *  genera npm run jornada, copiadas tal cual a src/data/estadisticas/ (la plataforma no puede importar ../data). */
const INDICE = JSON.parse(fs.readFileSync(path.join(DATOS, "index.json"), "utf8"));
const COPIAS_ESTADISTICAS = [
  ["index.json", "estadisticas/index.json"],
  ["rivales_2026-27_web.json", "estadisticas/rivales.json"],
  ...INDICE.seasons.map((s) => [`season_${s.id}.json`, `estadisticas/season_${s.id}.json`]),
];
export const COPIAS = [
  ['avisos_equipacion.js', 'avisosEquipacion.js'],
  ['equipaciones_2026-27.json', 'equipaciones.json'],
  ['calendario_2026-27.json', 'calendario.json'],
  ['liga_2026-27.json', 'liga.json'],
  ['season_2026-27.json', 'temporada.json'],
  ['entrenos_2026-27.json', 'entrenos.json'],
  ...COPIAS_ESTADISTICAS,
];
const RESUMEN = 'historia_resumen.json';

/** Cifras de la portada ("La historia del club"): partidos con estadisticas (sin incomparecencias), victorias en
 *  esos partidos, temporadas con datos y personas que han jugado en el club (sin el entrenador). */
export function resumenHistoria() {
  const indice = JSON.parse(fs.readFileSync(path.join(DATOS, 'index.json'), 'utf8'));
  let partidos = 0, victorias = 0;
  for (const s of indice.seasons) {
    const t = JSON.parse(fs.readFileSync(path.join(DATOS, '..', s.file), 'utf8'));
    const jugados = (t.partidos || []).filter((p) => !p.incomp);
    partidos += jugados.length;
    victorias += jugados.filter((p) => p.res === 'G').length;
  }
  const historia = JSON.parse(fs.readFileSync(path.join(DATOS, 'historia_club.json'), 'utf8'));
  const personas = Array.isArray(historia.personas) ? historia.personas : Object.values(historia.personas);
  const jugadores = personas.filter((p) => !p.es_entrenador).length;
  return JSON.stringify({
    fuente: 'Generado por plataforma/scripts/sincronizar_equipacion.mjs desde data/season_*.json y data/historia_club.json. No editar a mano.',
    temporadas_con_datos: indice.seasons.length,
    partidos_con_estadisticas: partidos,
    victorias,
    jugadores_en_la_historia: jugadores,
  }, null, 2) + '\n';
}

export function desfasadas() {
  const copias = COPIAS.filter(([o, d]) => {
    const f = path.join(DESTINO, d);
    // Sin distinguir CRLF/LF (en Windows git puede sacar los ficheros con uno u otro).
    const norm = (x) => fs.readFileSync(x, 'utf8').replace(/\r\n/g, '\n');
    return !fs.existsSync(f) || norm(f) !== norm(path.join(DATOS, o));
  }).map(([, d]) => d);
  const f = path.join(DESTINO, RESUMEN);
  // Sin distinguir CRLF/LF: en Windows git puede sacar el fichero con CRLF.
  if (!fs.existsSync(f) || fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') !== resumenHistoria()) copias.push(RESUMEN);
  return copias;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const d = desfasadas();
    if (d.length) { console.error(`Copias desfasadas en src/data/: ${d.join(', ')} (npm run datos:sync)`); process.exit(1); }
    console.log('Copias de src/data/ al dia.');
  } else {
    fs.mkdirSync(path.join(DESTINO, 'estadisticas'), { recursive: true });
    for (const [o, d] of COPIAS) fs.copyFileSync(path.join(DATOS, o), path.join(DESTINO, d));
    fs.writeFileSync(path.join(DESTINO, RESUMEN), resumenHistoria());
    console.log(`Copiados ${COPIAS.length} ficheros y generado ${RESUMEN} en src/data/.`);
  }
}
