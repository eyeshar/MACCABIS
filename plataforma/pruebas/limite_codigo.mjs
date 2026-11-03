#!/usr/bin/env node
// Límite de intentos del código de Entrar (revisión de seguridad 03/11/2026, migración 20261103200000), en la pila local
// con la web compilada y la clave de servicio:
//   - base: anon y authenticated no leen intentos_codigo ni ejecutan sus funciones; service_role sí;
//   - web: 5 códigos incorrectos con un correo → el 6.º, aunque sea el bueno, «Demasiados códigos incorrectos» y sin sesión;
//     otro correo entra igual; un acierto borra los fallos; en la tabla no está el correo, solo su HMAC;
//   - reversión (D111): el .revertir.sql quita tabla y funciones, la web deja entrar igual (sin límite propio) y se vuelve
//     a aplicar limpia.
//
//   npm run pruebas:limite-codigo
import fs from 'node:fs';
import path from 'node:path';
import { contador, preparar, sinteticos, personas, trasAccion, hasta, RAIZ } from './comun_e2e.mjs';
import { firmar } from './pila.mjs';
import { migrar } from '../scripts/db.mjs';

const VERSION = '20261103200000';
const REVERTIR = path.join(RAIZ, 'supabase', 'migrations', `${VERSION}_limite_codigo.revertir.sql`);
const { ok, fallos } = contador();
const servicio = await firmar({ role: 'service_role', iss: 'supabase-local' }, 3600 * 24);
const e = await preparar({ envExtra: { SUPABASE_SERVICE_ROLE_KEY: servicio } });
const { sql, APP, pila } = e;
try {
  await sinteticos(sql, [['sint-limite-a', 'LimiteA', true, false], ['sint-limite-b', 'LimiteB', true, false], ['sint-limite-c', 'LimiteC', true, false]]);
  const A = 'limite-a@pruebas.local', B = 'limite-b@pruebas.local', C = 'limite-c@pruebas.local';
  const cuentas = await personas(pila, { jugadores: [['sint-limite-a', A], ['sint-limite-b', B], ['sint-limite-c', C]] });

  console.log('\n== Permisos en la base');
  const rest = (ruta, token, cuerpo) => fetch(`${pila.url}/rest/v1${ruta}`, {
    method: cuerpo ? 'POST' : 'GET',
    headers: { apikey: pila.anonKey, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  for (const [quien, token] of [['anon', pila.anonKey], ['un jugador con sesión', cuentas['sint-limite-a'].token]]) {
    ok(!(await rest('/intentos_codigo?select=clave', token)).ok, `${quien} no lee intentos_codigo`);
    ok(!(await rest('/rpc/codigo_permitido', token, { p_clave: 'x' })).ok, `${quien} no ejecuta codigo_permitido`);
    ok(!(await rest('/rpc/codigo_resultado', token, { p_clave: 'x', p_ok: false })).ok, `${quien} no ejecuta codigo_resultado`);
  }
  const r = await rest('/rpc/codigo_permitido', servicio, { p_clave: 'x' });
  ok(r.ok && (await r.json()) === true, 'service_role sí ejecuta codigo_permitido (true sin fallos)');

  const codigoDe = async (email) => (await sql`select codigo from public._otp_pruebas where email = ${email}`)[0]?.codigo;
  const ctx = await e.contexto(390);
  const p = await e.nuevaPagina(ctx);
  const pedir = async (email) => {
    await p.goto(`${APP}/entrar`);
    await p.getByLabel('Tu correo').fill(email);
    await trasAccion(p, () => p.getByRole('button', { name: 'Enviarme el código' }).click());
    await p.getByText('Código enviado a').waitFor({ timeout: 10000 });
  };
  const probar = async (codigo) => {
    await p.getByLabel('Código del correo').fill(codigo);
    await trasAccion(p, () => p.getByRole('button', { name: 'Entrar', exact: true }).click());
  };
  const dentro = () => hasta(() => !new URL(p.url()).pathname.startsWith('/entrar'), 15000);
  const texto = (t) => hasta(async () => (await p.getByText(t).count()) > 0);
  const salir = async () => { await ctx.clearCookies(); };

  console.log('\n== Un acierto borra los fallos');
  await pedir(C);
  for (let i = 0; i < 4; i++) await probar('000000');
  ok(await texto('Código incorrecto o caducado.'), '4 códigos incorrectos: «Código incorrecto o caducado.»');
  ok((await sql`select count(*)::int n from public.intentos_codigo`)[0].n === 4, '4 fallos apuntados');
  await probar(await codigoDe(C));
  ok(await dentro(), 'el 5.º, el bueno: entra');
  ok((await sql`select count(*)::int n from public.intentos_codigo`)[0].n === 0, 'al entrar se borran sus fallos');
  await salir();

  console.log('\n== 5 fallos: bloqueado');
  await pedir(A);
  for (let i = 0; i < 5; i++) await probar('000000');
  const filas = await sql`select clave from public.intentos_codigo`;
  ok(filas.length === 5 && filas.every((f) => /^[0-9a-f]{64}$/.test(f.clave)), '5 fallos apuntados, con un HMAC (64 hex)');
  ok(!JSON.stringify(filas).includes('limite-a'), 'en la tabla no está el correo');
  await probar(await codigoDe(A));
  ok(await texto('Demasiados códigos incorrectos con este correo'), 'el 6.º, aunque sea el bueno: «Demasiados códigos incorrectos…»');
  ok(new URL(p.url()).pathname.startsWith('/entrar') && (await codigoDe(A)), 'sigue sin sesión y el código ni se ha gastado (no se preguntó a Supabase)');

  console.log('\n== Otro correo, sin cambios');
  await pedir(B);
  await probar(await codigoDe(B));
  ok(await dentro(), 'otro correo entra a la primera');
  await salir();

  console.log('\n== Reversión (D111)');
  await sql.begin((tx) => tx.unsafe(fs.readFileSync(REVERTIR, 'utf8')));
  const resto = await sql`select (select count(*)::int from pg_proc where proname in ('codigo_permitido', 'codigo_resultado')) f,
    (select count(*)::int from pg_class where relname = 'intentos_codigo') t,
    (select count(*)::int from supabase_migrations.schema_migrations where version = ${VERSION}) m`;
  ok(resto[0].f === 0 && resto[0].t === 0 && resto[0].m === 0, 'revertida: sin funciones, sin tabla y sin su registro', JSON.stringify(resto[0]));
  await pedir(A);
  await probar(await codigoDe(A));
  ok(await dentro(), 'sin la migración, la web deja entrar (sin límite propio, no se bloquea por un error)');
  await salir();
  await migrar(sql, { log: () => {} });
  ok((await sql`select count(*)::int n from supabase_migrations.schema_migrations where version = ${VERSION}`)[0].n === 1
    && (await sql`select count(*)::int n from pg_proc where proname = 'codigo_permitido'`)[0].n === 1, 'aplicada de nuevo, limpia');

  ok(e.errores.length === 0, 'sin errores de JS', e.errores.slice(0, 3).join(' | '));
} catch (err) {
  console.log(`  FALLO ${err.stack ?? err}`);
  process.exitCode = 1;
} finally {
  await e.parar();
}
console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK');
if (fallos()) process.exitCode = 1;
