#!/usr/bin/env node
// MdFantasy (D196), fase 1: saca de la base, EN SOLO LECTURA, las filas con las que se puntua cada jornada de 2026-27 y
// las deja en privado/fantasy/datos.json (fuera de git: lleva quien respondio y cuando).
//
//   node scripts/fantasy/extraer.mjs --confirmar <ref>     el real, dentro de una transaccion READ ONLY
//   node scripts/fantasy/extraer.mjs --pila                la pila local
// Norma 19: sin --confirmar <ref> ni --pila no se conecta (lib/destino.mjs).
//
// NO lee jugadores_privado (ni niveles ni «dobla»): solo la hoja, el estado visible de cada respuesta (_estado_efectivo,
// el de v_quien_va), su hora, los avisos enviados, la convocatoria aprobada y la asistencia. Tampoco motivos ni detalles.
// Es la misma consulta que _fantasy_datos_jornada (migracion 20261121100000), para una base que aun no la tiene.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { conectar } from '../db.mjs';
import { exigirDestino } from '../lib/destino.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SALIDA = path.join(RAIZ, '..', 'privado', 'fantasy', 'datos.json');
const TEMPORADA = '2026-27';
const GRUPO = { MdA: 'G1', MdL: 'G2' };

export async function extraer(sql) {
  const jugadores = await sql`select person_id, nombre_oficial, nombre_visible from public.jugadores where activo and rol = 'jugador' order by person_id`;
  const personas = await sql`select person_id, nombre_visible, rol::text as rol from public.jugadores where activo order by person_id`;
  const liga = await sql`select id, equipo, jornada, fecha::text as fecha, inicio::text as inicio, oficial, rival from public.eventos
                         where temporada = ${TEMPORADA} and tipo = 'liga' and oficial is not false and estado = 'programado' and borrado_en is null order by fecha, inicio`;
  const fechas = [...new Set(liga.map((e) => e.fecha))];
  const jornadas = [];
  let anterior = null;
  for (const fecha of fechas) {
    const delDia = liga.filter((e) => e.fecha === fecha);
    const partidos = [], lineas = [];
    for (const ev of delDia) {
      const [p] = await sql`select id, local, visitante, pts_local, pts_visitante from public.liga_partidos
                            where temporada = ${TEMPORADA} and nuestro and grupo = ${GRUPO[ev.equipo]} and jornada = ${ev.jornada}`;
      if (!p) continue;
      const somosLocal = p.local === ev.equipo;
      const filas = await sql`select nombre, segundos, pts, mas_menos from public.liga_estadisticas_jugador where partido_id = ${p.id} and equipo = ${ev.equipo}`;
      partidos.push({ equipo: ev.equipo, rival: somosLocal ? p.visitante : p.local, pts_favor: somosLocal ? p.pts_local : p.pts_visitante, pts_contra: somosLocal ? p.pts_visitante : p.pts_local, segundos_equipo: filas.reduce((s, f) => s + (f.segundos ?? 0), 0) });
      for (const f of filas) lineas.push({ equipo: ev.equipo, nombre: f.nombre, segundos: f.segundos ?? 0, pts: f.pts ?? 0, mas_menos: f.mas_menos ?? 0 });
    }
    const desde = anterior ? anterior : '2026-09-01';
    const eventos = await sql`select id, tipo, equipo, fecha::text as fecha, inicio::text as inicio, oficial from public.eventos
                              where temporada = ${TEMPORADA} and oficial is not false and estado = 'programado' and borrado_en is null
                                and ((tipo = 'entreno' and fecha > ${desde} and fecha <= ${fecha}) or (tipo = 'liga' and fecha = ${fecha})) order by fecha, inicio`;
    const ids = eventos.map((e) => e.id);
    const estados = ids.length ? await sql`
      select e.id as evento_id, j.person_id, ef.respuesta as estado, ef.por, r.origen, r.cambiado_en
      from public.eventos e
      join public.jugadores j on j.activo and j.rol = 'jugador' and public._invitado(j.person_id, e.id)
      left join public.respuestas r on r.evento_id = e.id and r.person_id = j.person_id
      cross join lateral public._estado_efectivo(e.id, j.person_id, r.respuesta) ef
      where e.id in ${sql(ids)} and not ef.fuera` : [];
    const conRespuestas = ids.length ? await sql`select evento_id, count(*)::int n from public.respuestas where evento_id in ${sql(ids)} group by 1` : [];
    const avisos = ids.length ? await sql`select person_id, eventos, enviado_en from public.avisos_registro
                                           where tipo = 'recordatorio' and person_id is not null and enviado_en is not null and eventos && ${sql.array(ids)}::uuid[]` : [];
    const asistencia = ids.length ? await sql`
      select e.id as evento_id, a.person_id, a.estado from public.asistencia_eventos a
      join public.eventos e on e.id in ${sql(ids)}
        and (a.evento_ref = e.id::text or (a.origen = 'sporteasy' and a.ambito = 'entrenos' and e.tipo = 'entreno' and a.fecha = e.fecha))
      where a.temporada = ${TEMPORADA}` : [];
    const [conv] = await sql`select equipos from public.convocatorias where fecha = ${fecha} and estado = 'aprobada'`;
    const convocados = conv ? [...new Set(Object.values(conv.equipos ?? {}).flat().map((x) => x.person_id))] : [];
    jornadas.push({
      fecha, jugadores, partidos, lineas, eventos,
      estados: estados.map((x) => ({ ...x, primera_en: null })), avisos, asistencia, convocados,
      publicada: partidos.length === delDia.length && partidos.length > 0,
      eventos_sin_datos: eventos.filter((e) => !conRespuestas.some((c) => c.evento_id === e.id)).map((e) => e.id),
    });
    anterior = fecha;
  }
  return { generado: new Date().toISOString(), temporada: TEMPORADA, personas, jornadas };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await exigirDestino(process.argv.slice(2));
  const sql = conectar();
  try {
    let datos;
    try {
      await sql.begin('read only', async (tx) => { datos = await extraer(tx); throw new Error('__fin__'); });
    } catch (e) { if (e.message !== '__fin__') throw e; }
    fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
    fs.writeFileSync(SALIDA, JSON.stringify(datos, null, 1));
    console.log(`Jornadas: ${datos.jornadas.length} (${datos.jornadas.filter((j) => j.publicada).length} con estadísticas). Elegibles: ${datos.jornadas[0]?.jugadores.length ?? 0}.`);
    console.log(`Guardado en ${path.relative(path.join(RAIZ, '..'), SALIDA)} (fuera de git).`);
  } finally { await sql.end(); }
}
