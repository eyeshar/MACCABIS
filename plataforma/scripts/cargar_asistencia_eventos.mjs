#!/usr/bin/env node
// Carga en Supabase la asistencia EVENTO A EVENTO (D170) desde el export completo de SportEasy
// (privado/sporteasy/sporteasy_maccabis_completo_2026-11-01.json, fuera de git) y cuadra cada temporada contra los totales
// de asistencia_motivos. Solo la leen los gestores (RLS). Las respuestas de la plataforma (desde el 24/10/2026) no se
// guardan: la pantalla las suma en vivo.
//
//   npm run db:asistencia-eventos -- --dry      calcula y cuenta, sin tocar la base
//   npm run db:asistencia-eventos -- --cuadre   compara con asistencia_motivos (solo lectura) y escribe el informe
//                                               privado/sporteasy/cuadre_eventos_<fecha>.md
//   npm run db:asistencia-eventos -- --confirmar <ref>   carga en el real (cada temporada se REEMPLAZA entera en una
//                                               transacción: repetible). --cuadre también pide el destino. Norma 19:
//                                               sin --confirmar <ref> ni --pila no se conecta (lib/destino.mjs).
//   npm run db:asistencia-eventos -- 2025-26    solo esa temporada
//
// Con D111: volcado previo, huella de permisos y cuentas de auth antes y después (ver docs/DECISIONS.md, D170).
// Por consola, solo recuentos: nunca nombres. El informe del cuadre (con nombres) va a privado/.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { conectar } from './db.mjs';
import { exigirDestino } from './lib/destino.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
export const E = require(path.join(RAIZ, '..', 'scripts', 'estadisticas', 'asistencia_eventos.js'));

const COLUMNAS = ['person_id', 'evento_ref', 'nombre', 'temporada', 'fecha', 'ambito', 'equipo', 'titulo', 'estado', 'motivo', 'origen'];

/** Reemplaza las filas de SportEasy de una temporada por `filas`, en una transacción. Devuelve cuántas borró y metió. */
export async function cargarEventos(sql, temporada, filas) {
  return sql.begin(async (tx) => {
    const b = await tx`delete from public.asistencia_eventos where temporada = ${temporada} and origen = 'sporteasy'`;
    for (let i = 0; i < filas.length; i += 500) await tx`insert into public.asistencia_eventos ${tx(filas.slice(i, i + 500), COLUMNAS)}`;
    return { borradas: b.count, metidas: filas.length };
  });
}

const pct = (a, b) => (b ? `${Math.round((100 * a) / b)} %` : '—');
const fila = (x) => `${x.fueron}/${x.con_excusa}/${x.sin_excusa}/${x.lesion}/${x.total}`;

/** Informe del cuadre (privado: lleva nombres). */
export function informe(c, nombres) {
  const l = ['# Asistencia por evento frente a asistencia_motivos (D170) — PRIVADO (no subir)', '',
    'Cada celda: fueron / con excusa / sin excusa / lesión / total contable (fueron + con excusa + sin excusa: «no convocado» y',
    '«lesión» salen del cálculo). «Eventos» = la tabla nueva; «Resumen» = asistencia_motivos. Una persona×ámbito es «igual» si',
    'coinciden fueron, con excusa y sin excusa.', '',
    '| Temporada | Eventos | Resumen | Personas×ámbito iguales | Distintas | Solo eventos | Solo resumen |', '|---|---|---|---|---|---|---|'];
  for (const [t, x] of Object.entries(c.porTemporada).sort()) l.push(`| ${t} | ${fila(x.eventos)} | ${fila(x.resumen)} | ${x.iguales} | ${x.distintas} | ${x.soloEventos} | ${x.soloResumen} |`);
  const por = {};
  for (const d of c.detalle) (por[d.k.split('|')[0]] ||= []).push(d);
  for (const [t, ds] of Object.entries(por).sort()) {
    l.push('', `## ${t}: ${ds.length} diferencias`, '', '| Persona | Ámbito | Tipo | Eventos (f/exc/sin/les/total) | Resumen (f/exc/sin/les/total contable · no conv.) |', '|---|---|---|---|---|');
    for (const d of ds) {
      const [, pid, ambito] = d.k.split('|');
      const r = d.resumen; const e = d.eventos;
      l.push(`| ${nombres.get(pid) ?? pid} | ${ambito} | ${d.tipo} | ${e ? fila({ ...e, total: e.fueron + e.con_excusa + e.sin_excusa }) : '—'} | ${r ? `${fila({ ...r, total: r.fueron + r.con_excusa + r.sin_excusa })} · no conv. ${r.no_convocado}` : '—'} |`);
    }
  }
  return l.join('\n') + '\n';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dry = process.argv.includes('--dry');
  const args = dry ? process.argv.slice(2) : (await exigirDestino(process.argv.slice(2))).args;
  const cuadre = args.includes('--cuadre');
  const pedidas = args.filter((a) => !a.startsWith('--'));
  const calc = E.calcular(E.cargarEntradas());
  const filas = calc.filas.filter((f) => !pedidas.length || pedidas.includes(f.temporada));
  const porT = {};
  for (const f of filas) (porT[f.temporada] ||= []).push(f);
  for (const [t, fs_] of Object.entries(porT)) {
    console.log(`${dry ? '[dry] ' : ''}${t}: ${new Set(fs_.map((f) => f.evento_ref)).size} eventos, ${new Set(fs_.map((f) => f.person_id)).size} personas, ${fs_.length} filas`);
  }
  if (dry) process.exit(0);
  const sql = conectar();
  try {
    if (cuadre) {
      const resumen = await sql`select temporada, person_id, nombre, ambito, fueron, excusa, sin_excusa, no_conv, lesion, total from public.asistencia_motivos`;
      const c = E.cuadrar(filas, resumen.filter((r) => !pedidas.length || pedidas.includes(r.temporada)));
      for (const [t, x] of Object.entries(c.porTemporada).sort()) {
        console.log(`${t}: eventos ${fila(x.eventos)} · resumen ${fila(x.resumen)} · iguales ${x.iguales}, distintas ${x.distintas}, solo eventos ${x.soloEventos}, solo resumen ${x.soloResumen}`);
      }
      const nombres = new Map(resumen.map((r) => [r.person_id, r.nombre]));
      const f = path.join(RAIZ, '..', 'privado', 'sporteasy', `cuadre_eventos_${new Date().toISOString().slice(0, 10)}.md`);
      fs.writeFileSync(f, informe(c, nombres));
      console.log(`Informe (con nombres, fuera de git): ${path.relative(path.join(RAIZ, '..'), f)}`);
    } else {
      for (const [t, fs_] of Object.entries(porT)) {
        const r = await cargarEventos(sql, t, fs_);
        console.log(`${t}: ${r.borradas} filas sustituidas por ${r.metidas} (solo gestores)`);
      }
    }
  } finally { await sql.end(); }
}
