#!/usr/bin/env node
// Pista «solo jugadores con ficha» (D148, nada retroactivo: solo desde el 04/11/2026) CONTRA EL SUPABASE REAL, en SOLO LECTURA (como pruebas:eventos-real). No crea
// ni borra cuentas ni escribe nada en la base. Nunca imprime niveles ni datos personales: solo recuentos y, de quien queda
// fuera por no tener ficha, el nombre visible (lo que ya ve un gestor).
//
//   npm run pruebas:solo-ficha-real -- --antes   guarda la foto de invitados y de la copia a SportEasy en privado/backups/
//                                                 (fuera de git; no pisa una foto que ya exista)
//   npm run pruebas:solo-ficha-real              la migración y los datos aplicados, y que solo cambia lo debido
//
// La foto se rehízo el 01/11/2026 con los datos reales de ese día (la del 29/10, de antes de D148, ya no servía: desde
// entonces la rutina B movió la J5 de MdA (15/11 → 20/12, su estado de copia cambia) y Fernando M. pasó de «solo entreno»
// a jugador con ficha (es invitado a los partidos). Con D148 ya aplicada, la foto nueva es el estado bueno: la suite
// comprueba que la regla sigue igual y que nadie más cambia. Si cambia la plantilla o un evento de verdad, se rehace la foto
// (borrar el fichero y `-- --antes`) y se dice en ESTADO por qué.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { conectar } from '../scripts/db.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(RAIZ, '.env.local') });
const FOTO = path.join(RAIZ, '..', 'privado', 'backups', '2026-11-01_solo_ficha_foto.json');
const NOTA = 'Iván: no se copia a SportEasy (29/10/2026)';
const ANTES = process.argv.includes('--antes');
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };

const sql = conectar();
const cuentas = async () => (await sql`select count(*)::int n from auth.users`)[0].n;
try {
  // Las cuentas se cuentan antes y después de ESTA ejecución (no contra la foto: entre la foto y hoy se han dado de alta
  // cuentas de verdad). La foto solo guarda su número de entonces, como dato.
  const auth0 = await cuentas();
  await sql.begin('read only', async (tx) => {
    const auth = (await tx`select count(*)::int n from auth.users`)[0].n;
    console.log(`  cuentas de auth.users: ${auth}`);
    const invitados = async () => (await tx`select e.clave, j.person_id, public._invitado(j.person_id, e.id) as inv from public.eventos e cross join public.jugadores j where e.borrado_en is null order by 1, 2`).map((r) => `${r.clave}|${r.person_id}|${r.inv}`);
    const copia = async () => Object.fromEntries((await tx`select clave, sporteasy_estado, sporteasy_cambio from public.eventos`).map((r) => [r.clave, `${r.sporteasy_estado}|${r.sporteasy_cambio ?? ''}`]));
    if (ANTES) {
      fs.mkdirSync(path.dirname(FOTO), { recursive: true });
      fs.writeFileSync(FOTO, JSON.stringify({ en: new Date().toISOString(), auth, invitados: await invitados(), copia: await copia() }), { flag: 'wx' });
      console.log(`  foto guardada: ${FOTO}`);
      return;
    }
    const foto = JSON.parse(fs.readFileSync(FOTO, 'utf8'));
    console.log('\n== Migración');
    ok((await tx`select 1 from supabase_migrations.schema_migrations where version = '20261029100000'`).length === 1, 'registrada 20261029100000_pista_solo_con_ficha');
    ok((await tx`select 1 from supabase_migrations.schema_migrations where version = '20261029120000'`).length === 1, 'registrada 20261029120000_pista_desde (nada retroactivo)');
    const f = (await tx`select has_function_privilege('anon', 'public.solo_con_ficha_en(public.eventos)', 'execute') a,
                                has_function_privilege('authenticated', 'public.solo_con_ficha_en(public.eventos)', 'execute') u,
                                has_function_privilege('service_role', 'public.solo_con_ficha_en(public.eventos)', 'execute') s`)[0];
    ok(!f.a && f.u && f.s, 'solo_con_ficha_en: anon no la ejecuta; los gestores (authenticated) y la tarea de avisos (service_role), sí');
    console.log('\n== Datos');
    const [v] = await tx`select estado, solo_con_ficha, nota, habitual_desde::text hd, solo_con_ficha_desde::text sd from public.pistas where slug = 'valdebernardo'`;
    ok(v.estado === 'habitual' && v.solo_con_ficha && !/obras/i.test(v.nota ?? ''), 'Valdebernardo: habitual, solo con ficha, sin la nota de obras');
    ok(v.hd === '2026-11-04' && v.sd === '2026-11-04', 'Valdebernardo: habitual y «solo con ficha» desde el 04/11/2026');
    const rango = await tx`select e.clave, e.fecha::text f, e.inicio::text i, e.fin::text fi, e.pista_id, e.ubicacion_nombre, e.sporteasy_estado, e.sporteasy_cambio, public.solo_con_ficha_en(e) s
                           from public.eventos e where e.tipo = 'entreno' and e.oficial and e.borrado_en is null and e.estado = 'programado' and e.fecha between '2026-11-04' and '2027-05-05' order by e.fecha`;
    ok(rango.length === 23, `entrenos cambiados: ${rango.length} (${rango[0]?.f} … ${rango.at(-1)?.f})`);
    ok(rango.every((r) => r.i === '20:30:00' && r.fi === '22:30:00' && !r.pista_id && !r.ubicacion_nombre && r.s === 'Valdebernardo'), 'todos de 20:30 a 22:30 en Valdebernardo, «solo con ficha»');
    ok(rango.every((r) => r.sporteasy_estado === 'copiado' && r.sporteasy_cambio === NOTA), `todos cerrados con «${NOTA}»`);
    const ahora = await copia();
    const otros = Object.keys(foto.copia).filter((k) => !rango.some((r) => r.clave === k) && foto.copia[k] !== ahora[k]);
    ok(otros.length === 0, 'ningún otro evento cambia su estado de copia a SportEasy', otros.join(', '));
    console.log('\n== Invitados');
    const despues = await invitados();
    const antes = new Map(foto.invitados.map((x) => { const [c, p, i] = x.split('|'); return [`${c}|${p}`, i]; }));
    const cambian = despues.filter((x) => { const [c, p, i] = x.split('|'); return antes.get(`${c}|${p}`) !== i; });
    const sinFicha = (await tx`select person_id, nombre_visible from public.jugadores where activo and rol <> 'entrenador' and entrena and not ficha_mda and not ficha_mdl order by nombre_visible`);
    const ids = new Set(sinFicha.map((j) => j.person_id));
    const marcados = new Set((await tx`select clave from public.eventos e where public.solo_con_ficha_en(e) is not null`).map((r) => r.clave));
    ok(cambian.every((x) => { const [c, p, i] = x.split('|'); return ids.has(p) && marcados.has(c) && i === 'false'; }), `solo cambian los sin ficha en los entrenos de Valdebernardo: ${cambian.length} pares (${marcados.size} entrenos)`, cambian.slice(0, 4).join(' '));
    ok(!cambian.some((x) => !x.startsWith('entreno-')), 'los partidos y los demás eventos no cambian para nadie');
    console.log(`  fuera por no tener ficha (${sinFicha.length}): ${sinFicha.map((j) => j.nombre_visible).join(', ')}`);
    const pasados = [...marcados].filter((c) => !rango.some((r) => r.clave === c));
    ok(pasados.length === 0 && marcados.size === rango.length, `nada retroactivo: solo los ${rango.length} entrenos del rango tienen la regla`, pasados.join(', '));
    const fechaDe = new Map((await tx`select clave, fecha::text f from public.eventos`).map((r) => [r.clave, r.f]));
    const previos = despues.filter((x) => (fechaDe.get(x.split('|')[0]) ?? '9999') < '2026-11-04');
    ok(previos.length > 0 && previos.every((x) => { const [c, p, i] = x.split('|'); return antes.get(`${c}|${p}`) === i; }), `los invitados de todos los eventos anteriores al 04/11 son los de la foto previa (${previos.length} pares)`);
    const pub = await tx`select clave, pista_nombre, pista_por_confirmar, ubicacion_nombre from public.v_eventos_publicos where tipo = 'entreno' and fecha < '2026-11-04' order by fecha`;
    console.log(`  entrenos anteriores al 04/11 (lo público): ${pub.map((r) => `${r.clave.slice(-5)} ${r.ubicacion_nombre ?? (r.pista_por_confirmar ? 'Pista por confirmar' : r.pista_nombre)}`).join(' · ')}`);
    ok(pub.every((r) => !(r.pista_nombre ?? '').startsWith('Valdebernardo')), 'ninguno anterior al 04/11 sale en Valdebernardo');
    console.log('\n== Un jugador (con su cuenta, rol authenticated)');
    const [jug] = await tx`select j.person_id, u.id from public.jugadores j join auth.users u on lower(u.email) = lower(j.email) where j.ficha_mda and j.activo and not exists (select 1 from public.gestores g where g.user_id = u.id) limit 1`;
    await tx.unsafe(`set local role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ sub: jug.id, role: 'authenticated' })}', true);`);
    ok((await tx`select count(*)::int n from public.pistas`)[0].n === 0, 'no lee las pistas (ni su marca)');
    ok((await tx`select count(*)::int n from public.eventos`)[0].n === 0, 'no lee la tabla de eventos (ni la columna calculada)');
    ok((await tx`select count(*)::int n from public.jugadores where person_id <> ${jug.person_id}`)[0].n === 0, 'no lee la ficha de otros jugadores (igual que antes)');
    await tx.unsafe('reset role');
  });
  if (!ANTES) { const auth1 = await cuentas(); ok(auth1 === auth0, `no se ha creado ni borrado ninguna cuenta (${auth0} antes y ${auth1} después)`); }
} catch (e) {
  console.log(`  FALLO ${e.message}`); fallos++;
} finally {
  await sql.end();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
