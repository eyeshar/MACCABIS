#!/usr/bin/env node
// MdFantasy (D196): las capturas del manual. Trabaja sobre la demo LOCAL de `fantasy:probar` (base de usar y tirar en
// 127.0.0.1): no se conecta al Supabase real ni a Vercel (D179).
//
//   1) en una consola:  npm run fantasy:probar -- --confirmar <ref> --sin-ventanas
//   2) en otra:         npm run fantasy:manual
//
// Saca dos juegos de las mismas siete pantallas, a 390 px de ancho, recortadas a su zona, sin la barra inferior y con un
// alto máximo de 1.400 px:
//   · privado/mockups_liga/rediseno/mdfantasy/manual/   con los nombres de verdad (fuera de git): para el manual.
//   · src/app/mdfantasy/como-se-juega/imagenes/         con NOMBRES INVENTADOS: las que ilustran «Cómo se juega». El
//     repositorio es público y esas pantallas llevan compromiso (asistencia) de cada jugador: ahí no van nombres reales.
// Toca la demo (es de usar y tirar): deja al protagonista con cinco convocados alineados; para el mercado le vende un
// suplente y al acabar se lo vuelve a fichar.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { chromium } from 'playwright';
import { PUERTOS } from '../../pruebas/infra/puertos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR_REAL = path.resolve(RAIZ, '..', 'privado', 'mockups_liga', 'rediseno', 'mdfantasy', 'manual');
const DIR_WEB = path.join(RAIZ, 'src', 'app', 'mdfantasy', 'como-se-juega', 'imagenes');
const APP = `http://127.0.0.1:${PUERTOS.app}`;
const ANCHO = 390, ALTO_MAX = 1400;
const INVENTADOS = ['Lucas', 'Mateo', 'Hugo', 'Pablo', 'Álvaro', 'Diego', 'Marcos', 'Rubén', 'Adrián', 'Óscar', 'Raúl', 'Samuel', 'Gonzalo', 'Héctor', 'Íñigo', 'Joel', 'Bruno', 'Marcelo', 'Nico', 'Quique', 'Rafa', 'Santi', 'Toni', 'Unai', 'Félix', 'Germán', 'Ismael', 'Leo', 'Abel', 'Borja', 'César', 'Dani', 'Elías', 'Fabio', 'Gael', 'Izan'];

const sql = postgres(`postgres://postgres:postgres@127.0.0.1:${PUERTOS.pg}/postgres`, { onnotice: () => {}, max: 2 });
try { await sql`select 1 from public.fantasy_config`; } catch { console.error('No encuentro la demo: arranca antes `npm run fantasy:probar -- --confirmar <ref> --sin-ventanas`.'); process.exit(1); }
const nav = await chromium.launch();
const correo = (pid) => `${pid}@pruebas.local`;
const sesiones = new Map();

async function sesion(pid) {
  if (sesiones.has(pid)) return sesiones.get(pid);
  const ctx = await nav.newContext({ viewport: { width: ANCHO, height: 844 } });
  const p = await ctx.newPage();
  if (!(await sql`select 1 from auth.users where email = ${correo(pid)}`).length) await sql`insert into auth.users (email, encrypted_password, last_sign_in_at) values (${correo(pid)}, 'x', now())`;
  await p.goto(`${APP}/entrar`);
  await p.getByLabel('Tu correo').fill(correo(pid));
  await p.getByRole('button', { name: 'Enviarme el código' }).click();
  await p.getByText('Código enviado a').waitFor({ timeout: 15000 });
  const [{ codigo }] = await sql`select codigo from public._otp_pruebas where email = ${correo(pid)}`;
  await p.getByLabel('Código del correo').fill(codigo);
  await p.getByRole('button', { name: 'Entrar', exact: true }).click();
  await p.waitForURL((u) => !u.pathname.startsWith('/entrar'), { timeout: 20000 });
  const estado = await ctx.storageState();
  await ctx.close();
  sesiones.set(pid, estado);
  return estado;
}
async function pagina(pid, escala = 2) {
  const ctx = await nav.newContext({ viewport: { width: ANCHO, height: 2600 }, deviceScaleFactor: escala, storageState: await sesion(pid) });
  const p = await ctx.newPage();
  p.ir = async (ruta) => {
    await p.goto(`${APP}${ruta}`);
    await p.waitForLoadState('networkidle');
    await p.addStyleTag({ content: '.nv-barra { display: none !important; } * { scroll-behavior: auto !important; }' });
    await p.evaluate(() => document.fonts.ready);
  };
  return p;
}
const caja = async (loc) => { const b = await loc.first().boundingBox(); if (!b) throw new Error(`no encuentro la zona ${loc}`); return b; };

/** Una captura: `preparar(p)` deja la pantalla lista y devuelve [zona de arriba, zona de abajo] (localizadores). */
async function captura(dir, nombre, pid, preparar) {
  let escala = 2, p, y0, y1;
  for (let vuelta = 0; ; vuelta++) {
    p = await pagina(pid, escala);
    const [desde, hasta] = await preparar(p);
    const a = await caja(desde), b = await caja(hasta);
    y0 = Math.max(0, Math.floor(a.y) - 8); y1 = Math.ceil(b.y + b.height) + 8;
    const cabe = Math.floor((ALTO_MAX / (y1 - y0)) * 100) / 100;
    if (cabe >= escala || vuelta) break;
    await p.context().close();
    escala = cabe;   // más alta de 700 px de pantalla: la misma zona, a menos puntos por píxel
  }
  const errores = await p.evaluate(([a, b]) => [...document.querySelectorAll('.aviso-error, [data-testid="fz-error"], [role="alert"]')].filter((e) => { const r = e.getBoundingClientRect(); return r.height > 0 && r.bottom > a && r.top < b && e.textContent.trim(); }).map((e) => e.textContent.trim()), [y0, y1]);
  if (errores.length) throw new Error(`${nombre}: hay un aviso de error en la zona: ${errores.join(' | ')}`);
  const fichero = path.join(dir, `${nombre}.png`);
  await p.screenshot({ path: fichero, clip: { x: 0, y: y0, width: ANCHO, height: y1 - y0 }, animations: 'disabled' });
  const texto = await p.evaluate(([a, b]) => { const w = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT); const t = []; for (let n; (n = w.nextNode());) { const r = document.createRange(); r.selectNode(n); const c = r.getBoundingClientRect(); if (c.height > 0 && c.bottom > a && c.top < b) t.push(n.textContent); } return t.join(' '); }, [y0, y1]);
  await p.context().close();
  const png = fs.readFileSync(fichero);
  const ancho = png.readUInt32BE(16), alto = png.readUInt32BE(20);
  if (alto > ALTO_MAX) throw new Error(`${nombre}: ${alto} px de alto`);
  console.log(`   ${nombre}.png  ${ancho}×${alto} px`);
  return texto;
}

// ---------------------------------------------------------------- la escena
const [{ j: jornada }] = await sql`select public._fantasy_jornada_actual()::text j`;
const conv = (await sql`select equipos from public.convocatorias where fecha = ${jornada} and estado = 'aprobada'`)[0]?.equipos;
if (!conv) throw new Error(`La convocatoria del ${jornada} no está publicada en la demo: sin ella no hay marcas de convocado.`);
const convocados = new Set([...(conv.MdA ?? []), ...(conv.MdL ?? [])].map((x) => x?.person_id ?? x));
const gestores = (await sql`select j.person_id from public.gestores g join public.jugadores j on j.email = g.email`).map((x) => x.person_id);
let copias = await sql`select c.manager, c.jugador, f.valor::float8 valor from public.fantasy_copias c join public.fantasy_jugadores f on f.person_id = c.jugador`;
const managers = [...new Set(copias.map((c) => c.manager))].filter((m) => !gestores.includes(m));
const deM = (m) => copias.filter((c) => c.manager === m).sort((a, b) => b.valor - a.valor);
const cajas = new Map((await sql`select manager, sum(importe)::float8 caja from public.fantasy_movimientos group by 1`).map((x) => [x.manager, x.caja]));
const [{ person_id: estrella }] = await sql`select person_id from public.fantasy_jugadores order by valor desc, person_id limit 1`;
// Protagonista: un jugador (no gestor, y que no sea el de la carta) con cinco convocados y la caja más llena, para que pueda fichar.
const prota = managers.filter((m) => m !== estrella).map((m) => ({ m, n: deM(m).filter((c) => convocados.has(c.jugador)).length, total: deM(m).length, caja: cajas.get(m) ?? 0 }))
  .filter((x) => x.total >= 6 && x.n >= 5).sort((a, b) => b.caja - a.caja || a.m.localeCompare(b.m))[0];
if (!prota || prota.n < 5) throw new Error('Ningún mánager de la demo tiene cinco convocados en su plantilla.');
const yo = prota.m;
/** Fichar o vender desde la pantalla del mercado, como lo haría el mánager. */
async function operar(accion, jugador) {
  const p = await pagina(yo);
  await p.ir('/mdfantasy?tab=mercado');
  await p.getByTestId(`fz-${accion}-${jugador}`).click();
  await p.getByTestId(`fz-${accion}-si-${jugador}`).click();
  for (let i = 0; ((await sql`select 1 from public.fantasy_copias where manager = ${yo} and jugador = ${jugador}`).length > 0) !== (accion === 'fichar'); i++) {
    if (i > 100) throw new Error(`No se ha guardado: ${accion} ${jugador}`);
    await new Promise((r) => setTimeout(r, 150));
  }
  await p.context().close();
}
if (prota.total < 7) {   // le falta uno (p. ej. de una pasada anterior a medias): ficha al libre más barato
  const [libre] = await sql`select f.person_id from public.fantasy_jugadores f where f.en_mercado and f.person_id <> ${yo} and not exists (select 1 from public.fantasy_copias c where c.jugador = f.person_id and c.manager = ${yo})
    and (select count(*) from public.fantasy_copias c where c.jugador = f.person_id) < f.copias order by f.valor, f.person_id limit 1`;
  await operar('fichar', libre.person_id);
  copias = await sql`select c.manager, c.jugador, f.valor::float8 valor from public.fantasy_copias c join public.fantasy_jugadores f on f.person_id = c.jugador`;
}
const titulares = deM(yo).filter((c) => convocados.has(c.jugador)).slice(0, 5).map((c) => c.jugador);
const vetado = (await sql`select capitan from public.fantasy_alineaciones where manager = ${yo} and jornada < ${jornada} order by jornada desc limit 1`)[0]?.capitan;
const capitan = titulares.find((t) => t !== vetado), vice = titulares.find((t) => t !== capitan);
await sql`insert into public.fantasy_alineaciones (manager, jornada, titulares, capitan, vice) values (${yo}, ${jornada}, ${titulares}, ${capitan}, ${vice})
          on conflict (manager, jornada) do update set titulares = excluded.titulares, capitan = excluded.capitan, vice = excluded.vice`;
const suplente = deM(yo).filter((c) => !titulares.includes(c.jugador)).at(-1)?.jugador;
const sinEquipo = (await sql`select person_id from public.jugadores j where activo and rol = 'jugador' and not exists (select 1 from public.fantasy_managers m where m.person_id = j.person_id) order by person_id limit 1`)[0].person_id;

async function juego(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const textos = [];
  const t = async (...a) => textos.push(await captura(dir, ...a));
  await t('manual_01_crear', sinEquipo, async (p) => { await p.ir('/mdfantasy'); const z = p.getByTestId('fz-bienvenida'); return [z, z]; });
  await t('manual_02_plantilla', yo, async (p) => { await p.ir('/mdfantasy?tab=plantilla'); return [p.getByTestId('fz-cifras-plantilla'), p.getByTestId('fz-banquillo')]; });
  await t('manual_05_jornada', yo, async (p) => { await p.ir('/mdfantasy?tab=jornada'); return [p.getByTestId('fz-cifras-jornada'), p.getByTestId('fz-desglose')]; });
  await t('manual_06_ranking', yo, async (p) => { await p.ir('/mdfantasy?tab=ranking'); return [p.getByTestId('fz-podio'), p.getByTestId('fz-ranking-managers')]; });
  await t('manual_07_carta', yo, async (p) => { await p.ir(`/mdfantasy/jugador/${estrella}`); return [p.locator('.fz-carta'), p.getByTestId('fz-carta-ultimas')]; });
  // Para el mercado, un hueco en la plantilla: con siete no se puede fichar ni hacer un clausulazo.
  await operar('vender', suplente);
  const filas = (p) => p.getByTestId('fz-mercado').locator('li.fz-fila');
  const tipos = (p) => filas(p).evaluateAll((ls) => ls.map((li) => (li.querySelector('button[data-testid^="fz-fichar-"]') ? 'fichar' : li.querySelector('button[data-testid^="fz-clausulazo-"]') ? 'clausulazo' : /Lo tienes/.test(li.textContent) ? 'mio' : '')));
  await t('manual_03_mercado', yo, async (p) => {
    await p.ir('/mdfantasy?tab=mercado');
    const ts = await tipos(p);
    let mejor = null;
    for (let i = 0; i < ts.length; i++) for (let k = i + 2; k < ts.length; k++) {
      const v = ts.slice(i, k + 1);
      if (['fichar', 'clausulazo', 'mio'].every((x) => v.includes(x)) && (!mejor || k - i < mejor[1] - mejor[0])) mejor = [i, k];
    }
    if (!mejor) throw new Error(`En el mercado no salen a la vez «Fichar», «Clausulazo» y «Lo tienes»: ${ts.join(',')}`);
    while (mejor[1] - mejor[0] < 3) { if (mejor[0] > 0) mejor[0]--; else mejor[1]++; }   // al menos cuatro filas
    return [mejor[0] === 0 ? p.getByTestId('fz-mercado') : filas(p).nth(mejor[0]), filas(p).nth(mejor[1])];
  });
  await t('manual_04_clausulazo', yo, async (p) => {
    await p.ir('/mdfantasy?tab=mercado');
    const i = (await tipos(p)).indexOf('clausulazo');
    await filas(p).nth(i).locator('button[data-testid^="fz-clausulazo-"]').click();
    await filas(p).nth(i).getByText('¿A quién se lo quitas?').waitFor();
    return [filas(p).nth(Math.max(0, i - 1)), filas(p).nth(i + 1)];
  });
  await operar('fichar', suplente);   // y la plantilla vuelve a quedar como estaba
  return textos.join(' ');
}

try {
  console.log(`Protagonista: ${yo} · sin equipo: ${sinEquipo} · carta: ${estrella} · jornada en juego: ${jornada}`);
  console.log(`1/2 · Con los nombres de verdad → ${DIR_REAL}`);
  await juego(DIR_REAL);

  console.log(`2/2 · Con nombres inventados → ${DIR_WEB}`);
  // Los nombres que pinta el juego están en sus dos tablas (fantasy_jugadores y fantasy_managers): se cambian ahí y se devuelven al acabar.
  const reales = await sql`select person_id, nombre, 'fantasy_jugadores' tabla from public.fantasy_jugadores union all select person_id, nombre, 'fantasy_managers' from public.fantasy_managers`;
  const ids = [...new Set(reales.map((x) => x.person_id))].sort();
  if (ids.length > INVENTADOS.length) throw new Error('Faltan nombres inventados.');
  try {
    for (const x of reales) await sql`update public.${sql(x.tabla)} set nombre = ${INVENTADOS[ids.indexOf(x.person_id)]} where person_id = ${x.person_id}`;
    const texto = await juego(DIR_WEB);
    const palabras = new Set(reales.flatMap((x) => x.nombre.split(/[^\p{L}]+/u)).filter((w) => w.length > 2 && !INVENTADOS.includes(w)).map((w) => w.toLowerCase()));
    const colados = [...new Set(texto.split(/[^\p{L}]+/u).filter((w) => palabras.has(w.toLowerCase())))];
    if (colados.length) throw new Error(`En las imágenes de la web se ha colado un nombre real: ${colados.join(', ')}`);
    console.log('   Ningún nombre real en las imágenes de la web.');
  } finally {
    for (const x of reales) await sql`update public.${sql(x.tabla)} set nombre = ${x.nombre} where person_id = ${x.person_id}`;
  }
  console.log('Hecho.');
} finally {
  await nav.close();
  await sql.end();
}
