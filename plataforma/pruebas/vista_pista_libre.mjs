#!/usr/bin/env node
// Migración 20261027100000 (vista pública con la ubicación libre, D138) reversible (D111), en la pila local: aplicada,
// v_eventos_publicos trae al final ubicacion_nombre/ubicacion_direccion (solo si el evento no tiene pista propia) y
// las columnas de siempre siguen IGUALES (mismo orden y mismos valores); con el .revertir.sql vuelve la vista de antes,
// con sus permisos, y se borra su registro; aplicada de nuevo, vuelven las columnas.
//
//   npm run pruebas:vista-pista-libre
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pila from './pila.mjs';
import { migrar } from '../scripts/db.mjs';
import { cargarEventos } from '../scripts/cargar_eventos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REVERTIR = path.join(RAIZ, 'supabase', 'migrations', '20261027100000_vista_pista_libre.revertir.sql');
const ANTES = ['clave', 'temporada', 'tipo', 'equipo', 'titulo', 'jornada', 'rival', 'es_local', 'fecha', 'inicio', 'fin', 'quedada', 'notas', 'estado',
  'pista_nombre', 'pista_nombre_corto', 'numero_pista', 'pista_por_confirmar', 'pista_motivo'];
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };

const e = await pila.arrancar();
const { sql } = e;
try {
  await cargarEventos(sql, { log: () => {} });
  const columnas = async () => (await sql`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'v_eventos_publicos' order by ordinal_position`).map((r) => r.column_name);
  const registrada = async () => (await sql`select 1 from supabase_migrations.schema_migrations where version = '20261027100000'`).length === 1;
  const anonLee = async () => (await sql`select has_table_privilege('anon', 'public.v_eventos_publicos', 'select') p`)[0].p;
  const deSiempre = async () => JSON.stringify(await sql.unsafe(`select ${ANTES.join(', ')} from public.v_eventos_publicos order by clave`));
  // Un entreno sin pista propia con ubicación libre (como el del 28/10/2026) y otro CON pista propia y ubicación (manda la pista).
  const [libre, conPista] = await sql`select id, clave from public.eventos where tipo = 'entreno' and pista_id is null order by fecha limit 2`;
  await sql`update public.eventos set ubicacion_nombre = 'Ciudad de los Periodistas', ubicacion_direccion = 'Dirección sintética' where id = ${libre.id}`;
  await sql`update public.eventos set pista_id = (select id from public.pistas where uso = 'entreno' and not es_de_serie order by nombre limit 1), ubicacion_nombre = 'No debe salir' where id = ${conPista.id}`;
  const fila = async (clave) => (await sql`select * from public.v_eventos_publicos where clave = ${clave}`)[0];

  console.log('\n== Aplicada');
  ok(await registrada(), 'la migración está registrada');
  const cols = await columnas();
  ok(cols.join() === [...ANTES, 'ubicacion_nombre', 'ubicacion_direccion'].join(), 'las columnas de siempre, en el mismo orden, y dos nuevas al final', cols.join());
  const f1 = await fila(libre.clave);
  ok(f1.ubicacion_nombre === 'Ciudad de los Periodistas' && f1.ubicacion_direccion === 'Dirección sintética', 'entreno sin pista propia: trae su ubicación libre', JSON.stringify(f1));
  ok(f1.pista_por_confirmar === true && f1.pista_motivo === 'Valdebernardo en obras', 'y sus columnas de siempre no cambian (por confirmar, Valdebernardo en obras): la web decide con la columna nueva');
  const f2 = await fila(conPista.clave);
  ok(f2.ubicacion_nombre === null && f2.ubicacion_direccion === null && f2.pista_nombre && f2.pista_por_confirmar === false, 'con pista propia manda la pista: sin ubicación libre', JSON.stringify(f2));
  ok(await anonLee(), 'anon sigue pudiendo leerla (permisos de siempre)');
  ok((await sql`select count(*)::int n from public.v_eventos_publicos v join public.eventos e on e.clave = v.clave where not e.oficial or e.borrado_en is not null`)[0].n === 0, 'sigue sin planes no oficiales ni borrados');
  const conLaNueva = await deSiempre();

  console.log('\n== Revertida');
  await sql.unsafe(fs.readFileSync(REVERTIR, 'utf8'));
  ok(!(await registrada()), 'revertir.sql borra su registro');
  ok((await columnas()).join() === ANTES.join(), 'la vista vuelve a sus columnas de antes');
  ok(await anonLee(), 'con los mismos permisos (anon lee)');
  ok((await deSiempre()) === conLaNueva, 'y los mismos valores en todas las filas');

  console.log('\n== Aplicada de nuevo');
  await migrar(sql, { log: () => {} });
  ok(await registrada() && (await columnas()).at(-2) === 'ubicacion_nombre' && (await fila(libre.clave)).ubicacion_nombre === 'Ciudad de los Periodistas', 'se vuelve a aplicar y a registrar, con la ubicación libre');
  ok((await deSiempre()) === conLaNueva && await anonLee(), 'mismos valores de siempre y mismos permisos');
} catch (err) {
  console.log(`  FALLO ${err.stack}`); fallos++;
} finally {
  await e.parar();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
