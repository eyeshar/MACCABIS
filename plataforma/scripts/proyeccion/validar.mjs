#!/usr/bin/env node
// Validacion de la proyeccion de anotacion (D132): la tabla de variantes con error medio y sesgo, dejando uno fuera
// (la correccion de sesgo de cada partido se aprende con los DEMAS). La variante elegida (V6) es la de la web: se
// comprueba que sale igual que `calibrar` de src/lib/convocatoria/proyeccion.ts.
//
// Lee las letras de Ataque, la plantilla y la dificultad marcada en cada convocatoria aprobada de
// privado/tmp/sesgo_db.json (FUERA DE GIT). Con --leer lo regenera antes desde la base (SUPABASE_DB_URL de .env.local)
// en una transaccion de SOLO LECTURA. En la salida solo hay totales de equipo: nada de letras ni datos por jugador.
//
//   npm run proyeccion:validar               con privado/tmp/sesgo_db.json
//   npm run proyeccion:validar -- --leer     lo regenera antes desde la base (solo lectura)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import postgres from 'postgres';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPO = path.join(RAIZ, '..');
const require = createRequire(import.meta.url);
dotenv.config({ path: path.join(RAIZ, '.env.local'), quiet: true });
const P = await import(pathToFileURL(path.join(RAIZ, 'src', 'lib', 'convocatoria', 'proyeccion.ts')).href);
const A = require(path.join(RAIZ, 'src', 'data', 'avisosEquipacion.js'));
const leer = (f) => JSON.parse(fs.readFileSync(path.join(RAIZ, 'src', 'data', f), 'utf8'));
const DB = path.join(REPO, 'privado', 'tmp', 'sesgo_db.json');

if (process.argv.includes('--leer')) {
  if (!process.env.SUPABASE_DB_URL) { console.error('Falta SUPABASE_DB_URL en plataforma/.env.local.'); process.exit(1); }
  const local = /localhost|127\.0\.0\.1/.test(process.env.SUPABASE_DB_URL);
  const sql = postgres(process.env.SUPABASE_DB_URL, { ssl: local ? false : 'require', onnotice: () => {}, max: 1 });
  const out = {};
  try {
    await sql.begin('read only', async (tx) => {
      out.jugadores = await tx`select person_id, nombre_visible, activo, rol from public.jugadores`;
      out.letras = Object.fromEntries((await tx`select person_id, nota_ataque from public.jugadores_privado`).map((x) => [x.person_id, x.nota_ataque]));
      out.convocatorias = await tx`select fecha::text, jornada, estado, dificultad from public.convocatorias where estado = 'aprobada' order by fecha`;
    });
  } finally { await sql.end({ timeout: 5 }); }
  fs.mkdirSync(path.dirname(DB), { recursive: true });
  fs.writeFileSync(DB, JSON.stringify(out));
  console.log(`privado/tmp/sesgo_db.json regenerado (solo lectura): ${out.jugadores.length} personas, ${out.convocatorias.length} convocatorias aprobadas.`);
}
if (!fs.existsSync(DB)) { console.error('Falta privado/tmp/sesgo_db.json: npm run proyeccion:validar -- --leer'); process.exit(1); }

const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
const equip = leer('equipaciones.json'), actual = leer('estadisticas/season_2026-27.json'), anterior = leer('estadisticas/season_2025-26.json'), liga = leer('liga.json');
const historial = leer('historialRivales.json').rivales;
const clave = (n) => A.clave(A.equipoPorNombre(equip, n)?.nombre ?? n);
const letra = (id) => db.letras[id] ?? null;
const plantilla = db.jugadores.filter((j) => j.activo && j.rol !== 'entrenador').map((j) => j.person_id);
const historialDe = (rival) => { const r = historial.find((x) => clave(x.nombre) === clave(rival)); return r?.factor ? { temporada: r.temporada, factor: r.factor, pj: r.pj } : null; };
const dificultadDe = (fecha, eq) => db.convocatorias.find((c) => c.fecha === fecha && c.estado === 'aprobada')?.dificultad?.[eq.toUpperCase() === 'MDA' ? 'MdA' : 'MdL']?.valor ?? null;
const partidos = [...actual.partidos].sort((a, b) => a.pn - b.pn || a.equipo.localeCompare(b.equipo));

/** Proyeccion sin corregir de un partido con las opciones de la variante. */
function base(p, o) {
  P.PROYECCION.soloActual = !!o.soloActual;
  const hist = P.historiales(actual, anterior, p.pn);
  const tasas = P.tasasPorLetra(plantilla.map((id) => ({ letra: letra(id), hist: hist(id) })));
  const ids = actual.players.filter((j) => j.person_id && (j.games ?? []).some((g) => g.pn === p.pn && g.eq.toUpperCase() === p.equipo.toUpperCase())).map((j) => j.person_id);
  const conv = ids.map((id) => ({ person_id: id, nombre: id, letra: letra(id), hist: hist(id) }));
  const est = P.estadisticasGrupo(liga, p.equipo.toUpperCase() === 'MDA' ? 'G1' : 'G2', clave, p.pn);
  const rival = est.rival(p.rival);
  let sinFactor;
  if (o.minutosActual) {
    const min = P.repartirMinutos(conv.map((c) => (c.hist.actual.partidos ? c.hist.actual.min / c.hist.actual.partidos : P.minutosMedios(c.hist))));
    sinFactor = conv.reduce((s, c, i) => s + P.tasaDe(c.hist, c.letra, tasas).ppm * min[i], 0);
  } else sinFactor = P.proyectar({ convocados: conv, tasas, rival: null, grupo: null, jornadasJugadas: 0 }).sinFactor;
  let factor;
  if (o.factorD124) factor = rival && rival.pj >= 2 && est.grupo.pj > 0 ? (rival.pc / rival.pj) / (est.grupo.pc / est.grupo.pj) : 1;
  else factor = P.factorRival(o.b === false ? null : rival, est.grupo, { dificultad: o.a === false ? null : dificultadDe(p.fecha, p.equipo), historial: o.c === false ? null : historialDe(p.rival) }).factor;
  P.PROYECCION.soloActual = true;
  return { p, proy: sinFactor * factor };
}
function evalua(nombre, o) {
  const filas = partidos.map((p) => base(p, o));
  for (const x of filas) x.final = o.sesgo ? x.proy * P.correccionSesgo(filas.filter((y) => y !== x).map((y) => ({ sinCorreccion: y.proy, real: y.p.pf }))) : x.proy;
  const dif = filas.map((x) => Math.round(x.final) - x.p.pf);
  const mae = dif.reduce((s, e) => s + Math.abs(e), 0) / dif.length, sesgo = dif.reduce((s, e) => s + e, 0) / dif.length;
  return { nombre, mae, sesgo, filas };
}
const fmt = (x) => x.toFixed(1).replace('.', ',');
const V = [
  evalua('V0 · D124 (la de antes)', { factorD124: true }),
  evalua('V1 · factor rival combinado (a + b + c)', {}),
  evalua('V1a · solo la dificultad marcada', { b: false, c: false }),
  evalua('V1b · solo esta temporada', { a: false, c: false }),
  evalua('V1c · solo el historial', { a: false, b: false }),
  evalua('V2 · V1 + solo esta temporada si hay 60 min', { soloActual: true }),
  evalua('V3 · V1 + minutos de esta temporada', { minutosActual: true }),
  evalua('V4 · V2 + V3', { soloActual: true, minutosActual: true }),
  evalua('V5 · V1 + corrección de sesgo', { sesgo: true }),
  evalua('V6 · V2 + corrección de sesgo (D132, la de la web)', { soloActual: true, sesgo: true }),
  evalua('V7 · V4 + corrección de sesgo', { soloActual: true, minutosActual: true, sesgo: true }),
  evalua('V8 · V0 + corrección de sesgo', { factorD124: true, sesgo: true }),
];
console.log(`\nValidación de la proyección dejando uno fuera · ${partidos.length} partidos (sesgo negativo = se queda corta)\n`);
console.log(`${'Variante'.padEnd(52)} ${'Error medio'.padStart(11)} ${'Sesgo'.padStart(7)}`);
for (const v of V) console.log(`${v.nombre.padEnd(52)} ${fmt(v.mae).padStart(11)} ${((v.sesgo > 0 ? '+' : '') + fmt(v.sesgo)).padStart(7)}`);
const v6 = V.find((v) => v.nombre.startsWith('V6'));
console.log(`\nV6 partido a partido (proyección / real): ${v6.filas.map((x) => `J${x.p.pn} ${x.p.equipo.toUpperCase() === 'MDA' ? 'MdA' : 'MdL'} ${Math.round(x.final)}/${x.p.pf}`).join(' · ')}`);
// La de la web: calibrar con la misma entrada tiene que dar lo mismo que V6.
const web = P.calibrar({ actual, anterior, liga, clave, letra, nombre: (id) => id, plantilla, dificultad: dificultadDe, historial: historialDe });
const igual = web.length === v6.filas.length && web.every((x, i) => x.proyeccion === Math.round(v6.filas[i].final));
console.log(`${P.resumenCalibracion(web)?.texto ?? 'Sin partidos'} (calibrar de la web: ${igual ? 'igual que V6' : 'DISTINTO de V6'}).`);
console.log(`Corrección de sesgo para el próximo partido: ×${P.correccionSesgo(web).toFixed(3).replace('.', ',')} (${web.length} partidos${web.length < P.PROYECCION.partidosCorreccion ? ', a medio camino de 1 hasta los 8' : ''}).`);
if (!igual) process.exit(1);
