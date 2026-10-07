#!/usr/bin/env node
// Carga INICIAL de los eventos de 2026/27 en Supabase (paso 2, pista E, D94): los 40 partidos de liga que hoy alimentan
// el calendario publico (data/calendario_2026-27.json), las 4 jornadas de descanso, la serie de entrenos de los
// miercoles (data/entrenos_2026-27.json) y el diccionario de nombres de SportEasy.
//
//   npm run db:eventos            carga (conexion de .env.local)
//   npm run db:eventos -- --dry   solo cuenta, sin escribir
//
// SOLO INSERTA (D94): `on conflict do nothing`. Nunca borra ni actualiza: repetirlo no duplica ni pisa lo que se haya
// editado ya desde la web. Los eventos se identifican por su `clave` (la misma que usa el calendario publico:
// `mda-j2`, `entreno-semanal-2026-10-14`).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { conectar } from './db.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.join(RAIZ, '..');
const leer = (...p) => JSON.parse(fs.readFileSync(path.join(REPO, ...p), 'utf8'));

const NOMBRE = { MDA: 'MdA', MDL: 'MdL' };
const sumarDias = (f, n) => { const x = new Date(`${f}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const diaSemana = (f) => new Date(`${f}T12:00:00Z`).getUTCDay();

/** Partidos de liga y descansos del calendario del Ayuntamiento (leido en Deportes/web el 02/10/2026). */
export function partidosIniciales(cal = leer('data', 'calendario_2026-27.json')) {
  const partidos = [], descansos = [];
  for (const p of cal.partidos) {
    if (p.descansa) { descansos.push({ equipo: NOMBRE[p.equipo], jornada: p.jornada, fecha: p.fecha }); continue; }
    partidos.push({
      clave: `${p.equipo.toLowerCase()}-j${p.jornada}`,
      tipo: 'liga', equipo: NOMBRE[p.equipo], jornada: p.jornada, rival: p.rival, es_local: p.local,
      fecha: p.fecha, inicio: p.hora ?? null, fin: null, numero_pista: p.campo ? Number(p.campo) : null,
      origen: 'ayuntamiento',
    });
  }
  return { partidos, descansos };
}

/** Una fila por miercoles de entreno con las excepciones aplicadas (mismas reglas que la web publica). */
export function entrenosIniciales(ent = leer('data', 'entrenos_2026-27.json'), cal = leer('data', 'calendario_2026-27.json')) {
  const fin = cal.partidos.map((p) => p.fecha).filter(Boolean).sort().at(-1);
  const filas = [];
  for (const s of ent.series) {
    const hasta = s.hasta ?? fin;
    let f = s.desde;
    while (diaSemana(f) !== s.dia_semana % 7) f = sumarDias(f, 1);
    for (; f <= hasta; f = sumarDias(f, 7)) {
      const ex = ent.excepciones.find((x) => x.serie === s.id && x.fecha === f);
      if (ex?.cancelado) continue;
      filas.push({
        clave: `${s.id}-${f}`, tipo: 'entreno', equipo: 'ambos', titulo: s.titulo, fecha: f,
        inicio: ex?.inicio ?? s.inicio, fin: ex?.fin ?? s.fin,
        pista_slug: ex?.pista ?? null, notas: ex?.nota ?? null, serie: s.id, origen: 'manual',
      });
    }
  }
  return filas;
}

export const diccionarioInicial = () => Object.entries(leer('scripts', 'estadisticas', 'nombres_sporteasy.json').nombres);

export async function cargarEventos(sql, { log = console.log } = {}) {
  const { partidos, descansos } = partidosIniciales();
  const entrenos = entrenosIniciales();
  const pistas = Object.fromEntries((await sql`select id, slug from public.pistas`).map((p) => [p.slug, p.id]));
  for (const s of ['cdm-moratalaz', 'valdebernardo', 'caja-magica']) if (!pistas[s]) throw new Error(`Falta la pista ${s} (¿migración sin aplicar?)`);
  const contar = async () => (await sql`select count(*)::int n from public.eventos`)[0].n;
  const antes = await contar();
  await sql.begin(async (tx) => {
    for (const p of partidos) {
      await tx`insert into public.eventos (clave, tipo, equipo, jornada, rival, es_local, fecha, inicio, fin, pista_id, numero_pista, origen,
                                           sporteasy_estado, sporteasy_cambio, sporteasy_copiado_en)
               values (${p.clave}, ${p.tipo}, ${p.equipo}, ${p.jornada}, ${p.rival}, ${p.es_local}, ${p.fecha}, ${p.inicio}, ${p.fin},
                       ${pistas['cdm-moratalaz']}, ${p.numero_pista}, ${p.origen}, 'copiado',
                       ${p.clave === 'mda-j1' ? 'En SportEasy figura como local; el Ayuntamiento lo da como visitante. Se decidió no tocarlo (02/10/2026).' : null},
                       '2026-10-02T12:00:00+02:00')
               on conflict (clave) do nothing`;
    }
    for (const e of entrenos) {
      await tx`insert into public.eventos (clave, tipo, equipo, titulo, fecha, inicio, fin, pista_id, notas, serie, origen,
                                           sporteasy_estado, sporteasy_cambio)
               values (${e.clave}, ${e.tipo}, ${e.equipo}, ${e.titulo}, ${e.fecha}, ${e.inicio}, ${e.fin},
                       ${e.pista_slug ? pistas[e.pista_slug] : null}, ${e.notas}, ${e.serie}, ${e.origen},
                       'pendiente', 'Carga inicial de la serie: comprobar en SportEasy y copiar si falta')
               on conflict (clave) do nothing`;
    }
    for (const d of descansos) {
      await tx`insert into public.descansos (equipo, jornada, fecha) values (${d.equipo}, ${d.jornada}, ${d.fecha}) on conflict do nothing`;
    }
    for (const [nombre, person] of diccionarioInicial()) {
      await tx`insert into public.diccionario_sporteasy (nombre_sporteasy, person_id, creado_por) values (${nombre}, ${person}, 'carga inicial') on conflict do nothing`;
    }
  });
  const despues = await contar();
  log(`Eventos: ${despues - antes} nuevos (${partidos.length} partidos y ${entrenos.length} entrenos previstos; ${descansos.length} descansos; ${diccionarioInicial().length} nombres de SportEasy). Ya había ${antes}.`);
  return { partidos: partidos.length, entrenos: entrenos.length, descansos: descansos.length, nuevos: despues - antes };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { config } = await import('dotenv');
  config({ path: path.join(RAIZ, '.env.local') });
  if (process.argv.includes('--dry')) {
    const { partidos, descansos } = partidosIniciales();
    console.log(`[dry] ${partidos.length} partidos, ${descansos.length} descansos, ${entrenosIniciales().length} entrenos, ${diccionarioInicial().length} nombres`);
    process.exit(0);
  }
  const sql = conectar();
  try { await cargarEventos(sql); } finally { await sql.end(); }
}
