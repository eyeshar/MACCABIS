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
import { calendarioPrueba } from './calendario.mjs';

/** liga_calendario de las pruebas: el calendario de PRUEBA (D185), nunca el real. */
function calendarioLiga() {
  const { nombreTitulo } = createRequire(import.meta.url)(path.join(REPO, 'scripts', 'estadisticas', 'util.js'));
  return calendarioPrueba().partidos.filter((p) => p.fase === 'liga').map((p) => ({ ...p, rival: p.rival ? nombreTitulo(p.rival) : null }));
}

export function ligaParaPruebas(temporada) {
  try {
    return { ...leerLiga(temporada), calendario: calendarioLiga() };
  } catch (e) {
    if (!process.env.CI) throw e;
    console.log(`  (sin las hojas de fuentes_fbm/: liga ${temporada} publicada en data/, sin estadisticas por jugador)`);
    const publico = JSON.parse(fs.readFileSync(path.join(REPO, 'data', `liga_${temporada}.json`), 'utf8'));
    return { privado: [], publico, calendario: calendarioLiga() };
  }
}

/**
 * Para las suites que cruzan el calendario con la liga (Scouting, «Tu próximo partido», páginas de partido): cada rival
 * INVENTADO del calendario de prueba pasa a ser su equipo de la liga (`rivales_liga` del calendario de prueba: el que
 * sustituye, con sus mismos colores), escrito como en la liga cargada, en la tabla de eventos de la pila. Siempre el mismo
 * emparejamiento. Devuelve el mapa {inventado: equipo de la liga} (D185).
 */
export async function rivalesDeLiga(sql, liga) {
  const cal = calendarioPrueba();
  const clave = (t) => String(t).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const equiposLiga = Object.values(liga.publico.grupos).flatMap((g) => g.clasificacion.map((c) => c.equipo));
  const mapa = {};
  for (const [inventado, real] of Object.entries(cal.rivales_liga)) {
    const enLiga = equiposLiga.find((e) => clave(e) === clave(real));
    if (!enLiga) throw new Error(`rivalesDeLiga: «${real}» no está en la liga cargada`);
    mapa[inventado] = enLiga;
  }
  for (const [inventado, real] of Object.entries(mapa)) await sql`update public.eventos set rival = ${real} where tipo = 'liga' and rival = ${inventado}`;
  return mapa;
}

/** El calendario de prueba con los rivales de la liga de `rivalesDeLiga`. */
export const conRivalesDeLiga = (mapa, cal = calendarioPrueba()) => ({ ...cal, partidos: cal.partidos.map((p) => (p.rival && mapa[p.rival] ? { ...p, rival: mapa[p.rival] } : p)) });
