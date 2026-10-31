#!/usr/bin/env node
// Disponibilidad por defecto (D146) contra la pila LOCAL (Postgres + PostgREST reales con NUESTRAS migraciones), con
// jugadores SINTÉTICOS (D39):
//   - la regla única (src/lib/disponibilidad/porDefecto.ts): «no suele entrenar» sin respuesta = «no va (por defecto)»
//     solo en entrenos; si responde, manda su respuesta; quitado para un entreno, vuelve a «sin responder»; sin marca,
//     todo igual; en un partido, la marca no cuenta. «Nunca a partidos»: fuera de los partidos sin responder; en entrenos,
//     como cualquiera; y la ausencia por periodo (D150): sin respuesta y con una ausencia que cubre el día, «no» en
//     cualquier evento y sin recordatorios; si responde, gana su respuesta;
//   - la migración 20261028230000 es solo aditiva y reversible (su .revertir.sql la deshace limpia y se vuelve a aplicar);
//   - NINGÚN jugador (ni anónimo, ni jugador, ni una cuenta sin ficha) lee las marcas ni las excepciones, ni escribe;
//   - los gestores sí: marcan en jugadores_privado y quitan / devuelven el defecto de un entreno;
//   - el rol de servicio (la tarea de avisos) NO puede leer jugadores_privado (niveles): solo marcas_disponibilidad()
//     (migración 20261028233000, también reversible), que da el jugador y sus dos marcas; y lee las excepciones.
//
//   npm run pruebas:disponibilidad
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as D from '../src/lib/disponibilidad/porDefecto.ts';
import { arrancar } from './pila.mjs';
import { migrar } from '../scripts/db.mjs';

const MIGS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const MIG = '20261028230000_disponibilidad_por_defecto';
const MIG2 = '20261028233000_marcas_disponibilidad_servicio';
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };

console.log('\n== La regla (funciones puras)');
{
  const entreno = { tipo: 'entreno' }, liga = { tipo: 'liga' }, amistoso = { tipo: 'amistoso' }, plan = { tipo: 'entreno', oficial: false }, interno = { tipo: 'interno' };
  const NSE = { no_suele_entrenar: true, nunca_partidos: false }, NAP = { no_suele_entrenar: false, nunca_partidos: true };
  ok(D.noVaPorDefecto(entreno, NSE, 'sin_responder') === true, '«no suele entrenar» y sin respuesta: no va (por defecto)');
  ok(D.noVaPorDefecto(entreno, NSE, 'va') === false && D.pendiente(entreno, NSE, 'va') === false, 'si responde «voy», va (manda su respuesta)');
  ok(D.noVaPorDefecto(entreno, NSE, 'duda') === false && D.noVaPorDefecto(entreno, NSE, 'no') === false, 'y con «duda» o «no voy», lo que dijo');
  ok(D.noVaPorDefecto(entreno, NSE, 'sin_responder', true) === false && D.pendiente(entreno, NSE, 'sin_responder', true) === true, 'quitado para este entreno: vuelve a «sin responder» (pendiente)');
  ok(D.noVaPorDefecto(entreno, null, 'sin_responder') === false && D.pendiente(entreno, null, 'sin_responder') === true && D.pendiente(liga, undefined, 'sin_responder') === true, 'sin marca, todo igual que ahora');
  ok(D.noVaPorDefecto(liga, NSE, 'sin_responder') === false && D.pendiente(liga, NSE, 'sin_responder') === true, 'en un partido, «no suele entrenar» no cuenta');
  ok(D.noVaPorDefecto(plan, NSE, 'sin_responder') === false && D.noVaPorDefecto(interno, NSE, 'sin_responder') === false, 'ni en un plan no oficial ni en un «entre nosotros»');
  ok(D.fueraDelPartido(liga, NAP, 'sin_responder') && D.fueraDelPartido(amistoso, NAP, 'sin_responder') && !D.pendiente(liga, NAP, 'sin_responder'), '«nunca a partidos» sin responder: fuera del partido (liga y amistoso), no pendiente');
  ok(!D.fueraDelPartido(liga, NAP, 'va') && !D.fueraDelPartido(entreno, NAP, 'sin_responder') && D.pendiente(entreno, NAP, 'sin_responder'), 'si respondió se ve; en un entreno, como cualquiera');
  const d = D.defectoDe([{ person_id: 'a', no_suele_entrenar: true, nunca_partidos: false }, { person_id: 'b', no_suele_entrenar: false, nunca_partidos: false }], [{ evento_id: 'e1', person_id: 'a' }]);
  ok(d.marcas.size === 1 && d.marcas.get('a').no_suele_entrenar && d.quitados.has(D.claveQuitado('e1', 'a')) && !d.quitados.has(D.claveQuitado('e2', 'a')), 'defectoDe: solo quien tiene alguna marca; el quitado vale para su entreno');

  console.log('\n== Ausencias por periodo en la regla única (D150)');
  const AUS = { person_id: 'a', desde: '2026-11-01', hasta: '2026-11-08', motivo: 'viaje' };
  const ABIERTA = { person_id: 'a', desde: '2026-11-20', hasta: null, motivo: 'lesion' };
  ok(D.ausenciaQueCubre('a', '2026-11-04', [AUS]) === AUS && D.ausenciaQueCubre('a', '2026-11-08', [AUS]) === AUS && !D.ausenciaQueCubre('a', '2026-11-09', [AUS]) && !D.ausenciaQueCubre('b', '2026-11-04', [AUS]), 'ausenciaQueCubre: del primer al último día, solo de esa persona');
  ok(D.ausenciaQueCubre('a', '2027-03-01', [ABIERTA]) === ABIERTA && !D.ausenciaQueCubre('a', '2026-11-04', [{ ...AUS, borrada_en: '2026-10-30' }]), 'sin fecha de vuelta cubre en adelante; una borrada no cuenta');
  const ef = (e, m, r, o) => D.respuestaEfectiva(e, m, r, o);
  ok(ef(entreno, null, 'sin_responder', { ausencia: AUS }).respuesta === 'no' && ef(entreno, null, 'sin_responder', { ausencia: AUS }).por === 'ausencia', 'sin responder y con ausencia, en un entreno: «no» por la ausencia');
  ok(ef(liga, null, 'sin_responder', { ausencia: AUS }).respuesta === 'no' && ef(amistoso, null, 'sin_responder', { ausencia: AUS }).respuesta === 'no', 'y en un partido, igual');
  ok(['va', 'duda', 'no'].every((r) => ef(entreno, null, r, { ausencia: AUS }).respuesta === r && ef(entreno, null, r, { ausencia: AUS }).por === null), 'si responde explícitamente, gana su respuesta (va, duda o no)');
  ok(!D.pendiente(entreno, null, 'sin_responder', false, AUS) && !D.pendiente(liga, null, 'sin_responder', false, AUS) && D.pendiente(liga, null, 'sin_responder', false, null), 'con ausencia no está pendiente (sin recordatorios); sin ella, sí');
  ok(ef(entreno, NSE, 'sin_responder', { ausencia: AUS }).por === 'ausencia' && ef(entreno, NSE, 'sin_responder', { ausencia: AUS, quitado: true }).respuesta === 'no', '«no suele entrenar» con ausencia: cuenta por la ausencia (también si se le quitó el defecto)');
  ok(ef(liga, NAP, 'sin_responder', { ausencia: AUS }).fuera, '«nunca a partidos» con ausencia, en un partido: fuera, como sin ausencia');
  ok(ef(entreno, NSE, 'sin_responder').por === 'defecto' && ef(entreno, null, 'sin_responder').respuesta === 'sin_responder', 'sin ausencia: el defecto y «sin responder», como antes');
  const d2 = D.defectoDe([], [], [AUS, { ...ABIERTA, borrada_en: '2026-10-30' }]);
  ok(d2.ausencias.length === 1 && D.efectivaEn({ tipo: 'entreno', id: 'e', fecha: '2026-11-04' }, 'a', 'sin_responder', d2).por === 'ausencia' && D.efectivaEn({ tipo: 'entreno', id: 'e', fecha: '2026-11-04' }, 'a', 'sin_responder', undefined).respuesta === 'sin_responder', 'efectivaEn: con las ausencias del gestor, «no»; sin ellas (pantallas de jugador), «sin responder»');
}

const pila = await arrancar();
try {
  const { sql, url, anonKey } = pila;
  const api = async (ruta, { metodo = 'GET', cuerpo, token } = {}) => {
    const r = await fetch(`${url}/rest/v1${ruta}`, {
      method: metodo,
      headers: { apikey: anonKey, authorization: `Bearer ${token ?? anonKey}`, 'content-type': 'application/json', prefer: 'return=representation' },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    let datos = null;
    try { datos = await r.json(); } catch {}
    return { status: r.status, datos };
  };
  const columnas = async () => (await sql`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'jugadores_privado' order by ordinal_position`).map((r) => r.column_name);
  const existeTabla = async () => (await sql`select to_regclass('public.entreno_defecto_quitado') r`)[0].r !== null;
  const registrada = async () => (await sql`select 1 from supabase_migrations.schema_migrations where version = '20261028230000'`).length === 1;
  const vacioONegado = (r) => r.status === 401 || r.status === 403 || (r.status === 200 && Array.isArray(r.datos) && r.datos.length === 0);

  console.log('\n== Migración aditiva y reversible (D111)');
  const texto = fs.readFileSync(path.join(MIGS, `${MIG}.sql`), 'utf8').replace(/--.*$/gm, '');
  ok(fs.existsSync(path.join(MIGS, `${MIG}.revertir.sql`)), 'tiene su .revertir.sql al lado');
  ok(!/\bdrop\b|\btruncate\b|\bdelete\s+from\b|\bupdate\s+public\b|alter\s+column/i.test(texto), 'solo aditiva: sin DROP, TRUNCATE, DELETE, UPDATE ni cambios de columnas existentes');
  ok(!/create\s+(or\s+replace\s+)?function/i.test(texto), 'no crea funciones (la lista de permisos de authenticated no cambia)');
  ok(await registrada() && await existeTabla(), 'aplicada: registrada y con la tabla de excepciones');
  const cols = await columnas();
  ok(cols.at(-2) === 'no_suele_entrenar' && cols.at(-1) === 'nunca_partidos', 'jugadores_privado lleva las dos columnas nuevas al final', cols.join());
  const [{ rls }] = await sql`select relrowsecurity rls from pg_class where oid = 'public.entreno_defecto_quitado'::regclass`;
  ok(rls === true, 'la tabla nueva tiene RLS');
  ok((await sql`select has_table_privilege('anon', 'public.entreno_defecto_quitado', 'select') a`)[0].a === false, 'anon no tiene ni permiso de lectura sobre la tabla nueva');
  const colsAntes = cols.slice(0, -2);
  const sinMarcas = await sql`select person_id, dobla from public.jugadores_privado order by 1`;
  // La tarea de avisos (service_role): sin permisos sobre jugadores_privado; solo la función con las dos marcas.
  const permisos = async () => (await sql`select has_table_privilege('service_role', 'public.jugadores_privado', 'select') tabla,
    to_regprocedure('public.marcas_disponibilidad()') is not null fn,
    coalesce(has_function_privilege('service_role', to_regprocedure('public.marcas_disponibilidad()'), 'execute'), false) s_fn,
    coalesce(has_function_privilege('authenticated', to_regprocedure('public.marcas_disponibilidad()'), 'execute'), false) a_fn,
    coalesce(has_function_privilege('anon', to_regprocedure('public.marcas_disponibilidad()'), 'execute'), false) n_fn`)[0];
  let pm = await permisos();
  ok(!pm.tabla && pm.fn && pm.s_fn && !pm.a_fn && !pm.n_fn, 'service_role sin permiso sobre jugadores_privado; marcas_disponibilidad() solo la ejecuta service_role', JSON.stringify(pm));
  const texto2 = fs.readFileSync(path.join(MIGS, `${MIG2}.sql`), 'utf8').replace(/--.*$/gm, '');
  ok(fs.existsSync(path.join(MIGS, `${MIG2}.revertir.sql`)) && !/\bdrop\b|\btruncate\b|\bdelete\b|alter\s+table/i.test(texto2), 'la segunda migración tiene su .revertir.sql y solo crea la función y quita permisos a service_role');
  // Se revierte en orden inverso: primero la función (vuelven los permisos de service_role), luego las marcas.
  await sql.begin((tx) => tx.unsafe(fs.readFileSync(path.join(MIGS, `${MIG2}.revertir.sql`), 'utf8')));
  pm = await permisos();
  ok(pm.tabla && !pm.fn && (await sql`select count(*)::int n from supabase_migrations.schema_migrations where version = '20261028233000'`)[0].n === 0, 'revertir la segunda: quita la función y su registro y service_role vuelve a leer jugadores_privado (como antes)', JSON.stringify(pm));
  await sql.begin((tx) => tx.unsafe(fs.readFileSync(path.join(MIGS, `${MIG}.revertir.sql`), 'utf8')));
  ok(!(await registrada()) && !(await existeTabla()), 'revertir la primera: quita el registro y la tabla nueva');
  ok((await columnas()).join() === colsAntes.join(), 'y jugadores_privado vuelve a sus columnas de antes');
  ok(JSON.stringify(await sql`select person_id, dobla from public.jugadores_privado order by 1`) === JSON.stringify(sinMarcas), 'sin tocar sus filas');
  await migrar(sql, { log: () => {} });
  ok(await registrada() && await existeTabla() && (await columnas()).at(-1) === 'nunca_partidos', 'se vuelven a aplicar las dos, limpias');
  pm = await permisos();
  ok(!pm.tabla && pm.fn && pm.s_fn && !pm.a_fn, 'y service_role vuelve a quedarse sin jugadores_privado, solo con la función', JSON.stringify(pm));
  await sql`notify pgrst, 'reload schema'`;
  await new Promise((r) => setTimeout(r, 1500));
  for (let i = 0; i < 40 && (await api('/entreno_defecto_quitado')).status === 404; i++) await new Promise((r) => setTimeout(r, 250));

  console.log('\n== Cuentas y datos sintéticos');
  for (const [i, p] of ['sint-nse', 'sint-nap', 'sint-normal'].entries()) {
    await sql`insert into public.jugadores (person_id, nombre_oficial, nombre_visible, ficha_mda, ficha_mdl, email) values (${p}, ${'Sintetico, ' + i}, ${'Sint ' + i}, true, true, ${p + '@pruebas.local'})`;
  }
  const cuenta = async (email) => { const uid = await pila.crearUsuario(email, 'x'); return { uid, token: await pila.firmar({ sub: uid, role: 'authenticated', email }) }; };
  const jugador = await cuenta('sint-normal@pruebas.local');
  const marcado = await cuenta('sint-nse@pruebas.local');
  const intruso = await cuenta('intruso@pruebas.local');
  const g = await cuenta('gestor-d@pruebas.local');
  await sql`insert into public.gestores (user_id, nombre, email) values (${g.uid}, 'Gestor', 'gestor-d@pruebas.local')`;
  const [{ id: entreno }] = await sql`insert into public.eventos (clave, tipo, equipo, fecha, inicio) values ('sint-entreno', 'entreno', 'ambos', '2026-11-04', '20:30') returning id`;
  ok(!!entreno, 'un entreno sintético');

  console.log('\n== Los gestores marcan y quitan el defecto de un entreno');
  let r = await api('/jugadores_privado', { metodo: 'POST', cuerpo: { person_id: 'sint-nse', no_suele_entrenar: true }, token: g.token });
  ok(r.status === 201 && r.datos?.[0]?.no_suele_entrenar === true && r.datos[0].nunca_partidos === false, 'un gestor marca «no suele entrenar» (la otra queda en false)', JSON.stringify(r));
  r = await api('/jugadores_privado', { metodo: 'POST', cuerpo: { person_id: 'sint-nap', nunca_partidos: true, dobla: false }, token: g.token });
  ok(r.status === 201 && r.datos?.[0]?.nunca_partidos === true && r.datos[0].dobla === false, 'y «solo entreno: nunca a partidos» con Dobla = no', JSON.stringify(r));
  r = await api('/jugadores_privado?person_id=eq.sint-nse', { metodo: 'PATCH', cuerpo: { no_suele_entrenar: false }, token: g.token });
  ok(r.status === 200 && r.datos?.[0]?.no_suele_entrenar === false, 'y la puede quitar');
  await api('/jugadores_privado?person_id=eq.sint-nse', { metodo: 'PATCH', cuerpo: { no_suele_entrenar: true }, token: g.token });
  r = await api('/entreno_defecto_quitado', { metodo: 'POST', cuerpo: { evento_id: entreno, person_id: 'sint-nse', por_nombre: 'Gestor' }, token: g.token });
  ok(r.status === 201, 'un gestor pasa a alguien a «sin responder» solo en este entreno', JSON.stringify(r));
  r = await api('/entreno_defecto_quitado', { token: g.token });
  ok(r.status === 200 && r.datos?.length === 1, 'y lo lee');

  console.log('\n== Ningún jugador lee ni escribe las marcas (D39)');
  for (const [quien, token] of [['anónimo', undefined], ['un jugador', jugador.token], ['el propio marcado', marcado.token], ['una cuenta sin ficha', intruso.token]]) {
    r = await api('/jugadores_privado?select=person_id,no_suele_entrenar,nunca_partidos', { token });
    ok(vacioONegado(r), `${quien} no lee las marcas de jugadores_privado`, JSON.stringify(r));
    r = await api('/jugadores_privado?select=no_suele_entrenar&person_id=eq.sint-nse', { token });
    ok(vacioONegado(r), `${quien} no lee ni la suya / la de uno en concreto`, JSON.stringify(r));
    r = await api('/entreno_defecto_quitado', { token });
    ok(vacioONegado(r), `${quien} no lee las excepciones de entreno`, JSON.stringify(r));
    r = await api('/entreno_defecto_quitado', { metodo: 'POST', cuerpo: { evento_id: entreno, person_id: 'sint-normal' }, token });
    ok(r.status >= 400, `${quien} no puede quitar el defecto de nadie`, String(r.status));
    r = await api('/entreno_defecto_quitado?person_id=eq.sint-nse', { metodo: 'DELETE', token });
    ok(vacioONegado(r) || r.status >= 400, `${quien} no puede borrar una excepción`, JSON.stringify(r));
    r = await api('/jugadores_privado?person_id=eq.sint-nse', { metodo: 'PATCH', cuerpo: { no_suele_entrenar: false }, token });
    ok(vacioONegado(r) || r.status >= 400, `${quien} no puede cambiar una marca`, JSON.stringify(r));
  }
  ok((await sql`select no_suele_entrenar from public.jugadores_privado where person_id = 'sint-nse'`)[0].no_suele_entrenar === true
    && (await sql`select count(*)::int n from public.entreno_defecto_quitado`)[0].n === 1, 'y en la base todo sigue como lo dejó el gestor');
  const vista = await api('/rpc/mi_zona', { metodo: 'POST', cuerpo: {}, token: marcado.token });
  ok(!JSON.stringify(vista.datos ?? '').includes('suele') && !JSON.stringify(vista.datos ?? '').includes('nunca_partidos'), 'mi_zona() del jugador marcado no lleva nada de las marcas');

  console.log('\n== La tarea de avisos (rol de servicio) las lee');
  const servicio = async (q) => { try { return { ok: true, r: await sql.begin(async (tx) => { await tx`set local role service_role`; return tx.unsafe(q); }) }; } catch (err) { return { ok: false, error: err.message }; } };
  const tabla = await servicio('select person_id, nivel from public.jugadores_privado');
  ok(!tabla.ok && /permission denied/.test(tabla.error), 'service_role NO puede leer jugadores_privado (permiso denegado)', tabla.ok ? `${tabla.r.length} filas` : tabla.error);
  const fn = await servicio('select * from public.marcas_disponibilidad() order by person_id');
  ok(fn.ok && fn.r.length === 2 && fn.r.every((x) => Object.keys(x).sort().join() === 'no_suele_entrenar,nunca_partidos,person_id'), 'y sí marcas_disponibilidad(): las 2 marcas, solo jugador y marcas (sin nivel ni nada más)', fn.ok ? JSON.stringify(fn.r) : fn.error);
  const exc = await servicio('select count(*)::int n from public.entreno_defecto_quitado');
  ok(exc.ok && exc.r[0].n === 1, 'y lee las excepciones de entreno', exc.ok ? '' : exc.error);
  for (const [quien, token] of [['anónimo', undefined], ['un jugador', jugador.token], ['un gestor', g.token]]) {
    const r2 = await api('/rpc/marcas_disponibilidad', { metodo: 'POST', cuerpo: {}, token });
    ok(r2.status >= 400, `${quien} NO puede ejecutar marcas_disponibilidad()`, String(r2.status));
  }

  console.log('\n== Devolver el defecto');
  r = await api(`/entreno_defecto_quitado?evento_id=eq.${entreno}&person_id=eq.sint-nse`, { metodo: 'DELETE', token: g.token });
  ok(r.status === 200 && r.datos?.length === 1 && (await sql`select count(*)::int n from public.entreno_defecto_quitado`)[0].n === 0, 'un gestor lo devuelve a «no va (por defecto)» (borra la excepción)', JSON.stringify(r));
} catch (err) {
  console.log(`  FALLO ${err.stack}`); fallos++;
} finally {
  await pila.parar();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
