#!/usr/bin/env node
// La comprobacion de la jornada SIN navegador de la rutina A (pruebas/verificar_jornada.mjs, D179):
//   - la base: lo que espera sale de las hojas (lo que carga db:liga) y de liga.json; contra la pila, con partidos
//     sinteticos, la lectura en solo lectura da OK y cada fallo (marcador, filas por jugador, partido de mas o de menos)
//     se ve;
//   - la web: «web» hace UNA sola peticion a /liga (contra un servidor local, nunca produccion) y mira el marcador; la
//     espera al despliegue lee el estado de GitHub (aqui, falso).
// Que el HTML de verdad de /liga lo pasa, lo mira pruebas:cache-publica con la web compilada.
//
//   npm run pruebas:jornada-sin-navegador
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as pila from './pila.mjs';
import { PUERTOS, exigirLibres } from './infra/puertos.mjs';
import { jornadaPublicada, esperadoBase, leerBase, compararBase, comprobarHtml, esperarDespliegue } from './verificar_jornada.mjs';

const PLAT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };
const todasOk = (l) => l.length > 0 && l.every((x) => x.ok);
const malas = (l) => l.filter((x) => !x.ok).map((x) => x.texto);

// --- 1. Lo publicado (liga.json de git, publico)
console.log('\n== La jornada publicada (src/data/liga.json)');
const liga = JSON.parse(fs.readFileSync(path.join(PLAT, 'src', 'data', 'liga.json'), 'utf8'));
const publicada = jornadaPublicada(liga);
ok(publicada.map((x) => x.grupo).join() === 'G1,G2' && publicada.every((x) => x.jornada > 0 && x.partidos.length > 0),
  `G1 y G2 con su última jornada (${publicada.map((x) => `${x.grupo} J${x.jornada}: ${x.partidos.length} partidos`).join(', ')})`);

// Jornada sintetica: G1 J2 con una incomparecencia (no tiene hoja) y G2 J1
const SINT = [
  { grupo: 'G1', jornada: 2, partidos: [
    { id: 'g1-j02-sint-a-sint-b', local: 'Sint A', visitante: 'Sint B', pl: 50, pv: 40, incomparecencia: false },
    { id: 'g1-j02-sint-c-sint-d', local: 'Sint C', visitante: 'Sint D', pl: 20, pv: 0, incomparecencia: true }] },
  { grupo: 'G2', jornada: 1, partidos: [{ id: 'g2-j01-sint-e-sint-f', local: 'Sint E', visitante: 'Sint F', pl: 31, pv: 30, incomparecencia: false }] },
];
const jug = (n) => Array.from({ length: n }, (_, i) => ({ nombre: `Sint ${i}`, pts: 1 }));
const PRIVADO = [
  { grupo: 'G1', jornada: 1, local: 'Sint A', visitante: 'Sint C', pl: 10, pv: 12, equipos: [{ equipo: 'Sint A', jugadores: jug(5) }, { equipo: 'Sint C', jugadores: jug(5) }] },
  { grupo: 'G1', jornada: 2, local: 'Sint A', visitante: 'Sint B', pl: 50, pv: 40, equipos: [{ equipo: 'Sint A', jugadores: jug(8) }, { equipo: 'Sint B', jugadores: jug(7) }] },
  { grupo: 'G2', jornada: 1, local: 'Sint E', visitante: 'Sint F', pl: 31, pv: 30, equipos: [{ equipo: 'Sint E', jugadores: jug(6) }, { equipo: 'Sint F', jugadores: jug(9) }] },
];

console.log('\n== Lo que tiene que haber en la base');
const esp = esperadoBase(SINT, PRIVADO);
ok(esp.fallos.length === 0, 'las hojas cuadran con liga.json (la incomparecencia no tiene hoja)', esp.fallos.join(' / '));
ok(esp.grupos[0].partidos.length === 1 && esp.grupos[0].partidos[0].filas['Sint A'] === 8 && esp.grupos[1].partidos[0].filas['Sint F'] === 9,
  'solo los partidos de esa jornada, con las filas por jugador de cada equipo');
const otra = esperadoBase(SINT, PRIVADO.map((p) => (p.jornada === 2 ? { ...p, pl: 51 } : p)));
ok(otra.fallos.length === 1 && /G1 J2/.test(otra.fallos[0]), 'una hoja con otro marcador que liga.json: lo dice', otra.fallos.join(' / '));

// --- 2. La base, contra la pila
const T = '2026-27';
const e = await pila.arrancar();
const { sql } = e;
let servidor;
try {
  console.log('\n== La base (pila): solo lectura y cada fallo');
  const partido = async (grupo, jornada, local, visitante, pl, pv, filas) => {
    const [p] = await sql`insert into public.liga_partidos (temporada, grupo, jornada, local, visitante, pts_local, pts_visitante)
      values (${T}, ${grupo}, ${jornada}, ${local}, ${visitante}, ${pl}, ${pv}) returning id`;
    for (const [eq, n] of Object.entries(filas)) {
      for (let i = 0; i < n; i++) await sql`insert into public.liga_estadisticas_jugador (partido_id, equipo, dorsal, nombre, pts) values (${p.id}, ${eq}, ${String(i)}, ${`Sint ${i}`}, 1)`;
    }
    return p.id;
  };
  await sql`delete from public.liga_partidos where temporada = ${T}`;
  await partido('G1', 1, 'Sint A', 'Sint C', 10, 12, { 'Sint A': 5, 'Sint C': 5 });
  const idG1 = await partido('G1', 2, 'Sint A', 'Sint B', 50, 40, { 'Sint A': 8, 'Sint B': 7 });
  await partido('G2', 1, 'Sint E', 'Sint F', 31, 30, { 'Sint E': 6, 'Sint F': 9 });
  const comprobar = async () => compararBase(esp.grupos, await leerBase(sql, T, esp.grupos));
  let l = await comprobar();
  ok(todasOk(l) && l.length === 2, 'la jornada cargada: OK (G1 J2 y G2 J1)', malas(l).join(' / '));
  await sql`update public.liga_partidos set pts_local = 49 where id = ${idG1}`;
  l = await comprobar();
  ok(malas(l).length === 1 && /marcador 49 – 40/.test(malas(l)[0]), 'otro marcador en la base: falla', malas(l).join(' / '));
  await sql`update public.liga_partidos set pts_local = 50 where id = ${idG1}`;
  await sql`delete from public.liga_estadisticas_jugador where id = (select id from public.liga_estadisticas_jugador where partido_id = ${idG1} and equipo = 'Sint B' limit 1)`;
  l = await comprobar();
  ok(malas(l).length === 1 && /Sint B: 6 filas por jugador en la base, 7/.test(malas(l)[0]), 'falta una fila por jugador: falla', malas(l).join(' / '));
  await sql`delete from public.liga_estadisticas_jugador where partido_id = ${idG1}`;
  l = await comprobar();
  ok(malas(l).length === 1 && /Sint A: 0 filas/.test(malas(l)[0]), 'el partido sin filas por jugador: falla', malas(l).join(' / '));
  await partido('G2', 1, 'Sint G', 'Sint H', 1, 2, { 'Sint G': 1, 'Sint H': 1 });
  await sql`delete from public.liga_partidos where id = ${idG1}`;
  l = await comprobar();
  ok(malas(l).some((x) => /Sint A – Sint B: no está en la base/.test(x)) && malas(l).some((x) => /Sint G – Sint H: está en la base y no en las hojas/.test(x)),
    'un partido que falta y otro de más: fallan los dos', malas(l).join(' / '));
  let soloLectura = false;
  try { await sql.begin('read only', (tx) => tx`delete from public.liga_partidos where temporada = ${T}`); } catch (x) { soloLectura = /read-only/.test(x.message); }
  ok(soloLectura, 'la lectura va en una transacción de solo lectura (en ella no se puede borrar)');
  await sql`delete from public.liga_partidos where temporada = ${T}`;
} finally {
  await e.parar();
}

// --- 3. La web: el HTML, una sola peticion y la espera al despliegue
try {
  console.log('\n== El HTML de /liga');
  const plano = (p) => `{"id":"${p.id}","jornada":JJ,"fecha":"2026-10-04","local":"${p.local}","local_id":"x","visitante":"${p.visitante}","visitante_id":"y","pl":${p.pl},"pv":${p.pv},"est":{}}`;
  const pagina = (pub, { marcadorG1 } = {}) => {
    const g1 = pub.find((x) => x.grupo === 'G1');
    const vistos = g1.partidos.map((p) => `<div class="e-partido" data-partido="${p.id}"><span><a href="/x">${p.local}</a></span><a href="/p" class="e-m">${p.incomparecencia ? 'incomp.' : (marcadorG1 ?? `${p.pl} – ${p.pv}`)}</a></div>`).join('');
    const datos = pub.flatMap((g) => g.partidos.map((p) => plano(p).replace('JJ', g.jornada))).join(',');
    return `<html><body><div class="e-desc"><b>Jornada <!-- -->${g1.jornada}</b></div>${vistos}<script>self.__next_f.push([1,"[${datos.replace(/"/g, '\\"')}]"])</script></body></html>`;
  };
  ok(todasOk(comprobarHtml(pagina(SINT), SINT)), 'con la jornada y sus marcadores: OK', malas(comprobarHtml(pagina(SINT), SINT)).join(' / '));
  ok(malas(comprobarHtml(pagina(SINT, { marcadorG1: '49 – 40' }), SINT)).some((x) => /Sint A 50 – 40/.test(x)), 'otro marcador a la vista en G1: falla');
  const sinG2 = SINT.map((g) => (g.grupo === 'G2' ? { ...g, partidos: g.partidos.map((p) => ({ ...p, pl: 99 })) } : g));
  ok(malas(comprobarHtml(pagina(SINT), sinG2)).length === 1, 'un marcador de G2 que no está en los datos de la página: falla');
  const anterior = SINT.map((g) => ({ ...g, jornada: g.jornada + 1 }));
  ok(!todasOk(comprobarHtml(pagina(SINT), anterior)), 'la página todavía con la jornada anterior: falla');

  console.log('\n== «web»: una sola petición, a un servidor local');
  const PUERTO = PUERTOS.aux(0);
  await exigirLibres({ 'jornada-sin-navegador: /liga falsa': PUERTO });
  const peticiones = [];
  const html = pagina(publicada);
  servidor = http.createServer((q, r) => { peticiones.push(q.url); r.writeHead(q.url === '/liga' ? 200 : 404, { 'content-type': 'text/html' }); r.end(q.url === '/liga' ? html : ''); });
  await new Promise((r) => servidor.listen(PUERTO, '127.0.0.1', r));
  const correr = (args) => new Promise((fin) => {
    const env = { ...process.env };
    for (const k of ['SUPABASE_DB_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) delete env[k];
    const hijo = spawn(process.execPath, [path.join(PLAT, 'pruebas', 'verificar_jornada.mjs'), ...args], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let salida = '';
    hijo.stdout.on('data', (d) => { salida += d; });
    hijo.stderr.on('data', (d) => { salida += d; });
    const reloj = setTimeout(() => hijo.kill(), 60000);
    hijo.on('close', (codigo) => { clearTimeout(reloj); fin({ codigo, salida }); });
  });
  const r = await correr(['web', `http://127.0.0.1:${PUERTO}`]);
  ok(r.codigo === 0 && /Todo OK/.test(r.salida), 'la jornada publicada en /liga: OK', r.salida.trim().split('\n').slice(-3).join(' / '));
  ok(peticiones.length === 1 && peticiones[0] === '/liga', `una sola petición, a /liga (${peticiones.join(', ')})`);

  console.log('\n== La espera al despliegue (GitHub falso)');
  const falso = (estados) => { let i = 0; return async (u) => (u.startsWith('deployments?') ? [{ id: 1 }] : [{ state: estados[Math.min(i++, estados.length - 1)] }]); };
  ok((await esperarDespliegue('abc', { api: falso(['pending', 'in_progress', 'success']), cada: 1 })).estado === 'desplegado', 'espera hasta que el despliegue termina');
  ok((await esperarDespliegue('abc', { api: falso(['failure']), cada: 1 })).estado === 'fallido', 'un despliegue fallido: lo dice');
  ok((await esperarDespliegue('abc', { api: async () => { throw new Error('GitHub 503'); }, cada: 1 })).estado === 'sin-github', 'GitHub no contesta: lo dice (y la rutina espera 4 minutos)');
  ok((await esperarDespliegue('abc', { api: async () => [], cada: 1, maximo: 30 })).estado === 'sin-terminar', 'sin despliegue de ese commit: se acaba el tiempo');
} finally {
  servidor?.close();
}

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exitCode = fallos ? 1 : 0;
