#!/usr/bin/env node
// Prueba de humo (D167): la web compila, arranca contra la pila local y sus páginas principales responden sin errores.
// Es lo que `pruebas:rapidas` añade al typecheck cuando se toca la plataforma y ninguna suite de pantallas arranca ya la web.
//
//   npm run pruebas:humo
import { preparar, contador } from './comun_e2e.mjs';

const { ok, fallos } = contador();
const e2e = await preparar();
const { APP, nav, errores, nuevaPagina, contexto } = e2e;
try {
  // Sin sesión: lo público responde y lo privado manda a /entrar.
  for (const ruta of ['/', '/entrar', '/liga', '/historia', '/plantilla', '/club', '/agenda']) {
    const r = await fetch(`${APP}${ruta}`, { redirect: 'manual' });
    ok(r.status < 400, `${ruta} responde (${r.status})`);
  }
  for (const ruta of ['/gestion', '/gestion/eventos', '/liga/scouting']) {
    const r = await fetch(`${APP}${ruta}`);
    ok(r.ok && new URL(r.url).pathname === '/entrar', `${ruta} sin sesión acaba en /entrar (${new URL(r.url).pathname})`);
  }
  const p = await nuevaPagina(await contexto(375));
  await p.goto(`${APP}/`);
  ok((await p.locator('main').count()) > 0, 'la portada pinta en el navegador (375 px)');
  ok(errores.length === 0, 'sin errores de JavaScript en la consola', errores.slice(0, 3).join(' | '));
  await nav.close();
} finally {
  await e2e.parar();
}
console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK');
process.exit(fallos() ? 1 : 0);
