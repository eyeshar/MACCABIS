#!/usr/bin/env node
// MdFantasy (D196): el dato de partida de «contestar a tiempo». Por cada domingo con partido de liga desde que las
// respuestas están en la web, qué parte de los jugadores invitados contestó POR SÍ MISMA antes del plazo (el de la web:
// `_limite_dudas`, hoy el martes a las 12:00). SOLO porcentajes: no saca ni un nombre.
//
//   npm run fantasy:respuestas -- --confirmar <ref>     el real, dentro de una transacción READ ONLY
//   npm run fantasy:respuestas -- --pila                la pila local
//
// «Por sí misma» = la respuesta la puso el jugador en la web (origen «jugador»); una puesta por un gestor, por el sistema
// (duda sin confirmar) o por una ausencia no cuenta. La hora es la de su PRIMERA respuesta si la base la guarda
// (fantasy_primeras_respuestas, desde la migración de MdFantasy); antes de eso solo queda la del último cambio: quien
// contestó a tiempo y cambió su respuesta después del plazo sale como «tarde» (el dato de esos domingos se queda corto).
// No lee jugadores_privado ni motivos.
import { fileURLToPath } from 'node:url';
import { conectar } from '../db.mjs';
import { exigirDestino } from '../lib/destino.mjs';

const TEMPORADA = '2026-27';

export async function respuestasATiempo(sql) {
  const [{ hay }] = await sql`select to_regclass('public.fantasy_primeras_respuestas') is not null as hay`;
  const filas = await sql.unsafe(`
    with ev as (
      select e.id, e.fecha, public._limite_dudas(e.id) as plazo,
             ((e.fecha + coalesce(e.inicio, time '00:00'))::timestamp at time zone 'Europe/Madrid') as inicio
      from public.eventos e
      where e.temporada = $1 and e.tipo = 'liga' and e.oficial is not false and e.estado = 'programado' and e.borrado_en is null
    ), filas as (
      select ev.fecha, j.person_id, ev.plazo, ev.inicio, r.origen, r.respuesta,
             ${hay ? 'coalesce(pr.primera_en, r.cambiado_en)' : 'r.cambiado_en'} as cuando, ${hay ? 'pr.primera_en is not null' : 'false'} as primera
      from ev
      join public.jugadores j on j.activo and j.rol = 'jugador' and public._invitado(j.person_id, ev.id)
      left join public.respuestas r on r.evento_id = ev.id and r.person_id = j.person_id
      ${hay ? 'left join public.fantasy_primeras_respuestas pr on pr.evento_id = ev.id and pr.person_id = j.person_id' : ''}
      cross join lateral public._estado_efectivo(ev.id, j.person_id, r.respuesta) ef
      where not ef.fuera
    ), persona as (
      select fecha, person_id, min(plazo) as plazo,
             bool_or(origen = 'jugador' and respuesta <> 'sin_responder' and (cuando is null or cuando <= plazo)) as a_tiempo,
             bool_or(origen = 'jugador' and respuesta <> 'sin_responder' and (cuando is null or cuando <= inicio)) as suya,
             bool_or(primera) as primera
      from filas group by fecha, person_id
    )
    select fecha::text as fecha, to_char(min(plazo) at time zone 'Europe/Madrid', 'DD/MM HH24:MI') as plazo, count(*)::int as invitados,
           count(*) filter (where a_tiempo)::int as a_tiempo, count(*) filter (where suya)::int as suya, bool_or(primera) as primera
    from persona
    group by fecha
    having bool_or(suya) and min(plazo) < now()
    order by fecha`, [TEMPORADA]);
  return filas.map((f) => ({ fecha: f.fecha, plazo: f.plazo, invitados: f.invitados, aTiempo: f.a_tiempo, suya: f.suya, primera: f.primera }));
}

const pct = (n, d) => (d ? `${Math.round((n / d) * 100)} %` : '—');
export function tabla(filas) {
  const l = ['| Domingo | Plazo | Contestó él mismo antes del plazo | Contestó él mismo (a tiempo o tarde, antes del partido) | Hora que se mira |', '|---|---|---|---|---|'];
  for (const f of filas) l.push(`| ${f.fecha.slice(8, 10)}/${f.fecha.slice(5, 7)} | ${f.plazo} | ${pct(f.aTiempo, f.invitados)} | ${pct(f.suya, f.invitados)} | ${f.primera ? 'primera respuesta' : 'último cambio'} |`);
  return l.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await exigirDestino(process.argv.slice(2));
  const sql = conectar();
  try {
    let filas;
    try { await sql.begin('read only', async (tx) => { filas = await respuestasATiempo(tx); throw new Error('__fin__'); }); } catch (e) { if (e.message !== '__fin__') throw e; }
    console.log(filas.length ? tabla(filas) : 'Aún no hay ningún domingo con respuestas en la web y el plazo cumplido.');
  } finally { await sql.end(); }
}
