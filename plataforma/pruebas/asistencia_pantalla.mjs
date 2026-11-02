#!/usr/bin/env node
// «Asistencia y motivos» rediseñada (D170) de extremo a extremo: pila local, web compilada y Chrome (escritorio y 375 px).
// Jugadores SINTÉTICOS (D39). Solo gestores.
//   - Tabla: columnas, % con barrita de color, «Sin excusa», tendencia con tooltip, TOTAL % de mayor a menor por defecto,
//     todas las columnas ordenables al pulsar el encabezado, «Menos de 5 eventos» debajo.
//   - Filtros: temporadas (varias, con atajos Esta / Últimas 2 / Todas), Plantilla actual / Todos, Equipo, Periodo.
//   - 2025/26 manda lo corregido (D72); las temporadas antiguas, «aprox.» con nota.
//   - Ficha: % por temporada, motivos y últimos 10 eventos (con «según SportEasy» en 2025/26).
//   - 375 px: sin desplazar, Jugador, TOTAL % y Sin excusa; el resto con desplazamiento lateral; filtros plegados.
//
//   npm run pruebas:asistencia-pantalla
import { preparar, sinteticos, personas, contador, visto, sinDesbordar, foto } from './comun_e2e.mjs';
import { hoyMadrid, sumarDias } from './fechas_prueba.mjs';

const { ok, fallos, sumar } = contador();
const e = await preparar();
const { sql, APP } = e;
const H = hoyMadrid();
let nb = 12; // entrenos contables de Beto (12 de SportEasy; 13 con el «no voy» de la plataforma si hay un entreno pasado desde el 24/10)
const d = (n) => sumarDias(H, -n);
let seq = 0;
const filas = [];
const ev = (person_id, nombre, fecha, estado, o = {}) => filas.push({
  person_id, evento_ref: `se-${++seq}`, nombre, temporada: o.temporada ?? '2026-27', fecha, ambito: o.ambito ?? 'entrenos',
  equipo: o.ambito === 'partidos' ? (o.equipo ?? 'MdA') : null, titulo: o.titulo ?? null, estado, motivo: o.motivo ?? null, origen: 'sporteasy',
});
const rep = (k, ...a) => { for (let i = 0; i < k; i++) ev(...a); };
try {
  await sinteticos(e.sql, [['sint-ana', 'Ana', true, true], ['sint-beto', 'Beto', true, true], ['sint-cira', 'Cira', true, true], ['sint-dani', 'Dani', true, true], ['sint-viejo', 'Viejo', true, true]]);
  await sql`update public.jugadores set activo = false where person_id = 'sint-viejo'`;
  await personas(e.pila, { gestores: [['Iván', 'gestor@pruebas.local', null]] });

  // 2026/27. Ana: entrenos 13/14, partidos 5/5 (MdA); recientes 4/4. Beto: entrenos 4/12 (8 sin excusa), partidos 2/5 (MdL); recientes 0/4.
  rep(9, 'sint-ana', 'Ana', d(60), 'fue'); ev('sint-ana', 'Ana', d(59), 'con_excusa'); rep(4, 'sint-ana', 'Ana', d(10), 'fue'); rep(5, 'sint-ana', 'Ana', d(30), 'fue', { ambito: 'partidos', equipo: 'MdA' });
  rep(3, 'sint-ana', 'Ana', d(45), 'no_convocado'); rep(2, 'sint-ana', 'Ana', d(44), 'lesion');
  rep(4, 'sint-beto', 'Beto', d(50), 'fue'); rep(4, 'sint-beto', 'Beto', d(49), 'sin_excusa'); rep(4, 'sint-beto', 'Beto', d(5), 'sin_excusa');
  rep(2, 'sint-beto', 'Beto', d(30), 'fue', { ambito: 'partidos', equipo: 'MdL' }); rep(3, 'sint-beto', 'Beto', d(23), 'con_excusa', { ambito: 'partidos', equipo: 'MdL' });
  rep(6, 'sint-cira', 'Cira', d(50), 'fue'); rep(3, 'sint-cira', 'Cira', d(49), 'con_excusa'); rep(3, 'sint-cira', 'Cira', d(6), 'fue');
  rep(3, 'sint-dani', 'Dani', d(40), 'fue'); // pocos eventos
  rep(6, 'sint-viejo', 'Viejo', d(40), 'fue');
  // 2025/26: detalle de SportEasy (no manda) y totales corregidos (mandan).
  rep(25, 'sint-ana', 'Ana', '2025-11-01', 'fue', { temporada: '2025-26' }); rep(5, 'sint-ana', 'Ana', '2025-11-02', 'sin_excusa', { temporada: '2025-26' });
  rep(6, 'sint-dani', 'Dani', '2026-05-01', 'fue', { temporada: '2025-26' }); ev('sint-dani', 'Dani', '2026-05-09', 'con_excusa', { temporada: '2025-26', ambito: 'partidos', equipo: 'MdA', titulo: 'MdA – Rival' });
  // 2018/19: aproximada.
  rep(5, 'sint-ana', 'Ana', '2018-11-01', 'fue', { temporada: '2018-19' }); rep(5, 'sint-ana', 'Ana', '2018-11-02', 'sin_excusa', { temporada: '2018-19' });
  for (let i = 0; i < filas.length; i += 400) await sql`insert into public.asistencia_eventos ${sql(filas.slice(i, i + 400))}`;
  const corr = (p, nombre, ambito, fueron, excusa, nc, les) => sql`insert into public.asistencia_motivos (temporada, person_id, nombre, ambito, fueron, excusa, sin_excusa, no_conv, lesion, total)
    values ('2025-26', ${p}, ${nombre}, ${ambito}, ${fueron}, ${excusa}, 0, ${nc}, ${les}, ${fueron + excusa + nc + les})`;
  await corr('sint-ana', 'Ana', 'entrenos', 20, 10, 3, 4); await corr('sint-ana', 'Ana', 'partidos', 10, 5, 20, 1);
  await corr('sint-dani', 'Dani', 'entrenos', 5, 2, 0, 0); await corr('sint-dani', 'Dani', 'partidos', 4, 1, 0, 0);
  // La plataforma, en vivo: un «no voy · viaje» de Beto en un entreno ya pasado desde el 24/10.
  const [pasado] = await sql`select id from public.eventos where tipo = 'entreno' and fecha >= '2026-10-24' and fecha < ${H} order by fecha limit 1`;
  if (pasado) await sql`insert into public.respuestas (evento_id, person_id, respuesta, motivo, fuente, origen) values (${pasado.id}, 'sint-beto', 'no', 'viaje', 'web', 'gestor')`;

  if (pasado) nb = 13;
  const pg = await e.sesion('gestor@pruebas.local', 1280);
  const fila = (id) => pg.locator(`[data-testid=tabla-asistencia] [data-person="${id}"]`);
  const texto = async (id, col) => (await fila(id).locator(`[data-col=${col}]`).innerText()).replace(/\s+/g, ' ').trim();
  const orden = () => pg.locator('[data-testid=tabla-asistencia] [role=row][data-person]').evaluateAll((f) => f.map((x) => x.getAttribute('data-person')));
  const ir = async (q = '') => { await pg.goto(`${APP}/gestion/asistencia${q}`); await pg.getByTestId('tabla-asistencia').waitFor({ timeout: 15000 }).catch(() => {}); };

  console.log('\n== Tabla (escritorio, 2026/27, plantilla actual)');
  await ir();
  const cab = await pg.locator('[role=columnheader]').allTextContents();
  ok(cab.map((x) => x.replace(/\s*[↑↓]/, '').trim()).join('|') === 'Jugador|TOTAL %|Entrenos %|Partidos %|Sin excusa|Tendencia', 'columnas: Jugador · TOTAL % · Entrenos % · Partidos % · Sin excusa · Tendencia', cab.join('|'));
  ok((await pg.getByTestId('tabla-asistencia').getAttribute('data-orden')) === 'total:desc', 'por defecto, TOTAL % de mayor a menor');
  const o0 = await orden();
  ok(!o0.includes('sint-viejo'), '«Plantilla actual»: el jugador de baja no sale', o0.join());
  ok(o0.indexOf('sint-ana') < o0.indexOf('sint-cira') && o0.indexOf('sint-cira') < o0.indexOf('sint-beto'), 'Ana, Cira, Beto por TOTAL % descendente', o0.join());
  ok((await texto('sint-ana', 'total')).startsWith('95 %') && (await texto('sint-ana', 'total')).includes('18 / 19'), 'Ana: TOTAL 95 % (18/19: ni «no convocado» ni lesión cuentan)', await texto('sint-ana', 'total'));
  ok((await texto('sint-ana', 'entrenos')).startsWith('93 %') && (await texto('sint-ana', 'entrenos')).includes('13 / 14') && (await texto('sint-ana', 'partidos')).startsWith('100 %') && (await texto('sint-ana', 'partidos')).includes('5 / 5'), 'Ana: Entrenos 93 % (13/14), Partidos 100 % (5/5)');
  ok((await texto('sint-beto', 'sin')).trim() === '8' && (await texto('sint-ana', 'sin')).trim() === '0', 'Sin excusa: Beto 8 (4+4), Ana 0');
  const color = (id, col) => fila(id).locator(`[data-col=${col}] .as-barra`).getAttribute('class');
  ok((await color('sint-ana', 'total')).includes('as-verde') && (await color('sint-beto', 'total')).includes('as-rojo') && (await color('sint-cira', 'entrenos')).includes('as-verde'), 'barrita de color: verde (Ana 95 %), rojo (Beto 35 %)', `${await color('sint-ana', 'total')} ${await color('sint-beto', 'total')}`);
  ok(/width:\s*95%/.test(await fila('sint-ana').locator('[data-col=total] .as-barra i').getAttribute('style')), 'la barra mide lo que dice el número');
  ok((await fila('sint-beto').locator('[data-col=tendencia] span').getAttribute('title')).includes('0 %') && (await fila('sint-beto').locator('[data-col=tendencia]').innerText()).trim() === '▼', 'Beto: ▼ y, en el tooltip, su 0 % de las últimas 4 semanas');
  ok((await fila('sint-ana').locator('[data-col=tendencia]').innerText()).trim() === '=' && (await fila('sint-ana').locator('[data-col=tendencia] span').getAttribute('title')).includes('100 %'), 'Ana: = (dentro de ±10 puntos), tooltip con su 100 %');
  ok((await pg.getByTestId('menos-de-5').textContent()).includes('Menos de 5 eventos') && (await orden()).at(-1) === 'sint-dani', '«Menos de 5 eventos» debajo, con Dani (3 eventos)');
  ok(await pg.getByTestId('nota-aprox').count() === 0 && await pg.getByTestId('marca-aprox').count() === 0, 'solo 2026/27: sin marca «aprox.»');
  ok((await texto('sint-beto', 'entrenos')).includes(`4 / ${nb}`), `la plataforma en vivo suma el «no voy» de un entreno pasado desde el 24/10 (Beto 4/${nb})` + (pasado ? '' : ' [sin evento pasado]'), await texto('sint-beto', 'entrenos'));

  console.log('\n== Orden por cada columna (al pulsar el encabezado)');
  for (const [col, esperado] of [['jugador', 'sint-ana,sint-beto,sint-cira'], ['entrenos', 'sint-ana,sint-cira,sint-beto'], ['partidos', 'sint-ana,sint-beto,sint-cira'], ['sin', 'sint-beto,sint-ana,sint-cira']]) {
    await ir(); await pg.getByTestId(`orden-${col}`).click(); await pg.waitForURL(new RegExp(`o=${col}`));
    let antes = pg.url();
    const o = (await orden()).filter((x) => x !== 'sint-dani');
    ok(o.slice(0, 3).join() === esperado || (col === 'sin' && o[0] === 'sint-beto'), `${col}: primer clic → ${(await pg.getByTestId('tabla-asistencia').getAttribute('data-orden'))}`, o.join());
    await pg.getByTestId(`orden-${col}`).click(); await pg.waitForURL((u) => u.href !== antes);
    const inv = (await orden()).filter((x) => x !== 'sint-dani');
    ok(inv[0] !== o[0] || new Set(o).size < 2, `${col}: segundo clic invierte el orden`, inv.join());
  }
  await ir(); await pg.getByTestId('orden-tendencia').click(); await pg.waitForURL(/o=tendencia/);
  ok((await pg.locator('[role=columnheader][aria-sort]').getAttribute('data-col')) === 'tendencia', 'tendencia: ordenable; el encabezado activo lleva aria-sort');
  await ir('?o=jugador&d=asc');
  ok((await orden())[0] === 'sint-ana' && (await pg.getByTestId('tabla-asistencia').getAttribute('data-orden')) === 'jugador:asc', 'el orden vive en la URL');

  console.log('\n== Filtros');
  await ir();
  await pg.getByRole('link', { name: 'Todos', exact: true }).first().click(); await pg.waitForURL(/ver=todos/);
  ok((await orden()).includes('sint-viejo'), '«Todos» (Ver): incluye a los antiguos');
  await ir(); await pg.getByRole('link', { name: 'Últimas 2' }).click(); await pg.waitForURL(/t=/);
  ok(/2026\/27 \+ 2025\/26/.test(await pg.locator('.gs-eyebrow').innerText()), 'atajo «Últimas 2»: 2026/27 + 2025/26');
  ok((await texto('sint-ana', 'entrenos')).startsWith('75 %') && (await texto('sint-ana', 'entrenos')).includes('33 / 44'), 'Ana, 2026/27 + 2025/26: entrenos 33/44 = 75 % (suma; 2025/26 con lo corregido a mano, no el detalle de SportEasy)', await texto('sint-ana', 'entrenos'));
  ok((await texto('sint-ana', 'total')).startsWith('75 %') && (await texto('sint-ana', 'total')).includes('48 / 64'), 'TOTAL sumando fue y faltas: 48/64 = 75 %', await texto('sint-ana', 'total'));
  ok(await pg.getByTestId('marca-aprox').count() === 0, '2025/26 no es aproximada');
  await ir(); await pg.getByRole('link', { name: 'Todas' }).click(); await pg.waitForURL(/t=/);
  ok(await pg.getByTestId('nota-aprox').isVisible() && (await fila('sint-ana').getByTestId('marca-aprox').count()) > 0, 'con 2018/19: nota y marca «aprox.»');
  ok(await fila('sint-beto').getByTestId('marca-aprox').count() === 0, 'quien no tiene datos antiguos no lleva la marca');
  await ir('?t=2026-27,2025-26'); await pg.getByRole('link', { name: '2025/26', exact: true }).click(); await pg.waitForURL((u) => !u.search.includes('2025-26'));
  ok(!/2025\/26/.test(await pg.locator('.gs-eyebrow').innerText()), 'los chips de temporada se quitan y se ponen (selección múltiple)');
  await ir('?eq=MdA');
  ok((await texto('sint-ana', 'partidos')).includes('5 / 5'), 'Equipo MdA: los partidos de MdA');
  ok((await texto('sint-beto', 'partidos')).startsWith('—'), 'Equipo MdA: Beto (solo MdL) sin partidos', await texto('sint-beto', 'partidos'));
  ok((await texto('sint-beto', 'entrenos')).includes(`4 / ${nb}`), 'los entrenos son comunes a los dos equipos');
  await ir('?eq=MdL');
  ok((await texto('sint-beto', 'partidos')).includes('2 / 5') && (await texto('sint-ana', 'partidos')).startsWith('—'), 'Equipo MdL: partidos de MdL');
  await ir('?p=4s');
  ok((await texto('sint-beto', 'total')).startsWith('0 %') && (await texto('sint-ana', 'total')).startsWith('100 %'), 'Periodo «Últimas 4 semanas»: solo lo reciente (Ana 100 %, Beto 0 %)', await texto('sint-beto', 'total'));
  ok((await pg.getByTestId('menos-de-5').count()) === 1, 'con 4 semanas, casi todos tienen menos de 5 eventos: van debajo');

  console.log('\n== 2025/26 manda lo corregido; por equipo, según SportEasy');
  await ir('?t=2025-26');
  ok((await texto('sint-ana', 'total')).includes('30 / 45') && (await texto('sint-ana', 'sin')).trim() === '0', 'Ana 2025/26: 30/45 = lo corregido (el detalle de SportEasy daba 25/30 en entrenos), sin excusa 0', await texto('sint-ana', 'total'));
  await ir('?t=2025-26&eq=MdA');
  ok(await pg.getByTestId('nota-segun-sporteasy').isVisible(), '2025/26 por equipo: nota de que los partidos salen del detalle de SportEasy');

  console.log('\n== Ficha del jugador');
  await ir(); await fila('sint-ana').getByRole('link', { name: 'Ana' }).click(); await pg.waitForURL(/\/gestion\/asistencia\/sint-ana/);
  ok((await pg.getByTestId('ficha-nombre').textContent()) === 'Ana', 'al pulsar el nombre, su ficha');
  const filasT = await pg.locator('[data-testid=ficha-temporadas] tbody tr').evaluateAll((f) => f.map((x) => [x.getAttribute('data-temporada'), x.innerText.replace(/\s+/g, ' ')]));
  ok(filasT.map((x) => x[0]).join() === '2026-27,2025-26,2018-19', '% por temporada (más reciente primero)', JSON.stringify(filasT));
  ok(filasT[1][1].includes('67 %') && filasT[1][1].includes('20 / 30') && filasT[1][1].includes('10 / 15') && filasT[1][1].includes('30 / 45'), '2025/26: lo corregido (entrenos 20/30; partidos 10/15; total 30/45)', filasT[1][1]);
  ok(/aprox/.test(filasT[2][1]) && filasT[2][1].includes('50 %'), '2018/19: aprox., 50 %');
  ok(filasT[0][1].includes('95 %'), '2026/27: 95 %');
  const mot = await pg.getByTestId('ficha-motivos').innerText();
  ok(/lesión ×/.test(mot) && /con excusa ×/.test(mot), 'motivos más frecuentes', mot);
  const ult = await pg.locator('[data-testid=ficha-ultimos] li').evaluateAll((f) => f.map((x) => x.getAttribute('data-estado')));
  ok(ult.length === 10, 'sus últimos 10 eventos', String(ult.length));
  await pg.goto(`${APP}/gestion/asistencia/sint-dani`);
  ok(await pg.getByTestId('segun-sporteasy').count() > 0, 'los eventos de 2025/26 van marcados «según SportEasy»');
  ok((await pg.locator('[data-testid=ficha-ultimos] li').allInnerTexts()).some((t) => /Partido MdA/.test(t) && /con excusa/.test(t)), 'un partido con su equipo y su estado');
  await pg.goto(`${APP}/gestion/asistencia/sint-beto`);
  ok(/viaje ×1/.test(await pg.getByTestId('ficha-motivos').innerText()) || !pasado, 'el motivo de la plataforma (viaje) sale en la ficha');
  const x404 = await pg.goto(`${APP}/gestion/asistencia/nadie-existe`);
  ok(x404.status() === 404, 'persona sin datos: 404');

  console.log('\n== Móvil 375 px');
  const pm = await e.sesion('gestor@pruebas.local', 375);
  await pm.goto(`${APP}/gestion/asistencia`);
  await pm.getByTestId('tabla-asistencia').waitFor({ timeout: 15000 });
  ok(await pm.locator('details[data-testid=filtros][open]').count() === 0, 'filtros plegados en el móvil');
  await pm.getByTestId('filtros').locator('summary').click();
  ok(await visto(pm.getByRole('link', { name: 'Últimas 4 semanas' })), 'se despliegan al pulsar');
  await pm.getByTestId('filtros').locator('summary').click();
  const caja = async (col) => pm.locator(`[data-person="sint-ana"] [data-col=${col}]`).boundingBox();
  const [bj, bt, bs, be, bp, bd] = await Promise.all(['jugador', 'total', 'sin', 'entrenos', 'partidos', 'tendencia'].map(caja));
  ok(bj.x + bj.width <= 376 && bt.x + bt.width <= 376 && bs.x + bs.width <= 376, 'sin desplazar se ven Jugador, TOTAL % y Sin excusa', JSON.stringify([bj, bt, bs].map((b) => Math.round(b.x + b.width))));
  ok(be.x + be.width > 376 && bp.x + bp.width > 376 && bd.x + bd.width > 376, 'Entrenos, Partidos y Tendencia no caben: se ven con desplazamiento lateral (Entrenos asoma a la derecha)', JSON.stringify([be, bp, bd].map((b) => Math.round(b.x + b.width))));
  ok(await pm.getByTestId('tabla-asistencia').evaluate((t) => t.scrollWidth > t.clientWidth), 'la tabla se desplaza en horizontal');
  ok(await sinDesbordar(pm), 'la página no se desborda');
  await foto(pm, 'asistencia_movil', false);
  await pm.getByTestId('tabla-asistencia').evaluate((t) => { t.scrollLeft = t.scrollWidth; });
  ok((await caja('tendencia')).x + (await caja('tendencia')).width <= 376, 'al desplazar se llega a Tendencia');
  await pm.getByTestId('tabla-asistencia').evaluate((t) => { t.scrollLeft = 0; });
  await pm.goto(`${APP}/gestion/asistencia/sint-ana`);
  ok(await sinDesbordar(pm), 'ficha a 375 px: sin desbordar');
  await foto(pm, 'asistencia_ficha_movil');
  await pg.goto(`${APP}/gestion/asistencia`);
  await foto(pg, 'asistencia_escritorio');
  ok(!e.errores.length, 'sin errores de JS en la consola', e.errores.join(' | '));
} catch (err) {
  console.log(`  FALLO ${err.stack}`); sumar();
} finally {
  await e.parar();
}
console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK');
process.exit(fallos() ? 1 : 0);
