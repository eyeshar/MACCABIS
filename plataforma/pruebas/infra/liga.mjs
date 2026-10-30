// La liga para las suites que la cargan de paso (navegacion, portada, avisos, safe-area). En local, la de siempre: la
// de las hojas de fuentes_fbm/ (fuera de git). En GitHub Actions no hay hojas (llevan jugadores de otros equipos y no
// pueden ir a un repositorio publico): se usa lo publicado en data/ (clasificacion y resultados), sin estadisticas por
// jugador. Las suites que comprueban esas estadisticas (pruebas:pantallas, pruebas:liga-partidos, pruebas:liga) son
// solo de local (infra/catalogo.mjs, D149).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { leerLiga } from '../../scripts/cargar_liga.mjs';
import { REPO } from './puertos.mjs';

export function ligaParaPruebas(temporada) {
  try {
    return leerLiga(temporada);
  } catch (e) {
    if (!process.env.CI) throw e;
    console.log(`  (sin las hojas de fuentes_fbm/: liga ${temporada} publicada en data/, sin estadisticas por jugador)`);
    const publico = JSON.parse(fs.readFileSync(path.join(REPO, 'data', `liga_${temporada}.json`), 'utf8'));
    // el calendario propio, como en leerLiga (no depende de las hojas)
    const { nombreTitulo } = createRequire(import.meta.url)(path.join(REPO, 'scripts', 'estadisticas', 'util.js'));
    const cal = JSON.parse(fs.readFileSync(path.join(REPO, 'data', `calendario_${temporada}.json`), 'utf8'));
    const calendario = cal.partidos.filter((p) => p.fase === 'liga').map((p) => ({ ...p, rival: p.rival ? nombreTitulo(p.rival) : null }));
    return { privado: [], publico, calendario };
  }
}
