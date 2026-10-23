#!/usr/bin/env node
// Carga los datos PRIVADOS de convocatoria (D39, D107) desde el CSV de Ivan (privado/, fuera de git) a la tabla
// jugadores_privado de Supabase (solo gestores). Por defecto es un SIMULACRO: comprueba y cuenta, no escribe.
//
//   npm run db:privado                                   simulacro con privado/plantilla_2026-27.csv
//   npm run db:privado -- --aplicar                      escribe (conexion de .env.local: SUPABASE_DB_URL)
//   npm run db:privado -- --fichero <ruta.csv> [--aplicar]
//
// CSV separado por «;» con cabecera. Columnas: person_id; posicion (Base, Escolta, Alero, Ala-pívot, Pívot); nivel
// (A-E); dobla (Sí/No). Opcionales: base_reserva (Sí/No), regla («fijo MdA», «fijo MdL», «comodin»),
// sancionado_hasta_jornada (número) y nota. Las demás columnas (mote, nombre, fichas) se ignoran: las fichas mandan en
// public.jugadores. Lo que ya esté en la tabla se ACTUALIZA con lo del CSV (solo las columnas que trae el CSV).
//
// Nunca imprime niveles ni nombres: solo recuentos y, si algo no vale, la fila y la columna.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { conectar } from './db.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POS = { base: 'base', escolta: 'escolta', alero: 'alero', 'ala-pivot': 'ala_pivot', 'ala pivot': 'ala_pivot', alapivot: 'ala_pivot', pivot: 'pivot' };
const sinTildes = (s) => String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
const siNo = (s) => { const v = sinTildes(s); return v === 'si' || v === 's' || v === 'true' || v === '1' ? true : v === 'no' || v === 'n' || v === 'false' || v === '0' ? false : null; };

export function leerCsv(texto) {
  const lineas = texto.replace(/^﻿/, '').trim().split(/\r?\n/).map((l) => l.split(';').map((x) => x.trim()));
  const cab = lineas[0].map(sinTildes);
  const col = (k) => cab.indexOf(k);
  const filas = [], errores = [];
  lineas.slice(1).forEach((l, i) => {
    const n = i + 2;
    const v = (k) => (col(k) >= 0 ? l[col(k)] : undefined);
    const f = { person_id: v('person_id') };
    if (!f.person_id) { errores.push(`fila ${n}: sin person_id`); return; }
    if (v('posicion') !== undefined) { const p = POS[sinTildes(v('posicion'))]; if (v('posicion') && !p) errores.push(`fila ${n}: posición no válida`); f.posicion = p ?? null; }
    if (v('nivel') !== undefined) { const x = v('nivel').toUpperCase(); if (x && !/^[A-E]$/.test(x)) errores.push(`fila ${n}: nivel no válido (A-E)`); f.nivel = /^[A-E]$/.test(x) ? x : null; }
    if (v('dobla') !== undefined) { const x = siNo(v('dobla')); if (x === null) errores.push(`fila ${n}: dobla no es Sí/No`); f.dobla = x ?? true; }
    if (v('base_reserva') !== undefined) f.base_reserva = siNo(v('base_reserva')) ?? false;
    if (v('regla') !== undefined) {
      const r = sinTildes(v('regla'));
      if (!r) { f.regla = null; f.regla_equipo = null; }
      else if (/^fijo\s*(al\s*)?mda$/.test(r)) { f.regla = 'fijo'; f.regla_equipo = 'MdA'; }
      else if (/^fijo\s*(al\s*)?mdl$/.test(r)) { f.regla = 'fijo'; f.regla_equipo = 'MdL'; }
      else if (r === 'comodin') { f.regla = 'comodin'; f.regla_equipo = null; }
      else errores.push(`fila ${n}: regla no válida («fijo MdA», «fijo MdL» o «comodin»)`);
    }
    if (v('sancionado_hasta_jornada') !== undefined) { const x = Number(v('sancionado_hasta_jornada')); f.sancionado_hasta_jornada = x > 0 ? Math.floor(x) : null; }
    if (v('nota') !== undefined) f.nota = v('nota') || null;
    filas.push(f);
  });
  return { filas, errores };
}

export async function cargarPrivado(sql, filas, { aplicar = false, log = console.log } = {}) {
  const existen = new Set((await sql`select person_id from public.jugadores`).map((r) => r.person_id));
  const desconocidos = filas.filter((f) => !existen.has(f.person_id)).map((f) => f.person_id);
  if (desconocidos.length) throw new Error(`${desconocidos.length} person_id no están en la plantilla: ${desconocidos.join(', ')}`);
  const cuenta = (k) => filas.filter((f) => f[k] != null).length;
  log(`${filas.length} jugadores en el CSV: ${cuenta('posicion')} con posición, ${cuenta('nivel')} con nivel, ${filas.filter((f) => f.dobla === true).length} «Dobla», ${filas.filter((f) => f.base_reserva).length} base de reserva, ${filas.filter((f) => f.regla).length} con regla personal.`);
  if (!aplicar) { log('Simulacro: no se ha escrito nada. Añade --aplicar para cargarlo.'); return 0; }
  let n = 0;
  await sql.begin(async (tx) => {
    for (const f of filas) {
      const cols = Object.keys(f);
      await tx`insert into public.jugadores_privado ${tx({ ...f, cambiado_por_nombre: 'carga CSV' })}
               on conflict (person_id) do update set ${tx({ ...f, cambiado_en: new Date(), cambiado_por_nombre: 'carga CSV' }, ...cols.filter((c) => c !== 'person_id'), 'cambiado_en', 'cambiado_por_nombre')}`;
      n++;
    }
  });
  log(`Cargados ${n} jugadores en jugadores_privado.`);
  return n;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dotenv = await import('dotenv');
  dotenv.config({ path: path.join(RAIZ, '.env.local') });
  const args = process.argv.slice(2);
  const i = args.indexOf('--fichero');
  const fichero = i >= 0 ? args[i + 1] : path.join(RAIZ, '..', 'privado', 'plantilla_2026-27.csv');
  const { filas, errores } = leerCsv(fs.readFileSync(fichero, 'utf8'));
  if (errores.length) { console.error(`El CSV tiene errores (no se carga nada):\n  ${errores.join('\n  ')}`); process.exit(1); }
  const sql = conectar();
  try { await cargarPrivado(sql, filas, { aplicar: args.includes('--aplicar') }); }
  catch (e) { console.error('ERROR:', e.message); process.exitCode = 1; }
  finally { await sql.end(); }
}
