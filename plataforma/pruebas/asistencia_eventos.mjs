#!/usr/bin/env node
// Asistencia evento a evento (D170): scripts/estadisticas/asistencia_eventos.js, scripts/cargar_asistencia_eventos.mjs y la
// migración 20261102100000_asistencia_eventos. Export SINTÉTICO (sin datos reales); la base es la pila local.
//   - Qué cuenta: entrenos y partidos de campeonato; no amistosos, torneos, cancelados ni futuros; el corte de 2026/27.
//   - Equipo (MdA/MdL) por la categoría, el play-off por el partido de ese día; los entrenos no tienen equipo.
//   - Dos perfiles de la misma persona en un evento: una fila, con el mejor estado. Nombre sin mayúsculas ni tildes.
//   - Cuadre contra asistencia_motivos: solo cuenta fueron, con excusa y sin excusa (no convocado y lesión salen).
//   - Migración aditiva y reversible; solo los gestores leen; nadie escribe por la API; cargar dos veces no duplica.
//
//   npm run pruebas:asistencia-eventos
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { arrancar } from './pila.mjs';
import { migrar } from './infra/migrar.mjs';
import { cargarEventos, informe } from '../scripts/cargar_asistencia_eventos.mjs';

const PLAT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const E = createRequire(import.meta.url)(path.join(PLAT, '..', 'scripts', 'estadisticas', 'asistencia_eventos.js'));
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };

// ---------------------------------------------------------------- datos sintéticos
const personas = [
  { person_id: 'sint-uno', display: 'Ana Zeta Alfa', formal: 'Zeta Alfa, Ana' },
  { person_id: 'sint-dos', display: 'Bruno Beta Gama', formal: 'Beta Gama, Bruno' },
  { person_id: 'sint-tres', display: 'Carla Delta', formal: 'Delta, Carla' },
  { person_id: 'sint-ign', display: 'Entrenador Ignorado', formal: 'Ignorado, Entrenador' },
];
const perfil = (id, first_name, last_name) => ({ id, first_name, last_name });
const fila = (p, played, presence = 'on_time') => ({ profile: p, group: { slug_name: played ? 'played' : 'not_played' }, presence: { slug_name: presence } });
let seq = 0;
const evento = (tipo, slug, start_at, filas, extra = {}) => ({
  lista: { id: 1000 + ++seq, name: `Evento ${seq}`, category: { type: tipo, slug_name: slug }, start_at, is_cancelled: false, is_past: true, ...extra },
  detalle: { attendees: [{ slug_name: 'played', results: filas.filter((f) => f.group.slug_name === 'played') }, { slug_name: 'not_played', results: filas.filter((f) => f.group.slug_name !== 'played') }] },
});
const P = {
  ana: perfil(1, 'Ana', 'Zeta Alfa'),         // diccionario
  ana2: perfil(2, 'ana', 'zeta alfa'),        // segundo perfil de Ana (mayúsculas distintas)
  bruno: perfil(3, 'Bruno', 'Beta Gama'),     // diccionario
  carla: perfil(4, 'Carla', 'Delta'),         // diccionario
  fuera: perfil(5, 'Zacarias', 'Nadie'),      // sin casar
  ign: perfil(6, 'Entrenador', 'Ignorado'),   // se ignora en 2026/27
};
const diccionario = new Map([['Ana Zeta Alfa', 'sint-uno'], ['Bruno Beta Gama', 'sint-dos'], ['Carla Delta', 'sint-tres'], ['Entrenador Ignorado', 'sint-ign']]);
const exp = {
  'temporada_2018-2019': { eventos: [
    evento('training', 'training', '2018-10-02T20:30:00+02:00', [fila(P.ana, true), fila(P.ana2, false, 'excused'), fila(P.bruno, false, 'not_excused'), fila(P.fuera, true)]),
    evento('championship_match', 'temporada-mda', '2018-10-07T10:00:00+02:00', [fila(P.ana, false, 'injured'), fila(P.bruno, true)]),
    evento('championship_match', 'temporada-mdl-2afase', '2019-03-10T10:00:00+01:00', [fila(P.bruno, true), fila(P.carla, false, 'excused')]),
    evento('championship_match', 'play-off-moratalaz', '2019-04-07T11:30:00+02:00', [fila(P.bruno, true)]),
    evento('championship_match', 'torneo-marca-mda', '2019-05-12T10:15:00+02:00', [fila(P.bruno, true)]),
    evento('friendly_match', 'friendly', '2018-10-14T10:00:00+02:00', [fila(P.bruno, true)]),
    evento('training', 'training', '2018-10-09T20:30:00+02:00', [fila(P.bruno, true)], { is_cancelled: true }),
    evento('training', 'training', '2018-10-16T20:30:00+02:00', [fila(P.bruno, true)], { is_past: false }),
  ] },
  'temporada_2025-2026': { eventos: [
    evento('training', 'training', '2025-10-01T20:30:00+02:00', [fila(P.ana, true), fila(P.bruno, false, 'excused'), fila(P.fuera, true)]),
    evento('championship_match', 'temporada-mdl-2025', '2025-10-12T09:00:00+02:00', [fila(P.ana, true), fila(P.carla, false, 'not_excused')]),
  ] },
  'temporada_2026-2027': { eventos: [
    evento('training', 'training', '2026-09-30T20:30:00+02:00', [fila(P.ana, true), fila(P.bruno, true)], { is_cancelled: true }), // cancelado a posteriori pero con asistentes: cuenta
    evento('training', 'training', '2026-10-02T20:30:00+02:00', [fila(P.bruno, false, 'excused')], { is_cancelled: true }), // cancelado y sin asistentes: no
    evento('championship_match', 'temporada-mda', '2026-10-18T10:15:00+02:00', [fila(P.ana, true), fila(P.bruno, false, 'excused'), fila(P.ign, true)]),
    evento('training', 'training', '2026-10-24T20:30:00+02:00', [fila(P.ana, true)]), // desde el 24/10 manda la plataforma
  ] },
};
const rivalesJdm = { partidos: [{ temporada: '2018-19', equipo: 'MdL', fecha: '2019-04-07', rival: 'X' }] };
const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'asistencia-eventos-'));
fs.mkdirSync(path.join(raiz, 'data'));
fs.writeFileSync(path.join(raiz, 'data', 'rivales_jdm.json'), JSON.stringify(rivalesJdm));
const entradas = {
  exp, personas, historia: [], dicc: { personas: [], resolucion_por_temporada: {} }, sporteasyPorNombre: diccionario, vinculos: {}, descartes: [],
  ignorar: { '2026-27': ['sint-ign'] },
};
const c = E.calcular(entradas, { raiz });
const de = (t) => c.filas.filter((f) => f.temporada === t);
const por = (t, pid, ambito) => de(t).filter((f) => f.person_id === pid && f.ambito === ambito);

console.log('\n== Qué cuenta');
ok(E.clase({ category: { type: 'training', slug_name: 'training' }, is_past: true }) === 'entrenos', 'un entreno');
ok(E.clase({ category: { type: 'championship_match', slug_name: 'temporada-mda-2afase' }, is_past: true }) === 'partidos' && E.clase({ category: { type: 'championship_match', slug_name: 'play-off-x' }, is_past: true }) === 'partidos', 'liga, 2.ª fase y play-off');
ok([E.clase({ category: { type: 'friendly_match' }, is_past: true }), E.clase({ category: { type: 'championship_match', slug_name: 'torneo-marca-mdl' }, is_past: true }),
  E.clase({ category: { type: 'training' }, is_past: true, is_cancelled: true }), E.clase({ category: { type: 'training' }, is_past: false })].every((x) => x === null), 'amistosos, torneos, cancelados y futuros no');
ok(new Set(de('2018-19').map((f) => f.evento_ref)).size === 4, 'en 2018/19: un entreno, un partido de liga, uno de 2.ª fase y el play-off (nada del torneo, el amistoso, el cancelado ni el futuro)');

console.log('\n== Persona, estado y equipo');
const ana = por('2018-19', 'sint-uno', 'entrenos');
ok(ana.length === 1 && ana[0].estado === 'fue', 'dos perfiles de Ana en el mismo evento (uno con otras mayúsculas): una fila, con el mejor estado', JSON.stringify(ana));
ok(por('2018-19', 'sint-dos', 'entrenos')[0]?.estado === 'sin_excusa', 'ausente sin excusa (o sin responder)');
ok(por('2018-19', 'sint-uno', 'partidos')[0]?.estado === 'lesion', 'lesionado');
ok(por('2018-19', 'sint-tres', 'partidos')[0]?.estado === 'con_excusa', 'ausente con excusa');
const eq = Object.fromEntries(de('2018-19').filter((f) => f.person_id === 'sint-dos' && f.ambito === 'partidos').map((f) => [f.fecha, f.equipo]));
ok(eq['2018-10-07'] === 'MdA' && eq['2019-03-10'] === 'MdL', 'el equipo sale de la categoría (también de la 2.ª fase)', JSON.stringify(eq));
ok(eq['2019-04-07'] === 'MdL', 'el play-off, del partido de ese día en data/rivales_jdm.json', JSON.stringify(eq));
ok(de('2018-19').filter((f) => f.ambito === 'entrenos').every((f) => f.equipo === null), 'los entrenos no tienen equipo');
const hist = de('2018-19').find((f) => f.person_id.startsWith('sporteasy-'));
ok(hist && hist.nombre === 'Zacarias Nadie', 'en las temporadas viejas, quien no casa es una persona histórica con su nombre de SportEasy');
ok(!de('2025-26').some((f) => f.person_id.startsWith('sporteasy-')), 'desde 2025/26, quien no casa se ignora');
ok(de('2018-19').every((f) => f.origen === 'sporteasy' && f.motivo === null && f.fecha.length === 10), 'origen sporteasy, fecha local, sin motivo (SportEasy no trae el texto)');
ok(c.ignorados >= 2 && c.solapes === 1, 'recuentos: ignorados y un solape fusionado', `${c.ignorados} ${c.solapes}`);

console.log('\n== 2026/27: corte y cancelados');
const f27 = de('2026-27');
ok(!f27.some((f) => f.fecha > E.HASTA_SPORTEASY), 'desde el 24/10/2026 no hay filas de SportEasy: manda la plataforma (D161)');
ok(f27.some((f) => f.fecha === '2026-09-30' && f.estado === 'fue'), 'un entreno marcado «cancelado» al que asistió gente cuenta');
ok(!f27.some((f) => f.fecha === '2026-10-02'), 'un cancelado sin asistentes no');
ok(!f27.some((f) => f.person_id === 'sint-ign'), 'las personas de «ignorar» de la temporada no cuentan');
ok(de('2018-19').some((f) => f.fecha === '2018-10-09') === false, 'en temporadas anteriores un cancelado no cuenta aunque haya asistentes marcados (D166)');

console.log('\n== Cuadre contra asistencia_motivos');
const fr = (pid, ambito, o) => ({ temporada: '2018-19', person_id: pid, nombre: pid, ambito, fueron: 0, excusa: 0, sin_excusa: 0, no_conv: 0, lesion: 0, total: 0, ...o });
const resumen = [
  fr('sint-uno', 'entrenos', { fueron: 1, total: 1 }),
  fr('sint-uno', 'partidos', { no_conv: 3, lesion: 1, total: 4 }), // lesión y no convocados: no cuentan
  fr('sint-dos', 'entrenos', { sin_excusa: 2, total: 2 }), // distinto: 1 en los eventos
  fr('sint-dos', 'partidos', { fueron: 3, total: 3 }),
  fr('sint-tres', 'partidos', { excusa: 1, total: 1 }),
  fr('sint-nueva', 'entrenos', { fueron: 2, total: 2 }), // solo en el resumen
];
const q = E.cuadrar(de('2018-19'), resumen);
const t18 = q.porTemporada['2018-19'];
ok(t18.iguales === 3 && t18.distintas === 1 && t18.soloResumen === 1 && t18.soloEventos === 1, 'cuenta iguales, distintas y solo-resumen; la lesión y «no convocado» no cuentan', JSON.stringify(t18));
ok(q.detalle.every((d) => ['distinta', 'solo en el resumen', 'solo en los eventos'].includes(d.tipo)), 'el detalle dice qué pasa en cada diferencia');
ok(/sint-nueva|Nueva/.test(informe(q, new Map([['sint-nueva', 'Nueva']]))), 'el informe lleva los nombres (privado)');
ok(E.cuadrar(de('2018-19'), [{ temporada: '2018-19', person_id: 'sint-x', nombre: 'X', ambito: 'partidos', fueron: 0, excusa: 0, sin_excusa: 0, no_conv: 5, lesion: 0, total: 5 }]).porTemporada['2018-19'].soloResumen === 0, 'una fila del resumen solo de no convocados no se echa en falta');

console.log('\n== Migración 20261102100000 (aditiva, reversible, solo gestores)');
const MIGS = path.join(PLAT, 'supabase', 'migrations');
const MIG = '20261102100000_asistencia_eventos';
const texto = fs.readFileSync(path.join(MIGS, `${MIG}.sql`), 'utf8').replace(/--.*$/gm, '');
ok(fs.existsSync(path.join(MIGS, `${MIG}.revertir.sql`)), 'tiene su .revertir.sql al lado');
ok(!/drop|truncate|delete|update|creates+(ors+replaces+)?function/i.test(texto) && /create table public.asistencia_eventos/.test(texto)
  && (texto.match(/alters+table[^;]*/gi) ?? []).every((x) => /^alter table public.asistencia_eventos enable row level security$/i.test(x.trim())), 'solo aditiva: una tabla nueva y su RLS, sin DROP, DELETE, UPDATE ni funciones; ningún ALTER de lo que ya existe');

const pila = await arrancar();
try {
  const { sql, url, anonKey } = pila;
  const existe = async () => (await sql`select to_regclass('public.asistencia_eventos') is not null e`)[0].e;
  const registrada = async () => (await sql`select 1 from supabase_migrations.schema_migrations where version = '20261102100000'`).length === 1;
  ok(await existe() && await registrada(), 'aplicada: la tabla y su registro');

  console.log('\n== Carga: reemplaza cada temporada entera, repetible');
  const porT = {};
  for (const f of c.filas) (porT[f.temporada] ||= []).push(f);
  for (let i = 0; i < 2; i++) for (const [t, fs_] of Object.entries(porT)) await cargarEventos(sql, t, fs_);
  const [{ n }] = await sql`select count(*)::int n from public.asistencia_eventos`;
  ok(n === c.filas.length && n > 0, `${n} filas, y cargar dos veces no duplica`, `${n} / ${c.filas.length}`);
  const r2 = await cargarEventos(sql, '2018-19', porT['2018-19'].slice(0, 2));
  ok(r2.borradas === porT['2018-19'].length && (await sql`select count(*)::int n from public.asistencia_eventos where temporada = '2018-19'`)[0].n === 2 && (await sql`select count(*)::int n from public.asistencia_eventos where temporada = '2025-26'`)[0].n === porT['2025-26'].length, 'recargar una temporada solo toca esa temporada');
  await cargarEventos(sql, '2018-19', porT['2018-19']);
  const malo = async (extra) => { try { await sql`insert into public.asistencia_eventos (person_id, evento_ref, nombre, temporada, fecha, ambito, estado, origen) values ('x', ${'z' + Math.random()}, 'X', '2026-27', '2026-10-01', ${extra.ambito ?? 'entrenos'}, ${extra.estado ?? 'fue'}, ${extra.origen ?? 'sporteasy'})`; return false; } catch { return true; } };
  ok(await malo({ ambito: 'otro' }) && await malo({ estado: 'quizas' }) && await malo({ origen: 'excel' }), 'la base rechaza ámbito, estado u origen que no existen');
  let entrenoConEquipo = false; try { await sql`insert into public.asistencia_eventos (person_id, evento_ref, nombre, temporada, fecha, ambito, equipo, estado) values ('x', 'e1', 'X', '2026-27', '2026-10-01', 'entrenos', 'MdA', 'fue')`; } catch { entrenoConEquipo = true; }
  ok(entrenoConEquipo, 'un entreno no puede llevar equipo (son comunes)');

  console.log('\n== RLS: solo los gestores leen; nadie escribe por la API');
  const api = async (ruta, { metodo = 'GET', cuerpo, token } = {}) => {
    const r = await fetch(`${url}/rest/v1${ruta}`, { method: metodo, headers: { apikey: anonKey, authorization: `Bearer ${token ?? anonKey}`, 'content-type': 'application/json', prefer: 'return=representation' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    let datos = null; try { datos = await r.json(); } catch {}
    return { status: r.status, datos };
  };
  const vacio = (r) => r.status === 401 || r.status === 403 || (Array.isArray(r.datos) && r.datos.length === 0);
  await sql`update public.jugadores set email = 'jugador@pruebas.local' where person_id = (select person_id from public.jugadores limit 1)`;
  const gestorId = await pila.crearUsuario('gestor@pruebas.local', 'no-se-usa');
  await sql`insert into public.gestores (user_id, nombre, email) values (${gestorId}, 'Gestor de pruebas', 'gestor@pruebas.local')`;
  const jugadorId = await pila.crearUsuario('jugador@pruebas.local', 'no-se-usa');
  const intrusoId = await pila.crearUsuario('intruso@pruebas.local', 'no-se-usa');
  const jwt = (id, email) => pila.firmar({ sub: id, role: 'authenticated', email });
  const tG = await jwt(gestorId, 'gestor@pruebas.local'); const tJ = await jwt(jugadorId, 'jugador@pruebas.local'); const tI = await jwt(intrusoId, 'intruso@pruebas.local');
  ok(vacio(await api('/asistencia_eventos?select=*')), 'anónimo no lee');
  ok(vacio(await api('/asistencia_eventos?select=*', { token: tJ })), 'un jugador no lee (ni lo suyo ni lo de los demás)');
  ok(vacio(await api('/asistencia_eventos?select=*', { token: tI })), 'un usuario sin ficha no lee');
  const rg = await api('/asistencia_eventos?select=*&limit=1000', { token: tG });
  ok(rg.status === 200 && rg.datos.length === n && rg.datos.every((x) => 'estado' in x && 'equipo' in x), `el gestor lee las ${n} filas`, `${rg.status} ${rg.datos?.length}`);
  const nueva = { person_id: 'x', evento_ref: 'se-1', nombre: 'X', temporada: '2099-00', fecha: '2099-01-01', ambito: 'entrenos', estado: 'fue' };
  for (const [quien, token] of [['anónimo', undefined], ['jugador', tJ], ['gestor', tG]]) {
    ok((await api('/asistencia_eventos', { metodo: 'POST', cuerpo: nueva, token })).status >= 400, `${quien} no inserta`);
    await api('/asistencia_eventos?estado=eq.fue', { metodo: 'PATCH', cuerpo: { estado: 'lesion' }, token });
    await api('/asistencia_eventos?estado=eq.fue', { metodo: 'DELETE', token });
  }
  const [{ n2, l }] = await sql`select count(*)::int n2, count(*) filter (where estado = 'lesion')::int l from public.asistencia_eventos`;
  const [{ l0 }] = await sql`select count(*)::int l0 from public.asistencia_eventos where estado = 'lesion' and temporada = '2018-19' and person_id = 'sint-uno'`;
  ok(n2 === n && l === l0, 'tras los intentos de escritura, modificación y borrado no ha cambiado nada');
  const [p] = await sql`select has_table_privilege('anon', 'public.asistencia_eventos', 'select') a, has_table_privilege('authenticated', 'public.asistencia_eventos', 'insert') i,
    has_table_privilege('authenticated', 'public.asistencia_eventos', 'update') u, has_table_privilege('authenticated', 'public.asistencia_eventos', 'delete') d,
    (select relrowsecurity from pg_class where oid = 'public.asistencia_eventos'::regclass) rls`;
  ok(!p.a && !p.i && !p.u && !p.d && p.rls, 'permisos: anon sin SELECT, authenticated solo SELECT, RLS activada');
  const pol = await sql`select cmd from pg_policies where tablename = 'asistencia_eventos'`;
  ok(pol.length === 1 && pol[0].cmd === 'SELECT', 'una única política, de SELECT para gestores', JSON.stringify(pol));
  const [{ m }] = await sql`select count(*)::int m from public.asistencia_motivos`;
  ok(m === 0, 'asistencia_motivos no se ha tocado (la migración solo añade una tabla)');

  console.log('\n== Reversión: se deshace limpia y se vuelve a aplicar');
  await sql.begin((tx) => tx.unsafe(fs.readFileSync(path.join(MIGS, `${MIG}.revertir.sql`), 'utf8')));
  ok(!(await existe()) && !(await registrada()), 'revertir: quita la tabla y el registro');
  await migrar(sql, { log: () => {} });
  ok(await existe() && await registrada(), 'se vuelve a aplicar, limpia');
} finally {
  await pila.parar();
  fs.rmSync(raiz, { recursive: true, force: true });
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
