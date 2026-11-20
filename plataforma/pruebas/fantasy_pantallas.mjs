#!/usr/bin/env node
// MdFantasy (D196) en pantalla: pila local, web compilada y Chrome, a 375 y 1280 px. Jugadores SINTÉTICOS, calendario y
// reloj de prueba (D185; hoy = lunes 19/10/2026). Nunca imprime datos privados.
//   - Apagado: nadie ve «MdFantasy» en el menú ni entra. Un gestor lo enciende en Ajustes.
//   - Encendido: la entrada sale en la barra (jugador 5, gestor 6) y lleva a las cinco pestañas (en la URL).
//   - Crear equipo, alinear (capitán y vicecapitán), vender y fichar, porra; la alineación de otro no se ve antes del cierre.
//   - Tras puntuar: Jornada (total, desglose, quinteto ideal), Ranking (podio, pestañas, premios, resumen para WhatsApp)
//     y la carta de jugador. Norma de interfaz: contadores pulsables, nombres que son enlaces, «‹» volver, 44 px, sin desbordar.
//   - «¿Faltó alguien ayer?» (fase 4): «Vinieron todos», marcar un ausente y corregir; se guarda como pase de lista.
//   npm run pruebas:fantasy-pantallas
import { preparar, personas, sinteticos, contador, visto, sinDesbordar, pequenos, trasAccion, hasta, foto } from './comun_e2e.mjs';
import { cerrarJornada } from '../src/lib/fantasy/cierre.ts';
import { PARAMETROS } from '../src/lib/fantasy/reglas.ts';

const { ok, fallos, sumar } = contador();
// La web lleva la clave de servicio DE LA PILA (nunca la real): al corregir la asistencia vuelve a puntuar al momento.
const e = await preparar({ envExtra: async (pila) => ({ SUPABASE_SERVICE_ROLE_KEY: await pila.firmar({ role: 'service_role', iss: 'supabase-local' }, 3600 * 24) }) });
const { sql, APP, pila } = e;
try {
  await sinteticos(sql, [['sint-fp-ana', 'Ana', true, true], ['sint-fp-beto', 'Beto', true, true], ['sint-fp-gema', 'Gema', true, true]]);
  await personas(pila, { jugadores: [['sint-fp-ana', 'ana@pruebas.local'], ['sint-fp-beto', 'beto@pruebas.local']], gestores: [['Gema', 'gema@pruebas.local', 'sint-fp-gema']] });
  const SERVICIO = await pila.firmar({ role: 'service_role' });
  const rpc = async (f, a) => { const r = await fetch(`${pila.url}/rest/v1/rpc/${f}`, { method: 'POST', headers: { apikey: pila.anonKey, authorization: `Bearer ${SERVICIO}`, 'content-type': 'application/json' }, body: JSON.stringify(a ?? {}) }); const d = await r.json().catch(() => null); if (r.status >= 400) throw new Error(`${f}: ${d?.message}`); return d; };
  const puntuar = async () => { for (const { fecha } of await rpc('fantasy_pendientes')) await rpc('fantasy_guardar_jornada', { p: cerrarJornada(await rpc('fantasy_datos_jornada', { p_fecha: fecha })).guardar }); };
  const oficial = new Map((await sql`select person_id, nombre_oficial from public.jugadores`).map((x) => [x.person_id, x.nombre_oficial]));
  const hoja = (id) => oficial.get(id).normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();
  const reales = (await sql`select person_id from public.jugadores where activo and rol = 'jugador' and ficha_mda and ficha_mdl and person_id not like 'sint-%' order by person_id limit 12`).map((x) => x.person_id);
  async function publicar(jornada, fecha, equipo, favor, contra, ids, base) {
    const [p] = await sql`insert into public.liga_partidos (temporada, grupo, jornada, fecha, local, visitante, pts_local, pts_visitante, nuestro)
      values ('2026-27', ${equipo === 'MdA' ? 'G1' : 'G2'}, ${jornada}, ${fecha}, ${equipo}, ${`Rival ${jornada}${equipo}`}, ${favor}, ${contra}, true) returning id`;
    let i = 0;
    for (const id of ids) { await sql`insert into public.liga_estadisticas_jugador (partido_id, equipo, dorsal, nombre, segundos, pts, mas_menos) values (${p.id}, ${equipo}, ${String(i + 1)}, ${hoja(id)}, 1800, ${Math.max(0, base - 2 * i)}, ${6 - i})`; i++; }
  }
  await publicar(1, '2026-10-04', 'MdA', 60, 40, reales.slice(0, 8), 20);
  await publicar(1, '2026-10-04', 'MdL', 50, 55, reales.slice(4, 12), 16);
  await publicar(2, '2026-10-18', 'MdA', 70, 30, reales.slice(0, 8), 22);
  await publicar(2, '2026-10-18', 'MdL', 44, 40, reales.slice(4, 12), 14);
  await puntuar();

  const ana = await e.sesion('ana@pruebas.local', 375);
  const gema = await e.sesion('gema@pruebas.local', 375);
  const barra = (p) => p.getByTestId('barra').locator('a').allTextContents();

  console.log('\n== Apagado');
  await ana.goto(`${APP}/mdfantasy`);
  ok(await visto(ana.getByTestId('fz-apagado')) && !(await ana.getByTestId('fz-pestanas').count()), 'apagado: el jugador ve una línea y nada más');
  ok((await barra(ana)).join('·') === 'Semana·Calendario·Liga·Club', 'apagado: la barra del jugador es la de siempre', (await barra(ana)).join('·'));
  await gema.goto(`${APP}/mdfantasy/ajustes`);
  ok(await visto(gema.getByTestId('fz-ajustes')), 'un gestor entra en Ajustes aunque esté apagado');
  await ana.goto(`${APP}/mdfantasy/ajustes`);
  ok(!(await ana.getByTestId('fz-ajustes').count()), 'un jugador no entra en Ajustes');

  console.log('\n== Un gestor lo enciende y cambia un parámetro');
  await gema.getByTestId('fz-modo-todos').check();
  await gema.getByTestId('fz-p-porraAcierto').fill('4');
  await trasAccion(gema, () => gema.getByTestId('fz-guardar-ajustes').click());
  ok(await hasta(async () => { const [c] = await sql`select modo, parametros from public.fantasy_config`; return c.modo === 'todos' && c.parametros.porraAcierto === 4 && Object.keys(c.parametros).length === 1; }), 'guardado: modo «todos» y solo el parámetro cambiado');
  ok(!(await pequenos(gema, 'main button, main a, main input[type=number]')).length && await sinDesbordar(gema), 'Ajustes a 375 px: objetivos de 44 px, sin desbordar', JSON.stringify(await pequenos(gema, 'main button, main a, main input[type=number]')));
  await gema.getByTestId('fz-p-porraAcierto').fill(String(PARAMETROS.porraAcierto));
  await trasAccion(gema, () => gema.getByTestId('fz-guardar-ajustes').click());
  ok(await hasta(async () => Object.keys((await sql`select parametros from public.fantasy_config`)[0].parametros).length === 0), 'volver al valor de salida lo quita de lo cambiado');

  console.log('\n== Encendido: menú y alta');
  await ana.goto(`${APP}/mdfantasy`);
  ok(await visto(ana.getByTestId('fz-bienvenida')), 'encendido: el jugador ve «Hazte mánager»');
  ok(await hasta(async () => (await barra(ana)).join('·') === 'Semana·Calendario·Liga·Club·MdFantasy'), 'la barra del jugador suma «MdFantasy» (5)', (await barra(ana)).join('·'));
  ok((await ana.getByTestId('barra').locator('a[aria-current="page"]').textContent()) === 'MdFantasy' && (await ana.getByTestId('titulo-seccion').textContent()) === 'MdFantasy', 'la entrada queda marcada y la cabecera dice MdFantasy');
  await gema.goto(`${APP}/mdfantasy`);
  ok(await hasta(async () => (await barra(gema)).join('·') === 'Semana·Calendario·Liga·Club·MdFantasy·Gestión'), 'la barra del gestor: 6 entradas', (await barra(gema)).join('·'));
  ok(!(await pequenos(gema, '[data-testid="barra"] a')).length && await sinDesbordar(gema), 'con 6 entradas a 375 px, cada una mide al menos 44 px y nada desborda', JSON.stringify(await pequenos(gema, '[data-testid="barra"] a')));
  await trasAccion(ana, () => ana.getByTestId('fz-crear').click());
  ok(await hasta(async () => (await sql`select count(*)::int n from public.fantasy_copias where manager = 'sint-fp-ana'`)[0].n === PARAMETROS.plantilla), 'crear equipo: plantilla de 7');
  ok(await visto(ana.getByTestId('fz-cierre')) && await visto(ana.getByTestId('fz-cuenta-atras')) && /\d+ d \d+ h/.test(await ana.getByTestId('fz-cuenta-atras').textContent()), 'Inicio: aviso de alineación con cuenta atrás', await ana.getByTestId('fz-cuenta-atras').textContent().catch(() => ''));
  ok((await ana.getByTestId('fz-estado-alineacion').textContent()).includes('5 alineados'), 'Inicio: la alineación por defecto está completa');
  ok(await visto(ana.getByTestId('fz-cifras')) && await visto(ana.getByTestId('fz-duelo')) && await visto(ana.getByTestId('fz-porra')) && await visto(ana.getByTestId('fz-logros')), 'Inicio: puesto y puntos, duelo, porra y logros');
  await ana.getByTestId('fz-apuntados-managers').click();
  ok(await visto(ana.getByTestId('fz-apuntados-lista').getByRole('link', { name: 'Ana' })), 'contador de mánagers pulsable: despliega los nombres, que son enlaces');
  await ana.getByTestId('fz-apuntados-managers').click();
  ok(!(await ana.getByTestId('fz-apuntados-lista').count()), '…y otro toque lo cierra');
  await trasAccion(ana, () => ana.getByTestId('fz-porra-MdA-gana').click());
  ok(await hasta(async () => (await sql`select pronostico from public.fantasy_porras where manager = 'sint-fp-ana' and equipo = 'MdA'`)[0]?.pronostico === 'gana'), 'porra: un toque la guarda');
  ok(await sinDesbordar(ana) && !(await pequenos(ana, 'main button, main a.boton, main .fz-pestanas a, main .num-caja')).length, 'Inicio a 375 px: sin desbordar y con objetivos de 44 px', JSON.stringify(await pequenos(ana, 'main button, main a.boton, main .fz-pestanas a, main .num-caja')));
  await foto(ana, 'fantasy_inicio_375');

  console.log('\n== Plantilla');
  await ana.getByTestId('fz-pestanas').getByRole('link', { name: 'Plantilla' }).click();
  await ana.waitForURL(/tab=plantilla/);
  ok(await visto(ana.getByTestId('fz-alineador')) && (await ana.locator('[data-testid^="fz-titular-"]').count()) === 5, 'la pista con los 5 alineados');
  const antes = (await sql`select titulares, capitan, vice from public.fantasy_alineaciones where manager = 'sint-fp-ana'`)[0];
  const nuevoCap = antes.titulares.find((x) => x !== antes.capitan && x !== antes.vice);
  await ana.getByTestId(`fz-cap-${nuevoCap}`).click();
  ok(await visto(ana.getByTestId('fz-sin-guardar')), 'avisa de que hay cambios sin guardar');
  await trasAccion(ana, () => ana.getByTestId('fz-guardar-alineacion').click());
  ok(await hasta(async () => (await sql`select capitan from public.fantasy_alineaciones where manager = 'sint-fp-ana'`)[0].capitan === nuevoCap), 'cambiar el capitán y guardar');
  ok(await sinDesbordar(ana) && !(await pequenos(ana, 'main .fz-ficha-botones button, main .fz-banquillo button, main .fz-guardar button')).length, 'Plantilla a 375 px: sin desbordar y botones de 44 px', JSON.stringify(await pequenos(ana, 'main .fz-ficha-botones button, main .fz-banquillo button, main .fz-guardar button')));
  await foto(ana, 'fantasy_plantilla_375');

  console.log('\n== Mercado');
  await ana.goto(`${APP}/mdfantasy?tab=mercado`);
  const cajaAntes = Number((await sql`select public._fantasy_caja('sint-fp-ana') c`)[0].c);
  const vendo = (await sql`select c.jugador, f.valor from public.fantasy_copias c join public.fantasy_jugadores f on f.person_id = c.jugador where c.manager = 'sint-fp-ana' order by f.valor desc, c.jugador limit 1`)[0];
  await ana.getByTestId(`fz-vender-${vendo.jugador}`).click();
  await trasAccion(ana, () => ana.getByTestId(`fz-vender-si-${vendo.jugador}`).click());
  ok(await hasta(async () => Number((await sql`select public._fantasy_caja('sint-fp-ana') c`)[0].c) === cajaAntes + Number(vendo.valor)), 'vender: confirmación en línea y la caja sube su valor');
  ok(await hasta(async () => (await ana.getByTestId('fz-caja').textContent()).startsWith(String(cajaAntes + Number(vendo.valor)).replace('.', ','))), 'la caja de la pantalla se actualiza');
  const ficho = (await sql`select f.person_id from public.fantasy_jugadores f where f.en_mercado and f.person_id not in ('sint-fp-ana', ${vendo.jugador}) and public._fantasy_libres(f.person_id) > 0
    and not exists (select 1 from public.fantasy_copias c where c.jugador = f.person_id and c.manager = 'sint-fp-ana') order by f.valor, f.person_id limit 1`)[0].person_id;
  await ana.getByTestId(`fz-fichar-${ficho}`).click();
  await trasAccion(ana, () => ana.getByTestId(`fz-fichar-si-${ficho}`).click());
  ok(await hasta(async () => (await sql`select 1 from public.fantasy_copias where manager = 'sint-fp-ana' and jugador = ${ficho}`).length === 1), 'fichar una copia libre');
  ok(await visto(ana.getByTestId('fz-movimientos').getByText(/Vende a|Ficha a/).first()), 'los movimientos salen en la lista');
  ok(await visto(ana.getByTestId('fz-jugador-sint-fp-ana').getByText('Eres tú')), 'su propia copia no se puede fichar');
  ok(await sinDesbordar(ana) && !(await pequenos(ana, 'main .fz-mercado button')).length, 'Mercado a 375 px: sin desbordar y botones de 44 px');
  await foto(ana, 'fantasy_mercado_375');

  console.log('\n== La alineación de otro no se ve antes del cierre');
  const beto = await e.sesion('beto@pruebas.local', 1280);
  await beto.goto(`${APP}/mdfantasy`);
  await trasAccion(beto, () => beto.getByTestId('fz-crear').click());
  await beto.goto(`${APP}/mdfantasy?tab=plantilla&m=sint-fp-ana`);
  ok(await visto(beto.getByTestId('fz-oculta')) && await visto(beto.getByTestId('fz-plantilla-otro')) && !(await beto.locator('.fz-galon').count()), 'otro mánager: se ve su plantilla, no su alineación ni su capitán');
  ok(!(await beto.content()).includes('"capitan"'), 'el HTML tampoco lleva su capitán');
  ok(await visto(beto.getByTestId('nav-principal').or(beto.getByRole('navigation', { name: 'Principal' })).getByRole('link', { name: 'MdFantasy' })), 'escritorio: «MdFantasy» en el menú de la cabecera');

  console.log('\n== Tras puntuar una jornada: Jornada, Ranking y carta');
  await sql`update public.fantasy_managers set alta_en = alta_en - interval '2 days'`;
  await sql`update public.eventos set fecha = '2026-10-19', inicio = '09:00' where fecha = '2026-10-25' and tipo = 'liga'`;
  for (const t of ['fantasy_alineaciones', 'fantasy_porras', 'fantasy_movimientos']) await sql.unsafe(`update public.${t} set jornada = '2026-10-19' where jornada = '2026-10-25'`);
  const al = (await sql`select titulares, capitan from public.fantasy_alineaciones where manager = 'sint-fp-ana'`)[0];
  await publicar(3, '2026-10-19', 'MdA', 66, 50, al.titulares, 18);
  await publicar(3, '2026-10-19', 'MdL', 40, 52, reales.slice(4, 12), 10);
  await ana.goto(`${APP}/mdfantasy`);
  ok((await ana.getByTestId('fz-cierre').textContent()).includes('En juego'), 'empezado el primer partido: «En juego»');
  await ana.goto(`${APP}/mdfantasy?tab=mercado`);
  ok(await visto(ana.getByTestId('fz-mercado-bloqueo')) && !(await ana.locator('main .fz-mercado button').count()), 'mercado cerrado: aviso y ningún botón de operar');
  await puntuar();
  const total = Number((await sql`select total from public.fantasy_puntos_manager where manager = 'sint-fp-ana' and jornada = '2026-10-19'`)[0].total);
  await ana.goto(`${APP}/mdfantasy?tab=jornada`);
  ok((await ana.getByTestId('fz-mi-total').textContent()) === String(total).replace('.', ','), 'Jornada: mi total', `${await ana.getByTestId('fz-mi-total').textContent()} / ${total}`);
  ok(await visto(ana.getByTestId('fz-desglose')) && (await ana.getByTestId('fz-desglose').locator('tbody tr').count()) === al.titulares.length && (await ana.getByTestId('fz-desglose').locator('thead').textContent()).includes('Rend.') && (await ana.getByTestId('fz-desglose').locator('thead').textContent()).includes('Comp.'), 'desglose por jugador, con rendimiento y compromiso por separado');
  ok(await visto(ana.getByTestId('fz-ideal')) && (await ana.getByTestId('fz-ideal').locator('.fz-ficha').count()) === 5, 'quinteto ideal');
  {
    const dia = (await sql`select total from public.fantasy_puntos_manager where jornada = '2026-10-19'`).map((x) => Number(x.total));
    const media = Math.round((dia.reduce((s2, v) => s2 + v, 0) / dia.length) * 10) / 10;
    const dif = Math.round((total - media) * 10) / 10;
    const es = (n) => String(n).replace('.', ',');
    const espero = dif > 0 ? `+${es(dif)} sobre la media` : dif < 0 ? `-${es(-dif)} bajo la media` : 'En la media';
    ok((await ana.getByTestId('fz-frente-texto').textContent()) === espero, 'Jornada: la diferencia con la media de la liga, en cifra', `${await ana.getByTestId('fz-frente-texto').textContent()} / ${espero}`);
    const barra = await ana.evaluate(() => { const q = (t) => document.querySelector(`[data-testid="${t}"]`).getBoundingClientRect(); const c = q('fz-frente'); return { mio: q('fz-frente-mio').width, media: q('fz-frente-media').left - q('fz-frente-mio').left, ancho: c.width }; });
    ok(barra.mio > 0 && barra.media > 0 && (total > media) === (barra.mio > barra.media) && barra.mio <= barra.ancho, 'la barra compara mi total con la media (la raya)', JSON.stringify(barra));
    await foto(ana, 'fantasy_jornada_375');
    await ana.getByTestId(`fz-fila-${al.titulares[1]}`).locator('td').nth(1).click();
    await ana.waitForURL(new RegExp(`/mdfantasy/jugador/${al.titulares[1]}`));
    ok(true, 'cada fila del desglose lleva a la carta del jugador (también pulsando en los números)');
    await ana.goto(`${APP}/mdfantasy?tab=jornada`);
    const bajas = await ana.evaluate(() => [...document.querySelectorAll('main .fz-tabla tbody a')].filter((a) => a.getBoundingClientRect().height < 44).length);
    ok(bajas === 0, 'las filas-enlace miden al menos 44 px de alto', String(bajas));
  }
  ok((await ana.getByTestId('fz-jornadas').locator('a').count()) === 3 && (await ana.getByTestId('fz-jornadas').locator('a[aria-current="page"]').textContent()) === '19/10', 'las jornadas, como chips (en la URL)');
  await ana.getByTestId('fz-jornadas').getByRole('link', { name: '4/10' }).click();
  await ana.waitForURL(/j=2026-10-04/);
  ok((await ana.getByTestId('fz-mi-total').textContent()) === '—', 'una jornada anterior a mi alta: sin total, con los puntos de los jugadores');
  ok(await sinDesbordar(ana), 'Jornada a 375 px sin desbordar');
  await ana.goto(`${APP}/mdfantasy?tab=ranking`);
  ok(await visto(ana.getByTestId('fz-podio')) && (await ana.getByTestId('fz-podio').locator('li').count()) === 2, 'Ranking: podio');
  {
    const alto = await ana.evaluate(() => [1, 2, 3].map((n) => document.querySelector(`.fz-podio-${n} .fz-podio-escalon`)?.getBoundingClientRect()).map((r) => (r ? { h: Math.round(r.height), x: Math.round(r.left), base: Math.round(r.bottom) } : null)));
    ok(alto[0] && alto[1] && alto[0].h > alto[1].h && alto[1].x < alto[0].x && alto[0].base === alto[1].base && (await ana.locator('.fz-podio-1 .fz-podio-escalon').textContent()) === '1', 'podio con escalones: el primero más alto y a la derecha del segundo, con el puesto dentro', JSON.stringify(alto));
  }
  for (const r of ['jugadores', 'compromiso', 'duelos']) { await ana.getByTestId('fz-sub').getByRole('link', { name: r === 'jugadores' ? 'Jugadores' : r === 'compromiso' ? 'Compromiso' : 'Duelos' }).click(); await ana.waitForURL(new RegExp(`r=${r}`)); if (!(await visto(ana.getByTestId(`fz-ranking-${r}`)))) ok(false, `pestaña ${r}`); }
  ok(true, 'pestañas de mánagers, jugadores, compromiso y duelos (en la URL)');
  ok(await visto(ana.getByTestId('fz-premios')) && (await ana.getByTestId('fz-premios').textContent()).includes('octubre'), 'premios del mes');
  ok((await ana.getByTestId('fz-resumen').textContent()).includes('MdFantasy · jornada del 19/10') && await visto(ana.getByTestId('fz-copiar-resumen')), 'resumen para WhatsApp con su botón de copiar');
  ok(await sinDesbordar(ana) && !(await pequenos(ana, 'main .fz-chips a, main .fz-orden a, main .fz-podio a, main button')).length, 'Ranking a 375 px: sin desbordar y con objetivos de 44 px', JSON.stringify(await pequenos(ana, 'main .fz-chips a, main .fz-orden a, main .fz-podio a, main button')));
  await foto(ana, 'fantasy_ranking_375');

  console.log('\n== Los tres retoques de aspecto, a 1280 px');
  await beto.goto(`${APP}/mdfantasy?tab=plantilla`);
  const pista = async (p) => p.evaluate(() => { const e = document.querySelector('.fz-pista'); const c = getComputedStyle(e); return { fondo: c.backgroundImage.includes('svg') && c.backgroundImage.includes('f3c519'), fichas: e.querySelectorAll('.fz-ficha').length, botones: e.querySelectorAll('.fz-ficha-botones button').length }; });
  const pb = await pista(beto);
  ok(pb.fondo && pb.fichas === 5 && await sinDesbordar(beto), 'Plantilla a 1280 px: media pista dibujada de fondo y las 5 tarjetas', JSON.stringify(pb));
  await foto(beto, 'fantasy_plantilla_1280');
  await beto.goto(`${APP}/mdfantasy?tab=jornada`);
  ok(await visto(beto.getByTestId('fz-frente')) && /media/.test(await beto.getByTestId('fz-frente-texto').textContent()) && await sinDesbordar(beto), 'Jornada a 1280 px: barra frente a la media y diferencia', await beto.getByTestId('fz-frente-texto').textContent());
  await foto(beto, 'fantasy_jornada_1280');
  await beto.goto(`${APP}/mdfantasy?tab=ranking`);
  ok(await visto(beto.locator('.fz-podio-1 .fz-podio-escalon')) && await sinDesbordar(beto), 'Ranking a 1280 px: podio con escalones');
  await foto(beto, 'fantasy_ranking_1280');
  await ana.goto(`${APP}/mdfantasy?tab=plantilla`);
  const pa2 = await pista(ana);
  ok(pa2.fondo && pa2.fichas === 5 && await sinDesbordar(ana), 'Plantilla a 375 px: media pista de fondo, las 5 tarjetas igual', JSON.stringify(pa2));
  await foto(ana, 'fantasy_plantilla_375_pista');
  await ana.goto(`${APP}/mdfantasy?tab=ranking`);
  await ana.goto(`${APP}/mdfantasy?tab=ranking&r=jugadores`);
  await ana.getByTestId('fz-ranking-jugadores').locator('a').first().click();
  await ana.waitForURL(/\/mdfantasy\/jugador\//);
  ok(await visto(ana.getByTestId('fz-carta')) && await visto(ana.getByTestId('fz-carta-media')) && await visto(ana.getByTestId('fz-carta-ultimas')) && await visto(ana.getByTestId('fz-carta-insignias')) && await visto(ana.getByTestId('fz-compartir')), 'carta: media, origen de los puntos, últimas jornadas, insignias y compartir');
  await ana.getByTestId('fz-duenos-duenos').click();
  ok(await visto(ana.getByTestId('fz-duenos-lista')), 'carta: «N mánagers lo tienen» despliega quiénes');
  ok((await ana.getByTestId('volver').getAttribute('href')).startsWith('/mdfantasy?tab=ranking'), 'el «‹» vuelve a la pestaña de la que se venía', await ana.getByTestId('volver').getAttribute('href'));
  ok(await sinDesbordar(ana), 'carta a 375 px sin desbordar');
  await foto(ana, 'fantasy_carta_375');
  ok(!/\(D\d+\)/.test(await ana.content()), 'sin códigos «(Dnn)» en el texto');

  console.log('\n== «¿Faltó alguien ayer?» (fase 4)');
  const [ent] = await sql`select id from public.eventos where tipo = 'entreno' and oficial and estado = 'programado' and fecha < '2026-10-19' order by fecha desc limit 1`;
  await sql`delete from public.asistencia_eventos where origen = 'sporteasy'`;
  await sql`insert into public.respuestas (evento_id, person_id, respuesta, origen, fuente) values (${ent.id}, 'sint-fp-ana', 'va', 'jugador', 'web'), (${ent.id}, 'sint-fp-beto', 'va', 'jugador', 'web')`;
  await ana.goto(`${APP}/evento/${ent.id}/asistencia`);
  ok(!(await ana.getByTestId('asistencia-form').count()), 'un jugador no entra en la asistencia real');
  await gema.goto(`${APP}/evento/${ent.id}/asistencia`);
  ok(await visto(gema.getByTestId('asistencia-form')) && await visto(gema.getByTestId('asistencia-falto-sint-fp-ana')) && await visto(gema.getByTestId('asistencia-vino-sint-fp-gema')), 'el gestor ve a los que dijeron «voy» y la lista de «vino sin avisar»');
  await trasAccion(gema, () => gema.getByTestId('asistencia-todos').click());
  ok(await hasta(async () => (await sql`select count(*)::int n from public.asistencia_eventos where evento_ref = ${ent.id} and origen = 'plataforma' and estado = 'fue'`)[0].n === 2), '«Vinieron todos»: los dos que dijeron «voy» quedan como que fueron');
  ok(await visto(gema.getByTestId('asistencia-respondida')), 'queda respondido (vale la primera respuesta)…');
  await gema.getByTestId('asistencia-falto-sint-fp-beto').check();
  await gema.getByTestId('asistencia-vino-sint-fp-gema').check();
  await trasAccion(gema, () => gema.getByTestId('asistencia-guardar').click());
  ok(await hasta(async () => { const f = await sql`select person_id, estado from public.asistencia_eventos where evento_ref = ${ent.id} and origen = 'plataforma'`; return f.find((x) => x.person_id === 'sint-fp-beto')?.estado === 'sin_excusa' && f.find((x) => x.person_id === 'sint-fp-gema')?.estado === 'fue'; }), '…y se puede corregir: un ausente y uno que vino sin avisar');
  ok(await sinDesbordar(gema) && !(await pequenos(gema, 'main button, main label.fz-casilla')).length, '«¿Faltó alguien?» a 375 px: sin desbordar y con objetivos de 44 px', JSON.stringify(await pequenos(gema, 'main button, main label.fz-casilla')));
  await foto(gema, 'fantasy_asistencia_375');

  console.log('\n== Corregir un «no vino»: se recalcula al momento, sin esperar a la tarea');
  const noVino = async () => (await sql`select count(*)::int n from public.fantasy_puntos_jugador where person_id = 'sint-fp-beto' and detalle::text like '%no vino%'`)[0].n;
  const compBeto = async () => Number((await sql`select coalesce(sum(compromiso), 0) c from public.fantasy_puntos_jugador where person_id = 'sint-fp-beto'`)[0].c);
  ok(await hasta(async () => (await noVino()) === 1), 'marcado «faltó» desde la pantalla: sus puntos ya llevan el «no vino»', String(await noVino()));
  const conFalta = await compBeto();
  await ana.goto(`${APP}/mdfantasy/jugador/sint-fp-beto`);
  const carta = await ana.getByTestId('fz-carta').textContent();
  ok(carta.includes('no vino') && !/plant[oó]n|excusa|motivo/i.test(carta), 'los demás lo ven en su carta con texto neutro («no vino»), sin motivo', (carta.match(/plant[oó]n|excusa|motivo/i) ?? ['falta «no vino»: ' + carta.slice(-400)])[0]);
  await gema.goto(`${APP}/evento/${ent.id}/asistencia`);
  await gema.getByTestId('asistencia-falto-sint-fp-beto').uncheck();
  await trasAccion(gema, () => gema.getByTestId('asistencia-guardar').click());
  ok(await hasta(async () => (await noVino()) === 0), 'corregido («sí vino»): el «no vino» desaparece al momento');
  ok((await compBeto()) - conFalta === PARAMETROS.entrenoAsistido - PARAMETROS.planton, 'y recupera los puntos (de −5 a +3)', `${await compBeto()} / ${conFalta}`);

  ok(!e.errores.length, 'sin errores de JavaScript en la consola', e.errores.slice(0, 3).join(' | '));
} catch (err) { console.log(`  FALLO ${err.stack}`); sumar(); }
finally { await e.parar(); }
console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK');
process.exit(fallos() ? 1 : 0);
