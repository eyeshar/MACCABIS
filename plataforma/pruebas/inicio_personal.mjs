#!/usr/bin/env node
// La Semana (D189; antes el inicio personal de D117), de extremo a extremo: pila local, web compilada y Chrome.
//   - anonimo: «/» es la portada publica de siempre; /mi-zona redirige a «/» (308);
//   - jugador: «Esta semana» y el rango; «Te faltan N» con carrusel y contador «1 de N» (planes y lo oficial de los
//     proximos 14 dias sin responder, D172), con Voy / No voy / Duda en cada tarjeta; el plazo en una linea; las tarjetas
//     de los proximos 10 dias (estado, hora y quedada, su equipo, la equipacion de D160 con su dorsal, avisos plegados,
//     «tu grupo»); abajo «Calendario completo», «+ Proponer un plan» y «Tu temporada»; nada de SportEasy;
//   - el nombre y la posicion, en Yo; nunca el nivel;
//   - gestor: «Gestión · N pendientes» y la franja GESTIÓN en cada tarjeta;
//   - 375 y 1280 px sin desbordamiento ni errores de consola. Capturas en privado/mockups_liga/inicio-y-planes/.
//
//   npm run pruebas:inicio-personal
import { preparar, personas, sinteticos, contador, visto, sinDesbordar, foto, pequenos } from './comun_e2e.mjs';
import { adelantar, semanas, diaLargo, hoyMadrid } from './fechas_prueba.mjs';
import { trasAccion, hasta } from './infra/esperas.mjs';

const { ok, fallos, sumar } = contador();
const e = await preparar();
const { sql, APP } = e;
try {
  const hoy = hoyMadrid();
  const F = await adelantar(sql, semanas('2026-10-25'));
  // La J3 tiene que ser el proximo domingo con partido. Un domingo, la J2 adelantada cae HOY y, antes de su hora,
  // seria el «próximo partido»: se le pone la hora 00:01 (ya empezado).
  if (F('2026-10-18') === hoy) await sql`update public.eventos set inicio = '00:01', fin = null where tipo = 'liga' and fecha = ${hoy}`;
  const ids = async (clave) => (await sql`select id from public.eventos where clave = ${clave}`)[0].id;
  const P = await personas(e.pila, {
    jugadores: [['esteban-jon', 'jon@pruebas.local'], ['galan-domingo-guillermo', 'guille@pruebas.local'], ['gianatti-adriano', 'adri@pruebas.local']],
    gestores: [['Iván', 'ivan@pruebas.local', 'villaescusa-silva-ivan']],
  });
  // Datos: Jon es base (su posicion, solo para el saludo), convocado al MdA en la J3 aprobada; tiene «sin responder»
  // en el proximo entreno (importado); Adriano propone dos planes para toda la plantilla; un reparto de grupos
  // publicado en ese entreno.
  // La posicion (dato privado, D39) solo en un jugador SINTETICO: Sara, base de los dos equipos.
  await sinteticos(sql, [['sint-sara', 'Sara', true, true]]);
  await sql`insert into public.jugadores_privado (person_id, posicion, nivel) values ('sint-sara', 'base', 'A')`;
  await personas(e.pila, { jugadores: [['sint-sara', 'sara@pruebas.local']] });
  const [ent] = await sql`select id, fecha::text from public.eventos where tipo = 'entreno' and estado = 'programado' and fecha > ${hoy} order by fecha limit 1`;
  await sql`insert into public.respuestas (evento_id, person_id, respuesta) values (${ent.id}, 'esteban-jon', 'sin_responder')`;
  await sql`insert into public.convocatorias (fecha, jornada, estado, origen, equipos, aprobada_en) values (${F('2026-10-25')}, 3, 'aprobada', 'propuesta', ${sql.json({ MdA: [{ person_id: 'esteban-jon' }], MdL: [{ person_id: 'gianatti-adriano' }] })}, pruebas.ahora())`;
  const api = (f, args, token) => fetch(`${e.pila.url}/rest/v1/rpc/${f}`, { method: 'POST', headers: { apikey: e.pila.anonKey, authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(args) }).then((r) => r.json());
  const plan = await api('crear_plan', { p: { tipo: 'quedada', titulo: 'Cañas del jueves', fecha: ent.fecha, inicio: '22:40', equipo: 'ambos', ubicacion_nombre: 'Bar La Esquina', ubicacion_lat: 40.4, ubicacion_lng: -3.63 } }, P['gianatti-adriano'].token);
  // Un segundo plan, el mismo dia y mas tarde: dos tarjetas de plan en el carrusel.
  const plan2 = await api('crear_plan', { p: { tipo: 'quedada', titulo: 'Picoteo de después', fecha: ent.fecha, inicio: '23:15', equipo: 'ambos', ubicacion_nombre: 'Bar La Esquina', ubicacion_lat: 40.4, ubicacion_lng: -3.63 } }, P['gianatti-adriano'].token);
  await sql`insert into public.grupos_repartos (evento_id, nombre, grupos, publicado) values (${ent.id}, '5 contra 5', ${sql.json([{ nombre: 'Azules', personas: ['esteban-jon', 'gianatti-adriano'] }, { nombre: 'Rojos', personas: ['galan-domingo-guillermo'] }])}, true)`;
  // Fallo de la J3 (25/10): Ivan (gestor y jugador de los dos equipos), importado «va» al MdA y «no» al MdL; otros
  // jugadores, «va» a los dos. Su inicio decia «Vas a los dos»: tomaba la respuesta de otro (un gestor las lee todas).
  const j3 = await sql`select id, equipo from public.eventos where tipo = 'liga' and fecha = ${F('2026-10-25')} order by inicio`;
  const j3de = (eq) => j3.find((x) => x.equipo === eq).id;
  await sql`update public.jugadores set ficha_mda = true, ficha_mdl = true where person_id = 'villaescusa-silva-ivan'`;
  // Las de los otros, ANTES que las suyas: sin el filtro por person_id, el inicio cogia la primera fila de cada partido.
  await sql`insert into public.respuestas (evento_id, person_id, respuesta, origen) values
    (${j3de('MdA')}, 'galan-domingo-guillermo', 'va', 'sporteasy'), (${j3de('MdL')}, 'galan-domingo-guillermo', 'va', 'sporteasy'),
    (${j3de('MdA')}, 'gianatti-adriano', 'va', 'sporteasy'), (${j3de('MdL')}, 'gianatti-adriano', 'va', 'sporteasy')`;
  await sql`insert into public.respuestas (evento_id, person_id, respuesta, origen) values
    (${j3de('MdA')}, 'villaescusa-silva-ivan', 'va', 'sporteasy'), (${j3de('MdL')}, 'villaescusa-silva-ivan', 'no', 'sporteasy')`;

  console.log('\n== Anónimo: la portada pública, sin cambios');
  let r = await fetch(`${APP}/`);
  let html = await r.text();
  ok(r.status === 200 && html.includes('Dos equipos.') && html.includes('Una plantilla.') && !html.includes('Te faltan'), '«/» sin sesión: la portada pública');
  r = await fetch(`${APP}/mi-zona`, { redirect: 'manual' });
  ok(r.status === 308 && new URL(r.headers.get('location'), APP).pathname === '/', '/mi-zona redirige a «/» (308)', `${r.status} ${r.headers.get('location')}`);
  ok((await fetch(`${APP}/mi-zona/ausencias`, { redirect: 'manual' })).status !== 404, 'sus subpáginas siguen');

  console.log('\n== Jugador en el móvil (375 px): la Semana (D189)');
  const pj = await e.sesion('jon@pruebas.local', 375);
  ok(new URL(pj.url()).pathname === '/', 'al entrar, el jugador va a su Semana («/»)', pj.url());
  ok(await visto(pj.getByRole('heading', { name: 'Esta semana' })) && /^\S+ \d+ \S+ – \S+ \d+ \S+$/.test(await pj.getByTestId('rango-semana').innerText()), '«Esta semana» y el rango de fechas', await pj.getByTestId('rango-semana').innerText().catch(() => ''));
  // El nombre, la posición, las fichas y el dorsal están en «Yo» (D189), no en la Semana.
  const ps = await e.sesion('sara@pruebas.local', 375);
  await ps.goto(`${APP}/yo`);
  ok((await ps.getByTestId('yo-linea').innerText()) === 'Base · MdA y MdL', 'Yo: con su posición, «Base · MdA y MdL» (solo la suya, mi_posicion)', await ps.getByTestId('yo-linea').innerText().catch(() => ''));
  ok(!/nivel|Nivel/.test((await ps.content()).replace(/<script[\s\S]*?<\/script>/g, '')), 'y nunca su nivel');
  await ps.context().close();
  ok(!(await pj.getByTestId('banda-gestion').count()) && !(await pj.getByTestId('franja-gestion').count()), 'un jugador NO ve «Gestión · N pendientes» ni la franja GESTIÓN');
  const titulo = (await pj.locator('#t-faltan').textContent()).trim();
  const n = Number(/Te faltan (\d+)/.exec(titulo)?.[1] ?? (/Te falta 1/.test(titulo) ? 1 : 0));
  // Los dos planes, el entreno «sin responder» y la J3 (sin respuesta suya), como poco: lo oficial de 14 días también se pide.
  ok(n >= 4 && n === await pj.getByTestId('tarjeta-pendiente').count(), `«${titulo}» (los dos planes y los eventos oficiales sin responder de los próximos 14 días)`, `${n} / ${await pj.getByTestId('tarjeta-pendiente').count()} tarjetas`);
  const tarjetaEnt = pj.getByTestId('tarjeta-pendiente').filter({ has: pj.locator(`a[href="/evento/${ent.id}"]`) });
  ok(await tarjetaEnt.count() === 1, 'el entreno «sin responder» sale en «Te faltan»');
  ok(!(await pj.getByTestId('respuestas-apagadas').count()) && !(await pj.getByTestId('responder-sporteasy').count()) && !/SportEasy|desactivadas/i.test(await pj.locator('main').innerText()), 'sin «desactivadas» (ya no existe, D172), sin «Responder en SportEasy» y sin «SportEasy» en la Semana');
  ok((await pj.getByTestId('regla-recordatorios').innerText()) === 'Plazo: martes 12:00 para el partido del domingo y miércoles 12:00 para el entreno.', 'el plazo en una línea: martes 12:00 el partido, miércoles 12:00 el entreno (D173)', await pj.getByTestId('regla-recordatorios').innerText().catch(() => ''));
  const tarjetaPlan = pj.getByTestId('tarjeta-pendiente').filter({ hasText: 'Cañas del jueves' });
  ok(await tarjetaPlan.count() === 1 && await visto(tarjetaPlan.getByText('Plan no oficial')) && await visto(tarjetaPlan.getByRole('button', { name: 'Voy', exact: true })), 'el plan se responde aquí (Voy / No voy / Duda)');
  ok(await visto(pj.getByTestId('tarjeta-pendiente').first().locator('.in-casilla-quedada')) && /\w+ \d+ \w{3}/.test(await pj.locator('.in-pendiente-fecha').first().innerText()), 'cada tarjeta: fecha en grande («Miércoles 28 oct») y la casilla Quedada');
  ok((await pj.getByTestId('contador').innerText()) === `1 de ${n}`, `contador «1 de ${n}»`, await pj.getByTestId('contador').innerText().catch(() => ''));
  await pj.locator('.in-tarjetas').evaluate((c) => c.scrollTo({ left: c.scrollWidth, behavior: 'instant' }));
  await hasta(async () => (await pj.getByTestId('contador').innerText()) === `${n} de ${n}`, 5000);
  ok((await pj.getByTestId('contador').innerText()) === `${n} de ${n}`, 'al desplazar, el contador cambia', await pj.getByTestId('contador').innerText().catch(() => ''));
  const anchos = await pj.locator('.in-tarjeta-caja').first().evaluate((x) => ({ t: x.getBoundingClientRect().width, c: x.parentElement.getBoundingClientRect().width }));
  ok(anchos.t < anchos.c && anchos.t > anchos.c * 0.7, 'carrusel: una tarjeta visible y asomando la siguiente', JSON.stringify(anchos));
  // Las tarjetas de los próximos días
  const dias = pj.getByTestId('tarjeta-semana');
  ok((await dias.count()) > 0, `tarjetas de los próximos 10 días (${await dias.count()})`);
  const dom = pj.locator('[data-testid="tarjeta-semana"][data-tipo="liga"]').first();
  ok((await dom.getByTestId('estado-tarjeta').innerText()) === 'Convocado · MdA', 'el domingo: «Convocado · MdA» (mi_convocatoria)');
  ok(/quedada \d\d:\d\d/.test(await dom.locator('.sm-t-cuando').innerText()), 'la quedada en la tarjeta');
  ok((await dom.locator('.chip-eq').allTextContents()).includes('MdA'), 'con su equipo (MdA; dobla: MdA y MdL en la misma tarjeta)');
  const eq = await dom.getByTestId('linea-equipacion').innerText();
  ok(/^(Negra|Amarilla)/.test(eq) && /dorsal \d+/.test(eq) && /Lleva la amarilla por si acaso\.$/.test(eq) && (eq.match(/Lleva la amarilla/g) ?? []).length === 1 && !/camiseta (roja|blanca|azul)/.test(eq), 'equipación en una línea: SU equipación con su dorsal y una sola «Lleva la amarilla por si acaso» (D160)', eq);
  const avisos = await pj.getByTestId('avisos-dia').allInnerTexts();
  ok(hoy < '2026-10-20' || hoy > '2026-11-15' || avisos.some((a) => /dorsal es obligatorio/.test(a)), 'avisos del día plegados (data/avisos.json): el del dorsal desde la J3', avisos.join(' | '));
  ok(await visto(pj.getByTestId('tu-grupo')) && /Tu grupo: Azules/.test(await pj.getByTestId('tu-grupo').first().innerText()), 'el entreno con grupos publicados: «Tu grupo: Azules»');
  ok(await visto(pj.getByRole('link', { name: '+ Proponer un plan' })) && await visto(pj.getByRole('link', { name: 'Calendario completo' })), 'abajo, «Calendario completo» y «+ Proponer un plan»');
  ok(await visto(pj.getByTestId('tu-temporada')) && (await pj.getByTestId('tu-temporada').getAttribute('href')) === '/yo', 'y una línea «Tu temporada» que lleva a Yo');
  // Orden: Esta semana -> pendientes -> tarjetas -> abajo
  const y = await pj.evaluate(() => ['.sm-cab', '#pendientes', '[data-testid=proximos-dias]', '.sm-abajo'].map((s) => Math.round(document.querySelector(s).getBoundingClientRect().top + scrollY)));
  ok(y.every((v, i) => i === 0 || v > y[i - 1]), 'en orden: Esta semana · te faltan · próximos días · calendario y temporada', JSON.stringify(y));
  ok(!(await pj.locator('#ropa').count()), 'sin campaña de ropa abierta, no sale la ropa');
  ok(await sinDesbordar(pj), '375 px sin desbordamiento');
  const peq = await pequenos(pj, '.in a, .in button');
  ok(!peq.length, 'todo lo que se toca, de 44 px o más', JSON.stringify(peq.slice(0, 5)));
  await pj.evaluate(() => window.scrollTo(0, 0));
  await foto(pj, 'inicio_jugador_375');
  const html375 = await pj.content();
  // Sin las hojas «No voy» (<dialog> cerrado con la lista de motivos para elegir el suyo, no datos de nadie).
  ok(!/nivel|motivo/i.test(html375.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<dialog[\s\S]*?<\/dialog>/g, '')), 'sin niveles ni motivos en la pantalla');
  // Fallo de produccion (25/10): el inicio de un jugador enlazaba /mi-zona/manifest.webmanifest, que leia mi_zona y daba
  // «permission denied». Un solo manifiesto, el de toda la web.
  const manifiestos = await pj.locator('link[rel="manifest"]').evaluateAll((l) => l.map((x) => x.getAttribute('href')));
  ok(manifiestos.length === 1 && manifiestos[0] === '/manifest.webmanifest', 'la Semana enlaza el manifiesto de toda la web (/manifest.webmanifest), no uno bajo /mi-zona', JSON.stringify(manifiestos));

  console.log('\n== Responder un plan desde la tarjeta: sale y el contador baja');
  await trasAccion(pj, () => tarjetaPlan.getByRole('button', { name: 'Voy', exact: true }).click());
  await pj.reload();
  const titulo2 = (await pj.locator('#t-faltan').textContent()).trim();
  ok(!(await pj.getByTestId('tarjeta-pendiente').filter({ hasText: 'Cañas del jueves' }).count()) && titulo2 !== titulo, `respondido: la tarjeta sale (${titulo} → ${titulo2})`);
  ok((await sql`select respuesta from public.respuestas where evento_id = ${plan} and person_id = 'esteban-jon'`)[0]?.respuesta === 'va', 'y queda guardado «va»');

  console.log('\n== Voy / No voy / Duda en la tarjeta del entreno (No voy con su hoja de motivo)');
  ok(!(await pj.getByTestId('responder-sporteasy').count()) && await visto(tarjetaEnt.getByRole('button', { name: 'No voy', exact: true })), 'sin SportEasy; botones en las tarjetas');
  await tarjetaEnt.getByRole('button', { name: 'No voy', exact: true }).click();
  ok(await visto(pj.getByRole('dialog')) && await pj.getByRole('dialog').getByRole('button', { name: 'Guardar «no voy»' }).isDisabled(), '«No voy» abre el diálogo de motivo obligatorio');
  await pj.keyboard.press('Escape');
  await foto(pj, 'inicio_jugador_no_voy_375');

  console.log('\n== Sin nada pendiente: «✓ Lo tienes todo respondido»');
  await api('responder_plan', { p_evento: plan, p_respuesta: 'no' }, P['galan-domingo-guillermo'].token);
  await api('responder_plan', { p_evento: plan2, p_respuesta: 'no' }, P['galan-domingo-guillermo'].token);
  // Lo oficial de los próximos 14 días también se pide (D172): Guille lo tiene todo respondido («va»; lo que ya tuviera, se queda).
  await sql`insert into public.respuestas (evento_id, person_id, respuesta, origen)
    select id, 'galan-domingo-guillermo', 'va', 'jugador' from public.eventos
    where estado = 'programado' and borrado_en is null and fecha between ${hoy}::date and ${hoy}::date + 14
    on conflict (evento_id, person_id) do nothing`;
  const pg = await e.sesion('guille@pruebas.local', 375);
  ok((await pg.locator('#t-faltan').textContent()).trim() === '✓ Lo tienes todo respondido', 'una sola línea: «✓ Lo tienes todo respondido»', await pg.locator('#t-faltan').textContent());
  // D171: con la convocatoria aprobada y sin estar en ella, ese partido sale «No convocado» (nunca «No vas»).
  ok((await pg.locator('[data-testid="tarjeta-semana"][data-tipo="liga"]').first().getByTestId('estado-tarjeta').innerText()) === 'No convocado', 'con la convocatoria aprobada y sin estar en ella: «No convocado»');
  ok(!(await pg.getByTestId('tu-grupo').count()) || /Rojos/.test(await pg.getByTestId('tu-grupo').first().innerText()), 'cada uno ve SOLO su grupo');

  console.log('\n== Gestor (y jugador) en escritorio (1280 px): «Gestión · N pendientes» y la franja GESTIÓN');
  const pi = await e.sesion('ivan@pruebas.local', 1280);
  ok(new URL(pi.url()).pathname === '/', 'el gestor que es jugador entra en su Semana', pi.url());
  const banda = pi.getByTestId('banda-gestion');
  ok(await visto(banda) && (await banda.getByRole('link', { name: /Gestión · / }).getAttribute('href')) === '/gestion', '«Gestión · N pendientes», que lleva a /gestion');
  const yb = await pi.evaluate(() => [document.querySelector('#pendientes').getBoundingClientRect().top, document.querySelector('[data-testid=banda-gestion]').getBoundingClientRect().top, document.querySelector('[data-testid=proximos-dias]').getBoundingClientRect().top]);
  ok(yb[0] < yb[1] && yb[1] < yb[2], 'después de las respuestas que le faltan y antes de las tarjetas', JSON.stringify(yb));
  const franja = pi.getByTestId('franja-gestion').first();
  ok(await visto(franja) && /van/.test(await franja.innerText()) && await visto(franja.getByRole('link', { name: /Preparar|Grupos/ })), 'cada tarjeta con su franja GESTIÓN: contadores pulsables y «Preparar ›» o «Grupos ›»');
  ok(await sinDesbordar(pi), '1280 px sin desbordamiento');
  await foto(pi, 'inicio_gestor_1280');
  console.log('\n== Respuestas distintas por partido del domingo (J3: «va» al MdA, «no» al MdL), siendo gestor');
  // Sin convocatoria aprobada manda lo que respondió (con la aprobada, Iván no está en ella: D171, otra prueba).
  await sql`delete from public.convocatorias where fecha = ${F('2026-10-25')}`;
  await pi.goto(`${APP}/`);
  const tIvan = await pi.locator('[data-testid="tarjeta-semana"][data-tipo="liga"]').first().getByTestId('estado-tarjeta').innerText();
  ok(tIvan === 'Vas al MdA · no al MdL', 'Semana: la J3 dice «Vas al MdA · no al MdL», nunca «Vas a los dos»', tIvan);
  await pi.goto(`${APP}/calendario`);
  const fJ3 = pi.locator(`a[data-testid="fila-agenda"][href="/mi-zona/domingo/${F('2026-10-25')}"]`);
  const tJ3 = (await fJ3.count()) ? await fJ3.first().locator('.in-pastilla').innerText() : '(sin fila)';
  ok(tJ3 === 'Vas al MdA · no al MdL', 'Calendario: la J3 dice «Vas al MdA · no al MdL»', tJ3);
  await pi.goto(`${APP}/mi-zona/domingo/${F('2026-10-25')}`);
  const txtDom = await pi.locator('main').innerText();
  ok(!/Vas a los dos/.test(txtDom), 'la página del domingo tampoco dice «Vas a los dos»');
  const pi375 = await e.nuevaPagina(await e.contexto(375));
  await pi375.context().addCookies(await pi.context().cookies());
  await pi375.goto(`${APP}/`);
  ok(await visto(pi375.getByTestId('banda-gestion')) && await sinDesbordar(pi375), 'gestor a 375 px: «Gestión · N pendientes» y sin desbordamiento');
  await foto(pi375, 'inicio_gestor_375');
  const pj1280 = await e.nuevaPagina(await e.contexto(1280));
  await pj1280.context().addCookies(await pj.context().cookies());
  await pj1280.goto(`${APP}/`);
  ok(await sinDesbordar(pj1280), 'jugador a 1280 px sin desbordamiento');
  await foto(pj1280, 'inicio_jugador_1280');

  ok(!e.errores.length, 'sin errores de consola', e.errores.slice(0, 5).join(' | '));
} catch (err) { console.error(err); sumar(); } finally {
  await e.parar();
}
console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK');
process.exit(fallos() ? 1 : 0);
