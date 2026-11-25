#!/usr/bin/env node
// Pista «solo jugadores con ficha» (D148, nada retroactivo: solo desde el 04/11/2026) CONTRA EL SUPABASE REAL, en SOLO
// LECTURA (como pruebas:eventos-real). No crea ni borra cuentas ni escribe nada en la base. Nunca imprime niveles ni datos
// personales: solo recuentos, claves de evento y, de quien queda fuera por no tener ficha, el nombre visible (lo que ya
// ve un gestor).
//
//   npm run pruebas:solo-ficha-real
//
// BACKLOG 24 (D201): ya no compara con la foto de invitados del 01/11 (privado/backups/2026-11-01_solo_ficha_foto.json),
// que fallaba con cada evento o plan nuevo. Comprueba la regla contra los datos de ahora, todo en una misma foto de la
// base (transacción repeatable read):
//   - qué entrenos llevan la marca: se recalcula aparte con las pistas (pista propia con la marca, o sin pista ni
//     ubicación libre y la habitual de serie con la marca), desde su fecha, y se compara con solo_con_ficha_en;
//   - quién está invitado: para CADA evento y CADA jugador, public._invitado frente a la regla escrita aparte en
//     infra/reglas_real.mjs (sin ficha y entrena: fuera de los entrenos marcados y dentro de los demás; los partidos y
//     los planes, como siempre);
//   - nada retroactivo: ninguna pista con la marca desde antes del 04/11/2026, ningún evento marcado antes de esa fecha y
//     ningún entreno público anterior a que la pista de serie fuera habitual sale en ella.
// `pruebas:real-mutaciones` demuestra en la pila local que detecta una regla rota (un sin ficha invitado, una marca
// retroactiva).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { conectar } from '../scripts/db.mjs';
import { invitadoEsperado } from './infra/reglas_real.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(RAIZ, '.env.local') });
const DESDE_D148 = '2026-11-04';   // D148: nada retroactivo
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };
const txt = (f) => (f instanceof Date ? f.toISOString().slice(0, 10) : f ? String(f).slice(0, 10) : null);

const sql = conectar();
const cuentas = async () => (await sql`select count(*)::int n from auth.users`)[0].n;
try {
  const auth0 = await cuentas();
  await sql.begin('isolation level repeatable read read only', async (tx) => {
    console.log(`  cuentas de auth.users: ${auth0}`);
    ok((await tx`show transaction_read_only`)[0].transaction_read_only === 'on', 'la transacción es de solo lectura');
    console.log('\n== Migración');
    ok((await tx`select 1 from supabase_migrations.schema_migrations where version = '20261029100000'`).length === 1, 'registrada 20261029100000_pista_solo_con_ficha');
    ok((await tx`select 1 from supabase_migrations.schema_migrations where version = '20261029120000'`).length === 1, 'registrada 20261029120000_pista_desde (nada retroactivo)');
    const f = (await tx`select has_function_privilege('anon', 'public.solo_con_ficha_en(public.eventos)', 'execute') a,
                                has_function_privilege('authenticated', 'public.solo_con_ficha_en(public.eventos)', 'execute') u,
                                has_function_privilege('service_role', 'public.solo_con_ficha_en(public.eventos)', 'execute') s`)[0];
    ok(!f.a && f.u && f.s, 'solo_con_ficha_en: anon no la ejecuta; los gestores (authenticated) y la tarea de avisos (service_role), sí');
    const colsSE = (await tx`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'eventos' and column_name like 'sporteasy%'`).map((r) => r.column_name);
    const d172 = (await tx`select count(*)::int n from supabase_migrations.schema_migrations where version = '20261102200000'`)[0].n === 1;
    ok(d172 ? colsSE.length === 0 : colsSE.length === 3, d172 ? 'D172 aplicada: los eventos ya no llevan el estado de copia a SportEasy' : 'D172 aún sin aplicar: siguen las 3 columnas sporteasy_* de los eventos', colsSE.join(', '));

    console.log('\n== Pistas con la marca');
    const pistas = await tx`select id, slug, nombre, estado, es_de_serie, uso, solo_con_ficha, habitual_desde::text hd, solo_con_ficha_desde::text sd from public.pistas`;
    const conMarca = pistas.filter((p) => p.solo_con_ficha);
    console.log(`  ${conMarca.map((p) => `${p.slug}: ${p.estado}, solo con ficha desde ${p.sd ?? '—'}${p.hd ? `, habitual desde ${p.hd}` : ''}`).join(' · ') || '(ninguna pista con la marca)'}`);
    const retro = conMarca.filter((p) => !p.sd || p.sd < DESDE_D148);
    ok(!retro.length, `toda pista «solo con ficha» lo es desde una fecha, y no antes del ${DESDE_D148} (nada retroactivo)`, retro.map((p) => `${p.slug} ${p.sd ?? 'sin fecha'}`).join(', '));

    console.log('\n== Entrenos con la marca');
    const eventos = await tx`select e.id, e.clave, e.tipo, e.equipo, e.oficial, e.fecha::text fecha, e.pista_id, e.ubicacion_nombre, public.solo_con_ficha_en(e) marca
                             from public.eventos e where e.borrado_en is null order by e.fecha, e.clave`;
    const serie = pistas.find((p) => p.es_de_serie && p.uso === 'entreno' && p.estado === 'habitual');
    const vale = (p, fecha) => p && p.solo_con_ficha && fecha >= (p.sd ?? fecha);
    const esperada = (e) => e.tipo === 'entreno' && e.oficial && (
      e.pista_id ? vale(pistas.find((p) => p.id === e.pista_id), e.fecha)
        : !(e.ubicacion_nombre ?? '') && vale(serie, e.fecha) && e.fecha >= (serie.hd ?? e.fecha));
    const marcados = eventos.filter((e) => e.marca !== null);
    const discrepan = eventos.filter((e) => (e.marca !== null) !== Boolean(esperada(e)));
    ok(!discrepan.length, `solo_con_ficha_en marca justo los entrenos oficiales en una pista con la marca desde su fecha: ${marcados.length} (${marcados[0]?.fecha ?? '—'} … ${marcados.at(-1)?.fecha ?? '—'})`,
      discrepan.slice(0, 4).map((e) => `${e.clave} ${e.marca === null ? 'sin marca' : 'con marca'}`).join(', '));
    ok(marcados.every((e) => e.tipo === 'entreno' && e.oficial && e.fecha >= DESDE_D148), `la marca solo está en entrenos oficiales desde el ${DESDE_D148}: ni partidos, ni planes, ni nada anterior`,
      marcados.filter((e) => !(e.tipo === 'entreno' && e.oficial && e.fecha >= DESDE_D148)).slice(0, 4).map((e) => e.clave).join(', '));

    console.log('\n== Invitados (cada evento por cada jugador, la regla escrita aparte frente a public._invitado)');
    const jugadores = await tx`select person_id, nombre_visible, activo, rol, entrena, ficha_mda, ficha_mdl from public.jugadores order by person_id`;
    const inv = await tx`select e.id, j.person_id, public._invitado(j.person_id, e.id) inv from public.eventos e cross join public.jugadores j where e.borrado_en is null`;
    const deBase = new Map(inv.map((r) => [`${r.id}|${r.person_id}`, r.inv]));
    const malos = new Map();
    let pares = 0;
    for (const e of eventos) {
      for (const j of jugadores) {
        pares++;
        if (deBase.get(`${e.id}|${j.person_id}`) !== invitadoEsperado(j, e, e.marca !== null)) malos.set(e.clave, (malos.get(e.clave) ?? 0) + 1);
      }
    }
    ok(pares > 0 && !malos.size, `public._invitado cumple la regla en los ${pares} pares (${eventos.length} eventos × ${jugadores.length} jugadores)`, [...malos].slice(0, 4).map(([c, n]) => `${c} (${n} personas)`).join(', '));
    const sinFicha = jugadores.filter((j) => j.activo && j.rol !== 'entrenador' && j.entrena && !j.ficha_mda && !j.ficha_mdl);
    console.log(`  fuera por no tener ficha (${sinFicha.length}): ${sinFicha.map((j) => j.nombre_visible).sort((a, b) => a.localeCompare(b, 'es')).join(', ')}`);
    const dentro = marcados.flatMap((e) => sinFicha.filter((j) => deBase.get(`${e.id}|${j.person_id}`)).map(() => e.clave));
    ok(!dentro.length, `ningún jugador sin ficha está invitado a un entreno marcado (${sinFicha.length} × ${marcados.length})`, [...new Set(dentro)].slice(0, 4).join(', '));
    const libres = eventos.filter((e) => e.tipo === 'entreno' && e.oficial && e.marca === null);
    const fuera = libres.flatMap((e) => sinFicha.filter((j) => !deBase.get(`${e.id}|${j.person_id}`)).map(() => e.clave));
    ok(!fuera.length, `y sí lo están a los entrenos sin la marca (${libres.length} entrenos)`, [...new Set(fuera)].slice(0, 4).join(', '));

    console.log('\n== Nada retroactivo en lo público');
    if (!serie?.hd) console.log('  (la pista habitual de serie no tiene fecha de «habitual desde»: nada que comprobar)');
    else {
      const pub = await tx`select v.clave, v.fecha::text fecha, v.pista_nombre, e.pista_id from public.v_eventos_publicos v join public.eventos e on e.clave = v.clave where v.tipo = 'entreno' and v.fecha < ${serie.hd} order by v.fecha`;
      const mal = pub.filter((r) => r.pista_id !== serie.id && r.pista_nombre === serie.nombre);
      ok(!mal.length, `ningún entreno anterior al ${serie.hd} (${pub.length}) sale en ${serie.nombre} si no era su pista`, mal.slice(0, 4).map((r) => r.clave).join(', '));
    }

    console.log('\n== Un jugador (con su cuenta, rol authenticated)');
    const [jug] = await tx`select j.person_id, u.id from public.jugadores j join auth.users u on lower(u.email) = lower(j.email) where j.ficha_mda and j.activo and not exists (select 1 from public.gestores g where g.user_id = u.id) limit 1`;
    ok(Boolean(jug), 'hay un jugador con ficha y cuenta para probar');
    await tx.unsafe(`set local role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ sub: jug.id, role: 'authenticated' })}', true);`);
    ok((await tx`select count(*)::int n from public.pistas`)[0].n === 0, 'no lee las pistas (ni su marca)');
    ok((await tx`select count(*)::int n from public.eventos`)[0].n === 0, 'no lee la tabla de eventos (ni la columna calculada)');
    ok((await tx`select count(*)::int n from public.jugadores where person_id <> ${jug.person_id}`)[0].n === 0, 'no lee la ficha de otros jugadores (igual que antes)');
    await tx.unsafe('reset role');
  });
  const auth1 = await cuentas();
  ok(auth1 === auth0, `no se ha creado ni borrado ninguna cuenta (${auth0} antes y ${auth1} después)`);
} catch (e) {
  console.log(`  FALLO ${e.message}`); fallos++;
} finally {
  await sql.end();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
