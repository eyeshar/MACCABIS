#!/usr/bin/env node
// Privacidad de las paginas publicas migradas (D17, D39, D46, D82): lee el HTML que sirve la web nueva (con la carga RSC
// que lleva los datos a la pantalla) y falla si aparece un motivo de ausencia, un nivel de jugador, un DNI, un telefono, un
// correo o una fecha de nacimiento. Lo ejecuta `npm run test:privacidad` (desde la raiz) cuando hay una compilacion.
//
//   node pruebas/privacidad_paginas.mjs        (necesita `npm run build` hecho)
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.join(RAIZ, '..');
const PUERTO = 3212, APP = `http://127.0.0.1:${PUERTO}`;
const indice = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'index.json'), 'utf8'));
const temporadas = indice.seasons.map((s) => s.id);
const rivales = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'rivales_2026-27_web.json'), 'utf8')).rivales;

/** Una ficha por jugador y temporada (todas las de GitHub Pages). */
function personasPorTemporada() {
  return temporadas.flatMap((t) => JSON.parse(fs.readFileSync(path.join(REPO, 'data', `season_${t}.json`), 'utf8')).players.map((p) => `/jugador/${p.person_id}?t=${t}`));
}

/** Todas las paginas publicas que migran de GitHub Pages (se amplia en cada entrega). */
export const RUTAS = [
  '/historia', '/historia?persona=eric', '/historia?persona=barreiro-carballal-carlos-jose',
  '/plantilla', ...temporadas.map((t) => `/plantilla?t=${t}`), '/jugador',
  ...personasPorTemporada(),
  '/liga', '/liga?g=G2', '/liga/rivales', '/liga/rivales?g=MdL',
  ...rivales.filter((r) => !r.sin_rastro).slice(0, 6).map((r) => `/liga/rivales?g=${r.grupo}&r=${r.id}`),
  ...temporadas.flatMap((t) => ['equipo', 'jugadores', 'rankings', 'cuartos', 'asistencia', 'mda'].map((p) => `/liga/${t}/${p}`)),
];

/** Claves de datos personales o privados: si salen como clave JSON en la carga de la pagina, fallo. */
const CLAVES = /\\?"(dni|nif|telefono|tel|movil|fecha_nacimiento|nacimiento|fecha_alta|nivel|email|correo|posicion|dobla|si_dobla|si_entrena|excusa|sin_excusa|no_conv|lesion|pct_disp|pct_nosel|pct_jug|motivo|motivos)\\?":/;
const PATRONES = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/, 'un correo electronico'],
  [/(?<![\d.,])\d{8}[A-Z](?![A-Za-z])/, 'un DNI'],
  [/(?<![\d.,:/-])[6-9]\d{2}[ .-]?\d{3}[ .-]?\d{3}(?![\d.,])/, 'un telefono'],
  [/\b(0?[1-9]|[12]\d|3[01])[/-](0?[1-9]|1[0-2])[/-](19[4-9]\d|200\d)\b/, 'una fecha de nacimiento (dd/mm/aaaa de 1940 a 2009)'],
];

export async function revisar({ log = console.log } = {}) {
  const next = path.join(RAIZ, 'node_modules', 'next', 'dist', 'bin', 'next');
  const app = spawn(process.execPath, [next, 'start', '-p', String(PUERTO), '-H', '127.0.0.1'], { cwd: RAIZ, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, stdio: 'ignore' });
  let fallos = 0;
  try {
    const fin = Date.now() + 60000;
    for (;;) { try { await fetch(`${APP}/liga`); break; } catch { if (Date.now() > fin) throw new Error('la web no arranca'); await new Promise((r) => setTimeout(r, 300)); } }
    for (const ruta of RUTAS) {
      const r = await fetch(APP + ruta, { redirect: 'follow' });
      const html = await r.text();
      const malos = [];
      const c = html.match(CLAVES); if (c) malos.push(`clave ${c[1]}`);
      for (const [re, que] of PATRONES) { const m = html.match(re); if (m) malos.push(`${que} (${m[0]})`); }
      if (r.status !== 200 || malos.length) { fallos++; log(`  FALLO ${ruta} -> ${r.status !== 200 ? 'estado ' + r.status : ''} ${malos.join(', ')}`); }
    }
    log(`  ${fallos ? 'FALLO' : 'OK   '} ${RUTAS.length} paginas publicas migradas: sin motivos de ausencia, niveles, DNI, telefonos, correos ni fechas de nacimiento`);
  } finally { app.kill(); }
  return fallos;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit((await revisar()) ? 1 : 0);
