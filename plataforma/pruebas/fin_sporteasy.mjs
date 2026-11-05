#!/usr/bin/env node
// Fin de SportEasy: limpieza total (D172). Pila local (Postgres + PostgREST), sin web. Jugadores SINTÉTICOS (D39).
//   - La migración 20261102200000 borra lo huérfano de SportEasy (columnas sporteasy_*, diccionario_sporteasy,
//     respuestas.sporteasy_descartado, respuestas_web_config.sporteasy_comprobado, ultima_importacion_respuestas) y las
//     funciones del interruptor «respuestas en la web»; nada de lo histórico (origen 'sporteasy', asistencia).
//   - Las respuestas en la web funcionan SIEMPRE: aunque la fila antigua de respuestas_web_config diga «apagado», un
//     jugador responde, marca una ausencia, un evento nuevo recibe las ausencias y cerrar_dudas cierra las de los oficiales.
//   - Los eventos, planes y convocatorias ya no rellenan nada de SportEasy.
//   - estado_activacion() solo da los contadores (sin nada del interruptor) y sigue siendo solo de gestores.
//   - Su .revertir.sql vuelve a crear la estructura (columnas, tabla con su RLS, funciones con sus permisos) y la
//     migración se vuelve a aplicar limpia.
//
//   npm run pruebas:fin-sporteasy
import fs from 'node:fs';
import path from 'node:path';
import { preparar, personas, sinteticos, contador, RAIZ } from './comun_e2e.mjs';
import { migrar } from './infra/migrar.mjs';

const MIGS = path.join(RAIZ, 'supabase', 'migrations');
const MIG = '20261102200000_fin_sporteasy';
const VERSION = MIG.slice(0, 14);
const BORRADAS = ['cambiar_interruptor', 'marcar_sporteasy', 'marcar_jornada', 'respuestas_web_encendido', '_exigir_encendido', '_respuestas_web_encendido',
  '_exigir_responsable', '_es_responsable', '_jornadas_limpias_seguidas', 'ultima_importacion_respuestas'];
const COLUMNAS = [['eventos', 'sporteasy_estado'], ['eventos', 'sporteasy_cambio'], ['eventos', 'sporteasy_copiado_en'], ['convocatorias', 'sporteasy_estado'],
  ['convocatorias', 'sporteasy_en'], ['convocatorias', 'sporteasy_base'], ['respuestas', 'sporteasy_descartado'], ['respuestas_web_config', 'sporteasy_comprobado']];

const { ok, fallos, sumar } = contador();
const e = await preparar({ compilar: false });
const { sql } = e;
const { url, anonKey } = e.pila;
const api = async (ruta, { metodo = 'GET', cuerpo, token } = {}) => {
  const r = await fetch(`${url}/rest/v1${ruta}`, {
    method: metodo,
    headers: { apikey: anonKey, authorization: `Bearer ${token ?? anonKey}`, 'content-type': 'application/json', prefer: 'return=representation' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  let datos = null;
  try { datos = await r.json(); } catch { /* sin cuerpo */ }
  return { status: r.status, datos };
};
const rpc = (f, args, token) => api(`/rpc/${f}`, { metodo: 'POST', cuerpo: args, token });
const recargar = async () => { await sql`notify pgrst, 'reload schema'`; await new Promise((r) => setTimeout(r, 0)); };
const columnas = async () => (await sql`select table_name || '.' || column_name c from information_schema.columns where table_schema = 'public' and column_name ilike '%sporteasy%' and table_name <> 'diccionario_sporteasy' order by 1`).map((r) => r.c);
const funciones = async () => (await sql`select proname from pg_proc where pronamespace = 'public'::regnamespace and proname in ${sql(BORRADAS)} order by 1`).map((r) => r.proname);
const tabla = async () => (await sql`select to_regclass('public.diccionario_sporteasy') r`)[0].r !== null;
const registrada = async () => (await sql`select 1 from supabase_migrations.schema_migrations where version = ${VERSION}`).length === 1;
// Lo que hay de SportEasy en el código de las funciones de public (fuera de lo histórico: el valor 'sporteasy' de origen/fuente).
const funcionesConSportEasy = async () => (await sql`select p.proname from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
  and pg_get_functiondef(p.oid) ~* 'sporteasy_|diccionario_sporteasy|respuestas_web_encendido|_exigir_encendido' order by 1`).map((r) => r.proname);

try {
  console.log('\n== La migración: lo de SportEasy y el interruptor, fuera');
  const texto = fs.readFileSync(path.join(MIGS, `${MIG}.sql`), 'utf8');
  ok(fs.existsSync(path.join(MIGS, `${MIG}.revertir.sql`)), 'tiene su .revertir.sql al lado');
  // Fuera de los cuerpos de las funciones (que sí actualizan sus tablas al usarse), ninguna sentencia toca filas.
  const sentencias = texto.replace(/\$function\$[\s\S]*?\$function\$/g, '').replace(/--.*$/gm, '');
  ok(!/\bdelete\s+from\b|\btruncate\b|\bupdate\s+public\.|\binsert\s+into\b/i.test(sentencias), 'no borra ni cambia filas: solo estructura y funciones');
  ok(!/(alter|drop) table public\.(ausencias_periodo|asistencia_eventos|asistencia_motivos)/i.test(texto) && !/drop constraint/i.test(texto), 'no toca lo histórico (ausencias, asistencia, valores de origen)');
  ok(await registrada(), 'aplicada y registrada');
  ok((await columnas()).length === 0, 'sin columnas sporteasy_* en ninguna tabla', (await columnas()).join(', '));
  ok(!(await tabla()), 'sin la tabla diccionario_sporteasy');
  ok((await funciones()).length === 0, 'sin las funciones del interruptor ni ultima_importacion_respuestas', (await funciones()).join(', '));
  ok((await funcionesConSportEasy()).length === 0, 'ninguna función de public lee ni escribe nada de SportEasy ni mira el interruptor', (await funcionesConSportEasy()).join(', '));
  const [{ conf }] = await sql`select count(*)::int conf from public.respuestas_web_config where id = 1 and dudas_desde is not null`;
  ok(conf === 1, 'respuestas_web_config se queda (dudas_desde sigue en uso)');
  const checks = (await sql`select pg_get_constraintdef(oid) d from pg_constraint where conrelid in ('public.respuestas'::regclass, 'public.ausencias_periodo'::regclass) and contype = 'c'`).map((r) => r.d).join(' ');
  ok(/'sporteasy'/.test(checks), 'lo histórico sigue válido: origen/fuente = \'sporteasy\' en respuestas y ausencias');

  console.log('\n== Respuestas en la web siempre encendidas (aunque la fila vieja diga «apagado»)');
  await sql`update public.respuestas_web_config set encendido = false where id = 1`;
  await sinteticos(sql, [['sint-ana', 'Ana', true, true], ['sint-beto', 'Beto', true, true]]);
  const P = await personas(e.pila, { jugadores: [['sint-ana', 'ana@pruebas.local'], ['sint-beto', 'beto@pruebas.local']], gestores: [['Gestor', 'gestor@pruebas.local']] });
  const tA = P['sint-ana'].token, tB = P['sint-beto'].token, tG = P['gestor@pruebas.local'].token;
  const [ent] = await sql`select id, fecha::text from public.eventos where tipo = 'entreno' and estado = 'programado' and fecha > current_date + 2 order by fecha limit 1`;
  ok(!!ent, `un entreno futuro (${ent?.fecha})`);
  let r = await rpc('responder', { p_evento: ent.id, p_respuesta: 'va' }, tA);
  ok(r.status === 200, 'un jugador responde «voy» (antes: «respuestas_apagadas»)', JSON.stringify(r.datos));
  ok((await sql`select respuesta from public.respuestas where evento_id = ${ent.id} and person_id = 'sint-ana'`)[0]?.respuesta === 'va', '…y queda guardado');
  r = await rpc('responder_por', { p_evento: ent.id, p_person: 'sint-beto', p_respuesta: 'no', p_motivo: 'trabajo' }, tG);
  ok(r.status === 200, 'un gestor responde por otro', JSON.stringify(r.datos));
  const desde = ent.fecha;
  r = await rpc('guardar_ausencia', { p_id: null, p_desde: desde, p_hasta: desde, p_motivo: 'viaje', p_detalle: null }, tA);
  ok(r.status === 200, 'un jugador marca una ausencia', JSON.stringify(r.datos));
  r = await rpc('previsualizar_ausencia', { p_desde: desde, p_hasta: desde }, tB);
  ok(r.status === 200, 'y la previsualiza', JSON.stringify(r.datos));
  // Un evento nuevo en un día cubierto por una ausencia la recibe (el disparador ya no mira el interruptor).
  await sql`insert into public.ausencias_periodo (person_id, desde, hasta, motivo, origen) values ('sint-beto', ${desde}::date + 30, ${desde}::date + 30, 'lesion', 'jugador')`;
  const [nuevo] = await sql`insert into public.eventos (clave, temporada, tipo, equipo, titulo, fecha, origen) values ('prueba-fin-sporteasy', '2026-27', 'amistoso', 'ambos', 'Amistoso de prueba', ${desde}::date + 30, 'manual') returning id`;
  const [aus] = await sql`select respuesta, motivo from public.respuestas where evento_id = ${nuevo.id} and person_id = 'sint-beto'`;
  ok(aus?.respuesta === 'no' && aus.motivo === 'lesion', 'un evento nuevo recibe la ausencia que lo cubre', JSON.stringify(aus));
  const [col] = await sql`select count(*)::int n from information_schema.columns where table_name = 'eventos' and column_name like 'sporteasy%'`;
  ok(col.n === 0, 'y el evento nuevo no lleva nada de SportEasy');
  // Cambiar un evento ya no intenta marcarlo «pendiente de copiar» (sin la columna, el disparador viejo fallaría aquí).
  const [cambiado] = await sql`update public.eventos set titulo = 'Amistoso cambiado' where id = ${nuevo.id} returning titulo`;
  ok(cambiado?.titulo === 'Amistoso cambiado', 'cambiar un evento funciona (el disparador ya no toca SportEasy)');

  console.log('\n== cerrar_dudas cierra también los oficiales');
  const [ev] = await sql`select id from public.eventos where tipo = 'entreno' and estado = 'programado' and fecha > current_date + 1 order by fecha limit 1`;
  await sql`insert into public.respuestas (evento_id, person_id, respuesta, origen) values (${ev.id}, 'sint-beto', 'duda', 'jugador') on conflict (evento_id, person_id) do update set respuesta = 'duda', motivo = null`;
  await sql`update public.respuestas_web_config set dudas_desde = pruebas.ahora() - interval '400 days' where id = 1`;
  const [lim] = await sql`select public._limite_dudas(${ev.id}) l, public._inicio_evento(${ev.id}) i`;
  const cerradas = await sql`select * from public.cerrar_dudas(${new Date(new Date(lim.l).getTime() + 60_000)})`;
  ok(cerradas.some((c) => c.r_evento === ev.id && c.r_person === 'sint-beto') || new Date(lim.l) >= new Date(lim.i), 'la duda de un entreno oficial pasa a «no va» al llegar el límite', JSON.stringify(cerradas));

  console.log('\n== Planes y convocatorias, sin SportEasy');
  r = await rpc('crear_plan', { p: { tipo: 'pachanga', titulo: 'Pachanga de prueba', fecha: desde, inicio: '19:00', equipo: 'ambos' } }, tA);
  ok(r.status === 200, 'crear un plan funciona', JSON.stringify(r.datos));
  if (r.status === 200) {
    const h = await rpc('hacer_oficial', { p_id: r.datos }, tG);
    ok(h.status === 200, 'y «Hacer oficial» también', JSON.stringify(h.datos));
  }
  const domingo = (await sql`select fecha::text f from public.eventos where tipo = 'liga' and fecha > current_date order by fecha limit 1`)[0].f;
  r = await rpc('convocatoria_guardar', { p_fecha: domingo, p_jornada: 5, p_equipos: { MdA: [{ person_id: 'sint-ana' }], MdL: [] }, p_dificultad: {}, p_accion: 'propuesta' }, tG);
  ok(r.status === 200 && !('sporteasy' in (r.datos ?? {})), 'convocatoria_guardar sin «sporteasy» en lo que devuelve', JSON.stringify(r.datos));
  r = await rpc('convocatoria_aprobar', { p_fecha: domingo }, tG);
  ok(r.status === 200, 'convocatoria_aprobar', JSON.stringify(r.datos));
  r = await rpc('convocatoria_marcar', { p_fecha: domingo, p_que: 'whatsapp' }, tG);
  ok(r.status === 200 && Object.keys(r.datos ?? {}).sort().join() === 'aviso,whatsapp', 'convocatoria_marcar: solo WhatsApp y aviso', JSON.stringify(r.datos));
  r = await rpc('convocatoria_marcar', { p_fecha: domingo, p_que: 'sporteasy' }, tG);
  ok(r.status >= 400 && /salida_no_valida/.test(JSON.stringify(r.datos)), '«sporteasy» ya no es una salida válida', JSON.stringify(r.datos));

  console.log('\n== estado_activacion: solo los contadores, solo gestores');
  r = await rpc('estado_activacion', {}, tG);
  ok(r.status === 200 && Object.keys(r.datos).sort().join() === 'con_avisos,entrados,faltan_por_entrar,pidio_codigo,plantilla', 'gestor: plantilla, entrados, faltan, pidió código y con avisos (nada del interruptor)', JSON.stringify(Object.keys(r.datos ?? {})));
  r = await rpc('estado_activacion', {}, tA);
  ok(r.status >= 400, 'un jugador no la puede usar', String(r.status));
  r = await rpc('estado_activacion', {});
  ok(r.status >= 400, 'anónimo tampoco', String(r.status));
  for (const f of ['cambiar_interruptor', 'respuestas_web_encendido', 'ultima_importacion_respuestas']) {
    r = await rpc(f, f === 'cambiar_interruptor' ? { p_encender: true } : {}, tG);
    ok(r.status === 404, `${f}: ya no existe en la API`, String(r.status));
  }
  r = await api('/diccionario_sporteasy', { token: tG });
  ok(r.status === 404, 'diccionario_sporteasy: ya no existe en la API', String(r.status));

  console.log('\n== Reversión: vuelve la estructura; y se aplica de nuevo, limpia');
  await sql.begin((tx) => tx.unsafe(fs.readFileSync(path.join(MIGS, `${MIG}.revertir.sql`), 'utf8')));
  ok(!(await registrada()), 'revertida: sin su registro');
  ok((await columnas()).length === COLUMNAS.length && (await columnas()).join() === COLUMNAS.map(([t, c]) => `${t}.${c}`).sort().join(), 'vuelven las 8 columnas sporteasy_*', (await columnas()).join(', '));
  ok(await tabla(), 'vuelve diccionario_sporteasy…');
  const [rls] = await sql`select relrowsecurity r from pg_class where oid = 'public.diccionario_sporteasy'::regclass`;
  const pols = (await sql`select policyname from pg_policies where tablename = 'diccionario_sporteasy' order by 1`).map((x) => x.policyname).join();
  ok(rls.r && pols === 'gestores_cambian,gestores_insertan,gestores_leen', '…con RLS y sus tres políticas de gestores', pols);
  ok((await funciones()).length === BORRADAS.length, 'vuelven las funciones del interruptor y ultima_importacion_respuestas', (await funciones()).join(', '));
  const anon = (await sql`select proname from pg_proc where pronamespace = 'public'::regnamespace and proname in ${sql(BORRADAS)} and has_function_privilege('anon', oid, 'execute')`).map((x) => x.proname);
  ok(anon.length === 0, 'ninguna la puede ejecutar anon', anon.join(', '));
  await recargar();
  await sql`update public.respuestas_web_config set encendido = false where id = 1`;
  r = await rpc('responder', { p_evento: ent.id, p_respuesta: 'duda' }, tA);
  ok(r.status >= 400 && /respuestas_apagadas/.test(JSON.stringify(r.datos)), 'revertida, el interruptor vuelve a mandar (apagado: «respuestas_apagadas»)', JSON.stringify(r.datos));
  await sql`update public.respuestas_web_config set encendido = true where id = 1`;
  await migrar(sql, { log: () => {} });
  await recargar();
  ok(await registrada() && (await columnas()).length === 0 && !(await tabla()) && (await funciones()).length === 0, 'vuelta a aplicar: otra vez sin nada de SportEasy ni del interruptor');
  await sql`update public.respuestas_web_config set encendido = false where id = 1`;
  r = await rpc('responder', { p_evento: ent.id, p_respuesta: 'va' }, tA);
  ok(r.status === 200, 'y se responde aunque la fila vieja diga «apagado»', JSON.stringify(r.datos));
} catch (err) {
  console.log(`  FALLO excepción -> ${err.stack ?? err}`);
  sumar();
} finally {
  await e.parar();
}
console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK');
process.exit(fallos() ? 1 : 0);
