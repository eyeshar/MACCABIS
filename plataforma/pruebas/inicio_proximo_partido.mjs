#!/usr/bin/env node
// «Tu próximo partido» del inicio del jugador (D171), de extremo a extremo: pila local, web compilada y Chrome (375 px).
// Jugadores SINTÉTICOS. La tarjeta enseña el próximo partido al que el jugador VA A IR o PUEDE IR:
//   - con la convocatoria aprobada, solo si está CONVOCADO (caso Víctor: no convocado y con «no» puesto por un gestor);
//   - sin convocatoria, si su respuesta es va, duda o sin responder (este último, con el botón para responder bien visible);
//   - no va / no convocado / de baja: se salta al siguiente que cumpla, con la línea «Este domingo no juegas (…)»;
//   - si no queda ninguno: «No tienes partidos próximos» con enlace a la Agenda.
// La Agenda sigue enseñando todo con su estado exacto (Convocado · No convocado · Vas · No vas · Duda · Sin responder · Lesión).
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

  const tarjeta = (p) => p.getByTestId('proximo-partido');
  const linea = (p) => p.getByTestId('linea-equipacion');
  const fechaTarjeta = async (p) => (await tarjeta(p).locator('.in-titular').innerText()).toLowerCase();
  const captura = (p, n) => (process.env.PRUEBAS_CAPTURAS ? tarjeta(p).screenshot({ path: path.join(CAPTURAS, `${n}.png`) }).catch(() => {}) : null);
  const dia = (f) => String(+f.slice(8, 10));
  const sesion = (n) => e.sesion(`${n}@pruebas.local`, 375);

  console.log('\n== Con la convocatoria aprobada: solo si está convocado');
  const pa = await sesion('ana');
  ok((await pa.getByTestId('estado-partido').innerText()) === 'Convocado · MdA' && (await fechaTarjeta(pa)).includes(dia(D1)), 'Ana, convocada al MdA: sale el primer domingo, «Convocado · MdA»');
  ok((await tarjeta(pa).locator('.in-partido-uno').count()) === 1 && !(await pa.getByTestId('salto-partido').count()), 'solo su partido y sin línea de «no juegas»');
  const pc = await sesion('cira');
  ok((await pc.getByTestId('estado-partido').innerText()) === 'Convocado · MdL', 'Cira, convocada al MdL: «Convocado · MdL»');
  console.log('\n== No convocado (aunque su respuesta sea «va» o «no»): se salta al siguiente');
  const pb = await sesion('beto');
  ok(!(await tarjeta(pb).getByText('No vas').count()), 'Beto (caso Víctor: no convocado, con «no»): la tarjeta NO dice «No vas»');
  ok((await pb.getByTestId('salto-partido').innerText()) === 'Este domingo no juegas (no convocado)', 'línea pequeña arriba: «Este domingo no juegas (no convocado)»', await pb.getByTestId('salto-partido').innerText().catch(() => ''));
  ok((await fechaTarjeta(pb)).includes(dia(D2)), 'y la tarjeta enseña el siguiente domingo');
  const pd = await sesion('dani');
  ok((await pd.getByTestId('salto-partido').innerText()) === 'Este domingo no juegas (no convocado)' && (await fechaTarjeta(pd)).includes(dia(D2)), 'Dani (dijo «va» pero no está convocado): también se salta, «no convocado»');
  console.log('\n== Sin convocatoria aún (segundo domingo): sin responder → botón para responder bien visible');
  ok((await pb.getByTestId('estado-partido').innerText()) === 'Sin responder' && (await pb.getByTestId('convocatoria-pendiente').count()) === 1, 'Beto: «Sin responder» y «Convocatoria pendiente»');
  const boton = pb.getByTestId('responder-proximo').getByRole('button', { name: 'Voy', exact: true });
  ok(await visto(boton) && await visto(pb.getByTestId('responder-proximo').getByRole('button', { name: 'No voy', exact: true })), 'con el botón «Voy» / «No voy» dentro de la tarjeta');
  ok(await boton.evaluate((b) => b.getBoundingClientRect().height >= 44), 'el botón es grande (≥ 44 px)');
  const t = (await linea(pb).allInnerTexts()).join(' | ');
  ok(/Lleva la amarilla por si acaso\.$/.test(t) && !/Llevad/.test(t) && /Jugamos de negro|Coinciden colores/.test(t), 'equipación: la línea única de D160 en singular, siempre con «Lleva la amarilla por si acaso»', t);
  ok(!(await tarjeta(pb).locator('.eq-aviso').count()), 'sin el cuadro de aviso de choque aparte (la línea única lo dice todo)');
  await captura(pb, 'inicio_proximo_salto_375');
  ok(await sinDesbordar(pb), '375 px: sin desbordar');
  console.log('\n== De baja o lesionado');
  const ph = await sesion('hugo');
  ok((await ph.getByTestId('salto-partido').innerText()) === 'Este domingo no juegas (no convocado)', 'Hugo (lesionado): con la convocatoria aprobada manda ella; «no convocado»');
  // Se retira la convocatoria: sin ella, la lesión (ausencia por periodo) lo deja fuera de los dos primeros domingos.
  await sql`delete from public.convocatorias`;

  console.log('\n== Sin convocatoria: va, duda, sin responder, no va y de baja');
  await resp(de(L1, 'MdA'), 'sint-eva', 'va'); await resp(de(L1, 'MdL'), 'sint-eva', 'va');       // Eva: va a los dos
  await resp(de(L1, 'MdA'), 'sint-fer', 'duda'); await resp(de(L1, 'MdL'), 'sint-fer', 'duda');   // Fer: duda
  await resp(de(L1, 'MdA'), 'sint-cira', 'no', 'trabajo'); await resp(de(L1, 'MdL'), 'sint-cira', 'no', 'trabajo'); // Cira: no va al primero
  const ligas = await sql`select id from public.eventos where tipo = 'liga' and fecha > ${hoy}`;
  for (const x of ligas) await resp(x, 'sint-gaby', 'no', 'viaje');     // Gaby: no va a ninguno
  const pe = await sesion('eva');
  ok((await pe.getByTestId('estado-partido').innerText()).startsWith('Vas') && (await fechaTarjeta(pe)).includes(dia(D1)), 'Eva, «va»: sale el primer domingo, «Vas»');
  ok((await tarjeta(pe).locator('.in-partido-uno').count()) === 2 && !(await pe.getByTestId('salto-partido').count()), 'con «va» a los dos: sus dos partidos y sin línea de «no juegas»');
  const pf = await sesion('fer');
  ok((await pf.getByTestId('estado-partido').innerText()) === 'Duda' && (await fechaTarjeta(pf)).includes(dia(D1)), 'Fer, «duda»: sale, «Duda»');
  const pc2 = await sesion('cira');
  ok((await pc2.getByTestId('salto-partido').innerText()) === 'Este domingo no juegas (has dicho que no vas)' && (await fechaTarjeta(pc2)).includes(dia(D2)), 'Cira, «no» a los dos: «Este domingo no juegas (has dicho que no vas)» y el siguiente');
  const ph2 = await sesion('hugo');
  ok((await ph2.getByTestId('salto-partido').innerText()) === 'Este domingo no juegas (estás de baja)' && (await fechaTarjeta(ph2)).includes(dia(D3)), 'Hugo, de baja por lesión: «Este domingo no juegas (estás de baja)»');
  console.log('\n== Sin partidos próximos');
  const pg = await sesion('gaby');
  ok((await tarjeta(pg).getByTestId('sin-partidos').innerText()).startsWith('No tienes partidos próximos'), 'Gaby (no va a ninguno): «No tienes partidos próximos»');
  ok(await tarjeta(pg).getByRole('link', { name: /Ver la agenda/ }).getAttribute('href') === '/agenda', 'con el enlace a la Agenda');
  ok(!(await pg.getByTestId('estado-partido').count()) && (await pg.getByTestId('salto-partido').innerText()).includes('has dicho que no vas'), 'sin pastilla, y la línea del domingo saltado');
  await captura(pg, 'inicio_sin_partidos_375');
  ok(await sinDesbordar(pg), '375 px: sin desbordar');

  console.log('\n== La Agenda enseña todos los partidos con su estado exacto');
  const pastillas = async (p) => { await p.goto(`${APP}/agenda`); await p.getByTestId('fila-agenda').first().waitFor({ timeout: 15000 }); return p.getByTestId('fila-agenda').filter({ hasText: 'Partidos del domingo' }).locator('.in-pastilla').allInnerTexts(); };
  const pgA = await pastillas(pg);
  ok(pgA.length >= 2 && pgA.every((x) => x === 'No vas'), 'Agenda de Gaby: todos sus partidos, cada uno «No vas»', pgA.join('|'));
  ok(!(await pastillas(pg)).includes('No convocado'), '«No vas» y «No convocado» no se confunden');
  const pa2 = await sesion('ana');
  const paA = await pastillas(pa2);
  ok(paA[0] === 'Sin responder', 'Agenda de Ana sin convocatoria: «Sin responder»', paA.join('|'));
  await sql`insert into public.convocatorias (fecha, jornada, estado, origen, equipos, aprobada_en) values (${D1}, 3, 'aprobada', 'propuesta', ${sql.json({ MdA: [{ person_id: 'sint-ana' }], MdL: [] })}, pruebas.ahora())`;
  const ps = await pastillas(pa2);
  ok(ps.includes('Convocado · MdA'), 'Agenda de Ana, con convocatoria: «Convocado · MdA»', ps.join('|'));
  const pbA = await pastillas(await sesion('beto'));
  ok(pbA.includes('No convocado') && !pbA.slice(0, 1).includes('No vas'), 'Agenda de Beto (no convocado, con «no»): «No convocado», no «No vas»', pbA.join('|'));
  const phA = await pastillas(await sesion('hugo'));
  await sql`delete from public.convocatorias`;
  const phB = await pastillas(await sesion('hugo'));
  ok(phB.includes('Lesión'), 'Agenda de Hugo (de baja por lesión): «Lesión»', phB.join('|'));
  ok(phA.includes('No convocado'), 'y con la convocatoria aprobada sin él, «No convocado»', phA.join('|'));
  const pfA = await pastillas(await sesion('fer'));
  ok(pfA.includes('Duda'), 'Agenda de Fer: «Duda»', pfA.join('|'));
  ok(!e.errores.length, 'sin errores de JS en la consola', e.errores.join(' | '));
} catch (err) {
  console.log(`  FALLO ${err.stack}`); sumar();
} finally {
  await e.parar();
}
console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK');
process.exit(fallos() ? 1 : 0);
