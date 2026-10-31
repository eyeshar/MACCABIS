#!/usr/bin/env node
// Página del domingo del jugador (D128), de extremo a extremo: pila local, web compilada y Chrome a 375 y 1280 px.
//   - su situación en una frase: convocado (con equipo, hora y quedada), no convocado, convocatoria pendiente o no va;
//   - su tarjeta marcada («Tú juegas aquí») y la otra apagada; equipación nuestra (con su dorsal en la suya) y la del
//     rival por separado;
//   - «Quién va»: con la convocatoria APROBADA, los convocados de cada equipo (solo nombres, «tú» en el suyo); sin
//     aprobar, «Convocatoria pendiente: la verás aquí cuando esté hecha.»;
//   - interruptor apagado: «Tu respuesta: vas al MdA · no al MdL» (lo que tenga guardado) y «Las respuestas en la web
//     están desactivadas»; sin respuesta, solo eso; nada de SportEasy; encendido: los botones de siempre;
//   - privacidad: nada de niveles, posiciones, motivos ni respuestas de otros; la función de la base solo da nombres de
//     convocatorias aprobadas, y nada a un anónimo.
//
//   npm run pruebas:domingo
import { preparar, personas, sinteticos, contador, visto, sinDesbordar } from './comun_e2e.mjs';
import { adelantar, semanas } from './fechas_prueba.mjs';
import path from 'node:path';
import fs from 'node:fs';
import { REPO, RAIZ } from './comun_e2e.mjs';
import { migrar } from '../scripts/db.mjs';

const { ok, fallos, sumar } = contador();
const CAPT = path.join(REPO, 'privado', 'mockups_liga', 'convocatoria-proyeccion');
fs.mkdirSync(CAPT, { recursive: true });
const foto = (p, n) => p.screenshot({ path: path.join(CAPT, `${n}.png`), fullPage: true }).catch(() => {});
const e = await preparar();
const { sql, APP } = e;
try {
  const F = await adelantar(sql, semanas('2026-10-25'));
  const J3 = F('2026-10-25');
  const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  if (F('2026-10-18') === hoy) await sql`update public.eventos set inicio = '00:01', fin = null where tipo = 'liga' and fecha = ${hoy}`;
  const j3 = await sql`select id, equipo, inicio::text from public.eventos where tipo = 'liga' and fecha = ${J3} order by inicio`;
  const de = (eq) => j3.find((x) => x.equipo === eq);
  const h = (eq) => de(eq).inicio.slice(0, 5).replace(/^0/, '');
  const q = (eq) => { const [hh, mm] = de(eq).inicio.slice(0, 5).split(':').map(Number); const t = hh * 60 + mm - 20; return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
  await sinteticos(sql, [['sint-noe', 'Noe', true, true], ['sint-zoe', 'Zoe', true, true]]);
  await sql`update public.jugadores set ficha_mda = true, ficha_mdl = true where person_id = 'esteban-jon'`;
  const P = await personas(e.pila, {
    jugadores: [['esteban-jon', 'jon@pruebas.local'], ['galan-domingo-guillermo', 'guille@pruebas.local'], ['gianatti-adriano', 'adri@pruebas.local'], ['sint-noe', 'noe@pruebas.local']],
  });
  // Importado de SportEasy: Jon va al MdA y no al MdL; Noe, no a los dos (lesión); Zoe, va (y no sale convocada).
  await sql`insert into public.respuestas (evento_id, person_id, respuesta, motivo, origen) values
    (${de('MdA').id}, 'esteban-jon', 'va', null, 'sporteasy'), (${de('MdL').id}, 'esteban-jon', 'no', 'trabajo', 'sporteasy'),
    (${de('MdA').id}, 'sint-noe', 'no', 'lesion', 'sporteasy'), (${de('MdL').id}, 'sint-noe', 'no', 'lesion', 'sporteasy'),
    (${de('MdA').id}, 'sint-zoe', 'va', null, 'sporteasy'), (${de('MdL').id}, 'sint-zoe', 'va', null, 'sporteasy')`;
  await sql`insert into public.importaciones (tipo, por_nombre, en) values ('respuestas', 'Claude', now() - interval '2 hours')`;
  const URL_D = `${APP}/mi-zona/domingo/${J3}`;
  const api = (f, args, token) => fetch(`${e.pila.url}/rest/v1/rpc/${f}`, { method: 'POST', headers: { apikey: e.pila.anonKey, authorization: `Bearer ${token ?? e.pila.anonKey}`, 'content-type': 'application/json' }, body: JSON.stringify(args) });

  console.log(`\n== Convocatoria pendiente (${J3}, sin aprobar)`);
  await sql`insert into public.convocatorias (fecha, jornada, estado, origen, equipos) values (${J3}, 3, 'borrador', 'propuesta', ${sql.json({ MdA: [{ person_id: 'esteban-jon' }, { person_id: 'sint-zoe' }], MdL: [{ person_id: 'gianatti-adriano' }] })})`;
  const pj = await e.sesion('jon@pruebas.local', 375);
  await pj.goto(URL_D);
  ok((await pj.getByTestId('situacion').innerText()) === 'Convocatoria pendiente', '«Convocatoria pendiente» (un borrador no se enseña)', await pj.getByTestId('situacion').innerText().catch(() => ''));
  ok(await visto(pj.getByTestId('quien-va-MdA').getByText('Convocatoria pendiente: la verás aquí cuando esté hecha.')) && !(await pj.getByTestId('quien-va-MdA').innerText()).includes('Zoe'), '«Quién va»: «Convocatoria pendiente: la verás aquí cuando esté hecha.» (sin nombres del borrador)');
  ok(!(await pj.locator('.rw-partido-mio').count()), 'ninguna tarjeta marcada todavía');
  ok(await (await api('convocados_del_domingo', { p_fecha: J3 }, P['esteban-jon'].token)).json() === null, 'la base no da nombres de un borrador (null)');
  await foto(pj, 'domingo_pendiente_375');

  console.log('\n== Convocado con el MdA (convocatoria aprobada)');
  await sql`update public.convocatorias set estado = 'aprobada', aprobada_en = now() where fecha = ${J3}`;
  await pj.goto(URL_D);
  const sit = await pj.getByTestId('situacion').innerText();
  ok(sit === `Estás convocado con el MdA · ${h('MdA')}, quedada ${q('MdA')}`, `«Estás convocado con el MdA · ${h('MdA')}, quedada ${q('MdA')}»`, sit);
  ok(await visto(pj.getByTestId('partido-MdA').getByText('· Tú juegas aquí')) && (await pj.getByTestId('partido-MdA').getAttribute('class')).includes('rw-partido-mio') && (await pj.getByTestId('partido-MdL').getAttribute('class')).includes('rw-partido-otro'), 'su tarjeta marcada («Tú juegas aquí»); la otra, apagada');
  const eqA = await pj.getByTestId('equipacion-MdA').innerText(), eqL = await pj.getByTestId('equipacion-MdL').innerText();
  ok(/Nosotros\s+La (negra|amarilla), con tu dorsal \d+/i.test(eqA), 'la suya: «La negra, con tu dorsal N»', eqA);
  ok(/Nosotros\s+(Negra|Amarilla)\b/i.test(eqL) && !/dorsal/.test(eqL), 'la otra: «Negra», sin dorsal', eqL);
  ok(/Rival\s+.*camiseta/i.test(eqA) && /Rival\s+.*camiseta/i.test(eqL), 'y aparte, la del rival (equipacion.ts), sin mezclarlas', `${eqA} | ${eqL}`);
  // D139: «N convocados» es un contador que se despliega con los nombres.
  await pj.getByTestId('convocados-MdA-convocados').click(); await pj.getByTestId('convocados-MdL-convocados').click();
  const qa = await pj.getByTestId('quien-va-MdA').innerText(), ql = await pj.getByTestId('quien-va-MdL').innerText();
  ok(/Quién va\s+2\s+convocados\s+Jon\s+tú\s+Zoe$/.test(qa.trim()), '«Quién va» del MdA: 2 convocados, en orden alfabético, «tú» en el suyo', qa);
  ok(/Quién va\s+1\s+convocados\s+Adriano$/.test(ql.trim()) && !/\btú\b/.test(ql), 'y los del MdL, solo nombres', ql);
  const se = await pj.getByTestId('respuestas-apagadas').innerText();
  ok(se.includes('Tu respuesta: vas al MdA · no al MdL') && se.includes('Las respuestas en la web están desactivadas.'), '«Tu respuesta: vas al MdA · no al MdL» y «Las respuestas en la web están desactivadas»', se);
  ok(!(await pj.getByTestId('segun-sporteasy').count()) && !(await pj.locator('a[href*="sporteasy"]').count()), 'sin «Según SportEasy» ni enlace a SportEasy');
  ok(await visto(pj.getByText('Estar disponible no es estar convocado')), 'mantiene la nota «Estar disponible no es estar convocado»');
  const texto = await pj.locator('main').innerText();
  ok(!/nivel|Nivel [A-E]|Base de reserva|posici|lesi[oó]n|trabajo|Noe|en casa|fuera\b|\(local\)|\(visitante\)/i.test(texto), 'sin niveles, posiciones ni motivos (ni el suyo ni el de Noe), sin «Noe» (no convocada) y sin «casa/fuera»', texto.match(/nivel|lesi[oó]n|trabajo|Noe|en casa|fuera/i)?.[0]);
  ok(!/SportEasy/i.test(texto), 'la página del domingo no menciona SportEasy');
  ok(!(await pj.getByText(/Dudan|No van ·/).count()), 'ni respuestas de otros (quién no va o duda)');
  ok(await sinDesbordar(pj), '375 px sin desbordar');
  await foto(pj, 'domingo_convocado_375');
  const ctx1280 = await e.contexto(1280);
  const pw = await e.nuevaPagina(ctx1280);
  await e.entrar(pw, 'jon@pruebas.local');
  await pw.goto(URL_D);
  ok(await sinDesbordar(pw) && await visto(pw.getByTestId('situacion')), '1280 px sin desbordar');
  await foto(pw, 'domingo_convocado_1280');
  await ctx1280.close();

  console.log('\n== No convocado (aprobada) y sin respuesta importada');
  const pg = await e.sesion('guille@pruebas.local', 375);
  await pg.goto(URL_D);
  ok((await pg.getByTestId('situacion').innerText()) === 'No estás convocado este domingo', '«No estás convocado este domingo»');
  ok(!(await pg.locator('.rw-partido-mio, .rw-partido-otro').count()), 'ninguna tarjeta marcada ni apagada');
  { const ap = await pg.getByTestId('respuestas-apagadas').innerText();
    ok(ap.trim() === 'Las respuestas en la web están desactivadas.' && !/SportEasy/i.test(await pg.locator('main').innerText()), 'sin respuesta guardada: solo «Las respuestas en la web están desactivadas», sin «SportEasy»', ap); }
  ok(!/dorsal/.test(await pg.getByTestId('equipacion-MdA').innerText()), 'sin convocar, sin «tu dorsal»');
  await foto(pg, 'domingo_no_convocado_375');
  const conv = await (await api('convocados_del_domingo', { p_fecha: J3 }, P['galan-domingo-guillermo'].token)).json();
  ok(JSON.stringify(conv) === JSON.stringify({ MdA: ['Jon', 'Zoe'], MdL: ['Adriano'] }), 'la base le da a cualquier jugador solo los nombres de la aprobada', JSON.stringify(conv));
  const anon = await api('convocados_del_domingo', { p_fecha: J3 });
  ok(anon.status >= 400 || (await anon.json()) === null, 'a un anónimo, nada', String(anon.status));
  const imp = await (await api('ultima_importacion_respuestas', {}, P['galan-domingo-guillermo'].token)).json();
  ok(typeof imp === 'string' && !Number.isNaN(Date.parse(imp)), 'la hora de la última importación (solo la hora)');

  console.log('\n== No vas');
  const pn = await e.sesion('noe@pruebas.local', 375);
  await pn.goto(URL_D);
  ok((await pn.getByTestId('situacion').innerText()) === 'No vas', '«No vas»');
  ok((await pn.getByTestId('respuestas-apagadas').innerText()).includes('Tu respuesta: no al MdA · no al MdL') && !/lesi/i.test(await pn.locator('main').innerText()), '«Tu respuesta: no al MdA · no al MdL» (sin su motivo en esta página)');
  await foto(pn, 'domingo_no_vas_375');

  console.log('\n== Interruptor encendido: los botones de respuesta de siempre');
  await sql`update public.respuestas_web_config set encendido = true, encendido_desde = now() where id = 1`;
  await pg.goto(URL_D);
  ok(!(await pg.getByTestId('respuestas-apagadas').count()) && !(await pg.getByTestId('segun-sporteasy').count()) && (await pg.locator('.rw-vas button').count()) >= 2, 'encendido: sin «desactivadas» ni «Según SportEasy», con los botones para responder');
  await sql`update public.respuestas_web_config set encendido = false where id = 1`;

  console.log('\n== Un jugador inactivo no lee nada');
  await sql`update public.jugadores set activo = false where person_id = 'galan-domingo-guillermo'`;
  const inact = await (await api('convocados_del_domingo', { p_fecha: J3 }, P['galan-domingo-guillermo'].token)).json();
  ok(inact === null, 'inactivo: null', JSON.stringify(inact));
  await sql`update public.jugadores set activo = true where person_id = 'galan-domingo-guillermo'`;

  console.log('\n== Migración 20261025100000 reversible (D111): se deshace limpia y se vuelve a aplicar');
  const funcs = async () => (await sql`select count(*)::int n from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname in ('convocados_del_domingo', 'ultima_importacion_respuestas')`)[0].n;
  ok(await funcs() === 2, 'aplicada: las dos funciones');
  await sql.unsafe(fs.readFileSync(path.join(RAIZ, 'supabase', 'migrations', '20261025100000_convocados_domingo.revertir.sql'), 'utf8'));
  ok(await funcs() === 0 && !(await sql`select 1 from supabase_migrations.schema_migrations where version = '20261025100000'`).length, 'revertir.sql las quita y borra su registro');
  await migrar(sql, { log: () => {} });
  ok(await funcs() === 2, 'y se vuelve a aplicar');
  ok(JSON.stringify(await (await api('convocados_del_domingo', { p_fecha: J3 }, P['esteban-jon'].token)).json()) === JSON.stringify({ MdA: ['Jon', 'Zoe'], MdL: ['Adriano'] }), 'y sigue dando lo mismo');

  ok(!e.errores.length, 'sin errores en la consola', e.errores.slice(0, 3).join(' | '));
} catch (err) {
  console.log(`  FALLO ${err.stack}`);
  sumar();
} finally {
  await e.parar();
}
console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK');
process.exit(fallos() ? 1 : 0);
