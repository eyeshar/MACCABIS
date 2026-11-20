#!/usr/bin/env node
// MdFantasy (D196): el «staging» LOCAL para probarlo antes de aprobarlo. No hay rama de Supabase (el plan gratuito no las
// tiene y D111 dice que no hay entorno de pruebas): esto levanta en ESTE ordenador una base de usar y tirar (la pila de las
// pruebas, 127.0.0.1) con la migración del fantasy, le copia del Supabase real, EN SOLO LECTURA, lo que el juego necesita,
// y arranca la web (next build + next start) contra ella. Nada de lo que se haga aquí llega al real ni a Vercel (D179).
//
//   npm run fantasy:probar -- --confirmar <ref>            copia del real (solo lectura) y abre dos ventanas con sesión
//   npm run fantasy:probar -- --confirmar <ref> --sin-ventanas   solo arranca; se entra a mano (el código sale en esta consola)
//   Opciones: --managers N (mánagers de demostración con historia; por defecto 8; 0 = ninguno) · --apagado (interruptor sin tocar)
//
// Qué copia del real (transacción READ ONLY; norma 19: sin --confirmar <ref> no se conecta):
//   jugadores (sin correo ni teléfono: aquí cada uno entra con <person_id>@pruebas.local), pistas, eventos, respuestas
//   (el motivo se cambia por «otro» y el detalle no se copia), ausencias (ídem), convocatorias, recordatorios enviados,
//   asistencia 2026-27 (sin motivos) y la liga. NO copia jugadores_privado (niveles, dobla): el fantasy no lo usa.
// No envía avisos: la web arranca sin clave VAPID. Al cerrar (Ctrl+C) se borra todo.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { conectar } from '../db.mjs';
import { exigirDestino } from '../lib/destino.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const opcion = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const N_MANAGERS = Number(opcion('--managers', '8'));
const GESTORES = [['villaescusa-silva-ivan', 'Iván'], ['martin-ortega-rico-eduardo', 'Eduardo'], ['barreiro-carballal-carlos-jose', 'Carlos']];
const correo = (pid) => `${pid}@pruebas.local`;

// El reloj de las pruebas, puesto en la hora REAL (la pila cambia now() por pruebas.ahora(); con esta referencia marca la hora de verdad).
process.env.PRUEBAS_RELOJ_REF = String(new Date('2026-10-19T10:00:00+02:00').getTime());

await exigirDestino(args);   // carga .env.local y comprueba que --confirmar es el real
const URL_REAL = process.env.SUPABASE_DB_URL;
// Desde aquí, nada del real en el entorno: ni la pila ni la web pueden heredarlo.
for (const k of ['SUPABASE_DB_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'AVISOS_SECRETO', 'VAPID_PRIVATE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']) process.env[k] = '';

const relojMod = await import('../../pruebas/infra/reloj.mjs');
if (Math.abs(relojMod.ahoraPrueba().getTime() - Date.now()) > 5000) { console.error('El reloj de la pila no marca la hora real: no sigo.'); process.exit(1); }
const { arrancar } = await import('../../pruebas/pila.mjs');
const { PUERTOS } = await import('../../pruebas/infra/puertos.mjs');
const { lanzar, matarArbol } = await import('../../pruebas/infra/procesos.mjs');
const { esperar } = await import('../../pruebas/infra/app.mjs');
const { cerrarJornada } = await import('../../src/lib/fantasy/cierre.ts');

const TABLAS = [
  ['pistas'], ['eventos'], ['descansos'],
  ['respuestas', { motivo: (v) => (v ? 'otro' : null), detalle: () => null, puesto_por: () => null }],
  ['respuestas_domingo', { motivo: (v) => (v ? 'otro' : null), detalle: () => null, puesto_por: () => null }],
  ['ausencias_periodo', { motivo: (v) => (v ? 'otro' : null), detalle: () => null, creado_por: () => null, puesto_por: () => null }],
  ['convocatorias', { whatsapp_base: () => null, aviso_base: () => null }],
  ['avisos_registro', { user_id: () => null }, `tipo = 'recordatorio' and person_id is not null`],
  ['asistencia_eventos', { motivo: () => null }, `temporada = '2026-27'`],
  ['liga_partidos'], ['liga_estadisticas_jugador'], ['liga_calendario'], ['liga_clasificacion'],
];

async function copiarDelReal(real, sql) {
  const columnasDe = async (db, t) => (await db`select column_name c from information_schema.columns where table_schema = 'public' and table_name = ${t} and is_generated = 'NEVER'`).map((x) => x.c);
  await sql.unsafe(`set session_replication_role = replica`);   // carga en bruto: sin disparadores (ni avisos ni alertas)
  // Jugadores: los del real, sin correo ni teléfono.
  const js = await real`select person_id, nombre_oficial, nombre_visible, temporada, ficha_mda, ficha_mdl, entrena, rol::text as rol, activo from public.jugadores`;
  await sql`delete from public.jugadores where person_id <> all(${js.map((j) => j.person_id)})`;
  for (const j of js) {
    await sql`insert into public.jugadores (person_id, nombre_oficial, nombre_visible, temporada, ficha_mda, ficha_mdl, entrena, rol, activo, email)
              values (${j.person_id}, ${j.nombre_oficial}, ${j.nombre_visible}, ${j.temporada}, ${j.ficha_mda}, ${j.ficha_mdl}, ${j.entrena}, ${j.rol}::public.rol_jugador, ${j.activo}, ${correo(j.person_id)})
              on conflict (person_id) do update set nombre_oficial = excluded.nombre_oficial, nombre_visible = excluded.nombre_visible, ficha_mda = excluded.ficha_mda,
                ficha_mdl = excluded.ficha_mdl, entrena = excluded.entrena, rol = excluded.rol, activo = excluded.activo, email = excluded.email, telefono = null`;
  }
  const cuenta = { jugadores: js.length };
  for (const [t, limpiar = {}, filtro] of TABLAS) {
    const cols = await columnasDe(sql, t);
    const enReal = await columnasDe(real, t);
    const comunes = cols.filter((c) => enReal.includes(c));
    if (!comunes.length) { cuenta[t] = 'no existe'; continue; }
    const filas = await real.unsafe(`select ${comunes.map((c) => `"${c}"`).join(', ')} from public."${t}"${filtro ? ` where ${filtro}` : ''}`);
    await sql.unsafe(`delete from public."${t}"`);
    const limpias = filas.map((f) => Object.fromEntries(comunes.map((c) => [c, limpiar[c] ? limpiar[c](f[c]) : f[c]])));
    for (let i = 0; i < limpias.length; i += 400) await sql`insert into public.${sql(t)} ${sql(limpias.slice(i, i + 400), comunes)}`;
    cuenta[t] = filas.length;
  }
  await sql.unsafe(`set session_replication_role = origin`);
  return cuenta;
}

let pila = null, hijo = null, nav = null;
const parar = async () => {
  try { await nav?.close(); } catch {}
  try { if (hijo) matarArbol(hijo.pid); } catch {}
  try { await pila?.parar(); } catch {}
};
process.on('SIGINT', async () => { console.log('\nCerrando y borrando la base de prueba…'); await parar(); process.exit(0); });

try {
  console.log('1/5 · Base local de usar y tirar (127.0.0.1) con todas las migraciones…');
  pila = await arrancar();
  const { sql, url, anonKey } = pila;
  console.log('2/5 · Copia del real, en solo lectura…');
  const real = conectar(URL_REAL);
  try {
    let cuenta;
    try { await real.begin('read only', async (tx) => { cuenta = await copiarDelReal(tx, sql); throw new Error('__fin__'); }); } catch (e) { if (e.message !== '__fin__') throw e; }
    console.log(`      ${Object.entries(cuenta).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  } finally { await real.end(); }

  console.log('3/5 · Cuentas de prueba, puntuación de las jornadas jugadas y mánagers de demostración…');
  const SERVICIO = await pila.firmar({ role: 'service_role' }, 30 * 24 * 3600);
  const rpc = async (f, a, token) => {
    const r = await fetch(`${url}/rest/v1/rpc/${f}`, { method: 'POST', headers: { apikey: anonKey, authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(a ?? {}) });
    const d = await r.json().catch(() => null);
    if (r.status >= 400) throw new Error(`${f}: ${d?.message ?? r.status}`);
    return d;
  };
  const puntuar = async () => { const hechas = []; for (const { fecha } of await rpc('fantasy_pendientes', {}, SERVICIO)) { const c = cerrarJornada(await rpc('fantasy_datos_jornada', { p_fecha: fecha }, SERVICIO)); await rpc('fantasy_guardar_jornada', { p: c.guardar }, SERVICIO); hechas.push({ fecha, c }); } return hechas; };
  for (const [pid, nombre] of GESTORES) {
    const uid = await pila.crearUsuario(correo(pid), 'x');
    await sql`insert into public.gestores (user_id, nombre, email) values (${uid}, ${nombre}, ${correo(pid)}) on conflict do nothing`;
  }
  const primeras = await puntuar();
  const sinCasar = [...new Set(primeras.flatMap((x) => x.c.sinCasar))], aprox = [...new Set(primeras.flatMap((x) => x.c.aproximados))];
  console.log(`      Jornadas puntuadas: ${primeras.map((x) => x.fecha).join(', ') || 'ninguna'}. Nombres sin casar: ${sinCasar.length ? sinCasar.join('; ') : 'ninguno'}${aprox.length ? `. Casados por aproximación: ${aprox.join('; ')}` : ''}.`);
  if (!args.includes('--apagado')) await sql`update public.fantasy_config set modo = 'todos', cambiado_por_nombre = 'fantasy:probar'`;

  if (N_MANAGERS > 0 && !args.includes('--apagado')) {
    const candidatos = (await sql`select person_id from public.jugadores where activo and rol in ('jugador', 'entrenador') order by (person_id = any(${GESTORES.map((g) => g[0])})) desc, person_id`).map((x) => x.person_id).slice(0, N_MANAGERS);
    for (const pid of candidatos) {
      const uid = (await sql`select id from auth.users where email = ${correo(pid)}`)[0]?.id ?? await pila.crearUsuario(correo(pid), 'x');
      await rpc('fantasy_alta', {}, await pila.firmar({ sub: uid, role: 'authenticated', email: correo(pid) }));
    }
    // Historia de demostración: como si se hubieran apuntado antes de la primera jornada con esa misma plantilla y alineación.
    const jugadas = (await sql`select fecha::text from public.fantasy_jornadas where puntuada_en is not null order by fecha`).map((x) => x.fecha);
    if (jugadas.length) {
      await sql`update public.fantasy_managers set alta_en = ${`${jugadas[0]}T00:00:00Z`}::timestamptz - interval '3 days'`;
      await sql`insert into public.fantasy_alineaciones (manager, jornada, titulares, capitan, vice)
                select manager, ${jugadas[0]}::date, titulares, capitan, vice from public.fantasy_alineaciones on conflict do nothing`;
      await sql`insert into public.fantasy_porras (manager, jornada, equipo, pronostico)
                select m.person_id, e.fecha, e.equipo, case when (hashtext(m.person_id || e.equipo || e.fecha::text) % 4) = 0 then 'pierde' else 'gana' end
                from public.fantasy_managers m cross join public.eventos e where e.tipo = 'liga' and e.fecha = any(${jugadas}::date[]) and e.equipo in ('MdA', 'MdL') and e.estado = 'programado' and e.borrado_en is null
                on conflict do nothing`;
      await sql`update public.fantasy_jornadas set huella = null`;
      await puntuar();
      // en la jornada en juego, el capitan no puede ser el de la ultima: se intercambia con el vice
      await sql`update public.fantasy_alineaciones a set capitan = a.vice, vice = a.capitan
                where a.jornada = public._fantasy_jornada_actual() and a.vice is not null
                  and a.capitan = (select b.capitan from public.fantasy_alineaciones b where b.manager = a.manager and b.jornada < a.jornada order by b.jornada desc limit 1)`;
    }
    console.log(`      ${candidatos.length} mánagers de demostración (con historia simulada desde la primera jornada).`);
  }

  console.log('4/5 · Compilando y arrancando la web (uno o dos minutos la primera vez)…');
  const NEXT = path.join(RAIZ, 'node_modules', 'next', 'dist', 'bin', 'next');
  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey, SUPABASE_SERVICE_ROLE_KEY: SERVICIO, VAPID_PRIVATE_KEY: '', AVISOS_SECRETO: '', SUPABASE_DB_URL: '', PRUEBAS_CALENDARIO: '' };
  delete env.PRUEBAS_CALENDARIO;
  fs.rmSync(path.join(RAIZ, '.next', 'huella-pruebas.json'), { force: true });   // esta compilación no es la de las suites
  execFileSync(process.execPath, [NEXT, 'build'], { cwd: RAIZ, env, stdio: 'pipe', maxBuffer: 1e8, windowsHide: true });
  hijo = lanzar(process.execPath, [NEXT, 'start', '-p', String(PUERTOS.app), '-H', '127.0.0.1'], { cwd: RAIZ, env, stdio: 'ignore' });
  const APP = `http://127.0.0.1:${PUERTOS.app}`;
  await esperar(APP);

  console.log(`5/5 · Listo: ${APP}/mdfantasy`);
  console.log(`\n  Para entrar a mano: ${APP}/entrar con <person_id>@pruebas.local (p. ej. ${correo(GESTORES[0][0])}).`);
  console.log('  El código de 6 cifras no llega por correo: sale aquí abajo en cuanto lo pidas.\n');
  let vistos = new Set();
  setInterval(async () => {
    try { for (const c of await sql`select email, codigo from public._otp_pruebas`) { const k = `${c.email}:${c.codigo}`; if (!vistos.has(k)) { vistos.add(k); console.log(`  Código para ${c.email}: ${c.codigo}`); } } } catch {}
  }, 1500).unref?.();

  if (!args.includes('--sin-ventanas')) {
    const { chromium } = await import('playwright');
    nav = await chromium.launch({ channel: 'chrome', headless: false });
    const otro = (await sql`select person_id from public.fantasy_managers where person_id <> all(${GESTORES.map((g) => g[0])}) order by person_id limit 1`)[0]?.person_id
      ?? (await sql`select person_id from public.jugadores where activo and rol = 'jugador' and person_id <> all(${GESTORES.map((g) => g[0])}) order by person_id limit 1`)[0].person_id;
    for (const [pid, ancho] of [[GESTORES[0][0], 430], [otro, 430]]) {
      const ctx = await nav.newContext({ viewport: { width: ancho, height: 900 } });
      const p = await ctx.newPage();
      await p.goto(`${APP}/entrar`);
      await p.getByLabel('Tu correo').fill(correo(pid));
      await p.getByRole('button', { name: 'Enviarme el código' }).click();
      await p.getByText('Código enviado a').waitFor({ timeout: 15000 });
      const [{ codigo }] = await sql`select codigo from public._otp_pruebas where email = ${correo(pid)}`;
      await p.getByLabel('Código del correo').fill(codigo);
      await p.getByRole('button', { name: 'Entrar', exact: true }).click();
      await p.waitForURL((u) => !u.pathname.startsWith('/entrar'), { timeout: 20000 });
      await p.goto(`${APP}/mdfantasy`);
      console.log(`  Ventana abierta como ${pid}${pid === GESTORES[0][0] ? ' (gestor)' : ' (jugador)'}.`);
    }
  }
  console.log('\n  Ctrl+C para cerrar y borrarlo todo.');
  await new Promise(() => {});
} catch (e) {
  console.error(`\nNo se pudo preparar: ${e.stack ?? e}`);
  if (e.stdout) console.error(String(e.stdout).slice(-3000), String(e.stderr ?? '').slice(-2000));
  await parar();
  process.exit(1);
}
