// Catalogo de todas las pruebas (D149): se saca de los package.json y del codigo de cada suite, para que una suite
// nueva entre sola en la bateria. Lo unico escrito a mano: que suites son de estadisticas y liga, cuales solo pueden
// ir en local (y por que) y cuanto tardan mas o menos (para repartirlas en los grupos de GitHub Actions).
import fs from 'node:fs';
import path from 'node:path';
import { REPO } from './puertos.mjs';

const PLAT = path.join(REPO, 'plataforma');

/** Solo en local, nunca en GitHub Actions: necesitan claves o datos que no estan en git. */
export const SOLO_LOCAL = {
  'test:liga': 'lee las hojas de fuentes_fbm/ (fuera de git)',
  'test:regresion': 'lee .cache-jdm/ y data/raw/ (fuera de git)',
  'pruebas:eventos-real': 'Supabase real: claves de plataforma/.env.local',
  'pruebas:respuestas-real': 'Supabase real: claves de plataforma/.env.local',
  'pruebas:convocatoria-real': 'Supabase real: claves de plataforma/.env.local',
  'pruebas:inicio-real': 'Supabase real: claves de plataforma/.env.local',
  'pruebas:solo-ficha-real': 'Supabase real: claves de plataforma/.env.local y la foto de privado/backups/',
};

/** Pruebas de estadisticas y liga: en local solo si el cambio toca datos, el pipeline, las migraciones o sus pantallas. */
export const ESTADISTICAS = new Set(['test:regresion', 'test:liga', 'test:privacidad', 'pruebas:liga']);

/** Segundos aproximados (medidos el 29/10/2026, Windows) para repartir los grupos de Actions. */
const SEGUNDOS = { 'pruebas:cuadre': 75 };

/** Comprobaciones de la raiz (estadisticas y datos), en el orden de siempre. */
const RAIZ = ['check:copias', 'check:personas', 'check:historia', 'check:datos', 'test:datos', 'test:duplicados', 'test:privacidad', 'test:liga', 'test:regresion'];

/** Rutas de la web que visita una suite (lo que va tras `${APP}`), recortadas a dos tramos y sin tramos de datos. */
export function claveRuta(r) {
  const tramos = r.split(/[?#]/)[0].split('/').filter(Boolean).filter((t) => !/^\(.*\)$/.test(t));
  const fuera = tramos.findIndex((t) => /^\[|\d/.test(t) || t.includes('.'));
  return '/' + (fuera === -1 ? tramos : tramos.slice(0, fuera)).slice(0, 2).join('/');
}

export function catalogo() {
  const scripts = JSON.parse(fs.readFileSync(path.join(PLAT, 'package.json'), 'utf8')).scripts;
  const lista = RAIZ.map((id) => ({ id, dir: REPO, tipo: 'logica', fuente: null }));
  lista.push({ id: 'typecheck', dir: PLAT, tipo: 'logica', fuente: null });
  for (const [id, cmd] of Object.entries(scripts)) {
    if (!id.startsWith('pruebas') || id === 'pruebas:pila' || id === 'pruebas:limpiar' || id.startsWith('pruebas:rapidas') || id.startsWith('pruebas:completas')) continue;
    const fuente = cmd.match(/pruebas\/[\w/]+\.mjs/)?.[0];
    if (!fuente) continue;
    const src = fs.readFileSync(path.join(PLAT, fuente), 'utf8');
    // web: compila o arranca la app; pila: solo Postgres + PostgREST; logica: nada que arrancar
    const web = /arrancarApp\(|preparar\((?!\{[^}]*compilar: false)/.test(src);
    const tipo = web ? 'web' : /arrancar\(\)|preparar\(/.test(src) || id.endsWith('-real') ? 'pila' : 'logica';
    const rutas = [...new Set([...src.matchAll(/\bAPP\}?\s*\+?\s*['`]?(\/[a-z][\w\-/.]*)/gi)].map((m) => claveRuta(m[1])))];
    const importa = [...src.matchAll(/from '\.\.\/(src\/(?:lib|components)\/[\w/.-]+|scripts\/[\w/.-]+)'/g)].map((m) => m[1]);
    lista.push({ id, dir: PLAT, tipo, fuente: `plataforma/${fuente}`, rutas, importa });
  }
  for (const s of lista) {
    s.soloLocal = SOLO_LOCAL[s.id] ?? null;
    s.zona = ESTADISTICAS.has(s.id) ? 'estadisticas' : 'plataforma';
    s.segundos = SEGUNDOS[s.id] ?? (s.tipo === 'web' ? 40 : s.tipo === 'pila' ? 12 : 3);
  }
  return lista;
}
