#!/usr/bin/env node
// Calibracion de la proyeccion de anotacion (D124): tras cada jornada publicada (`npm run jornada` y la rutina A, que lo
// llaman al final), guarda en privado/proyecciones_<temporada>.json, FUERA DE GIT, la proyeccion de cada partido nuestro
// ya cargado (con lo que se sabia antes de esa jornada y los que salen en su hoja) y el resultado real. Lo ya guardado
// no se reescribe (queda congelado); solo se añaden los partidos nuevos. La pantalla de convocatoria calcula lo mismo con
// la misma funcion (src/lib/convocatoria/proyeccion.ts).
//
// Las letras de Ataque son privadas (D39): se leen de jugadores_privado (SUPABASE_DB_URL de .env.local) en una
// transaccion de SOLO LECTURA y nunca se imprimen. Sin conexion, se calcula sin letras (relleno con la media) y se dice.
//
//   npm run proyeccion:calibrar                 añade los partidos nuevos
//   npm run proyeccion:calibrar -- --proximas   ademas, la proyeccion (solo el total) de las convocatorias aprobadas
//                                               que aun no se han jugado
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import postgres from 'postgres';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.join(RAIZ, '..');
const TEMPORADA = '2026-27';
const require = createRequire(import.meta.url);
dotenv.config({ path: path.join(RAIZ, '.env.local'), quiet: true });
const P = await import(pathToFileURL(path.join(RAIZ, 'src', 'lib', 'convocatoria', 'proyeccion.ts')).href);
const A = require(path.join(RAIZ, 'src', 'data', 'avisosEquipacion.js'));
const leer = (f) => JSON.parse(fs.readFileSync(path.join(RAIZ, 'src', 'data', f), 'utf8'));
const equip = leer('equipaciones.json');
const actual = leer(`estadisticas/season_${TEMPORADA}.json`), anterior = leer('estadisticas/season_2025-26.json'), liga = leer('liga.json');
const clave = (n) => A.clave(A.equipoPorNombre(equip, n)?.nombre ?? n);
const PROXIMAS = process.argv.includes('--proximas');

let letras = new Map(), nombres = new Map(), plantilla = actual.players.map((p) => p.person_id).filter(Boolean), conLetras = false, proximas = [];
if (process.env.SUPABASE_DB_URL) {
  const local = /localhost|127\.0\.0\.1/.test(process.env.SUPABASE_DB_URL);
  const sql = postgres(process.env.SUPABASE_DB_URL, { ssl: local ? false : 'require', onnotice: () => {}, max: 1 });
  try {
    await sql.begin('read only', async (tx) => {
      const jug = await tx`select person_id, nombre_visible, activo, rol from public.jugadores`;
      const priv = await tx`select person_id, nota_ataque from public.jugadores_privado`;
      for (const j of jug) nombres.set(j.person_id, j.nombre_visible);
      for (const p of priv) letras.set(p.person_id, p.nota_ataque ?? null);
      plantilla = jug.filter((j) => j.activo && j.rol !== 'entrenador').map((j) => j.person_id);
      conLetras = true;
      if (PROXIMAS) proximas = await tx`select fecha::text, jornada, equipos from public.convocatorias where estado = 'aprobada' and fecha >= (now() at time zone 'Europe/Madrid')::date - 7 order by fecha`;
    });
  } catch (e) { console.log(`Sin letras de Ataque (no se pudo leer la base: ${e.message}); se calcula con la media.`); }
  finally { await sql.end({ timeout: 5 }); }
} else console.log('Sin SUPABASE_DB_URL: se calcula sin letras de Ataque (relleno con la media).');

const puntos = P.calibrar({ actual, anterior, liga, clave, letra: (id) => letras.get(id) ?? null, nombre: (id) => nombres.get(id) ?? id, plantilla });
const fichero = path.join(REPO, 'privado', `proyecciones_${TEMPORADA}.json`);
const previo = fs.existsSync(fichero) ? JSON.parse(fs.readFileSync(fichero, 'utf8')) : { partidos: [] };
const yaEsta = new Set(previo.partidos.map((x) => `${x.jornada}-${x.equipo}`));
const nuevos = puntos.filter((x) => !yaEsta.has(`${x.jornada}-${x.equipo}`)).map((x) => ({ ...x, guardado: new Date().toISOString(), con_letras: conLetras }));
const todos = [...previo.partidos, ...nuevos].sort((a, b) => a.jornada - b.jornada || a.equipo.localeCompare(b.equipo));
const resumen = P.resumenCalibracion(todos);
fs.mkdirSync(path.dirname(fichero), { recursive: true });
fs.writeFileSync(fichero, JSON.stringify({ temporada: TEMPORADA, metodo: 'D124 (REGLAS_CONVOCATORIA.md §9)', actualizado: new Date().toISOString(), resumen, partidos: todos }, null, 1) + '\n', 'utf8');
console.log(`Proyección: ${nuevos.length} partido(s) nuevo(s) en privado/proyecciones_${TEMPORADA}.json. ${resumen ? resumen.texto + '.' : 'Aún no hay partidos.'}`);
for (const x of nuevos) console.log(`  J${x.jornada} ${x.equipo} vs ${x.rival}: proyección ${x.proyeccion} (${x.desde}–${x.hasta}), real ${x.real}, error ${x.error}`);

if (PROXIMAS) {
  const hist = P.historiales(actual, anterior);
  const tasas = P.tasasPorLetra(plantilla.map((id) => ({ letra: letras.get(id) ?? null, hist: hist(id) })));
  const cal = leer('calendario.json').partidos;
  for (const c of proximas) {
    for (const eq of ['MdA', 'MdL']) {
      const ids = (c.equipos?.[eq] ?? []).map((x) => x.person_id);
      if (!ids.length) continue;
      const partido = cal.find((p) => p.fecha === c.fecha && p.equipo === eq.toUpperCase() && !p.descansa);
      const grupo = eq === 'MdA' ? 'G1' : 'G2';
      const est = P.estadisticasGrupo(liga, grupo, clave, partido?.jornada ?? c.jornada ?? undefined);
      const r = P.proyectar({ convocados: ids.map((id) => ({ person_id: id, nombre: nombres.get(id) ?? id, letra: letras.get(id) ?? null, hist: hist(id) })), tasas, rival: est.rival(partido?.rival ?? null), grupo: est.grupo, jornadasJugadas: est.jornadas });
      console.log(`  Próxima ${c.fecha} ${eq} vs ${partido?.rival ?? '?'}: ${P.textoProyeccion(r)}${r.notaRival ? ` · ${r.notaRival}` : ''} · ${ids.length} convocados${r.pocosDatos ? `, ${r.pocosDatos} con pocos datos` : ''}`);
    }
  }
}
