#!/usr/bin/env node
// Guardia de destino (norma 19, D187) contra la pila local de verdad: los scripts, lanzados como procesos hijo con
// `--pila` y la conexion que devuelve `arrancar()` (dbUrl), trabajan en la pila; y las vueltas atras ensayadas que
// pide la norma: `db:revertir` (el .revertir.sql de la ultima migracion, con sus paradas) y `db:d111-liga`
// (foto, volcado y vuelta atras de la liga). Ninguno lee plataforma/.env.local.
//
//   npm run pruebas:destino-pila
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as pila from './pila.mjs';

const PLAT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };

const ultima = fs.readdirSync(path.join(PLAT, 'supabase', 'migrations')).filter((f) => /^\d+_.+\.revertir\.sql$/.test(f)).sort().pop();
const versionUltima = ultima.split('_')[0];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pruebas-destino-pila-'));
const e = await pila.arrancar();
const { sql } = e;
function correr(fichero, args) {
  // la conexion de ESTA pila, explicita (D187: nunca la de .env.local)
  const env = { ...process.env, SUPABASE_DB_URL: e.dbUrl, NEXT_PUBLIC_SUPABASE_URL: e.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: e.anonKey };
  for (const k of ['SUPABASE_SERVICE_ROLE_KEY', 'AVISOS_SECRETO']) delete env[k];
  // Asincrono: la pasarela de la pila vive en ESTE proceso; con spawnSync no podria contestar al hijo (foto pide la API).
  return new Promise((fin) => {
    const hijo = spawn(process.execPath, [path.join(PLAT, fichero), ...args], { cwd: tmp, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let salida = '';
    hijo.stdout.on('data', (d) => { salida += d; });
    hijo.stderr.on('data', (d) => { salida += d; });
    const reloj = setTimeout(() => hijo.kill(), 120000);
    hijo.on('close', (codigo) => { clearTimeout(reloj); fin({ codigo, salida }); });
  });
}
const registrada = async (v) => (await sql`select 1 from supabase_migrations.schema_migrations where version = ${v}`).length === 1;
const ultimas = (s) => s.trim().split('\n').slice(-3).join(' / ').slice(0, 400);

try {
  console.log('\n== La conexión de la pila');
  ok(/^postgres:\/\/[^@]+@127\.0\.0\.1:\d+\//.test(e.dbUrl || ''), 'arrancar() devuelve dbUrl, en 127.0.0.1');

  console.log(`\n== db:revertir (${ultima}) en la pila`);
  ok(await registrada(versionUltima), 'la última migración está aplicada');
  let r = await correr('scripts/db.mjs', ['revertir', versionUltima]);
  ok(r.codigo === 3 && /DESTINO NO COMPROBADO/.test(r.salida) && await registrada(versionUltima), 'sin --pila no revierte nada', ultimas(r.salida));
  const anteriores = (await sql`select version from supabase_migrations.schema_migrations order by version desc limit 2`).map((x) => x.version);
  r = await correr('scripts/db.mjs', ['revertir', anteriores[1], '--pila']);
  ok(r.codigo === 1 && /posterior/.test(r.salida) && await registrada(anteriores[1]), 'una migración con posteriores aplicadas: para', ultimas(r.salida));
  r = await correr('scripts/db.mjs', ['revertir', versionUltima, '--pila']);
  ok(r.codigo === 0 && /Destino comprobado: la pila local/.test(r.salida) && /Revertida/.test(r.salida), 'con --pila: revierte', ultimas(r.salida));
  ok(!(await registrada(versionUltima)), 'y quita su registro');
  r = await correr('scripts/db.mjs', ['revertir', versionUltima, '--pila']);
  ok(r.codigo === 1 && /no esta aplicada/.test(r.salida), 'otra vez: no está aplicada, no hace nada', ultimas(r.salida));
  r = await correr('scripts/db.mjs', ['revertir', '20990101000000', '--pila']);
  ok(r.codigo === 1 && /no es una migracion/.test(r.salida), 'una migración que no existe: para', ultimas(r.salida));
  r = await correr('scripts/db.mjs', ['migrar', '--pila']);
  ok(r.codigo === 0 && await registrada(versionUltima), 'db:migrar --pila la vuelve a aplicar', ultimas(r.salida));

  console.log('\n== db:d111-liga en la pila: foto, volcado, carga y vuelta atrás');
  const T = '2026-27';
  const partido = async (grupo, jornada, local, visitante, pl, pv) => {
    const [p] = await sql`insert into public.liga_partidos (temporada, grupo, jornada, local, visitante, pts_local, pts_visitante)
      values (${T}, ${grupo}, ${jornada}, ${local}, ${visitante}, ${pl}, ${pv}) returning id`;
    await sql`insert into public.liga_estadisticas_jugador (partido_id, equipo, dorsal, nombre, pts) values (${p.id}, ${local}, '4', 'Sint Uno', ${pl}), (${p.id}, ${visitante}, '5', 'Sint Dos', ${pv})`;
  };
  await partido('G1', 1, 'Sint Local', 'Sint Visitante', 50, 40);
  r = await correr('scripts/d111_liga.mjs', ['foto', 'antes.json', '--pila']);
  ok(r.codigo === 0 && /Destino comprobado: la pila local/.test(r.salida), 'foto (solo lectura) con --pila', ultimas(r.salida));
  r = await correr('scripts/d111_liga.mjs', ['volcar', 'volcado.json', '--pila']);
  ok(r.codigo === 0 && fs.existsSync(path.join(tmp, 'volcado.json')), 'volcado con --pila', ultimas(r.salida));
  await partido('G2', 1, 'Sint Tres', 'Sint Cuatro', 30, 31);   // «la carga» que se quiere deshacer
  await sql`update public.liga_partidos set pts_local = 51 where grupo = 'G1'`;
  r = await correr('scripts/d111_liga.mjs', ['revertir', 'volcado.json']);
  ok(r.codigo === 3 && (await sql`select count(*)::int n from public.liga_partidos`)[0].n === 2, 'revertir sin destino no toca nada', ultimas(r.salida));
  r = await correr('scripts/d111_liga.mjs', ['revertir', 'volcado.json', '--pila']);
  ok(r.codigo === 0 && /revertido/.test(r.salida), 'revertir con --pila', ultimas(r.salida));
  r = await correr('scripts/d111_liga.mjs', ['foto', 'despues.json', '--pila']);
  const leer = (f) => JSON.parse(fs.readFileSync(path.join(tmp, f), 'utf8'));
  if (r.codigo === 0) {
    const [a, d] = [leer('antes.json'), leer('despues.json')];
    ok(JSON.stringify(a) === JSON.stringify(d), 'la foto de después es idéntica a la de antes');
    ok(a.g12.partidos === 1 && a.g12.filas === 2 && a.auth_usuarios === d.auth_usuarios, 'y cuenta lo que hay (1 partido, 2 filas)', JSON.stringify(a.g12).slice(0, 200));
  } else ok(false, 'foto de después', ultimas(r.salida));
} finally {
  await e.parar();
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exitCode = fallos ? 1 : 0;
