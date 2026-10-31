#!/usr/bin/env node
// data/calendario_2026-27.json es una COPIA GENERADA de la tabla de eventos (D151): la tabla es la unica fuente del
// calendario (D47/D95). Este comando la regenera, y con ella la copia de la plataforma (plataforma/src/data/calendario.json).
// SOLO LEE, y solo lo publico: las vistas v_eventos_publicos y v_descansos_publicos con la clave anonima de .env.local
// (lo mismo que ve la web). No toca la base.
//
//   npm run calendario:exportar               regenera data/calendario_2026-27.json y su copia
//   npm run calendario:exportar -- --check    solo compara: sale con 1 si el fichero no es copia fiel de la tabla
//
// Lo lanza solo la rutina A (`npm run jornada`, antes de procesar la jornada). Si la tabla no responde, no cambia nada.
// Formato: el de siempre (lo leen el pipeline de estadisticas, index.html y las pruebas). Los partidos cancelados no
// salen (igual que en la web publica); el rival va tal como esta en la tabla (como lo da el Ayuntamiento).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.join(RAIZ, '..');
const TEMPORADA = '2026-27';
export const FICHERO = path.join(REPO, 'data', `calendario_${TEMPORADA}.json`);
const COPIA = path.join(RAIZ, 'src', 'data', 'calendario.json');
const GRUPO = { MDA: 'JDM MOR DOM MAÑ BC SEN MAS G1', MDL: 'JDM MOR DOM MAÑ BC SEN MAS G2' };
const CODIGO = { MdA: 'MDA', MdL: 'MDL' };

const fila = (o) => ({
  equipo: o.equipo, fase: 'liga', grupo: GRUPO[o.equipo], jornada: o.jornada, fecha: o.fecha, hora: o.hora, local: o.local,
  descansa: o.descansa, rival: o.rival, rival_codigo: null, campo: o.campo, estado: null, pf: null, pc: null, fuente: 'Deportes/web',
});

/** El JSON del calendario a partir de las filas de las vistas publicas (funcion pura: la prueba la usa con datos fijos). */
export function calendarioDesdeTabla(eventos, descansos, { origen } = {}) {
  const partidos = [];
  for (const e of eventos) {
    if (e.tipo !== 'liga' || e.estado === 'cancelado' || !CODIGO[e.equipo] || e.jornada == null) continue;
    partidos.push(fila({
      equipo: CODIGO[e.equipo], jornada: e.jornada, fecha: e.fecha, hora: e.inicio ? String(e.inicio).slice(0, 5) : null,
      local: e.es_local, descansa: false, rival: e.rival, campo: e.numero_pista ? String(e.numero_pista) : null,
    }));
  }
  for (const d of descansos) {
    if (!CODIGO[d.equipo]) continue;
    partidos.push(fila({ equipo: CODIGO[d.equipo], jornada: d.jornada, fecha: d.fecha, hora: null, local: null, descansa: true, rival: null, campo: null }));
  }
  // El orden de siempre: por jornada y, en cada jornada, MdA antes que MdL (un aplazamiento cambia la fecha, no el sitio).
  partidos.sort((a, b) => a.jornada - b.jornada || (a.equipo < b.equipo ? -1 : 1));
  return {
    temporada: TEMPORADA,
    fuente: {
      dataset: null, fichero: null, modificado_portal: null, manual: null,
      origen: origen ?? 'Copia generada de la tabla de eventos (npm run calendario:exportar, D151). No editar a mano: el calendario se cambia en Importar → Calendario.',
    },
    equipos: { MDA: { grupo: GRUPO.MDA, codigos: [] }, MDL: { grupo: GRUPO.MDL, codigos: [] } },
    partidos,
  };
}

export const texto = (cal) => JSON.stringify(cal, null, 1) + '\n';
/** Mismo contenido (en Windows el arbol de trabajo tiene CRLF: se compara el JSON, no los bytes). */
const mismo = (fichero, cal) => fs.existsSync(fichero) && JSON.stringify(JSON.parse(fs.readFileSync(fichero, 'utf8'))) === JSON.stringify(cal);

async function leerVista(url, anon, vista, select) {
  const r = await fetch(`${url}/rest/v1/${vista}?select=${select}&temporada=eq.${TEMPORADA}`, {
    headers: { apikey: anon, Authorization: `Bearer ${anon}` }, signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`${vista}: HTTP ${r.status}`);
  return r.json();
}

/** Lee la tabla (vistas publicas). Lanza si no responde o si no trae partidos: nunca se escribe un calendario vacio. */
export async function leerTabla(url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  if (!url || !anon) throw new Error('faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY (plataforma/.env.local)');
  const [eventos, descansos] = await Promise.all([
    leerVista(url, anon, 'v_eventos_publicos', 'tipo,equipo,jornada,rival,es_local,fecha,inicio,numero_pista,estado'),
    leerVista(url, anon, 'v_descansos_publicos', 'equipo,jornada,fecha'),
  ]);
  const cal = calendarioDesdeTabla(eventos, descansos);
  if (!cal.partidos.some((p) => !p.descansa)) throw new Error('la tabla no trae partidos de liga');
  return cal;
}

/** Cambios partido a partido entre dos calendarios (para el resumen): ["MDA J3: hora 10:15 → 12:30", ...]. */
export function diferencias(antes, despues) {
  const k = (p) => `${p.equipo} J${p.jornada}`;
  const A = new Map(antes.partidos.map((p) => [k(p), p])), D = new Map(despues.partidos.map((p) => [k(p), p]));
  const fuera = [];
  for (const [c, d] of D) {
    const a = A.get(c);
    if (!a) { fuera.push(`${c}: nuevo`); continue; }
    const campos = ['fecha', 'hora', 'local', 'descansa', 'rival', 'campo'].filter((x) => a[x] !== d[x]);
    if (campos.length) fuera.push(`${c}: ${campos.map((x) => `${x} ${a[x]} → ${d[x]}`).join('; ')}`);
  }
  for (const c of A.keys()) if (!D.has(c)) fuera.push(`${c}: ya no está en la tabla`);
  return fuera;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  dotenv.config({ path: path.join(RAIZ, '.env.local'), quiet: true });
  const comprobar = process.argv.includes('--check');
  // process.exitCode (no process.exit) tras un fetch: en Windows, salir con el fetch aun abierto rompe libuv.
  try {
    const cal = await leerTabla();
    const cambios = diferencias(JSON.parse(fs.readFileSync(FICHERO, 'utf8')), cal);
    const igual = mismo(FICHERO, cal) && mismo(COPIA, cal);
    const detalle = cambios.length ? `${cambios.length} cambio(s):\n  ${cambios.join('\n  ')}` : 'solo formato';
    if (comprobar) {
      console.log(igual ? `Calendario: data/calendario_${TEMPORADA}.json es copia fiel de la tabla de eventos.` : `Calendario: el fichero NO coincide con la tabla de eventos (${detalle}). Regenera con npm run calendario:exportar.`);
      process.exitCode = igual ? 0 : 1;
    } else {
      if (!igual) for (const f of [FICHERO, COPIA]) fs.writeFileSync(f, texto(cal), 'utf8');
      const n = cal.partidos.filter((p) => !p.descansa).length;
      console.log(`Calendario: ${n} partidos y ${cal.partidos.length - n} descansos desde la tabla de eventos; ${igual ? 'sin cambios' : detalle}.`);
    }
  } catch (e) {
    console.log(`Calendario: no se ha podido leer la tabla de eventos (${e.message}). El fichero no se toca.`);
    process.exitCode = comprobar ? 1 : 2;
  }
}
