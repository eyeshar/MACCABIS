#!/usr/bin/env node
// Estado de asistencia en un solo sitio (D177) y contacto de WhatsApp (D178), contra la pila LOCAL (Postgres + PostgREST
// con NUESTRAS migraciones) y jugadores SINTÉTICOS (D39):
//   - _estado_efectivo (la base) da lo mismo que respuestaEfectiva (la web) en todos los casos: respuesta explícita >
//     «nunca a partidos» > ausencia > «no suele entrenar» (solo entrenos, sin quitar) > sin responder;
//   - el «Quién va» del jugador (v_quien_va) cuenta igual que Gestión: quien no va por defecto, en «no», sin nota;
//     el default no pisa una respuesta («no» con su motivo sigue igual) y en un partido no se aplica;
//   - quien no va por defecto no es pendiente (no recibe «no has respondido»);
//   - las dos migraciones (20261104100000, 20261104110000) se revierten limpias y se vuelven a aplicar;
//   - whatsapp_contacto y telefono: los lee y escribe un gestor; ni anónimo, ni jugador, ni una cuenta sin ficha.
//
//   npm run pruebas:asistencia-efectiva
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as D from '../src/lib/disponibilidad/porDefecto.ts';
import * as P from '../src/lib/avisos/planificador.ts';
import { arrancar } from './pila.mjs';
import { migrar } from './infra/migrar.mjs';

const MIGS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const MIG = '20261104100000_estado_efectivo';
const MIG2 = '20261104110000_whatsapp_contacto';
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

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
  const recargar = async () => { await sql`notify pgrst, 'reload schema'`; await esperar(1500); };
  const vacioONegado = (r) => r.status === 401 || r.status === 403 || (r.status === 200 && Array.isArray(r.datos) && r.datos.length === 0);

  console.log('\n== Migraciones (D111): reversibles y se vuelven a aplicar limpias');
  for (const m of [MIG, MIG2]) ok(fs.existsSync(path.join(MIGS, `${m}.revertir.sql`)), `${m}: tiene su .revertir.sql`);
  const texto1 = fs.readFileSync(path.join(MIGS, `${MIG}.sql`), 'utf8').replace(/--.*$/gm, '');
  ok(!/\bdrop\b|\btruncate\b|\bdelete\b|\bupdate\b|alter\s+table/i.test(texto1), `${MIG}: sin DROP, DELETE, UPDATE ni ALTER TABLE (solo funciones)`);
  const texto2 = fs.readFileSync(path.join(MIGS, `${MIG2}.sql`), 'utf8').replace(/--.*$/gm, '');
  ok(!/\bdrop\b|\btruncate\b|\bdelete\b|alter\s+column|\+\d{6,}|\b6\d{8}\b/i.test(texto2), `${MIG2}: solo añade la columna y los contactos (sin teléfonos, sin borrar)`);
  const estado = async () => (await sql`select to_regprocedure('public._estado_efectivo(uuid, text, text)') is not null fn,
    (select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'jugadores' and column_name = 'whatsapp_contacto') col,
    (select count(*)::int from supabase_migrations.schema_migrations where version in ('20261104100000', '20261104110000')) reg,
    pg_get_functiondef('public._quien_va()'::regprocedure) ~ '_estado_efectivo' usa`)[0];
  let e0 = await estado();
  ok(e0.fn && e0.col === 1 && e0.reg === 2 && e0.usa, 'aplicadas: _estado_efectivo, la columna, las dos registradas y _quien_va la usa', JSON.stringify(e0));
  await sql.begin((tx) => tx.unsafe(fs.readFileSync(path.join(MIGS, `${MIG2}.revertir.sql`), 'utf8')));
  await sql.begin((tx) => tx.unsafe(fs.readFileSync(path.join(MIGS, `${MIG}.revertir.sql`), 'utf8')));
  e0 = await estado();
  ok(!e0.fn && e0.col === 0 && e0.reg === 0 && !e0.usa, 'revertidas: sin la función, sin la columna, sin registro y _quien_va como antes', JSON.stringify(e0));
  await migrar(sql, { log: () => {} });
  e0 = await estado();
  ok(e0.fn && e0.col === 1 && e0.reg === 2 && e0.usa, 'y se vuelven a aplicar, limpias', JSON.stringify(e0));
  const permisos = (await sql`select has_function_privilege('anon', 'public._estado_efectivo(uuid, text, text)', 'execute') a,
    has_function_privilege('authenticated', 'public._estado_efectivo(uuid, text, text)', 'execute') u,
    has_function_privilege('authenticated', 'public._quien_va()', 'execute') q`)[0];
  ok(!permisos.a && !permisos.u && permisos.q, '_estado_efectivo es interna (ni anon ni authenticated la ejecutan); _quien_va, como siempre', JSON.stringify(permisos));
  await recargar();

  console.log('\n== Datos sintéticos: un entreno (miércoles 04/11) y un partido (domingo 08/11)');
  // nse = «no suele entrenar»; nap = «nunca a partidos». Nombres «Zz…» para no cruzarse con la plantilla de data/.
  const J = {
    'sint-ver': { n: 'Zz Ver' },                      // quien mira (va a los dos)
    'sint-def': { n: 'Zz Def', nse: true },           // default, sin responder         -> no (por defecto)
    'sint-dva': { n: 'Zz Dva', nse: true },           // default + «voy»                -> va
    'sint-dno': { n: 'Zz Dno', nse: true },           // default + «no» (familia)       -> no, con su motivo
    'sint-sin': { n: 'Zz Sin' },                      // sin default, sin responder     -> sin responder
    'sint-qui': { n: 'Zz Qui', nse: true },           // default quitado para el entreno -> sin responder
    'sint-aus': { n: 'Zz Aus' },                      // ausencia que cubre los dos     -> no (ausencia)
    'sint-nap': { n: 'Zz Nap', nap: true },           // nunca a partidos, sin responder -> fuera del partido
    'sint-dud': { n: 'Zz Dud' },                      // duda
  };
  for (const [p, j] of Object.entries(J)) {
    await sql`insert into public.jugadores (person_id, nombre_oficial, nombre_visible, ficha_mda, ficha_mdl, email) values (${p}, ${'Sintetico, ' + j.n}, ${j.n}, true, false, ${p + '@pruebas.local'})`;
    if (j.nse || j.nap) await sql`insert into public.jugadores_privado (person_id, no_suele_entrenar, nunca_partidos) values (${p}, ${!!j.nse}, ${!!j.nap})`;
  }
  const [ent] = await sql`insert into public.eventos (clave, tipo, equipo, fecha, inicio) values ('sint-ent-d177', 'entreno', 'ambos', '2026-11-04', '20:30') returning id, tipo, fecha, oficial`;
  const [par] = await sql`insert into public.eventos (clave, tipo, equipo, fecha, inicio, rival, jornada) values ('sint-par-d177', 'liga', 'MdA', '2026-11-08', '09:00', 'Rival', 5) returning id, tipo, fecha, oficial`;
  const resp = { 'sint-ver': 'va', 'sint-dva': 'va', 'sint-dno': 'no', 'sint-dud': 'duda' };
  for (const ev of [ent, par]) for (const [p, r] of Object.entries(resp)) {
    await sql`insert into public.respuestas (evento_id, person_id, respuesta, motivo, origen) values (${ev.id}, ${p}, ${r}, ${r === 'no' ? 'familia' : null}, 'jugador')`;
  }
  await sql`insert into public.entreno_defecto_quitado (evento_id, person_id, por_nombre) values (${ent.id}, 'sint-qui', 'Gestor')`;
  await sql`insert into public.ausencias_periodo (person_id, desde, hasta, motivo, origen) values ('sint-aus', '2026-11-01', '2026-11-10', 'viaje', 'jugador')`;

  console.log('\n== A6: la regla, caso a caso (TS) y la base da lo mismo (SQL)');
  const marcas = Object.fromEntries(Object.entries(J).map(([p, j]) => [p, { no_suele_entrenar: !!j.nse, nunca_partidos: !!j.nap }]));
  const aus = { person_id: 'sint-aus', desde: '2026-11-01', hasta: '2026-11-10' };
  const ts = (ev, p) => D.respuestaEfectiva(ev, marcas[p], resp[p] ?? 'sin_responder', { quitado: ev.id === ent.id && p === 'sint-qui', ausencia: p === 'sint-aus' ? aus : null });
  const sqlEf = async (ev, p) => (await sql`select * from public._estado_efectivo(${ev.id}, ${p}, ${resp[p] ?? null})`)[0];
  const E = { tipo: 'entreno', oficial: true }, L = { tipo: 'liga', oficial: true };
  ok(D.respuestaEfectiva(E, marcas['sint-def'], 'sin_responder').respuesta === 'no' && D.respuestaEfectiva(E, marcas['sint-def'], 'sin_responder').por === 'defecto', 'default sin respuesta -> no va (por defecto)');
  ok(D.respuestaEfectiva(E, marcas['sint-dva'], 'va').respuesta === 'va', 'default + voy -> va');
  ok(D.respuestaEfectiva(E, marcas['sint-dno'], 'no').respuesta === 'no' && D.respuestaEfectiva(E, marcas['sint-dno'], 'no').por === null, 'default + no voy con motivo -> su «no» (por su respuesta, no por defecto)');
  ok(D.respuestaEfectiva(E, marcas['sint-sin'], 'sin_responder').respuesta === 'sin_responder', 'sin default y sin respuesta -> sin responder');
  ok(D.respuestaEfectiva(L, marcas['sint-def'], 'sin_responder').respuesta === 'sin_responder', 'PARTIDO: el default no se aplica');
  let iguales = 0, total = 0;
  for (const ev of [ent, par]) for (const p of Object.keys(J)) {
    total++;
    const a = ts(ev, p), b = await sqlEf(ev, p);
    const igual = a.respuesta === b.respuesta && (a.por ?? null) === (b.por ?? null) && a.fuera === b.fuera;
    if (igual) iguales++; else ok(false, `${ev.tipo} · ${p}: la base y la web no coinciden`, `web ${JSON.stringify({ r: a.respuesta, por: a.por, fuera: a.fuera })} · base ${JSON.stringify(b)}`);
  }
  ok(iguales === total, `_estado_efectivo = respuestaEfectiva en los ${total} casos (2 eventos x ${Object.keys(J).length} personas)`);
  const [m] = await sql`select respuesta, motivo from public.respuestas where evento_id = ${ent.id} and person_id = 'sint-dno'`;
  ok(m.respuesta === 'no' && m.motivo === 'familia', 'A5: el default no pisa una respuesta explícita: «no» con «familia» sigue igual en la base');

  console.log('\n== A7 (sintético): el «Quién va» del jugador cuenta igual que Gestión');
  const cuenta = async (email) => { const uid = await pila.crearUsuario(email, 'x'); return { uid, token: await pila.firmar({ sub: uid, role: 'authenticated', email }) }; };
  const ver = await cuenta('sint-ver@pruebas.local');
  const recuento = (filas) => ({ va: filas.filter((f) => f.estado === 'va').length, duda: filas.filter((f) => f.estado === 'duda').length, no: filas.filter((f) => f.estado === 'no').length, sin: filas.filter((f) => f.estado === 'sin_responder').length });
  for (const ev of [ent, par]) {
    const r = await api(`/v_quien_va?select=*&evento_id=eq.${ev.id}`, { token: ver.token });
    const nuestros = (r.datos ?? []).filter((f) => /^Zz /.test(f.nombre));
    const jugador = recuento(nuestros);
    const gestion = { va: 0, duda: 0, no: 0, sin: 0 };
    for (const p of Object.keys(J)) { const x = ts(ev, p); if (x.fuera) continue; gestion[x.respuesta === 'sin_responder' ? 'sin' : x.respuesta]++; }
    ok(JSON.stringify(jugador) === JSON.stringify(gestion), `${ev.tipo}: jugador ${JSON.stringify(jugador)} = gestión ${JSON.stringify(gestion)}`);
    ok(nuestros.every((f) => Object.keys(f).sort().join() === 'estado,evento_id,nombre'), `${ev.tipo}: la vista sigue dando solo evento, nombre y estado (ni marca ni motivo)`);
    if (ev === ent) {
      ok(nuestros.find((f) => f.nombre === 'Zz Def')?.estado === 'no', 'entreno: Zz Def (default, sin responder) sale en «no van»');
      ok(nuestros.find((f) => f.nombre === 'Zz Qui')?.estado === 'sin_responder', 'entreno: Zz Qui (default quitado por un gestor) sale en «sin responder»');
      ok(JSON.stringify(jugador) === JSON.stringify({ va: 2, duda: 1, no: 3, sin: 3 }), 'entreno: 2 van / 1 duda / 3 no van (por defecto, su «no» y ausencia) / 3 sin responder', JSON.stringify(jugador));
    } else {
      ok(nuestros.find((f) => f.nombre === 'Zz Def')?.estado === 'sin_responder', 'partido: Zz Def (default) sigue «sin responder»: en partidos no cuenta');
      ok(!nuestros.some((f) => f.nombre === 'Zz Nap'), 'partido: Zz Nap («nunca a partidos», sin responder) no sale, como en Gestión');
    }
  }

  console.log('\n== A4: quien no va por defecto no recibe «no has respondido»');
  const datos = { respuestas: Object.entries(resp).map(([person_id, respuesta]) => ({ evento_id: ent.id, person_id, respuesta })), ausencias: [aus], quitados: [{ evento_id: ent.id, person_id: 'sint-qui' }] };
  const evP = { id: ent.id, fecha: '2026-11-04', tipo: 'entreno', oficial: true };
  ok(P.pendienteDe({ person_id: 'sint-def', marcas: marcas['sint-def'] }, evP, datos) === false, 'Zz Def: no es pendiente (ni recordatorio de «responde»)');
  ok(P.pendienteDe({ person_id: 'sint-sin', marcas: marcas['sint-sin'] }, evP, datos) === true && P.pendienteDe({ person_id: 'sint-qui', marcas: marcas['sint-qui'] }, evP, datos) === true, 'Zz Sin y Zz Qui (quitado) sí');

  console.log('\n== D178: whatsapp_contacto y telefono, solo gestores (RLS)');
  const g = await cuenta('gestor-wa@pruebas.local');
  await sql`insert into public.gestores (user_id, nombre, email) values (${g.uid}, 'Gestor', 'gestor-wa@pruebas.local')`;
  const intruso = await cuenta('intruso-wa@pruebas.local');
  // Teléfono FALSO (rango de ficción): nunca uno real en una prueba.
  let r = await api('/jugadores?person_id=eq.sint-ver', { metodo: 'PATCH', cuerpo: { whatsapp_contacto: 'Zz Ver Baloncesto', telefono: '+34600000001' }, token: g.token });
  ok(r.status === 200 && r.datos?.[0]?.whatsapp_contacto === 'Zz Ver Baloncesto', 'un gestor guarda contacto y teléfono');
  r = await api('/jugadores?select=person_id,whatsapp_contacto,telefono&person_id=eq.sint-ver', { token: g.token });
  ok(r.status === 200 && r.datos?.length === 1 && r.datos[0].telefono === '+34600000001', 'y los lee');
  for (const [quien, token] of [['anónimo', undefined], ['el propio jugador', ver.token], ['una cuenta sin ficha', intruso.token]]) {
    r = await api('/jugadores?select=whatsapp_contacto,telefono', { token });
    ok(vacioONegado(r), `${quien}: NO lee whatsapp_contacto ni telefono (de nadie, tampoco el suyo)`, `${r.status} ${Array.isArray(r.datos) ? r.datos.length + ' filas' : ''}`);
    r = await api('/jugadores?person_id=eq.sint-ver', { metodo: 'PATCH', cuerpo: { telefono: '+34600000002', whatsapp_contacto: 'x' }, token });
    ok(vacioONegado(r) || r.status >= 400, `${quien}: NO los cambia`);
  }
  const [t] = await sql`select telefono, whatsapp_contacto from public.jugadores where person_id = 'sint-ver'`;
  ok(t.telefono === '+34600000001' && t.whatsapp_contacto === 'Zz Ver Baloncesto', 'en la base sigue lo que guardó el gestor');
  const vistas = await sql`select table_name from information_schema.view_column_usage where table_schema = 'public' and table_name = 'jugadores' and column_name in ('telefono', 'whatsapp_contacto')`;
  ok(vistas.length === 0, 'ninguna vista expone telefono ni whatsapp_contacto', vistas.map((v) => v.table_name).join());
  r = await api('/v_quien_va?select=*', { token: ver.token });
  ok(!/telefono|whatsapp|\+34600/.test(JSON.stringify(r.datos)), '«Quién va» no lleva ni teléfono ni contacto');
} catch (err) {
  console.log(`  FALLO ${err.stack}`); fallos++;
} finally {
  await pila.parar();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTODO OK');
process.exit(fallos ? 1 : 0);
