-- Quien responde (D105). Una sola definicion en la base, la misma que usa la web (quienResponde en lib/respuestas/dominio.ts):
--   - responden los jugadores ACTIVOS menos el entrenador (rol 'entrenador': Carlos Barreiro no responde a nada);
--   - quien tiene rol 'solo_entreno' solo es invitado a entrenos y "entre nosotros", nunca a partidos;
--   - entreno / "entre nosotros": quien entrena o tiene ficha; partido de MdA o MdL: su ficha; de los dos: cualquiera.
-- Ademas, "Responder por el" (de un evento y de un domingo) exige el interruptor encendido: con el interruptor apagado
-- (fase puente) las respuestas llegan solo de Importar.

create or replace function public._invitado(p_person text, p_evento uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.jugadores j join public.eventos e on e.id = p_evento
    where j.person_id = p_person and j.activo and j.rol <> 'entrenador'
      and case
            when e.tipo in ('entreno', 'interno') then (j.entrena or j.ficha_mda or j.ficha_mdl)
            when j.rol = 'solo_entreno' then false
            when e.equipo = 'MdA' then j.ficha_mda
            when e.equipo = 'MdL' then j.ficha_mdl
            else (j.ficha_mda or j.ficha_mdl)
          end)
$$;

create or replace function public.responder_por(p_evento uuid, p_person text, p_respuesta text, p_motivo text default null,
                                                p_detalle text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_nombre text;
  v_antes text;
begin
  if not public.is_gestor() then raise exception 'solo_gestores' using errcode = 'P0001'; end if;
  perform public._exigir_encendido();
  if not public._invitado(p_person, p_evento) then raise exception 'no_invitado' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.eventos where id = p_evento and estado = 'programado') then
    raise exception 'evento_cerrado' using errcode = 'P0001';
  end if;
  perform public._validar_respuesta(p_respuesta, p_motivo);
  select nombre into v_nombre from public.gestores where user_id = auth.uid();
  v_antes := public._escribir_respuesta(p_evento, p_person, p_respuesta,
               case when p_respuesta = 'no' then p_motivo end, case when p_respuesta = 'no' then p_detalle end,
               'gestor', auth.uid(), v_nombre, null);
  return jsonb_build_object('antes', v_antes, 'despues', p_respuesta);
end $$;

create or replace function public.responder_domingo_por(p_fecha date, p_person text, p_opcion text, p_evento uuid default null,
                                                        p_motivo text default null, p_detalle text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_nombre text;
begin
  if not public.is_gestor() then raise exception 'solo_gestores' using errcode = 'P0001'; end if;
  perform public._exigir_encendido();
  select nombre into v_nombre from public.gestores where user_id = auth.uid();
  return public._responder_domingo_de(p_person, p_fecha, p_opcion, p_evento, p_motivo, p_detalle, 'gestor', v_nombre);
end $$;

-- Condicion 2 del interruptor: "N/27" (los 27 que responden), minimo configurable (20) y lista de quien falta.
create or replace function public.estado_activacion()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  c public.respuestas_web_config;
  v_plantilla int;
  v_entrados int;
  v_avisos int;
  v_faltan jsonb;
begin
  if not public.is_gestor() then raise exception 'solo_gestores' using errcode = 'P0001'; end if;
  select * into c from public.respuestas_web_config where id = 1;
  select count(*)::int,
         count(*) filter (where exists (select 1 from auth.users u where lower(u.email) = lower(j.email)))::int,
         count(*) filter (where exists (select 1 from public.suscripciones_avisos s where s.person_id = j.person_id and s.activa))::int,
         coalesce(jsonb_agg(j.nombre_visible order by j.nombre_visible)
                    filter (where not exists (select 1 from auth.users u where lower(u.email) = lower(j.email))), '[]'::jsonb)
    into v_plantilla, v_entrados, v_avisos, v_faltan
  from public.jugadores j where j.activo and j.rol <> 'entrenador';
  return jsonb_build_object(
    'encendido', c.encendido, 'encendido_desde', c.encendido_desde, 'sporteasy_comprobado', c.sporteasy_comprobado,
    'cambiado_en', c.cambiado_en, 'cambiado_por', c.cambiado_por_nombre,
    'jornadas_seguidas', public._jornadas_limpias_seguidas(), 'plantilla', v_plantilla, 'entrados', v_entrados,
    'minimo_entrados', least(c.minimo_entrados, v_plantilla), 'faltan_por_entrar', v_faltan, 'con_avisos', v_avisos,
    'puede_manejar', public._es_responsable(),
    'se_puede_encender', public._jornadas_limpias_seguidas() >= 3 and v_entrados >= least(c.minimo_entrados, v_plantilla)
                         and c.sporteasy_comprobado);
end $$;
