#!/usr/bin/env node
// Planes no oficiales (D117), contra la pila LOCAL (Postgres + PostgREST reales con NUESTRAS migraciones):
//   - la migracion conjunta (20261024200000) es solo aditiva y reversible (su .revertir.sql la deshace limpia);
//   - RLS y funciones: un jugador crea y edita lo suyo y NO lo ajeno; NO borra ni hace oficial; un gestor edita, borra
//     y hace oficial cualquier plan (y al organizador le queda un aviso en su inicio);
//   - exclusiones (punto 4): fuera de la vista publica y del .ics publico, de la cola «Copia a SportEasy», de los
//     recordatorios del club, de la asistencia y de la convocatoria; anon no ve nada;
//   - se responden en la web con el interruptor APAGADO y «No voy» sin motivo; con plazas, «completo»;
//   - recordatorio: solo con «recordar un dia antes», un aviso 24 h antes a quien no ha respondido, con silencio.
//
//   npm run pruebas:planes

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { arrancar } from './pila.mjs';
import { migrar } from '../scripts/db.mjs';
import { cargarEventos } from '../scripts/cargar_eventos.mjs';
import { planificar, planificarPlanes } from '../src/lib/avisos/planificador.ts';
import { madrid } from '../src/lib/avisos/horario.ts';
import { resumenCopia, convocadosDe } from '../src/lib/eventos/dominio.ts';
import { quienResponde } from '../src/lib/respuestas/dominio.ts';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const MIGS = path.join(AQUI, '..', 'supabase', 'migrations');
const MIG = '20261024200000_inicio_y_planes';
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };
const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
const sumar = (f, n) => { const d = new Date(`${f}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

const pila = await arrancar();
try {
  const { sql, url, anonKey } = pila;
  const api = async (ruta, { metodo = 'GET', cuerpo, token } = {}) => {
    const r = await fetch(`${url}/rest/v1${ruta}`, { method: metodo, headers: { apikey: anonKey, authorization: `Bearer ${token ?? anonKey}`, 'content-type': 'application/json', prefer: 'return=representation' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    let datos = null; try { datos = await r.json(); } catch {}
    return { status: r.status, datos };
  };
  const rpc = (f, args, token) => api(`/rpc/${f}`, { metodo: 'POST', cuerpo: args, token });
  const error = (r) => (r.datos && (r.datos.message || r.datos.msg)) || '';
  const tabla = async (n) => (await sql`select to_regclass(${'public.' + n}) as r`)[0].r !== null;

  console.log('\n== Migración conjunta: solo aditiva y reversible');
  const texto = fs.readFileSync(path.join(MIGS, `${MIG}.sql`), 'utf8');
  const drops = [...texto.matchAll(/(?:alter|drop)[^;]*\bdrop\b[^;]*;/gi)].map((m) => m[0].replace(/\s+/g, ' '));
  ok(drops.length === 1 && /drop constraint eventos_tipo_check/.test(drops[0]), 'el único «drop» es la relajación del check de eventos.tipo (admite tipos nuevos)', drops.join(' | '));
  ok(!/\btruncate\b|\bdelete\b/i.test(texto) && !/grant[^;]*\bdelete\b/i.test(texto), 'sin TRUNCATE, DELETE ni permiso de borrar');
  ok(fs.existsSync(path.join(MIGS, `${MIG}.revertir.sql`)), 'con su .revertir.sql al lado');
  for (const t of ['avisos_personales', 'calendario_tokens', 'tablero_registro', 'grupos_repartos']) ok(await tabla(t), `existe public.${t}`);
  await sql.begin((tx) => tx.unsafe(fs.readFileSync(path.join(MIGS, `${MIG}.revertir.sql`), 'utf8')));
  const cols = (await sql`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'eventos'`).map((c) => c.column_name);
  ok(!(await tabla('grupos_repartos')) && !cols.includes('oficial') && !cols.includes('ubicacion_lat'), 'revertir quita tablas y columnas nuevas');
  await migrar(sql, { log: () => {} });
  ok(await tabla('grupos_repartos') && (await sql`select count(*)::int n from public.pistas where lat is not null`)[0].n === 3, 'y se vuelve a aplicar (las tres pistas con coordenadas)');
  await sql`notify pgrst, 'reload schema'`;
  for (let i = 0; i < 40 && (await rpc('crear_plan', { p: {} }, anonKey)).status === 404; i++) await new Promise((ok2) => setTimeout(ok2, 250));

  console.log('\n== Cuentas de prueba');
  await cargarEventos(sql, { log: () => {} });
  const jugador = async (personId, email) => {
    await sql`update public.jugadores set email = ${email} where person_id = ${personId}`;
    const uid = await pila.crearUsuario(email, 'x');
    return { uid, token: await pila.firmar({ sub: uid, role: 'authenticated', email }), personId };
  };
  const jon = await jugador('esteban-jon', 'jon@pruebas.local');               // MdA y MdL
  const guille = await jugador('galan-domingo-guillermo', 'guille@pruebas.local'); // solo MdA
  const edimil = await jugador('feliz-gomez-edimil', 'edimil@pruebas.local');      // solo entrena
  const adri = await jugador('gianatti-adriano', 'adri@pruebas.local');
  const gUid = await pila.crearUsuario('gestor@pruebas.local', 'x');
  await sql`insert into public.gestores (user_id, nombre, email) values (${gUid}, 'Iván', 'gestor@pruebas.local')`;
  const tG = await pila.firmar({ sub: gUid, role: 'authenticated', email: 'gestor@pruebas.local' });

  console.log('\n== Un jugador propone un plan (se publica al momento, no oficial)');
  const manana = sumar(hoy, 3);
  const plan = { tipo: 'quedada', titulo: 'Cañas tras el entreno', fecha: manana, inicio: '22:45', equipo: 'ambos', notas: 'En el bar de siempre', recordar: true,
    ubicacion_nombre: 'Bar La Esquina', ubicacion_direccion: 'Calle de Valdebernardo, 2, Madrid', ubicacion_lat: 40.4, ubicacion_lng: -3.63 };
  let r = await rpc('crear_plan', { p: plan }, jon.token);
  ok(r.status === 200 && typeof r.datos === 'string', 'crear_plan: un jugador crea un plan', `${r.status} ${error(r)}`);
  const P = r.datos;
  // Al publicarlo desde la web, quien lo propone queda en «Voy» (la accion de la pagina lo hace).
  await rpc('responder_plan', { p_evento: P, p_respuesta: 'va' }, jon.token);
  const [fp] = await sql`select oficial, creado_por, tipo, quedada::text, sporteasy_estado, recordar_un_dia_antes, ubicacion_nombre from public.eventos where id = ${P}`;
  ok(fp.oficial === false && fp.creado_por === 'esteban-jon' && fp.tipo === 'quedada' && fp.quedada.startsWith('22:25') && fp.recordar_un_dia_antes && fp.ubicacion_nombre === 'Bar La Esquina', 'queda no oficial, con su organizador, la quedada 20 min antes y su sitio', JSON.stringify(fp));
  ok((await rpc('crear_plan', { p: { ...plan, tipo: 'liga' } }, jon.token)).status >= 400, 'un jugador NO crea un partido de liga (solo quedada, pachanga, amistoso u otro)');
  ok((await rpc('crear_plan', { p: { ...plan, fecha: sumar(hoy, -2) } }, jon.token)).status >= 400, 'ni un plan en un día pasado');
  ok((await rpc('crear_plan', { p: plan }, anonKey)).status >= 400, 'anon no crea planes');
  ok((await api('/eventos', { metodo: 'POST', cuerpo: { clave: 'x', tipo: 'quedada', equipo: 'ambos', fecha: manana, oficial: false, creado_por: 'esteban-jon' }, token: jon.token })).status >= 400, 'ni un jugador escribe en eventos por la API (solo con las funciones)');

  console.log('\n== Editar y cancelar: solo lo suyo (y un gestor, todo)');
  r = await rpc('editar_plan', { p_id: P, p: { ...plan, titulo: 'Cañas y cena' } }, adri.token);
  ok(r.status >= 400 && /no_es_tuyo/.test(error(r)), 'otro jugador NO edita un plan ajeno', `${r.status} ${error(r)}`);
  ok((await rpc('cancelar_plan', { p_id: P }, adri.token)).status >= 400, 'ni lo cancela');
  r = await rpc('editar_plan', { p_id: P, p: { ...plan, titulo: 'Cañas y cena' } }, jon.token);
  ok(r.status === 200 && (await sql`select titulo from public.eventos where id = ${P}`)[0].titulo === 'Cañas y cena', 'el organizador lo edita');
  ok((await rpc('borrar_plan', { p_id: P }, jon.token)).status >= 400, 'un jugador NO borra (ni el suyo: lo cancela)');
  ok((await rpc('hacer_oficial', { p_id: P }, jon.token)).status >= 400, 'ni lo hace oficial');
  r = await rpc('editar_plan', { p_id: P, p: { ...plan, titulo: 'Cañas, cena y karaoke' } }, tG);
  ok(r.status === 200 && r.datos.avisado === true, 'un gestor edita cualquier plan', `${r.status} ${error(r)}`);
  let avisos = (await api('/avisos_personales?select=texto', { token: jon.token })).datos ?? [];
  ok(avisos.some((a) => /ha cambiado tu plan/.test(a.texto)), 'al organizador le queda el aviso en su inicio', JSON.stringify(avisos));
  ok(((await api('/avisos_personales?select=texto', { token: adri.token })).datos ?? []).length === 0, 'y nadie más lo ve');

  console.log('\n== Se responde en la web con el interruptor APAGADO (excepción a D64)');
  ok((await sql`select encendido from public.respuestas_web_config`)[0].encendido === false, 'el interruptor está apagado');
  r = await rpc('responder_plan', { p_evento: P, p_respuesta: 'no' }, adri.token);
  ok(r.status === 200, '«No voy» sin motivo', `${r.status} ${error(r)}`);
  r = await rpc('responder_plan', { p_evento: P, p_respuesta: 'va' }, guille.token);
  ok(r.status === 200, 'Guille responde «Voy»');
  ok((await rpc('responder', { p_evento: P, p_respuesta: 'va' }, jon.token)).status >= 400, 'un evento oficial sigue sin poder responderse apagado (responder)');
  const qv = (await api(`/v_quien_va?evento_id=eq.${P}&select=nombre,estado`, { token: jon.token })).datos ?? [];
  ok(qv.some((x) => x.nombre === 'Guillermo' && x.estado === 'va') && qv.some((x) => x.nombre === 'Adriano' && x.estado === 'no') && !JSON.stringify(qv).match(/motivo|nivel/), '«Quién va» lo ven los invitados: nombres y estado, nada más');

  console.log('\n== Para quién: un plan solo del MdL no lo ve quien solo tiene ficha del MdA');
  r = await rpc('crear_plan', { p: { ...plan, tipo: 'pachanga', titulo: 'Pachanga MdL', equipo: 'MdL', plazas: 2, recordar: false } }, jon.token);
  const PL = r.datos;
  const verG = (await api(`/v_mi_agenda?id=eq.${PL}&select=id`, { token: guille.token })).datos ?? [];
  const verA = (await api(`/v_mi_agenda?id=eq.${PL}&select=id,organizador,es_mio`, { token: adri.token })).datos ?? [];
  ok(verG.length === 0 && verA.length === 1 && verA[0].organizador === 'Jon' && verA[0].es_mio === false, 'Guillermo (solo MdA) no lo ve; Adriano (MdL) sí, con su organizador', JSON.stringify({ verG, verA }));
  ok((await rpc('responder_plan', { p_evento: PL, p_respuesta: 'va' }, guille.token)).status >= 400, 'y Guillermo no puede responder (no está invitado)');
  const verE = (await api(`/v_mi_agenda?id=eq.${P}&select=id`, { token: edimil.token })).datos ?? [];
  ok(verE.length === 1, 'un plan para toda la plantilla también lo ve quien solo entrena');

  console.log('\n== Plazas: al llenarse, «completo»');
  ok((await rpc('responder_plan', { p_evento: PL, p_respuesta: 'va' }, jon.token)).status === 200, '1 de 2 plazas');
  ok((await rpc('responder_plan', { p_evento: PL, p_respuesta: 'va' }, adri.token)).status === 200, '2 de 2 plazas');
  const v3 = await jugador('vallesi-daniele', 'daniele@pruebas.local');
  r = await rpc('responder_plan', { p_evento: PL, p_respuesta: 'va' }, v3.token);
  ok(r.status >= 400 && /completo/.test(error(r)), 'el tercero recibe «completo»', `${r.status} ${error(r)}`);
  ok((await rpc('responder_plan', { p_evento: PL, p_respuesta: 'duda' }, v3.token)).status === 200, 'pero puede decir «Duda»');
  ok((await rpc('responder_plan', { p_evento: PL, p_respuesta: 'va' }, jon.token)).status === 200, 'y quien ya iba puede repetir «Voy» sin que cuente dos veces');

  console.log('\n== Exclusiones: nada público, ni SportEasy, ni asistencia, ni convocatoria, ni recordatorios del club');
  ok(((await api(`/v_eventos_publicos?clave=like.plan-*&select=clave`)).datos ?? []).length === 0, 'la vista pública (portada, calendario y .ics público) no tiene planes');
  ok(((await api(`/v_eventos_publicos?select=clave`)).datos ?? []).length === 67, 'y sigue teniendo los 67 eventos oficiales');
  const vacio = (r) => r.status === 401 || r.status === 403 || r.status === 404 || (Array.isArray(r.datos) && r.datos.length === 0);
  ok(vacio(await api(`/eventos?select=id`)) && vacio(await api(`/v_mi_agenda?select=id`)) && vacio(await api(`/avisos_personales?select=id`)), 'anon no lee eventos, ninguna agenda ni avisos');
  const eventosGestor = (await api(`/eventos?select=id,tipo,equipo,fecha,oficial,sporteasy_estado,estado,serie,origen,sporteasy_cambio,inicio,fin,quedada,titulo,creado_en,sin_recordatorios,recordar_un_dia_antes,borrado_en&temporada=eq.2026-27`, { token: tG })).datos ?? [];
  const planes = eventosGestor.filter((e) => e.oficial === false);
  ok(planes.length === 2 && planes.every((e) => e.sporteasy_estado === 'pendiente'), 'los planes existen (los ve un gestor)');
  const cola = resumenCopia(eventosGestor, hoy).pendientes;
  ok(cola.length > 0 && !cola.some((e) => e.oficial === false), `«Copia a SportEasy»: ${cola.length} pendientes y ningún plan`);
  const jug = (await api('/jugadores?select=person_id,nombre_visible,ficha_mda,ficha_mdl,entrena,activo,rol', { token: tG })).datos;
  const ahoraRec = new Date(Date.now());
  const recClub = planificar({ ahora: ahoraRec, encendidoDesde: new Date(Date.now() - 30 * 86400000), eventos: eventosGestor.map((e) => ({ ...e, sitio: 'x' })), jugadores: jug, respuestas: [], ausencias: [] });
  ok(!recClub.some((a) => a.eventos.some((id) => planes.some((p) => p.id === id))), 'los recordatorios del club no incluyen ningún plan (aunque estén «al crearlo»)');
  ok(convocadosDe({ tipo: 'quedada', equipo: 'MdL', oficial: false }, jug).every((j) => j.ficha_mdl) && quienResponde({ tipo: 'quedada', equipo: 'ambos', oficial: false }, jug.find((j) => j.person_id === 'feliz-gomez-edimil')), 'la definición de invitados de la web coincide con la base (MdL: solo fichas del MdL; toda la plantilla: también quien solo entrena)');
  // Asistencia, convocatoria y estadísticas leen solo lo oficial: cargarEventos (lib/eventos/datos.ts) filtra oficial = true.
  const datosTs = fs.readFileSync(path.join(AQUI, '..', 'src', 'lib', 'eventos', 'datos.ts'), 'utf8');
  ok(/if \(!conPlanes\) q = q\.eq\("oficial", true\)/.test(datosTs), 'cargarEventos (asistencia, convocatoria, rotación, importar) deja fuera los planes por defecto');
  const ctxConv = fs.readFileSync(path.join(AQUI, '..', 'src', 'lib', 'convocatoria', 'datos.ts'), 'utf8');
  ok(/cargarEventos\(sb\)/.test(ctxConv), 'la convocatoria usa cargarEventos sin planes');
  const [{ n: nAct }] = await sql`select count(*)::int n from public.jugadores where activo and rol <> 'entrenador'`;
  ok(nAct === 27, 'la condición «N/27» del interruptor no cambia con los planes (cuenta personas, no eventos)');

  console.log('\n== Recordatorio «un día antes» (solo si el organizador lo marcó), con silencio');
  const ev = (id) => { const e = eventosGestor.find((x) => x.id === id); return { ...e, sitio: 'Bar La Esquina', fecha: e.fecha, inicio: e.inicio }; };
  const resp = (await api(`/respuestas?select=evento_id,person_id,respuesta&evento_id=in.(${P},${PL})`, { token: tG })).datos;
  // P empieza a las 22:45: 24 h antes son las 22:45, que caen en el silencio (22:30–8:30) -> sale a las 8:30 del día anterior.
  const diaAntes = sumar(manana, -1);
  const a1 = planificarPlanes({ ahora: madrid(diaAntes, '22:46'), eventos: [ev(P), ev(PL)], jugadores: jug, respuestas: resp, ausencias: [] });
  ok(a1.length === 0, 'a las 22:46 del día antes (silencio) no sale nada', JSON.stringify(a1.map((x) => x.person_id)));
  const a2 = planificarPlanes({ ahora: madrid(manana, '08:31'), eventos: [ev(P), ev(PL)], jugadores: jug, respuestas: resp, ausencias: [] });
  const quien = new Set(a2.map((x) => x.person_id));
  ok(a2.length > 0 && a2.every((x) => x.eventos[0] === P && x.url === `/planes/${P}` && /Mañana: Cañas, cena y karaoke/.test(x.titulo)), `a las 8:31 sale para P (${a2.length} avisos), nunca para el plan sin «recordar»`);
  ok(!quien.has('gianatti-adriano') && !quien.has('galan-domingo-guillermo') && !quien.has('esteban-jon') && quien.has('vallesi-daniele'), 'solo a quien no ha respondido (no a Adriano, Guille ni Jon)');
  ok(!/motivo|nivel/.test(JSON.stringify(a2)), 'el texto no lleva motivos ni niveles');

  console.log('\n== Un gestor borra y hace oficial');
  r = await rpc('hacer_oficial', { p_id: PL }, tG);
  const [of] = await sql`select oficial, sporteasy_estado, sporteasy_cambio from public.eventos where id = ${PL}`;
  ok(r.status === 200 && of.oficial === true && of.sporteasy_estado === 'pendiente' && /Evento nuevo/.test(of.sporteasy_cambio), '«Hacer oficial»: pasa a oficial y entra en la cola de SportEasy', JSON.stringify(of));
  ok(((await api(`/v_eventos_publicos?select=clave&clave=like.plan-*`)).datos ?? []).length === 1, 'y ya sale en lo público como cualquier evento del club');
  r = await rpc('borrar_plan', { p_id: P }, tG);
  const [bo] = await sql`select borrado_en, estado, oficial from public.eventos where id = ${P}`;
  ok(r.status === 200 && bo.borrado_en && bo.estado === 'cancelado', '«Borrar»: queda marcado (borrado_en) y cancelado; no se borra la fila');
  ok(((await api(`/v_mi_agenda?id=eq.${P}&select=id`, { token: jon.token })).datos ?? []).length === 0, 'y desaparece de la agenda de todos');
  avisos = (await api('/avisos_personales?select=texto', { token: jon.token })).datos ?? [];
  ok(avisos.some((a) => /ha borrado tu plan/.test(a.texto)) && avisos.some((a) => /ha hecho oficial tu plan/.test(a.texto)), 'al organizador le quedan los avisos de borrado y de «hecho oficial»');
  ok((await rpc('editar_plan', { p_id: PL, p: plan }, tG)).status >= 400, 'un evento ya oficial no se toca como plan');
} catch (e) { console.error(e); fallos++; } finally {
  await pila.parar();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
