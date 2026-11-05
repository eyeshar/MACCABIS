#!/usr/bin/env node
// Migración 20261103210000 (revisión de seguridad de la base, 03/11/2026) reversible (D111), en la pila local:
//   aplicada  → v_eventos_publicos sin «notas» (el resto de columnas y valores, iguales; anon y authenticated solo leen),
//               los 4 índices de claves foráneas, la política de suscripciones con (select auth.uid()) y authenticated
//               sin endpoint/p256dh/auth;
//   revertida → todo como antes (la vista con «notas» en su sitio, sin índices, política y permisos de antes, sin registro);
//   aplicada de nuevo → igual que la primera vez.
//
//   npm run pruebas:seguridad-base
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pila from './pila.mjs';
import { migrar } from './infra/migrar.mjs';
import { cargarEventos } from './infra/calendario.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = '20261103210000';
const REVERTIR = path.join(RAIZ, 'supabase', 'migrations', `${VERSION}_seguridad_base.revertir.sql`);
const INDICES = ['entreno_defecto_quitado_person_idx', 'eventos_pista_idx', 'respuestas_ausencia_idx', 'respuestas_domingo_solo_evento_idx'];
const CLAVES_PUSH = ['endpoint', 'p256dh', 'auth'];
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };

const e = await pila.arrancar();
const { sql } = e;
try {
  await cargarEventos(sql, { log: () => {} });
  await sql`update public.eventos set notas = 'Nota de un gestor' where clave = (select clave from public.eventos where tipo = 'entreno' order by fecha limit 1)`;
  const columnas = async () => (await sql`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'v_eventos_publicos' order by ordinal_position`).map((r) => r.column_name);
  const registrada = async () => (await sql`select 1 from supabase_migrations.schema_migrations where version = ${VERSION}`).length === 1;
  const privilegios = async () => (await sql`select r, p, has_table_privilege(r, 'public.v_eventos_publicos', p) si from unnest(array['anon', 'authenticated']) r, unnest(array['select', 'insert', 'update', 'delete']) p`)
    .filter((x) => x.si).map((x) => `${x.r}:${x.p}`).sort().join();
  const indices = async () => (await sql`select indexname from pg_indexes where schemaname = 'public' and indexname = any(${INDICES})`).length;
  const politica = async () => (await sql`select pg_get_expr(polqual, polrelid) q from pg_policy where polrelid = 'public.suscripciones_avisos'::regclass and polname = 'cada_cual_lee_las_suyas'`)[0].q;
  const leeClaves = async () => (await sql`select bool_or(has_column_privilege('authenticated', 'public.suscripciones_avisos', c, 'select')) x from unnest(${CLAVES_PUSH}::text[]) c`)[0].x;
  const leeActiva = async () => (await sql`select has_column_privilege('authenticated', 'public.suscripciones_avisos', 'activa', 'select') x`)[0].x;
  const comunes = async () => JSON.stringify(await sql.unsafe(`select ${(await columnas()).filter((c) => c !== 'notas').join(', ')} from public.v_eventos_publicos order by clave`));
  const notasPublicas = async () => (await sql`select count(*)::int n from public.v_eventos_publicos where to_jsonb(v_eventos_publicos) ->> 'notas' is not null`)[0].n;

  console.log('\n== Aplicada');
  const cols = await columnas();
  ok(await registrada(), 'la migración está registrada');
  ok(!cols.includes('notas') && cols.includes('quedada') && cols.includes('ubicacion_direccion'), 'la vista pública no tiene «notas» y sí el resto', cols.join());
  ok((await notasPublicas()) === 0, 'ninguna nota sale por la vista (la del gestor sigue en la tabla)');
  ok((await privilegios()) === 'anon:select,authenticated:select', 'anon y authenticated solo leen la vista', await privilegios());
  ok((await indices()) === 4, 'los 4 índices de claves foráneas');
  ok(/SELECT auth\.uid\(\)/i.test(await politica()) && /SELECT is_gestor\(\)/i.test(await politica()), 'la política usa (select auth.uid()) y (select is_gestor())', await politica());
  ok(!(await leeClaves()) && (await leeActiva()), 'authenticated no lee endpoint, p256dh ni auth; sí «activa»');
  const aplicada = await comunes();

  console.log('\n== Revertida');
  await sql.begin((tx) => tx.unsafe(fs.readFileSync(REVERTIR, 'utf8')));
  const antes = await columnas();
  ok(!(await registrada()), 'revertir.sql borra su registro');
  ok(antes.indexOf('notas') === antes.indexOf('quedada') + 1 && antes.length === cols.length + 1, '«notas» vuelve a su sitio (tras «quedada»)', antes.join());
  ok((await notasPublicas()) === 1, 'y con ella la nota del gestor');
  ok((await comunes()) === aplicada, 'el resto de columnas, con los mismos valores en todas las filas');
  ok((await privilegios()) === 'anon:select,authenticated:select', 'mismos permisos de la vista');
  ok((await indices()) === 0, 'sin los 4 índices');
  ok(!/SELECT auth\.uid\(\)/i.test(await politica()) && /auth\.uid\(\)/.test(await politica()), 'la política de antes', await politica());
  ok((await leeClaves()) && (await leeActiva()), 'authenticated vuelve a leer toda la tabla');

  console.log('\n== Aplicada de nuevo');
  await migrar(sql, { log: () => {} });
  ok(await registrada() && !(await columnas()).includes('notas') && (await indices()) === 4 && !(await leeClaves()), 'se vuelve a aplicar y registrar, igual que la primera vez');
  ok((await comunes()) === aplicada && (await privilegios()) === 'anon:select,authenticated:select', 'mismos valores y permisos');
} catch (err) {
  console.log(`  FALLO ${err.stack}`); fallos++;
} finally {
  await e.parar();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
