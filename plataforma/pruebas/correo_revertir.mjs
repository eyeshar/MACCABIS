#!/usr/bin/env node
// Migración 20261026120000 (D135) reversible (D111), en la pila local: aplicada, el correo viejo sin cuenta y el nuevo
// con cuenta se enlazan; con el .revertir.sql vuelve el comportamiento anterior (correo_en_uso_auth) y se borra su
// registro; aplicada de nuevo, vuelve D135.
//
//   npm run pruebas:correo-revertir
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pila from './pila.mjs';
import { migrar } from '../scripts/db.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REVERTIR = path.join(RAIZ, 'supabase', 'migrations', '20261026120000_cambiar_correo_sin_cuenta_vieja.revertir.sql');
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };

const e = await pila.arrancar();
const { sql } = e;
try {
  const ficha = async (person, email) => { await sql`update public.jugadores set email = ${email} where person_id = ${person}`; return (await sql`select id from public.jugadores where person_id = ${person}`)[0].id; };
  const cambiar = async (id, email) => (await sql`select public.cambiar_correo_jugador(${id}::uuid, ${email}) r`)[0].r;
  const registrada = async () => (await sql`select 1 from supabase_migrations.schema_migrations where version = '20261026120000'`).length === 1;

  console.log('\n== Aplicada (D135)');
  ok(await registrada(), 'la migración está registrada');
  await e.crearUsuario('cuenta.a@pruebas.local', 'x');
  const a = await ficha('mendez-escandon-fernando', 'sin.cuenta.a@pruebas.local');
  let r = await cambiar(a, 'cuenta.a@pruebas.local');
  ok(r.ok === true && r.vinculado_a_cuenta === true, 'correo viejo sin cuenta → nuevo con cuenta: se enlaza', JSON.stringify(r));

  console.log('\n== Revertida');
  await sql.unsafe(fs.readFileSync(REVERTIR, 'utf8'));
  ok(!(await registrada()), 'revertir.sql borra su registro');
  await e.crearUsuario('cuenta.b@pruebas.local', 'x');
  const b = await ficha('gianatti-adriano', 'sin.cuenta.b@pruebas.local');
  r = await cambiar(b, 'cuenta.b@pruebas.local');
  ok(r.ok === false && r.error === 'correo_en_uso_auth', 'vuelve el comportamiento anterior (correo_en_uso_auth)', JSON.stringify(r));

  console.log('\n== Aplicada de nuevo');
  await migrar(sql, { log: () => {} });
  ok(await registrada(), 'se vuelve a aplicar y a registrar');
  r = await cambiar(b, 'cuenta.b@pruebas.local');
  ok(r.ok === true && r.vinculado_a_cuenta === true, 'y vuelve D135', JSON.stringify(r));
} catch (err) {
  console.log(`  FALLO ${err.stack}`); fallos++;
} finally {
  await e.parar();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
