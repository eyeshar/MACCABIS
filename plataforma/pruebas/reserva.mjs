#!/usr/bin/env node
// Marca «Reserva» (D158) de extremo a extremo: pila local, web compilada y Chrome. Jugadores SINTÉTICOS (D39).
//   - La migración 20261031180000 es solo aditiva y reversible (su .revertir.sql la deshace limpia y se vuelve a aplicar).
//   - NINGÚN jugador (ni anónimo, ni jugador) lee ni escribe la marca; los gestores sí.
//   - Gestión → Jugadores: la casilla «Reserva» guarda en jugadores_privado (con quién lo cambió) y se puede quitar.
//   - Convocatoria: un reserva que dice «voy» y no hace falta sale en «Disponibles sin convocar» como «Reserva disponible»
//     (regla 1.8), con su botón «Añadir» en el borrador; la propuesta guardada no lo lleva.
//   - El reserva, en su zona (375 px): nada de la marca.
//
//   npm run pruebas:reserva
import fs from 'node:fs';
import path from 'node:path';
import { preparar, personas, sinteticos, contador, visto, trasAccion, RAIZ } from './comun_e2e.mjs';
import { adelantar, semanas } from './fechas_prueba.mjs';
import { migrar } from '../scripts/db.mjs';

const MIGS = path.join(RAIZ, 'supabase', 'migrations');
const MIG = '20261031180000_reserva';
const { ok, fallos, sumar } = contador();
const e = await preparar();
const { sql, APP } = e;
try {
  console.log('\n== Migración aditiva y reversible (D111)');
  const columnas = async () => (await sql`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'jugadores_privado' order by ordinal_position`).map((r) => r.column_name);
  const registrada = async () => (await sql`select 1 from supabase_migrations.schema_migrations where version = '20261031180000'`).length === 1;
  const texto = fs.readFileSync(path.join(MIGS, `${MIG}.sql`), 'utf8').replace(/--.*$/gm, '');
  ok(fs.existsSync(path.join(MIGS, `${MIG}.revertir.sql`)), 'tiene su .revertir.sql al lado');
  ok(!/\bdrop\b|\btruncate\b|\bdelete\b|\bupdate\b|alter\s+column|create\s+(or\s+replace\s+)?function|\bgrant\b/i.test(texto), 'solo aditiva: una columna nueva, sin DROP, DELETE, UPDATE, funciones ni permisos');
  ok(await registrada() && (await columnas()).includes('reserva'), 'aplicada: registrada y con la columna');
  const [{ def, nulo }] = await sql`select column_default def, is_nullable nulo from information_schema.columns where table_schema = 'public' and table_name = 'jugadores_privado' and column_name = 'reserva'`;
  ok(def === 'false' && nulo === 'NO', 'boolean not null default false', `${def} ${nulo}`);
  const antes = (await columnas()).filter((c) => c !== 'reserva');
  await sql.begin((tx) => tx.unsafe(fs.readFileSync(path.join(MIGS, `${MIG}.revertir.sql`), 'utf8')));
  ok(!(await registrada()) && (await columnas()).join() === antes.join(), 'revertir: quita la columna y el registro, y deja las demás columnas como estaban');
  await migrar(sql, { log: () => {} });
  ok(await registrada() && (await columnas()).includes('reserva'), 'se vuelve a aplicar, limpia');
  await sql`notify pgrst, 'reload schema'`;

  const F = await adelantar(sql, semanas('2026-10-25'));
  const J3 = F('2026-10-25');
  // 9 que dicen «voy» al MdA (2 bases, 4 exteriores, 3 interiores: los mínimos cubiertos) y Resto, reserva, también.
  // Ana, sin ficha privada, para la casilla de Jugadores.
  const lista = [['sint-b1', 'Bauno', 'base'], ['sint-b2', 'Bados', 'base'], ['sint-e1', 'Euno', 'escolta'], ['sint-e2', 'Edos', 'alero'], ['sint-e3', 'Etres', 'escolta'], ['sint-e4', 'Ecuatro', 'alero'],
    ['sint-i1', 'Iuno', 'pivot'], ['sint-i2', 'Idos', 'ala_pivot'], ['sint-i3', 'Itres', 'pivot'], ['sint-res', 'Resto', 'alero']];
  await sinteticos(sql, [...lista.map(([p, n]) => [p, n, true, true]), ['sint-ana', 'Ana', true, true]]);
  for (const [p, , pos] of lista) await sql`insert into public.jugadores_privado (person_id, posicion, nivel, dobla, reserva) values (${p}, ${pos}, 'C', true, ${p === 'sint-res'})`;
  const yo = await personas(e.pila, { jugadores: [['sint-res', 'res@pruebas.local']], gestores: [['Iván', 'gestor@pruebas.local', 'villaescusa-silva-ivan']] });
  const [mda] = await sql`select id from public.eventos where tipo = 'liga' and equipo = 'MdA' and fecha = ${J3}`;
  for (const [p] of lista) await sql`insert into public.respuestas (evento_id, person_id, respuesta, origen) values (${mda.id}, ${p}, 'va', 'jugador')`;

  console.log('\n== Permisos: ningún jugador lee ni escribe la marca');
  for (let i = 0; i < 40; i++) { const r = await fetch(`${e.pila.url}/rest/v1/jugadores_privado?select=reserva&limit=1`, { headers: { apikey: e.pila.anonKey, authorization: `Bearer ${yo['gestor@pruebas.local'].token}` } }); if (r.status === 200) break; await new Promise((ok) => setTimeout(ok, 250)); }
  const api = async (ruta, { metodo = 'GET', cuerpo, token } = {}) => {
    const r = await fetch(`${e.pila.url}/rest/v1${ruta}`, { method: metodo, headers: { apikey: e.pila.anonKey, authorization: `Bearer ${token ?? e.pila.anonKey}`, 'content-type': 'application/json', prefer: 'return=representation' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    let datos = null; try { datos = await r.json(); } catch {}
    return { status: r.status, datos };
  };
  const vacioONegado = (r) => r.status === 401 || r.status === 403 || (r.status === 200 && Array.isArray(r.datos) && r.datos.length === 0);
  ok(vacioONegado(await api('/jugadores_privado?select=person_id,reserva')), 'anónimo: no lee la marca');
  ok(vacioONegado(await api('/jugadores_privado?select=person_id,reserva', { token: yo['sint-res'].token })), 'el propio reserva (jugador con sesión): no la lee');
  const r1 = await api('/jugadores_privado?person_id=eq.sint-res', { metodo: 'PATCH', cuerpo: { reserva: false }, token: yo['sint-res'].token });
  ok((r1.status >= 400 || (Array.isArray(r1.datos) && r1.datos.length === 0)) && (await sql`select reserva from public.jugadores_privado where person_id = 'sint-res'`)[0].reserva === true, 'ni se la quita', String(r1.status));
  const r2 = await api('/jugadores_privado?select=person_id,reserva&reserva=eq.true', { token: yo['gestor@pruebas.local'].token });
  ok(r2.status === 200 && r2.datos?.length === 1 && r2.datos[0].person_id === 'sint-res', 'un gestor sí la lee', JSON.stringify(r2));

  const pg = await e.sesion('gestor@pruebas.local', 1280);

  console.log('\n== Gestión → Jugadores: la casilla «Reserva»');
  await pg.goto(`${APP}/gestion/jugadores`);
  const fila = (p) => pg.locator(`li.fila-jugador[data-person="${p}"]`);
  ok(/· reserva/.test(await fila('sint-res').innerText()), 'el reserva lleva «· reserva» en su línea');
  ok(!/· reserva/.test(await fila('sint-ana').innerText()), 'los demás no');
  await fila('sint-ana').locator('summary').click();
  const casilla = fila('sint-ana').locator('[data-campo="reserva"]');
  ok(await visto(casilla) && !(await casilla.isChecked()), 'Ana: casilla «Reserva» sin marcar (no tiene ficha privada)');
  await casilla.check();
  await trasAccion(pg, () => fila('sint-ana').getByRole('button', { name: 'Guardar datos' }).click());
  ok(await visto(fila('sint-ana').getByText('Guardado.')), 'guardar: «Guardado.»');
  const [ana] = await sql`select reserva, cambiado_por_nombre from public.jugadores_privado where person_id = 'sint-ana'`;
  ok(ana?.reserva === true && ana.cambiado_por_nombre === 'Iván', 'queda en jugadores_privado, con quién lo cambió', JSON.stringify(ana));
  await pg.goto(`${APP}/gestion/jugadores`);
  await fila('sint-ana').locator('summary').click();
  ok(await fila('sint-ana').locator('[data-campo="reserva"]').isChecked(), 'al volver a la página sigue marcada');
  await fila('sint-ana').locator('[data-campo="reserva"]').uncheck();
  await trasAccion(pg, () => fila('sint-ana').getByRole('button', { name: 'Guardar datos' }).click());
  await visto(fila('sint-ana').getByText('Guardado.'));
  ok((await sql`select reserva from public.jugadores_privado where person_id = 'sint-ana'`)[0]?.reserva === false, 'y se puede quitar');

  console.log('\n== Convocatoria: el reserva que no hace falta, «Reserva disponible» (regla 1.8)');
  await pg.goto(`${APP}/gestion/convocatoria?fecha=${J3}`);
  const sin = pg.getByTestId('cv-sin-convocar');
  ok(await visto(sin.locator('[data-person="sint-res"]').getByText('Reserva disponible')), 'vista previa: sale en «Disponibles sin convocar» como «Reserva disponible»');
  await trasAccion(pg, () => pg.getByRole('button', { name: 'Usar propuesta' }).click());
  ok(await visto(pg.getByTestId('cv-estado').getByText('Borrador')), '«Usar propuesta» → borrador');
  ok(await visto(sin.locator('[data-person="sint-res"]').getByRole('button', { name: 'Añadir' })), 'en el borrador sigue fuera, con su botón «Añadir» para subirlo a mano');
  const conv = await sql`select equipos from public.convocatorias where fecha = ${J3}`;
  const mdaConv = (conv[0]?.equipos?.MdA ?? []).map((c) => c.person_id);
  ok(mdaConv.length === 9 && !mdaConv.includes('sint-res'), 'la propuesta guardada lleva a los 9 y no al reserva', mdaConv.join());

  console.log('\n== El reserva, en su zona (375 px): nada de la marca');
  const pj = await e.sesion('res@pruebas.local', 375);
  for (const ruta of ['/', '/mi-zona', `/mi-zona/evento/${mda.id}`]) {
    await pj.goto(`${APP}${ruta}`);
    ok(!/reserva/i.test(await pj.content()), `${ruta}: ni en la página ni en el HTML`);
  }
  await pj.goto(`${APP}/gestion/jugadores`);
  ok(!/\/gestion\/jugadores/.test(pj.url()), 'Gestión → Jugadores no se abre para un jugador', pj.url());
  ok(!e.errores.length, 'sin errores en la consola', e.errores.join(' | '));
} catch (err) {
  console.log(`  FALLO ${err.stack}`); sumar();
} finally {
  await e.parar();
}
console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK');
process.exit(fallos() ? 1 : 0);
