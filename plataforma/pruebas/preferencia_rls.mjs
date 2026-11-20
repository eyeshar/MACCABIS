#!/usr/bin/env node
// Preferencia de partido (D194) contra la pila LOCAL (Postgres + PostgREST con NUESTRAS migraciones). Jugadores SINTÉTICOS
// y el calendario de prueba (D185: «hoy» es el 19/10/2026), nunca datos reales. Nunca imprime notas ni motivos (CI).
//   - Privacidad (RLS): la lee SOLO el propio jugador y los gestores; otro jugador y el anónimo, nada; nadie escribe
//     directamente en la tabla (ni un gestor): solo guardar_preferencia / quitar_preferencia.
//   - Solo con «va» a los dos partidos (también «Voy» a la misma hora); motivo obligatorio y de la lista; nota obligatoria
//     con «otro»; 200 letras como mucho; partido cerrado, no.
//   - Se borra SOLA si deja de ir a los dos: su respuesta del domingo («solo» o «no»), un gestor que responde por él, una
//     ausencia, o un partido cancelado.
//   - Tras APROBAR la convocatoria, un cambio solo deja una alerta a los gestores («pref:…»); antes, ninguna.
//   - La lista de motivos de la base es la de src/lib/respuestas/preferencia.ts (MOTIVOS_PREFERENCIA).
//   - Migración 20261120100000 reversible (D111): se deshace limpia y se vuelve a aplicar.
//
//   npm run pruebas:preferencia-rls
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { arrancar } from './pila.mjs';
import { migrar } from './infra/migrar.mjs';
import { hoyMadrid } from './fechas_prueba.mjs';
import { revertirPosteriores } from './revertir_posteriores.mjs';
import { cargarEventos } from './infra/calendario.mjs';
import { MOTIVOS_PREFERENCIA } from '../src/lib/respuestas/preferencia.ts';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const MIGS = path.join(AQUI, '..', 'supabase', 'migrations');
const MIG = '20261120100000';
let fallos = 0;
const ok = (cond, que, detalle = '') => {
  if (cond) console.log(`  OK    ${que}`);
  else { fallos++; console.log(`  FALLO ${que}${detalle ? ` -> ${detalle}` : ''}`); }
};

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
  const rpc = (f, args, token) => api(`/rpc/${f}`, { metodo: 'POST', cuerpo: args, token });
  const error = (r) => (r.datos && (r.datos.message || r.datos.msg)) || '';
  const hoy = hoyMadrid();
  await cargarEventos(sql, { log: () => {} });

  // Dos domingos futuros con los dos partidos: uno a horas distintas y otro que se pone a la misma hora.
  const dobles = await sql`select fecha::text, array_agg(id order by inicio, equipo) ids, array_agg(equipo order by inicio, equipo) eqs
    from public.eventos where tipo = 'liga' and estado = 'programado' and fecha > ${hoy} group by fecha having count(*) = 2 order by fecha limit 3`;
  ok(dobles.length === 3, 'calendario de prueba: tres domingos futuros con MdA y MdL', String(dobles.length));
  const [D1, D2, D3] = dobles;
  await sql`update public.eventos e set inicio = (select min(inicio) from public.eventos where fecha = ${D2.fecha} and tipo = 'liga') where e.fecha = ${D2.fecha} and e.tipo = 'liga'`;
  await sql`insert into public.jugadores (person_id, nombre_oficial, nombre_visible, ficha_mda, ficha_mdl, rol, entrena) values
    ('sint-pref-ana', 'Prueba, Ana', 'Ana', true, true, 'jugador', true),
    ('sint-pref-beto', 'Prueba, Beto', 'Beto', true, true, 'jugador', true),
    ('sint-pref-cira', 'Prueba, Cira', 'Cira', true, false, 'jugador', true)`;
  const jugador = async (personId, email) => {
    await sql`update public.jugadores set email = ${email} where person_id = ${personId}`;
    const uid = await pila.crearUsuario(email, 'no-se-usa');
    return pila.firmar({ sub: uid, role: 'authenticated', email });
  };
  const tA = await jugador('sint-pref-ana', 'ana@pruebas.local');
  const tB = await jugador('sint-pref-beto', 'beto@pruebas.local');
  const tC = await jugador('sint-pref-cira', 'cira@pruebas.local');
  const gUid = await pila.crearUsuario('gestor@pruebas.local', 'no-se-usa');
  await sql`insert into public.gestores (user_id, nombre, email) values (${gUid}, 'Iván', 'gestor@pruebas.local')`;
  const tG = await pila.firmar({ sub: gUid, role: 'authenticated', email: 'gestor@pruebas.local' });
  const intrusoUid = await pila.crearUsuario('intruso@pruebas.local', 'no-se-usa');
  const tI = await pila.firmar({ sub: intrusoUid, role: 'authenticated', email: 'intruso@pruebas.local' });
  const filas = async (person) => sql`select fecha::text, evento_id, motivo, nota from public.preferencias_domingo where person_id = ${person} order by fecha`;
  const guardar = (t, fecha, evento, motivo, nota) => rpc('guardar_preferencia', { p_fecha: fecha, p_evento: evento, p_motivo: motivo, p_nota: nota ?? null }, t);

  console.log('\n== Solo con «va» a los dos partidos');
  let r = await guardar(tA, D1.fecha, D1.ids[1], 'trabajo');
  ok(r.status >= 400 && /preferencia_sin_los_dos/.test(error(r)), 'sin responder: «preferencia_sin_los_dos»', `${r.status} ${error(r)}`);
  r = await rpc('responder_domingo', { p_fecha: D1.fecha, p_opcion: 'ambos' }, tA);
  ok(r.status < 300, 'Ana: «A los dos» el ' + D1.fecha, `${r.status} ${error(r)}`);
  r = await guardar(tA, D1.fecha, D1.ids[1], null);
  ok(r.status >= 400 && /preferencia_falta_motivo/.test(error(r)), 'sin motivo: «preferencia_falta_motivo» (motivo obligatorio)', `${r.status} ${error(r)}`);
  r = await guardar(tA, D1.fecha, D1.ids[1], 'aburrimiento');
  ok(r.status >= 400 && /preferencia_falta_motivo/.test(error(r)), 'motivo fuera de la lista: rechazado');
  r = await guardar(tA, D1.fecha, D1.ids[1], 'otro', '   ');
  ok(r.status >= 400 && /preferencia_falta_nota/.test(error(r)), '«otro» sin nota: «preferencia_falta_nota»');
  r = await guardar(tA, D1.fecha, D1.ids[1], 'otro', 'x'.repeat(201));
  ok(r.status >= 400 && /preferencia_nota_larga/.test(error(r)), 'nota de 201 letras: «preferencia_nota_larga»');
  r = await guardar(tA, D1.fecha, D2.ids[0], 'trabajo');
  ok(r.status >= 400 && /opcion_no_valida/.test(error(r)), 'un partido de otro día: «opcion_no_valida»');
  r = await guardar(tA, D1.fecha, D1.ids[1], 'ninos', 'nota sintética');
  ok(r.status < 300 && r.datos?.alerta === false, 'Ana guarda su preferencia (sin convocatoria aprobada: sin alerta)', `${r.status} ${error(r)}`);
  let f = await filas('sint-pref-ana');
  ok(f.length === 1 && f[0].evento_id === D1.ids[1] && f[0].motivo === 'ninos', 'guardada: partido y motivo');
  r = await guardar(tA, D1.fecha, D1.ids[0], 'otro', 'nota sintética 2');
  f = await filas('sint-pref-ana');
  ok(r.status < 300 && f.length === 1 && f[0].evento_id === D1.ids[0], 'cambiarla no duplica: una fila por domingo');

  r = await rpc('responder_domingo', { p_fecha: D1.fecha, p_opcion: 'solo', p_evento: D1.ids[0] }, tB);
  ok(r.status < 300, 'Beto: «solo» al primero');
  r = await guardar(tB, D1.fecha, D1.ids[0], 'trabajo');
  ok(r.status >= 400 && /preferencia_sin_los_dos/.test(error(r)), 'con «solo» a uno: no se puede');
  r = await rpc('responder_domingo', { p_fecha: D1.fecha, p_opcion: 'voy' }, tC);
  ok(r.status < 300, 'Cira (solo ficha del MdA): «Voy»', `${r.status} ${error(r)}`);
  r = await guardar(tC, D1.fecha, D1.ids[0], 'trabajo');
  ok(r.status >= 400 && /preferencia_sin_los_dos/.test(error(r)), 'con una sola ficha: no se puede');

  console.log('\n== Misma hora: «Voy» = cualquiera de los dos');
  r = await rpc('responder_domingo', { p_fecha: D2.fecha, p_opcion: 'voy' }, tB);
  ok(r.status < 300, 'Beto: «Voy» el ' + D2.fecha + ' (los dos a la misma hora)', `${r.status} ${error(r)}`);
  r = await guardar(tB, D2.fecha, D2.ids[1], 'desplazamiento');
  ok(r.status < 300, 'Beto guarda su preferencia a la misma hora', `${r.status} ${error(r)}`);

  console.log('\n== Privacidad (RLS)');
  r = await api('/preferencias_domingo?select=*', { token: tA });
  ok(r.status === 200 && r.datos.length === 1 && r.datos.every((x) => x.person_id === 'sint-pref-ana'), 'Ana lee SOLO la suya', JSON.stringify(r.datos?.map((x) => x.person_id)));
  r = await api('/preferencias_domingo?select=*&person_id=eq.sint-pref-ana', { token: tB });
  ok(r.status === 200 && r.datos.length === 0, 'Beto NO lee la de Ana');
  r = await api('/preferencias_domingo?select=*', { token: tI });
  ok(r.status === 200 && r.datos.length === 0, 'una cuenta sin ficha no lee ninguna');
  r = await api('/preferencias_domingo?select=*');
  ok(r.status === 401 || (r.status === 200 && r.datos.length === 0) || r.status === 403, 'el anónimo no lee ninguna', String(r.status));
  r = await api('/preferencias_domingo?select=*', { token: tG });
  ok(r.status === 200 && r.datos.length === 2, 'un gestor las lee todas (2)', String(r.datos?.length));
  for (const [quien, t] of [['un jugador', tA], ['un gestor', tG]]) {
    r = await api('/preferencias_domingo', { metodo: 'POST', cuerpo: { fecha: D3.fecha, person_id: 'sint-pref-ana', evento_id: D3.ids[0], motivo: 'trabajo' }, token: t });
    ok(r.status >= 400, `${quien} no inserta directamente en la tabla`, String(r.status));
    await api(`/preferencias_domingo?person_id=eq.sint-pref-ana`, { metodo: 'PATCH', cuerpo: { motivo: 'familia' }, token: t });
    await api(`/preferencias_domingo?person_id=eq.sint-pref-ana`, { metodo: 'DELETE', token: t });
    f = await filas('sint-pref-ana');
    ok(f.length === 1 && f[0].motivo === 'otro', `${quien} no la cambia ni la borra directamente`);
  }
  r = await rpc('guardar_preferencia', { p_fecha: D1.fecha, p_evento: D1.ids[0], p_motivo: 'trabajo' });
  ok(r.status >= 400, 'el anónimo no puede usar guardar_preferencia', String(r.status));
  const colsQuien = (await sql`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'v_quien_va'`).map((x) => x.column_name);
  ok(!colsQuien.some((c) => /pref|motivo|nota/.test(c)), '«quién va» (v_quien_va) no lleva preferencia, motivo ni nota', colsQuien.join(','));
  const funcsPublicas = (await sql`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like '%prefer%' and has_function_privilege('anon', p.oid, 'execute')`).map((x) => x.proname);
  ok(!funcsPublicas.length, 'ninguna función de preferencias abierta al anónimo', funcsPublicas.join(','));

  console.log('\n== Se borra sola si deja de ir a los dos');
  r = await rpc('responder_domingo', { p_fecha: D1.fecha, p_opcion: 'solo', p_evento: D1.ids[1] }, tA);
  ok(r.status < 300 && (await filas('sint-pref-ana')).length === 0, 'Ana pasa a «solo» a uno: preferencia borrada');
  await rpc('responder_domingo', { p_fecha: D1.fecha, p_opcion: 'ambos' }, tA);
  await guardar(tA, D1.fecha, D1.ids[0], 'trabajo');
  r = await rpc('responder_domingo', { p_fecha: D1.fecha, p_opcion: 'no', p_motivo: 'trabajo' }, tA);
  ok(r.status < 300 && (await filas('sint-pref-ana')).length === 0, '«No voy»: borrada');
  await rpc('responder_domingo', { p_fecha: D1.fecha, p_opcion: 'ambos' }, tA);
  await guardar(tA, D1.fecha, D1.ids[0], 'trabajo');
  r = await rpc('responder_por', { p_evento: D1.ids[1], p_person: 'sint-pref-ana', p_respuesta: 'no', p_motivo: 'trabajo' }, tG);
  ok(r.status < 300 && (await filas('sint-pref-ana')).length === 0, 'un gestor responde «no» por ella a un partido: borrada', `${r.status} ${error(r)}`);
  await rpc('responder_domingo', { p_fecha: D1.fecha, p_opcion: 'ambos' }, tA);
  await guardar(tA, D1.fecha, D1.ids[0], 'trabajo');
  r = await rpc('guardar_ausencia', { p_id: null, p_desde: D1.fecha, p_hasta: D1.fecha, p_motivo: 'viaje', p_detalle: null }, tA);
  ok(r.status < 300 && (await filas('sint-pref-ana')).length === 0, 'una ausencia que cubre el domingo: borrada', `${r.status} ${error(r)}`);
  const [aus] = await sql`select id from public.ausencias_periodo where person_id = 'sint-pref-ana' and borrada_en is null`;
  if (aus) await rpc('borrar_ausencia', { p_id: aus.id }, tA);
  r = await rpc('responder_domingo', { p_fecha: D1.fecha, p_opcion: 'ambos' }, tA);
  r = await guardar(tA, D1.fecha, D1.ids[0], 'trabajo');
  ok(r.status < 300 && (await filas('sint-pref-ana')).length === 1, 'vuelve a «A los dos» y la guarda otra vez', `${r.status} ${error(r)}`);
  await sql`update public.eventos set estado = 'cancelado' where id = ${D2.ids[0]}`;
  ok(!(await filas('sint-pref-beto')).length, 'se cancela uno de los dos partidos: la de ese domingo, borrada');

  console.log('\n== Tras aprobar la convocatoria: solo avisa a los gestores');
  const alertas = async () => (await sql`select count(*)::int n from public.alertas_gestores where person_id = 'sint-pref-ana' and despues like 'pref:%'`)[0].n;
  ok(await alertas() === 0, 'antes de aprobar: ninguna alerta');
  await sql`insert into public.convocatorias (fecha, jornada, estado, origen, equipos, aprobada_en) values (${D1.fecha}, 9, 'aprobada', 'propuesta', ${sql.json({ MdA: [{ person_id: 'sint-pref-ana' }] })}, pruebas.ahora())
            on conflict (fecha) do update set estado = 'aprobada', equipos = excluded.equipos`;
  r = await guardar(tA, D1.fecha, D1.ids[1], 'familia');
  ok(r.status < 300 && r.datos?.alerta === true && await alertas() === 1, 'cambia de partido: una alerta «pref:» para los gestores');
  const [al] = await sql`select e.equipo, a.antes, a.despues from public.alertas_gestores a join public.eventos e on e.id = a.evento_id where a.person_id = 'sint-pref-ana' and a.despues like 'pref:%'`;
  ok(al && al.antes === `pref:${D1.eqs[0]}` && al.despues === `pref:${D1.eqs[1]}`, 'la alerta dice de qué partido a cuál (sin motivo ni nota)', JSON.stringify(al));
  r = await guardar(tA, D1.fecha, D1.ids[1], 'trabajo');
  ok(await alertas() === 1, 'cambiar solo el motivo no avisa');
  const conv = (await sql`select equipos from public.convocatorias where fecha = ${D1.fecha}`)[0].equipos;
  ok(JSON.stringify(conv) === JSON.stringify({ MdA: [{ person_id: 'sint-pref-ana' }] }), 'la convocatoria aprobada no cambia sola');
  r = await rpc('quitar_preferencia', { p_fecha: D1.fecha }, tA);
  ok(r.status < 300 && !(await filas('sint-pref-ana')).length && await alertas() === 2, 'quitarla: borrada, y otra alerta («pref:-»)');

  console.log('\n== Partido cerrado');
  r = await rpc('responder_domingo', { p_fecha: D3.fecha, p_opcion: 'ambos' }, tA);
  ok(r.status < 300, 'Ana: «A los dos» el ' + D3.fecha, `${r.status} ${error(r)}`);
  await sql`update public.eventos set inicio = '00:30' where id = any(${D3.ids})`;
  await sql`update public.respuestas set respuesta = 'va' where person_id = 'sint-pref-ana' and evento_id = any(${D3.ids})`;
  await sql`update public.eventos set fecha = ${hoy} where id = any(${D3.ids})`;
  await sql`update public.respuestas set respuesta = 'va' where person_id = 'sint-pref-ana' and evento_id = any(${D3.ids})`;
  r = await guardar(tA, hoy, D3.ids[0], 'trabajo');
  ok(r.status >= 400 && /evento_cerrado/.test(error(r)), 'con los partidos empezados: «evento_cerrado»', `${r.status} ${error(r)}`);

  console.log('\n== La lista de motivos es una sola');
  const [chk] = await sql`select pg_get_constraintdef(c.oid) d from pg_constraint c where c.conrelid = 'public.preferencias_domingo'::regclass and pg_get_constraintdef(c.oid) like '%motivo = ANY%'`;
  const enBase = [...(chk?.d ?? '').matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1]).filter((x) => x !== 'otro' || true);
  const enCodigo = MOTIVOS_PREFERENCIA.map((m) => m.id);
  ok(JSON.stringify([...new Set(enBase)].sort()) === JSON.stringify([...enCodigo].sort()), 'los motivos de la base = MOTIVOS_PREFERENCIA (src/lib/respuestas/preferencia.ts)', `${[...new Set(enBase)]} | ${enCodigo}`);
  const fuente = (await sql`select prosrc from pg_proc where proname = 'guardar_preferencia'`)[0]?.prosrc ?? '';
  ok(enCodigo.every((m) => fuente.includes(`'${m}'`)), 'y guardar_preferencia comprueba los mismos');

  console.log(`\n== Migración ${MIG} reversible (D111)`);
  const existe = async () => (await sql`select to_regclass('public.preferencias_domingo') r`)[0].r !== null;
  const funcs = async () => (await sql`select count(*)::int n from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname in ('guardar_preferencia', 'quitar_preferencia', '_domingo_doble', '_alerta_preferencia', '_preferencia_tras_respuesta', '_preferencia_tras_evento')`)[0].n;
  ok(await existe() && await funcs() === 6, 'aplicada: la tabla y las 6 funciones');
  await revertirPosteriores(sql, MIGS, MIG);
  await sql.unsafe(fs.readFileSync(path.join(MIGS, `${MIG}_preferencia_partido.revertir.sql`), 'utf8'));
  ok(!(await existe()) && await funcs() === 0 && !(await sql`select 1 from supabase_migrations.schema_migrations where version = ${MIG}`).length, 'revertir.sql quita tabla, funciones, disparadores y su registro');
  r = await rpc('responder_domingo', { p_fecha: D1.fecha, p_opcion: 'ambos' }, tA);
  ok(r.status < 300, 'sin la migración, responder sigue funcionando', `${r.status} ${error(r)}`);
  await migrar(sql, { log: () => {} });
  ok(await existe() && await funcs() === 6, 'se vuelve a aplicar');
  // PostgREST guarda el esquema en caché: hasta que vea la función otra vez (tres veces seguidas, como rls_respuestas_web).
  await sql`notify pgrst, 'reload schema'`;
  const enCache = async () => (await rpc('guardar_preferencia', { p_fecha: D1.fecha, p_evento: D1.ids[0], p_motivo: 'trabajo' })).status !== 404;
  for (let i = 0, seguidas = 0; i < 80 && seguidas < 3; i++) { seguidas = (await enCache()) ? seguidas + 1 : 0; await new Promise((ya) => setTimeout(ya, 250)); }
  r = await guardar(tA, D1.fecha, D1.ids[0], 'trabajo');
  ok(r.status < 300 && (await filas('sint-pref-ana')).length === 1, 'y vuelve a guardar', `${r.status} ${error(r)}`);
} catch (err) {
  fallos++;
  console.log(`  FALLO ${err.stack}`);
} finally {
  await pila.parar();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
