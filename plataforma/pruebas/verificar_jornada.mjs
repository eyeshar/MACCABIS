#!/usr/bin/env node
// Comprobacion de la jornada recien publicada, SIN navegador (D179; la usa la rutina A en su paso 5). Dos partes:
//
//   node pruebas/verificar_jornada.mjs base --confirmar <ref>   en la base real, en solo lectura (transaccion read only):
//                                                               los partidos de G1 y G2 de la ultima jornada cargada
//                                                               (src/data/liga.json) estan, con su marcador y sus filas
//                                                               por jugador (las que da db:liga con las hojas locales).
//                                                               Norma 19: sin el ref del real, o --pila, no se conecta.
//   node pruebas/verificar_jornada.mjs web [url] [--commit <sha>]
//                                                               UNA sola peticion HTTP (fetch) a <url>/liga: 200 y el HTML
//                                                               trae los marcadores de esa jornada. Con --commit, antes
//                                                               espera a que GitHub diga que Vercel ha desplegado ese
//                                                               commit en produccion (pregunta a la API de GitHub, no a
//                                                               produccion); si GitHub no contesta, espera 4 minutos.
//
// Por consola, solo equipos (publicos), marcadores y recuentos: ningun nombre de jugador. La verificacion completa con
// navegador (verificar_produccion.mjs) queda solo para uso manual.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const GRUPOS = ['G1', 'G2'];
export const REPO_GITHUB = 'eyeshar/MACCABIS';
const PRODUCCION = 'https://maccabis.vercel.app';

/** La ultima jornada cargada de cada grupo y sus partidos tal como se publican (src/data/liga.json). */
export function jornadaPublicada(liga) {
  return GRUPOS.map((g) => {
    const G = liga.grupos[g];
    const jornada = G.jornadas_cargadas.at(-1);
    const partidos = G.resultados.filter((r) => r.jornada === jornada)
      .map((r) => ({ id: r.id, local: r.local, visitante: r.visitante, pl: r.pl, pv: r.pv, incomparecencia: !!r.incomparecencia }));
    return { grupo: g, jornada, partidos };
  });
}

/** Lo que tiene que haber en la base para esas jornadas, a partir de lo que carga db:liga (leerLiga().privado). Las
 *  incomparecencias no tienen hoja: no van a la base. Devuelve tambien los desacuerdos entre las hojas y liga.json. */
export function esperadoBase(publicada, privado) {
  const fallos = [];
  const grupos = publicada.map(({ grupo, jornada, partidos }) => {
    const hojas = privado.filter((p) => p.grupo === grupo && p.jornada === jornada).map((p) => ({
      local: p.local, visitante: p.visitante, pl: p.pl, pv: p.pv,
      filas: Object.fromEntries(p.equipos.map((e) => [e.equipo, e.jugadores.length])),
    }));
    const clave = (p) => `${p.local}|${p.visitante}|${p.pl}-${p.pv}`;
    const pub = partidos.filter((p) => !p.incomparecencia).map(clave).sort();
    const loc = hojas.map(clave).sort();
    if (pub.join() !== loc.join()) fallos.push(`${grupo} J${jornada}: las hojas (${loc.join(', ') || 'ninguna'}) no cuadran con liga.json (${pub.join(', ') || 'ninguno'})`);
    return { grupo, jornada, partidos: hojas };
  });
  return { grupos, fallos };
}

/** Lee de la base, en solo lectura, los partidos de esas jornadas con sus filas por equipo. */
export async function leerBase(sql, temporada, grupos) {
  return sql.begin('read only', async (tx) => {
    const r = [];
    for (const { grupo, jornada } of grupos) {
      const filas = await tx`
        select p.local, p.visitante, p.pts_local pl, p.pts_visitante pv, e.equipo, count(e.id)::int n
          from public.liga_partidos p left join public.liga_estadisticas_jugador e on e.partido_id = p.id
         where p.temporada = ${temporada} and p.grupo = ${grupo} and p.jornada = ${jornada}
         group by p.id, p.local, p.visitante, p.pts_local, p.pts_visitante, e.equipo`;
      const partidos = {};
      for (const f of filas) {
        const k = `${f.local}|${f.visitante}`;
        partidos[k] ??= { local: f.local, visitante: f.visitante, pl: f.pl, pv: f.pv, filas: {} };
        if (f.equipo != null) partidos[k].filas[f.equipo] = f.n;
      }
      r.push({ grupo, jornada, partidos: Object.values(partidos) });
    }
    return r;
  });
}

/** Compara lo esperado con lo leido. Devuelve una linea por partido (ok o el fallo). */
export function compararBase(esperado, leido) {
  const lineas = [];
  for (const e of esperado) {
    const l = leido.find((x) => x.grupo === e.grupo && x.jornada === e.jornada) ?? { partidos: [] };
    if (!e.partidos.length) lineas.push({ ok: false, texto: `${e.grupo} J${e.jornada}: no hay partidos con hoja que comprobar` });
    for (const p of e.partidos) {
      const b = l.partidos.find((x) => x.local === p.local && x.visitante === p.visitante);
      const nombre = `${e.grupo} J${e.jornada} ${p.local} – ${p.visitante}`;
      if (!b) { lineas.push({ ok: false, texto: `${nombre}: no está en la base` }); continue; }
      const malas = [];
      if (b.pl !== p.pl || b.pv !== p.pv) malas.push(`marcador ${b.pl} – ${b.pv} en la base, ${p.pl} – ${p.pv} en las hojas`);
      for (const [eq, n] of Object.entries(p.filas)) if ((b.filas[eq] ?? 0) !== n) malas.push(`${eq}: ${b.filas[eq] ?? 0} filas por jugador en la base, ${n} en la hoja`);
      for (const eq of Object.keys(b.filas)) if (!(eq in p.filas)) malas.push(`filas de un equipo que no juega ese partido (${eq})`);
      lineas.push(malas.length ? { ok: false, texto: `${nombre}: ${malas.join('; ')}` }
        : { ok: true, texto: `${nombre} ${p.pl} – ${p.pv}, ${Object.values(p.filas).reduce((s, n) => s + n, 0)} filas por jugador` });
    }
    for (const b of l.partidos) {
      if (!e.partidos.some((p) => p.local === b.local && p.visitante === b.visitante)) lineas.push({ ok: false, texto: `${e.grupo} J${e.jornada} ${b.local} – ${b.visitante}: está en la base y no en las hojas` });
    }
  }
  return lineas;
}

/** Comprueba el HTML de /liga: G1 se ve ya hecho (data-partido con su marcador); G1 y G2 van en los datos de la pagina
 *  (el cambio de grupo es del navegador, sin otra peticion). */
export function comprobarHtml(html, publicada) {
  const lineas = [];
  const datos = html.replace(/\\"/g, '"');   // los datos de la pagina van como texto JSON escapado
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const g1 = publicada.find((x) => x.grupo === 'G1');
  if (g1) {
    const visto = new RegExp(`<b>Jornada (?:<!-- -->)?${g1.jornada}</b>`).test(html);
    lineas.push({ ok: visto, texto: `G1: se ve la jornada ${g1.jornada}` });
  }
  for (const { grupo, jornada, partidos } of publicada) {
    if (!partidos.length) lineas.push({ ok: false, texto: `${grupo} J${jornada}: liga.json no tiene partidos de esa jornada` });
    for (const p of partidos) {
      const marcador = p.incomparecencia ? 'incomp.' : `${p.pl} – ${p.pv}`;
      const enDatos = p.incomparecencia ? datos.includes(`"id":"${p.id}"`)
        : new RegExp(`"id":"${esc(p.id)}","jornada":${jornada},[^{}]*?"pl":${p.pl},"pv":${p.pv}[,}]`).test(datos);
      let ok = enDatos;
      if (grupo === 'G1') {
        const i = html.indexOf(`data-partido="${p.id}"`);
        ok = ok && i >= 0 && html.slice(i, i + 1500).includes(`>${marcador}<`);
      }
      lineas.push({ ok, texto: `${grupo} J${jornada} ${p.local} ${marcador} ${p.visitante}` });
    }
  }
  return lineas;
}

/** Espera a que GitHub diga que el despliegue de produccion de ese commit ha terminado (lo publica Vercel). */
export async function esperarDespliegue(commit, { maximo = 600000, cada = 20000, token, api } = {}) {
  const h = { accept: 'application/vnd.github+json', 'user-agent': 'maccabis-rutina-a', ...(token ? { authorization: `Bearer ${token}` } : {}) };
  api ??= (u) => fetch(`https://api.github.com/repos/${REPO_GITHUB}/${u}`, { headers: h, signal: AbortSignal.timeout(20000) })
    .then((r) => { if (!r.ok) throw new Error(`GitHub ${r.status}`); return r.json(); });
  const fin = Date.now() + maximo;
  let errores = 0;
  while (Date.now() < fin) {
    try {
      const deps = await api(`deployments?sha=${commit}&environment=Production`);
      for (const d of deps) {
        const [ultimo] = await api(`deployments/${d.id}/statuses?per_page=1`);
        if (ultimo?.state === 'success') return { estado: 'desplegado' };
        if (ultimo && ['failure', 'error'].includes(ultimo.state)) return { estado: 'fallido' };
      }
    } catch (e) {
      if (++errores >= 3) return { estado: 'sin-github', motivo: e.message };
    }
    await new Promise((r) => setTimeout(r, cada));
  }
  return { estado: 'sin-terminar' };
}

function tokenGit() {
  try {
    const s = execFileSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', windowsHide: true,
      timeout: 15000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' } });
    return s.match(/^password=(.*)$/m)?.[1];
  } catch { return undefined; }
}

const imprimir = (lineas) => { for (const l of lineas) console.log(`  ${l.ok ? 'OK   ' : 'FALLO'} ${l.texto}`); return lineas.filter((l) => !l.ok).length; };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [modo] = process.argv.slice(2);
  if (!['base', 'web'].includes(modo)) {
    console.error('Uso: node pruebas/verificar_jornada.mjs base --confirmar <ref> (o --pila) · web [url] [--commit <sha>]');
    process.exit(1);
  }
  let fallos = 0;
  if (modo === 'base') {
    // norma 19: el destino, antes de leer nada ni conectarse (solo lee, pero la conexion es la del real)
    const { exigirDestino } = await import('../scripts/lib/destino.mjs');
    await exigirDestino(process.argv.slice(2));
    const { conectar } = await import('../scripts/db.mjs');
    const { leerLiga } = await import('../scripts/cargar_liga.mjs');
    const liga = JSON.parse(fs.readFileSync(path.join(RAIZ, 'src', 'data', 'liga.json'), 'utf8'));
    const publicada = jornadaPublicada(liga);
    console.log(`\n== La base, en solo lectura: ${publicada.map((x) => `${x.grupo} J${x.jornada}`).join(' y ')}`);
    try {
      const { grupos, fallos: incoherentes } = esperadoBase(publicada, leerLiga(liga.temporada).privado);
      fallos += imprimir(incoherentes.map((texto) => ({ ok: false, texto })));
      const sql = conectar();
      try { fallos += imprimir(compararBase(grupos, await leerBase(sql, liga.temporada, grupos))); } finally { await sql.end(); }
    } catch (e) { fallos += imprimir([{ ok: false, texto: `ERROR: ${e.message}` }]); }
  } else {
    const args = process.argv.slice(3);
    const i = args.indexOf('--commit');
    const commit = i >= 0 ? args[i + 1] : null;
    const BASE = (args.find((a, k) => !a.startsWith('--') && args[k - 1] !== '--commit') || PRODUCCION).replace(/\/$/, '');
    const publicada = jornadaPublicada(JSON.parse(fs.readFileSync(path.join(RAIZ, 'src', 'data', 'liga.json'), 'utf8')));
    if (commit) {
      console.log(`\n== Esperando al despliegue de ${commit.slice(0, 7)} (su estado en GitHub, no en producción)`);
      const d = await esperarDespliegue(commit, { token: tokenGit() });
      if (d.estado === 'desplegado') console.log('  desplegado en producción');
      else if (d.estado === 'sin-github') { console.log(`  GitHub no contesta (${d.motivo}): se esperan 4 minutos`); await new Promise((r) => setTimeout(r, 240000)); }
      else fallos += imprimir([{ ok: false, texto: d.estado === 'fallido' ? 'Vercel dice que el despliegue ha fallado' : 'el despliegue no ha terminado en 10 minutos' }]);
    }
    console.log(`\n== Una petición a ${BASE}/liga (sin navegador)`);
    try {
      const r = await fetch(`${BASE}/liga`, { redirect: 'manual', signal: AbortSignal.timeout(30000), headers: { 'user-agent': 'maccabis-rutina-a' } });
      const html = await r.text();
      fallos += imprimir([{ ok: r.status === 200, texto: `/liga responde ${r.status}` }]);
      if (r.status === 200) fallos += imprimir(comprobarHtml(html, publicada));
    } catch (e) { fallos += imprimir([{ ok: false, texto: `/liga no responde: ${e.message}` }]); }
  }
  console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
  process.exitCode = fallos ? 1 : 0;
}
