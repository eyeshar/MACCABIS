#!/usr/bin/env node
// Cuadre 1:1 de la tabla de eventos con la fuente que hoy alimenta el calendario publico (D94, mitigacion 4). SOLO LEE.
//
//   npm run eventos:cuadre            contra el Supabase de .env.local
//
// Comprueba:
//  1. Los 40 partidos de liga de la tabla = los 40 de data/calendario_2026-27.json (leido en Deportes/web el
//     02/10/2026): equipo, jornada, rival, local/visitante, fecha, hora y pista, uno a uno.
//  2. Los 4 descansos (MdA en J4 y J15, MdL en J11 y J22) y que no hay ningun partido en esas jornadas.
//  3. La serie de entrenos: 27 miercoles (31 menos los 4 sin sesion), con la excepcion del 07/10 en la Caja Magica.
//  4. Contra la copia que ya vive en Supabase (liga_calendario, 44 filas): mismas fechas, horas, rivales y pistas.
//  5. Contra lo escrito en la documentacion el 02/10 (D62 / ESTADO / rutina B): dos domingos con las dos fichas a la
//     misma hora (18/10 y 07/02, 10:15) y J1 de MdA visitante en la pista 2.
//  6. Cada rival tiene sus colores en data/equipaciones_2026-27.json (los avisos de equipacion siguen funcionando).
// Si algo no cuadra, sale con codigo 1 y NO elige cual es el bueno: lo reporta.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { conectar } from './db.mjs';
import { partidosIniciales, entrenosIniciales } from './cargar_eventos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.join(RAIZ, '..');
const require = createRequire(import.meta.url);
const hhmm = (t) => (t ? String(t).slice(0, 5) : null);
const dia = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d ? String(d).slice(0, 10) : null);

export async function cuadrar(sql, { log = console.log } = {}) {
  let fallos = 0, comprobaciones = 0;
  const ok = (c, m, d = '') => { comprobaciones++; if (!c) { fallos++; log(`  FALLO ${m}${d ? ` -> ${d}` : ''}`); } };
  const cal = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'calendario_2026-27.json'), 'utf8'));
  const equip = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'equipaciones_2026-27.json'), 'utf8'));
  const A = require(path.join(REPO, 'data', 'avisos_equipacion.js'));
  const { partidos, descansos } = partidosIniciales(cal);
  const entrenos = entrenosIniciales();

  const ev = await sql`select e.*, p.slug as pista_slug from public.eventos e left join public.pistas p on p.id = e.pista_id where e.temporada = '2026-27'`;
  const porClave = new Map(ev.map((e) => [e.clave, e]));
  const liga = ev.filter((e) => e.tipo === 'liga');
  const ent = ev.filter((e) => e.tipo === 'entreno' && e.serie === 'entreno-semanal');

  // 1. Partidos
  ok(partidos.length === 40, `la fuente tiene 40 partidos`, String(partidos.length));
  ok(liga.length === 40, `la tabla tiene 40 partidos de liga`, String(liga.length));
  let iguales = 0;
  for (const p of partidos) {
    const e = porClave.get(p.clave);
    if (!e) { ok(false, `falta ${p.clave}`); continue; }
    const dif = [];
    if (e.equipo !== p.equipo) dif.push(`equipo ${e.equipo}≠${p.equipo}`);
    if (e.jornada !== p.jornada) dif.push(`jornada`);
    if (e.rival !== p.rival) dif.push(`rival ${e.rival}≠${p.rival}`);
    if (e.es_local !== p.es_local) dif.push(`local ${e.es_local}≠${p.es_local}`);
    if (dia(e.fecha) !== p.fecha) dif.push(`fecha ${dia(e.fecha)}≠${p.fecha}`);
    if (hhmm(e.inicio) !== p.inicio) dif.push(`hora ${hhmm(e.inicio)}≠${p.inicio}`);
    if (e.numero_pista !== p.numero_pista) dif.push(`pista ${e.numero_pista}≠${p.numero_pista}`);
    if (e.pista_slug !== 'cdm-moratalaz') dif.push(`recinto ${e.pista_slug}`);
    ok(!dif.length, `${p.clave} igual que la fuente`, dif.join('; '));
    if (!dif.length) iguales++;
  }
  log(`  partidos: ${iguales}/40 idénticos a data/calendario_2026-27.json`);

  // 2. Descansos
  const des = await sql`select equipo, jornada, fecha from public.descansos where temporada = '2026-27' order by equipo, jornada`;
  ok(des.length === 4 && descansos.length === 4, `4 descansos`, `${des.length} / ${descansos.length}`);
  const descTxt = des.map((d) => `${d.equipo}-J${d.jornada}`).join(' ');
  ok(descTxt === 'MdA-J15 MdA-J4 MdL-J11 MdL-J22' || descTxt === 'MdA-J4 MdA-J15 MdL-J11 MdL-J22' || [...des].map((d) => `${d.equipo}-J${d.jornada}`).sort().join(' ') === 'MdA-J15 MdA-J4 MdL-J11 MdL-J22',
    'descansos: MdA en J4 y J15, MdL en J11 y J22', descTxt);
  for (const d of des) ok(!liga.some((e) => e.equipo === d.equipo && e.jornada === d.jornada), `${d.equipo} J${d.jornada}: descansa y no tiene partido`);
  for (const d of descansos) ok(des.some((x) => x.equipo === d.equipo && x.jornada === d.jornada && dia(x.fecha) === d.fecha), `descanso ${d.equipo} J${d.jornada} con su fecha`);
  ok(liga.filter((e) => e.equipo === 'MdA').length === 20 && liga.filter((e) => e.equipo === 'MdL').length === 20, '20 partidos de MdA y 20 de MdL');

  // 3. Entrenos
  ok(entrenos.length === 27, 'la fuente genera 27 entrenos (31 miércoles menos 4 sin sesión)', String(entrenos.length));
  ok(ent.length === 27, 'la tabla tiene 27 entrenos de la serie', String(ent.length));
  let entIguales = 0;
  for (const x of entrenos) {
    const e = porClave.get(x.clave);
    if (!e) { ok(false, `falta ${x.clave}`); continue; }
    const dif = [];
    if (dia(e.fecha) !== x.fecha) dif.push('fecha');
    if (hhmm(e.inicio) !== x.inicio || hhmm(e.fin) !== x.fin) dif.push(`horas ${hhmm(e.inicio)}-${hhmm(e.fin)}≠${x.inicio}-${x.fin}`);
    if ((e.pista_slug ?? null) !== x.pista_slug) dif.push(`pista ${e.pista_slug}≠${x.pista_slug}`);
    if ((e.notas ?? null) !== (x.notas ?? null)) dif.push('nota');
    ok(!dif.length, `${x.clave} igual que la fuente`, dif.join('; '));
    if (!dif.length) entIguales++;
  }
  log(`  entrenos: ${entIguales}/27 idénticos a data/entrenos_2026-27.json`);
  for (const f of ['2026-12-23', '2026-12-30', '2027-01-06', '2027-03-24']) ok(!porClave.has(`entreno-semanal-${f}`), `sin entreno el ${f}`);
  ok(ent.map((e) => dia(e.fecha)).sort().at(-1) === '2027-05-05', 'último entreno el 05/05/2027');
  ok(porClave.get('entreno-semanal-2026-10-07')?.pista_slug === 'caja-magica', '07/10: Caja Mágica de 20:00 a 21:00');

  // 4. Contra liga_calendario (la copia que ya vive en Supabase)
  const lc = await sql`select * from public.liga_calendario where temporada = '2026-27'`;
  if (!lc.length) log('  (liga_calendario vacía en este entorno: se omite el cruce 4)');
  else {
    ok(lc.length === 44, 'liga_calendario tiene 44 filas', String(lc.length));
    for (const c of lc) {
      const eq = c.equipo === 'MDA' ? 'MdA' : 'MdL';
      if (c.descansa) { ok(des.some((d) => d.equipo === eq && d.jornada === c.jornada), `liga_calendario ${eq} J${c.jornada} descansa = descansos`); continue; }
      const e = porClave.get(`${c.equipo.toLowerCase()}-j${c.jornada}`);
      ok(!!e && dia(e.fecha) === dia(c.fecha) && hhmm(e.inicio) === hhmm(c.hora) && e.rival === c.rival && e.es_local === c.local && String(e.numero_pista) === String(c.campo),
        `liga_calendario ${eq} J${c.jornada} = eventos`);
    }
  }

  // 5. Lo documentado el 02/10
  for (const f of ['2026-10-18', '2027-02-07']) {
    const dos = liga.filter((e) => dia(e.fecha) === f);
    ok(dos.length === 2 && hhmm(dos[0].inicio) === '10:15' && hhmm(dos[1].inicio) === '10:15', `${f}: las dos fichas a las 10:15`);
  }
  const j1 = porClave.get('mda-j1');
  ok(j1 && j1.es_local === false && j1.numero_pista === 2, 'J1 de MdA: visitante, pista 2');

  // 6. Colores de cada rival
  const sin = liga.filter((e) => !A.equipoPorNombre(equip, e.rival)).map((e) => e.rival);
  ok(!sin.length, 'todos los rivales tienen colores en equipaciones_2026-27.json', [...new Set(sin)].join(', '));

  log(fallos ? `CUADRE: ${fallos} FALLO(S) de ${comprobaciones} comprobaciones.` : `CUADRE OK: ${comprobaciones} comprobaciones, 40 partidos, 4 descansos y 27 entrenos idénticos a la fuente actual.`);
  return { fallos, comprobaciones, partidos: liga.length, descansos: des.length, entrenos: ent.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { config } = await import('dotenv');
  config({ path: path.join(RAIZ, '.env.local') });
  const sql = conectar();
  try {
    await sql.unsafe('set default_transaction_read_only = on');
    const r = await cuadrar(sql);
    process.exitCode = r.fallos ? 1 : 0;
  } finally { await sql.end(); }
}
