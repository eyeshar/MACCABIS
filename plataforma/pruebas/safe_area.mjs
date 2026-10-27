#!/usr/bin/env node
// Zonas seguras del iPhone (barra de estado, muesca, barra de inicio) en la web a pantalla completa
// (statusBarStyle "black-translucent" + viewportFit "cover"): ningun boton de la cabecera, de la barra inferior ni de las
// hojas puede quedar debajo de esas zonas, y todos tienen que poder pulsarse (elementFromPoint en su centro).
// WebKit con el dispositivo iPhone 14. Ni WebKit ni Chrome dan insets propios, asi que se simulan reescribiendo en el CSS
// servido env(safe-area-inset-*) por los pixeles reales del iPhone 14 (vertical 47/0/34/0, horizontal 0/47/21/47).
//
//   npm run pruebas:safe-area            (SAFE_AREA_ANTES=1 no falla: solo para sacar las capturas «antes»)
//
// Deja capturas en privado/mockups_liga/safe-area/<antes|despues>/.

import fs from 'node:fs';
import path from 'node:path';
import { webkit, devices } from 'playwright';
import { preparar, contador, personas, visto, REPO } from './comun_e2e.mjs';

const ANTES = Boolean(process.env.SAFE_AREA_ANTES);
const SALIDA = path.join(REPO, 'privado', 'mockups_liga', 'safe-area', ANTES ? 'antes' : 'despues');
fs.mkdirSync(SALIDA, { recursive: true });

const { ok, fallos } = contador();
const PUERTO = 3150;
const e2e = await preparar({ puerto: PUERTO });
const { APP, pila } = e2e;
const JUGADOR = 'jugador@pruebas.local', GESTOR = 'gestor@pruebas.local';
const iphone = devices['iPhone 14']; // 390x844
const FORMAS = {
  vertical: { viewport: { width: 390, height: 664 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } },
  horizontal: { viewport: { width: 844, height: 390 }, insets: { top: 0, right: 47, bottom: 21, left: 47 } },
};
// La barra de Safari (vertical) no es zona segura de la pagina: el viewport de la prueba es el util (844-~180).

try {
  const { cargarLiga, leerLiga } = await import('../scripts/cargar_liga.mjs');
  await cargarLiga(pila.sql, leerLiga('2026-27'), '2026-27', { log: () => {} });
  await personas(pila, { jugadores: [['esteban-jon', JUGADOR]], gestores: [['Edu', GESTOR, 'martin-ortega-rico-eduardo']] });

  const nav = await webkit.launch();
  const reescribir = (insets) => async (ruta) => {
    const r = await ruta.fetch();
    const t = (await r.text())
      .replaceAll('env(safe-area-inset-top)', `${insets.top}px`).replaceAll('env(safe-area-inset-right)', `${insets.right}px`)
      .replaceAll('env(safe-area-inset-bottom)', `${insets.bottom}px`).replaceAll('env(safe-area-inset-left)', `${insets.left}px`);
    await ruta.fulfill({ response: r, body: t });
  };
  const codigoDe = async (email) => (await pila.sql`select codigo from public._otp_pruebas where email = ${email}`)[0]?.codigo;

  // Sesion de cada rol (una vez, sin reescribir) -> storageState
  const estados = {};
  for (const [rol, email] of [['jugador', JUGADOR], ['gestor', GESTOR]]) {
    const ctx = await nav.newContext({ ...iphone, locale: 'es-ES' });
    const p = await ctx.newPage();
    await p.goto(`${APP}/entrar`);
    await p.getByLabel('Tu correo').fill(email);
    await p.getByRole('button', { name: 'Enviarme el código' }).click();
    await p.getByText('Código enviado a').waitFor({ timeout: 15000 });
    await p.getByLabel('Código del correo').fill((await codigoDe(email)) ?? '000000');
    await p.getByRole('button', { name: 'Entrar', exact: true }).click();
    await p.waitForURL((u) => !u.pathname.startsWith('/entrar') || u.pathname.startsWith('/entrar/elegir'), { timeout: 20000 });
    estados[rol] = await ctx.storageState();
    await ctx.close();
  }

  const PANTALLAS = [
    ['inicio', '/', null], ['entrar', '/entrar', null], ['agenda', '/agenda', 'jugador'],
    ['gestion', '/gestion', 'gestor'], ['liga', '/liga', null], ['estadisticas', '/liga/estadisticas', null],
  ];
  // Cada boton/enlace de la cabecera y de la barra inferior, mas el boton «Entrar» del formulario.
  const SEL = 'header.nv-cab a, header.nv-cab button, .nv-barra a, .nv-barra button, .zb a, main form button[type=submit]';

  for (const [forma, { viewport, insets }] of Object.entries(FORMAS)) {
    console.log(`\n== iPhone 14 ${forma}`);
    for (const [nombre, ruta, rol] of PANTALLAS) {
      const ctx = await nav.newContext({ ...iphone, viewport, locale: 'es-ES', ...(rol ? { storageState: estados[rol] } : {}) });
      await ctx.route('**/*.css', reescribir(insets));
      const p = await ctx.newPage();
      await p.goto(`${APP}${ruta}`, { waitUntil: 'networkidle' });
      await p.screenshot({ path: path.join(SALIDA, `${nombre}-${forma}.png`) });
      const malos = await p.evaluate(({ sel, ins, W, H }) => {
        const out = []; let n = 0;
        for (const e of document.querySelectorAll(sel)) {
          if (e.closest('[hidden]')) continue;
          const r = e.getBoundingClientRect();
          if (!r.width || !r.height || getComputedStyle(e).visibility === 'hidden') continue;
          n++;
          const nom = (e.textContent || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 24);
          const lateral = !e.closest('.zb-fila'); // la barra de zona se desplaza de lado: sus enlaces lejanos salen por el borde a proposito
          if (r.top < ins.top - 0.5 || r.bottom > H - ins.bottom + 0.5 || (lateral && (r.left < ins.left - 0.5 || r.right > W - ins.right + 0.5))) { out.push(`${nom}: fuera de la zona segura (${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.right)},${Math.round(r.bottom)})`); continue; }
          if (!lateral && (r.left < 0 || r.right > W)) continue;
          const arriba = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          if (!arriba || !(arriba === e || e.contains(arriba) || arriba.contains(e))) out.push(`${nom}: no se puede pulsar (encima: ${arriba?.className || arriba?.tagName})`);
        }
        return { n, out };
      }, { sel: SEL, ins: insets, W: viewport.width, H: viewport.height });
      ok(malos.n > 0 && malos.out.length === 0, `${nombre} (${forma}): ${malos.n} botones dentro de la zona segura y pulsables`, malos.out.join(' | ') || 'no hay botones');
      // Cabecera: el fondo llega hasta arriba del todo (sin franja) y la fila empieza por debajo de la barra de estado.
      const cab = await p.evaluate(() => { const c = document.querySelector('header.nv-cab'); const r = c.getBoundingClientRect(); return { top: r.top, h: r.height }; });
      ok(cab.top === 0 && cab.h >= insets.top + 14 + 44, `${nombre} (${forma}): la cabecera empieza en 0 y mide ${Math.round(cab.h)}px`);
      await ctx.close();
    }
  }

  // Hoja «Mas» de la barra inferior y avisos: debajo de la barra de inicio y dentro de los laterales (vertical y horizontal estrecho)
  console.log('\n== Hoja «Mas»');
  {
    const { viewport, insets } = FORMAS.vertical;
    const ctx = await nav.newContext({ ...iphone, viewport, locale: 'es-ES', storageState: estados.gestor });
    await ctx.route('**/*.css', reescribir(insets));
    const p = await ctx.newPage();
    await p.goto(`${APP}/agenda`, { waitUntil: 'networkidle' });
    const mas = p.locator('.nv-barra .nv-barra-item').last();
    await mas.click();
    await visto(p.locator('.nv-hoja:not([hidden])'));
    await p.screenshot({ path: path.join(SALIDA, 'hoja-mas-vertical.png') });
    const h = await p.evaluate(() => { const r = document.querySelector('.nv-hoja:not([hidden])')?.getBoundingClientRect(); return r && { bottom: r.bottom, top: r.top, pb: getComputedStyle(document.querySelector('.nv-hoja:not([hidden])')).paddingBottom }; });
    ok(Boolean(h) && h.top >= insets.top && parseFloat(h.pb) >= 16 + insets.bottom, 'la hoja deja el margen de la barra de inicio y no sube bajo la barra de estado', JSON.stringify(h));
    await ctx.close();
  }

  await nav.close();
} finally {
  await e2e.parar();
}
console.log(fallos() ? `\n${fallos()} FALLOS` : '\nTodo bien');
process.exit(ANTES ? 0 : fallos() ? 1 : 0);
