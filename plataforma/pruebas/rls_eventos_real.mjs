#!/usr/bin/env node
// RLS de eventos, pistas, respuestas, ausencias, importaciones y asistencia CONTRA EL SUPABASE
// REAL, en SOLO LECTURA (D94, mitigacion 5). Desde el paso 3 (D99) cada jugador lee sus propias respuestas y ausencias,
// nunca las de otro. No crea ni borra cuentas ni escribe nada:
//   - anonimo: por HTTPS con la clave publica, como cualquiera en internet;
//   - jugador y gestor: con las cuentas que YA existen, dentro de una transaccion READ ONLY que adopta el rol
//     `authenticated` y los claims de esa cuenta (lo mismo que hace PostgREST), y se deshace al final.
// Para comprobar la ESCRITURA sin escribir, se intenta cada insert/update/delete dentro de la transaccion de solo
// lectura: Postgres lo rechaza siempre; ademas se comprueban los permisos (has_table_privilege) y las politicas.
//
// D172 (migración 20261102200000): antes de aplicarla siguen diccionario_sporteasy y las columnas sporteasy_*; después,
// ya no existen. La prueba mira si está aplicada y comprueba lo que toca (sirve antes y después, D111).
//
// BACKLOG 24 (D201): ningún recuento escrito en el código. Lo esperado se calcula de la base en ese momento (lo público
// = los eventos oficiales y no borrados) y cada evento público cumple las reglas de infra/reglas_real.mjs. Lo que ve una
// cuenta se compara con la base en LA MISMA foto (transacción repeatable read): que el club cree un evento o un plan
// mientras corre no la hace fallar. `pruebas:real-mutaciones` demuestra en la pila local que sigue detectando errores.
//
//   npm run pruebas:eventos-real

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { conectar } from '../scripts/db.mjs';
import { problemasEventoPublico, jornadasRepetidas, problemasDescansos, huecosJornadas } from './infra/reglas_real.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(RAIZ, '.env.local') });
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sql = conectar();
let fallos = 0;
const ok = (c, que, det = '') => { if (c) console.log(`  OK    ${que}`); else { fallos++; console.log(`  FALLO ${que}${det ? ` -> ${det}` : ''}`); } };
const PRIVADAS = ['eventos', 'pistas', 'descansos', 'respuestas', 'ausencias_periodo', 'importaciones', 'asistencia_resumen', 'asistencia_motivos'];
// Paso 3 (D99): de estas, el jugador lee SOLO las suyas; del resto, nada.
const SUYAS = ['respuestas', 'ausencias_periodo'];
const COLUMNAS_PRIVADAS = ['id', 'origen', 'serie', 'sporteasy_estado', 'sporteasy_cambio', 'sporteasy_copiado_en', 'creado_en', 'actualizado_en', 'pista_id', 'person_id', 'respuesta', 'motivo', 'detalle'];

async function api(ruta, { metodo = 'GET', cuerpo } = {}) {
  const r = await fetch(`${URL}/rest/v1${ruta}`, { method: metodo, headers: { apikey: ANON, authorization: `Bearer ${ANON}`, 'content-type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  let datos = null; try { datos = await r.json(); } catch {}
  return { status: r.status, datos };
}
const bloqueado = (r) => r.status === 401 || r.status === 403 || r.status === 404 || (Array.isArray(r.datos) && r.datos.length === 0);

/** Ejecuta `fn(tx, base)` como `authenticated` con los claims de una cuenta, en una transaccion de SOLO LECTURA que se
 *  deshace. Antes, `antes(tx)` lee con el rol de la conexión en la MISMA foto (repeatable read): `base` es lo que hay de
 *  verdad en ese instante, para compararlo sin carreras con lo que ve la cuenta. */
async function como(userId, fn, antes = async () => null) {
  try {
    await sql.begin('isolation level repeatable read read only', async (tx) => {
      const base = await antes(tx);
      ok((await tx`show transaction_read_only`)[0].transaction_read_only === 'on', 'la transacción es de solo lectura');
      await tx.unsafe('set local role authenticated');
      await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: 'authenticated' })}, true)`;
      await fn(tx, base);
      throw new Error('__deshacer__');
    });
  } catch (e) { if (e.message !== '__deshacer__') throw e; }
}
/** La API anónima frente a la base, de un mismo momento: si la base cambia mientras se lee la API (el club crea un evento
 *  justo entonces), se repite (hasta tres veces). */
async function estable(leerBase, leerApi) {
  for (let i = 0; ; i++) {
    const b0 = await leerBase();
    const r = await leerApi();
    const b1 = await leerBase();
    if (JSON.stringify(b0) === JSON.stringify(b1) || i === 2) return { base: b1, api: r };
  }
}
const intenta = async (tx, texto) => {
  try { await tx.savepoint(async (sp) => { await sp.unsafe(texto); }); return 'permitido'; } catch (e) { return `rechazado: ${e.message}`; }
};

try {
  console.log('\n== Anónimo (HTTPS, clave pública)');
  for (const t of PRIVADAS) ok(bloqueado(await api(`/${t}?select=*`)), `anónimo NO lee ${t}`);
  for (const t of PRIVADAS) ok((await api(`/${t}`, { metodo: 'POST', cuerpo: {} })).status >= 400, `anónimo NO escribe en ${t}`);
  // Lo que debe salir en lo público, calculado AHORA de la tabla (los eventos oficiales y no borrados), y lo que nunca.
  const { base: vis, api: pub } = await estable(
    async () => (await sql`select clave, (oficial and borrado_en is null) publico from public.eventos order by clave`).map((r) => `${r.clave}|${r.publico}`),
    () => api('/v_eventos_publicos?select=*&limit=10000'));
  const deben = new Set(vis.filter((x) => x.endsWith('|true')).map((x) => x.split('|')[0]));
  const nunca = new Set(vis.filter((x) => x.endsWith('|false')).map((x) => x.split('|')[0]));
  const publicos = Array.isArray(pub.datos) ? pub.datos : [];
  const claves = publicos.map((f) => f.clave);
  const sobran = claves.filter((c) => !deben.has(c)), faltan = [...deben].filter((c) => !claves.includes(c));
  ok(pub.status === 200 && claves.length > 0 && !sobran.length && !faltan.length, `anónimo lee la vista pública: los ${deben.size} eventos oficiales y vivos que hay ahora en la base, ni uno más ni uno menos`, `HTTP ${pub.status}, ${claves.length} filas; sobran ${sobran.length}, faltan ${faltan.length} ${[...sobran, ...faltan].slice(0, 3).join(' ')}`);
  const colados = claves.filter((c) => nunca.has(c));
  ok(!colados.length, `ningún plan sin hacer oficial ni evento borrado (${nunca.size} en la base) sale en lo público`, colados.slice(0, 3).join(' '));
  ok(new Set(claves).size === claves.length, 'ninguna clave repetida en lo público (una pista de serie de más duplicaría filas)');
  const malos = publicos.flatMap((e) => problemasEventoPublico(e).map((x) => `${e.clave}: ${x}`));
  ok(!malos.length, 'cada evento público tiene sus campos obligatorios y válidos (fecha en su temporada; tipo, equipo y estado; liga con jornada, rival y local; inicio antes que fin)', malos.slice(0, 4).join(' · '));
  const rep = jornadasRepetidas(publicos);
  ok(!rep.length, 'ningún equipo tiene dos partidos de liga públicos en la misma jornada', rep.slice(0, 3).join(' · '));
  const cols = Object.keys(publicos[0] ?? {});
  ok(cols.length > 0 && !cols.some((c) => COLUMNAS_PRIVADAS.includes(c)), `la vista pública no trae columnas privadas (${cols.join(', ')})`);
  ok(!JSON.stringify(publicos.map((f) => Object.values(f))).match(/@|sporteasy|motivo|lesi/i), 'ningún valor de la vista pública es un correo, ni habla de SportEasy, motivos o lesiones');
  // Revisión de seguridad (20261103210000): sin «notas» (las escribe un gestor a mano). Vale antes y después de aplicarla.
  const sinNotas = (await sql`select 1 from supabase_migrations.schema_migrations where version = '20261103210000'`).length === 1;
  ok(sinNotas ? !cols.includes('notas') && (await api('/v_eventos_publicos?select=notas&limit=1')).status >= 400 : cols.includes('notas'),
    sinNotas ? 'la vista pública ya no trae «notas» (20261103210000 aplicada)' : 'la vista pública aún trae «notas» (20261103210000 sin aplicar)');
  const { base: nDesc, api: dp } = await estable(async () => (await sql`select count(*)::int n from public.descansos`)[0].n, () => api('/v_descansos_publicos?select=*'));
  ok(dp.status === 200 && dp.datos.length === nDesc, `anónimo lee los descansos: los ${nDesc} de la base`, `HTTP ${dp.status}, ${dp.datos?.length}`);
  const mDesc = problemasDescansos(Array.isArray(dp.datos) ? dp.datos : [], publicos);
  ok(!mDesc.length, 'cada descanso está bien formado y ese equipo no tiene partido esa jornada ni ese día', mDesc.slice(0, 3).join(' · '));
  const huecos = huecosJornadas(publicos, Array.isArray(dp.datos) ? dp.datos : []);
  ok(!huecos.length, 'el calendario de liga público está entero: por equipo, partidos y descansos cubren las jornadas 1…N sin huecos', huecos.slice(0, 3).join(' · '));
  ok((await api('/v_eventos_publicos', { metodo: 'POST', cuerpo: {} })).status >= 400, 'la vista pública no admite escritura');
  const { base: nSerie, api: ph } = await estable(async () => (await sql`select count(*)::int n from public.pistas where es_de_serie and uso = 'entreno'`)[0].n, () => api('/v_pista_habitual_publica?select=*'));
  ok(ph.status === 200 && ph.datos.length === nSerie && nSerie <= 1 && ph.datos.every((x) => Object.keys(x).sort().join() === 'estado,nombre,nombre_corto'),
    `anónimo lee la pista habitual: la de la base (${nSerie}, como mucho una), solo nombre y estado, sin dirección`, JSON.stringify(ph.datos));

  console.log('\n== Permisos y políticas en la base real');
  for (const t of PRIVADAS) {
    const [p] = await sql`select has_table_privilege('anon', ${'public.' + t}, 'select') a_sel, has_table_privilege('anon', ${'public.' + t}, 'insert') a_ins,
                                 has_table_privilege('authenticated', ${'public.' + t}, 'delete') u_del, has_table_privilege('authenticated', ${'public.' + t}, 'truncate') u_trunc,
                                 (select relrowsecurity from pg_class where oid = ${'public.' + t}::regclass) rls`;
    ok(!p.a_sel && !p.a_ins && !p.u_del && !p.u_trunc && p.rls, `${t}: RLS activa; anon sin permisos; authenticated sin DELETE ni TRUNCATE`);
  }
  const pol = await sql`select tablename, cmd, qual, with_check from pg_policies where schemaname = 'public' and tablename = any(${PRIVADAS})`;
  // Paso 3 (D99): además, el jugador LEE sus propias respuestas y ausencias (solo SELECT y solo las suyas).
  const deJugador = (p) => p.cmd === 'SELECT' && ['respuestas', 'ausencias_periodo'].includes(p.tablename) && /_mi_person_id\(\)/.test(p.qual ?? '');
  ok(pol.every((p) => /is_gestor\(\)/.test(`${p.qual ?? ''}${p.with_check ?? ''}`) || deJugador(p)), `las ${pol.length} políticas de las ${PRIVADAS.length} tablas exigen is_gestor() (salvo «el jugador lee lo suyo», solo lectura, D99)`);
  ok(!pol.some((p) => p.cmd === 'DELETE' || p.cmd === 'ALL'), 'ninguna política permite DELETE ni ALL');
  const [v] = await sql`select has_table_privilege('anon', 'public.v_eventos_publicos', 'select') a, has_table_privilege('anon', 'public.v_eventos_publicos', 'insert') i`;
  ok(v.a && !v.i, 'anon puede leer la vista pública y no escribirla');
  // D172 (migración 20261102200000): antes de aplicarla, el diccionario y las columnas siguen; después, ya NO existen.
  const d172 = (await sql`select count(*)::int n from supabase_migrations.schema_migrations where version = '20261102200000'`)[0].n === 1;
  const sinDic = (await sql`select to_regclass('public.diccionario_sporteasy') is null n`)[0].n;
  const colsSE = (await sql`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'eventos' and column_name like 'sporteasy%'`).map((x) => x.column_name);
  if (d172) {
    ok(sinDic, 'D172 aplicada: diccionario_sporteasy ya no existe');
    ok(colsSE.length === 0, 'D172 aplicada: eventos ya no tiene columnas sporteasy_*', colsSE.join(', '));
  } else {
    ok(!sinDic && colsSE.length === 3, 'D172 aún sin aplicar: siguen el diccionario y las 3 columnas sporteasy_* de eventos', colsSE.join(', '));
    const [dp] = await sql`select relrowsecurity r from pg_class where oid = 'public.diccionario_sporteasy'::regclass`;
    ok(dp.r && !(await sql`select has_table_privilege('anon', 'public.diccionario_sporteasy', 'select') a`)[0].a, 'D172 aún sin aplicar: el diccionario sigue con RLS y sin lectura para anon');
  }

  console.log('\n== Gestor (cuenta real existente, transacción de solo lectura)');
  const [gestor] = await sql`select user_id from public.gestores where user_id is not null limit 1`;
  ok(!!gestor, 'hay al menos un gestor con cuenta');
  // Lo esperado, de la base en la misma foto que lo que ve el gestor (antes de adoptar su rol).
  await como(gestor.user_id, async (tx, { N0, totalMotivos }) => {
    ok((await tx`select public.is_gestor() g`)[0].g === true, 'is_gestor() = true');
    for (const t of PRIVADAS) {
      const [{ n }] = await tx.unsafe(`select count(*)::int n from public.${t}`);
      ok(n >= 0, `el gestor lee ${t} (${n} filas)`);
    }
    ok((await tx`select count(*)::int n from public.eventos`)[0].n === N0, `el gestor ve los ${N0} eventos de la base (todos, también los planes)`);
    // Gestión → Asistencia lee asistencia_motivos, lo mismo que carga db:asistencia (D116); asistencia_resumen ya no se usa.
    const [{ n: nMot }] = await tx`select count(*)::int n from public.asistencia_motivos`;
    ok(nMot > 0 && nMot === totalMotivos, `el gestor lee toda asistencia_motivos, la fuente de Gestión → Asistencia (${nMot} filas; D116)`);
    ok((await intenta(tx, `delete from public.eventos`)).startsWith('rechazado'), 'el gestor NO puede borrar eventos');
    ok((await intenta(tx, `update public.asistencia_resumen set fueron = 0`)).startsWith('rechazado'), 'el gestor NO puede cambiar el resumen de asistencia');
  }, async (tx) => ({
    N0: (await tx`select count(*)::int n from public.eventos`)[0].n,
    totalMotivos: (await tx`select count(*)::int n from public.asistencia_motivos`)[0].n,
  }));

  console.log('\n== Jugador y no gestor (cuentas reales existentes, transacción de solo lectura)');
  // Primero los que tienen respuestas propias, para que «ve las suyas» se compruebe con filas de verdad.
  const jugadores = await sql`select u.id, j.person_id, (select count(*)::int from public.respuestas r where r.person_id = j.person_id) propias
    from auth.users u join public.jugadores j on lower(j.email) = lower(u.email) where j.activo
    and not exists (select 1 from public.gestores g where g.user_id = u.id) order by propias desc, j.person_id limit 2`;
  ok(jugadores.length > 0, `hay ${jugadores.length} jugador(es) sin rol de gestor con cuenta para probar`);
  ok(jugadores.some((j) => j.propias > 0), `al menos uno tiene respuestas propias en real (${jugadores.map((j) => j.propias).join(' y ')})`);
  for (const j of jugadores) {
    await como(j.id, async (tx, { suyas: deVerdad, publicos: nPub }) => {
      ok((await tx`select public.is_gestor() g`)[0].g === false, 'is_gestor() = false');
      for (const t of PRIVADAS) {
        const [{ n }] = await tx.unsafe(`select count(*)::int n from public.${t}`);
        if (!SUYAS.includes(t)) { ok(n === 0, `el jugador ve 0 filas de ${t}`); continue; }
        const [{ ajenas }] = await tx.unsafe(`select count(*)::int ajenas from public.${t} where person_id <> $1`, [j.person_id]);
        const suyas = deVerdad[t];
        ok(ajenas === 0 && n === suyas, `el jugador ve sus ${t} (${n} de ${suyas}) y ninguna de otro`, `ve ${n}, suyas ${suyas}, de otros ${ajenas}`);
      }
      ok((await tx`select count(*)::int n from public.v_eventos_publicos`)[0].n === nPub, `sí ve la vista pública: los ${nPub} eventos oficiales y vivos de la base`);
      ok((await intenta(tx, `insert into public.eventos (clave, tipo, equipo, fecha) values ('x', 'amistoso', 'MdA', '2026-11-01')`)).startsWith('rechazado'), 'el jugador NO puede crear eventos');
      ok((await intenta(tx, `insert into public.respuestas (evento_id, person_id, respuesta) select id, 'x', 'va' from public.eventos limit 1`)).startsWith('rechazado'), 'el jugador NO puede escribir respuestas');
    }, async (tx) => {
      const suyas = {};
      for (const t of SUYAS) suyas[t] = (await tx.unsafe(`select count(*)::int n from public.${t} where person_id = $1`, [j.person_id]))[0].n;
      return { suyas, publicos: (await tx`select count(*)::int n from public.eventos where oficial and borrado_en is null`)[0].n };
    });
  }
  console.log('\n== Sin efectos');
  // Que no se escribe lo garantizan las transacciones de solo lectura (comprobado en cada una) y que la API anónima
  // rechaza toda escritura. No se compara el número de eventos antes y después: el club puede crear uno mientras corre.
  const [{ u }] = await sql`select count(*)::int u from auth.users`;
  console.log(`  (${u} cuentas de auth; esta prueba no crea ni borra ninguna)`);
} finally {
  await sql.end();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
