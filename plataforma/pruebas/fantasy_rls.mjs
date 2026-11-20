#!/usr/bin/env node
// MdFantasy (D196) contra la pila LOCAL: migración 20261121100000, permisos (RLS) y operaciones de mercado, con jugadores
// SINTÉTICOS, el calendario y el reloj de prueba (D185; hoy = lunes 19/10/2026 10:00). Nunca imprime datos privados.
//   - Apagado por defecto: nadie lee ni opera. Solo gestores cambian el interruptor y los parámetros.
//   - Puntuación al publicarse la hoja (fantasy_pendientes → cerrarJornada → fantasy_guardar_jornada), repetible sin duplicar.
//   - Alta con plantilla al azar de valor parecido, sin copia propia; el entrenador juega pero no es elegible.
//   - Fichar, vender, clausulazo (uno por jornada, copia robada protegida, cierre del sábado), alineación (capitán no repite),
//     porra, bloqueo de gestores con el borrador de la convocatoria, cierre desde el primer partido.
//   - Alineación, capitán y porra de los demás: ocultos hasta el cierre. Anónimo: nada. Nadie escribe directo.
//   - Los parámetros de la base (_fantasy_param) = los de src/lib/fantasy/reglas.ts.
//   - Migración reversible (D111): se deshace limpia y se vuelve a aplicar.
//   npm run pruebas:fantasy-rls
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { arrancar } from './pila.mjs';
import { migrar } from './infra/migrar.mjs';
import { revertirPosteriores } from './revertir_posteriores.mjs';
import { cargarEventos } from './infra/calendario.mjs';
import { PARAMETROS } from '../src/lib/fantasy/reglas.ts';
import { cerrarJornada } from '../src/lib/fantasy/cierre.ts';
import { tareaFantasy } from '../src/lib/fantasy/tarea.ts';
import { createClient } from '@supabase/supabase-js';
import { ahoraPrueba } from './infra/reloj.mjs';

const MIGS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const MIG = '20261121100000';
let fallos = 0;
const ok = (c, q, d = '') => { if (c) console.log(`  OK    ${q}`); else { fallos++; console.log(`  FALLO ${q}${d ? ` -> ${d}` : ''}`); } };

const pila = await arrancar();
try {
  const { sql, url, anonKey } = pila;
  const api = async (ruta, { metodo = 'GET', cuerpo, token } = {}) => {
    const r = await fetch(`${url}/rest/v1${ruta}`, { method: metodo, headers: { apikey: anonKey, authorization: `Bearer ${token ?? anonKey}`, 'content-type': 'application/json', prefer: 'return=representation' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    let datos = null; try { datos = await r.json(); } catch {}
    return { status: r.status, datos };
  };
  const rpc = (f, a, t) => api(`/rpc/${f}`, { metodo: 'POST', cuerpo: a ?? {}, token: t });
  const err = (r) => (r.datos && (r.datos.message || r.datos.msg)) || '';
  const vacio = (r) => r.status >= 400 || (Array.isArray(r.datos) && r.datos.length === 0);
  await cargarEventos(sql, { log: () => {} });

  await sql`insert into public.jugadores (person_id, nombre_oficial, nombre_visible, ficha_mda, ficha_mdl, rol, entrena) values
    ('sint-fz-ana', 'Prueba, Ana', 'Ana', true, true, 'jugador', true),
    ('sint-fz-beto', 'Prueba, Beto', 'Beto', true, true, 'jugador', true),
    ('sint-fz-caro', 'Prueba, Caro', 'Caro', true, true, 'jugador', true),
    ('sint-fz-gema', 'Prueba, Gema', 'Gema', true, true, 'jugador', true),
    ('sint-fz-mister', 'Prueba, Míster', 'Míster', false, false, 'entrenador', true)`;
  const tok = async (pid, email) => { if (pid) await sql`update public.jugadores set email = ${email} where person_id = ${pid}`; const uid = await pila.crearUsuario(email, 'x'); return { uid, pid, t: await pila.firmar({ sub: uid, role: 'authenticated', email }) }; };
  const A = await tok('sint-fz-ana', 'ana@pruebas.local');
  const B = await tok('sint-fz-beto', 'beto@pruebas.local');
  const C = await tok('sint-fz-caro', 'caro@pruebas.local');
  const G = await tok('sint-fz-gema', 'gema@pruebas.local');       // gestora con ficha
  const M = await tok('sint-fz-mister', 'mister@pruebas.local');   // entrenador: juega, no es elegible
  const X = await tok(null, 'intruso@pruebas.local');              // cuenta sin ficha
  await sql`insert into public.gestores (user_id, nombre, email) values (${G.uid}, 'Gema', 'gema@pruebas.local')`;
  const SERVICIO = await pila.firmar({ role: 'service_role' });

  // Hojas de la J1 (04/10) y la J2 (18/10): ocho por equipo, con nombres en el formato de la hoja.
  const fichas = await sql`select person_id, nombre_oficial from public.jugadores where activo and rol = 'jugador' and ficha_mda and ficha_mdl and person_id not like 'sint-%' order by person_id limit 12`;
  const hoja = (n) => n.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();
  async function publicar(jornada, fecha, equipo, favor, contra, lineas) {
    const [p] = await sql`insert into public.liga_partidos (temporada, grupo, jornada, fecha, local, visitante, pts_local, pts_visitante, nuestro)
      values ('2026-27', ${equipo === 'MdA' ? 'G1' : 'G2'}, ${jornada}, ${fecha}, ${equipo}, ${`Rival ${jornada}${equipo}`}, ${favor}, ${contra}, true) returning id`;
    let i = 0;
    for (const [nombre, segundos, pts, mm] of lineas) await sql`insert into public.liga_estadisticas_jugador (partido_id, equipo, dorsal, nombre, segundos, pts, mas_menos) values (${p.id}, ${equipo}, ${String(++i)}, ${nombre}, ${segundos}, ${pts}, ${mm})`;
  }
  const ocho = (desde, pts) => fichas.slice(desde, desde + 8).map((f, i) => [hoja(f.nombre_oficial), 1800, pts[i], 5 - i]);
  await publicar(1, '2026-10-04', 'MdA', 60, 40, ocho(0, [20, 12, 10, 8, 4, 3, 2, 1]));
  await publicar(1, '2026-10-04', 'MdL', 50, 55, ocho(4, [18, 10, 8, 6, 4, 2, 1, 1]));
  await publicar(2, '2026-10-18', 'MdA', 70, 30, [...ocho(0, [22, 14, 9, 7, 5, 4, 3, 0]).slice(0, 7), ['PRUEBA, ANA MARIA', 1800, 6, 2]]);
  await publicar(2, '2026-10-18', 'MdL', 44, 40, [...ocho(4, [16, 9, 7, 5, 3, 2, 1, 1]).slice(0, 7), ['FANTASMA, NADIE', 1800, 1, 0]]);

  console.log('\n== Apagado por defecto');
  ok((await sql`select modo from public.fantasy_config`)[0].modo === 'apagado', 'el interruptor nace apagado');
  ok((await rpc('fantasy_acceso', {}, A.t)).datos === false, 'un jugador no tiene acceso');
  ok(vacio(await api('/fantasy_jugadores?select=person_id', { token: A.t })), 'apagado: un jugador no lee el mercado');
  ok(err(await rpc('fantasy_alta', {}, A.t)) === 'fantasy_apagado', 'apagado: no se puede crear equipo');
  ok(err(await rpc('fantasy_guardar_ajustes', { p_modo: 'todos', p_parametros: null, p_alias: null }, A.t)) === 'solo_gestores', 'un jugador no cambia el interruptor');

  console.log('\n== Parámetros: la base y src/lib/fantasy/reglas.ts');
  const enBase = Object.fromEntries(await Promise.all(Object.keys(PARAMETROS).map(async (k) => [k, Number((await sql`select public._fantasy_param(${k}) v`)[0].v)])));
  ok(JSON.stringify(enBase) === JSON.stringify(PARAMETROS), '_fantasy_param = PARAMETROS, clave a clave', JSON.stringify(Object.keys(PARAMETROS).filter((k) => enBase[k] !== PARAMETROS[k])));
  ok((await sql`select public._fantasy_param('noexiste') v`)[0].v === null, 'una clave desconocida no tiene valor');

  console.log('\n== Puntuación al publicarse la hoja (rol de servicio), repetible');
  ok((await rpc('fantasy_pendientes', {}, A.t)).status >= 400 && (await rpc('fantasy_datos_jornada', { p_fecha: '2026-10-04' }, G.t)).status >= 400, 'ni jugador ni gestor llaman a las funciones del servicio');
  async function puntuar() {
    const pend = (await rpc('fantasy_pendientes', {}, SERVICIO)).datos ?? [];
    const hechas = [];
    for (const { fecha } of pend) {
      const d = (await rpc('fantasy_datos_jornada', { p_fecha: fecha }, SERVICIO)).datos;
      const c = cerrarJornada(d);
      const g = await rpc('fantasy_guardar_jornada', { p: c.guardar }, SERVICIO);
      if (g.status >= 400) throw new Error(`guardar ${fecha}: ${err(g)}`);
      hechas.push({ fecha, c });
    }
    return hechas;
  }
  const primera = await puntuar();
  ok(primera.map((x) => x.fecha).join() === '2026-10-04,2026-10-18', 'pendientes: las dos jornadas con hoja, por orden', primera.map((x) => x.fecha).join());
  ok(primera[1].c.aproximados.join() === 'PRUEBA, ANA MARIA' && primera[1].c.sinCasar.join() === 'FANTASMA, NADIE', 'nombres: uno casa por aproximación y otro queda sin casar (no se adivina)');
  ok((await sql`select sin_casar from public.fantasy_jornadas where fecha = '2026-10-18'`)[0].sin_casar.join() === 'FANTASMA, NADIE', 'el nombre sin casar queda apuntado en la jornada');
  const nPuntos = (await sql`select count(*)::int n from public.fantasy_puntos_jugador`)[0].n;
  const elegibles = (await sql`select count(*)::int n from public.jugadores where activo and rol = 'jugador'`)[0].n;
  ok(nPuntos === elegibles * 2, 'una fila por elegible y jornada', `${nPuntos} / ${elegibles * 2}`);
  ok((await puntuar()).length === 0 && (await sql`select count(*)::int n from public.fantasy_puntos_jugador`)[0].n === nPuntos, 'repetir no puntúa de nuevo ni duplica');
  const ana = (await sql`select rendimiento, total from public.fantasy_puntos_jugador where jornada = '2026-10-18' and person_id = 'sint-fz-ana'`)[0];
  // 6 puntos; +/- relativo = 2 - (70-30)*1800/2880 = -23 → la mitad, con tope: -5 → 1
  ok(Number(ana.rendimiento) === 1, 'rendimiento: puntos + mitad del +/- relativo con tope de ±5', String(ana.rendimiento));
  const mercado = await sql`select person_id, valor, copias, en_mercado from public.fantasy_jugadores`;
  ok(mercado.length === elegibles && mercado.every((m) => Number(m.valor) >= PARAMETROS.valorMinimo), 'mercado: todos los elegibles, con el valor mínimo como suelo');
  ok(!mercado.some((m) => m.person_id === 'sint-fz-mister') && !(await sql`select 1 from public.fantasy_jugadores f join public.jugadores j using (person_id) where j.rol <> 'jugador'`).length, 'el entrenador y los de solo entreno no son elegibles');

  console.log('\n== Encendido: alta y lectura');
  ok((await rpc('fantasy_guardar_ajustes', { p_modo: 'todos', p_parametros: null, p_alias: null }, G.t)).status < 300, 'la gestora lo enciende para todos');
  ok((await rpc('fantasy_acceso', {}, X.t)).datos === false && vacio(await api('/fantasy_jugadores?select=person_id', { token: X.t })), 'una cuenta sin ficha no entra');
  ok(vacio(await api('/fantasy_jugadores?select=person_id')) && (await rpc('fantasy_estado', {})).status >= 400, 'anónimo: nada');
  const estado = (await rpc('fantasy_estado', {}, A.t)).datos;
  ok(estado.acceso && estado.jornada === '2026-10-25' && !estado.cerrado && !estado.es_manager, 'estado: jornada en juego = el domingo 25/10, abierta');
  for (const u of [A, B, C, G, M]) { const r = await rpc('fantasy_alta', {}, u.t); if (r.status >= 300) ok(false, `alta de ${u.pid}`, err(r)); }
  ok(err(await rpc('fantasy_alta', {}, A.t)) === 'ya_tiene_equipo', 'no se crea equipo dos veces');
  const copias = await sql`select manager, jugador from public.fantasy_copias`;
  ok([A, B, C, G, M].every((u) => copias.filter((c) => c.manager === u.pid).length === PARAMETROS.plantilla), 'cada mánager recibe una plantilla completa');
  ok(!copias.some((c) => c.manager === c.jugador), 'nadie tiene su propia copia');
  const valores = new Map((await sql`select person_id, valor from public.fantasy_jugadores`).map((x) => [x.person_id, Number(x.valor)]));
  const objetivo = PARAMETROS.plantilla * [...valores.values()].reduce((s, v) => s + v, 0) / valores.size;
  const valorDe = (pid) => copias.filter((c) => c.manager === pid).reduce((s, c) => s + valores.get(c.jugador), 0);
  const cajaDe = new Map((await sql`select manager, sum(importe) c from public.fantasy_movimientos group by 1`).map((x) => [x.manager, Number(x.c)]));
  const dentro = (u) => Math.abs(valorDe(u.pid) - objetivo) / objetivo <= PARAMETROS.margenInicio + 0.001;
  ok(dentro(A) && cajaDe.get(A.pid) === PARAMETROS.cajaInicial, 'el primero: plantilla de valor parecido al objetivo (±10 %) y la caja inicial');
  ok([A, B, C, G, M].every((u) => dentro(u) ? cajaDe.get(u.pid) === PARAMETROS.cajaInicial : Math.abs(valorDe(u.pid) + cajaDe.get(u.pid) - objetivo - PARAMETROS.cajaInicial) < 0.11 || cajaDe.get(u.pid) === 0),
    'quien entra después: dentro del margen, o la diferencia compensada en la caja');
  const [cop] = await sql`select min(copias) mn, max(copias) mx from public.fantasy_jugadores where en_mercado`;
  ok(cop.mn === cop.mx && cop.mx === Math.max(1, Math.ceil(5 * PARAMETROS.plantilla * (1 + PARAMETROS.margenCopias) / elegibles)), 'copias por jugador: las justas para 5 mánagers con margen', `${cop.mn}-${cop.mx}`);
  ok((await api('/fantasy_copias?select=manager,jugador', { token: B.t })).datos.length === copias.length, 'las plantillas las ven todos');
  const alin = await api('/fantasy_alineaciones?select=manager,titulares,capitan', { token: A.t });
  ok(alin.datos.length === 1 && alin.datos[0].manager === A.pid && alin.datos[0].titulares.length === PARAMETROS.alineados, 'alineación: antes del cierre cada uno ve SOLO la suya (5 por defecto)');
  for (const t of ['fantasy_copias', 'fantasy_movimientos', 'fantasy_alineaciones', 'fantasy_managers', 'fantasy_jugadores', 'fantasy_config', 'fantasy_puntos_jugador']) {
    const post = await api(`/${t}`, { metodo: 'POST', cuerpo: {}, token: G.t });
    const del = await api(`/${t}?jornada=not.is.null`, { metodo: 'DELETE', token: G.t });
    if (post.status < 400 || del.status < 400) ok(false, `nadie escribe directamente en ${t}`, `${post.status} ${del.status}`);
  }
  ok(true, 'nadie (ni un gestor) escribe directamente en las tablas');
  ok(vacio(await api('/fantasy_primeras_respuestas?select=person_id', { token: G.t })) && vacio(await api('/fantasy_config?select=modo', { token: A.t })), 'primeras respuestas: nadie por la API; la configuración, solo gestores');

  console.log('\n== Mercado');
  const mios = (pid) => copias.filter((c) => c.manager === pid).map((c) => c.jugador);
  const caja = async (pid) => Number((await sql`select public._fantasy_caja(${pid}) c`)[0].c);
  const libre = (await sql`select f.person_id, f.valor from public.fantasy_jugadores f where public._fantasy_libres(f.person_id) > 0 and f.person_id <> all(${mios(A.pid)}) and f.person_id <> ${A.pid} order by f.valor limit 1`)[0];
  ok(err(await rpc('fantasy_fichar', { p_jugador: libre.person_id }, A.t)) === 'plantilla_llena', 'fichar con la plantilla llena: no');
  ok(err(await rpc('fantasy_vender', { p_jugador: libre.person_id }, A.t)) === 'no_lo_tienes', 'vender a quien no tienes: no');
  const vendo = (await sql`select c.jugador, f.valor from public.fantasy_copias c join public.fantasy_jugadores f on f.person_id = c.jugador where c.manager = ${A.pid} order by f.valor desc limit 1`)[0];
  ok((await rpc('fantasy_vender', { p_jugador: vendo.jugador }, A.t)).status < 300 && await caja(A.pid) === PARAMETROS.cajaInicial + Number(vendo.valor), 'vender recupera el valor actual');
  ok(!(await sql`select titulares from public.fantasy_alineaciones where manager = ${A.pid}`)[0].titulares.includes(vendo.jugador), 'el vendido sale de la alineación');
  ok(err(await rpc('fantasy_fichar', { p_jugador: A.pid }, A.t)) === 'copia_propia', 'nadie ficha su propia copia');
  ok((await rpc('fantasy_fichar', { p_jugador: libre.person_id }, A.t)).status < 300 && await caja(A.pid) === PARAMETROS.cajaInicial + Number(vendo.valor) - Number(libre.valor), 'fichar una copia libre cuesta su valor');
  ok(err(await rpc('fantasy_fichar', { p_jugador: libre.person_id }, A.t)) === 'ya_lo_tienes' || err(await rpc('fantasy_fichar', { p_jugador: libre.person_id }, A.t)) === 'plantilla_llena', 'no se ficha dos veces al mismo');

  console.log('\n== Clausulazo');
  // Un jugador sin copias libres que tenga Beto y no tenga Ana: se agotan sus copias a mano.
  const objetivoCl = (await sql`select c.jugador from public.fantasy_copias c where c.manager = ${B.pid} and c.jugador <> ${A.pid}
    and not exists (select 1 from public.fantasy_copias d where d.jugador = c.jugador and d.manager = ${A.pid}) limit 1`)[0].jugador;
  await sql`update public.fantasy_jugadores set copias = 1 + (select count(*) from public.fantasy_copias c where c.jugador = ${objetivoCl}) where person_id = ${objetivoCl}`;
  ok(err(await rpc('fantasy_clausulazo', { p_jugador: objetivoCl, p_dueno: B.pid }, A.t)) === 'hay_copias_libres', 'con copias libres no hay clausulazo');
  await sql`update public.fantasy_jugadores set copias = (select count(*) from public.fantasy_copias c where c.jugador = ${objetivoCl}) where person_id = ${objetivoCl}`;
  ok(err(await rpc('fantasy_clausulazo', { p_jugador: objetivoCl, p_dueno: B.pid }, A.t)) === 'plantilla_llena', 'clausulazo con la plantilla llena: antes hay que vender');
  const otro = (await sql`select c.jugador from public.fantasy_copias c where c.manager = ${A.pid} order by c.comprada_en limit 1`)[0].jugador;
  await rpc('fantasy_vender', { p_jugador: otro }, A.t);
  await sql`insert into public.fantasy_movimientos (manager, tipo, importe) values (${A.pid}, 'ajuste', 100), (${C.pid}, 'ajuste', 100)`;
  const precio = Math.round(valores.get(objetivoCl) * PARAMETROS.clausula * 10) / 10;
  const [antesA, antesB] = [await caja(A.pid), await caja(B.pid)];
  ok(err(await rpc('fantasy_clausulazo', { p_jugador: objetivoCl, p_dueno: C.pid }, A.t)) === 'dueno_no_valido' || (await sql`select 1 from public.fantasy_copias where jugador = ${objetivoCl} and manager = ${C.pid}`).length > 0, 'el dueño elegido tiene que tener la copia');
  const cl = await rpc('fantasy_clausulazo', { p_jugador: objetivoCl, p_dueno: B.pid }, A.t);
  ok(cl.status < 300 && Number(cl.datos.precio) === precio, 'clausulazo: paga valor x 1,5', `${err(cl)} ${cl.datos?.precio} / ${precio}`);
  ok(await caja(A.pid) === Math.round((antesA - precio) * 10) / 10 && await caja(B.pid) === Math.round((antesB + precio) * 10) / 10, 'el comprador paga y el dueño cobra');
  ok((await sql`select 1 from public.fantasy_copias where jugador = ${objetivoCl} and manager = ${A.pid}`).length === 1 && !(await sql`select 1 from public.fantasy_copias where jugador = ${objetivoCl} and manager = ${B.pid}`).length, 'la copia cambia de dueño');
  ok(!((await sql`select titulares from public.fantasy_alineaciones where manager = ${B.pid}`)[0]?.titulares ?? []).includes(objetivoCl), 'el robado sale de la alineación del dueño');
  await rpc('fantasy_vender', { p_jugador: (await sql`select jugador from public.fantasy_copias where manager = ${C.pid} and jugador <> ${objetivoCl} limit 1`)[0].jugador }, C.t);
  if (!(await sql`select 1 from public.fantasy_copias where jugador = ${objetivoCl} and manager = ${C.pid}`).length) {
    ok(err(await rpc('fantasy_clausulazo', { p_jugador: objetivoCl, p_dueno: A.pid }, C.t)) === 'copia_ya_robada', 'una copia robada no se vuelve a robar esa jornada');
  }
  await rpc('fantasy_vender', { p_jugador: (await sql`select jugador from public.fantasy_copias where manager = ${A.pid} and jugador <> ${objetivoCl} limit 1`)[0].jugador }, A.t);
  const segundo = (await sql`select c.jugador, c.manager from public.fantasy_copias c where c.manager not in (${A.pid}) and c.jugador <> ${A.pid}
    and not exists (select 1 from public.fantasy_copias d where d.jugador = c.jugador and d.manager = ${A.pid}) limit 1`)[0];
  await sql`update public.fantasy_jugadores set copias = (select count(*) from public.fantasy_copias c where c.jugador = ${segundo.jugador}) where person_id = ${segundo.jugador}`;
  ok(err(await rpc('fantasy_clausulazo', { p_jugador: segundo.jugador, p_dueno: segundo.manager }, A.t)) === 'clausulazo_gastado', 'un clausulazo por mánager y jornada');

  console.log('\n== Alineación, capitán y porra');
  const plantA = (await sql`select jugador from public.fantasy_copias where manager = ${A.pid} order by jugador`).map((x) => x.jugador);
  const cinco = plantA.slice(0, 5);
  ok(err(await rpc('fantasy_alinear', { p_titulares: [...cinco, 'sint-fz-beto'], p_capitan: cinco[0], p_vice: cinco[1] }, A.t)) !== '', 'no se alinea a más de 5 ni a quien no se tiene');
  ok(err(await rpc('fantasy_alinear', { p_titulares: cinco, p_capitan: plantA[5], p_vice: null }, A.t)) === 'capitan_no_alineado', 'el capitán tiene que estar alineado');
  ok(err(await rpc('fantasy_alinear', { p_titulares: cinco, p_capitan: cinco[0], p_vice: cinco[0] }, A.t)) === 'vice_no_valido', 'capitán y vicecapitán, distintos');
  ok((await rpc('fantasy_alinear', { p_titulares: cinco, p_capitan: cinco[0], p_vice: cinco[1] }, A.t)).status < 300, 'alinear 5 con capitán y vicecapitán');
  ok(err(await rpc('fantasy_apostar', { p_equipo: 'MdA', p_pronostico: 'empata' }, A.t)) === 'pronostico_no_valido', 'porra: solo gana o pierde');
  ok((await rpc('fantasy_apostar', { p_equipo: 'MdA', p_pronostico: 'gana' }, A.t)).status < 300 && (await rpc('fantasy_apostar', { p_equipo: 'MdL', p_pronostico: 'pierde' }, A.t)).status < 300, 'porra de los dos partidos');
  ok((await api('/fantasy_porras?select=manager', { token: B.t })).datos.length === 0, 'la porra de otro no se ve antes del cierre');

  console.log('\n== Horario');
  await sql`insert into public.convocatorias (fecha, jornada, estado) values ('2026-10-25', 3, 'borrador')`;
  ok(err(await rpc('fantasy_alinear', { p_titulares: [], p_capitan: null, p_vice: null }, G.t)) === 'gestor_bloqueado', 'con el borrador de la convocatoria, un gestor no opera');
  ok((await rpc('fantasy_apostar', { p_equipo: 'MdA', p_pronostico: 'gana' }, G.t)).status < 300, '…pero sí puede hacer la porra');
  ok(err(await rpc('fantasy_fichar', { p_jugador: cinco[0] }, G.t)) === 'gestor_bloqueado' && err(await rpc('fantasy_vender', { p_jugador: cinco[0] }, G.t)) === 'gestor_bloqueado' && err(await rpc('fantasy_clausulazo', { p_jugador: segundo.jugador, p_dueno: segundo.manager }, G.t)) === 'gestor_bloqueado', '…ni ficha, ni vende, ni hace clausulazos');
  ok((await rpc('fantasy_estado', {}, G.t)).datos.gestor_bloqueado === true && (await rpc('fantasy_estado', {}, A.t)).datos.gestor_bloqueado === false, 'la pantalla lo sabe: bloqueado el gestor, no el jugador');
  ok((await rpc('fantasy_alinear', { p_titulares: cinco, p_capitan: cinco[0], p_vice: cinco[1] }, A.t)).status < 300, 'a un jugador el borrador no le afecta');
  await sql`update public.convocatorias set estado = 'aprobada', aprobada_en = pruebas.ahora() where fecha = '2026-10-25'`;
  ok((await rpc('fantasy_alinear', { p_titulares: [], p_capitan: null, p_vice: null }, G.t)).status < 300, 'publicada la convocatoria, el gestor vuelve a operar');
  // El domingo pasa a ser mañana (martes 20/10): el «sábado a las 20:00» es hoy a las 20:00 → clausulazos aún abiertos; a hoy mismo por la noche → cerrados.
  await sql`update public.eventos set fecha = '2026-10-20' where fecha = '2026-10-25' and tipo = 'liga'`;
  await sql`update public.convocatorias set fecha = '2026-10-20' where fecha = '2026-10-25'`;
  await sql`update public.fantasy_alineaciones set jornada = '2026-10-20' where jornada = '2026-10-25'`;
  await sql`update public.fantasy_porras set jornada = '2026-10-20' where jornada = '2026-10-25'`;
  await sql`update public.fantasy_movimientos set jornada = '2026-10-20' where jornada = '2026-10-25'`;
  await sql`update public.fantasy_copias set robada_en = '2026-10-20' where robada_en = '2026-10-25'`;
  ok((await rpc('fantasy_estado', {}, B.t)).datos.clausulas_cerradas === false, 'clausulazos abiertos hasta la víspera a las 20:00');
  await sql`update public.eventos set fecha = '2026-10-19', inicio = '21:00' where fecha = '2026-10-20' and tipo = 'liga'`;
  for (const t of ['convocatorias']) await sql.unsafe(`update public.${t} set fecha = '2026-10-19' where fecha = '2026-10-20'`);
  for (const t of ['fantasy_alineaciones', 'fantasy_porras', 'fantasy_movimientos']) await sql.unsafe(`update public.${t} set jornada = '2026-10-19' where jornada = '2026-10-20'`);
  await sql`update public.fantasy_copias set robada_en = '2026-10-19' where robada_en = '2026-10-20'`;
  const eB = (await rpc('fantasy_estado', {}, B.t)).datos;
  ok(eB.clausulas_cerradas === true && eB.cerrado === false, 'desde la víspera a las 20:00: clausulazos cerrados, el resto abierto');
  ok(err(await rpc('fantasy_clausulazo', { p_jugador: segundo.jugador, p_dueno: segundo.manager }, B.t)) === 'clausulas_cerradas' || segundo.manager === B.pid, 'clausulazo fuera de hora: no');
  ok(err(await rpc('fantasy_clausulazo', { p_jugador: segundo.jugador, p_dueno: segundo.manager }, C.t)) === 'clausulas_cerradas' || segundo.manager === C.pid, '…ni para otro mánager');
  // Empieza el primer partido (hoy a las 09:00): todo cerrado y las alineaciones se ven.
  await sql`update public.eventos set inicio = '09:00' where fecha = '2026-10-19' and tipo = 'liga'`;
  ok(err(await rpc('fantasy_vender', { p_jugador: cinco[0] }, A.t)) === 'cerrado' && err(await rpc('fantasy_alinear', { p_titulares: cinco, p_capitan: cinco[1], p_vice: null }, A.t)) === 'cerrado' && err(await rpc('fantasy_apostar', { p_equipo: 'MdA', p_pronostico: 'gana' }, A.t)) === 'cerrado', 'desde el primer partido: mercado, alineación y porra cerrados');
  ok(err(await rpc('fantasy_alta', {}, X.t)) !== '' , 'una cuenta sin ficha no crea equipo');
  ok((await api('/fantasy_alineaciones?select=manager', { token: B.t })).datos.length >= 2 && (await api('/fantasy_porras?select=manager', { token: B.t })).datos.length >= 2, 'tras el cierre se ven las alineaciones y las porras de todos');

  console.log('\n== Cierre de la jornada con mánagers, repetible');
  const oficial = new Map((await sql`select person_id, nombre_oficial from public.jugadores`).map((x) => [x.person_id, x.nombre_oficial]));
  const al = (await sql`select titulares, capitan from public.fantasy_alineaciones where manager = ${A.pid} and jornada = '2026-10-19'`)[0];
  await publicar(3, '2026-10-19', 'MdA', 66, 50, al.titulares.slice(0, 5).map((id, i) => [id.startsWith('sint-') ? `PRUEBA, ${id.slice(8).toUpperCase()}` : hoja(oficial.get(id)), 2880, 10 + i, 16]));
  await publicar(3, '2026-10-19', 'MdL', 40, 52, ocho(4, [9, 8, 7, 6, 5, 4, 3, 2]));
  await sql`update public.fantasy_managers set alta_en = alta_en - interval '2 days'`; // se apuntaron antes del primer partido
  const cierre = await puntuar();
  ok(cierre.length === 1 && cierre[0].fecha === '2026-10-19', 'la jornada se puntúa al estar las dos hojas');
  const pm = await sql`select manager, total, porra, ingreso, detalle from public.fantasy_puntos_manager where jornada = '2026-10-19'`;
  ok(pm.length === 5, 'puntos de los cinco mánagers');
  const pa = pm.find((x) => x.manager === A.pid);
  ok(Number(pa.porra) === 2 * PARAMETROS.porraAcierto, 'porra: dos aciertos (MdA gana, MdL pierde)', String(pa.porra));
  ok(pa.detalle.dobla === al.capitan && pa.detalle.jugadores.find((j) => j.person_id === al.capitan).doble > 0, 'el capitán dobla su rendimiento');
  const cajas = async () => JSON.stringify(await sql`select manager, sum(importe) s, count(*) n from public.fantasy_movimientos group by 1 order by 1`);
  const antes = await cajas();
  ok((await sql`select count(*)::int n from public.fantasy_movimientos where tipo = 'ingreso'`)[0].n === 5, 'un ingreso por mánager');
  await sql`update public.fantasy_jornadas set huella = null where fecha = '2026-10-19'`;
  ok((await puntuar()).length === 1 && await cajas() === antes && (await sql`select count(*)::int n from public.fantasy_puntos_manager`)[0].n === 5, 'volver a puntuar la misma jornada no duplica ingresos ni puntos');
  await sql`update public.liga_estadisticas_jugador set pts = pts + 10 where nombre = ${hoja(fichas[4].nombre_oficial)} and partido_id in (select id from public.liga_partidos where jornada = 3)`;
  ok((await puntuar()).length === 1, 'si la hoja cambia, la jornada se vuelve a puntuar sola');
  ok((await sql`select count(*)::int n from public.fantasy_duelos where jornada = '2026-10-19'`)[0].n === 3 && (await sql`select count(*)::int n from public.fantasy_duelos where jornada = '2026-10-19' and manager_b is null`)[0].n === 1, 'duelos: cinco mánagers, dos duelos y uno descansa');
  ok((await sql`select count(*)::int n from public.fantasy_logros where logro = 'mejor_jornada'`)[0].n >= 1, 'logro: mejor mánager de la jornada');
  ok((await rpc('fantasy_estado', {}, A.t)).datos.jornada > '2026-10-19', 'puntuada la jornada, el mercado pasa a la siguiente y se abre');
  ok(err(await rpc('fantasy_alinear', { p_titulares: al.titulares, p_capitan: al.capitan, p_vice: null }, A.t)) === 'capitan_repetido', 'el capitán no puede repetir dos jornadas seguidas');

  console.log('\n== Corregir la asistencia real de una jornada ya puntuada');
  const pendiente = async () => (await sql`select huella is null p from public.fantasy_jornadas where fecha = '2026-10-19'`)[0].p;
  const ingresos = async () => (await sql`select count(*)::int n from public.fantasy_movimientos where tipo = 'ingreso'`)[0].n;
  const nIngresos = await ingresos();
  ok(!(await pendiente()) && (await puntuar()).length === 0, 'la jornada está puntuada y no hay nada pendiente');
  await sql`insert into public.asistencia_eventos (person_id, evento_ref, nombre, temporada, fecha, ambito, titulo, estado, origen) values ('sint-fz-ana', 'prueba-fz-correccion', 'Ana', '2026-27', '2026-10-19', 'entrenos', 'Entreno', 'sin_excusa', 'plataforma')`;
  ok(await pendiente(), 'marcar un «no vino» en un entreno de esa semana deja la jornada pendiente');
  ok((await puntuar()).length === 1 && !(await pendiente()), '…y se vuelve a puntuar');
  await sql`update public.asistencia_eventos set motivo = 'x' where evento_ref = 'prueba-fz-correccion'`;
  ok(!(await pendiente()), 'cambiar solo el motivo (privado, no puntúa) no toca nada');
  await sql`update public.asistencia_eventos set estado = 'fue' where evento_ref = 'prueba-fz-correccion'`;
  ok(await pendiente() && (await puntuar()).length === 1, 'corregirlo («sí vino») la deja pendiente otra vez y se recalcula');
  await sql`delete from public.asistencia_eventos where evento_ref = 'prueba-fz-correccion'`;
  ok(await pendiente() && (await puntuar()).length === 1 && await ingresos() === nIngresos, 'borrar la marca también recalcula; los ingresos no se duplican');

  console.log('\n== Primera respuesta de cada jugador (disparador)');
  const ev = (await sql`select id from public.eventos where tipo = 'entreno' and fecha > '2026-10-19' order by fecha limit 1`)[0].id;
  await sql`insert into public.respuestas (evento_id, person_id, respuesta, origen, fuente, cambiado_en) values (${ev}, 'sint-fz-ana', 'va', 'jugador', 'web', pruebas.ahora())`;
  await sql`update public.respuestas set respuesta = 'no', cambiado_en = pruebas.ahora() + interval '2 days' where evento_id = ${ev} and person_id = 'sint-fz-ana'`;
  const pr = await sql`select primera_en < pruebas.ahora() + interval '1 day' igual from public.fantasy_primeras_respuestas where evento_id = ${ev} and person_id = 'sint-fz-ana'`;
  ok(pr.length === 1 && pr[0].igual, 'se guarda la primera respuesta, no la última');
  await sql`insert into public.respuestas (evento_id, person_id, respuesta, origen, fuente, puesto_por_nombre) values (${ev}, 'sint-fz-beto', 'va', 'gestor', 'web', 'Gema')`;
  ok(!(await sql`select 1 from public.fantasy_primeras_respuestas where person_id = 'sint-fz-beto'`).length, 'lo que pone un gestor no cuenta como respuesta del jugador');

  console.log('\n== La tarea de cada 15 minutos (lib/fantasy/tarea.ts)');
  const sb = createClient(url, SERVICIO, { auth: { persistSession: false, autoRefreshToken: false } });
  ok((await tareaFantasy(sb, ahoraPrueba())).puntuadas.length === 0, 'sin nada nuevo, no puntúa nada');
  await sql`update public.fantasy_jornadas set huella = null where fecha = '2026-10-19'`;
  const [entAyer] = await sql`update public.eventos set fecha = '2026-10-18' where id = (select id from public.eventos where tipo = 'entreno' and oficial and estado = 'programado' and fecha > '2026-10-19' order by fecha limit 1) returning id`;
  const t1 = await tareaFantasy(sb, ahoraPrueba());
  ok(t1.puntuadas.join() === '2026-10-19', 'puntúa sola la jornada pendiente');
  const claves = t1.filas.map((f) => f.clave.split(':').slice(0, 2).join(':'));
  ok(t1.filas.length > 0 && t1.filas.every((f) => f.tipo === 'gestores' && f.user_id === G.uid && !f.person_id), 'los avisos van solo a los gestores', JSON.stringify(claves));
  ok(claves.includes(`fantasy-falto:${entAyer.id}`), '«¿Faltó alguien ayer?» por el entreno de ayer (son más de las 9:00)', JSON.stringify(claves));
  ok(t1.filas.find((f) => f.clave.startsWith('fantasy-falto'))?.url === `/evento/${entAyer.id}/asistencia`, '…con enlace a la pantalla de asistencia');
  const faltos = (r) => JSON.stringify(r.filas.map((f) => f.clave).filter((c) => c.startsWith('fantasy-falto')));
  ok(faltos(await tareaFantasy(sb, ahoraPrueba())) === faltos(t1), 'la clave del aviso es estable: repetir la tarea no lo duplica');
  await sql`insert into public.asistencia_eventos (person_id, evento_ref, nombre, temporada, fecha, ambito, titulo, estado, origen) values ('sint-fz-ana', ${entAyer.id}, 'Ana', '2026-27', '2026-10-18', 'entrenos', 'Entreno', 'fue', 'plataforma')`;
  ok(faltos(await tareaFantasy(sb, ahoraPrueba())) === '[]', 'respondido por un gestor, ya no se pregunta');
  await sql`delete from public.asistencia_eventos where evento_ref = ${entAyer.id}`;
  ok(faltos(await tareaFantasy(sb, new Date(ahoraPrueba().getTime() - 3 * 3600000))) === '[]', 'antes de las 9:00 no se pregunta');
  await sql`update public.fantasy_config set modo = 'apagado'`;
  await sql`update public.fantasy_jornadas set huella = null where fecha = '2026-10-19'`;
  const t2 = await tareaFantasy(sb, ahoraPrueba());
  ok(t2.puntuadas.length === 1 && t2.filas.length === 0, 'apagado: sigue puntuando (para el valor de mercado) y no avisa a nadie');
  await sql`update public.fantasy_config set modo = 'todos'`;

  console.log('\n== Ninguna función abierta al anónimo');
  const abiertas = await sql`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like '%fantasy%' and has_function_privilege('anon', p.oid, 'execute')`;
  ok(!abiertas.length, 'ninguna función del fantasy la puede ejecutar el anónimo', abiertas.map((x) => x.proname).join());

  console.log(`\n== Migración ${MIG} reversible (D111)`);
  await revertirPosteriores(sql, MIGS, MIG);
  await sql.unsafe(fs.readFileSync(path.join(MIGS, `${MIG}_mdfantasy.revertir.sql`), 'utf8'));
  const quedan = await sql`select (select count(*)::int from pg_tables where schemaname = 'public' and tablename like 'fantasy%') t,
    (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like '%fantasy%') f,
    (select count(*)::int from pg_trigger where tgname like 'fantasy%') g,
    (select count(*)::int from supabase_migrations.schema_migrations where version = ${MIG}) r`;
  ok(quedan[0].t === 0 && quedan[0].f === 0 && quedan[0].g === 0 && quedan[0].r === 0, 'revertida: sin tablas, funciones, disparador ni registro', JSON.stringify(quedan[0]));
  ok((await sql`select count(*)::int n from public.respuestas where person_id = 'sint-fz-ana'`)[0].n === 1, 'las respuestas siguen intactas');
  await migrar(sql, { log: () => {} });
  ok((await sql`select modo from public.fantasy_config`)[0].modo === 'apagado' && (await rpc('fantasy_acceso', {}, A.t)).datos === false, 'se vuelve a aplicar, y vuelve a nacer apagado');
} catch (e) { fallos++; console.log(`  FALLO ${e.stack}`); }
finally { await pila.parar(); }
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
