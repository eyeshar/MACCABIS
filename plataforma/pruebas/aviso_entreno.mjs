#!/usr/bin/env node
// Aviso a gestores por los cambios al ENTRENO tras su cierre (D181, migración 20261104140000), en la pila local:
//   - entreno oficial: desde su límite (miércoles 12:00), cualquier cambio de un jugador (baja y alta tardía) deja alerta;
//     antes del límite, nada; el mismo estado con otro motivo, nada; el cierre automático de dudas (sistema), nada;
//     un entreno no oficial, nada; una ausencia que lo pasa a «no», sí;
//   - el push: «Carlos: de «va» a «no va»» + «Entreno de hoy, 20:30», sin motivos, una vez por gestor, y la tarea lo manda;
//   - la regla de los partidos de liga no cambia (la cubre pruebas:rutina-c);
//   - la migración se revierte limpia (D111) y se vuelve a aplicar.
//
//   npm run pruebas:aviso-entreno
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import webpush from 'web-push';
import { preparar, sinteticos, personas, contador, RAIZ } from './comun_e2e.mjs';
import { firmar } from './pila.mjs';
import { migrar } from './infra/migrar.mjs';
import * as T from '../src/lib/avisos/textos.ts';
import { ahoraPrueba } from './infra/reloj.mjs';

const { ok, fallos } = contador();
const vapid = webpush.generateVAPIDKeys();
const secreto = crypto.randomBytes(32).toString('hex');
const servicio = await firmar({ role: 'service_role', iss: 'supabase-local' }, 3600 * 24);
const e = await preparar({
  envExtra: {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey, VAPID_SUBJECT: 'mailto:pruebas@maccabis.invalid',
    SUPABASE_SERVICE_ROLE_KEY: servicio, AVISOS_SECRETO: secreto, NODE_TLS_REJECT_UNAUTHORIZED: '0',
  },
});
const { sql, APP, pila } = e;
const madridDe = (ms) => { const f = new Date(ahoraPrueba().getTime() + ms).toLocaleString('sv-SE', { timeZone: 'Europe/Madrid' }); return { fecha: f.slice(0, 10), hora: f.slice(11, 16) }; };
const rpc = async (f, args, token) => {
  const r = await fetch(`${pila.url}/rest/v1/rpc/${f}`, { method: 'POST', headers: { apikey: pila.anonKey, authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(args) });
  let datos = null; try { datos = await r.json(); } catch {}
  return { status: r.status, datos };
};

try {
  console.log('\n== Textos del push (puros)');
  const ent = { id: 'x', tipo: 'entreno', equipo: 'ambos', fecha: '2026-11-04', inicio: '20:30:00', fin: null, quedada: null, titulo: null, sitio: 'pista 3' };
  const tx = T.textoGestores('Carlos', ent, 'va', 'no', '2026-11-04');
  ok(tx.titulo === 'Carlos: de «va» a «no va»' && tx.cuerpo.startsWith('Entreno de hoy, 20:30'), '«Carlos: de «va» a «no va»» · «Entreno de hoy, 20:30»', JSON.stringify(tx));
  ok(T.textoGestores('Carlos', ent, 'no', 'va', '2026-11-03').cuerpo.startsWith('Entreno de mañana, 20:30'), 'el día antes: «Entreno de mañana»');
  ok(T.textoGestores('Carlos', ent, 'sin_responder', 'va', '2026-11-01').cuerpo.startsWith('Entreno del miércoles 4, 20:30'), 'y más lejos: «Entreno del miércoles 4»');
  ok(T.textoGestores('Carlos', ent, 'no', 'va', '2026-11-04').titulo === 'Carlos: de «no va» a «va»', 'alta tardía: «no va» a «va»');
  ok(!/lesi[oó]n|trabajo|viaje|familia|motivo|horario/i.test(`${tx.titulo} ${tx.cuerpo}`), 'sin motivos');
  const liga = T.textoGestores('Jon', { ...ent, tipo: 'liga', equipo: 'MdA', fecha: '2026-10-25' }, 'va', 'no');
  ok(liga.titulo === 'Jon cambia el partido del domingo 25 (MdA)', 'los partidos siguen con su texto');

  console.log('\n== La base: quién deja alerta');
  await sinteticos(sql, [['sint-uno', 'Uno', true, true], ['sint-dos', 'Dos', true, true], ['sint-tres', 'Tres', true, true]]);
  const P = await personas(pila, {
    jugadores: [['sint-uno', 'uno@pruebas.local'], ['sint-dos', 'dos@pruebas.local'], ['sint-tres', 'tres@pruebas.local']],
    gestores: [['Iván', 'gestor@pruebas.local', 'villaescusa-silva-ivan']],
  });
  const uno = P['sint-uno'].token, dos = P['sint-dos'].token, tres = P['sint-tres'].token;
  await sql`update public.respuestas_web_config set dudas_desde = pruebas.ahora() - interval '30 days' where id = 1`;
  const pronto = madridDe(20 * 3600000), lejos = madridDe(10 * 86400000);
  const nuevo = async (clave, tipo, f, hora, oficial = true) => (await sql`insert into public.eventos (clave, tipo, equipo, titulo, fecha, inicio, oficial, creado_por) values (${clave}, ${tipo}, 'ambos', ${clave}, ${f}, ${hora}, ${oficial}, ${oficial ? null : 'sint-uno'}) returning id`)[0].id;
  const E = { tarde: await nuevo('x-tarde', 'entreno', pronto.fecha, pronto.hora), lejos: await nuevo('x-lejos', 'entreno', lejos.fecha, '20:30'), libre: await nuevo('x-libre', 'entreno', pronto.fecha, pronto.hora, false) };
  const [lim] = await sql`select public._limite_dudas(${E.tarde}) l, public._limite_dudas(${E.lejos}) f`;
  ok(lim.l.getTime() < ahoraPrueba().getTime() && lim.f.getTime() > ahoraPrueba().getTime(), 'preparado: «tarde» ya pasó su límite y «lejos» no');
  const alertas = async (ev) => await sql`select person_id, antes, despues, aviso_encolado from public.alertas_gestores where evento_id = ${ev} order by en, person_id`;

  let r = await rpc('responder', { p_evento: E.lejos, p_respuesta: 'va' }, uno);
  r = await rpc('responder', { p_evento: E.lejos, p_respuesta: 'no', p_motivo: 'trabajo' }, uno);
  ok(r.datos.alerta === false && (await alertas(E.lejos)).length === 0, 'antes del límite: ni «va» ni baja dejan alerta');

  r = await rpc('responder', { p_evento: E.tarde, p_respuesta: 'va' }, uno);
  ok(r.status === 200 && r.datos.alerta === true, 'después del límite, «sin responder → va» (alta tardía) deja alerta', JSON.stringify(r.datos));
  r = await rpc('responder', { p_evento: E.tarde, p_respuesta: 'no', p_motivo: 'trabajo' }, uno);
  ok(r.datos.alerta === true, 'y «va → no» (la baja, el caso real del 04/11) también', JSON.stringify(r.datos));
  r = await rpc('responder', { p_evento: E.tarde, p_respuesta: 'no', p_motivo: 'familia' }, uno);
  ok(r.datos.alerta === false, 'cambiar solo el motivo no es un cambio de respuesta: sin alerta nueva');
  r = await rpc('responder', { p_evento: E.tarde, p_respuesta: 'va' }, uno);
  const al = await alertas(E.tarde);
  ok(al.length === 3 && al.map((x) => `${x.antes}>${x.despues}`).join() === 'sin_responder>va,va>no,no>va' && al.every((x) => x.person_id === 'sint-uno' && !x.aviso_encolado), 'quedan tres alertas, en orden, de Uno', JSON.stringify(al));

  // el cierre automático no avisa
  await sql`insert into public.respuestas (evento_id, person_id, respuesta, fuente, origen) values (${E.tarde}, 'sint-dos', 'duda', 'web', 'jugador')`;
  const [{ n: antesCierre }] = await sql`select count(*)::int n from public.alertas_gestores where evento_id = ${E.tarde}`;
  await sql`select * from public.cerrar_dudas(pruebas.ahora())`;
  const [{ n: trasCierre }] = await sql`select count(*)::int n from public.alertas_gestores where evento_id = ${E.tarde}`;
  ok((await sql`select respuesta, motivo from public.respuestas where evento_id = ${E.tarde} and person_id = 'sint-dos'`)[0].motivo === 'no_confirmo' && antesCierre === trasCierre, 'el cierre automático de dudas (duda → no va · no confirmó) no deja alerta');

  // un entreno no oficial y una ausencia
  r = await rpc('responder', { p_evento: E.libre, p_respuesta: 'va' }, tres);
  r = await rpc('responder', { p_evento: E.libre, p_respuesta: 'no', p_motivo: 'viaje' }, tres);
  ok((await alertas(E.libre)).length === 0, 'un entreno no oficial: sin alerta');
  r = await rpc('responder', { p_evento: E.tarde, p_respuesta: 'va' }, tres);
  r = await rpc('guardar_ausencia', { p_id: null, p_desde: pronto.fecha, p_hasta: pronto.fecha, p_motivo: 'viaje', p_detalle: null }, tres);
  ok(r.status === 200 && (await alertas(E.tarde)).some((x) => x.person_id === 'sint-tres' && x.antes === 'va' && x.despues === 'no'), 'una ausencia que pasa su «va» a «no» también avisa', JSON.stringify(r.datos));

  console.log('\n== La tarea de avisos manda el push a los gestores (una vez)');
  await sql`update public.alertas_gestores set aviso_encolado = true where evento_id <> ${E.tarde}`;
  await sql`delete from public.alertas_gestores where evento_id = ${E.tarde} and person_id <> 'sint-uno'`;
  await sql`delete from public.alertas_gestores where evento_id = ${E.tarde} and not (antes = 'va' and despues = 'no')`;
  const tarea = async () => { const t = await fetch(`${APP}/api/avisos/tarea`, { method: 'POST', headers: { authorization: `Bearer ${secreto}` } }); return { status: t.status, json: await t.json() }; };
  let t = await tarea();
  const push = async () => await sql`select titulo, cuerpo, url from public.avisos_registro where clave like 'gestores:%' order by clave`;
  const p = await push();
  const hoyEs = pronto.fecha === madridDe(0).fecha;
  ok(t.status === 200 && p.length === 1 && p[0].titulo === 'Uno: de «va» a «no va»' && p[0].cuerpo.startsWith(`Entreno ${hoyEs ? 'de hoy' : 'de mañana'}, ${pronto.hora}, después del cierre`) && p[0].url === `/gestion/eventos/${E.tarde}/respuestas`, 'un push al gestor: «Uno: de «va» a «no va»» y el entreno, apuntando a las respuestas', JSON.stringify({ t, p }));
  ok(!/trabajo|familia|viaje|motivo/i.test(p.map((x) => `${x.titulo} ${x.cuerpo}`).join(' ')), 'el push no lleva motivos');
  t = await tarea();
  ok((await push()).length === 1, 'repetir la tarea no lo duplica');

  console.log('\n== Reversión limpia (D111) y vuelta a aplicar');
  await sql.unsafe(fs.readFileSync(path.join(RAIZ, 'supabase', 'migrations', '20261104140000_aviso_entreno_cierre.revertir.sql'), 'utf8'));
  r = await rpc('responder', { p_evento: E.tarde, p_respuesta: 'va' }, dos);
  r = await rpc('responder', { p_evento: E.tarde, p_respuesta: 'no', p_motivo: 'otro' }, dos);
  ok(r.datos.alerta === false && !(await sql`select 1 from supabase_migrations.schema_migrations where version = '20261104140000'`).length, 'revertida: el entreno vuelve a no avisar y se borra su registro');
  await migrar(sql, { log: () => {} });
  r = await rpc('responder', { p_evento: E.tarde, p_respuesta: 'va' }, dos);
  ok(r.datos.alerta === true, 'vuelta a aplicar: el entreno avisa otra vez');
} catch (err) {
  console.log(`  FALLO excepción -> ${err.stack ?? err}`);
  process.exitCode = 1;
} finally {
  await e.parar();
}
const n = fallos();
console.log(n || process.exitCode ? `\n${n} FALLO(S)` : '\nTodo OK');
process.exit(n || process.exitCode ? 1 : 0);
