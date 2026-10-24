#!/usr/bin/env node
// Carga los datos PRIVADOS de convocatoria (D39, D107, D108) desde la hoja de Ivan, privado/jugadores_2026-27.xlsx
// (fuera de git), a la tabla jugadores_privado de Supabase (solo gestores). Por defecto es un SIMULACRO: comprueba y
// cuenta, no escribe.
//
//   npm run db:privado                                simulacro con privado/jugadores_2026-27.xlsx
//   npm run db:privado -- --aplicar                   escribe (conexion de .env.local: SUPABASE_DB_URL)
//   npm run db:privado -- --fichero <ruta.xlsx> [--aplicar]
//
// Pestaña «Jugadores» (cabecera en la fila 1) y pestaña «Parametros» (minutos minimos y cortes de pts/min). Columnas:
//   Mote, Nombre, Apellido 1, Apellido 2   -> el jugador (por nombre completo; si no, por el mote = nombre visible)
//   Posición                                -> posicion
//   Nivel (tuyo)                            -> nivel (el que usa el motor: lo fija Ivan a mano)
//   Dobla                                   -> dobla
//   Ataque (usar)                           -> nota_ataque (NUNCA «Ataque (tuyo)»: con 300 minutos o mas manda el dato)
//   Defensa (tuya), Total calculado         -> nota_defensa, nota_total (solo referencia)
//   Minutos…, Puntos…, Pts/min              -> minutos, puntos, pts_min
// El importador RECALCULA «Ataque (usar)» y «Total calculado» con la pestaña Parametros y para si no coinciden con lo
// guardado en el Excel (hoja sin recalcular). Base de reserva, reglas personales, sanciones y notas de texto NO estan en
// la hoja: no se tocan (se ponen en Gestion → Convocatoria → Datos de los jugadores).
//
// Nunca imprime niveles ni notas: solo recuentos y, si algo no vale, la fila y la columna.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { conectar } from './db.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LETRAS = ['A', 'B', 'C', 'D', 'E'];
const POS = { base: 'base', escolta: 'escolta', alero: 'alero', 'ala-pivot': 'ala_pivot', 'ala pivot': 'ala_pivot', alapivot: 'ala_pivot', pivot: 'pivot' };
export const norm = (s) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9, ]/g, '').replace(/\s+/g, ' ').trim();
const valor = (v) => (v && typeof v === 'object' && 'result' in v ? v.result : v && typeof v === 'object' && 'richText' in v ? v.richText.map((x) => x.text).join('') : v);
const siNo = (s) => { const v = norm(s); return v === 'si' ? true : v === 'no' ? false : null; };
const letra = (s) => { const v = String(s ?? '').trim().toUpperCase(); return LETRAS.includes(v) ? v : null; };

/** Ataque (usar) como lo calcula la hoja: con minutos >= minimo, por los cortes de pts/min; si no, la letra de Ivan. */
export function ataqueUsar(minutos, ptsMin, ataqueTuyo, p) {
  if (minutos >= p.minutos && ptsMin !== null) return ptsMin >= p.cortes.A ? 'A' : ptsMin >= p.cortes.B ? 'B' : ptsMin >= p.cortes.C ? 'C' : ptsMin >= p.cortes.D ? 'D' : 'E';
  return ataqueTuyo;
}
/** Total calculado: media de ataque y defensa (A=1 … E=5); a media letra, hacia la mejor. */
export const totalCalculado = (a, d) => (a && d ? LETRAS[Math.floor((LETRAS.indexOf(a) + LETRAS.indexOf(d)) / 2)] : null);

/** Lee la hoja. Devuelve filas (sin person_id todavia), parametros y errores. */
export async function leerHoja(fichero) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(fichero);
  const hj = wb.getWorksheet('Jugadores'), hp = wb.getWorksheet('Parametros');
  if (!hj || !hp) return { filas: [], errores: ['faltan las pestañas «Jugadores» y «Parametros»'] };
  const param = {};
  hp.eachRow((r, i) => { if (i > 1) param[norm(valor(r.getCell(1).value))] = Number(valor(r.getCell(2).value)); });
  const busca = (txt) => Object.entries(param).find(([k]) => k.includes(txt))?.[1];
  const p = { minutos: busca('minutos minimos'), cortes: { A: busca('corte a'), B: busca('corte b'), C: busca('corte c'), D: busca('corte d') } };
  const errores = [];
  if ([p.minutos, ...Object.values(p.cortes)].some((x) => !Number.isFinite(x))) errores.push('Parametros: faltan los minutos mínimos o algún corte (A, B, C, D)');
  const cab = Array.from(hj.getRow(1).values ?? [], (v) => norm(valor(v))); // indice = numero de columna (la 0 no existe)
  const col = (k) => cab.findIndex((c) => c === norm(k));
  const necesarias = ['Mote', 'Nombre', 'Apellido 1', 'Apellido 2', 'Posición', 'Nivel (tuyo)', 'Ataque (tuyo)', 'Defensa (tuya)', 'Dobla', 'Pts/min', 'Ataque (usar)', 'Total calculado'];
  for (const k of necesarias) if (col(k) < 0) errores.push(`falta la columna «${k}»`);
  const colMin = cab.findIndex((c) => c.startsWith('minutos')), colPts = cab.findIndex((c) => c.startsWith('puntos'));
  if (colMin < 0 || colPts < 0) errores.push('faltan las columnas de minutos y puntos');
  if (errores.length) return { filas: [], errores, param: p };
  const filas = [];
  hj.eachRow((r, n) => {
    if (n === 1) return;
    const v = (k) => valor(r.getCell(col(k)).value);
    const posTxt = v('Posición');
    if (!posTxt && !v('Nivel (tuyo)')) return; // leyenda y filas en blanco
    const f = {
      fila: n, mote: String(v('Mote') ?? '').trim(), completo: norm(`${`${v('Apellido 1') ?? ''} ${v('Apellido 2') ?? ''}`.trim()}, ${v('Nombre') ?? ''}`),
      posicion: POS[norm(posTxt)] ?? null, nivel: letra(v('Nivel (tuyo)')), dobla: siNo(v('Dobla')),
      nota_ataque: letra(v('Ataque (usar)')), nota_defensa: letra(v('Defensa (tuya)')), nota_total: letra(v('Total calculado')),
      minutos: Number(valor(r.getCell(colMin).value)) || 0, puntos: Number(valor(r.getCell(colPts).value)) || 0,
      pts_min: valor(r.getCell(col('Pts/min')).value) === '' || valor(r.getCell(col('Pts/min')).value) == null ? null : Number(valor(r.getCell(col('Pts/min')).value)),
      ataque_tuyo: letra(v('Ataque (tuyo)')),
    };
    if (!f.posicion) errores.push(`fila ${n}: posición no válida`);
    if (!f.nivel) errores.push(`fila ${n}: «Nivel (tuyo)» no es A-E`);
    if (f.dobla === null) errores.push(`fila ${n}: «Dobla» no es Sí/No`);
    if (!f.nota_defensa) errores.push(`fila ${n}: «Defensa (tuya)» no es A-E`);
    const calc = ataqueUsar(f.minutos, f.pts_min, f.ataque_tuyo, p);
    if (calc !== f.nota_ataque) errores.push(`fila ${n}: «Ataque (usar)» guardado no coincide con el que sale de Parametros (¿hoja sin recalcular?)`);
    if (totalCalculado(f.nota_ataque, f.nota_defensa) !== f.nota_total) errores.push(`fila ${n}: «Total calculado» no coincide con la media de ataque y defensa`);
    filas.push(f);
  });
  return { filas, errores, param: p };
}

/** Empareja cada fila con su person_id: por nombre completo (nombre_oficial) y, si no, por mote = nombre visible. */
export function emparejar(filas, jugadores) {
  const errores = [];
  const porCompleto = new Map(jugadores.map((j) => [norm(j.nombre_oficial), j.person_id]));
  const out = [];
  for (const f of filas) {
    let id = porCompleto.get(f.completo);
    if (!id) {
      const m = jugadores.filter((j) => norm(j.nombre_visible) === norm(f.mote));
      if (m.length === 1) id = m[0].person_id;
    }
    if (!id) { errores.push(`fila ${f.fila}: no se encuentra en la plantilla (ni por nombre completo ni por mote)`); continue; }
    if (out.some((x) => x.person_id === id)) { errores.push(`fila ${f.fila}: jugador repetido`); continue; }
    out.push({ ...f, person_id: id });
  }
  return { filas: out, errores };
}

const COLUMNAS = ['posicion', 'nivel', 'dobla', 'nota_ataque', 'nota_defensa', 'nota_total', 'minutos', 'puntos', 'pts_min'];

export async function cargarPrivado(sql, filas, { aplicar = false, fuente = 'jugadores_2026-27.xlsx', log = console.log } = {}) {
  const jugadores = await sql`select person_id, nombre_oficial, nombre_visible from public.jugadores`;
  const em = emparejar(filas, jugadores);
  if (em.errores.length) throw new Error(`la hoja no casa con la plantilla:\n  ${em.errores.join('\n  ')}`);
  log(`${em.filas.length} jugadores en la hoja, todos en la plantilla: ${em.filas.filter((f) => f.dobla).length} «Dobla», ${em.filas.filter((f) => f.nota_ataque !== f.ataque_tuyo).length} con el ataque cambiado por los minutos.`);
  if (!aplicar) { log('Simulacro: no se ha escrito nada. Añade --aplicar para cargarlo.'); return 0; }
  let n = 0;
  await sql.begin(async (tx) => {
    for (const f of em.filas) {
      const fila = Object.fromEntries(COLUMNAS.map((c) => [c, f[c]]));
      await tx`insert into public.jugadores_privado ${tx({ person_id: f.person_id, ...fila, notas_fuente: fuente, cambiado_por_nombre: 'carga de la hoja' })}
               on conflict (person_id) do update set ${tx({ ...fila, notas_fuente: fuente, cambiado_en: new Date(), cambiado_por_nombre: 'carga de la hoja' }, ...COLUMNAS, 'notas_fuente', 'cambiado_en', 'cambiado_por_nombre')}`;
      n++;
    }
  });
  log(`Cargados ${n} jugadores en jugadores_privado (base de reserva, reglas y sanciones, sin tocar).`);
  return n;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dotenv = await import('dotenv');
  dotenv.config({ path: path.join(RAIZ, '.env.local') });
  const args = process.argv.slice(2);
  const i = args.indexOf('--fichero');
  const fichero = i >= 0 ? args[i + 1] : path.join(RAIZ, '..', 'privado', 'jugadores_2026-27.xlsx');
  const { filas, errores } = await leerHoja(fichero);
  if (errores.length) { console.error(`La hoja tiene errores (no se carga nada):\n  ${errores.join('\n  ')}`); process.exit(1); }
  const sql = conectar();
  try { await cargarPrivado(sql, filas, { aplicar: args.includes('--aplicar'), fuente: path.basename(fichero) }); }
  catch (e) { console.error('ERROR:', e.message); process.exitCode = 1; }
  finally { await sql.end(); }
}
