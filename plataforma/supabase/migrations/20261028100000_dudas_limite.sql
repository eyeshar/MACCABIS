-- =============================================================================
-- Dudas con hora limite (feat/visibilidad-y-dudas, 27/10/2026; D141). SOLO ADITIVA (D111) salvo dos RELAJACIONES de
-- CHECK que no pierden nada (lo que valia antes sigue valiendo) y el cuerpo de UNA funcion interna:
--   - respuestas.origen admite ademas 'sistema' (lo que pone el cierre automatico de dudas);
--   - respuestas.motivo admite ademas 'no_confirmo' (motivo INTERNO, solo gestores: el jugador nunca lo elige y no sale en
--     v_quien_va, que solo da nombre y estado);
--   - _limite_dudas(evento): la hora limite de las dudas (funcion interna, nadie desde la API). Entreno del miercoles y
--     partido de liga de miercoles a domingo: el MARTES de esa semana a las 20:00 (los dos, el mismo martes); lo demas
--     (amistosos, torneos, «entre nosotros», planes, entrenos de otro dia): 24 h antes del inicio. Horas de Madrid;
--     misma definicion que limiteDudas en lib/avisos/horario.ts (una prueba las compara, con el cambio de hora);
--   - _escribir_respuesta: a partir del limite ya no se puede escribir «duda» (error 'limite_dudas') salvo el sistema;
--   - cerrar_dudas(p_ahora): pasa a «no va» (motivo no_confirmo, origen sistema) a quien siga en «duda» al llegar el
--     limite. Idempotente. SOLO el rol de servicio (la tarea de avisos, cada 15 min); nadie desde la API. Los eventos
--     oficiales solo con el interruptor «respuestas en la web» encendido; los planes, siempre (solo existen en la web).
-- La vista v_quien_va NO cambia: ya da nombre y estado (va, duda, no, sin_responder) de los eventos a los que esta
-- invitado quien consulta, sin motivos ni detalles ni origen.
-- Reversion al lado: 20261028100000_dudas_limite.revertir.sql (db:migrar nunca la aplica).
-- =============================================================================

alter table public.respuestas drop constraint respuestas_origen_check;
alter table public.respuestas add constraint respuestas_origen_check check (origen in ('sporteasy', 'jugador', 'gestor', 'sistema'));
alter table public.respuestas drop constraint respuestas_motivo_check;
alter table public.respuestas add constraint respuestas_motivo_check
  check (motivo in ('lesion', 'trabajo', 'viaje', 'familia', 'otro', 'horario', 'no_confirmo'));

create function public._limite_dudas(p_evento uuid)
returns timestamptz language sql stable security definer set search_path = ''
as $$
  select case
    when e.oficial and e.tipo = 'entreno' and extract(isodow from e.fecha) = 3
      then ((e.fecha - 1) + time '20:00') at time zone 'Europe/Madrid'
    when e.oficial and e.tipo = 'liga' and extract(isodow from e.fecha) >= 3
      then ((e.fecha - (extract(isodow from e.fecha)::int - 1) + 1) + time '20:00') at time zone 'Europe/Madrid'
    else ((e.fecha + coalesce(e.inicio, time '00:00')) at time zone 'Europe/Madrid') - interval '24 hours'
  end
  from public.eventos e where e.id = p_evento
$$;

create or replace function public._escribir_respuesta(p_evento uuid, p_person text, p_respuesta text, p_motivo text, p_detalle text,
                                           p_origen text, p_por uuid, p_por_nombre text, p_ausencia uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  v_antes text;
begin
  -- Desde el limite ya no hay «duda» (D141): solo el cierre automatico (origen 'sistema') escribe sobre ese limite.
  if p_respuesta = 'duda' and p_origen <> 'sistema' and now() >= public._limite_dudas(p_evento) then
    raise exception 'limite_dudas' using errcode = 'P0001';
  end if;
  select respuesta into v_antes from public.respuestas where evento_id = p_evento and person_id = p_person;
  insert into public.respuestas (evento_id, person_id, respuesta, motivo, detalle, fuente, origen, puesto_por,
                                 puesto_por_nombre, cambiado_en, leido_en, ausencia_id)
  values (p_evento, p_person, p_respuesta, p_motivo, nullif(btrim(coalesce(p_detalle, '')), ''), 'web', p_origen, p_por,
          p_por_nombre, now(), now(), p_ausencia)
  on conflict (evento_id, person_id) do update set
    respuesta = excluded.respuesta, motivo = excluded.motivo, detalle = excluded.detalle, fuente = 'web',
    origen = excluded.origen, puesto_por = excluded.puesto_por, puesto_por_nombre = excluded.puesto_por_nombre,
    cambiado_en = now(), ausencia_id = excluded.ausencia_id;
  return coalesce(v_antes, 'sin_responder');
end $$;

/** Al llegar el limite, quien siga en «duda» pasa a «no va» (motivo no_confirmo, origen sistema). Devuelve lo cambiado.
 *  Solo eventos programados que aun no han empezado. Repetirla no cambia nada (ya no quedan dudas pasadas de limite). */
create function public.cerrar_dudas(p_ahora timestamptz default now())
returns table (r_evento uuid, r_person text, r_limite timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select rs.evento_id as ev, rs.person_id as pe, public._limite_dudas(rs.evento_id) as lim
    from public.respuestas rs join public.eventos e on e.id = rs.evento_id
    where rs.respuesta = 'duda' and e.estado = 'programado' and e.borrado_en is null
      and (not e.oficial or public._respuestas_web_encendido())
      and public._inicio_evento(e.id) > p_ahora
      and public._limite_dudas(e.id) <= p_ahora
    order by 1, 2
  loop
    perform public._escribir_respuesta(r.ev, r.pe, 'no', 'no_confirmo', null, 'sistema', null, 'Sistema', null);
    r_evento := r.ev; r_person := r.pe; r_limite := r.lim;
    return next;
  end loop;
end $$;

-- Banda roja (D99.8, movida por D141): los cambios de un partido salen como alerta desde el martes a las 20:00, cuando
-- se cierran las dudas y se hace la convocatoria definitiva (antes, a las 10:00).
create or replace function public._tras_cambio_jugador(p_evento uuid, p_person text, p_antes text, p_despues text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  e public.eventos;
begin
  if p_antes is not distinct from p_despues then return false; end if;
  select * into e from public.eventos where id = p_evento;
  if e.tipo <> 'liga' then return false; end if;
  -- martes de la semana del partido (lunes = fecha - (isodow - 1)) a las 20:00 de Madrid
  if now() < (((e.fecha - (extract(isodow from e.fecha)::int - 1) + 1) + time '20:00') at time zone 'Europe/Madrid') then
    return false;
  end if;
  insert into public.alertas_gestores (evento_id, person_id, antes, despues) values (p_evento, p_person, p_antes, p_despues);
  return true;
end $$;

revoke execute on function public._limite_dudas(uuid), public.cerrar_dudas(timestamptz) from public, anon, authenticated;
grant execute on function public.cerrar_dudas(timestamptz) to service_role;

notify pgrst, 'reload schema';
