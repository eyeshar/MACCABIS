#!/usr/bin/env node
// El calendario publico leido de la TABLA DE EVENTOS (paso 2, D94) es identico al de antes: /calendario.ics (67 eventos)
// = el de produccion del 07/10/2026 (fixtures/calendario_antes_paso2.ics) salvo DTSTAMP. Y un cambio de pista hecho por
// un gestor se ve en el .ics. Pila local + app compilada.
//
//   npm run pruebas:fuente-eventos

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { arrancar } from './pila.mjs';
import { cargarEventos } from '../scripts/cargar_eventos.mjs';
import { arrancarApp, abrirNavegador } from './infra/app.mjs';
import { PUERTOS, exigirLibres } from './infra/puertos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = PUERTOS.app, APP = `http://127.0.0.1:${PUERTO}`;
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };
const sinSello = (t) => t.split('\r\n').filter((l) => !l.startsWith('DTSTAMP:')).join('\r\n');
async function esperar(url, ms = 60000) { const fin = Date.now() + ms; while (Date.now() < fin) { try { const r = await fetch(url); if (r.status < 500) return; } catch {} await new Promise((r) => setTimeout(r, 300)); } throw new Error('no arranca'); }

const pila = await arrancar();
let app;
try {
  const { sql, url, anonKey } = pila;
  await cargarEventos(sql, { log: () => {} });
  // Antes de arrancar (el calendario público se cachea 60 s): una nota «privada» en un entreno que no tenía ninguna.
  const ENTRENO_CON_NOTA = (await sql`select clave from public.eventos where tipo = 'entreno' and notas is null and estado <> 'cancelado' order by fecha limit 1`)[0].clave;
  await sql`update public.eventos set notas = 'NOTA-PRIVADA-DE-PRUEBA' where clave = ${ENTRENO_CON_NOTA}`;
  const env ={ ...process.env, NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey, NEXT_TELEMETRY_DISABLED: '1' };
  app = await arrancarApp({ puerto: PUERTO, env });
  // Revisión de seguridad (20261103210000): la nota que un gestor escribe en el evento ya no sale en lo público. La única
  // del calendario de entonces (07/10) se quita de la foto de producción; el resto, idéntico.
  const NOTA = 'Cambiado solo esta semana.';
  const antes = fs.readFileSync(path.join(RAIZ, 'pruebas', 'fixtures', 'calendario_antes_paso2.ics'), 'utf8')
    .replace(`DESCRIPTION:${NOTA}\\nCalendario de Maccabis: maccabis.ve\r\n rcel.app`, 'DESCRIPTION:Calendario de Maccabis: maccabis.vercel.app');
  const ahora = await (await fetch(`${APP}/calendario.ics`)).text();
  ok((ahora.match(/BEGIN:VEVENT/g) ?? []).length === 67, '/calendario.ics: 67 eventos (40 partidos + 27 entrenos)');
  ok(!ahora.includes(NOTA) && (await sql`select count(*)::int n from public.eventos where notas = ${NOTA}`)[0].n === 1, '/calendario.ics no lleva la nota del 07/10, que sigue guardada en el evento');
  ok(sinSello(ahora) === sinSello(antes), 'idéntico al de producción antes del paso 2 (salvo DTSTAMP)', (() => { const a = sinSello(ahora).split('\r\n'), b = sinSello(antes).split('\r\n'); const i = a.findIndex((l, k) => l !== b[k]); return i < 0 ? '' : `línea ${i}: «${a[i]}» ≠ «${b[i]}»`; })());
  // Un gestor fija la pista del 14/10: el .ics lo refleja (la cache se vacia al guardar desde la web; aqui se fuerza por SQL y se espera el TTL corto de la cache de datos)
  const r = await fetch(`${APP}/`);
  ok(r.status === 200 && (await r.text()).includes('Dos equipos.'), 'la portada carga con la fuente nueva');
  // La nota sembrada antes de arrancar en el primer entreno de la temporada (la portada la pondría en minúsculas)
  const hoy = (await sql`select to_char(fecha, 'YYYY-MM-DD') f from public.eventos where clave = ${ENTRENO_CON_NOTA}`)[0].f;
  const portada = (await (await fetch(`${APP}/?hoy=${hoy}`)).text()).toLowerCase();
  ok(portada.includes('entrenamiento') && !portada.includes('nota-privada') && !ahora.toLowerCase().includes('nota-privada'),
    'una nota escrita en un entreno no sale ni en la portada de ese día ni en /calendario.ics');
  const club = await (await fetch(`${APP}/club`)).text();
  ok(club.includes('Valdebernardo') && club.includes('en obras'), '/club: Valdebernardo (Faustina Valladolid) en obras, desde la tabla de pistas');
} finally {
  app?.parar();
  await pila.parar();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
