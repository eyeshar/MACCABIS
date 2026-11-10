#!/usr/bin/env node
// Pase de lista (D50, D189, D192) de extremo a extremo: pila local, web compilada y Chrome (360, 412 y 1280 px).
// Jugadores SINTÉTICOS (D39) y eventos del calendario de prueba (D185: «hoy» es el 19/10/2026), nunca datos reales.
//   - La pestaña «Pase de lista» del evento, solo para gestores; se abre al terminar el evento (antes, «Se abre al terminar»).
//   - Por defecto copia la respuesta: va -> a tiempo; no va por lesión -> lesionado; por otro motivo -> con excusa; duda
//     o sin responder -> sin excusa; en un partido con la convocatoria aprobada, quien no está -> no convocado.
//   - Guardar: asistencia_eventos con origen 'plataforma', evento_ref = id del evento, «a tiempo» y «retraso» = 'fue'
//     (el retraso en el motivo), quién pasó lista; guardar otra vez no duplica.
//   - «Asistencia y motivos» lo cuenta una vez (la unión con lo de la plataforma en vivo: asistencia_calculo.mjs).
//   - La función: solo gestores; no antes de terminar; no un día que ya está en la asistencia de SportEasy; no estados que
//     no valen («no convocado» en un entreno); solo invitados.
//   - Migración 20261110120000 reversible (D111): se deshace limpia (las filas se quedan) y se vuelve a aplicar.
//
//   npm run pruebas:pase-lista
import fs from 'node:fs';
import path from 'node:path';
import { preparar, personas, sinteticos, contador, visto, sinDesbordar, pequenos, trasAccion, hasta, RAIZ } from './comun_e2e.mjs';
import { hoyMadrid } from './fechas_prueba.mjs';
import { migrar } from './infra/migrar.mjs';
import { revertirPosteriores } from './revertir_posteriores.mjs';

const MIG = '20261110120000';
const { ok, fallos, sumar } = contador();
const e = await preparar();
const { sql, APP } = e;
try {
  const hoy = hoyMadrid();
  await sinteticos(sql, [['sint-ana', 'Ana', true, false], ['sint-beto', 'Beto', true, false], ['sint-cira', 'Cira', true, false], ['sint-dani', 'Dani', true, false]]);
  const P = await personas(e.pila, { jugadores: [['sint-ana', 'ana@pruebas.local']], gestores: [['Iván', 'gestor@pruebas.local', null]] });
  const tG = P['gestor@pruebas.local'].token;
  const pasados = await sql`select id, fecha::text, inicio::text, fin::text from public.eventos where tipo = 'entreno' and estado = 'programado' and oficial and fecha < ${hoy} order by fecha desc limit 2`;
  const [ent, entSE] = pasados;
  const [fut] = await sql`select id, fecha::text from public.eventos where tipo = 'entreno' and estado = 'programado' and oficial and fecha > ${hoy} order by fecha limit 1`;
  const [liga] = await sql`select id, fecha::text, equipo from public.eventos where tipo = 'liga' and estado = 'programado' and oficial and equipo = 'MdA' and fecha < ${hoy} order by fecha desc limit 1`;
  ok(!!ent && !!entSE && !!fut && !!liga, 'calendario de prueba: dos entrenos pasados, uno futuro y un partido del MdA pasado', JSON.stringify({ ent: ent?.fecha, entSE: entSE?.fecha, fut: fut?.fecha, liga: liga?.fecha }));
  // Lo que la pila traiga de SportEasy para esos días, fuera; el segundo entreno, con una fila de SportEasy a propósito.
  await sql`delete from public.asistencia_eventos where fecha in (${ent.fecha}, ${entSE.fecha}, ${liga.fecha})`;
  await sql`insert into public.asistencia_eventos (person_id, evento_ref, nombre, temporada, fecha, ambito, estado, origen) values ('sint-ana', 'se-999', 'ana', '2026-27', ${entSE.fecha}, 'entrenos', 'fue', 'sporteasy')`;
  await sql`insert into public.respuestas (evento_id, person_id, respuesta, motivo, origen) values
    (${ent.id}, 'sint-ana', 'va', null, 'jugador'), (${ent.id}, 'sint-beto', 'no', 'lesion', 'jugador'),
    (${ent.id}, 'sint-cira', 'no', 'trabajo', 'jugador'), (${ent.id}, 'sint-dani', 'duda', null, 'jugador'),
    (${liga.id}, 'sint-ana', 'va', null, 'jugador'), (${liga.id}, 'sint-beto', 'va', null, 'jugador')`;
  await sql`insert into public.convocatorias (fecha, jornada, estado, origen, equipos, aprobada_en) values (${liga.fecha}, 2, 'aprobada', 'propuesta', ${sql.json({ MdA: [{ person_id: 'sint-ana' }] })}, pruebas.ahora())
            on conflict (fecha) do update set estado = 'aprobada', equipos = excluded.equipos`;
  const rpc = (args, token) => fetch(`${e.pila.url}/rest/v1/rpc/pase_de_lista`, { method: 'POST', headers: { apikey: e.pila.anonKey, authorization: `Bearer ${token ?? e.pila.anonKey}`, 'content-type': 'application/json' }, body: JSON.stringify(args) });
  const filasDe = (id) => sql`select person_id, estado, motivo, origen, temporada, ambito, equipo, pasado_por_nombre from public.asistencia_eventos where evento_ref = ${id} order by person_id`;

  console.log(`\n== Entreno del ${ent.fecha} (ya terminado), gestor en el móvil (360 px)`);
  const pg = await e.sesion('gestor@pruebas.local', 360);
  await pg.goto(`${APP}/evento/${ent.id}`);
  ok(await visto(pg.getByTestId('pestanas-evento').getByRole('link', { name: 'Pase de lista' })), 'la pestaña «Pase de lista» sale en el entreno');
  await pg.goto(`${APP}/evento/${ent.id}?tab=pase`);
  ok(await visto(pg.getByTestId('pase-formulario')), 'se abre el pase de lista');
  const estado = (p) => pg.getByTestId('pase-lista').locator(`li[data-person="${p}"]`).getAttribute('data-estado');
  ok(await estado('sint-ana') === 'a_tiempo' && await estado('sint-beto') === 'lesion' && await estado('sint-cira') === 'con_excusa' && await estado('sint-dani') === 'sin_excusa',
    'por defecto copia la respuesta: Ana a tiempo, Beto lesionado, Cira con excusa, Dani (duda) sin excusa', [await estado('sint-ana'), await estado('sint-beto'), await estado('sint-cira'), await estado('sint-dani')].join());
  ok(/Respondió: no va · Trabajo/.test(await pg.getByTestId('pase-lista').locator('li[data-person="sint-cira"]').innerText()), 'con lo que respondió (y el motivo, solo gestores)');
  ok((await pg.getByTestId('pase-lista').locator('li[data-person="sint-ana"] option').allInnerTexts()).join('|') === 'Fue, a tiempo|Fue, con retraso|Faltó con excusa|Faltó sin excusa|Lesionado', 'en un entreno, sin «No convocado»');
  ok((await filasDe(ent.id)).length === 0, 'nada guardado sin pulsar «Guardar»');
  ok(await sinDesbordar(pg), '360 px sin desbordar');
  ok(!(await pequenos(pg, '.pl-select, [data-testid=pase-guardar]')).length, 'desplegables y botón de al menos 44 px', JSON.stringify(await pequenos(pg, '.pl-select, [data-testid=pase-guardar]')));
  await pg.getByLabel('Pase de lista · Ana').selectOption('retraso');
  await trasAccion(pg, () => pg.getByTestId('pase-guardar').click());
  ok(await visto(pg.getByTestId('pase-resultado')) && /Pase de lista guardado/.test(await pg.getByTestId('pase-resultado').innerText()), '«Pase de lista guardado»', await pg.getByTestId('pase-resultado').innerText().catch(() => ''));
  ok(await hasta(async () => (await filasDe(ent.id)).length >= 4), 'guardado en asistencia_eventos');
  const g = Object.fromEntries((await filasDe(ent.id)).map((f) => [f.person_id, f]));
  ok(g['sint-ana']?.estado === 'fue' && g['sint-ana']?.motivo === 'retraso' && g['sint-beto']?.estado === 'lesion' && g['sint-cira']?.estado === 'con_excusa' && g['sint-cira']?.motivo === 'Trabajo' && g['sint-dani']?.estado === 'sin_excusa',
    'Ana: fue (retraso); Beto: lesión; Cira: con excusa (trabajo); Dani: sin excusa', JSON.stringify(g['sint-ana']) + JSON.stringify(g['sint-cira']));
  ok(Object.values(g).every((f) => f.origen === 'plataforma' && f.temporada === '2026-27' && f.ambito === 'entrenos' && f.equipo === null && f.pasado_por_nombre === 'Iván'), 'origen «plataforma», 2026/27, entrenos, sin equipo y «pasado por Iván»');
  const n1 = (await filasDe(ent.id)).length;
  await pg.reload();
  ok(await estado('sint-ana') === 'retraso' && /Guardado por Iván el /.test(await pg.getByTestId('pase-estado').innerText()), 'al volver: lo guardado (Ana con retraso) y «Guardado por Iván el …»');
  await trasAccion(pg, () => pg.getByTestId('pase-guardar').click());
  ok(await hasta(async () => /guardado/.test(await pg.getByTestId('pase-resultado').innerText().catch(() => ''))) && (await filasDe(ent.id)).length === n1, 'guardar otra vez no duplica', `${n1} -> ${(await filasDe(ent.id)).length}`);

  for (const ancho of [412, 1280]) {
    const p = await e.sesion('gestor@pruebas.local', ancho);
    await p.goto(`${APP}/evento/${ent.id}?tab=pase`);
    ok(await visto(p.getByTestId('pase-formulario')) && await sinDesbordar(p), `${ancho} px: el pase sin desbordar`);
  }

  console.log('\n== «Asistencia y motivos» lo cuenta una vez');
  const pa = await e.sesion('gestor@pruebas.local', 1280);
  await pa.goto(`${APP}/gestion/asistencia?ver=todos`);
  const celda = async (id, col) => (await pa.locator(`[data-testid=tabla-asistencia] [data-person="${id}"] [data-col=${col}]`).innerText().catch(() => '')).replace(/\s+/g, ' ');
  ok((await celda('sint-ana', 'entrenos')).includes('2 / 2') && (await celda('sint-cira', 'entrenos')).includes('0 / 1') && (await celda('sint-dani', 'sin')).trim() === '1',
    'Ana 2/2 (su fila de SportEasy del otro entreno y el pase, con retraso: una vez cada uno), Cira 0/1 (con excusa), Dani 1 sin excusa; la lesión de Beto no cuenta', `${await celda('sint-ana', 'entrenos')} | ${await celda('sint-cira', 'entrenos')} | ${await celda('sint-dani', 'sin')}`);

  console.log(`\n== Partido del MdA del ${liga.fecha}, con la convocatoria aprobada`);
  await pg.goto(`${APP}/evento/${liga.id}?tab=pase`);
  ok(await visto(pg.getByTestId('pase-formulario')) && await estado('sint-ana') === 'a_tiempo' && await estado('sint-beto') === 'no_convocado', 'Ana (convocada, va): a tiempo; Beto (dijo «va», sin convocar): no convocado', `${await estado('sint-ana')} ${await estado('sint-beto')}`);
  ok((await pg.getByTestId('pase-lista').locator('li[data-person="sint-ana"] option').allInnerTexts()).includes('No convocado'), 'en un partido, con «No convocado»');

  console.log('\n== Antes de terminar, un día de SportEasy y un jugador');
  await pg.goto(`${APP}/evento/${fut.id}?tab=pase`);
  ok(await visto(pg.getByTestId('pase-cerrado')) && /Se abre al terminar el entreno/.test(await pg.getByTestId('pase-cerrado').innerText()) && !(await pg.getByTestId('pase-formulario').count()), 'entreno futuro: «Se abre al terminar el entreno…», sin formulario');
  await pg.goto(`${APP}/evento/${entSE.id}?tab=pase`);
  ok(await visto(pg.getByTestId('pase-sporteasy')), `entreno del ${entSE.fecha}, ya en la asistencia de SportEasy: no se pasa lista otra vez`);
  const pj = await e.sesion('ana@pruebas.local', 360);
  await pj.goto(`${APP}/evento/${ent.id}?tab=pase`);
  ok(!(await pj.getByTestId('pestanas-evento').count()) && !(await pj.getByTestId('pase-formulario').count()), 'un jugador no ve las pestañas ni el pase de lista');

  console.log('\n== La función (API)');
  const err = async (r) => `${r.status} ${(await r.text()).slice(0, 160)}`;
  let r = await rpc({ p_evento: ent.id, p_filas: [{ person_id: 'sint-ana', estado: 'a_tiempo' }] });
  ok(r.status === 401 || r.status === 403, 'anónimo: no puede', await err(r));
  r = await rpc({ p_evento: ent.id, p_filas: [{ person_id: 'sint-ana', estado: 'a_tiempo' }] }, P['sint-ana'].token);
  ok(r.status >= 400 && /solo_gestores/.test(await r.text()), 'un jugador: «solo_gestores»');
  const conGestor = async (args, re, m) => { const x = await rpc(args, tG); const t = await x.text(); ok(x.status >= 400 && re.test(t), m, `${x.status} ${t.slice(0, 160)}`); };
  await conGestor({ p_evento: fut.id, p_filas: [{ person_id: 'sint-ana', estado: 'a_tiempo' }] }, /evento_sin_terminar/, 'antes de terminar: «evento_sin_terminar»');
  await conGestor({ p_evento: entSE.id, p_filas: [{ person_id: 'sint-ana', estado: 'a_tiempo' }] }, /evento_de_sporteasy/, 'un día ya cargado de SportEasy: «evento_de_sporteasy» (no se cuenta dos veces)');
  await conGestor({ p_evento: ent.id, p_filas: [{ person_id: 'sint-ana', estado: 'no_convocado' }] }, /estado_no_valido/, '«no convocado» en un entreno: «estado_no_valido»');
  await conGestor({ p_evento: ent.id, p_filas: [{ person_id: 'no-existe', estado: 'a_tiempo' }] }, /no_invitado/, 'alguien que no está invitado: «no_invitado»');
  r = await rpc({ p_evento: ent.id, p_filas: [{ person_id: 'sint-dani', estado: null }] }, tG);
  ok(r.ok && !(await filasDe(ent.id)).some((f) => f.person_id === 'sint-dani'), 'estado null quita su fila del pase');
  ok((await sql`select count(*)::int n from public.asistencia_eventos where evento_ref = 'se-999' and origen = 'sporteasy'`)[0].n === 1, 'la fila de SportEasy sigue intacta');

  console.log(`\n== Migración ${MIG} reversible (D111): se deshace limpia y se vuelve a aplicar`);
  const MIGS = path.join(RAIZ, 'supabase', 'migrations');
  const func = async () => (await sql`select count(*)::int n from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = 'pase_de_lista'`)[0].n;
  const col = async () => (await sql`select count(*)::int n from information_schema.columns where table_schema = 'public' and table_name = 'asistencia_eventos' and column_name = 'pasado_por_nombre'`)[0].n;
  const antes = (await filasDe(ent.id)).length;
  ok(await func() === 1 && await col() === 1, 'aplicada: la función y la columna');
  await revertirPosteriores(sql, MIGS, MIG);
  await sql.unsafe(fs.readFileSync(path.join(MIGS, `${MIG}_pase_de_lista.revertir.sql`), 'utf8'));
  ok(await func() === 0 && await col() === 0 && !(await sql`select 1 from supabase_migrations.schema_migrations where version = ${MIG}`).length, 'revertir.sql quita la función, la columna y su registro');
  ok((await sql`select count(*)::int n from public.asistencia_eventos where evento_ref = ${ent.id}`)[0].n === antes, 'y las filas del pase se quedan (la tabla ya las admitía)');
  await migrar(sql, { log: () => {} });
  ok(await func() === 1 && await col() === 1, 'se vuelve a aplicar');
  r = await rpc({ p_evento: ent.id, p_filas: [{ person_id: 'sint-dani', estado: 'sin_excusa' }] }, tG);
  ok(r.ok && (await filasDe(ent.id)).some((f) => f.person_id === 'sint-dani' && f.pasado_por_nombre === 'Iván'), 'y vuelve a guardar', await err(r));

  ok(!e.errores.length, 'sin errores en la consola', e.errores.slice(0, 3).join(' | '));
} catch (err) {
  console.log(`  FALLO ${err.stack}`);
  sumar();
} finally {
  await e.parar();
}
console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK');
process.exit(fallos() ? 1 : 0);
