-- =============================================================================
-- Fin de SportEasy: limpieza total (D172; Iván, 02/11/2026; BACKLOG «Pendiente de Code» 19 y 20). NO ES ADITIVA: la
-- autorizó Iván, con las protecciones de D111 (volcado previo en privado/backups/, permisos y cuentas antes y después).
-- Reversión al lado: 20261102200000_fin_sporteasy.revertir.sql (vuelve a crear la estructura; los datos, del volcado).
--
-- 1. Interruptor «respuestas en la web» (Code 20): las respuestas en la web quedan SIEMPRE encendidas. Ninguna función
--    lo mira ya: responder, responder_por, responder_domingo(_por), las ausencias, el disparador de eventos nuevos o con
--    otro día y cerrar_dudas. Se borran las funciones del interruptor (encender/apagar, condiciones, jornadas limpias,
--    «SportEasy comprobado») y estado_activacion() queda solo con los contadores del recuadro de avisos y accesos.
--    Las tablas respuestas_web_config (dudas_desde sigue en uso), respuestas_web_registro y jornadas_control se quedan:
--    son el registro histórico de la activación.
-- 2. Lo huérfano de SportEasy (Code 19, D153 ampliada): columnas sporteasy_* de eventos y convocatorias,
--    respuestas.sporteasy_descartado, respuestas_web_config.sporteasy_comprobado y la tabla diccionario_sporteasy (la
--    copia está en privado/sporteasy/diccionario_sporteasy_2026-10-31.json; la asistencia histórica ya lee de ahí).
--    Dejan de rellenarlas el disparador _eventos_antes_de_escribir, convocatoria_guardar/aprobar/marcar, crear_plan y
--    hacer_oficial. Se borra también ultima_importacion_respuestas() (la hora de la última «Importar - Respuestas» de
--    SportEasy; nada la usa desde D153).
-- NO se toca lo histórico: origen/fuente = 'sporteasy' de respuestas y ausencias, asistencia_eventos,
-- asistencia_motivos, ni las acciones 'sporteasy' antiguas de convocatoria_cambios.
-- Las funciones se reescriben con CREATE OR REPLACE (misma firma: conservan sus permisos).
-- =============================================================================

-- ---------------------------------------------------------------- 1. funciones que dejan de mirar el interruptor o SportEasy

CREATE OR REPLACE FUNCTION public._eventos_antes_de_escribir()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.quedada is null and new.inicio is not null then
    new.quedada := new.inicio - interval '20 minutes';
  end if;
  if tg_op = 'UPDATE' then
    new.actualizado_en := now();
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public._eventos_tras_escribir()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'UPDATE' then
    if new.fecha is not distinct from old.fecha then return null; end if;
    update public.respuestas set respuesta = 'sin_responder', motivo = null, detalle = null, ausencia_id = null,
           cambiado_en = now()
     where evento_id = new.id and respuesta <> 'sin_responder';
  end if;
  perform public._aplicar_ausencias_evento(new.id);
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.cerrar_dudas(p_ahora timestamp with time zone DEFAULT now())
 RETURNS TABLE(r_evento uuid, r_person text, r_limite timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r record;
  v_desde timestamptz := (select dudas_desde from public.respuestas_web_config where id = 1);
begin
  for r in
    select rs.evento_id as ev, rs.person_id as pe, public._limite_dudas(rs.evento_id) as lim
    from public.respuestas rs join public.eventos e on e.id = rs.evento_id
    where rs.respuesta = 'duda' and e.estado = 'programado' and e.borrado_en is null
      and public._inicio_evento(e.id) > p_ahora
      and public._limite_dudas(e.id) <= p_ahora
      and public._limite_dudas(e.id) > v_desde
    order by 1, 2
  loop
    perform public._escribir_respuesta(r.ev, r.pe, 'no', 'no_confirmo', null, 'sistema', null, 'Sistema', null);
    r_evento := r.ev; r_person := r.pe; r_limite := r.lim;
    return next;
  end loop;
end $function$;

CREATE OR REPLACE FUNCTION public.responder(p_evento uuid, p_respuesta text, p_motivo text DEFAULT NULL::text, p_detalle text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_person text := public._exigir_jugador();
  v_antes text;
  v_alerta boolean;
begin
  if not public._invitado(v_person, p_evento) then raise exception 'no_invitado' using errcode = 'P0001'; end if;
  if not public._evento_abierto(p_evento) then raise exception 'evento_cerrado' using errcode = 'P0001'; end if;
  perform public._validar_respuesta(p_respuesta, p_motivo);
  v_antes := public._escribir_respuesta(p_evento, v_person, p_respuesta,
               case when p_respuesta = 'no' then p_motivo end, case when p_respuesta = 'no' then p_detalle end,
               'jugador', auth.uid(), null, null);
  v_alerta := public._tras_cambio_jugador(p_evento, v_person, v_antes, p_respuesta);
  return jsonb_build_object('antes', v_antes, 'despues', p_respuesta, 'alerta', v_alerta);
end $function$;

CREATE OR REPLACE FUNCTION public.responder_por(p_evento uuid, p_person text, p_respuesta text, p_motivo text DEFAULT NULL::text, p_detalle text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_nombre text;
  v_antes text;
begin
  if not public.is_gestor() then raise exception 'solo_gestores' using errcode = 'P0001'; end if;
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
end $function$;

CREATE OR REPLACE FUNCTION public.responder_domingo(p_fecha date, p_opcion text, p_evento uuid DEFAULT NULL::uuid, p_motivo text DEFAULT NULL::text, p_detalle text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_person text := public._exigir_jugador();
begin
  return public._responder_domingo_de(v_person, p_fecha, p_opcion, p_evento, p_motivo, p_detalle, 'jugador', null);
end $function$;

CREATE OR REPLACE FUNCTION public.responder_domingo_por(p_fecha date, p_person text, p_opcion text, p_evento uuid DEFAULT NULL::uuid, p_motivo text DEFAULT NULL::text, p_detalle text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_nombre text;
begin
  if not public.is_gestor() then raise exception 'solo_gestores' using errcode = 'P0001'; end if;
  select nombre into v_nombre from public.gestores where user_id = auth.uid();
  return public._responder_domingo_de(p_person, p_fecha, p_opcion, p_evento, p_motivo, p_detalle, 'gestor', v_nombre);
end $function$;

CREATE OR REPLACE FUNCTION public.previsualizar_ausencia(p_desde date, p_hasta date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_person text := public._exigir_jugador();
begin
  if p_desde is null or (p_hasta is not null and p_hasta < p_desde) then raise exception 'fechas_no_validas' using errcode = 'P0001'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', e.id, 'tipo', e.tipo, 'equipo', e.equipo, 'titulo', e.titulo, 'rival', e.rival,
                                        'es_local', e.es_local, 'fecha', e.fecha, 'inicio', e.inicio,
                                        'respuesta', coalesce(r.respuesta, 'sin_responder')) order by e.fecha, e.inicio)
    from public._eventos_del_periodo(v_person, p_desde, p_hasta) e
    left join public.respuestas r on r.evento_id = e.id and r.person_id = v_person), '[]'::jsonb);
end $function$;

CREATE OR REPLACE FUNCTION public.guardar_ausencia(p_id uuid, p_desde date, p_hasta date, p_motivo text, p_detalle text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_person text := public._exigir_jugador();
  v_id uuid;
  e record;
  v_antes text;
  n int := 0;
begin
  if p_desde is null or (p_hasta is not null and p_hasta < p_desde) then raise exception 'fechas_no_validas' using errcode = 'P0001'; end if;
  perform public._validar_respuesta('no', p_motivo);
  if p_id is not null then
    update public.ausencias_periodo set desde = p_desde, hasta = p_hasta, motivo = p_motivo,
           detalle = nullif(btrim(coalesce(p_detalle, '')), ''), cambiado_en = now()
     where id = p_id and person_id = v_person and borrada_en is null
     returning id into v_id;
    if v_id is null then raise exception 'ausencia_no_encontrada' using errcode = 'P0001'; end if;
    perform public._soltar_ausencia(v_id);
  else
    -- La misma franja borrada antes se reutiliza (una por persona, desde y hasta).
    update public.ausencias_periodo set borrada_en = null, motivo = p_motivo, detalle = nullif(btrim(coalesce(p_detalle, '')), ''),
           origen = 'jugador', fuente = 'web', creado_por = auth.uid(), creado_por_nombre = null, cambiado_en = now()
     where person_id = v_person and desde = p_desde and hasta is not distinct from p_hasta
     returning id into v_id;
    if v_id is null then
      insert into public.ausencias_periodo (person_id, desde, hasta, motivo, detalle, fuente, origen, creado_por)
      values (v_person, p_desde, p_hasta, p_motivo, nullif(btrim(coalesce(p_detalle, '')), ''), 'web', 'jugador', auth.uid())
      returning id into v_id;
    end if;
  end if;
  for e in select * from public._eventos_del_periodo(v_person, p_desde, p_hasta) loop
    v_antes := public._escribir_respuesta(e.id, v_person, 'no', p_motivo, p_detalle, 'jugador', auth.uid(), null, v_id);
    perform public._tras_cambio_jugador(e.id, v_person, v_antes, 'no');
    n := n + 1;
  end loop;
  return jsonb_build_object('id', v_id, 'eventos', n);
end $function$;

CREATE OR REPLACE FUNCTION public.cerrar_ausencia(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_person text := public._exigir_jugador();
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  a public.ausencias_periodo;
begin
  select * into a from public.ausencias_periodo where id = p_id and person_id = v_person and borrada_en is null;
  if a.id is null then raise exception 'ausencia_no_encontrada' using errcode = 'P0001'; end if;
  if a.desde <= v_hoy - 1 then
    update public.ausencias_periodo set hasta = v_hoy - 1, cambiado_en = now() where id = p_id;
  else
    update public.ausencias_periodo set borrada_en = now() where id = p_id;
  end if;
  return jsonb_build_object('eventos', public._soltar_ausencia(p_id));
end $function$;

CREATE OR REPLACE FUNCTION public.borrar_ausencia(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_person text := public._exigir_jugador();
  v_id uuid;
begin
  update public.ausencias_periodo set borrada_en = now() where id = p_id and person_id = v_person and borrada_en is null
  returning id into v_id;
  if v_id is null then raise exception 'ausencia_no_encontrada' using errcode = 'P0001'; end if;
  return jsonb_build_object('eventos', public._soltar_ausencia(v_id));
end $function$;

CREATE OR REPLACE FUNCTION public.crear_plan(p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_person text := public._exigir_jugador();
  v_id uuid;
begin
  perform public._plan_valido(p, false);
  if (p ->> 'fecha')::date < (now() at time zone 'Europe/Madrid')::date then raise exception 'fecha_pasada' using errcode = 'P0001'; end if;
  insert into public.eventos (clave, temporada, tipo, equipo, titulo, fecha, oficial, creado_por, origen)
  values ('plan-' || gen_random_uuid(), '2026-27', p ->> 'tipo', coalesce(p ->> 'equipo', 'ambos'), btrim(p ->> 'titulo'),
          (p ->> 'fecha')::date, false, v_person, 'manual')
  returning id into v_id;
  perform public._plan_aplicar(v_id, p);
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.hacer_oficial(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.eventos := public._plan_de(p_id);
begin
  if not public.is_gestor() then raise exception 'solo_gestores' using errcode = 'P0001'; end if;
  if e.id is null then raise exception 'plan_no_encontrado' using errcode = 'P0001'; end if;
  update public.eventos set oficial = true, rival = coalesce(rival, rival_texto) where id = p_id;
  perform public._avisar_organizador(e, public._nombre_gestor() || ' ha hecho oficial tu plan «' || e.titulo || '».');
  return jsonb_build_object('id', p_id, 'organizador', e.creado_por, 'avisado', e.creado_por is distinct from public._mi_person_id());
end $function$;

CREATE OR REPLACE FUNCTION public.convocatoria_guardar(p_fecha date, p_jornada integer, p_equipos jsonb, p_dificultad jsonb, p_accion text, p_person text DEFAULT NULL::text, p_equipo text DEFAULT NULL::text, p_motivo text DEFAULT NULL::text, p_nota text DEFAULT NULL::text, p_detalle jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  c public.convocatorias;
  v_nombre text := public._nombre_gestor();
  v_cambia boolean;
begin
  if not public.is_gestor() then raise exception 'solo_gestores' using errcode = 'P0001'; end if;
  if p_equipos is not null and (jsonb_typeof(p_equipos) <> 'object'
       or exists (select 1 from jsonb_object_keys(p_equipos) k where k not in ('MdA', 'MdL'))) then
    raise exception 'equipos_no_validos' using errcode = 'P0001';
  end if;
  insert into public.convocatorias (fecha, jornada, creado_por_nombre, cambiado_por_nombre)
  values (p_fecha, p_jornada, v_nombre, v_nombre)
  on conflict (fecha) do nothing;
  select * into c from public.convocatorias where fecha = p_fecha for update;
  v_cambia := p_equipos is not null and p_equipos is distinct from c.equipos;
  update public.convocatorias set
    jornada = coalesce(p_jornada, jornada),
    equipos = coalesce(p_equipos, equipos),
    dificultad = coalesce(p_dificultad, dificultad),
    origen = case when p_accion in ('propuesta', 'blanco') then p_accion else origen end,
    cambiado_en = now(), cambiado_por_nombre = v_nombre,
    whatsapp_estado = case when estado = 'aprobada' and v_cambia then 'pendiente' else whatsapp_estado end
  where id = c.id
  returning * into c;
  insert into public.convocatoria_cambios (convocatoria_id, por_user_id, por_nombre, accion, person_id, equipo, motivo, nota, detalle)
  values (c.id, auth.uid(), v_nombre, p_accion, p_person, p_equipo, p_motivo, nullif(btrim(coalesce(p_nota, '')), ''),
          coalesce(p_detalle, '{}'::jsonb));
  return jsonb_build_object('id', c.id, 'estado', c.estado, 'whatsapp', c.whatsapp_estado);
end $function$;

CREATE OR REPLACE FUNCTION public.convocatoria_aprobar(p_fecha date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  c public.convocatorias;
  v_nombre text := public._nombre_gestor();
begin
  if not public.is_gestor() then raise exception 'solo_gestores' using errcode = 'P0001'; end if;
  update public.convocatorias set
    estado = 'aprobada', aprobada_en = now(), aprobada_por_nombre = v_nombre,
    whatsapp_estado = case when whatsapp_base is not distinct from equipos then whatsapp_estado else 'pendiente' end
  where fecha = p_fecha and origen is not null
  returning * into c;
  if c.id is null then raise exception 'sin_convocatoria' using errcode = 'P0001'; end if;
  insert into public.convocatoria_cambios (convocatoria_id, por_user_id, por_nombre, accion)
  values (c.id, auth.uid(), v_nombre, 'aprobar');
  return jsonb_build_object('id', c.id, 'estado', c.estado);
end $function$;

CREATE OR REPLACE FUNCTION public.convocatoria_marcar(p_fecha date, p_que text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  c public.convocatorias;
  v_nombre text := public._nombre_gestor();
begin
  if not public.is_gestor() then raise exception 'solo_gestores' using errcode = 'P0001'; end if;
  if p_que not in ('whatsapp', 'aviso_enviado', 'aviso_en_espera') then
    raise exception 'salida_no_valida' using errcode = 'P0001';
  end if;
  update public.convocatorias set
    whatsapp_estado = case when p_que = 'whatsapp' then 'al_dia' else whatsapp_estado end,
    whatsapp_en = case when p_que = 'whatsapp' then now() else whatsapp_en end,
    whatsapp_base = case when p_que = 'whatsapp' then equipos else whatsapp_base end,
    aviso_estado = case when p_que = 'aviso_enviado' then 'enviado' when p_que = 'aviso_en_espera' then 'en_espera' else aviso_estado end,
    aviso_en = case when p_que in ('aviso_enviado', 'aviso_en_espera') then now() else aviso_en end,
    aviso_base = case when p_que = 'aviso_enviado' then equipos else aviso_base end
  where fecha = p_fecha and estado = 'aprobada'
  returning * into c;
  if c.id is null then raise exception 'sin_aprobar' using errcode = 'P0001'; end if;
  insert into public.convocatoria_cambios (convocatoria_id, por_user_id, por_nombre, accion, detalle)
  values (c.id, auth.uid(), v_nombre, case when p_que like 'aviso%' then 'aviso' else p_que end, jsonb_build_object('que', p_que));
  return jsonb_build_object('whatsapp', c.whatsapp_estado, 'aviso', c.aviso_estado);
end $function$;

-- Los contadores del recuadro «Avisos y accesos» del Panel (D156, D157), sin nada del interruptor.
CREATE OR REPLACE FUNCTION public.estado_activacion()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_plantilla int;
  v_entrados int;
  v_avisos int;
  v_faltan jsonb;
  v_pidio jsonb;
begin
  if not public.is_gestor() then raise exception 'solo_gestores' using errcode = 'P0001'; end if;
  select count(*)::int,
         count(*) filter (where exists (select 1 from auth.users u where lower(u.email) = lower(j.email) and u.last_sign_in_at is not null))::int,
         count(*) filter (where exists (select 1 from public.suscripciones_avisos s where s.person_id = j.person_id and s.activa))::int,
         coalesce(jsonb_agg(j.nombre_visible order by j.nombre_visible)
                    filter (where not exists (select 1 from auth.users u where lower(u.email) = lower(j.email) and u.last_sign_in_at is not null)), '[]'::jsonb),
         coalesce(jsonb_agg(j.nombre_visible order by j.nombre_visible)
                    filter (where exists (select 1 from auth.users u where lower(u.email) = lower(j.email))
                              and not exists (select 1 from auth.users u where lower(u.email) = lower(j.email) and u.last_sign_in_at is not null)), '[]'::jsonb)
    into v_plantilla, v_entrados, v_avisos, v_faltan, v_pidio
  from public.jugadores j where j.activo and j.rol <> 'entrenador';
  return jsonb_build_object('plantilla', v_plantilla, 'entrados', v_entrados, 'faltan_por_entrar', v_faltan,
                            'pidio_codigo', v_pidio, 'con_avisos', v_avisos);
end $function$;

-- ---------------------------------------------------------------- 2. funciones del interruptor, fuera
drop function public.cambiar_interruptor(p_encender boolean);
drop function public.marcar_sporteasy(p_comprobado boolean);
drop function public.marcar_jornada(p_jornada integer, p_estado text);
drop function public.respuestas_web_encendido();
drop function public._exigir_encendido();
drop function public._respuestas_web_encendido();
drop function public._exigir_responsable();
drop function public._es_responsable();
drop function public._jornadas_limpias_seguidas();
drop function public.ultima_importacion_respuestas();

-- ---------------------------------------------------------------- 3. lo huérfano de SportEasy
alter table public.eventos drop column sporteasy_estado, drop column sporteasy_cambio, drop column sporteasy_copiado_en;
alter table public.convocatorias drop column sporteasy_estado, drop column sporteasy_en, drop column sporteasy_base;
alter table public.respuestas drop column sporteasy_descartado;
alter table public.respuestas_web_config drop column sporteasy_comprobado;
drop table public.diccionario_sporteasy;

notify pgrst, 'reload schema';
