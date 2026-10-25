#!/usr/bin/env node
// Inicio personal (D117), de extremo a extremo: pila local, web compilada y Chrome.
//   - anonimo: «/» es la portada publica de siempre; /mi-zona redirige a «/» (308);
//   - jugador: lo suyo (saludo con posicion, fichas y dorsal; «Te faltan N» con carrusel y contador «1 de N»; proximo
//     partido con «Convocado», casillas, «Te pones» y el color del rival aparte; avisos de la jornada; agenda con planes
//     y «Tu grupo»; temporada; el club) y NO la banda de gestion;
//   - fase puente (apagado): «Responder en SportEasy»; los planes se responden aqui; encendido: Voy / No voy / Duda;
//   - gestor: la banda «Gestión esta semana» (plegable y recordada) y tres columnas en escritorio;
//   - 375 y 1280 px sin desbordamiento ni errores de consola. Capturas en privado/mockups_liga/inicio-y-planes/.
//
//   npm run pruebas:inicio-personal
import { preparar, personas, sinteticos, contador, visto, sinDesbordar, foto, pequenos } from './comun_e2e.mjs';
import { adelantar, semanas, diaLargo } from './fechas_prueba.mjs';

const { ok, fallos, sumar } = contador();
const PUERTO = 3121;
const e = await preparar({ puerto: PUERTO });
const { sql, APP } = e;
try {
  const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  const F = await adelantar(sql, semanas('2026-10-25'));
  // La J3 tiene que ser el proximo domingo con partido. Un domingo, la J2 adelantada cae HOY y, antes de su hora,
  // seria el «próximo partido»: se le pone la hora 00:01 (ya empezado).
  if (F('2026-10-18') === hoy) await sql`update public.eventos set inicio = '00:01', fin = null where tipo = 'liga' and fecha = ${hoy}`;
  const ids = async (clave) => (await sql`select id from public.eventos where clave = ${clave}`)[0].id;
  const P = await personas(e.pila, {
    jugadores: [['esteban-jon', 'jon@pruebas.local'], ['galan-domingo-guillermo', 'guille@pruebas.local'], ['gianatti-adriano', 'adri@pruebas.local']],
    gestores: [['Iván', 'ivan@pruebas.local', 'villaescusa-silva-ivan']],
  });
  // Datos: Jon es base (su posicion, solo para el saludo), convocado al MdA en la J3 aprobada; SportEasy le da
  // «sin responder» en el proximo entreno; Adriano propone un plan para toda la plantilla; un reparto de grupos
  // publicado en ese entreno.
  // La posicion (dato privado, D39) solo en un jugador SINTETICO: Sara, base de los dos equipos.
  await sinteticos(sql, [['sint-sara', 'Sara', true, true]]);
  await sql`insert into public.jugadores_privado (person_id, posicion, nivel) values ('sint-sara', 'base', 'A')`;
  await personas(e.pila, { jugadores: [['sint-sara', 'sara@pruebas.local']] });
  const [ent] = await sql`select id, fecha::text from public.eventos where tipo = 'entreno' and estado = 'programado' and fecha > ${hoy} order by fecha limit 1`;
  await sql`insert into public.respuestas (evento_id, person_id, respuesta) values (${ent.id}, 'esteban-jon', 'sin_responder')`;
  await sql`insert into public.convocatorias (fecha, jornada, estado, origen, equipos, aprobada_en) values (${F('2026-10-25')}, 3, 'aprobada', 'propuesta', ${sql.json({ MdA: [{ person_id: 'esteban-jon' }], MdL: [{ person_id: 'gianatti-adriano' }] })}, now())`;
  const api = (f, args, token) => fetch(`${e.pila.url}/rest/v1/rpc/${f}`, { method: 'POST', headers: { apikey: e.pila.anonKey, authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(args) }).then((r) => r.json());
  const plan = await api('crear_plan', { p: { tipo: 'quedada', titulo: 'Cañas del jueves', fecha: ent.fecha, inicio: '22:40', equipo: 'ambos', ubicacion_nombre: 'Bar La Esquina', ubicacion_lat: 40.4, ubicacion_lng: -3.63 } }, P['gianatti-adriano'].token);
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

  console.log('\n== Jugador en el móvil (375 px), fase puente (interruptor apagado)');
  const pj = await e.sesion('jon@pruebas.local', 375);
  ok(new URL(pj.url()).pathname === '/', 'al entrar, el jugador va a su inicio («/»)', pj.url());
  ok(await visto(pj.getByRole('heading', { name: /Hola,\s*Jon/ })), 'saludo «Hola, Jon»');
  ok(/^MdA y MdL · #\d/.test(await pj.getByTestId('linea-saludo').innerText()), 'una línea: fichas y dorsal (sin posición cargada, no se inventa)', await pj.getByTestId('linea-saludo').innerText().catch(() => ''));
  const ps = await e.sesion('sara@pruebas.local', 375);
  ok((await ps.getByTestId('linea-saludo').innerText()) === 'Base · MdA y MdL', 'con su posición: «Base · MdA y MdL» (solo la suya, mi_posicion)', await ps.getByTestId('linea-saludo').innerText().catch(() => ''));
  ok(!/nivel|Nivel/.test((await ps.content()).replace(/<script[\s\S]*?<\/script>/g, '')), 'y nunca su nivel');
  await ps.context().close();
  ok(!(await pj.getByTestId('banda-gestion').count()), 'un jugador NO ve la banda de gestión');
  const titulo = (await pj.locator('#t-faltan').textContent()).trim();
  const n = Number(/Te faltan (\d+)/.exec(titulo)?.[1] ?? (/Te falta 1/.test(titulo) ? 1 : 0));
  ok(n >= 2, `«${titulo}» (el entreno de SportEasy y el plan)`);
  ok(await visto(pj.getByTestId('responder-sporteasy')) && (await pj.getByTestId('responder-sporteasy').first().getAttribute('href')).startsWith('https://'), 'apagado: «Responder en SportEasy»');
  const tarjetaPlan = pj.getByTestId('tarjeta-pendiente').filter({ hasText: 'Cañas del jueves' });
  ok(await tarjetaPlan.count() === 1 && await visto(tarjetaPlan.getByText('Plan no oficial')) && await visto(tarjetaPlan.getByRole('button', { name: 'Voy', exact: true })), 'el plan se responde aquí aunque esté apagado (Voy / No voy / Duda)');
  ok(await visto(pj.getByTestId('tarjeta-pendiente').first().locator('.in-casilla-quedada')) && /\w+ \d+ \w{3}/.test(await pj.locator('.in-pendiente-fecha').first().innerText()), 'cada tarjeta: fecha en grande («Miércoles 28 oct») y la casilla Quedada');
  ok((await pj.getByTestId('contador').innerText()) === `1 de ${n}`, `contador «1 de ${n}»`, await pj.getByTestId('contador').innerText().catch(() => ''));
  await pj.locator('.in-tarjetas').evaluate((c) => c.scrollTo({ left: c.scrollWidth, behavior: 'instant' }));
  await pj.waitForTimeout(400);
  ok((await pj.getByTestId('contador').innerText()) === `${n} de ${n}`, 'al desplazar, el contador cambia', await pj.getByTestId('contador').innerText().catch(() => ''));
  const anchos = await pj.locator('.in-tarjeta-caja').first().evaluate((x) => ({ t: x.getBoundingClientRect().width, c: x.parentElement.getBoundingClientRect().width }));
  ok(anchos.t < anchos.c && anchos.t > anchos.c * 0.7, 'carrusel: una tarjeta visible y asomando la siguiente', JSON.stringify(anchos));
  ok(await visto(pj.getByTestId('regla-recordatorios')), 'debajo, la línea sobre los recordatorios');
  // Proximo partido
  const pp = pj.getByTestId('proximo-partido');
  ok((await pj.getByTestId('estado-partido').innerText()) === 'Convocado · MdA', 'próximo partido: «Convocado · MdA» (mi_convocatoria)');
  ok((await pp.locator('.in-titular').innerText()).toLowerCase().includes(diaLargo(F('2026-10-25'))), `fecha en titular («${diaLargo(F('2026-10-25'))}»)`, await pp.locator('.in-titular').innerText());
  ok(await visto(pp.getByText('Quedada')) && await visto(pp.getByText('Partido', { exact: true })), 'casillas Quedada y Partido');
  ok((await pp.locator('.in-partido-uno').count()) === 1, 'solo su partido (el del MdA)');
  const tp = await pp.getByTestId('te-pones').innerText();
  ok(/Equipación (negra|amarilla)/.test(tp) && /dorsal/.test(tp) && !/camiseta (roja|blanca|azul)/.test(tp), '«Te pones»: SU equipación con su dorsal (sin el color del rival)', tp);
  ok(await visto(pp.getByTestId('color-rival-inicio')) && /El rival: camiseta/.test(await pp.getByTestId('color-rival-inicio').innerText()), 'el color del rival, aparte');
  ok(await visto(pp.getByRole('link', { name: 'Cómo llegar' })), '«Cómo llegar»');
  const avisos = await pj.getByTestId('avisos-jornada').innerText().catch(() => '');
  ok(hoy < '2026-10-20' || hoy > '2026-11-15' || /dorsal es obligatorio/.test(avisos), 'avisos de la jornada (data/avisos.json): el del dorsal desde la J3', avisos);
  // Agenda
  const filas = pj.getByTestId('fila-agenda');
  ok((await filas.count()) <= 4 && (await filas.count()) > 0, `«Tu agenda»: sus próximos 4 (${await filas.count()})`);
  ok(await visto(pj.locator('#agenda').getByText('Plan no oficial')), 'los planes llevan «Plan no oficial»');
  ok(await visto(pj.getByTestId('tu-grupo')) && /Tu grupo: Azules/.test(await pj.getByTestId('tu-grupo').first().innerText()), 'el entreno con grupos publicados: «Tu grupo: Azules»');
  ok(await visto(pj.getByRole('link', { name: 'Proponer un plan' })) && await visto(pj.getByRole('link', { name: 'Ver todo' })), '«Proponer un plan» y «Ver todo»');
  // Orden en el movil: saludo -> pendientes -> proximo partido -> agenda -> temporada -> club
  const y = await pj.evaluate(() => Object.fromEntries(['.in-hola', '#pendientes', '#proximo-partido', '#agenda', '#temporada', '#club'].map((s) => [s, Math.round(document.querySelector(s).getBoundingClientRect().top + scrollY)])));
  const orden = Object.values(y);
  ok(orden.every((v, i) => i === 0 || v > orden[i - 1]), 'móvil, una columna y en orden: saludo · faltan · próximo partido · agenda · temporada · el club', JSON.stringify(y));
  ok(await visto(pj.getByTestId('tu-temporada')) && await visto(pj.locator('#club').getByText('MdA · grupo 1')), '«Tu temporada» y «El club»');
  ok(!(await pj.locator('#ropa').count()), 'sin campaña de ropa abierta, no sale la ropa');
  ok(await sinDesbordar(pj), '375 px sin desbordamiento');
  const peq = await pequenos(pj, '.in a, .in button');
  ok(!peq.length, 'todo lo que se toca, de 44 px o más', JSON.stringify(peq.slice(0, 5)));
  await pj.evaluate(() => window.scrollTo(0, 0));
  await foto(pj, 'inicio_jugador_375');
  const html375 = await pj.content();
  ok(!/nivel|motivo/i.test(html375.replace(/<script[\s\S]*?<\/script>/g, '')), 'sin niveles ni motivos en la pantalla');
  // Fallo de produccion (25/10): el inicio de un jugador enlazaba /mi-zona/manifest.webmanifest, que leia mi_zona y daba
  // «permission denied». Un solo manifiesto, el de toda la web.
  const manifiestos = await pj.locator('link[rel="manifest"]').evaluateAll((l) => l.map((x) => x.getAttribute('href')));
  ok(manifiestos.length === 1 && manifiestos[0] === '/manifest.webmanifest', 'el inicio del jugador enlaza el manifiesto de toda la web (/manifest.webmanifest), no uno bajo /mi-zona', JSON.stringify(manifiestos));

  console.log('\n== Responder un plan desde la tarjeta: sale y el contador baja');
  await tarjetaPlan.getByRole('button', { name: 'Voy', exact: true }).click();
  await pj.waitForTimeout(2000);
  await pj.reload();
  const titulo2 = (await pj.locator('#t-faltan').textContent()).trim();
  ok(!(await pj.getByTestId('tarjeta-pendiente').filter({ hasText: 'Cañas del jueves' }).count()) && titulo2 !== titulo, `respondido: la tarjeta sale (${titulo} → ${titulo2})`);
  ok((await sql`select respuesta from public.respuestas where evento_id = ${plan} and person_id = 'esteban-jon'`)[0]?.respuesta === 'va', 'y queda guardado «va»');

  console.log('\n== Encendido: Voy / No voy / Duda en la tarjeta (No voy con su hoja de motivo)');
  await sql`update public.respuestas_web_config set encendido = true, encendido_desde = now() where id = 1`;
  await pj.reload();
  const tarjetaEnt = pj.getByTestId('tarjeta-pendiente').filter({ has: pj.locator(`a[href="/mi-zona/evento/${ent.id}"]`) });
  ok(!(await pj.getByTestId('responder-sporteasy').count()) && await visto(tarjetaEnt.getByRole('button', { name: 'No voy', exact: true })), 'encendido: sin SportEasy; botones en las tarjetas');
  await tarjetaEnt.getByRole('button', { name: 'No voy', exact: true }).click();
  ok(await visto(pj.getByRole('dialog')) && await pj.getByRole('dialog').getByRole('button', { name: 'Guardar «no voy»' }).isDisabled(), '«No voy» abre el diálogo de motivo obligatorio');
  await pj.keyboard.press('Escape');
  await foto(pj, 'inicio_jugador_encendido_375');

  console.log('\n== Sin nada pendiente: «Lo tienes todo respondido»');
  await api('responder_plan', { p_evento: plan, p_respuesta: 'no' }, P['galan-domingo-guillermo'].token);
  await sql`update public.respuestas_web_config set encendido = false where id = 1`;
  const pg = await e.sesion('guille@pruebas.local', 375);
  ok((await pg.locator('#t-faltan').textContent()).trim() === 'Lo tienes todo respondido', '«Lo tienes todo respondido»', await pg.locator('#t-faltan').textContent());
  ok((await pg.getByTestId('estado-partido').innerText()) === 'No convocado esta vez', 'con la convocatoria aprobada y sin estar en ella: «No convocado esta vez»');
  ok(!(await pg.getByTestId('tu-grupo').count()) || /Rojos/.test(await pg.getByTestId('tu-grupo').first().innerText()), 'cada uno ve SOLO su grupo');

  console.log('\n== Gestor (y jugador) en escritorio (1280 px): banda «Gestión esta semana» y tres columnas');
  const pi = await e.sesion('ivan@pruebas.local', 1280);
  ok(new URL(pi.url()).pathname === '/', 'el gestor que es jugador entra en su inicio', pi.url());
  const banda = pi.getByTestId('banda-gestion');
  ok(await visto(banda) && (await banda.locator('a').count()) >= 2 && await visto(banda.getByRole('link', { name: 'Abrir gestión' })), 'banda arriba del todo, con tareas enlazadas y «Abrir gestión»');
  const yb = await pi.evaluate(() => [document.querySelector('[data-testid=banda-gestion]').getBoundingClientRect().top, document.querySelector('.in-hola').getBoundingClientRect().top]);
  ok(yb[0] < yb[1], 'la banda va antes que el saludo');
  const cols = await pi.evaluate(() => ['#proximo-partido', '#agenda', '#temporada'].map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top) }; }));
  ok(cols[0].x < cols[1].x && cols[1].x < cols[2].x && Math.abs(cols[0].y - cols[1].y) < 4 && Math.abs(cols[1].y - cols[2].y) < 4, 'escritorio: próximo partido | agenda | temporada, en tres columnas', JSON.stringify(cols));
  const yPend = await pi.evaluate(() => document.querySelector('#pendientes').getBoundingClientRect().bottom);
  ok(yPend <= cols[0].y, 'la fila de pendientes, encima de las tres columnas');
  ok(await sinDesbordar(pi), '1280 px sin desbordamiento');
  await foto(pi, 'inicio_gestor_1280');
  console.log('\n== Respuestas distintas por partido del domingo (J3: «va» al MdA, «no» al MdL), siendo gestor');
  const pIvan = pi.getByTestId('proximo-partido');
  const partidosIvan = await pIvan.locator('.in-partido-uno').evaluateAll((xs) => xs.map((x) => x.dataset.equipo));
  ok(partidosIvan.join(',') === 'MDA', '«Tu próximo partido»: solo el MdA (no el MdL al que dijo que no)', partidosIvan.join(','));
  await pi.goto(`${APP}/agenda`);
  const fJ3 = pi.locator(`a[data-testid="fila-agenda"][href="/mi-zona/domingo/${F('2026-10-25')}"]`);
  const tJ3 = (await fJ3.count()) ? await fJ3.first().locator('.in-pastilla').innerText() : '(sin fila)';
  ok(tJ3 === 'Vas al MdA · no al MdL', 'agenda: la J3 dice «Vas al MdA · no al MdL», nunca «Vas a los dos»', tJ3);
  await pi.goto(`${APP}/mi-zona/domingo/${F('2026-10-25')}`);
  const txtDom = await pi.locator('main').innerText();
  ok(!/Vas a los dos/.test(txtDom), 'la página del domingo tampoco dice «Vas a los dos»');
  await pi.goto(`${APP}/`);
  await banda.getByRole('button', { name: 'Ocultar' }).click();
  ok(await banda.locator('#in-gestion-lista').isHidden(), 'la banda se pliega');
  await pi.reload();
  ok(await pi.getByTestId('banda-gestion').locator('#in-gestion-lista').isHidden() && await visto(pi.getByTestId('banda-gestion').getByRole('button', { name: 'Mostrar' })), 'y lo recuerda en este navegador');
  await pi.getByTestId('banda-gestion').getByRole('button', { name: 'Mostrar' }).click();
  const pi375 = await e.nuevaPagina(await e.contexto(375));
  await pi375.context().addCookies(await pi.context().cookies());
  await pi375.goto(`${APP}/`);
  ok(await visto(pi375.getByTestId('banda-gestion')) && await sinDesbordar(pi375), 'gestor a 375 px: banda y sin desbordamiento');
  await foto(pi375, 'inicio_gestor_375');
  const pj1280 = await e.nuevaPagina(await e.contexto(1280));
  await pj1280.context().addCookies(await pj.context().cookies());
  await pj1280.goto(`${APP}/`);
  ok(await sinDesbordar(pj1280), 'jugador a 1280 px sin desbordamiento');
  ok(await visto(pj1280.locator('.in-partidos-temporada')) || !(await pj1280.locator('.in-partidos-temporada').count()), 'escritorio: una línea por partido en «Tu temporada» (si ha jugado)');
  await foto(pj1280, 'inicio_jugador_1280');

  ok(!e.errores.length, 'sin errores de consola', e.errores.slice(0, 5).join(' | '));
} catch (err) { console.error(err); sumar(); } finally {
  await e.parar();
}
console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK');
process.exit(fallos() ? 1 : 0);
