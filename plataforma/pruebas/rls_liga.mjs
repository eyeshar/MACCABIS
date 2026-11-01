#!/usr/bin/env node
// Pruebas de RLS de las tablas de liga (D73, D162), contra la pila local (Postgres + PostgREST reales con
// NUESTRAS migraciones, ver pila.mjs). Los datos por jugador de otros equipos son de terceros: los leen los
// gestores y, desde D162, los jugadores con sesion y ficha; anon y una cuenta sin ficha, nada. liga_calendario
// sigue solo para gestores. Tambien prueba el .revertir.sql de D162 (vuelve a solo gestores) y que se reaplica.
//
//   npm run pruebas:liga
//
// Carga las hojas reales de fuentes_fbm/ (fuera de git) con el mismo script que `npm run db:liga`.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { arrancar } from './pila.mjs';
import { migrar } from '../scripts/db.mjs';
import { leerLiga, cargarLiga } from '../scripts/cargar_liga.mjs';
import { filasTabla, filasFichas } from '../src/lib/jugadoresLiga.ts';

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
  const vacioOBloqueado = (r) => r.status === 401 || r.status === 403 || (Array.isArray(r.datos) && r.datos.length === 0);

  console.log('\n== Carga (la misma que npm run db:liga)');
  const liga = leerLiga('2026-27');
  const partidos = liga.privado;
  const esperadoJug = partidos.reduce((s, p) => s + p.equipos.reduce((t, e) => t + e.jugadores.length, 0), 0);
  // Cifras leidas de los datos (crecen cada jornada): partidos cargados, jornadas y partidos nuestros (MdA o MdL).
  const N = partidos.length;
  const jornadas = [...new Set(partidos.map((p) => p.jornada))].sort((a, b) => a - b);
  const NUESTROS = partidos.filter((p) => ['MdA', 'MdL'].some((n) => n === p.local || n === p.visitante)).length;
  await cargarLiga(sql, liga, '2026-27', { log: () => {} });
  const cuenta = async () => ({
    p: (await sql`select count(*)::int n from public.liga_partidos`)[0].n,
    j: (await sql`select count(*)::int n from public.liga_estadisticas_jugador`)[0].n,
  });
  let c = await cuenta();
  ok(c.p === N && N > 0, `${N} partidos cargados (J${jornadas.join(', J')} de G1 y G2)`, String(c.p));
  ok(c.j === esperadoJug, `${esperadoJug} filas de jugador cargadas`, String(c.j));
  await cargarLiga(sql, liga, '2026-27', { log: () => {} });
  c = await cuenta();
  ok(c.p === N && c.j === esperadoJug, 'cargar dos veces no duplica nada (idempotente)');
  const [{ n: sumas }] = await sql`
    select count(*)::int n from public.liga_partidos p
    where p.pts_local = (select sum(pts) from public.liga_estadisticas_jugador e where e.partido_id = p.id and e.equipo = p.local)
      and p.pts_visitante = (select sum(pts) from public.liga_estadisticas_jugador e where e.partido_id = p.id and e.equipo = p.visitante)`;
  ok(sumas === N, `en los ${N} partidos, la suma de puntos por jugador = marcador de cada equipo`, String(sumas));
  const [{ nuestros }] = await sql`select count(*)::int nuestros from public.liga_partidos where nuestro`;
  ok(nuestros === NUESTROS && NUESTROS === 2 * jornadas.length, `solo ${NUESTROS} partidos marcados como nuestros (MdA y MdL, ${jornadas.length} jornadas)`, String(nuestros));

  // Usuarios: un gestor, un jugador (con correo en la lista blanca) y un intruso sin ninguna ficha.
  await sql`update public.jugadores set email = 'jugador@pruebas.local' where person_id = 'esteban-jon'`;
  const gestorId = await pila.crearUsuario('gestor@pruebas.local', 'no-se-usa');
  await sql`insert into public.gestores (user_id, nombre, email) values (${gestorId}, 'Gestor de pruebas', 'gestor@pruebas.local')`;
  const jugadorId = await pila.crearUsuario('jugador@pruebas.local', 'no-se-usa');
  const intrusoId = await pila.crearUsuario('intruso@pruebas.local', 'no-se-usa');
  const jwt = (id, email) => pila.firmar({ sub: id, role: 'authenticated', email });
  const tGestor = await jwt(gestorId, 'gestor@pruebas.local');
  const tJugador = await jwt(jugadorId, 'jugador@pruebas.local');
  const tIntruso = await jwt(intrusoId, 'intruso@pruebas.local');

  console.log('\n== Tabla "Todos los jugadores": coherencia con la clasificacion');
  const jug = await sql`select grupo, equipo, nombre, dorsal, pj, segundos, pts, p2a, p3a, tla, tli, faltas from public.v_liga_jugadores where temporada = '2026-27'`;
  const clas = await sql`select grupo, equipo, pf, pj from public.liga_clasificacion where temporada = '2026-27'`;
  const filas = filasTabla(jug, new Map(clas.map((c) => [`${c.grupo}|${c.equipo}`, c.pj])));
  const dobles = filas.filter((f) => f.dobla);
  ok(dobles.length > 0, `hay dobladores (${dobles.length}) y salen en una sola fila con equipo "MdA + MdL"`);
  ok(new Set(filas.map((f) => f.nombre.concat('|', f.equipos.join()))).size === filas.length, 'ninguna persona aparece dos veces en la tabla');
  const porEquipo = new Map();
  for (const j of jug) porEquipo.set(`${j.grupo}|${j.equipo}`, (porEquipo.get(`${j.grupo}|${j.equipo}`) ?? 0) + j.pts);
  ok(clas.filter((c) => c.pj > 0).every((c) => porEquipo.get(`${c.grupo}|${c.equipo}`) === c.pf), 'la suma de PTS por jugador de cada equipo = sus puntos a favor en la clasificacion calculada (20 equipos con partidos)');
  const sumaTabla = filas.reduce((n, f) => n + f.pts, 0), sumaFichas = jug.reduce((n, j) => n + j.pts, 0), sumaPF = clas.reduce((n, c) => n + c.pf, 0);
  ok(sumaTabla === sumaFichas && sumaFichas === sumaPF, `los dobladores no se cuentan dos veces: PTS de la tabla (${sumaTabla}) = PTS de las fichas (${sumaFichas}) = puntos a favor de toda la liga (${sumaPF})`);
  for (const f of dobles) {
    const a = jug.find((j) => j.equipo === 'MdA' && j.nombre === f.nombre), l = jug.find((j) => j.equipo === 'MdL' && j.nombre === f.nombre);
    if (!(f.pts === a.pts + l.pts && f.pj === a.pj + l.pj && f.faltas === a.faltas + l.faltas && f.tla === a.tla + l.tla)) ok(false, `doblador ${f.nombre}: fichas sumadas`);
  }
  ok(true, 'cada doblador lleva las dos fichas sumadas (PJ, PTS, TL, faltas)');
  // Con filtro de grupo o de equipo, quien dobla se ve con SOLO la ficha de ese grupo/equipo: la suma de PTS = puntos a favor del equipo
  const fichas = filasFichas(jug, new Map(clas.map((c) => [`${c.grupo}|${c.equipo}`, c.pj])));
  for (const [grupo, equipo] of [['G1', 'MdA'], ['G2', 'MdL']]) {
    const pf = clas.find((c) => c.grupo === grupo && c.equipo === equipo).pf;
    const porGrupo = fichas.filter((f) => f.grupos.includes(grupo) && f.equipos.includes(equipo)).reduce((n, f) => n + f.pts, 0);
    ok(porGrupo === pf, `con filtro ${grupo}/${equipo}, la suma de PTS de la tabla (${porGrupo}) = puntos a favor de ${equipo} en la clasificacion (${pf})`);
    const grupoEntero = fichas.filter((f) => f.grupos.includes(grupo)).reduce((n, f) => n + f.pts, 0);
    ok(grupoEntero === clas.filter((c) => c.grupo === grupo).reduce((n, c) => n + c.pf, 0), `con filtro de grupo ${grupo}, la suma de PTS de todas las filas = puntos a favor de todo el grupo`);
  }
  ok(fichas.filter((f) => f.dobla).every((f) => f.soloFicha === f.equipos[0]), 'las fichas de los dobladores van marcadas con su ficha (MdA o MdL)');

  console.log('\n== RLS: anonimo e intruso no ven nada; el jugador con ficha, todo menos liga_calendario (D162)');
  const tablas = ['liga_partidos', 'liga_estadisticas_jugador', 'v_liga_jugadores', 'liga_calendario', 'liga_clasificacion'];
  const abiertas = tablas.filter((t) => t !== 'liga_calendario');
  const jugadorLee = async () => {
    const r = {};
    for (const t of abiertas) { const x = await api(`/${t}?select=*&limit=3`, { token: tJugador }); r[t] = x.status === 200 && x.datos.length > 0; }
    return r;
  };
  for (const t of tablas) {
    ok(vacioOBloqueado(await api(`/${t}?select=*`)), `anonimo NO lee ${t}`);
    ok(vacioOBloqueado(await api(`/${t}?select=*`, { token: tIntruso })), `un usuario sin ficha NO lee ${t}`);
  }
  const lee = await jugadorLee();
  for (const t of abiertas) ok(lee[t], `un jugador con ficha y sesion lee ${t} (D162)`);
  ok(vacioOBloqueado(await api('/liga_calendario?select=*', { token: tJugador })), 'un jugador NO lee liga_calendario (solo gestores; ya no la lee ninguna pantalla)');
  ok(vacioOBloqueado(await api('/liga_estadisticas_jugador?select=nombre&nombre=ilike.*PASTOR*', { token: tIntruso })), 'una cuenta sin ficha no saca un rival ni buscandolo por nombre');
  await sql`update public.jugadores set activo = false where person_id = 'esteban-jon'`;
  ok(vacioOBloqueado(await api('/liga_clasificacion?select=*', { token: tJugador })), 'un jugador dado de baja (activo = false) deja de leer la liga');
  await sql`update public.jugadores set activo = true where person_id = 'esteban-jon'`;

  console.log('\n== RLS: el gestor lee todo');
  for (const [t, n] of [['liga_calendario', 44], ['liga_clasificacion', 22]]) {
    const rg = await api(`/${t}?select=*`, { token: tGestor });
    ok(rg.status === 200 && rg.datos.length === n, `gestor lee ${t} (${n} filas)`, `status ${rg.status} / ${rg.datos?.length}`);
  }
  let r = await api('/liga_partidos?select=*', { token: tGestor });
  ok(r.status === 200 && r.datos.length === N, `gestor lee los ${N} partidos`, `status ${r.status} / ${r.datos?.length}`);
  r = await api('/liga_estadisticas_jugador?select=*', { token: tGestor });
  ok(r.status === 200 && r.datos.length === esperadoJug, `gestor lee las ${esperadoJug} filas de jugador`, `status ${r.status} / ${r.datos?.length}`);
  r = await api('/v_liga_jugadores?select=*&order=pts.desc&limit=3', { token: tGestor });
  ok(r.status === 200 && r.datos.length === 3 && r.datos[0].pts >= r.datos[1].pts, 'gestor lee la vista de acumulados por jugador');

  console.log('\n== Escritura: nadie escribe por la API (solo el script local)');
  const nuevo = { temporada: '2026-27', grupo: 'G1', jornada: 9, local: 'A', visitante: 'B', pts_local: 1, pts_visitante: 2 };
  for (const [quien, token] of [['anonimo', undefined], ['jugador', tJugador], ['gestor', tGestor]]) {
    ok((await api('/liga_partidos', { metodo: 'POST', cuerpo: nuevo, token })).status >= 400, `${quien} NO inserta partidos`);
    ok((await api('/liga_partidos?jornada=eq.1', { metodo: 'PATCH', cuerpo: { pts_local: 0 }, token })).status >= 400
      || (await sql`select count(*)::int n from public.liga_partidos where pts_local = 0`)[0].n === 0, `${quien} NO modifica partidos`);
    await api('/liga_estadisticas_jugador?pts=gte.0', { metodo: 'DELETE', token });
    await api('/liga_partidos?jornada=eq.1', { metodo: 'DELETE', token });
  }
  c = await cuenta();
  ok(c.p === N && c.j === esperadoJug, 'tras los intentos de escritura y borrado no ha cambiado nada');

  console.log('\n== Permisos de base de datos');
  for (const t of [...tablas]) {
    const [{ anon_sel, aut_ins, aut_upd, aut_del }] = await sql.unsafe(
      `select has_table_privilege('anon', 'public.${t}', 'select') as anon_sel,
              has_table_privilege('authenticated', 'public.${t}', 'insert') as aut_ins,
              has_table_privilege('authenticated', 'public.${t}', 'update') as aut_upd,
              has_table_privilege('authenticated', 'public.${t}', 'delete') as aut_del`);
    ok(!anon_sel, `anon no tiene SELECT en ${t}`);
    ok(!aut_ins && !aut_upd && !aut_del, `authenticated no tiene INSERT/UPDATE/DELETE en ${t}`);
  }
  const rls = await sql`select relname, relrowsecurity from pg_class where relname in ('liga_partidos', 'liga_estadisticas_jugador', 'liga_calendario', 'liga_clasificacion')`;
  ok(rls.length === 4 && rls.every((x) => x.relrowsecurity), 'RLS activada en las cuatro tablas');
  const pol = await sql`select tablename, policyname, cmd from pg_policies where tablename like 'liga_%' order by tablename, policyname`;
  ok(pol.length === 7 && pol.every((x) => x.cmd === 'SELECT'), 'solo politicas de SELECT: gestores_leen en las cuatro y jugadores_leen en partidos, estadisticas y clasificacion', JSON.stringify(pol));
  ok(!pol.some((x) => x.tablename === 'liga_calendario' && x.policyname === 'jugadores_leen'), 'liga_calendario sin politica de jugadores');
  const [{ anon_ex }] = await sql`select has_function_privilege('anon', 'public.puede_ver_liga()', 'execute') anon_ex`;
  ok(!anon_ex, 'anon no puede ejecutar puede_ver_liga()');
  const [{ inv }] = await sql`select (reloptions::text like '%security_invoker=true%') as inv from pg_class where relname = 'v_liga_jugadores'`;
  ok(inv === true, 'la vista v_liga_jugadores es security_invoker (hereda la RLS de quien consulta)');

  console.log('\n== Reversion de D162 (.revertir.sql) y vuelta a aplicar');
  const MIGS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
  await sql.begin((tx) => tx.unsafe(fs.readFileSync(path.join(MIGS, '20261031200000_liga_para_jugadores.revertir.sql'), 'utf8')));
  await new Promise((r) => setTimeout(r, 600)); // PostgREST recarga el esquema (notify)
  const trasRevertir = await jugadorLee();
  ok(abiertas.every((t) => !trasRevertir[t]), 'revertida: el jugador vuelve a no leer nada (solo gestores, D73)', JSON.stringify(trasRevertir));
  ok((await sql`select count(*)::int n from pg_policies where tablename like 'liga_%'`)[0].n === 4, 'revertida: quedan solo las 4 politicas de gestores');
  ok((await sql`select 1 from supabase_migrations.schema_migrations where version = '20261031200000'`).length === 0, 'revertida: borra su registro de migraciones');
  r = await api('/liga_partidos?select=*', { token: tGestor });
  ok(r.status === 200 && r.datos.length === N, 'revertida: el gestor sigue leyendo todo');
  await migrar(sql, { log: () => {} });
  await new Promise((r2) => setTimeout(r2, 600));
  const otraVez = await jugadorLee();
  ok(abiertas.every((t) => otraVez[t]), 'reaplicada: el jugador vuelve a leer la liga', JSON.stringify(otraVez));
} finally {
  await pila.parar();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
