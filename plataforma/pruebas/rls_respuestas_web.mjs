#!/usr/bin/env node
// Paso 3 (D99): respuestas en la web, ausencias, interruptor y suscripciones de avisos, contra la pila LOCAL
// (Postgres + PostgREST reales con NUESTRAS migraciones):
//   - las dos migraciones nuevas son reversibles (su .revertir.sql las deshace y se pueden volver a aplicar);
//   - un jugador NO lee motivos ajenos, NO responde por otro, NO responde a un evento al que no esta invitado, NO
//     responde con el interruptor apagado y NO ve niveles ni posiciones en nada de lo que le llega;
//   - "no va" exige motivo; evento cancelado o empezado, cerrado;
//   - domingo: horas distintas, misma hora, una sola ficha, descanso, y "solo uno" = "no · horario" en el otro;
//   - ausencias: aplicadas a eventos existentes y a los creados despues, sin fecha de vuelta y "Ya puedo volver",
//     borrado que deja "sin responder", aviso de "tenias voy";
//   - cambio de dia que reinicia las respuestas; cambio de hora que las mantiene;
//   - alerta a los gestores despues del martes a las 10:00; "Responder por el" con quien la puso;
//   - interruptor: condiciones, registro; suscripciones: alta, baja y solo las propias.
//
//   npm run pruebas:respuestas-web

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { arrancar } from './pila.mjs';
import { migrar } from '../scripts/db.mjs';
import { cargarEventos } from '../scripts/cargar_eventos.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const MIGS = path.join(AQUI, '..', 'supabase', 'migrations');
const REPO = path.join(AQUI, '..', '..');
let fallos = 0;
const ok = (cond, que, detalle = '') => {
  if (cond) console.log(`  OK    ${que}`);
  else { fallos++; console.log(`  FALLO ${que}${detalle ? ` -> ${detalle}` : ''}`); }
};
const NUEVAS = ['respuestas_domingo', 'respuestas_web_config', 'respuestas_web_registro', 'jornadas_control', 'alertas_gestores', 'suscripciones_avisos', 'avisos_registro'];
const hoyMadrid = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
const sumar = (f, n) => { const d = new Date(`${f}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

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
  const rpc = (f, args, token) => api(`/rpc/${f}`, { metodo: 'POST', cuerpo: args, token });
  const tablaExiste = async (n) => (await sql`select to_regclass(${'public.' + n}) as r`)[0].r !== null;
  const error = (r) => (r.datos && (r.datos.message || r.datos.msg)) || '';

  console.log('\n== Reversibilidad de las dos migraciones nuevas');
  for (const f of ['20261008100000_respuestas_web', '20261008101000_avisos', '20261008102000_quien_responde']) ok(fs.existsSync(path.join(MIGS, `${f}.revertir.sql`)), `${f} tiene su revertir.sql`);
  for (const n of NUEVAS) ok(await tablaExiste(n), `existe public.${n}`);
  const colsAntes = async (t) => (await sql`select column_name from information_schema.columns where table_schema = 'public' and table_name = ${t} order by column_name`).map((c) => c.column_name).join(',');
  await sql.begin((tx) => tx.unsafe(fs.readFileSync(path.join(MIGS, '20261008102000_quien_responde.revertir.sql'), 'utf8')));
  await sql.begin((tx) => tx.unsafe(fs.readFileSync(path.join(MIGS, '20261008101000_avisos.revertir.sql'), 'utf8')));
  await sql.begin((tx) => tx.unsafe(fs.readFileSync(path.join(MIGS, '20261008100000_respuestas_web.revertir.sql'), 'utf8')));
  ok(!(await tablaExiste('suscripciones_avisos')) && !(await tablaExiste('respuestas_web_config')), 'revertir quita las tablas nuevas');
  ok(!(await colsAntes('respuestas')).includes('origen') && !(await colsAntes('eventos')).includes('sin_recordatorios'), 'revertir quita las columnas nuevas de respuestas y eventos');
  const [{ nn }] = await sql`select is_nullable nn from information_schema.columns where table_schema = 'public' and table_name = 'ausencias_periodo' and column_name = 'hasta'`;
  ok(nn === 'NO', 'revertir deja «hasta» obligatorio otra vez');
  await migrar(sql, { log: () => {} });
  for (const n of NUEVAS) ok(await tablaExiste(n), `tras volver a aplicar existe public.${n}`);
  // PostgREST guarda el esquema en caché: que lo vuelva a leer antes de seguir.
  await sql`notify pgrst, 'reload schema'`;
  for (let i = 0; i < 40 && (await rpc('respuestas_web_encendido', {})).status === 404; i++) await new Promise((ok) => setTimeout(ok, 250));
  await new Promise((ok) => setTimeout(ok, 500));

  console.log('\n== Carga de eventos y cuentas de prueba');
  const cal = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'calendario_2026-27.json'), 'utf8'));
  for (const c of cal.partidos) {
    await sql`insert into public.liga_calendario (temporada, equipo, jornada, fecha, hora, local, descansa, rival, campo) values ('2026-27', ${c.equipo}, ${c.jornada}, ${c.fecha}, ${c.hora}, ${c.local}, ${!!c.descansa}, ${c.rival}, ${c.campo})`;
  }
  const carga = await cargarEventos(sql, { log: () => {} });
  ok(carga.nuevos === 67, 'carga inicial: 67 eventos');
  const id = async (clave) => (await sql`select id from public.eventos where clave = ${clave}`)[0].id;
  const E = { mdaJ2: await id('mda-j2'), mdlJ2: await id('mdl-j2'), mdaJ3: await id('mda-j3'), mdlJ3: await id('mdl-j3'), mdlJ4: await id('mdl-j4'), e14: await id('entreno-semanal-2026-10-14'), e21: await id('entreno-semanal-2026-10-21') };
  const jugador = async (personId, email) => {
    await sql`update public.jugadores set email = ${email} where person_id = ${personId}`;
    const uid = await pila.crearUsuario(email, 'no-se-usa');
    return { uid, token: await pila.firmar({ sub: uid, role: 'authenticated', email }), personId };
  };
  const jon = await jugador('esteban-jon', 'jon@pruebas.local');            // MdA y MdL
  const guille = await jugador('galan-domingo-guillermo', 'guille@pruebas.local'); // solo MdA
  const edimil = await jugador('feliz-gomez-edimil', 'edimil@pruebas.local');      // solo entrena
  const gestorUid = await pila.crearUsuario('gestor@pruebas.local', 'no-se-usa');
  await sql`insert into public.gestores (user_id, nombre, email) values (${gestorUid}, 'Iván', 'gestor@pruebas.local')`;
  // Ivan es gestor y jugador (su ficha, villaescusa-silva-ivan, con el mismo correo): solo el maneja el interruptor (D103).
  await sql`update public.jugadores set email = 'gestor@pruebas.local' where person_id = 'villaescusa-silva-ivan'`;
  const carlosUid = await pila.crearUsuario('carlos-gestor@pruebas.local', 'no-se-usa');
  await sql`insert into public.gestores (user_id, nombre, email) values (${carlosUid}, 'Carlos', 'carlos-gestor@pruebas.local')`;
  const tC = await pila.firmar({ sub: carlosUid, role: 'authenticated', email: 'carlos-gestor@pruebas.local' });
  const tG = await pila.firmar({ sub: gestorUid, role: 'authenticated', email: 'gestor@pruebas.local' });
  const intrusoUid = await pila.crearUsuario('intruso@pruebas.local', 'no-se-usa');
  const tI = await pila.firmar({ sub: intrusoUid, role: 'authenticated', email: 'intruso@pruebas.local' });

  console.log('\n== Interruptor APAGADO: nadie responde en la web (también en la base, no solo en la pantalla)');
  let r = await rpc('responder', { p_evento: E.e14, p_respuesta: 'va' }, jon.token);
  ok(r.status >= 400 && /respuestas_apagadas/.test(error(r)), 'con el interruptor apagado un jugador NO responde', `${r.status} ${error(r)}`);
  r = await rpc('responder_domingo', { p_fecha: '2026-10-25', p_opcion: 'ambos' }, jon.token);
  ok(r.status >= 400 && /respuestas_apagadas/.test(error(r)), 'ni al domingo');
  r = await rpc('guardar_ausencia', { p_id: null, p_desde: '2026-11-01', p_hasta: '2026-11-10', p_motivo: 'viaje' }, jon.token);
  ok(r.status >= 400 && /respuestas_apagadas/.test(error(r)), 'ni marca ausencias');
  r = await rpc('alta_suscripcion', { p_endpoint: 'https://push.example/jon-1', p_p256dh: 'clave', p_auth: 'auth', p_navegador: 'Safari iPhone' }, jon.token);
  ok(r.status === 200, 'pero SÍ activa los avisos en su móvil (D99.12)', `${r.status} ${error(r)}`);
  ok((await rpc('respuestas_web_encendido', {}, jon.token)).datos === false, 'la web sabe que está apagado');
  // D105: en la fase puente las respuestas vienen solo de Importar; «Responder por él» tampoco vale (ni de un evento ni del domingo).
  r = await rpc('responder_por', { p_evento: E.e14, p_person: 'esteban-jon', p_respuesta: 'va' }, tG);
  ok(r.status >= 400 && /respuestas_apagadas/.test(error(r)), 'con el interruptor apagado ni un gestor usa «Responder por él» (evento)', `${r.status} ${error(r)}`);
  r = await rpc('responder_domingo_por', { p_fecha: '2026-10-25', p_person: 'esteban-jon', p_opcion: 'ambos' }, tG);
  ok(r.status >= 400 && /respuestas_apagadas/.test(error(r)), 'ni el de la vista de domingo', `${r.status} ${error(r)}`);
  ok((await sql`select count(*)::int n from public.respuestas where person_id = 'esteban-jon'`)[0].n === 0, 'y no ha quedado ninguna respuesta escrita');

  console.log('\n== Encender: condiciones 1, 2 y 4 (la 3 es informativa); solo gestores; queda registrado');
  ok((await rpc('cambiar_interruptor', { p_encender: true }, jon.token)).status >= 400, 'un jugador NO enciende el interruptor');
  ok((await api('/respuestas_web_config?id=eq.1', { metodo: 'PATCH', cuerpo: { encendido: true }, token: tG })).status >= 400 || !(await sql`select encendido from public.respuestas_web_config`)[0].encendido, 'ni el gestor lo enciende a mano por la API (solo con la función que comprueba)');
  r = await rpc('cambiar_interruptor', { p_encender: true }, tG);
  ok(r.status >= 400 && /condiciones_sin_cumplir/.test(error(r)), 'sin las condiciones no se enciende');
  let est = (await rpc('estado_activacion', {}, tG)).datos;
  ok(est.plantilla === 27 && est.entrados === 4 && est.minimo_entrados === 20 && est.con_avisos === 1 && est.jornadas_seguidas === 0 && est.puede_manejar === true, `estado: ${est.entrados}/${est.plantilla} han entrado (mínimo ${est.minimo_entrados}), ${est.con_avisos} con avisos, ${est.jornadas_seguidas}/3 jornadas`, JSON.stringify(est));
  ok(Array.isArray(est.faltan_por_entrar) && est.faltan_por_entrar.length === 23 && !est.faltan_por_entrar.includes('Jon') && est.faltan_por_entrar.includes('Adriano') && !est.faltan_por_entrar.some((n) => /entrenador/.test(n)), 'condición 2: la lista de quién falta por entrar (23 de los 27; Carlos, el entrenador, no cuenta)');

  console.log('\n== Solo Iván maneja el interruptor, las jornadas y SportEasy (D103); otro gestor, solo lectura');
  const estC = (await rpc('estado_activacion', {}, tC)).datos;
  ok(estC && estC.plantilla === 27 && estC.puede_manejar === false, 'otro gestor (Carlos) ve el estado, sin poder manejarlo');
  ok(/solo_responsable/.test(error(await rpc('marcar_jornada', { p_jornada: 1, p_estado: 'limpia' }, tC))), 'Carlos NO marca jornadas (lo para la base)');
  ok(/solo_responsable/.test(error(await rpc('marcar_sporteasy', { p_comprobado: true }, tC))), 'Carlos NO marca la casilla de SportEasy');
  ok(/solo_responsable/.test(error(await rpc('cambiar_interruptor', { p_encender: false }, tC))), 'Carlos NO enciende ni apaga');
  ok((await sql`select count(*)::int n from public.jornadas_control`)[0].n === 0, 'y no ha quedado nada escrito');
  for (const j of [1, 2, 3]) await rpc('marcar_jornada', { p_jornada: j, p_estado: 'limpia' }, tG);
  ok((await rpc('estado_activacion', {}, tG)).datos.jornadas_seguidas === 3, '3 jornadas limpias seguidas = 3/3');
  await rpc('marcar_jornada', { p_jornada: 4, p_estado: 'con_arreglo' }, tG);
  ok((await rpc('estado_activacion', {}, tG)).datos.jornadas_seguidas === 0, 'una «con arreglo» devuelve la cuenta a 0');
  for (const j of [5, 6, 7]) await rpc('marcar_jornada', { p_jornada: j, p_estado: 'limpia' }, tG);
  ok((await rpc('estado_activacion', {}, tG)).datos.jornadas_seguidas === 3, 'y vuelve a contar desde ahí (J5–J7 = 3/3)');
  ok((await rpc('marcar_jornada', { p_jornada: 8, p_estado: 'limpia' }, jon.token)).status >= 400, 'un jugador NO marca jornadas');
  await rpc('marcar_sporteasy', { p_comprobado: true }, tG);
  ok((await rpc('cambiar_interruptor', { p_encender: true }, tG)).status >= 400, 'con 1 y 4 pero solo 4 de 27 dentro de la web (condición 2, mínimo 20), no se enciende');
  // Para la prueba: entran 15 más (19 de 27: aún no basta) y luego 1 más (20 de 27: basta el mínimo, no hace falta que entren todos).
  const entran = async (n) => {
  for (const j of await sql`select person_id from public.jugadores where activo and rol <> 'entrenador' and (email is null or email not like '%@pruebas.local') order by person_id limit ${n}`) {
    const em = `${j.person_id}@pruebas.local`;
    await sql`update public.jugadores set email = ${em} where person_id = ${j.person_id}`;
    await pila.crearUsuario(em, 'x');
  }
  };
  await entran(15);
  est = (await rpc('estado_activacion', {}, tG)).datos;
  ok(est.entrados === 19 && est.se_puede_encender === false, '19 de 27: todavía no se cumple la condición 2 (mínimo 20)', JSON.stringify(est));
  await entran(1);
  est = (await rpc('estado_activacion', {}, tG)).datos;
  ok(est.entrados === 20 && est.plantilla === 27 && est.faltan_por_entrar.length === 7 && est.se_puede_encender === true, '20 de 27 han entrado: se cumple la condición 2 (faltan 7)', JSON.stringify(est));
  ok(/solo_responsable/.test(error(await rpc('cambiar_interruptor', { p_encender: true }, tC))), 'aun con las condiciones, Carlos no puede encender');  r = await rpc('cambiar_interruptor', { p_encender: true }, tG);
  ok(r.status === 200 && r.datos.encendido === true, 'con las tres condiciones, se enciende', `${r.status} ${error(r)}`);
  const reg = await sql`select que, por_nombre from public.respuestas_web_registro order by en`;
  ok(reg.some((x) => x.que === 'encender' && x.por_nombre === 'Iván') && reg.filter((x) => x.que.startsWith('jornada')).length === 7 && reg.some((x) => x.que === 'sporteasy_comprobado'), 'cada cambio queda registrado (quién y cuándo)');

  console.log('\n== Responder a un evento');
  r = await rpc('responder', { p_evento: E.e14, p_respuesta: 'no' }, jon.token);
  ok(r.status >= 400 && /falta_motivo/.test(error(r)), '«no va» sin motivo NO se guarda');
  r = await rpc('responder', { p_evento: E.e14, p_respuesta: 'no', p_motivo: 'aburrimiento' }, jon.token);
  ok(r.status >= 400, 'un motivo fuera de la lista no vale');
  r = await rpc('responder', { p_evento: E.e14, p_respuesta: 'no', p_motivo: 'horario' }, jon.token);
  ok(r.status >= 400, '«horario» es interno: el jugador no lo puede elegir');
  r = await rpc('responder', { p_evento: E.e14, p_respuesta: 'no', p_motivo: 'trabajo', p_detalle: 'Turno de tarde' }, jon.token);
  ok(r.status === 200 && r.datos.antes === 'sin_responder' && r.datos.despues === 'no', '«no va» con motivo se guarda', `${r.status} ${error(r)}`);
  const [fila] = await sql`select respuesta, motivo, detalle, origen, puesto_por, fuente, cambiado_en from public.respuestas where evento_id = ${E.e14} and person_id = 'esteban-jon'`;
  ok(fila.origen === 'jugador' && fila.puesto_por === jon.uid && fila.fuente === 'web' && fila.cambiado_en, 'guarda origen «jugador», quién y cuándo');
  r = await rpc('responder', { p_evento: E.e14, p_respuesta: 'va', p_motivo: 'trabajo' }, jon.token);
  const [fila2] = await sql`select respuesta, motivo, detalle from public.respuestas where evento_id = ${E.e14} and person_id = 'esteban-jon'`;
  ok(r.status === 200 && fila2.respuesta === 'va' && fila2.motivo === null && fila2.detalle === null, 'puede cambiarla cuando quiera (y al pasar a «va» se borra el motivo)');
  ok((await rpc('responder', { p_evento: E.e14, p_respuesta: 'quizas' }, jon.token)).status >= 400, 'una respuesta fuera de va | duda | no se rechaza');
  r = await rpc('responder', { p_evento: E.mdlJ3, p_respuesta: 'va' }, guille.token);
  ok(r.status >= 400 && /no_invitado/.test(error(r)), 'un jugador NO responde a un evento al que no está invitado (Guillermo, sin ficha MdL)');
  r = await rpc('responder', { p_evento: E.mdaJ3, p_respuesta: 'va' }, edimil.token);
  ok(r.status >= 400 && /no_invitado/.test(error(r)), 'quien solo entrena NO responde a partidos');
  ok((await rpc('responder', { p_evento: E.e14, p_respuesta: 'va' }, edimil.token)).status === 200, 'quien solo entrena SÍ responde al entreno');
  ok((await rpc('responder', { p_evento: E.e14, p_respuesta: 'va' }, tI)).status >= 400, 'una cuenta sin ficha NO responde');
  ok((await rpc('responder', { p_evento: E.e14, p_respuesta: 'va' })).status >= 400, 'anónimo NO responde');

  console.log('\n== Nadie escribe respuestas por otro ni directamente en las tablas');
  ok((await api('/respuestas', { metodo: 'POST', cuerpo: { evento_id: E.e14, person_id: 'gianatti-adriano', respuesta: 'no', motivo: 'viaje' }, token: jon.token })).status >= 400, 'un jugador NO escribe en la tabla de respuestas (ni la de otro)');
  ok((await api(`/respuestas?person_id=eq.esteban-jon`, { metodo: 'PATCH', cuerpo: { respuesta: 'duda' }, token: jon.token })).datos?.length !== 1, 'ni cambia la suya por la tabla');
  ok((await api(`/respuestas?person_id=eq.esteban-jon`, { metodo: 'DELETE', token: jon.token })).status >= 400 || (await sql`select count(*)::int n from public.respuestas where person_id = 'esteban-jon'`)[0].n > 0, 'ni la borra');
  // responder() no acepta person_id: no hay forma de pasar el de otro
  r = await api('/rpc/responder', { metodo: 'POST', cuerpo: { p_evento: E.e14, p_respuesta: 'va', person_id: 'gianatti-adriano' }, token: jon.token });
  ok(r.status >= 400 && (await sql`select count(*)::int n from public.respuestas where person_id = 'gianatti-adriano'`)[0].n === 0, 'pasar el person_id de otro no cuela (la función solo usa el de la sesión)');

  console.log('\n== Lo que lee el jugador: lo suyo, y de los demás solo nombre y estado');
  await sql`select public._escribir_respuesta(${E.e14}, 'gianatti-adriano', 'no', 'lesion', 'Rodilla', 'sporteasy', null, null, null)`;
  const suyas = await api('/respuestas?select=*', { token: jon.token });
  ok(suyas.status === 200 && suyas.datos.length >= 1 && suyas.datos.every((x) => x.person_id === 'esteban-jon'), 'lee SOLO sus respuestas');
  ok(!JSON.stringify(suyas.datos).includes('Rodilla') && !JSON.stringify(suyas.datos).includes('lesion'), 'NO lee motivos ni detalles ajenos');
  const qv = await api(`/v_quien_va?evento_id=eq.${E.e14}`, { token: jon.token });
  ok(qv.status === 200 && qv.datos.length > 20, `«quién va» del entreno: ${qv.datos?.length} nombres`, JSON.stringify(qv.datos));
  ok(qv.datos.every((x) => Object.keys(x).sort().join() === 'estado,evento_id,nombre'), 'la vista solo trae evento, nombre y estado', Object.keys(qv.datos[0] ?? {}).join());
  ok(qv.datos.some((x) => x.nombre === 'Adriano' && x.estado === 'no') && !JSON.stringify(qv.datos).includes('Rodilla'), 'Adriano sale «no» sin motivo');
  ok((await api(`/v_quien_va?evento_id=eq.${E.mdlJ3}`, { token: guille.token })).datos.length === 0, 'no ve «quién va» de eventos a los que no está invitado');
  ok((await api('/v_quien_va?select=*', { token: tI })).datos.length === 0 && (await api('/v_quien_va?select=*')).status >= 400, 'una cuenta sin ficha no ve nada y anónimo tampoco');
  const mis = await api('/v_mis_eventos?select=*&order=fecha', { token: guille.token });
  ok(mis.status === 200 && mis.datos.every((e) => e.equipo !== 'MdL' || e.tipo === 'entreno'), 'v_mis_eventos: solo sus eventos (Guillermo no ve partidos de MdL)');
  const colsMis = Object.keys(mis.datos[0]);
  ok(!colsMis.filter((c) => c !== 'pista_motivo').some((c) => /sporteasy|origen|serie|person|respuesta|motivo|detalle|nivel|posicion/.test(c)), `v_mis_eventos sin columnas privadas (${colsMis.length})`, colsMis.join());
  for (const ruta of ['/jugadores?select=*', '/eventos?select=*', '/respuestas_web_config?select=*', '/alertas_gestores?select=*', '/avisos_registro?select=*', '/jornadas_control?select=*']) {
    const x = await api(ruta, { token: jon.token });
    ok(x.status >= 400 || (Array.isArray(x.datos) && x.datos.length === 0), `un jugador NO lee ${ruta.split('?')[0]}`);
  }
  const todo = JSON.stringify([suyas.datos, qv.datos, mis.datos, (await api('/ausencias_periodo?select=*', { token: jon.token })).datos, (await api('/suscripciones_avisos?select=*', { token: jon.token })).datos]);
  ok(!/nivel|posici|\b[A-E]\b"|ficha_m|telefono|email/i.test(todo), 'nada de lo que llega al jugador lleva niveles, posiciones, fichas, teléfonos ni correos');
  ok((await api('/v_mis_eventos?select=*')).status >= 400, 'anónimo no lee v_mis_eventos');
  for (const f of ['_invitado', '_escribir_respuesta', '_mi_jugador', '_aplicar_ausencias_evento', '_tras_cambio_jugador', '_ausencia_que_cubre']) {
    const x = await rpc(f, {}, jon.token);
    ok(x.status >= 400, `un jugador NO llama a la función interna ${f}`);
  }

  console.log('\n== Evento cancelado o empezado: cerrado');
  await sql`update public.eventos set estado = 'cancelado' where id = ${E.e21}`;
  ok(/evento_cerrado/.test(error(await rpc('responder', { p_evento: E.e21, p_respuesta: 'va' }, jon.token))), 'evento cancelado: no se responde');
  await sql`update public.eventos set estado = 'programado' where id = ${E.e21}`;
  const pasado = await id('entreno-semanal-2026-10-07');
  ok(/evento_cerrado/.test(error(await rpc('responder', { p_evento: pasado, p_respuesta: 'va' }, jon.token))), 'evento que ya empezó: no se responde');
  // un entreno de hoy que empezó hace un minuto
  const ahoraMadrid = new Date(Date.now() - 60_000).toLocaleTimeString('sv-SE', { timeZone: 'Europe/Madrid' }).slice(0, 5);
  const [hoyEv] = await sql`insert into public.eventos (clave, tipo, equipo, titulo, fecha, inicio) values ('x-hoy', 'entreno', 'ambos', 'Hoy', ${hoyMadrid()}, ${ahoraMadrid}) returning id`;
  ok(/evento_cerrado/.test(error(await rpc('responder', { p_evento: hoyEv.id, p_respuesta: 'va' }, jon.token))), 'el mismo día, en cuanto empieza (hora de Madrid), se cierra');

  console.log('\n== Domingo: una sola respuesta (D99.3)');
  r = await rpc('responder_domingo', { p_fecha: '2026-10-25', p_opcion: 'voy' }, jon.token);
  ok(/opcion_no_valida/.test(error(r)), 'horas distintas (J3, 09:00 y 14:00): «Voy» a secas no vale');
  r = await rpc('responder_domingo', { p_fecha: '2026-10-25', p_opcion: 'ambos' }, jon.token);
  const j3 = async (p = 'esteban-jon') => Object.fromEntries((await sql`select e.equipo, r.respuesta, r.motivo from public.respuestas r join public.eventos e on e.id = r.evento_id where e.fecha = '2026-10-25' and e.tipo = 'liga' and r.person_id = ${p}`).map((x) => [x.equipo, `${x.respuesta}${x.motivo ? '·' + x.motivo : ''}`]));
  ok(r.status === 200 && JSON.stringify(await j3()) === JSON.stringify({ MdA: 'va', MdL: 'va' }) || ((await j3()).MdA === 'va' && (await j3()).MdL === 'va'), '«A los dos» = va en los dos', JSON.stringify(await j3()));
  r = await rpc('responder_domingo', { p_fecha: '2026-10-25', p_opcion: 'solo', p_evento: E.mdaJ3 }, jon.token);
  let x3 = await j3();
  ok(r.status === 200 && x3.MdA === 'va' && x3.MdL === 'no·horario', '«Solo al de las 09:00 (MdA)» = va en MdA y «no · horario» en MdL', JSON.stringify(x3));
  const dom = async (p = 'esteban-jon', f = '2026-10-25') => (await sql`select opcion, solo_evento, motivo, origen, vigente from public.respuestas_domingo where fecha = ${f} and person_id = ${p}`)[0];
  let d0 = await dom();
  ok(d0 && d0.opcion === 'solo' && d0.solo_evento === E.mdaJ3 && d0.vigente && d0.origen === 'jugador', 'se GUARDA la respuesta única del domingo: «solo», con el partido elegido (D103)', JSON.stringify(d0));
  ok((await api('/respuestas_domingo?select=*', { token: jon.token })).datos.length === 1 && (await api('/respuestas_domingo?select=*', { token: guille.token })).datos.length === 0, 'cada jugador lee solo su respuesta del domingo');
  ok((await api('/respuestas_domingo', { metodo: 'POST', cuerpo: { fecha: '2026-10-25', person_id: 'esteban-jon', opcion: 'voy', origen: 'jugador' }, token: jon.token })).status >= 400, 'nadie la escribe directamente en la tabla');
  r = await rpc('responder_domingo', { p_fecha: '2026-10-25', p_opcion: 'no' }, jon.token);
  ok(/falta_motivo/.test(error(r)), '«No voy» del domingo exige motivo');
  r = await rpc('responder_domingo', { p_fecha: '2026-10-25', p_opcion: 'no', p_motivo: 'familia' }, jon.token);
  x3 = await j3();
  ok(x3.MdA === 'no·familia' && x3.MdL === 'no·familia', '«No voy» con motivo en los dos');
  r = await rpc('responder_domingo', { p_fecha: '2026-10-25', p_opcion: 'duda' }, jon.token);
  x3 = await j3();
  ok(x3.MdA === 'duda' && x3.MdL === 'duda', '«Duda» en los dos');
  ok(/opcion_no_valida/.test(error(await rpc('responder_domingo', { p_fecha: '2026-10-25', p_opcion: 'solo', p_evento: E.e14 }, jon.token))), '«solo» con un evento que no es de ese domingo no vale');
  r = await rpc('responder_domingo', { p_fecha: '2026-10-18', p_opcion: 'ambos' }, jon.token);
  ok(/opcion_no_valida/.test(error(r)), 'misma hora (J2, 10:15 los dos): «A los dos» no existe');
  r = await rpc('responder_domingo', { p_fecha: '2026-10-18', p_opcion: 'voy' }, jon.token);
  const j2 = (await sql`select r.respuesta from public.respuestas r join public.eventos e on e.id = r.evento_id where e.fecha = '2026-10-18' and e.tipo = 'liga' and r.person_id = 'esteban-jon'`).map((x) => x.respuesta);
  ok(r.status === 200 && j2.length === 2 && j2.every((x) => x === 'va'), 'misma hora: «Voy» = disponible para cualquiera de los dos (va en los dos)');
  r = await rpc('responder_domingo', { p_fecha: '2026-10-25', p_opcion: 'voy' }, guille.token);
  ok(r.status === 200 && JSON.stringify(await j3('galan-domingo-guillermo')) === JSON.stringify({ MdA: 'va' }), 'una sola ficha: responde solo su partido (Guillermo, MdA)');
  r = await rpc('responder_domingo', { p_fecha: '2026-11-08', p_opcion: 'voy' }, guille.token);
  ok(/no_invitado/.test(error(r)), 'su equipo descansa (08/11, MdA): no hay nada que responder');
  ok((await dom('esteban-jon', '2026-10-18'))?.opcion === 'voy' && (await dom()).opcion === 'duda', 'la respuesta del domingo sigue a la última (J2 «voy», J3 «duda»)');
  // Si un partido cambia por otro camino (Importar, «Responder por él» de un partido, una ausencia...), la del domingo deja de valer.
  await sql`select public._escribir_respuesta(${E.mdlJ3}, 'esteban-jon', 'va', null, null, 'sporteasy', null, null, null)`;
  d0 = await dom();
  ok(d0.vigente === false, 'si un partido cambia por otro camino (p. ej. Importar de SportEasy), la respuesta del domingo deja de valer y manda lo de cada partido');
  await rpc('responder_domingo', { p_fecha: '2026-10-25', p_opcion: 'duda' }, jon.token);
  ok((await dom()).vigente === true, 'y vuelve a valer en cuanto el jugador responde al domingo otra vez');
  const asis = await sql`select e.equipo, r.respuesta from public.respuestas r join public.eventos e on e.id = r.evento_id where e.fecha = '2026-10-25' and e.tipo = 'liga' and r.person_id = 'esteban-jon' order by e.equipo`;
  ok(asis.length === 2 && asis.every((x) => x.respuesta === 'duda'), 'Importar, Asistencia y la convocatoria siguen leyendo una respuesta por partido (derivada)');

  console.log('\n== Periodos de no disponibilidad');
  await rpc('responder', { p_evento: E.e21, p_respuesta: 'va' }, jon.token);
  r = await rpc('previsualizar_ausencia', { p_desde: '2026-10-20', p_hasta: '2026-11-02' }, jon.token);
  const prev = r.datos ?? [];
  ok(r.status === 200 && prev.length >= 3 && prev.some((e) => e.id === E.e21 && e.respuesta === 'va'), `resumen antes de guardar: ${prev.length} eventos, con el «voy» del 21/10 señalado`, JSON.stringify(prev).slice(0, 200));
  ok(!(await sql`select count(*)::int n from public.ausencias_periodo`)[0].n, 'el resumen no escribe nada');
  ok(/fechas_no_validas/.test(error(await rpc('guardar_ausencia', { p_id: null, p_desde: '2026-11-02', p_hasta: '2026-10-20', p_motivo: 'viaje' }, jon.token))), 'una ausencia con el último día antes del primero no vale');
  ok(/falta_motivo/.test(error(await rpc('guardar_ausencia', { p_id: null, p_desde: '2026-10-20', p_hasta: '2026-11-02', p_motivo: null }, jon.token))), 'una ausencia sin motivo no vale');
  r = await rpc('guardar_ausencia', { p_id: null, p_desde: '2026-10-20', p_hasta: '2026-11-02', p_motivo: 'viaje', p_detalle: 'Londres' }, jon.token);
  const ausId = r.datos?.id;
  ok(r.status === 200 && r.datos.eventos === prev.length, `guardada: pone «no voy» en ${r.datos?.eventos} eventos`);
  const enPeriodo = await sql`select e.clave, r.respuesta, r.motivo, r.ausencia_id from public.respuestas r join public.eventos e on e.id = r.evento_id where r.person_id = 'esteban-jon' and e.fecha between '2026-10-20' and '2026-11-02'`;
  ok(enPeriodo.length === prev.length && enPeriodo.every((x) => x.respuesta === 'no' && x.motivo === 'viaje' && x.ausencia_id === ausId), 'todos «no · viaje», el «voy» del 21/10 incluido, ligados a la ausencia');
  const [nuevo] = await sql`insert into public.eventos (clave, tipo, equipo, titulo, fecha, inicio) values ('x-amistoso', 'amistoso', 'ambos', 'Amistoso', '2026-10-31', '11:00') returning id`;
  const [enNuevo] = await sql`select respuesta, motivo from public.respuestas where evento_id = ${nuevo.id} and person_id = 'esteban-jon'`;
  ok(enNuevo?.respuesta === 'no' && enNuevo.motivo === 'viaje', 'un evento creado DESPUÉS dentro del periodo también queda «no · viaje»');
  const [enNuevoOtro] = await sql`select respuesta from public.respuestas where evento_id = ${nuevo.id} and person_id = 'gianatti-adriano'`;
  ok(!enNuevoOtro, 'y a quien no tiene ausencia no se le pone nada');
  ok((await api('/ausencias_periodo?select=*', { token: guille.token })).datos.length === 0, 'otro jugador NO ve la ausencia de Jon');
  ok((await api('/ausencias_periodo?select=*', { token: jon.token })).datos.length === 1, 'Jon ve la suya');
  ok(/ausencia_no_encontrada/.test(error(await rpc('borrar_ausencia', { p_id: ausId }, guille.token))), 'otro jugador NO borra la ausencia de Jon');
  r = await rpc('borrar_ausencia', { p_id: ausId }, jon.token);
  const trasBorrar = await sql`select r.respuesta from public.respuestas r join public.eventos e on e.id = r.evento_id where r.person_id = 'esteban-jon' and e.fecha between '2026-10-20' and '2026-11-02'`;
  ok(r.status === 200 && trasBorrar.every((x) => x.respuesta === 'sin_responder'), 'al borrarla, esos eventos vuelven a «sin responder»');
  ok((await sql`select borrada_en from public.ausencias_periodo where id = ${ausId}`)[0].borrada_en, 'la ausencia no se borra de la tabla: queda marcada como borrada');
  ok((await api('/ausencias_periodo?select=*', { token: jon.token })).datos.every((a) => a.borrada_en), 'y el jugador la ve como borrada (la web no la enseña)');
  // sin fecha de vuelta + Ya puedo volver
  r = await rpc('guardar_ausencia', { p_id: null, p_desde: hoyMadrid(), p_hasta: null, p_motivo: 'lesion' }, jon.token);
  const lesion = r.datos?.id;
  const futuros = await sql`select count(*)::int n from public.respuestas r join public.eventos e on e.id = r.evento_id where r.person_id = 'esteban-jon' and r.ausencia_id = ${lesion}`;
  ok(r.status === 200 && futuros[0].n > 30, `«sin fecha de vuelta» (lesión): «no» en todos los eventos futuros (${futuros[0].n})`);
  r = await rpc('cerrar_ausencia', { p_id: lesion }, jon.token);
  ok(r.status === 200 && (await sql`select count(*)::int n from public.respuestas where person_id = 'esteban-jon' and ausencia_id = ${lesion}`)[0].n === 0, '«Ya puedo volver»: los eventos desde hoy vuelven a «sin responder»');
  const ayer = sumar(hoyMadrid(), -1);
  r = await rpc('guardar_ausencia', { p_id: null, p_desde: ayer, p_hasta: null, p_motivo: 'lesion' }, jon.token);
  await rpc('cerrar_ausencia', { p_id: r.datos.id }, jon.token);
  const [cerrada] = await sql`select hasta::text, borrada_en from public.ausencias_periodo where id = ${r.datos.id}`;
  ok(cerrada.hasta === ayer && !cerrada.borrada_en, `si empezó antes de hoy, el periodo se cierra con el último día = ayer (${cerrada.hasta})`);
  // Gestor: crear la misma ausencia otra vez (franja reutilizada) y editarla
  r = await rpc('guardar_ausencia', { p_id: null, p_desde: '2026-10-20', p_hasta: '2026-11-02', p_motivo: 'viaje' }, jon.token);
  ok(r.status === 200 && r.datos.id === ausId, 'volver a marcar la misma franja reutiliza la ausencia borrada');
  r = await rpc('guardar_ausencia', { p_id: ausId, p_desde: '2026-10-20', p_hasta: '2026-10-22', p_motivo: 'trabajo' }, jon.token);
  const tras = Object.fromEntries((await sql`select e.clave, r.respuesta, r.motivo from public.respuestas r join public.eventos e on e.id = r.evento_id where r.person_id = 'esteban-jon' and e.clave in ('entreno-semanal-2026-10-21', 'mda-j3')`).map((x) => [x.clave, `${x.respuesta}${x.motivo ? '·' + x.motivo : ''}`]));
  ok(tras['entreno-semanal-2026-10-21'] === 'no·trabajo' && tras['mda-j3'] === 'sin_responder', 'al acortarla, lo que queda fuera vuelve a «sin responder» y lo de dentro cambia de motivo', JSON.stringify(tras));
  await rpc('borrar_ausencia', { p_id: ausId }, jon.token);

  console.log('\n== Cambios del evento: el día reinicia las respuestas; la hora no');
  await rpc('responder', { p_evento: E.e21, p_respuesta: 'va' }, jon.token);
  await rpc('responder', { p_evento: E.e21, p_respuesta: 'duda' }, guille.token);
  await sql`update public.eventos set inicio = '20:00', fin = '22:00' where id = ${E.e21}`;
  ok((await sql`select count(*)::int n from public.respuestas where evento_id = ${E.e21} and respuesta <> 'sin_responder'`)[0].n === 2, 'cambiar la hora (o la pista) mantiene las respuestas');
  await sql`insert into public.ausencias_periodo (person_id, desde, hasta, motivo, fuente, origen) values ('gianatti-adriano', '2026-10-22', '2026-10-23', 'viaje', 'web', 'gestor')`;
  await sql`update public.eventos set fecha = '2026-10-22' where id = ${E.e21}`;
  const tr = Object.fromEntries((await sql`select person_id, respuesta, motivo from public.respuestas where evento_id = ${E.e21}`).map((x) => [x.person_id, `${x.respuesta}${x.motivo ? '·' + x.motivo : ''}`]));
  ok(tr['esteban-jon'] === 'sin_responder' && tr['galan-domingo-guillermo'] === 'sin_responder', 'cambiar el DÍA deja todas las respuestas en «sin responder»', JSON.stringify(tr));
  ok(tr['gianatti-adriano'] === 'no·viaje', 'y se vuelven a aplicar las ausencias del nuevo día');
  await sql`update public.eventos set fecha = '2026-10-21' where id = ${E.e21}`;

  console.log('\n== Alerta a los gestores: cambios de un partido después del martes a las 10:00');
  // Un partido de liga en los próximos días cuyo martes 10:00 ya pasó, y otro de la semana que viene (aún no).
  const hoy = hoyMadrid();
  const dow = (f) => (new Date(`${f}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = lunes
  const madridAhora = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' });
  let tarde = null;
  for (let i = 1; i <= 6 && !tarde; i++) {
    const f = sumar(hoy, i);
    const martes = sumar(f, -dow(f) + 1);
    if (`${martes} 10:00` < madridAhora) tarde = f;
  }
  const temprano = sumar(hoy, 7 - dow(hoy) + 6); // domingo de la semana que viene
  const [pt] = tarde ? await sql`insert into public.eventos (clave, tipo, equipo, rival, fecha, inicio) values ('x-tarde', 'liga', 'MdA', 'Rival', ${tarde}, '23:30') returning id` : [null];
  const [pe] = await sql`insert into public.eventos (clave, tipo, equipo, rival, fecha, inicio) values ('x-temprano', 'liga', 'MdA', 'Rival', ${temprano}, '10:00') returning id`;
  await rpc('responder', { p_evento: pe.id, p_respuesta: 'va' }, jon.token);
  ok((await sql`select count(*)::int n from public.alertas_gestores where evento_id = ${pe.id}`)[0].n === 0, 'antes del martes a las 10:00 de su semana, no hay alerta');
  if (pt) {
    r = await rpc('responder', { p_evento: pt.id, p_respuesta: 'va' }, jon.token);
    await rpc('responder', { p_evento: pt.id, p_respuesta: 'no', p_motivo: 'trabajo' }, jon.token);
    const al = await sql`select antes, despues, aviso_encolado from public.alertas_gestores where evento_id = ${pt.id} order by en`;
    ok(r.datos.alerta === true && al.length === 2 && al[1].antes === 'va' && al[1].despues === 'no' && !al[0].aviso_encolado, `después del martes a las 10:00 (${tarde}), cada cambio deja alerta para los gestores`);
    await rpc('responder', { p_evento: pt.id, p_respuesta: 'no', p_motivo: 'familia' }, jon.token);
    ok((await sql`select count(*)::int n from public.alertas_gestores where evento_id = ${pt.id}`)[0].n === 2, 'cambiar solo el motivo no es un cambio de respuesta: sin alerta nueva');
    ok((await api('/alertas_gestores?select=*', { token: jon.token })).datos?.length === 0 && (await api('/alertas_gestores?select=*', { token: tG })).datos.length >= 2, 'las alertas solo las ven los gestores');
    ok((await api(`/alertas_gestores?evento_id=eq.${pt.id}`, { metodo: 'PATCH', cuerpo: { visto_en: new Date().toISOString(), visto_por_nombre: 'Iván' }, token: tG })).datos.length === 2, '«Visto» la quita (la marca el gestor)');
  } else ok(true, '(hoy es lunes o martes antes de las 10:00: no hay partido «tarde» que probar en la base; lo cubre pruebas:avisos-logica)');
  ok((await sql`select count(*)::int n from public.alertas_gestores where evento_id = ${E.e14}`)[0].n === 0, 'los entrenos no generan alerta');

  console.log('\n== Quién responde (D105): los activos menos el entrenador; «solo entreno» solo a los entrenos');
  const inv = async (person, ev) => (await sql`select public._invitado(${person}, ${ev}) as v`)[0].v;
  const CARLOS_E = 'barreiro-carballal-carlos-jose', FERNANDO_M = 'mendez-escandon-fernando';
  const cuantos = async (ev) => (await sql`select count(*)::int n from public.jugadores j where public._invitado(j.person_id, ${ev})`)[0].n;
  ok((await sql`select count(*)::int n from public.jugadores where activo`)[0].n === 28, 'la plantilla activa son 28 personas');
  ok(await cuantos(E.e14) === 27, 'a un entreno responden 27 (las 28 menos Carlos, el entrenador)', String(await cuantos(E.e14)));
  ok(!(await inv(CARLOS_E, E.e14)) && !(await inv(CARLOS_E, E.mdaJ3)) && !(await inv(CARLOS_E, E.mdlJ3)), 'Carlos (entrenador) no está invitado a nada: ni entrenos ni partidos');
  ok(await inv('feliz-gomez-edimil', E.e14), 'quien es «solo entreno» (Edimil) sí está invitado a los entrenos');
  ok(!(await inv('feliz-gomez-edimil', E.mdaJ3)) && !(await inv('feliz-gomez-edimil', E.mdlJ3)), 'pero a ningún partido');
  ok(await inv(FERNANDO_M, E.e14) && !(await inv(FERNANDO_M, E.mdaJ3)) && !(await inv(FERNANDO_M, E.mdlJ3)), 'aunque «solo entreno» tenga ficha (Fernando M.), nunca se le invita a un partido');
  ok(await inv('esteban-jon', E.mdaJ3) && await inv('esteban-jon', E.mdlJ3) && await inv('galan-domingo-guillermo', E.mdaJ3) && !(await inv('galan-domingo-guillermo', E.mdlJ3)), 'los demás, a los partidos de su ficha');
  ok(await cuantos(E.mdaJ3) === 23 && await cuantos(E.mdlJ3) === 21, 'a un partido de MdA responden 23 y a uno de MdL 21 (sin «solo entreno»)', `${await cuantos(E.mdaJ3)} y ${await cuantos(E.mdlJ3)}`);
  await sql`update public.jugadores set activo = false where person_id = 'vallesi-daniele'`;
  ok(!(await inv('vallesi-daniele', E.e14)), 'quien está de baja no está invitado');
  await sql`update public.jugadores set activo = true where person_id = 'vallesi-daniele'`;
  // Con el interruptor encendido, las funciones de responder rechazan a quien no está invitado.
  ok((await rpc('responder', { p_evento: E.e14, p_respuesta: 'va' }, edimil.token)).status === 200, 'Edimil responde a un entreno');
  r = await rpc('responder', { p_evento: E.mdaJ3, p_respuesta: 'va' }, edimil.token);
  ok(r.status >= 400 && /no_invitado/.test(error(r)), '«solo entreno» no responde a un partido (lo para la base)', `${r.status} ${error(r)}`);
  r = await rpc('responder_domingo', { p_fecha: '2026-10-25', p_opcion: 'voy' }, edimil.token);
  ok(r.status >= 400 && /no_invitado/.test(error(r)), 'ni al domingo', `${r.status} ${error(r)}`);
  r = await rpc('responder_por', { p_evento: E.e14, p_person: CARLOS_E, p_respuesta: 'va' }, tG);
  ok(r.status >= 400 && /no_invitado/.test(error(r)), 'ni un gestor responde por Carlos (entrenador): no responde a nada', `${r.status} ${error(r)}`);
  r = await rpc('responder_por', { p_evento: E.mdaJ3, p_person: FERNANDO_M, p_respuesta: 'va' }, tG);
  ok(r.status >= 400 && /no_invitado/.test(error(r)), 'ni por un «solo entreno» a un partido', `${r.status} ${error(r)}`);
  r = await rpc('responder_por', { p_evento: E.e14, p_person: 'esteban-jon', p_respuesta: 'va' }, tG);
  ok(r.status === 200, 'con el interruptor encendido, «Responder por él» sí funciona', `${r.status} ${error(r)}`);
  await sql`delete from public.respuestas where person_id in ('esteban-jon', 'feliz-gomez-edimil') and evento_id = ${E.e14}`;

  console.log('\n== «Responder por él» (gestores)');
  ok((await rpc('responder_por', { p_evento: E.e14, p_person: 'gianatti-adriano', p_respuesta: 'va' }, jon.token)).status >= 400, 'un jugador NO responde por otro ni con esta función');
  r = await rpc('responder_por', { p_evento: E.e14, p_person: 'vallesi-daniele', p_respuesta: 'no' }, tG);
  ok(/falta_motivo/.test(error(r)), 'el gestor también necesita motivo para «no va»');
  r = await rpc('responder_por', { p_evento: E.e14, p_person: 'vallesi-daniele', p_respuesta: 'va' }, tG);
  const [pp] = await sql`select origen, puesto_por, puesto_por_nombre from public.respuestas where evento_id = ${E.e14} and person_id = 'vallesi-daniele'`;
  ok(r.status === 200 && pp.origen === 'gestor' && pp.puesto_por === gestorUid && pp.puesto_por_nombre === 'Iván', 'queda guardado que la puso un gestor y quién («puesto por Iván»)');
  ok(/no_invitado/.test(error(await rpc('responder_por', { p_evento: E.mdlJ3, p_person: 'galan-domingo-guillermo', p_respuesta: 'va' }, tG))), 'ni el gestor responde por alguien a un evento al que no está invitado');
  r = await rpc('responder_domingo_por', { p_fecha: '2026-10-25', p_person: 'vallesi-daniele', p_opcion: 'solo', p_evento: E.mdlJ3 }, tG);
  const dd = await j3('vallesi-daniele');
  ok(r.status === 200 && dd.MdL === 'va' && dd.MdA === 'no·horario', 'en la vista de domingo, el gestor pone «solo al de las 14:00» (y el otro queda «no · horario»)', `${r.status} ${error(r)} ${JSON.stringify(dd)}`);
  ok((await sql`select count(*)::int n from public.respuestas r join public.eventos e on e.id = r.evento_id where e.fecha = '2026-10-25' and r.person_id = 'vallesi-daniele' and r.origen = 'gestor' and r.puesto_por_nombre = 'Iván'`)[0].n === 2, 'con origen «gestor» y su nombre en los dos partidos');
  ok((await rpc('responder_domingo_por', { p_fecha: '2026-10-25', p_person: 'esteban-jon', p_opcion: 'ambos' }, jon.token)).status >= 400, 'un jugador no usa la función del gestor');

  console.log('\n== Suscripciones de avisos');
  ok((await api('/suscripciones_avisos?select=*', { token: jon.token })).datos.length === 1, 'Jon ve su suscripción');
  ok((await api('/suscripciones_avisos?select=*', { token: guille.token })).datos.length === 0, 'Guillermo NO ve la de Jon');
  ok((await api('/suscripciones_avisos?select=*', { token: tG })).datos.length === 1, 'los gestores la ven (para «Avisos: Sí/No»)');
  ok((await api('/suscripciones_avisos', { metodo: 'POST', cuerpo: { user_id: jon.uid, endpoint: 'https://x', p256dh: 'a', auth: 'b' }, token: jon.token })).status >= 400, 'nadie escribe en la tabla directamente');
  ok((await rpc('alta_suscripcion', { p_endpoint: 'http://inseguro', p_p256dh: 'a', p_auth: 'b' }, jon.token)).status >= 400, 'un endpoint que no es https se rechaza');
  await rpc('alta_suscripcion', { p_endpoint: 'https://push.example/jon-2', p_p256dh: 'c2', p_auth: 'a2', p_navegador: 'Chrome Android' }, jon.token);
  ok((await sql`select count(*)::int n from public.suscripciones_avisos where person_id = 'esteban-jon' and activa`)[0].n === 2, 'varias por jugador: una por móvil');
  ok((await rpc('baja_suscripcion', { p_endpoint: 'https://push.example/jon-2' }, guille.token)).datos === false, 'otro no da de baja el móvil de Jon');
  ok((await rpc('baja_suscripcion', { p_endpoint: 'https://push.example/jon-2' }, jon.token)).datos === true, 'Jon da de baja su móvil');
  ok((await sql`select activa from public.suscripciones_avisos where endpoint = 'https://push.example/jon-2'`)[0].activa === false, 'queda inactiva (no se borra)');
  ok((await rpc('alta_suscripcion', { p_endpoint: 'https://push.example/jon-1', p_p256dh: 'k', p_auth: 'a' }, guille.token)).status === 200 && (await sql`select person_id from public.suscripciones_avisos where endpoint = 'https://push.example/jon-1'`)[0].person_id === 'galan-domingo-guillermo', 'si otra persona entra en ese móvil, la suscripción pasa a ser suya');
  ok((await rpc('alta_suscripcion', { p_endpoint: 'https://push.example/anon', p_p256dh: 'k', p_auth: 'a' })).status >= 400, 'anónimo no se suscribe');

  console.log('\n== Permisos de las tablas nuevas');
  for (const t of NUEVAS) {
    const [p] = await sql`select has_table_privilege('anon', ${'public.' + t}, 'select') a_sel, has_table_privilege('authenticated', ${'public.' + t}, 'delete') u_del,
                                 (select relrowsecurity from pg_class where oid = ${'public.' + t}::regclass) rls`;
    ok(!p.a_sel && !p.u_del && p.rls, `${t}: RLS activa, anon sin permisos, nadie borra`);
  }
  for (const t of ['respuestas', 'ausencias_periodo']) ok(!(await sql`select has_table_privilege('authenticated', ${'public.' + t}, 'delete') d`)[0].d, `${t}: nadie borra por la API`);
  const fns = await sql`select p.proname, has_function_privilege('anon', p.oid, 'execute') anon from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any(${['responder', 'responder_domingo', 'guardar_ausencia', 'cerrar_ausencia', 'borrar_ausencia', 'alta_suscripcion', 'baja_suscripcion', 'previsualizar_ausencia', 'responder_por', 'responder_domingo_por', 'cambiar_interruptor', 'estado_activacion', 'marcar_jornada', 'marcar_sporteasy']})`;
  ok(fns.length === 14 && fns.every((f) => !f.anon), 'anónimo no ejecuta ninguna de las funciones nuevas');

  console.log('\n== Apagar: se vuelve a la fase puente sin perder nada');
  await rpc('responder', { p_evento: E.e21, p_respuesta: 'va' }, jon.token);
  const antesN = (await sql`select count(*)::int n from public.respuestas`)[0].n;
  r = await rpc('cambiar_interruptor', { p_encender: false }, tG);
  ok(r.status === 200 && r.datos.encendido === false && (await sql`select count(*)::int n from public.respuestas`)[0].n === antesN, 'apagado: las respuestas siguen ahí');
  ok(/respuestas_apagadas/.test(error(await rpc('responder', { p_evento: E.e14, p_respuesta: 'va' }, jon.token))), 'y la web vuelve a no aceptar respuestas');
  await sql`update public.eventos set fecha = '2026-10-29' where id = ${E.e21}`;
  ok((await sql`select count(*)::int n from public.respuestas where evento_id = ${E.e21} and respuesta <> 'sin_responder'`)[0].n > 0, 'con el interruptor apagado, cambiar el día no toca las respuestas (vienen de SportEasy)');
} finally {
  await pila.parar();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
