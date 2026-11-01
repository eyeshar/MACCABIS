-- =============================================================================
-- Respuestas a mano por un gestor (D159): va, duda, no va o SIN RESPONDER, con motivo opcional.
--
-- gestor_responder(evento, personas, respuesta, motivo, detalle) es como tablero_responder (D121) con dos diferencias:
--  - acepta 'sin_responder' (deshacer una respuesta que no era) y
--  - el motivo es OPCIONAL: «no va» sin motivo vale; si viene, es uno de la lista (lesion, trabajo, viaje, familia,
--    otro) y solo se guarda con «no». El detalle (texto libre, p. ej. el motivo de un «Van / Disponible») se guarda con
--    cualquier respuesta.
-- Igual que tablero_responder: solo gestores; eventos oficiales no cancelados (tambien ya jugados: la asistencia a mano);
-- solo invitados; queda «puesta por <gestor>» (origen 'gestor', puesto_por, puesto_por_nombre) y en tablero_registro con
-- lo que habia antes, asi que tablero_deshacer la deshace. Funciona con el interruptor apagado. La hora limite de las
-- dudas (D141) sigue valiendo (_escribir_respuesta).
-- Solo aditiva: una funcion nueva; nada existente cambia. Reversion al lado: 20261031190000_respuesta_a_mano.revertir.sql
-- (db:migrar nunca la aplica).
-- =============================================================================

create function public.gestor_responder(p_evento uuid, p_personas text[], p_respuesta text, p_motivo text default null,
                                        p_detalle text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_nombre text := public._nombre_gestor();
  v_antes jsonb := '{}'::jsonb;
  v_motivo text := case when p_respuesta = 'no' then nullif(p_motivo, '') end;
  v_detalle text := nullif(btrim(coalesce(p_detalle, '')), '');
  v_p text;
  v_id uuid;
  r public.respuestas;
begin
  if not public.is_gestor() then raise exception 'solo_gestores' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.eventos where id = p_evento and estado = 'programado' and oficial and borrado_en is null) then
    raise exception 'evento_cerrado' using errcode = 'P0001';
  end if;
  if p_respuesta is null or p_respuesta not in ('va', 'duda', 'no', 'sin_responder') then
    raise exception 'respuesta_no_valida' using errcode = 'P0001';
  end if;
  if v_motivo is not null and v_motivo not in ('lesion', 'trabajo', 'viaje', 'familia', 'otro') then
    raise exception 'motivo_no_valido' using errcode = 'P0001';
  end if;
  if v_detalle is not null and length(v_detalle) > 120 then raise exception 'detalle_largo' using errcode = 'P0001'; end if;
  if coalesce(array_length(p_personas, 1), 0) = 0 then raise exception 'sin_personas' using errcode = 'P0001'; end if;
  foreach v_p in array p_personas loop
    if not public._invitado(v_p, p_evento) then raise exception 'no_invitado' using errcode = 'P0001'; end if;
    select * into r from public.respuestas where evento_id = p_evento and person_id = v_p;
    v_antes := v_antes || jsonb_build_object(v_p, jsonb_build_object('respuesta', coalesce(r.respuesta, 'sin_responder'),
      'motivo', r.motivo, 'detalle', r.detalle, 'origen', r.origen, 'puesto_por', r.puesto_por,
      'puesto_por_nombre', r.puesto_por_nombre, 'fuente', r.fuente, 'existia', r.id is not null));
    perform public._escribir_respuesta(p_evento, v_p, p_respuesta, v_motivo, v_detalle, 'gestor', auth.uid(), v_nombre, null);
  end loop;
  insert into public.tablero_registro (por_user_id, por_nombre, evento_id, fecha, accion, personas, despues, motivo, antes)
  select auth.uid(), v_nombre, p_evento, e.fecha, 'respuesta', p_personas, p_respuesta, coalesce(v_motivo, v_detalle), v_antes
  from public.eventos e where e.id = p_evento
  returning id into v_id;
  return jsonb_build_object('registro', v_id, 'cambiados', array_length(p_personas, 1));
end $$;
comment on function public.gestor_responder(uuid, text[], text, text, text) is 'D159: un gestor cambia a mano la respuesta (va, duda, no, sin_responder) de uno o varios invitados; motivo opcional; queda puesta por el gestor y en tablero_registro.';

revoke execute on function public.gestor_responder(uuid, text[], text, text, text) from public, anon, authenticated;
grant execute on function public.gestor_responder(uuid, text[], text, text, text) to authenticated;
