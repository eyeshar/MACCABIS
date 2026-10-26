#!/usr/bin/env node
// «Han entrado» = ha entrado de verdad (D140), en la pila local y en el Panel:
//   - estado_activacion cuenta como «entrado» solo a quien tiene auth.users.last_sign_in_at; quien tiene cuenta sin acceso (pidió un
//     código y no lo usó) sale en «faltan_por_entrar» y en «pidio_codigo»;
//   - el Panel lo enseña en «Faltan por entrar» con la nota «pidió código pero no llegó a entrar» (interruptor apagado y encendido);
//   - la migración 20261027110000 es solo una función, se revierte limpia (D111) y se vuelve a aplicar.
//
//   npm run pruebas:entrados
import fs from 'node:fs';
import path from 'node:path';
import { preparar, personas, contador, RAIZ } from './comun_e2e.mjs';
import { migrar } from '../scripts/db.mjs';

const { ok, fallos, sumar } = contador();
const e = await preparar({ puerto: 3142 });
const { sql, APP } = e;
try {
  const P = await personas(e.pila, { jugadores: [['esteban-jon', 'jon@pruebas.local']], gestores: [['Iván', 'gestor@pruebas.local', 'villaescusa-silva-ivan']] });
  // Fernando T.: cuenta creada por pedir un código, nunca usada (last_sign_in_at vacío). Jon e Iván sí han entrado.
  await sql`update public.jugadores set email = 'fernando.t@pruebas.local' where nombre_visible = 'Fernando T.'`;
  await e.pila.crearUsuario('fernando.t@pruebas.local', 'x', { sinEntrar: true });
  const dato = async () => (await fetch(`${e.pila.url}/rest/v1/rpc/estado_activacion`, {
    method: 'POST', headers: { apikey: e.pila.anonKey, authorization: `Bearer ${P['gestor@pruebas.local'].token}`, 'content-type': 'application/json' }, body: '{}',
  })).json();

  console.log('\n== estado_activacion: solo cuenta quien ha entrado');
  let est = await dato();
  ok(est.entrados === 2, `entrados: 2 de ${est.plantilla} (Jon e Iván), no 3`, JSON.stringify(est));
  ok(est.faltan_por_entrar.includes('Fernando T.') && est.pidio_codigo.length === 1 && est.pidio_codigo[0] === 'Fernando T.', 'Fernando T. sale en «faltan» y en «pidio_codigo»');
  ok(!est.pidio_codigo.includes('Jon') && !est.faltan_por_entrar.includes('Jon'), 'Jon (ha entrado) no sale en ninguna');
  await sql`update auth.users set last_sign_in_at = now() where email = 'fernando.t@pruebas.local'`;
  est = await dato();
  ok(est.entrados === 3 && !est.faltan_por_entrar.includes('Fernando T.') && est.pidio_codigo.length === 0, 'cuando entra de verdad, pasa a «entrado»');
  await sql`update auth.users set last_sign_in_at = null where email = 'fernando.t@pruebas.local'`;

  console.log('\n== Panel (interruptor apagado)');
  const pg = await e.sesion('gestor@pruebas.local', 1280);
  await pg.goto(`${APP}/gestion`);
  const tarjeta = await pg.getByTestId('tarjeta-activar').innerText();
  ok(/2\/\d+ jugadores ya han entrado en la web/.test(tarjeta), 'la tarjeta dice «2/N jugadores ya han entrado»', tarjeta.slice(0, 300));
  await pg.getByTestId('entrada-numeros-faltan').click();
  const lista = await pg.getByTestId('entrada-numeros-lista').innerText();
  ok(/Fernando T\.\s*pidió código pero no llegó a entrar/.test(lista), '«Faltan por entrar» lista a Fernando T. con «pidió código pero no llegó a entrar»', lista.slice(0, 200));
  await pg.getByTestId('entrada-numeros-entrados').click();
  ok(!/Fernando T\./.test(await pg.getByTestId('entrada-numeros-lista').innerText()), 'y no sale en «han entrado»');

  console.log('\n== Panel (interruptor encendido, franja compacta)');
  await sql`update public.respuestas_web_config set encendido = true, encendido_desde = now() where id = 1`;
  await pg.goto(`${APP}/gestion`);
  await pg.getByTestId('entrada-numeros-faltan').click();
  ok(/Fernando T\.\s*pidió código pero no llegó a entrar/.test(await pg.getByTestId('entrada-numeros-lista').innerText()), 'la franja también lo dice');
  await sql`update public.respuestas_web_config set encendido = false where id = 1`;

  console.log('\n== Migración 20261027110000 reversible (D111)');
  const texto = fs.readFileSync(path.join(RAIZ, 'supabase', 'migrations', '20261027110000_entrados_reales.sql'), 'utf8');
  ok(!/\bdrop\b|\btruncate\b|\bdelete\b|\balter table\b|\bcreate table\b/i.test(texto.replace(/--.*$/gm, '')) && /create or replace function public\.estado_activacion/.test(texto), 'solo sustituye la función (sin tablas, columnas ni borrados)');
  await sql.unsafe(fs.readFileSync(path.join(RAIZ, 'supabase', 'migrations', '20261027110000_entrados_reales.revertir.sql'), 'utf8'));
  est = await dato();
  ok(est.entrados === 3 && est.pidio_codigo === undefined && !(await sql`select 1 from supabase_migrations.schema_migrations where version = '20261027110000'`).length, 'revertida: vuelve a contar las cuentas (3) y se borra su registro');
  await migrar(sql, { log: () => {} });
  est = await dato();
  ok(est.entrados === 2 && est.pidio_codigo.length === 1, 'y aplicada de nuevo, vuelve a contar solo a quien ha entrado');

  ok(!e.errores.length, 'sin errores en la consola', e.errores.slice(0, 3).join(' | '));
} catch (err) {
  console.log(`  FALLO ${err.stack}`);
  sumar();
} finally {
  await e.parar();
}
console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK');
process.exit(fallos() ? 1 : 0);
