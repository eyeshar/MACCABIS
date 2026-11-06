#!/usr/bin/env node
// El estado de los próximos partidos del jugador (D171; desde D189 en las tarjetas de la Semana y en el Calendario), de
// extremo a extremo: pila local, web compilada y Chrome (375 px). Jugadores SINTÉTICOS:
//   - con la convocatoria aprobada, «Convocado · equipo» o «No convocado» (caso Víctor: no convocado y con «no» puesto por
//     un gestor: nunca «No vas»);
//   - sin convocatoria: Vas, Duda, No vas, Lesión o Sin responder (con los botones para responder en la tarjeta);
//   - el Calendario enseña todos con su estado exacto (Convocado · No convocado · Vas · No vas · Duda · Sin responder · Lesión).
// La equipación, la línea única de D160 (siempre con «la amarilla por si acaso»).
//
//   npm run pruebas:inicio-proximo-partido
import path from 'node:path';
import { preparar, personas, sinteticos, contador, visto, sinDesbordar, CAPTURAS } from './comun_e2e.mjs';
import { adelantar, semanas, hoyMadrid } from './fechas_prueba.mjs';

const { ok, fallos, sumar } = contador();
const e = await preparar();
const { sql, APP } = e;
try {
  const hoy = hoyMadrid();
  const F = await adelantar(sql, semanas('2026-10-25'));
  if (F('2026-10-18') === hoy) await sql`update public.eventos set inicio = '00:01', fin = null where tipo = 'liga' and fecha = ${hoy}`;
  const domingos = (await sql`select distinct fecha::text f from public.eventos where tipo = 'liga' and estado = 'programado' and fecha > ${hoy} order by 1 limit 4`).map((x) => x.f);
  const [D1, D2, D3] = domingos;
  const liga = async (f) => await sql`select id, equipo from public.eventos where tipo = 'liga' and fecha = ${f} order by inicio, equipo`;
  const L1 = await liga(D1), L2 = await liga(D2);
  await sinteticos(sql, [['sint-ana', 'Ana', true, true], ['sint-beto', 'Beto', true, true], ['sint-cira', 'Cira', true, true], ['sint-dani', 'Dani', true, true],
    ['sint-eva', 'Eva', true, true], ['sint-fer', 'Fer', true, true], ['sint-gaby', 'Gaby', true, true], ['sint-hugo', 'Hugo', true, true]]);
  const P = await personas(e.pila, { jugadores: ['ana', 'beto', 'cira', 'dani', 'eva', 'fer', 'gaby', 'hugo'].map((n) => [`sint-${n}`, `${n}@pruebas.local`]) });
  const resp = (ev, p, r, motivo = null) => sql`insert into public.respuestas (evento_id, person_id, respuesta, motivo, origen) values (${ev.id}, ${p}, ${r}, ${motivo}, 'gestor')`;
  const de = (L, eq) => L.find((x) => x.equipo === eq);

  // ---- Fase A: la convocatoria del primer domingo APROBADA: Ana (MdA) y Cira (MdL) convocadas; Beto, no (y con «no» puesto por un gestor).
  await sql`insert into public.convocatorias (fecha, jornada, estado, origen, equipos, aprobada_en) values (${D1}, 3, 'aprobada', 'propuesta', ${sql.json({ MdA: [{ person_id: 'sint-ana' }], MdL: [{ person_id: 'sint-cira' }] })}, pruebas.ahora())`;
  await resp(de(L1, 'MdL'), 'sint-beto', 'no', 'otro');            // el caso real de Víctor
  await resp(de(L1, 'MdA'), 'sint-dani', 'va'); await resp(de(L1, 'MdL'), 'sint-dani', 'va');  // va, pero la convocatoria no lo lleva
  await sql`insert into public.ausencias_periodo (person_id, desde, hasta, motivo) values ('sint-hugo', ${hoy}, ${D2}, 'lesion')`;

  // D189: «Tu próximo partido» (D171) ya no existe: la Semana enseña una tarjeta por día (los próximos 10) con el estado exacto
  // de cada uno, y el Calendario, todos. Los casos de D171 se comprueban en esas pastillas: «No vas» y «No convocado» nunca se
  // confunden, y quien no ha respondido tiene sus botones a mano.
  // El primer domingo (D1) es el unico partido de los proximos 10 dias: su tarjeta es la primera de liga.
  const tarjeta = (p) => p.locator('[data-testid="tarjeta-semana"][data-tipo="liga"]').first();
  const estado = async (p) => (await tarjeta(p).getByTestId('estado-tarjeta').innerText()).trim();
  const linea = (p) => p.getByTestId('linea-equipacion');
  const captura = (p, n) => (process.env.PRUEBAS_CAPTURAS ? p.screenshot({ path: path.join(CAPTURAS, `${n}.png`) }).catch(() => {}) : null);
  const sesion = (n) => e.sesion(`${n}@pruebas.local`, 375);

  console.log('\n== Con la convocatoria aprobada: «Convocado · equipo» o «No convocado» (nunca «No vas»)');
  const pa = await sesion('ana');
  ok((await estado(pa)) === 'Convocado · MdA', 'Ana, convocada al MdA: «Convocado · MdA»', await estado(pa).catch(() => ''));
  const pc = await sesion('cira');
  ok((await estado(pc)) === 'Convocado · MdL', 'Cira, convocada al MdL: «Convocado · MdL»');
  const pb = await sesion('beto');
  ok((await estado(pb)) === 'No convocado', 'Beto (caso Víctor: no convocado, con «no»): «No convocado», no «No vas»', await estado(pb).catch(() => ''));
  const pd = await sesion('dani');
  ok((await estado(pd)) === 'No convocado', 'Dani (dijo «va» pero no está convocado): «No convocado»');
  const t = (await linea(pb).allInnerTexts()).join(' | ');
  ok(/Lleva la amarilla por si acaso\.$/.test(t) && !/Llevad/.test(t) && /Jugamos de negro|Coinciden colores/.test(t), 'equipación: la línea única de D160 en singular, siempre con «Lleva la amarilla por si acaso»', t);
  ok(!(await tarjeta(pb).locator('.eq-aviso').count()), 'sin el cuadro de aviso de choque aparte (la línea única lo dice todo)');
  await captura(pb, 'semana_no_convocado_375');
  ok(await sinDesbordar(pb), '375 px: sin desbordar');
  const ph = await sesion('hugo');
  ok((await estado(ph)) === 'No convocado', 'Hugo (lesionado): con la convocatoria aprobada manda ella; «No convocado»');
  // Se retira la convocatoria: sin ella, la lesión (ausencia por periodo) lo deja fuera de los dos primeros domingos.
  await sql`delete from public.convocatorias`;

  console.log('\n== Sin convocatoria: va, duda, sin responder, no va y de baja');
  await resp(de(L1, 'MdA'), 'sint-eva', 'va'); await resp(de(L1, 'MdL'), 'sint-eva', 'va');       // Eva: va a los dos
  await resp(de(L1, 'MdA'), 'sint-fer', 'duda'); await resp(de(L1, 'MdL'), 'sint-fer', 'duda');   // Fer: duda
  await resp(de(L1, 'MdA'), 'sint-cira', 'no', 'trabajo'); await resp(de(L1, 'MdL'), 'sint-cira', 'no', 'trabajo'); // Cira: no va al primero
  const ligas = await sql`select id from public.eventos where tipo = 'liga' and fecha > ${hoy}`;
  for (const x of ligas) await resp(x, 'sint-gaby', 'no', 'viaje');     // Gaby: no va a ninguno
  const pe = await sesion('eva');
  ok((await estado(pe)).startsWith('Vas') && (await tarjeta(pe).locator('.chip-eq').count()) === 2, 'Eva, «va» a los dos: «Vas…», con sus dos partidos en la tarjeta');
  const pf = await sesion('fer');
  ok((await estado(pf)) === 'Duda', 'Fer, «duda»: «Duda»');
  const pc2 = await sesion('cira');
  ok((await estado(pc2)) === 'No vas', 'Cira, «no» a los dos: «No vas»');
  const ph2 = await sesion('hugo');
  ok((await estado(ph2)) === 'Lesión', 'Hugo, de baja por lesión: «Lesión»');
  const pb2 = await sesion('beto');
  ok((await estado(pb2)) === 'Sin responder', 'Beto, sin convocatoria y sin responder al primero: «Sin responder»');
  const boton = tarjeta(pb2).locator('button, a').filter({ hasText: /^(Voy|Responder al domingo)$/ }).first();
  ok(await visto(boton) && await boton.evaluate((b) => b.getBoundingClientRect().height >= 44), 'con los botones para responder en la tarjeta (≥ 44 px)');
  const pg = await sesion('gaby');
  ok((await estado(pg)) === 'No vas', 'Gaby (no va a ninguno): «No vas»');
  await captura(pg, 'semana_no_va_375');
  ok(await sinDesbordar(pg), '375 px: sin desbordar');

  console.log('\n== El Calendario enseña todos los partidos con su estado exacto');
  const pastillas = async (p) => { await p.goto(`${APP}/calendario?f=partidos`); await p.getByTestId('fila-agenda').first().waitFor({ timeout: 15000 }); return p.getByTestId('fila-agenda').filter({ hasText: 'Partidos del domingo' }).locator('.in-pastilla').allInnerTexts(); };
  const pgA = await pastillas(pg);
  ok(pgA.length >= 2 && pgA.every((x) => x === 'No vas'), 'Calendario de Gaby: todos sus partidos, cada uno «No vas»', pgA.join('|'));
  ok(!(await pastillas(pg)).includes('No convocado'), '«No vas» y «No convocado» no se confunden');
  const pa2 = await sesion('ana');
  const paA = await pastillas(pa2);
  ok(paA[0] === 'Sin responder', 'Calendario de Ana sin convocatoria: «Sin responder»', paA.join('|'));
  await sql`insert into public.convocatorias (fecha, jornada, estado, origen, equipos, aprobada_en) values (${D1}, 3, 'aprobada', 'propuesta', ${sql.json({ MdA: [{ person_id: 'sint-ana' }], MdL: [] })}, pruebas.ahora())`;
  const ps = await pastillas(pa2);
  ok(ps.includes('Convocado · MdA'), 'Calendario de Ana, con convocatoria: «Convocado · MdA»', ps.join('|'));
  const pbA = await pastillas(await sesion('beto'));
  ok(pbA.includes('No convocado') && !pbA.slice(0, 1).includes('No vas'), 'Calendario de Beto (no convocado, con «no»): «No convocado», no «No vas»', pbA.join('|'));
  const phA = await pastillas(await sesion('hugo'));
  await sql`delete from public.convocatorias`;
  const phB = await pastillas(await sesion('hugo'));
  ok(phB.includes('Lesión'), 'Calendario de Hugo (de baja por lesión): «Lesión»', phB.join('|'));
  ok(phA.includes('No convocado'), 'y con la convocatoria aprobada sin él, «No convocado»', phA.join('|'));
  const pfA = await pastillas(await sesion('fer'));
  ok(pfA.includes('Duda'), 'Calendario de Fer: «Duda»', pfA.join('|'));
  ok(!e.errores.length, 'sin errores de JS en la consola', e.errores.join(' | '));
} catch (err) {
  console.log(`  FALLO ${err.stack}`); sumar();
} finally {
  await e.parar();
}
console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK');
process.exit(fallos() ? 1 : 0);
