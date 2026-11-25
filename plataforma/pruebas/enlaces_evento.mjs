#!/usr/bin/env node
// D203 (BACKLOG 25): ningún toque en un enlace al evento (/evento/[id]) o a un plan (/planes/[id]) se queda sin respuesta.
// Pila local, web compilada y Chrome a 375 px. GuardaEnlaces (en el layout raíz) y @/lib/navegacion/salida:
//   - sin problemas, la navegación sigue siendo la del cliente (sin carga entera) y el enlace no se queda marcado;
//   - con la navegación colgada (las peticiones RSC no vuelven nunca, como en pruebas:domingo): el toque se nota en el
//     propio enlace al momento (data-abriendo, aria-busy), la dirección no cambia, un segundo toque no lo vuelve a pedir y
//     a los ~6 s llega por una carga entera; igual para el evento y para el plan;
//   - pestaña de una versión vieja (/version.txt de otro despliegue): carga entera en seguida, sin esperar los 6 s;
//   - las redirecciones y los 404 siguen igual (sin loading.tsx, D198): /evento/<plan> lleva a /planes/<plan>,
//     /planes/<oficial> a /evento/<oficial>, un id que no existe o un plan borrado dan 404, y la salida de emergencia
//     no se dispara cuando la navegación del cliente acaba en una redirección o en un 404.
//
//   npm run pruebas:enlaces
// vigila: src/components/nav/GuardaEnlaces.tsx
// vigila: src/lib/navegacion/salida.ts
import { preparar, personas, contador, visto, hasta } from './comun_e2e.mjs';
import { hoyMadrid } from './fechas_prueba.mjs';

const { ok, fallos, sumar } = contador();
const e = await preparar();
const { sql, APP } = e;
try {
  const hoy = hoyMadrid();
  const P = await personas(e.pila, {
    jugadores: [['esteban-jon', 'jon@pruebas.local'], ['gianatti-adriano', 'adri@pruebas.local']],
    gestores: [['Gestora', 'gestora@pruebas.local']],
  });
  const [ent] = await sql`select id, fecha::text from public.eventos where tipo = 'entreno' and estado = 'programado' and fecha > ${hoy} order by fecha limit 1`;
  const api = (f, args, token) => fetch(`${e.pila.url}/rest/v1/rpc/${f}`, { method: 'POST', headers: { apikey: e.pila.anonKey, authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(args) }).then((r) => r.json());
  const plan = await api('crear_plan', { p: { tipo: 'quedada', titulo: 'Cañas del jueves', fecha: ent.fecha, inicio: '22:40', equipo: 'ambos', ubicacion_nombre: 'Bar La Esquina' } }, P['gianatti-adriano'].token);
  const PLAN = plan;
  ok(/^[0-9a-f-]{36}$/.test(String(PLAN)), 'un plan de prueba creado', JSON.stringify(plan));
  const NO_EXISTE = '00000000-0000-4000-8000-000000000000';

  console.log('\n== Las redirecciones y los 404 del servidor siguen igual (D198: sin loading.tsx)');
  const pj = await e.sesion('jon@pruebas.local', 375);
  const ir = async (ruta) => { const r = await pj.goto(`${APP}${ruta}`); return { status: r?.status(), ruta: new URL(pj.url()).pathname }; };
  let r = await ir(`/evento/${PLAN}`);
  ok(r.ruta === `/planes/${PLAN}` && r.status === 200, '/evento/<plan> lleva a /planes/<plan>', JSON.stringify(r));
  r = await ir(`/planes/${ent.id}`);
  ok(r.ruta === `/evento/${ent.id}` && r.status === 200, '/planes/<oficial> lleva a /evento/<oficial>', JSON.stringify(r));
  r = await ir(`/evento/${NO_EXISTE}`);
  ok(r.status === 404, '/evento/<id que no existe>: 404', JSON.stringify(r));
  r = await ir(`/planes/${NO_EXISTE}`);
  ok(r.status === 404, '/planes/<id que no existe>: 404', JSON.stringify(r));
  r = await ir('/evento/no-es-un-id');
  ok(r.status === 404, '/evento/<algo que no es un id>: 404', JSON.stringify(r));

  // Las peticiones de la página: cargas enteras (del documento) y RSC (navegación del cliente, sin contar las de prefetch).
  const vigilar = (p, trozo) => {
    const v = { enteras: [], rsc: 0, t0: Date.now() };
    const f = (q) => {
      if (!q.url().includes(trozo)) return;
      if (q.isNavigationRequest() && q.frame() === p.mainFrame()) v.enteras.push(Date.now() - v.t0);
      else { const h = q.headers(); if (h['rsc'] && !h['next-router-prefetch'] && !h['next-router-segment-prefetch']) v.rsc++; }
    };
    p.on('request', f);
    v.parar = () => p.off('request', f);
    v.empezar = () => { v.t0 = Date.now(); v.enteras.length = 0; v.rsc = 0; };
    return v;
  };
  const colgar = async (p, patron) => {
    const retenidas = [];
    const h = async (route) => { const x = route.request().headers(); if (x['rsc'] && !x['next-router-prefetch'] && !x['next-router-segment-prefetch']) { retenidas.push(route); return; } await route.fallback(); };
    await p.route(patron, h);
    return async () => { await p.unroute(patron, h); for (const x of retenidas) await x.abort().catch(() => {}); };
  };
  const fila = (p, href) => p.locator(`a[data-testid="fila-agenda"][href="${href}"]`).first();
  const marcada = (loc) => loc.evaluate((a) => a.hasAttribute('data-abriendo') && a.getAttribute('aria-busy') === 'true').catch(() => false);
  const ruta = (p) => new URL(p.url()).pathname;
  const erroresAntes = e.errores.length;

  console.log('\n== Sin problemas: navegación del cliente, como siempre');
  await pj.goto(`${APP}/calendario`);
  const fEnt = fila(pj, `/evento/${ent.id}`);
  ok(await visto(fEnt), 'en el calendario, la fila del entreno enlaza a /evento/<id>');
  let v = vigilar(pj, `/evento/${ent.id}`);
  await fEnt.click();
  ok(await hasta(async () => ruta(pj) === `/evento/${ent.id}`, 15000) && await visto(pj.locator('h1')), 'el toque abre el evento');
  ok(!v.enteras.length, 'sin carga entera (la navegación del cliente sigue igual)', `${v.enteras.length} cargas enteras`);
  ok(!(await pj.locator('a[data-abriendo]').count()), 'y nada se queda marcado como «abriendo»');
  v.parar();

  for (const [nombre, href, patron] of [['el evento', `/evento/${ent.id}`, '**/evento/**'], ['el plan', `/planes/${PLAN}`, '**/planes/**']]) {
    console.log(`\n== Navegación colgada hacia ${nombre}: salida de emergencia`);
    await pj.goto(`${APP}/calendario`);
    const f = fila(pj, href);
    ok(await visto(f), `la fila de ${nombre} enlaza a ${href}`);
    const soltar = await colgar(pj, patron);
    v = vigilar(pj, href);
    try {
      v.empezar();
      await f.click();
      ok(await hasta(() => marcada(f), 1500), 'el toque se nota al momento en el propio enlace (data-abriendo, aria-busy)');
      ok(ruta(pj) === '/calendario', 'la dirección sigue siendo la de antes (la navegación está colgada)', pj.url());
      await f.click({ timeout: 1000 }).catch(() => {});
      await f.click({ timeout: 1000 }).catch(() => {});
      ok(v.rsc <= 1, 'dos toques más mientras está «abriendo» no lo vuelven a pedir', `${v.rsc} peticiones RSC`);
      ok(await hasta(async () => ruta(pj) === href, 20000) && await visto(pj.locator('h1')), `a los pocos segundos, ${nombre} llega igual`);
      ok(v.enteras.length === 1 && v.enteras[0] >= 5000, 'por una carga entera, y no antes de ~6 s', JSON.stringify(v.enteras));
    } finally { v.parar(); await soltar(); }
  }

  console.log('\n== Pestaña de una versión vieja: carga entera en seguida');
  await pj.goto(`${APP}/calendario`);
  const otraVersion = (route) => route.fulfill({ status: 200, headers: { 'content-type': 'text/plain' }, body: 'otro-despliegue' });
  await pj.route('**/version.txt', otraVersion);
  const soltar = await colgar(pj, '**/evento/**');
  v = vigilar(pj, `/evento/${ent.id}`);
  try {
    v.empezar();
    await fila(pj, `/evento/${ent.id}`).click();
    ok(await hasta(async () => ruta(pj) === `/evento/${ent.id}`, 10000) && await visto(pj.locator('h1')), 'el evento llega');
    ok(v.enteras.length === 1 && v.enteras[0] < 4000, 'por una carga entera nada más saberse (sin esperar ~6 s)', JSON.stringify(v.enteras));
  } finally { v.parar(); await soltar(); await pj.unroute('**/version.txt', otraVersion); }

  console.log('\n== Una navegación del cliente que acaba en redirección o en 404 no dispara la salida de emergencia');
  // La gestora sin ficha ve en el calendario todos los eventos, cada uno a /evento/<id>, también los planes (redirección).
  const pg = await e.sesion('gestora@pruebas.local', 375);
  await pg.goto(`${APP}/calendario`);
  const fPlan = fila(pg, `/evento/${PLAN}`);
  ok(await visto(fPlan), 'la gestora: el plan enlaza a /evento/<plan>');
  v = vigilar(pg, `/planes/${PLAN}`);
  const v2 = vigilar(pg, `/evento/${PLAN}`);
  v.empezar(); v2.empezar();
  await fPlan.click();
  ok(await hasta(async () => ruta(pg) === `/planes/${PLAN}`, 15000) && await visto(pg.getByRole('heading', { name: 'Cañas del jueves' })), 'el toque lleva al plan (la redirección sigue)');
  // Pasado el plazo de la salida de emergencia (~6 s), no ha habido carga entera.
  ok(!(await hasta(() => v.enteras.length + v2.enteras.length > 0, 7500)), 'y pasados los ~6 s, sin carga entera', JSON.stringify([v.enteras, v2.enteras]));
  v.parar(); v2.parar();
  // 404 por el cliente: el plan se borra con la fila ya pintada.
  await pj.goto(`${APP}/calendario`);
  const fBorrado = fila(pj, `/planes/${PLAN}`);
  ok(await visto(fBorrado), 'Jon: la fila del plan');
  await sql`update public.eventos set borrado_en = pruebas.ahora() where id = ${PLAN}`;
  v = vigilar(pj, `/planes/${PLAN}`);
  v.empezar();
  await fBorrado.click();
  ok(await hasta(async () => ruta(pj) === `/planes/${PLAN}`, 15000) && await visto(pj.getByText(/could not be found|404/i)), 'el plan borrado: 404 (por el cliente)');
  ok(!(await hasta(() => v.enteras.length > 0, 7500)), 'y pasados los ~6 s, sin carga entera', JSON.stringify(v.enteras));
  v.parar();

  e.errores.length = erroresAntes; // las peticiones retenidas y abortadas, y el 404, son a propósito
  ok(!e.errores.length, 'sin errores en la consola', e.errores.slice(0, 3).join(' | '));
} catch (err) {
  console.log(`  FALLO ${err.stack}`);
  sumar();
} finally {
  await e.parar();
}
console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK');
process.exit(fallos() ? 1 : 0);
