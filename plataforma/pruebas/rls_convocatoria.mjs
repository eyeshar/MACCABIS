#!/usr/bin/env node
// Convocatoria v1 (D107) contra la pila LOCAL (Postgres + PostgREST reales con NUESTRAS migraciones). Datos privados
// SINTÉTICOS (jugadores «sint-…» creados solo aquí; nunca niveles de personas reales, D39):
//   - la migración es solo aditiva y reversible (su .revertir.sql la deshace limpia y se vuelve a aplicar);
//   - anónimo, jugador y una cuenta sin ficha NO leen datos privados, convocatorias ni cambios, ni escriben;
//   - los 3 gestores sí: leen y escriben datos privados; guardan, aprueban y marcan salidas solo con funciones;
//   - un cambio a mano exige motivo; nadie borra por la API;
//   - cambiar tras aprobar devuelve WhatsApp y SportEasy a «pendiente»;
//   - mi_convocatoria(): el jugador ve SOLO sus equipos y SOLO de convocatorias aprobadas (ni niveles ni otros).
//
//   npm run pruebas:convocatoria-rls

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { arrancar } from './pila.mjs';
import { migrar } from '../scripts/db.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const MIGS = path.join(AQUI, '..', 'supabase', 'migrations');
const MIG = '20261023100000_convocatoria';
let fallos = 0;
const ok = (cond, que, detalle = '') => {
  if (cond) console.log(`  OK    ${que}`);
  else { fallos++; console.log(`  FALLO ${que}${detalle ? ` -> ${detalle}` : ''}`); }
};
const NUEVAS = ['jugadores_privado', 'convocatorias', 'convocatoria_cambios'];
const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
const sumar = (f, n) => { const d = new Date(`${f}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

const pila = await arrancar();
try {
  const { sql, url, anonKey } = pila;
  const api = async (ruta, { metodo = 'GET', cuerpo, token, extra } = {}) => {
    const r = await fetch(`${url}/rest/v1${ruta}`, {
      method: metodo,
      headers: { apikey: anonKey, authorization: `Bearer ${token ?? anonKey}`, 'content-type': 'application/json', prefer: 'return=representation', ...extra },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    let datos = null;
    try { datos = await r.json(); } catch {}
    return { status: r.status, datos };
  };
  const rpc = (f, args, token) => api(`/rpc/${f}`, { metodo: 'POST', cuerpo: args, token });
  const tablaExiste = async (n) => (await sql`select to_regclass(${'public.' + n}) as r`)[0].r !== null;
  const error = (r) => (r.datos && (r.datos.message || r.datos.msg)) || '';
  const vacioONegado = (r) => r.status === 401 || r.status === 403 || (r.status === 200 && Array.isArray(r.datos) && r.datos.length === 0);

  console.log('\n== Migración aditiva y reversible');
  const sqlMig = fs.readFileSync(path.join(MIGS, `${MIG}.sql`), 'utf8').replace(/--.*$/gm, '');
  ok(fs.existsSync(path.join(MIGS, `${MIG}.revertir.sql`)), 'tiene su .revertir.sql al lado');
  ok(!/\bdrop\b|\btruncate\b|\bdelete\b|\balter table public\.(?!jugadores_privado|convocatorias|convocatoria_cambios)\w+/i.test(sqlMig), 'solo aditiva: sin DROP, TRUNCATE, DELETE ni ALTER de tablas existentes');
  ok(!/grant[^;]*\bdelete\b/i.test(sqlMig), 'no concede DELETE a nadie');
  for (const n of NUEVAS) ok(await tablaExiste(n), `existe public.${n}`);
  const [{ rls }] = await sql`select bool_and(relrowsecurity) rls from pg_class where relname = any(${NUEVAS}) and relnamespace = 'public'::regnamespace`;
  ok(rls === true, 'las 3 tablas tienen RLS');
  const antesTablas = (await sql`select count(*)::int n from information_schema.tables where table_schema = 'public'`)[0].n;
  await sql.begin((tx) => tx.unsafe(fs.readFileSync(path.join(MIGS, `${MIG}.revertir.sql`), 'utf8')));
  const quedan = []; for (const n of NUEVAS) if (await tablaExiste(n)) quedan.push(n);
  ok(quedan.length === 0, 'revertir quita las tablas nuevas', quedan.join(', '));
  ok((await sql`select count(*)::int n from information_schema.tables where table_schema = 'public'`)[0].n === antesTablas - 3, 'y no toca ninguna otra tabla');
  await migrar(sql, { log: () => {} });
  for (const n of NUEVAS) ok(await tablaExiste(n), `tras volver a aplicar existe public.${n}`);
  // PostgREST guarda el esquema en caché: que lo vuelva a leer (y esperar a que las funciones nuevas respondan).
  await sql`notify pgrst, 'reload schema'`;
  await new Promise((r) => setTimeout(r, 1500));
  for (let i = 0; i < 40 && (await rpc('convocatoria_aprobar', { p_fecha: hoy })).status === 404; i++) await new Promise((r) => setTimeout(r, 250));

  console.log('\n== Cuentas y datos sintéticos');
  const SINT = ['sint-01', 'sint-02', 'sint-03'];
  for (const [i, p] of SINT.entries()) {
    await sql`insert into public.jugadores (person_id, nombre_oficial, nombre_visible, ficha_mda, ficha_mdl) values (${p}, ${'Sintetico, ' + i}, ${'Sint ' + i}, true, true)`;
  }
  const cuenta = async (email) => { const uid = await pila.crearUsuario(email, 'x'); return { uid, token: await pila.firmar({ sub: uid, role: 'authenticated', email }) }; };
  await sql`update public.jugadores set email = 'sint1@pruebas.local' where person_id = 'sint-01'`;
  await sql`update public.jugadores set email = 'sint2@pruebas.local' where person_id = 'sint-02'`;
  const j1 = await cuenta('sint1@pruebas.local');
  const j2 = await cuenta('sint2@pruebas.local');
  const intruso = await cuenta('intruso@pruebas.local');
  const gestores = [];
  for (const [n, e] of [['Iván', 'ivan-g@pruebas.local'], ['Carlos', 'carlos-g@pruebas.local'], ['Eduardo', 'edu-g@pruebas.local']]) {
    const c = await cuenta(e);
    await sql`insert into public.gestores (user_id, nombre, email) values (${c.uid}, ${n}, ${e})`;
    gestores.push(c);
  }
  const [tG, tC, tE] = gestores.map((g) => g.token);

  console.log('\n== Datos privados por jugador: solo los gestores');
  let r = await api('/jugadores_privado', { metodo: 'POST', cuerpo: { person_id: 'sint-01', posicion: 'base', nivel: 'B', dobla: false }, token: tG });
  ok(r.status === 201, 'un gestor (Iván) da de alta los datos privados de un jugador', `${r.status} ${error(r)}`);
  r = await api('/jugadores_privado?person_id=eq.sint-01', { metodo: 'PATCH', cuerpo: { nivel: 'A', regla: 'fijo', regla_equipo: 'MdL' }, token: tC });
  ok(r.status === 200 && r.datos?.[0]?.nivel === 'A', 'otro gestor (Carlos) los cambia', `${r.status} ${error(r)}`);
  r = await api('/jugadores_privado?select=person_id,nivel', { token: tE });
  ok(r.status === 200 && r.datos.length === 1, 'el tercero (Eduardo) los lee');
  r = await api('/jugadores_privado', { metodo: 'POST', cuerpo: { person_id: 'sint-02', nivel: 'F' }, token: tG });
  ok(r.status >= 400, 'nivel fuera de A–E: rechazado');
  r = await api('/jugadores_privado', { metodo: 'POST', cuerpo: { person_id: 'sint-02', regla: 'fijo' }, token: tG });
  ok(r.status >= 400, '«fijo» sin equipo: rechazado');
  for (const [quien, t] of [['anónimo', undefined], ['un jugador', j1.token], ['una cuenta sin ficha', intruso.token]]) {
    r = await api('/jugadores_privado?select=*', { token: t });
    ok(vacioONegado(r), `${quien} NO lee datos privados`, `${r.status} ${JSON.stringify(r.datos).slice(0, 80)}`);
    r = await api('/jugadores_privado', { metodo: 'POST', cuerpo: { person_id: 'sint-03', nivel: 'A' }, token: t });
    ok(r.status >= 400, `${quien} NO escribe datos privados`, String(r.status));
    r = await api('/jugadores_privado?person_id=eq.sint-01', { metodo: 'PATCH', cuerpo: { nivel: 'E' }, token: t });
    ok(r.status >= 400 || (Array.isArray(r.datos) && r.datos.length === 0), `${quien} NO cambia datos privados`, String(r.status));
  }
  ok((await sql`select nivel from public.jugadores_privado where person_id = 'sint-01'`)[0].nivel === 'A', 'el nivel sigue siendo el que puso el gestor');
  r = await api('/jugadores_privado?person_id=eq.sint-01', { metodo: 'DELETE', token: tG });
  ok(r.status >= 400 && (await sql`select count(*)::int n from public.jugadores_privado`)[0].n === 1, 'ni un gestor borra por la API', String(r.status));

  console.log('\n== Carga de la hoja privada (npm run db:privado), con una hoja SINTÉTICA');
  const { leerHoja, cargarPrivado } = await import('../scripts/cargar_privado.mjs');
  const ExcelJS = (await import('exceljs')).default;
  const hojaSintetica = async (filas, nombre = 'sint.xlsx') => {
    const wb = new ExcelJS.Workbook();
    const h = wb.addWorksheet('Jugadores');
    h.addRow(['Mote', 'Nombre', 'Apellido 1', 'Apellido 2', 'Posición', 'Nivel (tuyo)', 'Ataque (tuyo)', 'Defensa (tuya)', 'Dobla', 'Minutos 25/26+26/27', 'Puntos 25/26+26/27', 'Pts/min', 'Ataque (usar)', 'Total calculado']);
    for (const f of filas) h.addRow(f);
    const p = wb.addWorksheet('Parametros');
    [['Parámetro', 'Valor'], ['Minutos mínimos para usar el dato', 300], ['Corte A (pts/min ≥)', 0.35], ['Corte B (pts/min ≥)', 0.2], ['Corte C (pts/min ≥)', 0.14], ['Corte D (pts/min ≥)', 0.08]].forEach((x) => p.addRow(x));
    const f = path.join(os.tmpdir(), `maccabis-${process.pid}-${nombre}`);
    await wb.xlsx.writeFile(f);
    return f;
  };
  // sint-02 (por nombre completo «Sintetico, 1»): 400 min y 0,25 pts/min → su ataque C pasa a B; total de B y D = C.
  // sint-03 (por mote «Sint 2»): 100 min → manda su letra (E).
  const buena = await hojaSintetica([
    ['Otro mote', '1', 'Sintetico', '', 'Ala-pívot', 'C', 'C', 'D', 'No', 400, 100, 0.25, 'B', 'C'],
    ['Sint 2', 'Nadie', 'Que', 'No Existe', 'Escolta', 'E', 'E', 'E', 'Sí', 100, 10, 0.1, 'E', 'E'],
    ['Leyenda: esto no es un jugador'],
  ]);
  const h = await leerHoja(buena);
  ok(h.errores.length === 0 && h.filas.length === 2, 'lee las dos filas y salta la leyenda', h.errores.join(' | '));
  ok(h.filas[0].posicion === 'ala_pivot' && h.filas[0].nota_ataque === 'B' && h.filas[0].ataque_tuyo === 'C' && h.filas[1].dobla === true, 'usa «Ataque (usar)» (B), no «Ataque (tuyo)» (C); posiciones con tildes y Sí/No');
  const mala = await leerHoja(await hojaSintetica([['Sint 1', '1', 'Sintetico', '', 'Base', 'B', 'C', 'B', 'No', 400, 100, 0.25, 'C', 'C']], 'mala.xlsx'));
  ok(mala.errores.some((e) => /Ataque \(usar\)/.test(e)), '«Ataque (usar)» que no cuadra con Parametros (hoja sin recalcular): error y no se carga');
  ok((await cargarPrivado(sql, h.filas, { log: () => {} })) === 0 && (await sql`select count(*)::int n from public.jugadores_privado where person_id in ('sint-02','sint-03')`)[0].n === 0, 'simulacro por defecto: no escribe');
  await sql`update public.jugadores_privado set regla = 'comodin', regla_equipo = null where person_id = 'sint-01'`;
  ok((await cargarPrivado(sql, h.filas, { aplicar: true, log: () => {} })) === 2, 'con --aplicar carga los dos');
  const [s2] = await sql`select nivel, nota_ataque, nota_total, minutos, pts_min::float pm from public.jugadores_privado where person_id = 'sint-02'`;
  ok(s2.nivel === 'C' && s2.nota_ataque === 'B' && s2.nota_total === 'C' && s2.minutos === 400 && s2.pm === 0.25, 'el nivel es «Nivel (tuyo)» y las notas quedan al lado');
  ok((await sql`select count(*)::int n from public.jugadores_privado where person_id = 'sint-03'`)[0].n === 1, 'el que no casa por nombre completo entra por su mote (nombre visible)');
  let errHoja = ''; try { await cargarPrivado(sql, [{ ...h.filas[0], fila: 9, completo: 'nadie, nadie', mote: 'Nadie' }], { aplicar: true, log: () => {} }); } catch (e) { errHoja = e.message; }
  ok(/no se encuentra en la plantilla/.test(errHoja), 'una fila que no está en la plantilla para la carga entera');

  console.log('\n== Convocatoria: guardar, motivo, aprobar y salidas (solo gestores, solo con funciones)');
  const fecha = sumar(hoy, 7), pasada = sumar(hoy, -7);
  const eq1 = { MdA: [{ person_id: 'sint-01' }], MdL: [{ person_id: 'sint-02' }] };
  r = await rpc('convocatoria_guardar', { p_fecha: fecha, p_jornada: 4, p_equipos: eq1, p_dificultad: { MdL: { valor: 'alta', propuesta: 'media' } }, p_accion: 'propuesta' }, tG);
  ok(r.status === 200 && r.datos?.estado === 'borrador', 'un gestor guarda la propuesta (borrador)', `${r.status} ${error(r)}`);
  for (const [quien, t] of [['anónimo', undefined], ['un jugador', j1.token], ['una cuenta sin ficha', intruso.token]]) {
    r = await rpc('convocatoria_guardar', { p_fecha: fecha, p_jornada: 4, p_equipos: { MdA: [] }, p_dificultad: null, p_accion: 'blanco' }, t);
    ok(r.status >= 400, `${quien} NO guarda convocatorias`, `${r.status}`);
    for (const t2 of ['convocatorias', 'convocatoria_cambios']) {
      r = await api(`/${t2}?select=*`, { token: t });
      ok(vacioONegado(r), `${quien} NO lee ${t2}`, `${r.status} ${JSON.stringify(r.datos).slice(0, 80)}`);
    }
    r = await rpc('convocatoria_aprobar', { p_fecha: fecha }, t);
    ok(r.status >= 400, `${quien} NO aprueba`);
  }
  r = await api('/convocatorias', { metodo: 'POST', cuerpo: { fecha: sumar(hoy, 14), equipos: {} }, token: tG });
  ok(r.status >= 400, 'ni un gestor escribe la tabla a mano: solo con las funciones (que apuntan el cambio)', String(r.status));
  r = await rpc('convocatoria_guardar', { p_fecha: fecha, p_jornada: 4, p_equipos: { MdA: [], MdL: [{ person_id: 'sint-02' }, { person_id: 'sint-01' }] }, p_dificultad: null, p_accion: 'mover', p_person: 'sint-01', p_equipo: 'MdL' }, tC);
  ok(r.status >= 400 && (await sql`select equipos from public.convocatorias where fecha = ${fecha}`)[0]?.equipos.MdA.length === 1, 'un cambio a mano SIN motivo: rechazado y no cambia nada', `${r.status} ${error(r)}`);
  r = await rpc('convocatoria_guardar', { p_fecha: fecha, p_jornada: 4, p_equipos: { Otro: [] }, p_dificultad: null, p_accion: 'blanco' }, tG);
  ok(r.status >= 400 && /equipos_no_validos/.test(error(r)), 'equipos que no son MdA ni MdL: rechazado');
  r = await rpc('convocatoria_marcar', { p_fecha: fecha, p_que: 'whatsapp' }, tG);
  ok(r.status >= 400 && /sin_aprobar/.test(error(r)), 'no se marca WhatsApp como copiado sin aprobar');
  r = await rpc('convocatoria_aprobar', { p_fecha: fecha }, tE);
  ok(r.status === 200, 'un gestor aprueba', `${r.status} ${error(r)}`);
  r = await rpc('convocatoria_marcar', { p_fecha: fecha, p_que: 'whatsapp' }, tG);
  ok(r.status === 200 && r.datos.whatsapp === 'al_dia', 'WhatsApp copiado → al día');
  r = await rpc('convocatoria_marcar', { p_fecha: fecha, p_que: 'sporteasy' }, tG);
  ok(r.status === 200 && r.datos.sporteasy === 'al_dia', 'SportEasy copiado → al día');
  r = await rpc('convocatoria_marcar', { p_fecha: fecha, p_que: 'aviso_en_espera' }, tG);
  ok(r.status === 200 && r.datos.aviso === 'en_espera', 'aviso de la web → en espera (interruptor apagado)');
  r = await rpc('convocatoria_guardar', { p_fecha: fecha, p_jornada: 4, p_equipos: { MdA: [{ person_id: 'sint-01' }], MdL: [{ person_id: 'sint-02' }, { person_id: 'sint-01' }] }, p_dificultad: null, p_accion: 'doblar', p_person: 'sint-01', p_equipo: 'MdL', p_motivo: 'equilibrar', p_nota: 'falta un interior' }, tC);
  ok(r.status === 200 && r.datos.whatsapp === 'pendiente' && r.datos.sporteasy === 'pendiente' && r.datos.estado === 'aprobada', 'cambiar tras aprobar (con motivo): sigue aprobada y WhatsApp y SportEasy vuelven a «pendiente»', JSON.stringify(r.datos));
  const [cv] = await sql`select whatsapp_base, equipos from public.convocatorias where fecha = ${fecha}`;
  ok(JSON.stringify(cv.whatsapp_base) === JSON.stringify(eq1) && cv.equipos.MdL.length === 2, 'se guarda lo último copiado (para decir qué ha cambiado)');
  const cambios = await sql`select accion, por_nombre, motivo, nota from public.convocatoria_cambios c join public.convocatorias v on v.id = c.convocatoria_id where v.fecha = ${fecha} order by en`;
  ok(cambios.map((c) => c.accion).join() === 'propuesta,aprobar,whatsapp,sporteasy,aviso,doblar', 'cada paso queda en el registro de cambios', cambios.map((c) => c.accion).join());
  ok(cambios.at(-1).motivo === 'equilibrar' && cambios.at(-1).nota === 'falta un interior' && cambios.at(-1).por_nombre === 'Carlos', 'con su motivo, su nota y quién lo hizo');
  r = await api(`/convocatoria_cambios?select=id`, { metodo: 'DELETE', token: tG });
  ok(r.status >= 400, 'nadie borra cambios por la API');

  console.log('\n== Lo que ve el jugador: solo «convocado», sus equipos y una vez aprobada');
  await rpc('convocatoria_guardar', { p_fecha: sumar(hoy, 21), p_jornada: 5, p_equipos: { MdA: [{ person_id: 'sint-02' }] }, p_dificultad: null, p_accion: 'propuesta' }, tG); // borrador: no se ve
  await sql`insert into public.convocatorias (fecha, jornada, estado, origen, equipos) values (${pasada}, 3, 'aprobada', 'propuesta', ${sql.json({ MdA: [{ person_id: 'sint-01' }] })})`; // pasada: no se ve
  r = await rpc('mi_convocatoria', {}, j1.token);
  ok(r.status === 200 && JSON.stringify(r.datos) === JSON.stringify([{ fecha, equipos: ['MdA', 'MdL'] }]), 'sint-01 ve SU convocatoria aprobada: fecha y equipos (dobla); ni el borrador ni la pasada', JSON.stringify(r.datos));
  r = await rpc('mi_convocatoria', {}, j2.token);
  ok(r.status === 200 && JSON.stringify(r.datos) === JSON.stringify([{ fecha, equipos: ['MdL'] }]), 'sint-02 ve solo lo suyo (y no la del borrador en la que está)', JSON.stringify(r.datos));
  ok(!/nivel|posicion|dificultad|person_id|propuesta|motivo/.test(JSON.stringify(r.datos)), 'sin niveles, posiciones, dificultad, propuestas, motivos ni a quién más se convoca');
  r = await rpc('mi_convocatoria', {}, intruso.token);
  ok(r.status === 200 && JSON.stringify(r.datos) === '[]', 'una cuenta sin ficha: nada');
  r = await rpc('mi_convocatoria', {});
  ok(r.status >= 400 || JSON.stringify(r.datos) === '[]', 'anónimo: nada');
} finally {
  await pila.parar();
}
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
