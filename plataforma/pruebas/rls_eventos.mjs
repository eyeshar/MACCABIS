#!/usr/bin/env node
// Eventos, pistas, respuestas, ausencias, diccionario e importaciones (paso 2, pista E, D94), contra la pila LOCAL
// (Postgres + PostgREST reales con NUESTRAS migraciones):
//   - las migraciones son reversibles (su .revertir.sql las deshace limpias y se pueden volver a aplicar);
//   - la copia de asistencia_motivos a asistencia_resumen cuadra y no toca el origen;
//   - la carga inicial deja 40 partidos, 4 descansos y 27 entrenos, cuadra 1:1 con la fuente y es repetible;
//   - RLS: anonimo y jugador no leen ni escriben nada de lo privado; el gestor lee y escribe; NADIE borra;
//   - lo publico lee una vista sin respuestas, motivos, estado de SportEasy ni datos personales;
//   - la pista efectiva (en obras -> "por confirmar", reabierta -> Valdebernardo) y el aviso de "pendiente de copiar".
//
//   npm run pruebas:eventos

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { arrancar } from './pila.mjs';
import { migrar } from '../scripts/db.mjs';
import { cargarEventos } from '../scripts/cargar_eventos.mjs';
import { cuadrar } from '../scripts/cuadre_eventos.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const MIGS = path.join(AQUI, '..', 'supabase', 'migrations');
const REPO = path.join(AQUI, '..', '..');
let fallos = 0;
const ok = (cond, que, detalle = '') => {
  if (cond) console.log(`  OK    ${que}`);
  else { fallos++; console.log(`  FALLO ${que}${detalle ? ` -> ${detalle}` : ''}`); }
};
const TABLAS_PRIVADAS = ['eventos', 'pistas', 'descansos', 'respuestas', 'ausencias_periodo', 'diccionario_sporteasy', 'importaciones', 'asistencia_resumen'];

const pila = await arrancar();
try {
  const { sql, url, anonKey } = pila;
  const api = async (ruta, { metodo = 'GET', cuerpo, token, extra } = {}) => {
    const r = await fetch(`${url}/rest/v1${ruta}`, {
      method: metodo,
      headers: { apikey: anonKey, authorization: `Bearer ${token ?? anonKey}`, 'content-type': 'application/json', prefer: 'return=representation', ...extra },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    let datos = null;
    try { datos = await r.json(); } catch {}
    return { status: r.status, datos };
  };
  const vacioOBloqueado = (r) => r.status === 401 || r.status === 403 || r.status === 404 || (Array.isArray(r.datos) && r.datos.length === 0);
  const tablaExiste = async (n) => (await sql`select to_regclass(${'public.' + n}) as r`)[0].r !== null;

  console.log('\n== Reversibilidad: cada migración se deshace con su .revertir.sql y se puede volver a aplicar');
  ok(fs.existsSync(path.join(MIGS, '20261007230000_eventos_pistas.revertir.sql')) && fs.existsSync(path.join(MIGS, '20261007231000_respuestas_ausencias_asistencia.revertir.sql')), 'cada migración nueva tiene su revertir.sql al lado');
  for (const n of TABLAS_PRIVADAS) ok(await tablaExiste(n), `existe public.${n}`);
  // Datos de asistencia para probar la copia (la pila arranca con la tabla vacia).
  await sql.unsafe(fs.readFileSync(path.join(MIGS, '20261007232000_pista_habitual_publica.revertir.sql'), 'utf8'));
  await sql.unsafe(fs.readFileSync(path.join(MIGS, '20261007231000_respuestas_ausencias_asistencia.revertir.sql'), 'utf8'));
  ok(!(await tablaExiste('respuestas')) && !(await tablaExiste('asistencia_resumen')), 'revertir la 2.ª migración quita respuestas, ausencias, diccionario, importaciones y resumen');
  ok(await tablaExiste('asistencia_motivos'), 'asistencia_motivos sigue ahí (no se toca)');
  await sql.unsafe(fs.readFileSync(path.join(MIGS, '20261007230000_eventos_pistas.revertir.sql'), 'utf8'));
  ok(!(await tablaExiste('eventos')) && !(await tablaExiste('pistas')), 'revertir la 1.ª migración quita eventos, pistas y descansos');
  const filasOrigen = [
    ['2025-26', 'esteban-jon', 'Jon Esteban', 'partidos', 20, 3, 1, 2, 4, 30], ['2025-26', 'esteban-jon', 'Jon Esteban', 'entrenos', 25, 5, 0, 1, 2, 33],
    ['2026-27', 'gianatti-adriano', 'Adriano Gianatti', 'partidos', 2, 0, 0, 0, 0, 2], ['2026-27', 'romero-barrueco-alonso', 'Alonso Romero', 'entrenos', 1, 1, 0, 0, 1, 3],
  ];
  for (const f of filasOrigen) {
    await sql`insert into public.asistencia_motivos (temporada, person_id, nombre, ambito, fueron, excusa, sin_excusa, no_conv, lesion, total) values (${f[0]}, ${f[1]}, ${f[2]}, ${f[3]}, ${f[4]}, ${f[5]}, ${f[6]}, ${f[7]}, ${f[8]}, ${f[9]})`;
  }
  const huellaOrigen = JSON.stringify(await sql`select * from public.asistencia_motivos order by temporada, person_id, ambito`);
  await migrar(sql, { log: () => {} });
  for (const n of TABLAS_PRIVADAS) ok(await tablaExiste(n), `tras volver a aplicar existe public.${n}`);
  const versiones = (await sql`select version from supabase_migrations.schema_migrations`).map((x) => x.version);
  ok(versiones.includes('20261007230000') && versiones.includes('20261007231000'), 'las dos migraciones quedan registradas');

  console.log('\n== Copia de asistencia_motivos -> asistencia_resumen (recuento verificado)');
  const [{ n: nRes }] = await sql`select count(*)::int n from public.asistencia_resumen`;
  ok(nRes === filasOrigen.length, `${filasOrigen.length} filas copiadas`, String(nRes));
  const [r0] = await sql`select * from public.asistencia_resumen where person_id = 'esteban-jon' and ambito = 'partidos' and temporada = '2025-26'`;
  ok(r0 && r0.fueron === 20 && r0.con_excusa === 3 && r0.sin_excusa === 1 && r0.no_convocado === 2 && r0.lesion === 4 && r0.total === 30, 'los valores columna a columna son los del origen');
  ok(JSON.stringify(await sql`select * from public.asistencia_motivos order by temporada, person_id, ambito`) === huellaOrigen, 'asistencia_motivos queda idéntica (no se toca)');
  // Si la copia no cuadrase, la migracion aborta entera: se simula con un resumen corrupto.
  await sql.unsafe(fs.readFileSync(path.join(MIGS, '20261007231000_respuestas_ausencias_asistencia.revertir.sql'), 'utf8'));
  await sql`insert into public.asistencia_motivos (temporada, person_id, nombre, ambito, fueron, total) values ('2026-27', 'zzz', 'Z', 'partidos', 1, 1)`;
  await migrar(sql, { log: () => {} });
  ok((await sql`select count(*)::int n from public.asistencia_resumen`)[0].n === filasOrigen.length + 1, 'una fila más en el origen se copia también');

  console.log('\n== Carga inicial y cuadre 1:1');
  const cal = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'calendario_2026-27.json'), 'utf8'));
  for (const c of cal.partidos) {
    await sql`insert into public.liga_calendario (temporada, equipo, jornada, fecha, hora, local, descansa, rival, campo) values ('2026-27', ${c.equipo}, ${c.jornada}, ${c.fecha}, ${c.hora}, ${c.local}, ${!!c.descansa}, ${c.rival}, ${c.campo})`;
  }
  const c1 = await cargarEventos(sql, { log: () => {} });
  ok(c1.nuevos === 67 && c1.partidos === 40 && c1.entrenos === 27 && c1.descansos === 4, 'primera carga: 40 partidos + 27 entrenos = 67 eventos, 4 descansos', JSON.stringify(c1));
  const c2 = await cargarEventos(sql, { log: () => {} });
  ok(c2.nuevos === 0, 'repetir la carga no duplica nada');
  const lineas = [];
  const q = await cuadrar(sql, { log: (l) => lineas.push(l) });
  ok(q.fallos === 0 && q.partidos === 40 && q.descansos === 4 && q.entrenos === 27, `el cuadre sale OK (${q.comprobaciones} comprobaciones)`, lineas.filter((l) => l.includes('FALLO')).slice(0, 3).join(' | '));
  const [{ n: nDic }] = await sql`select count(*)::int n from public.diccionario_sporteasy`;
  ok(nDic === 32, 'diccionario de SportEasy: 32 nombres', String(nDic));
  const [{ n: nPistas }] = await sql`select count(*)::int n from public.pistas`;
  ok(nPistas === 3, 'catálogo de pistas: 3');
  const pst = Object.fromEntries((await sql`select slug, estado, uso, num_pistas, direccion, es_de_serie from public.pistas`).map((p) => [p.slug, p]));
  ok(pst.valdebernardo.estado === 'en_obras' && pst.valdebernardo.uso === 'entreno' && pst.valdebernardo.es_de_serie, 'Valdebernardo: entreno habitual de la serie, en obras');
  ok(pst['caja-magica'].estado === 'provisional' && pst['caja-magica'].direccion === null, 'Caja Mágica: provisional y SIN dirección (no se inventa)');
  ok(pst['cdm-moratalaz'].uso === 'partido' && pst['cdm-moratalaz'].num_pistas === 3 && /Valdebernardo, 2, 28030/.test(pst['cdm-moratalaz'].direccion), 'CDM Moratalaz: partidos, 3 pistas, C/ Valdebernardo 2, 28030');
  ok((await sql`select count(*)::int n from public.eventos where quedada is null`)[0].n === 0, 'todo evento con hora tiene quedada');
  const [q1] = await sql`select quedada from public.eventos where clave = 'mda-j2'`;
  ok(String(q1.quedada).slice(0, 5) === '09:55', 'quedada por defecto 20 min antes (10:15 -> 09:55)', String(q1.quedada));

  console.log('\n== Cuentas de prueba (solo en la pila local)');
  await sql`update public.jugadores set email = 'jugador@pruebas.local' where person_id = 'esteban-jon'`;
  const gestorId = await pila.crearUsuario('gestor@pruebas.local', 'no-se-usa');
  await sql`insert into public.gestores (user_id, nombre, email) values (${gestorId}, 'Gestor de pruebas', 'gestor@pruebas.local')`;
  const jugadorId = await pila.crearUsuario('jugador@pruebas.local', 'no-se-usa');
  const intrusoId = await pila.crearUsuario('intruso@pruebas.local', 'no-se-usa');
  const jwt = (id, email) => pila.firmar({ sub: id, role: 'authenticated', email });
  const tG = await jwt(gestorId, 'gestor@pruebas.local'), tJ = await jwt(jugadorId, 'jugador@pruebas.local'), tI = await jwt(intrusoId, 'intruso@pruebas.local');

  console.log('\n== RLS: lectura de lo privado');
  for (const t of TABLAS_PRIVADAS) {
    ok(vacioOBloqueado(await api(`/${t}?select=*`)), `anónimo NO lee ${t}`);
    ok(vacioOBloqueado(await api(`/${t}?select=*`, { token: tJ })), `un jugador NO lee ${t} (ni siquiera lo suyo)`);
    ok(vacioOBloqueado(await api(`/${t}?select=*`, { token: tI })), `un usuario sin ficha NO lee ${t}`);
    const r = await api(`/${t}?select=*`, { token: tG });
    ok(r.status === 200 && r.datos.length > 0 || (r.status === 200 && ['respuestas', 'ausencias_periodo', 'importaciones'].includes(t)), `el gestor lee ${t}`, `${r.status}`);
  }
  const rg = await api('/eventos?select=*&limit=1000', { token: tG });
  ok(rg.datos.length === 67, 'el gestor ve los 67 eventos');

  console.log('\n== RLS: escritura solo gestores; nadie borra');
  const nuevoEvento = (clave) => ({ clave, tipo: 'amistoso', equipo: 'MdA', titulo: 'Amistoso de prueba', fecha: '2026-11-01', inicio: '10:00:00' });
  ok((await api('/eventos', { metodo: 'POST', cuerpo: nuevoEvento('x-anon') })).status >= 400, 'anónimo NO crea eventos');
  ok((await api('/eventos', { metodo: 'POST', cuerpo: nuevoEvento('x-jug'), token: tJ })).status >= 400, 'un jugador NO crea eventos');
  const creado = await api('/eventos', { metodo: 'POST', cuerpo: nuevoEvento('x-gestor'), token: tG });
  ok(creado.status === 201 && creado.datos[0].sporteasy_estado === 'pendiente', 'el gestor crea un evento (nace pendiente de copiar)');
  const idNuevo = creado.datos?.[0]?.id;
  ok(String(creado.datos?.[0]?.quedada).slice(0, 5) === '09:40', 'la quedada del nuevo evento sale 20 min antes (09:40)');
  for (const [quien, token] of [['anónimo', undefined], ['jugador', tJ], ['gestor', tG]]) {
    await api(`/eventos?clave=eq.mda-j2`, { metodo: 'DELETE', token });
    await api(`/pistas?slug=eq.caja-magica`, { metodo: 'DELETE', token });
    await api(`/diccionario_sporteasy?person_id=neq.zzz`, { metodo: 'DELETE', token });
    await api(`/importaciones?id=not.is.null`, { metodo: 'DELETE', token });
    void quien;
  }
  ok((await sql`select count(*)::int n from public.eventos`)[0].n === 68 && (await sql`select count(*)::int n from public.pistas`)[0].n === 3 && (await sql`select count(*)::int n from public.diccionario_sporteasy`)[0].n === 32, 'ni el gestor puede BORRAR eventos, pistas ni diccionario por la API');
  for (const t of TABLAS_PRIVADAS) {
    const [{ d, ins_anon }] = await sql`select has_table_privilege('authenticated', ${'public.' + t}, 'delete') d, has_table_privilege('anon', ${'public.' + t}, 'select') ins_anon`;
    ok(!d && !ins_anon, `${t}: authenticated sin DELETE y anon sin SELECT`);
  }
  const [{ rls_ok }] = await sql`select bool_and(relrowsecurity) rls_ok from pg_class where relname = any(${TABLAS_PRIVADAS}) and relnamespace = 'public'::regnamespace`;
  ok(rls_ok === true, 'RLS activada en las 8 tablas');
  ok((await api('/pistas', { metodo: 'POST', cuerpo: { slug: 'x', nombre: 'X', uso: 'entreno', estado: 'habitual' }, token: tJ })).status >= 400, 'un jugador NO crea pistas');
  ok((await api('/pistas', { metodo: 'POST', cuerpo: { slug: 'pista-nueva', nombre: 'Pista nueva', uso: 'entreno', estado: 'provisional' }, token: tG })).status === 201, 'el gestor crea una pista');
  ok((await api('/diccionario_sporteasy', { metodo: 'POST', cuerpo: { nombre_sporteasy: 'Nombre nuevo', person_id: 'esteban-jon' }, token: tJ })).status >= 400, 'un jugador NO toca el diccionario');
  ok((await api('/diccionario_sporteasy', { metodo: 'POST', cuerpo: { nombre_sporteasy: 'Nombre nuevo', person_id: 'esteban-jon', creado_por: 'prueba' }, token: tG })).status === 201, 'el gestor añade un nombre al diccionario');
  const resp = { evento_id: idNuevo, person_id: 'esteban-jon', respuesta: 'no', motivo: 'viaje', detalle: 'En Londres' };
  ok((await api('/respuestas', { metodo: 'POST', cuerpo: resp, token: tJ })).status >= 400, 'un jugador NO escribe respuestas (ni las suyas, hasta el paso 3)');
  ok((await api('/respuestas', { metodo: 'POST', cuerpo: resp })).status >= 400, 'anónimo NO escribe respuestas');
  ok((await api('/respuestas', { metodo: 'POST', cuerpo: resp, token: tG })).status === 201, 'el gestor guarda una respuesta con motivo');
  const up = await api('/respuestas?on_conflict=evento_id,person_id', { metodo: 'POST', cuerpo: { ...resp, respuesta: 'va', motivo: null, detalle: null }, token: tG, extra: { prefer: 'resolution=merge-duplicates,return=representation' } });
  ok((up.status === 201 || up.status === 200) && up.datos[0].respuesta === 'va' && (await sql`select count(*)::int n from public.respuestas`)[0].n === 1, 'repetir una respuesta la actualiza (una por persona y evento)', `${up.status} ${JSON.stringify(up.datos)}`);
  ok((await api('/respuestas', { metodo: 'POST', cuerpo: { ...resp, person_id: 'otro', respuesta: 'quizas' }, token: tG })).status >= 400, 'una respuesta fuera de la lista (va | duda | no | sin responder) se rechaza');
  ok((await api('/respuestas', { metodo: 'POST', cuerpo: { ...resp, person_id: 'otro', motivo: 'aburrimiento' }, token: tG })).status >= 400, 'un motivo fuera de la lista (lesión | trabajo | viaje | familia | otro) se rechaza');
  ok((await api('/ausencias_periodo', { metodo: 'POST', cuerpo: { person_id: 'esteban-jon', desde: '2026-12-20', hasta: '2026-12-10', motivo: 'viaje' }, token: tG })).status >= 400, 'una ausencia con "hasta" anterior a "desde" se rechaza');
  ok((await api('/ausencias_periodo', { metodo: 'POST', cuerpo: { person_id: 'esteban-jon', desde: '2026-12-20', hasta: '2027-01-03', motivo: 'viaje' }, token: tG })).status === 201, 'el gestor guarda una ausencia por periodo');
  ok((await api('/ausencias_periodo', { metodo: 'POST', cuerpo: { person_id: 'esteban-jon', desde: '2026-12-20', hasta: '2027-01-03', motivo: 'viaje' }, token: tJ })).status >= 400, 'un jugador NO guarda ausencias');
  ok((await api('/importaciones', { metodo: 'POST', cuerpo: { tipo: 'calendario', por_nombre: 'Gestor', lineas: 10 }, token: tG })).status === 201, 'el gestor registra una importación');
  ok((await api('/importaciones', { metodo: 'POST', cuerpo: { tipo: 'calendario', por_nombre: 'Intruso' }, token: tJ })).status >= 400, 'un jugador NO registra importaciones');
  ok((await api('/asistencia_resumen', { metodo: 'POST', cuerpo: { temporada: '2099-00', person_id: 'x', nombre: 'X', ambito: 'partidos' }, token: tG })).status >= 400, 'el resumen de asistencia no se escribe por la API (ni los gestores)');

  console.log('\n== Cambios: "pendiente de copiar" y "marcar como copiado"');
  const upd = (cuerpo, clave = 'x-gestor') => api(`/eventos?clave=eq.${clave}`, { metodo: 'PATCH', cuerpo, token: tG });
  let r = await upd({ sporteasy_estado: 'copiado', sporteasy_copiado_en: new Date().toISOString(), sporteasy_cambio: null });
  ok(r.datos[0].sporteasy_estado === 'copiado' && r.datos[0].sporteasy_cambio === null, 'marcar como copiado lo deja al día');
  r = await upd({ notas: 'Traed agua' });
  ok(r.datos[0].sporteasy_estado === 'pendiente' && r.datos[0].sporteasy_cambio, 'cambiar un dato lo devuelve a pendiente (aunque la app no lo diga)');
  r = await upd({ sporteasy_estado: 'copiado', sporteasy_cambio: null });
  r = await upd({ estado: 'cancelado', sporteasy_cambio: 'Cancelado' });
  ok(r.datos[0].sporteasy_estado === 'pendiente' && r.datos[0].sporteasy_cambio === 'Cancelado', 'cancelar también queda pendiente de copiar');
  ok((await api('/eventos?clave=eq.x-gestor', { metodo: 'PATCH', cuerpo: { notas: 'hack' }, token: tJ })).datos?.length !== 1, 'un jugador NO modifica eventos');

  console.log('\n== Lo público: una vista sin nada privado');
  const pub = await api('/v_eventos_publicos?select=*&limit=1000');
  ok(pub.status === 200 && pub.datos.length === 68, 'anónimo lee v_eventos_publicos (67 + el de prueba)', `${pub.status} ${pub.datos?.length}`);
  const cols = Object.keys(pub.datos[0]);
  const prohibidas = ['id', 'origen', 'serie', 'sporteasy_estado', 'sporteasy_cambio', 'sporteasy_copiado_en', 'creado_en', 'actualizado_en', 'pista_id', 'person_id', 'respuesta', 'motivo', 'detalle'];
  ok(!cols.some((c) => prohibidas.includes(c)), `la vista no lleva columnas privadas (${cols.join(', ')})`, cols.filter((c) => prohibidas.includes(c)).join(', '));
  const descPub = await api('/v_descansos_publicos?select=*');
  ok(descPub.status === 200 && descPub.datos.length === 4, 'anónimo lee v_descansos_publicos (4)');
  for (const t of ['eventos', 'respuestas', 'ausencias_periodo', 'diccionario_sporteasy', 'importaciones', 'asistencia_resumen']) {
    ok(!JSON.stringify(pub.datos).includes('"respuesta"') && !JSON.stringify(pub.datos).includes('Londres'), `ningún dato de ${t} se cuela en la vista`);
  }
  ok((await api('/v_eventos_publicos', { metodo: 'POST', cuerpo: {} })).status >= 400, 'la vista no admite escritura');

  console.log('\n== Pista efectiva en la vista pública');
  const vista = async (clave) => (await api(`/v_eventos_publicos?clave=eq.${clave}`)).datos[0];
  let e14 = await vista('entreno-semanal-2026-10-14');
  ok(e14.pista_por_confirmar === true && e14.pista_nombre === null && e14.pista_motivo === 'Valdebernardo en obras', 'entreno futuro con Valdebernardo en obras: «Pista por confirmar (Valdebernardo en obras)»', JSON.stringify(e14));
  const e7 = await vista('entreno-semanal-2026-10-07');
  ok(e7.pista_por_confirmar === false && e7.pista_nombre === 'Caja Mágica' && e7.notas === 'Cambiado solo esta semana.' && String(e7.inicio).slice(0, 5) === '20:00' && String(e7.fin).slice(0, 5) === '21:00', '07/10: Caja Mágica 20:00–21:00, «Cambiado solo esta semana»');
  const p2 = await vista('mda-j2');
  ok(p2.pista_nombre_corto === 'Moratalaz' && p2.numero_pista === 2 && p2.pista_por_confirmar === false && p2.es_local === true, 'partido: «Moratalaz · Pista 2»');
  // Pista propia en un miercoles concreto + reabrir Valdebernardo
  const caja = (await sql`select id from public.pistas where slug = 'caja-magica'`)[0].id;
  await sql`update public.eventos set pista_id = ${caja} where clave = 'entreno-semanal-2026-10-21'`;
  ok((await vista('entreno-semanal-2026-10-21')).pista_nombre === 'Caja Mágica', 'un miércoles con pista propia sale con ella');
  await sql`update public.pistas set estado = 'habitual' where slug = 'valdebernardo'`;
  e14 = await vista('entreno-semanal-2026-10-14');
  ok(e14.pista_por_confirmar === false && e14.pista_nombre === 'Valdebernardo (Faustina Valladolid)' && e14.pista_motivo === null, 'al reabrir Valdebernardo, los entrenos sin pista propia vuelven a ella');
  ok((await vista('entreno-semanal-2026-10-21')).pista_nombre === 'Caja Mágica', 'y los que tienen pista propia la conservan');
  await sql`update public.pistas set estado = 'en_obras' where slug = 'valdebernardo'`;
  await sql`update public.eventos set pista_id = null where clave = 'entreno-semanal-2026-10-21'`;
  ok((await vista('entreno-semanal-2026-10-14')).pista_por_confirmar === true, 'y al marcarla otra vez en obras vuelven a «por confirmar»');
  ok(!!(await vista('x-gestor')), 'un evento cancelado sigue en la vista con su estado (la web decide cómo mostrarlo)');
  ok((await vista('x-gestor')).estado === 'cancelado', 'estado cancelado visible');
} finally {
  await pila.parar();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
