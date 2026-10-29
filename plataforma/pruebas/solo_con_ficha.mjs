#!/usr/bin/env node
// Pista «solo jugadores con ficha» (D148), contra la pila LOCAL (Postgres + PostgREST reales con NUESTRAS migraciones):
//   - la migración 20261029100000 es reversible (se deshace limpia y se vuelve a aplicar);
//   - entreno en una pista con la marca: quien no tiene ficha no está invitado (base y web, la misma regla) y no lo ve en
//     su agenda ni en «quién va»; con ficha, igual que antes; entreno en otra pista o con ubicación libre: los sin ficha
//     cuentan como siempre; los partidos no cambian; nada más cambia (matriz completa de invitados antes y después);
//   - la web: recordatorios y aviso del paso a «no va» sin ellos, y el aviso para el gestor;
//   - permisos: ningún jugador lee la marca, la columna calculada ni la ficha de otros (igual que antes);
//   - los datos del 29/10/2026 (supabase/datos/20261029_valdebernardo_reabre.sql): los entrenos del 04/11 al 05/05
//     quedan cerrados con la nota «no se copia», fuera de la cola de SportEasy, y ningún otro evento cambia su copia;
//     y su vuelta atrás.
//
//   npm run pruebas:solo-ficha
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { arrancar } from './pila.mjs';
import { migrar } from '../scripts/db.mjs';
import { cargarEventos } from '../scripts/cargar_eventos.mjs';
import { quienResponde, fueraPorFicha, avisoSinFicha } from '../src/lib/respuestas/dominio.ts';
import { resumenCopia, noSeCopia } from '../src/lib/eventos/dominio.ts';
import { invitados, avisosPasoNoVa } from '../src/lib/avisos/planificador.ts';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIG = path.join(RAIZ, 'supabase', 'migrations', '20261029100000_pista_solo_con_ficha');
const DATOS = path.join(RAIZ, 'supabase', 'datos', '20261029_valdebernardo_reabre');
const NOTA = 'Iván: no se copia a SportEasy (29/10/2026)';
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };
const SIN_FICHA = ['feliz-gomez-edimil', 'mateos-aparicio-ignacio', 'yamin-squicciarini-nicolas'];

const pila = await arrancar();
try {
  const { sql, url, anonKey } = pila;
  const api = async (ruta, { metodo = 'GET', cuerpo, token } = {}) => {
    const r = await fetch(`${url}/rest/v1${ruta}`, { method: metodo, headers: { apikey: anonKey, authorization: `Bearer ${token ?? anonKey}`, 'content-type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    let datos = null; try { datos = await r.json(); } catch {}
    return { status: r.status, datos };
  };
  await cargarEventos(sql, { log: () => {} });
  const registrada = async () => (await sql`select 1 from supabase_migrations.schema_migrations where version = '20261029100000'`).length === 1;
  const hayColumna = async () => (await sql`select 1 from information_schema.columns where table_schema = 'public' and table_name = 'pistas' and column_name = 'solo_con_ficha'`).length === 1;
  const hayFuncion = async () => (await sql`select to_regprocedure('public.solo_con_ficha_en(public.eventos)') is not null as f`)[0].f;
  const matriz = async () => (await sql`select e.clave, j.person_id, public._invitado(j.person_id, e.id) as inv from public.eventos e cross join public.jugadores j order by 1, 2`)
    .map((r) => `${r.clave}|${r.person_id}|${r.inv}`);

  console.log('\n== Migración reversible');
  ok(await registrada() && await hayColumna() && await hayFuncion(), 'aplicada: columna pistas.solo_con_ficha y función solo_con_ficha_en');
  ok((await sql`select count(*)::int n from public.pistas where solo_con_ficha`)[0].n === 0, 'por defecto ninguna pista tiene la marca');
  const conLaMigracion = await matriz();
  await sql.begin((tx) => tx.unsafe(fs.readFileSync(`${MIG}.revertir.sql`, 'utf8')));
  ok(!(await registrada()) && !(await hayColumna()) && !(await hayFuncion()), 'revertida: sin columna, sin función y sin registro');
  const antes = await matriz();
  ok(antes.join() === conLaMigracion.join(), `sin ninguna pista marcada, los invitados son los mismos con y sin la migración (${antes.length} pares)`);
  await migrar(sql, { log: () => {} });
  ok(await registrada() && await hayColumna() && await hayFuncion(), 'aplicada de nuevo');

  console.log('\n== Los datos del 29/10/2026 (Valdebernardo reabierta y solo con ficha)');
  const copia = async () => Object.fromEntries((await sql`select clave, sporteasy_estado, sporteasy_cambio, sporteasy_copiado_en from public.eventos`).map((r) => [r.clave, JSON.stringify([r.sporteasy_estado, r.sporteasy_cambio, r.sporteasy_copiado_en])]));
  // Un entreno del rango con pista propia y otro horario, ya copiado (en el real no hay ninguno): debe pasar a
  // Valdebernardo 20:30–22:30 y quedar cerrado con la nota, aunque el disparador lo deje antes «pendiente».
  await sql`update public.eventos set pista_id = (select id from public.pistas where slug = 'caja-magica'), inicio = '20:00', fin = '21:00', sporteasy_estado = 'copiado', sporteasy_cambio = null where clave = 'entreno-semanal-2026-11-11'`;
  const copiaAntes = await copia();
  await sql.begin((tx) => tx.unsafe(fs.readFileSync(`${DATOS}.sql`, 'utf8')));
  const [v] = await sql`select estado, solo_con_ficha, nota from public.pistas where slug = 'valdebernardo'`;
  ok(v.estado === 'habitual' && v.solo_con_ficha === true && !/obras/i.test(v.nota), 'Valdebernardo: habitual, solo con ficha y sin la nota de obras', JSON.stringify(v));
  const rango = await sql`select clave, fecha::text, inicio::text, fin::text, pista_id, sporteasy_estado, sporteasy_cambio from public.eventos where tipo = 'entreno' and fecha between '2026-11-04' and '2027-05-05' order by fecha`;
  ok(rango.length === 23, '23 entrenos del 04/11/2026 al 05/05/2027', String(rango.length));
  ok(!rango.some((r) => ['2026-12-23', '2026-12-30', '2027-01-06', '2027-03-24'].includes(r.fecha)), 'ninguno en los miércoles sin entreno de D87 (23/12, 30/12, 06/01, 24/03)');
  ok(rango.every((r) => r.inicio === '20:30:00' && r.fin === '22:30:00' && r.pista_id === null), 'todos de 20:30 a 22:30 en la pista de la serie (Valdebernardo), también el que tenía otra pista y otro horario');
  ok(rango.every((r) => r.sporteasy_estado === 'copiado' && r.sporteasy_cambio === NOTA), `todos cerrados con la nota «${NOTA}», también el que el disparador habría dejado pendiente`);
  const copiaDespues = await copia();
  const otros = Object.keys(copiaAntes).filter((k) => !rango.some((r) => r.clave === k) && copiaAntes[k] !== copiaDespues[k]);
  ok(otros.length === 0, 'ningún otro evento cambia su estado de copia a SportEasy (tampoco los pasados)', otros.join(', '));
  const filas = (await sql`select id, clave, tipo, fecha::text, estado, oficial, origen, serie, sporteasy_estado, sporteasy_cambio from public.eventos`).map((r) => ({ ...r }));
  const cola = resumenCopia(filas, '2026-10-29');
  ok(!cola.pendientes.some((e) => rango.some((r) => r.clave === e.clave)), 'no salen en «Copia a SportEasy» ni en el filtro «Pendientes» (resumenCopia)');
  ok(filas.filter((e) => rango.some((r) => r.clave === e.clave)).every(noSeCopia) && !filas.filter((e) => !rango.some((r) => r.clave === e.clave)).some(noSeCopia), 'la web marca «No se copia» esos y solo esos');
  ok((await sql`select pista_nombre n from public.v_eventos_publicos where clave = 'entreno-semanal-2026-11-04'`)[0].n === 'Valdebernardo (Faustina Valladolid)', 'lo público: el 04/11 en Valdebernardo, no «pista por confirmar»');

  console.log('\n== La regla en la base');
  const id = async (clave) => (await sql`select id from public.eventos where clave = ${clave}`)[0].id;
  const inv = async (p, clave) => (await sql`select public._invitado(${p}, ${await id(clave)}) i`)[0].i;
  const E = { valde: 'entreno-semanal-2026-11-04', caja: 'entreno-semanal-2026-11-18', libre: 'entreno-semanal-2026-11-25', liga: 'mda-j2' };
  await sql`update public.eventos set pista_id = (select id from public.pistas where slug = 'caja-magica') where clave = ${E.caja}`;
  await sql`update public.eventos set ubicacion_nombre = 'Ciudad de los Periodistas' where clave = ${E.libre}`;
  ok((await sql`select public.solo_con_ficha_en(e) s from public.eventos e where clave = ${E.valde}`)[0].s === 'Valdebernardo', 'solo_con_ficha_en: «Valdebernardo» en un entreno sin pista propia');
  ok((await sql`select public.solo_con_ficha_en(e) s from public.eventos e where clave in (${E.caja}, ${E.libre}, ${E.liga})`).every((r) => r.s === null), 'y null en otra pista, con ubicación libre y en un partido');
  for (const p of SIN_FICHA) ok(!(await inv(p, E.valde)), `${p}: sin ficha, NO invitado al entreno en Valdebernardo`);
  ok(await inv('esteban-jon', E.valde) && await inv('galan-domingo-guillermo', E.valde), 'con ficha (MdA y MdL, o solo MdA): invitado como siempre');
  for (const p of SIN_FICHA) ok(await inv(p, E.caja) && await inv(p, E.libre), `${p}: invitado al entreno en otra pista y al de ubicación libre`);
  const despues = await matriz();
  const marcados = new Set((await sql`select clave from public.eventos e where public.solo_con_ficha_en(e) is not null`).map((r) => r.clave));
  const cambian = despues.filter((x, i) => x !== antes[i]);
  const esperados = antes.filter((x) => { const [clave, p, i] = x.split('|'); return marcados.has(clave) && SIN_FICHA.includes(p) && i === 'true'; }).length;
  ok(antes.length === despues.length && cambian.length === esperados && cambian.every((x) => { const [clave, p, i] = x.split('|'); return marcados.has(clave) && SIN_FICHA.includes(p) && i === 'false'; }),
    `solo cambian los sin ficha en los entrenos de Valdebernardo: ${cambian.length} pares (${marcados.size} entrenos × 3)`, cambian.slice(0, 5).join(' '));
  ok(!cambian.some((x) => /^(mda|mdl)-/.test(x)), 'los partidos no cambian para nadie');
  ok(!cambian.some((x) => x.startsWith(`${E.caja}|`) || x.startsWith(`${E.libre}|`)), 'el entreno en otra pista y el de ubicación libre no cambian');

  console.log('\n== La misma regla en la web (quienResponde) que en la base');
  const jugadores = await sql`select person_id, ficha_mda, ficha_mdl, entrena, activo, rol from public.jugadores`;
  const evs = await sql`select e.id, e.clave, e.tipo, e.equipo, e.oficial, public.solo_con_ficha_en(e) as solo_con_ficha_en from public.eventos e`;
  const base = new Map((await sql`select e.id, j.person_id, public._invitado(j.person_id, e.id) i from public.eventos e cross join public.jugadores j`).map((r) => [`${r.id}|${r.person_id}`, r.i]));
  const distintos = evs.flatMap((e) => jugadores.filter((j) => quienResponde(e, j) !== base.get(`${e.id}|${j.person_id}`)).map((j) => `${e.clave}|${j.person_id}`));
  ok(distintos.length === 0, `web = base en los ${evs.length * jugadores.length} pares evento × jugador`, distintos.slice(0, 5).join(' '));
  const eValde = evs.find((e) => e.clave === E.valde);
  const ignacio = jugadores.find((j) => j.person_id === 'mateos-aparicio-ignacio');
  const jon = jugadores.find((j) => j.person_id === 'esteban-jon');
  ok(fueraPorFicha(eValde, ignacio) && !fueraPorFicha(evs.find((e) => e.clave === E.caja), ignacio) && !fueraPorFicha(eValde, jon), 'fueraPorFicha: Ignacio fuera en Valdebernardo, no en otra pista; Jon nunca');
  ok(avisoSinFicha('Valdebernardo') === 'Sin ficha: no puede entrenar en Valdebernardo', 'el aviso: «Sin ficha: no puede entrenar en Valdebernardo»');
  const plan = { id: eValde.id, tipo: 'entreno', equipo: 'ambos', fecha: '2026-11-04', inicio: '20:30', fin: '22:30', quedada: null, titulo: null, sitio: 'Valdebernardo', estado: 'programado', sin_recordatorios: false, creado_en: '2026-10-01T00:00:00Z', oficial: true, solo_con_ficha_en: 'Valdebernardo' };
  ok(!invitados(plan, jugadores).some((j) => SIN_FICHA.includes(j.person_id)) && invitados({ ...plan, solo_con_ficha_en: null }, jugadores).some((j) => SIN_FICHA.includes(j.person_id)), 'recordatorios: el planificador no los cuenta en Valdebernardo; en otra pista, sí');
  const sis = (p) => ({ evento_id: plan.id, person_id: p, respuesta: 'no', motivo: 'no_confirmo', origen: 'sistema', cambiado_en: '2026-11-03T19:00:30Z' });
  const paso = avisosPasoNoVa({ eventos: [plan], respuestas: [sis('mateos-aparicio-ignacio'), sis('esteban-jon')], jugadores }, new Date('2026-11-03T19:05:00Z'));
  ok(paso.length === 1 && paso[0].person_id === 'esteban-jon', 'aviso del paso de «duda» a «no va»: no le llega al sin ficha (sí a Jon)', JSON.stringify(paso.map((a) => a.person_id)));

  console.log('\n== Jugadores: agenda, «quién va» y permisos');
  const jugador = async (personId, email) => {
    await sql`update public.jugadores set email = ${email} where person_id = ${personId}`;
    const uid = await pila.crearUsuario(email, 'no-se-usa');
    return pila.firmar({ sub: uid, role: 'authenticated', email });
  };
  const tIgnacio = await jugador('mateos-aparicio-ignacio', 'ignacio@pruebas.local');
  const tJon = await jugador('esteban-jon', 'jon@pruebas.local');
  const valdeId = await id(E.valde), cajaId = await id(E.caja);
  const agendaI = (await api('/v_mi_agenda?select=id', { token: tIgnacio })).datos ?? [];
  ok(Array.isArray(agendaI) && !agendaI.some((x) => x.id === valdeId) && agendaI.some((x) => x.id === cajaId), 'Ignacio (sin ficha): no ve el entreno de Valdebernardo en su agenda; sí el de otra pista', JSON.stringify(agendaI).slice(0, 200));
  const agendaJ = (await api('/v_mi_agenda?select=id', { token: tJon })).datos ?? [];
  ok(Array.isArray(agendaJ) && agendaJ.some((x) => x.id === valdeId), 'Jon (con ficha): lo ve como siempre');
  const qv = (await api(`/v_quien_va?evento_id=eq.${valdeId}`, { token: tJon })).datos ?? [];
  ok(Array.isArray(qv) && qv.length > 0 && !qv.some((x) => ['Edimil', 'Ignacio', 'Nicolás'].includes(x.nombre)) && Object.keys(qv[0]).sort().join() === 'estado,evento_id,nombre', '«quién va» del entreno: sin los que no tienen ficha, y solo nombre y estado', JSON.stringify(qv.slice(0, 2)));
  for (const [quien, t] of [['anónimo', undefined], ['un jugador', tJon]]) {
    const p = await api('/pistas?select=slug,solo_con_ficha', { token: t });
    ok(p.status >= 400 || (Array.isArray(p.datos) && p.datos.length === 0), `${quien} no lee la marca de las pistas`, JSON.stringify(p));
    const e = await api('/eventos?select=id,solo_con_ficha_en', { token: t });
    ok(e.status >= 400 || (Array.isArray(e.datos) && e.datos.length === 0), `${quien} no lee la columna calculada de los eventos`, JSON.stringify(e).slice(0, 200));
    const j = await api('/jugadores?select=person_id,ficha_mda,ficha_mdl', { token: t });
    const otros = Array.isArray(j.datos) ? j.datos.filter((x) => x.person_id !== 'esteban-jon') : [];
    ok(j.status >= 400 || otros.length === 0, `${quien} no lee la ficha de otros jugadores (igual que antes)`, JSON.stringify(j).slice(0, 200));
  }
  ok(!(await sql`select has_function_privilege('anon', 'public.solo_con_ficha_en(public.eventos)', 'execute') p`)[0].p, 'anon no puede ejecutar solo_con_ficha_en');
  await sql`update public.respuestas_web_config set encendido = true where id = 1`;
  const r = await api('/rpc/responder', { metodo: 'POST', cuerpo: { p_evento: valdeId, p_respuesta: 'va' }, token: tIgnacio });
  ok(r.status >= 400 && JSON.stringify(r.datos).includes('no_invitado'), 'Ignacio no puede responder al entreno de Valdebernardo (no_invitado)', JSON.stringify(r.datos));
  const r2 = await api('/rpc/responder', { metodo: 'POST', cuerpo: { p_evento: cajaId, p_respuesta: 'va' }, token: tIgnacio });
  ok(r2.status < 400, 'y sí al de otra pista', JSON.stringify(r2.datos));

  console.log('\n== El gestor lee la columna calculada (PostgREST)');
  const gUid = await pila.crearUsuario('gestor@pruebas.local', 'no-se-usa');
  await sql`insert into public.gestores (user_id, nombre, email) values (${gUid}, 'Iván', 'gestor@pruebas.local')`;
  const tG = await pila.firmar({ sub: gUid, role: 'authenticated', email: 'gestor@pruebas.local' });
  const g = (await api(`/eventos?select=clave,solo_con_ficha_en&clave=in.(${E.valde},${E.caja},${E.liga})`, { token: tG })).datos ?? [];
  const de = (c) => (Array.isArray(g) ? g.find((x) => x.clave === c) : null)?.solo_con_ficha_en;
  ok(de(E.valde) === 'Valdebernardo' && de(E.caja) === null && de(E.liga) === null, 'eventos?select=solo_con_ficha_en: Valdebernardo / null / null', JSON.stringify(g));
  const pg = (await api('/pistas?select=slug,solo_con_ficha&slug=eq.valdebernardo', { token: tG })).datos ?? [];
  ok(pg[0]?.solo_con_ficha === true, 'y la marca de la pista');

  console.log('\n== Vuelta atrás de los datos');
  await sql.begin((tx) => tx.unsafe(fs.readFileSync(`${DATOS}.revertir.sql`, 'utf8')));
  const [v2] = await sql`select estado, solo_con_ficha from public.pistas where slug = 'valdebernardo'`;
  ok(v2.estado === 'en_obras' && v2.solo_con_ficha === false, 'Valdebernardo vuelve a «en obras» sin la marca');
  ok((await sql`select count(*)::int n from public.eventos where sporteasy_cambio = ${NOTA}`)[0].n === 0, 'y sin la nota «no se copia»');
  ok(await inv('mateos-aparicio-ignacio', E.valde), 'y los sin ficha vuelven a estar invitados');
} catch (err) {
  console.log(`  FALLO ${err.stack}`); fallos++;
} finally {
  await pila.parar();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
