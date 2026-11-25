#!/usr/bin/env node
// Las `-real` reescritas por propiedades (BACKLOG 24, D201) siguen detectando errores: se pasan CONTRA LA PILA LOCAL
// (Postgres + PostgREST con nuestras migraciones; nunca el real) y
//   1. con la base sana, salen en verde (con datos sintéticos que imitan los del club: un plan sin hacer oficial, un plan
//      hecho oficial con su clave plan-…, la pista habitual «solo con ficha» desde el 04/11/2026, un jugador sin ficha);
//   2. con un fallo metido a propósito (y quitado después), cada una sale en rojo, y por la comprobación que toca:
//      un plan privado visible en lo público, un partido con la temporada mal, un descanso el día de un partido, un
//      jugador que lee respuestas de otro, la pista habitual sin coordenadas, un sin ficha invitado a un entreno con la
//      marca y una marca retroactiva;
//   3. y al quitar cada fallo, vuelven al verde (los fallos no se pisan unos a otros).
// Los hijos se lanzan con SUPABASE_DB_URL y la API de la pila en el entorno (dotenv no pisa lo que ya está puesto) y de
// forma asíncrona: la pasarela de la pila corre en este proceso (con spawnSync no respondería). Solo se enseñan las
// líneas FALLO de los hijos: llevan claves de evento, nunca datos de personas.
//
//   npm run pruebas:real-mutaciones
// vigila: pruebas/rls_eventos_real.mjs
// vigila: pruebas/rls_inicio_real.mjs
// vigila: pruebas/solo_con_ficha_real.mjs
// vigila: pruebas/infra/reglas_real.mjs
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { arrancar } from './pila.mjs';
import { cargarEventos } from './infra/calendario.mjs';
import { sinteticos, personas } from './comun_e2e.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };
const SUITES = { eventos: 'rls_eventos_real.mjs', inicio: 'rls_inicio_real.mjs', ficha: 'solo_con_ficha_real.mjs' };

const pila = await arrancar();
const { sql } = pila;
if (!/127\.0\.0\.1|localhost/.test(pila.dbUrl) || !/127\.0\.0\.1|localhost/.test(pila.url)) throw new Error('la pila no es local: no se sigue');

/** Pasa una `-real` contra la pila: { codigo, fallos: [líneas FALLO] }. */
function pasar(nombre) {
  return new Promise((resolve) => {
    const hijo = spawn(process.execPath, [path.join(AQUI, SUITES[nombre])], {
      windowsHide: true,
      env: { ...process.env, SUPABASE_DB_URL: pila.dbUrl, NEXT_PUBLIC_SUPABASE_URL: pila.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: pila.anonKey },
    });
    let salida = '';
    hijo.stdout.on('data', (d) => { salida += d; });
    hijo.stderr.on('data', (d) => { salida += d; });
    hijo.on('close', (codigo) => resolve({ codigo, fallos: salida.split(/\r?\n/).filter((l) => /^\s*FALLO|Error/.test(l)).map((l) => l.trim()) }));
  });
}
async function enVerde(nombre, cuando) {
  const r = await pasar(nombre);
  ok(r.codigo === 0, `${SUITES[nombre]} en verde ${cuando}`, r.fallos.slice(0, 4).join(' | '));
}

try {
  console.log('\n== Datos sintéticos que imitan los del club');
  await cargarEventos(sql, { log: () => {} });
  await sinteticos(sql, [['sint-ana', 'Ana', true, false], ['sint-beto', 'Beto', false, false], ['sint-carla', 'Carla', false, true]]);
  await sql`update public.jugadores set entrena = true where person_id = 'sint-beto'`;
  await personas(pila, { jugadores: [['sint-ana', 'ana@pruebas.local'], ['sint-beto', 'beto@pruebas.local']], gestores: [['Gestor', 'gestor@pruebas.local']] });
  // La pista habitual de serie, «solo con ficha» desde el 04/11/2026 (D148), con coordenadas; una sola de serie.
  await sql`update public.pistas set es_de_serie = false where slug <> 'valdebernardo' and es_de_serie`;
  await sql`update public.pistas set es_de_serie = true, uso = 'entreno', estado = 'habitual', solo_con_ficha = true, habitual_desde = '2026-11-04', solo_con_ficha_desde = '2026-11-04',
            lat = coalesce(lat, 40.4047802), lng = coalesce(lng, -3.6219452) where slug = 'valdebernardo'`;
  await sql`update public.pistas set lat = coalesce(lat, 40.4), lng = coalesce(lng, -3.7) where estado = 'habitual'`;
  // Un plan sin hacer oficial y uno hecho oficial (conserva su clave plan-…, D119).
  await sql`insert into public.eventos (clave, temporada, tipo, equipo, titulo, fecha, inicio, oficial, creado_por, origen)
            values ('plan-sint-privado', '2026-27', 'quedada', 'ambos', 'Cena', '2026-12-12', '21:00', false, 'sint-ana', 'manual'),
                   ('plan-sint-oficial', '2026-27', 'quedada', 'ambos', 'Comida', '2026-12-13', '14:00', true, 'sint-ana', 'manual')`;
  // Lo mínimo que piden las suites: respuestas y una ausencia propias, una fila de asistencia.
  await sql`insert into public.respuestas (evento_id, person_id, respuesta) select id, 'sint-ana', 'va' from public.eventos where tipo = 'entreno' order by fecha limit 3`;
  await sql`insert into public.respuestas (evento_id, person_id, respuesta) select id, 'sint-beto', 'va' from public.eventos where tipo = 'entreno' order by fecha limit 1`;
  await sql`insert into public.asistencia_motivos (temporada, person_id, nombre, ambito, fueron, total) values ('2026-27', 'sint-ana', 'Ana', 'entrenos', 1, 1)`;
  const [c] = await sql`select (select count(*)::int from public.eventos) ev, (select count(*)::int from public.eventos where public.solo_con_ficha_en(eventos) is not null) marcados,
    (select count(*)::int from public.descansos) desc_, (select count(*)::int from public.eventos where tipo = 'liga') liga`;
  console.log(`  (${c.ev} eventos, ${c.liga} de liga, ${c.marcados} entrenos con la marca, ${c.desc_} descansos)`);
  ok(c.marcados > 0 && c.liga > 0, 'hay entrenos con la marca y partidos de liga para probar');

  console.log('\n== 1. Con la base sana, las tres en verde');
  for (const s of Object.keys(SUITES)) await enVerde(s, 'con la base sana');

  // Cada fallo: qué se rompe, en qué suites, qué FALLO tiene que salir, y cómo se quita.
  const vista = (await sql`select pg_get_viewdef('public.v_eventos_publicos'::regclass, true) d`)[0].d;
  const invitado = (await sql`select pg_get_functiondef('public._invitado(text,uuid)'::regprocedure) d`)[0].d;
  const [liga] = await sql`select clave, temporada, equipo, jornada, fecha::text fecha from public.eventos where tipo = 'liga' and oficial order by fecha limit 1`;
  const [valde] = await sql`select lat, lng, solo_con_ficha_desde::text sd from public.pistas where slug = 'valdebernardo'`;
  const MUTACIONES = [
    { que: 'un plan sin hacer oficial sale en lo público (la vista sin «e.oficial»)', suites: { eventos: /ningún plan sin hacer oficial/, inicio: /ningún plan sin hacer oficial/ },
      meter: () => sql.unsafe(`create or replace view public.v_eventos_publicos as ${vista.replace(/WHERE e\.oficial AND /, 'WHERE ').replace(/;\s*$/, '')}`),
      quitar: () => sql.unsafe(`create or replace view public.v_eventos_publicos as ${vista.replace(/;\s*$/, '')}`) },
    { que: 'un partido de liga con la temporada de otro año', suites: { eventos: /campos obligatorios/ },
      meter: () => sql`update public.eventos set temporada = '2024-25' where clave = ${liga.clave}`,
      quitar: () => sql`update public.eventos set temporada = ${liga.temporada} where clave = ${liga.clave}` },
    { que: 'un descanso la jornada en que ese equipo juega', suites: { eventos: /cada descanso/ },
      meter: () => sql`insert into public.descansos (temporada, equipo, jornada, fecha) values (${liga.temporada}, ${liga.equipo}, ${liga.jornada}, ${liga.fecha})`,
      quitar: () => sql`delete from public.descansos where temporada = ${liga.temporada} and equipo = ${liga.equipo} and jornada = ${liga.jornada} and fecha = ${liga.fecha}` },
    { que: 'un partido de liga desaparece (borrado): hueco en el calendario', suites: { eventos: /calendario de liga público está entero/ },
      meter: () => sql`update public.eventos set borrado_en = pruebas.ahora() where clave = ${liga.clave}`,
      quitar: () => sql`update public.eventos set borrado_en = null where clave = ${liga.clave}` },
    { que: 'un jugador lee las respuestas de otro (una política de más)', suites: { eventos: /el jugador ve sus respuestas/ },
      meter: () => sql.unsafe('create policy mutacion_todos_leen on public.respuestas for select to authenticated using (true)'),
      quitar: () => sql.unsafe('drop policy mutacion_todos_leen on public.respuestas') },
    { que: 'la pista habitual sin coordenadas', suites: { inicio: /las habituales las tienen/ },
      meter: () => sql`update public.pistas set lat = null, lng = null where slug = 'valdebernardo'`,
      quitar: () => sql`update public.pistas set lat = ${valde.lat}, lng = ${valde.lng} where slug = 'valdebernardo'` },
    { que: 'un sin ficha invitado a los entrenos con la marca (_invitado sin la regla de D148)', suites: { ficha: /ningún jugador sin ficha está invitado/ },
      meter: () => sql.unsafe(invitado.replace(/and \(j\.ficha_mda or j\.ficha_mdl or public\.solo_con_ficha_en\(e\) is null\)/, '')),
      quitar: () => sql.unsafe(invitado) },
    { que: 'la marca «solo con ficha» retroactiva (desde el 01/10)', suites: { ficha: /nada retroactivo/ },
      meter: () => sql`update public.pistas set solo_con_ficha_desde = '2026-10-01' where slug = 'valdebernardo'`,
      quitar: () => sql`update public.pistas set solo_con_ficha_desde = ${valde.sd} where slug = 'valdebernardo'` },
  ];

  console.log('\n== 2 y 3. Con cada fallo, en rojo por lo que toca; sin él, otra vez en verde');
  for (const m of MUTACIONES) {
    console.log(`\n  -- ${m.que}`);
    await m.meter();
    try {
      for (const [s, esperado] of Object.entries(m.suites)) {
        const r = await pasar(s);
        const motivo = r.fallos.find((l) => esperado.test(l));
        ok(r.codigo !== 0 && !!motivo, `${SUITES[s]} sale en rojo y dice por qué: «${(motivo ?? '').replace(/^FALLOs*/, '').slice(0, 150)}»`, r.codigo === 0 ? 'salió en verde' : r.fallos.slice(0, 3).join(' | '));
      }
    } finally { await m.quitar(); }
    for (const s of Object.keys(m.suites)) await enVerde(s, 'al quitarlo');
  }
} catch (e) {
  console.log(`  FALLO ${e.message}`); fallos++;
} finally {
  await pila.parar();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
