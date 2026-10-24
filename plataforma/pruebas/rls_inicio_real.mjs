#!/usr/bin/env node
// Inicio y planes (D117-D122) CONTRA EL SUPABASE REAL, en SOLO LECTURA (D111, como pruebas:convocatoria-real). Se ejecuta
// ANTES (con --antes) y DESPUES de aplicar 20261024200000_inicio_y_planes. No crea ni borra cuentas ni escribe nada:
//   - anonimo por HTTPS con la clave publica;
//   - un jugador y un gestor con cuentas que YA existen, dentro de una transaccion READ ONLY que adopta su rol y claims
//     (lo que intente escribir falla o se deshace).
// Comprueba: anonimo no lee nada privado ni ejecuta ninguna funcion salvo calendario_personal (que con un enlace
// inventado no devuelve nada); el jugador no lee tableros, grupos sin publicar, hashes del calendario ni avisos de otros,
// ni crea planes en una transaccion de solo lectura; la vista publica no tiene planes; y el numero de cuentas de auth.
// Nunca imprime datos personales: solo recuentos.
//
//   npm run pruebas:inicio-real -- --antes      antes de aplicar la migracion
//   npm run pruebas:inicio-real                 despues
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { conectar } from '../scripts/db.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(RAIZ, '.env.local') });
const ANTES = process.argv.includes('--antes');
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const sql = conectar();
let fallos = 0;
const ok = (c, que, det = '') => { if (c) console.log(`  OK    ${que}`); else { fallos++; console.log(`  FALLO ${que}${det ? ` -> ${det}` : ''}`); } };
const NUEVAS = ['avisos_personales', 'calendario_tokens', 'tablero_registro', 'grupos_repartos'];

async function api(ruta, { metodo = 'GET', cuerpo } = {}) {
  const r = await fetch(`${URL}/rest/v1${ruta}`, { method: metodo, headers: { apikey: ANON, authorization: `Bearer ${ANON}`, 'content-type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  let datos = null; try { datos = await r.json(); } catch {}
  return { status: r.status, datos };
}
const bloqueado = (r) => r.status === 401 || r.status === 403 || r.status === 404 || (Array.isArray(r.datos) && r.datos.length === 0);
async function como(userId, fn) {
  try {
    await sql.begin('read only', async (tx) => {
      await tx.unsafe('set local role authenticated');
      await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: 'authenticated' })}, true)`;
      await fn(tx);
      throw new Error('__deshacer__');
    });
  } catch (e) { if (e.message !== '__deshacer__') throw e; }
}
// Cada sonda en su savepoint: un «permiso denegado» (lo esperado) no aborta la transaccion de solo lectura.
const contar = (tx, t) => tx.savepoint((s) => s.unsafe(`select count(*)::int n from public.${t}`)).then((r) => r[0].n, () => -1);
const intento = async (tx, consulta) => { try { await tx.savepoint(async (s) => { await consulta(s); }); return 'hecho'; } catch (e) { return e.message; } };

try {
  console.log(`\n== Cuentas de auth (${ANTES ? 'antes' : 'después'})`);
  const [{ n: cuentas }] = await sql`select count(*)::int n from auth.users`;
  console.log(`  INFO  ${cuentas} cuentas en auth.users (tiene que salir igual antes y después)`);
  const migrada = (await sql`select count(*)::int n from supabase_migrations.schema_migrations where version = '20261024200000'`)[0].n === 1;
  ok(ANTES ? !migrada : migrada, ANTES ? 'la migración aún NO está aplicada' : 'la migración está aplicada');

  console.log('\n== Anónimo (HTTPS, clave pública)');
  for (const t of ['eventos', 'respuestas', 'jugadores_privado', 'convocatorias', ...(ANTES ? [] : NUEVAS), ...(ANTES ? [] : ['v_mi_agenda'])]) ok(bloqueado(await api(`/${t}?select=*&limit=1`)), `anónimo no lee ${t}`);
  const pub = await api('/v_eventos_publicos?select=clave&limit=500');
  ok(Array.isArray(pub.datos) && pub.datos.length > 0 && !pub.datos.some((x) => /^plan-/.test(x.clave)), `la vista pública responde (${pub.datos?.length} eventos) y no tiene planes`);
  const anonFn = (await sql`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE') order by 1`).map((x) => x.proname);
  ok(JSON.stringify(anonFn) === JSON.stringify(ANTES ? [] : ['calendario_personal']), `anónimo solo ejecuta ${ANTES ? 'ninguna función' : 'calendario_personal (D120)'}`, anonFn.join(', '));
  if (!ANTES) {
    const r = await api('/rpc/calendario_personal', { metodo: 'POST', cuerpo: { p_token: 'x'.repeat(43) } });
    ok(r.status === 200 && r.datos === null, 'calendario_personal con un enlace inventado: nada (null)');
    ok((await api('/rpc/crear_plan', { metodo: 'POST', cuerpo: { p: {} } })).status >= 400, 'anónimo no crea planes');
    ok((await api('/rpc/tablero_responder', { metodo: 'POST', cuerpo: { p_evento: '00000000-0000-0000-0000-000000000000', p_personas: [], p_respuesta: 'va' } })).status >= 400, 'ni usa el tablero');
  }

  console.log('\n== Un jugador (cuenta existente, transacción de solo lectura)');
  const [jug] = await sql`select u.id from auth.users u join public.jugadores j on lower(j.email) = lower(u.email)
                          where not exists (select 1 from public.gestores g where g.user_id = u.id) and j.activo order by u.created_at limit 1`;
  const [ges] = await sql`select g.user_id as id from public.gestores g where g.user_id is not null order by g.user_id limit 1`;
  ok(Boolean(jug?.id) && Boolean(ges?.id), 'hay un jugador y un gestor con cuenta para la prueba');
  await como(jug.id, async (tx) => {
    for (const t of ['jugadores_privado', 'convocatorias', ...(ANTES ? [] : NUEVAS.filter((x) => x !== 'avisos_personales'))]) {
      const n = await contar(tx, t);
      ok(n === 0 || n === -1, `el jugador no lee ${t} (${n === -1 ? 'sin permiso' : '0 filas'})`);
    }
    const [{ n: ev }] = await tx`select count(*)::int n from public.v_mis_eventos`;
    ok(ev > 0, `v_mis_eventos sigue respondiendo para el jugador (${ev} eventos suyos)`);
    if (!ANTES) {
      const [{ n: ag }] = await tx`select count(*)::int n from public.v_mi_agenda`;
      ok(ag > 0, `v_mi_agenda responde (${ag} eventos suyos)`);
      const [{ n: av }] = await tx`select count(*)::int n from public.avisos_personales where person_id <> public._mi_person_id()`;
      ok(av === 0, 'no lee avisos de otros');
      const g = (await tx`select public.mis_grupos() as g`)[0].g;
      ok(Array.isArray(g) && !JSON.stringify(g).match(/nivel|explica/), 'mis_grupos: solo lo suyo (sin niveles ni criterio)');
      ok(/solo_gestores/.test(await intento(tx, (s) => s`select public.tablero_responder('00000000-0000-0000-0000-000000000000'::uuid, array['x'], 'va')`)), 'tablero_responder: solo gestores');
      ok(/solo_gestores/.test(await intento(tx, (s) => s`select public.hacer_oficial('00000000-0000-0000-0000-000000000000'::uuid)`)), 'hacer_oficial: solo gestores');
      ok(/read-only|solo lectura|sin_ficha|fecha/i.test(await intento(tx, (s) => s`select public.crear_plan(${{ tipo: 'quedada', titulo: 'Prueba', fecha: '2026-12-31', inicio: '20:00' }}::jsonb)`)), 'crear un plan en una transacción de solo lectura no escribe nada');
      const tok = await contar(tx, 'calendario_tokens');
      ok(tok <= 0, 'no lee los hashes del calendario');
    }
  });

  console.log('\n== Un gestor (cuenta existente, transacción de solo lectura)');
  await como(ges.id, async (tx) => {
    const [{ n: ev }] = await tx`select count(*)::int n from public.eventos`;
    ok(ev > 0, `el gestor lee los eventos (${ev})`);
    if (!ANTES) {
      const [{ n: pl }] = await tx`select count(*)::int n from public.eventos where not oficial`;
      ok(pl >= 0, `planes no oficiales en el real: ${pl}`);
      for (const t of ['tablero_registro', 'grupos_repartos']) {
        const [{ n }] = await tx.unsafe(`select count(*)::int n from public.${t}`);
        ok(n >= 0, `el gestor lee ${t} (${n})`);
      }
      const [{ n: pistas }] = await tx`select count(*)::int n from public.pistas where lat is not null`;
      ok(pistas === 3, 'las tres pistas con coordenadas');
    }
  });
  const [{ n: cuentas2 }] = await sql`select count(*)::int n from auth.users`;
  ok(cuentas2 === cuentas, `cuentas de auth sin cambios durante la prueba (${cuentas2})`);
} catch (e) { console.error(e); fallos++; } finally {
  await sql.end();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTODO OK');
process.exit(fallos ? 1 : 0);
