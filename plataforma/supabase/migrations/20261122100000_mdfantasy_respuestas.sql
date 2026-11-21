-- =====================================================================================================================
-- D196 · MdFantasy: animar a contestar a tiempo (Iván, 21/11/2026; Code, `feat/mdfantasy-respuestas`).
-- Va DESPUÉS de 20261121100000_mdfantasy.sql y es independiente de su despliegue: si no está aplicada, la web funciona
-- igual (sin la marca de respuesta ni el aviso a los mánagers).
-- SOLO ADITIVA (D94, D111): dos funciones nuevas y un parámetro más en _fantasy_param (apagado: 0). No crea tablas ni
-- disparadores y no toca nada de fuera del juego.
-- Reversión: 20261122100000_mdfantasy_respuestas.revertir.sql.
--
--   _fantasy_respuestas(fecha)      estado de respuesta de cada invitado a los partidos de liga de ese domingo: el mismo
--                                   que ya ven los jugadores en el evento (_estado_efectivo, el de v_quien_va). Sin motivos.
--   fantasy_respuestas_domingo()    eso mismo para la jornada en juego, MIENTRAS su convocatoria no esté publicada. Para
--                                   quien tiene acceso al juego.
--   fantasy_sin_responder()         solo el rol de servicio (la tarea de avisos): por mánager, los jugadores de su
--                                   plantilla que siguen sin responder al domingo.
--   _fantasy_param('mitadSinRespuesta')  interruptor «Rendimiento a la mitad si no contestó a tiempo»: 0 = apagado (de salida).
-- =====================================================================================================================

create or replace function public._fantasy_param(p_clave text)
returns numeric language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select nullif(c.parametros ->> p_clave, '')::numeric from public.fantasy_config c where c.id = 1),
    case p_clave
      when 'puntoPorPunto' then 1 when 'masMenosDivisor' then 2 when 'masMenosTope' then 5 when 'bonusDoblete' then 3
      when 'respuestaRapida' then 2 when 'respuestaATiempo' then 1 when 'sinRespuesta' then -2 when 'horasRapida' then 24
      when 'entrenoAsistido' then 2 when 'planton' then -5 when 'topeCompromiso' then 6
      when 'plantilla' then 7 when 'alineados' then 5 when 'porraAcierto' then 3
      when 'valorMinimo' then 4 when 'jornadasValor' then 4 when 'clausula' then 1.5 when 'margenCopias' then 0.15
      when 'margenInicio' then 0.1 when 'cajaInicial' then 11 when 'ingresoFijo' then 1.5 when 'ingresoPorPunto' then 0.04
      when 'mitadSinRespuesta' then 0
    end)
$$;

-- Un domingo, una respuesta por jugador (como en la pantalla del domingo): «va» si va a alguno de sus partidos; si no,
-- duda, no va o sin responder.
create function public._fantasy_respuestas(p_fecha date)
returns table (person_id text, estado text)
language sql stable security definer set search_path = ''
as $$
  select j.person_id,
         case when bool_or(ef.respuesta = 'va') then 'va' when bool_or(ef.respuesta = 'duda') then 'duda'
              when bool_or(ef.respuesta = 'no') then 'no' else 'sin_responder' end
  from public.eventos e
  join public.jugadores j on j.activo and j.rol = 'jugador' and public._invitado(j.person_id, e.id)
  left join public.respuestas r on r.evento_id = e.id and r.person_id = j.person_id
  cross join lateral public._estado_efectivo(e.id, j.person_id, r.respuesta) ef
  where e.fecha = p_fecha and e.tipo = 'liga' and e.oficial is not false and e.estado = 'programado' and e.borrado_en is null
    and e.temporada = public._fantasy_temporada() and not ef.fuera
  group by j.person_id
$$;

create function public.fantasy_respuestas_domingo()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_j date := public._fantasy_jornada_actual();
begin
  if not public._fantasy_acceso() or v_j is null then return null; end if;
  if exists (select 1 from public.convocatorias c where c.fecha = v_j and c.estado = 'aprobada') then return null; end if;
  return coalesce((select jsonb_object_agg(x.person_id, x.estado) from public._fantasy_respuestas(v_j) x), '{}'::jsonb);
end $$;

-- Para el aviso de la víspera del plazo: la jornada en juego, su primer partido (de él sale el plazo, el mismo de toda la
-- web) y, por mánager, los nombres de los suyos que siguen «sin responder». null si no hay jornada, si el juego está
-- apagado o si la convocatoria ya está publicada.
create function public.fantasy_sin_responder()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_j date := public._fantasy_jornada_actual();
begin
  if v_j is null or public._fantasy_modo() = 'apagado' then return null; end if;
  if exists (select 1 from public.convocatorias c where c.fecha = v_j and c.estado = 'aprobada') then return null; end if;
  return jsonb_build_object(
    'fecha', v_j,
    'evento', (select jsonb_build_object('tipo', e.tipo, 'fecha', e.fecha, 'inicio', e.inicio, 'oficial', e.oficial) from public.eventos e
               where e.fecha = v_j and e.tipo = 'liga' and e.oficial is not false and e.estado = 'programado' and e.borrado_en is null
                 and e.temporada = public._fantasy_temporada() order by e.inicio limit 1),
    'managers', coalesce((select jsonb_agg(jsonb_build_object('person_id', m.person_id, 'pendientes', m.pendientes) order by m.person_id)
                          from (select c.manager as person_id, jsonb_agg(f.nombre order by f.valor desc, f.nombre) as pendientes
                                from public.fantasy_copias c
                                join public.fantasy_jugadores f on f.person_id = c.jugador
                                join public._fantasy_respuestas(v_j) x on x.person_id = c.jugador and x.estado = 'sin_responder'
                                group by c.manager) m), '[]'::jsonb));
end $$;

revoke execute on function public._fantasy_respuestas(date), public.fantasy_respuestas_domingo(), public.fantasy_sin_responder() from public, anon, authenticated;
grant execute on function public.fantasy_respuestas_domingo() to authenticated;
grant execute on function public.fantasy_sin_responder() to service_role;

notify pgrst, 'reload schema';
