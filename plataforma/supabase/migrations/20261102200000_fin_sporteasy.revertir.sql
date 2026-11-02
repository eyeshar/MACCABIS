-- Reversión de 20261102200000_fin_sporteasy.sql (D172). NUNCA la aplica db:migrar: se ejecuta a mano.
-- Vuelve a crear la ESTRUCTURA (columnas, tabla, funciones y permisos tal y como estaban en el real el 02/11/2026). Los
-- DATOS de lo borrado (columnas sporteasy_*, diccionario_sporteasy) se recuperan del volcado previo
-- privado/backups/2026-11-02_pre-fin-sporteasy.sql (o el diccionario, de privado/sporteasy/diccionario_sporteasy_2026-10-31.json).
-- Las columnas vuelven con sus valores por defecto ('pendiente', false…), y el interruptor queda como esté en
-- respuestas_web_config.encendido (la migración no lo toca).

-- ---------------------------------------------------------------- 3. estructura
alter table public.eventos add column sporteasy_estado text not null default 'pendiente',
  add column sporteasy_cambio text, add column sporteasy_copiado_en timestamptz;
alter table public.eventos add constraint eventos_sporteasy_estado_check check (sporteasy_estado = any (array['pendiente', 'copiado']));
alter table public.convocatorias add column sporteasy_estado text not null default 'pendiente',
  add column sporteasy_en timestamptz, add column sporteasy_base jsonb;
alter table public.convocatorias add constraint convocatorias_sporteasy_estado_check check (sporteasy_estado = any (array['pendiente', 'al_dia']));
alter table public.respuestas add column sporteasy_descartado text;
alter table public.respuestas add constraint respuestas_sporteasy_descartado_check
  check (sporteasy_descartado is null or sporteasy_descartado = any (array['va', 'duda', 'no', 'sin_responder']));
alter table public.respuestas_web_config add column sporteasy_comprobado boolean not null default false;

create table public.diccionario_sporteasy (
  nombre_sporteasy text primary key,
  person_id        text not null,
  creado_por       text,
  creado_en        timestamptz not null default now()
);
alter table public.diccionario_sporteasy enable row level security;
revoke all on public.diccionario_sporteasy from anon, authenticated;
grant select, insert, update on public.diccionario_sporteasy to authenticated;
grant all on public.diccionario_sporteasy to service_role;
create policy gestores_leen on public.diccionario_sporteasy for select to authenticated using (public.is_gestor());
create policy gestores_insertan on public.diccionario_sporteasy for insert to authenticated with check (public.is_gestor());
create policy gestores_cambian on public.diccionario_sporteasy for update to authenticated using (public.is_gestor()) with check (public.is_gestor());

-- ---------------------------------------------------------------- 2. funciones del interruptor (en orden de dependencias)

CREATE OR REPLACE FUNCTION public._respuestas_web_encendido()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select coalesce((select encendido from public.respuestas_web_config where id = 1), false) $function$;
revoke execute on function public._respuestas_web_encendido() from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.respuestas_web_encendido()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select public._respuestas_web_encendido() $function$;
revoke execute on function public.respuestas_web_encendido() from public, anon, authenticated;
grant execute on function public.respuestas_web_encendido() to authenticated;

CREATE OR REPLACE FUNCTION public._exigir_encendido()
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public._respuestas_web_encendido() then raise exception 'respuestas_apagadas' using errcode = 'P0001'; end if;
end $function$;
revoke execute on function public._exigir_encendido() from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public._es_responsable()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.gestores g
    join public.jugadores j on lower(j.email) = lower(g.email)
    join public.respuestas_web_config c on c.id = 1 and c.responsable_person_id = j.person_id
    where g.user_id = auth.uid())
$function$;
revoke execute on function public._es_responsable() from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public._exigir_responsable()
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_nombre text;
begin
  if not public._es_responsable() then raise exception 'solo_responsable' using errcode = 'P0001'; end if;
  select nombre into v_nombre from public.gestores where user_id = auth.uid();
  return coalesce(v_nombre, 'gestor');
end $function$;
revoke execute on function public._exigir_responsable() from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public._jornadas_limpias_seguidas()
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r record;
  v_esperada int;
  n int := 0;
begin
  for r in select jornada, estado from public.jornadas_control where temporada = '2026-27' order by jornada desc loop
    if v_esperada is not null and r.jornada <> v_esperada then exit; end if;
    if r.estado <> 'limpia' then exit; end if;
    n := n + 1;
    v_esperada := r.jornada - 1;
  end loop;
  return n;
end $function$;
revoke execute on function public._jornadas_limpias_seguidas() from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.estado_activacion()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  c public.respuestas_web_config;
  v_plantilla int;
  v_entrados int;
  v_avisos int;
  v_faltan jsonb;
  v_pidio jsonb;
begin
  if not public.is_gestor() then raise exception 'solo_gestores' using errcode = 'P0001'; end if;
  select * into c from public.respuestas_web_config where id = 1;
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
  return jsonb_build_object(
    'encendido', c.encendido, 'encendido_desde', c.encendido_desde, 'sporteasy_comprobado', c.sporteasy_comprobado,
    'cambiado_en', c.cambiado_en, 'cambiado_por', c.cambiado_por_nombre,
    'jornadas_seguidas', public._jornadas_limpias_seguidas(), 'plantilla', v_plantilla, 'entrados', v_entrados,
    'minimo_entrados', least(c.minimo_entrados, v_plantilla), 'faltan_por_entrar', v_faltan, 'pidio_codigo', v_pidio, 'con_avisos', v_avisos,
    'puede_manejar', public._es_responsable(),
    'se_puede_encender', public._jornadas_limpias_seguidas() >= 3 and v_entrados >= least(c.minimo_entrados, v_plantilla)
                         and c.sporteasy_comprobado);
end $function$;
revoke execute on function public.estado_activacion() from public, anon, authenticated;
grant execute on function public.estado_activacion() to authenticated;

CREATE OR REPLACE FUNCTION public.cambiar_interruptor(p_encender boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_nombre text := public._exigir_responsable();
  v_estado jsonb;
begin
  v_estado := public.estado_activacion();
  if p_encender and not (v_estado->>'se_puede_encender')::boolean then
    raise exception 'condiciones_sin_cumplir' using errcode = 'P0001';
  end if;
  update public.respuestas_web_config set encendido = p_encender,
         encendido_desde = case when p_encender then now() else encendido_desde end,
         cambiado_en = now(), cambiado_por_nombre = v_nombre
   where id = 1;
  insert into public.respuestas_web_registro (por_user_id, por_nombre, que)
  values (auth.uid(), v_nombre, case when p_encender then 'encender' else 'apagar' end);
  return public.estado_activacion();
end $function$;
revoke execute on function public.cambiar_interruptor(p_encender boolean) from public, anon, authenticated;
grant execute on function public.cambiar_interruptor(p_encender boolean) to authenticated;

CREATE OR REPLACE FUNCTION public.marcar_sporteasy(p_comprobado boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_nombre text := public._exigir_responsable();
begin
  update public.respuestas_web_config set sporteasy_comprobado = p_comprobado where id = 1;
  insert into public.respuestas_web_registro (por_user_id, por_nombre, que)
  values (auth.uid(), v_nombre, case when p_comprobado then 'sporteasy_comprobado' else 'sporteasy_sin_comprobar' end);
  return public.estado_activacion();
end $function$;
revoke execute on function public.marcar_sporteasy(p_comprobado boolean) from public, anon, authenticated;
grant execute on function public.marcar_sporteasy(p_comprobado boolean) to authenticated;

CREATE OR REPLACE FUNCTION public.marcar_jornada(p_jornada integer, p_estado text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_nombre text := public._exigir_responsable();
begin
  if p_estado not in ('limpia', 'con_arreglo') then raise exception 'estado_no_valido' using errcode = 'P0001'; end if;
  insert into public.jornadas_control (temporada, jornada, estado, marcado_por_nombre)
  values ('2026-27', p_jornada, p_estado, v_nombre)
  on conflict (temporada, jornada) do update set estado = excluded.estado, marcado_por_nombre = excluded.marcado_por_nombre,
    marcado_en = now();
  insert into public.respuestas_web_registro (por_user_id, por_nombre, que, detalle)
  values (auth.uid(), v_nombre, case when p_estado = 'limpia' then 'jornada_limpia' else 'jornada_con_arreglo' end, 'J' || p_jornada);
  return public.estado_activacion();
end $function$;
revoke execute on function public.marcar_jornada(p_jornada integer, p_estado text) from public, anon, authenticated;
grant execute on function public.marcar_jornada(p_jornada integer, p_estado text) to authenticated;

CREATE OR REPLACE FUNCTION public.ultima_importacion_respuestas()
 RETURNS timestamp with time zone
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select max(i.en) from public.importaciones i
  where i.tipo = 'respuestas'
    and ((public._mi_person_id() is not null
          and exists (select 1 from public.jugadores me where me.person_id = public._mi_person_id() and me.activo))
         or public.is_gestor())
$function$;
revoke execute on function public.ultima_importacion_respuestas() from public, anon, authenticated;
grant execute on function public.ultima_importacion_respuestas() to authenticated;

-- ---------------------------------------------------------------- 1. funciones como estaban

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
    if new.sporteasy_estado is not distinct from old.sporteasy_estado
       and (new.tipo, new.equipo, new.titulo, new.jornada, new.rival, new.es_local, new.fecha, new.inicio, new.fin,
            new.quedada, new.pista_id, new.numero_pista, new.notas, new.estado)
           is distinct from
           (old.tipo, old.equipo, old.titulo, old.jornada, old.rival, old.es_local, old.fecha, old.inicio, old.fin,
            old.quedada, old.pista_id, old.numero_pista, old.notas, old.estado) then
      new.sporteasy_estado := 'pendiente';
      new.sporteasy_cambio := coalesce(new.sporteasy_cambio, 'Cambio sin describir');
    end if;
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
  if not public._respuestas_web_encendido() then return null; end if;
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
      and (not e.oficial or public._respuestas_web_encendido())
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
  perform public._exigir_encendido();
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
  perform public._exigir_encendido();
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
  perform public._exigir_encendido();
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
  perform public._exigir_encendido();
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
  perform public._exigir_encendido();
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
  perform public._exigir_encendido();
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
  perform public._exigir_encendido();
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
  insert into public.eventos (clave, temporada, tipo, equipo, titulo, fecha, oficial, creado_por, origen, sporteasy_estado, sporteasy_cambio)
  values ('plan-' || gen_random_uuid(), '2026-27', p ->> 'tipo', coalesce(p ->> 'equipo', 'ambos'), btrim(p ->> 'titulo'),
          (p ->> 'fecha')::date, false, v_person, 'manual', 'pendiente', 'Plan no oficial: no se copia a SportEasy')
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
  update public.eventos set oficial = true, rival = coalesce(rival, rival_texto), sporteasy_estado = 'pendiente',
         sporteasy_cambio = 'Evento nuevo: crearlo en SportEasy' where id = p_id;
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
    whatsapp_estado = case when estado = 'aprobada' and v_cambia then 'pendiente' else whatsapp_estado end,
    sporteasy_estado = case when estado = 'aprobada' and v_cambia then 'pendiente' else sporteasy_estado end
  where id = c.id
  returning * into c;
  insert into public.convocatoria_cambios (convocatoria_id, por_user_id, por_nombre, accion, person_id, equipo, motivo, nota, detalle)
  values (c.id, auth.uid(), v_nombre, p_accion, p_person, p_equipo, p_motivo, nullif(btrim(coalesce(p_nota, '')), ''),
          coalesce(p_detalle, '{}'::jsonb));
  return jsonb_build_object('id', c.id, 'estado', c.estado, 'whatsapp', c.whatsapp_estado, 'sporteasy', c.sporteasy_estado);
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
    whatsapp_estado = case when whatsapp_base is not distinct from equipos then whatsapp_estado else 'pendiente' end,
    sporteasy_estado = case when sporteasy_base is not distinct from equipos then sporteasy_estado else 'pendiente' end
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
  if p_que not in ('whatsapp', 'sporteasy', 'aviso_enviado', 'aviso_en_espera') then
    raise exception 'salida_no_valida' using errcode = 'P0001';
  end if;
  update public.convocatorias set
    whatsapp_estado = case when p_que = 'whatsapp' then 'al_dia' else whatsapp_estado end,
    whatsapp_en = case when p_que = 'whatsapp' then now() else whatsapp_en end,
    whatsapp_base = case when p_que = 'whatsapp' then equipos else whatsapp_base end,
    sporteasy_estado = case when p_que = 'sporteasy' then 'al_dia' else sporteasy_estado end,
    sporteasy_en = case when p_que = 'sporteasy' then now() else sporteasy_en end,
    sporteasy_base = case when p_que = 'sporteasy' then equipos else sporteasy_base end,
    aviso_estado = case when p_que = 'aviso_enviado' then 'enviado' when p_que = 'aviso_en_espera' then 'en_espera' else aviso_estado end,
    aviso_en = case when p_que in ('aviso_enviado', 'aviso_en_espera') then now() else aviso_en end,
    aviso_base = case when p_que = 'aviso_enviado' then equipos else aviso_base end
  where fecha = p_fecha and estado = 'aprobada'
  returning * into c;
  if c.id is null then raise exception 'sin_aprobar' using errcode = 'P0001'; end if;
  insert into public.convocatoria_cambios (convocatoria_id, por_user_id, por_nombre, accion, detalle)
  values (c.id, auth.uid(), v_nombre, case when p_que like 'aviso%' then 'aviso' else p_que end, jsonb_build_object('que', p_que));
  return jsonb_build_object('whatsapp', c.whatsapp_estado, 'sporteasy', c.sporteasy_estado, 'aviso', c.aviso_estado);
end $function$;

delete from supabase_migrations.schema_migrations where version = '20261102200000';
notify pgrst, 'reload schema';
