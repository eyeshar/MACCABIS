-- =============================================================================
-- Pase de lista (D50, D189, D192): tras un entreno o un partido de liga, un gestor apunta quién fue (a tiempo o con
-- retraso), quién faltó con excusa o sin ella, quién estaba lesionado y, en los partidos, quién no entró en la
-- convocatoria. Se guarda en asistencia_eventos (D170) con origen = 'plataforma' y evento_ref = el id del evento.
--
-- SOLO ADITIVA (D94, D111): una columna nueva (quién pasó lista) y una función nueva. No cambia ni borra nada que exista.
-- Reversión al lado: 20261110120000_pase_de_lista.revertir.sql (db:migrar nunca la aplica).
--
--  - pase_de_lista(evento, filas): solo gestores. Solo entrenos y partidos de liga oficiales, programados y YA TERMINADOS
--    (la hora de fin; sin ella, la de inicio más dos horas). Cada fila: {person_id, estado, motivo?}, con estado
--    a_tiempo | retraso | con_excusa | sin_excusa | lesion | no_convocado (este, solo en partidos); «a tiempo» y «retraso»
--    se guardan como 'fue' y el retraso en el motivo ('retraso'). estado null = quitar su fila del pase. Solo invitados al
--    evento (_invitado). Nunca pisa una fila de SportEasy, y no pasa lista de un evento cuyo día ya está en la asistencia
--    de SportEasy (hasta el 23/10/2026, D161): así no se cuenta dos veces.
--  - «Asistencia y motivos» (D170) suma en vivo las respuestas de la plataforma desde el 24/10; con pase de lista, la fila
--    del pase sustituye a la de la respuesta para esa persona y ese evento (lib/eventos/asistenciaPantalla.ts, unirAsistencia).
-- =============================================================================

alter table public.asistencia_eventos add column pasado_por_nombre text;
comment on column public.asistencia_eventos.pasado_por_nombre is 'D192: quién pasó lista (solo en las filas de la plataforma).';

create function public.pase_de_lista(p_evento uuid, p_filas jsonb)
returns int language plpgsql security definer set search_path = ''
as $$
declare
  e public.eventos;
  v_nombre_gestor text := public._nombre_gestor();
  v_fin timestamptz;
  v_ambito text;
  v_temporada text;
  v_n int := 0;
  f jsonb;
  v_p text;
  v_estado text;
  v_motivo text;
  v_nombre text;
begin
  if not public.is_gestor() then raise exception 'solo_gestores' using errcode = 'P0001'; end if;
  select * into e from public.eventos where id = p_evento and borrado_en is null;
  if e.id is null or not e.oficial or e.estado <> 'programado' or e.tipo not in ('entreno', 'liga') then
    raise exception 'evento_sin_pase' using errcode = 'P0001';
  end if;
  v_fin := (e.fecha + coalesce(e.fin, e.inicio + interval '2 hours', time '23:59')) at time zone 'Europe/Madrid';
  if e.fin is not null and e.inicio is not null and e.fin < e.inicio then v_fin := v_fin + interval '1 day'; end if;
  if now() < v_fin then raise exception 'evento_sin_terminar' using errcode = 'P0001'; end if;
  v_ambito := case when e.tipo = 'entreno' then 'entrenos' else 'partidos' end;
  if exists (select 1 from public.asistencia_eventos a
             where a.origen = 'sporteasy' and a.fecha = e.fecha and a.ambito = v_ambito
               and (v_ambito = 'entrenos' or a.equipo = e.equipo)) then
    raise exception 'evento_de_sporteasy' using errcode = 'P0001';
  end if;
  v_temporada := case when extract(month from e.fecha) >= 8
    then extract(year from e.fecha)::int || '-' || lpad(((extract(year from e.fecha)::int + 1) % 100)::text, 2, '0')
    else (extract(year from e.fecha)::int - 1) || '-' || lpad((extract(year from e.fecha)::int % 100)::text, 2, '0') end;
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' then raise exception 'filas_no_validas' using errcode = 'P0001'; end if;

  for f in select x from jsonb_array_elements(p_filas) x loop
    v_p := f ->> 'person_id';
    v_estado := f ->> 'estado';
    if v_p is null or not public._invitado(v_p, p_evento) then raise exception 'no_invitado' using errcode = 'P0001'; end if;
    if v_estado is null then
      delete from public.asistencia_eventos where person_id = v_p and evento_ref = p_evento::text and origen = 'plataforma';
      continue;
    end if;
    if v_estado not in ('a_tiempo', 'retraso', 'con_excusa', 'sin_excusa', 'lesion', 'no_convocado')
       or (v_estado = 'no_convocado' and v_ambito <> 'partidos') then
      raise exception 'estado_no_valido' using errcode = 'P0001';
    end if;
    v_motivo := case when v_estado = 'retraso' then 'retraso'
                     when v_estado in ('a_tiempo', 'no_convocado') then null
                     else left(nullif(btrim(coalesce(f ->> 'motivo', '')), ''), 60) end;
    select j.nombre_visible into v_nombre from public.jugadores j where j.person_id = v_p;
    insert into public.asistencia_eventos (person_id, evento_ref, nombre, temporada, fecha, ambito, equipo, titulo, estado, motivo,
                                           origen, cargado_en, pasado_por_nombre)
    values (v_p, p_evento::text, coalesce(v_nombre, v_p), v_temporada, e.fecha, v_ambito,
            case when v_ambito = 'partidos' then e.equipo end, e.titulo,
            case when v_estado in ('a_tiempo', 'retraso') then 'fue' else v_estado end, v_motivo,
            'plataforma', now(), v_nombre_gestor)
    on conflict (person_id, evento_ref) do update set
      nombre = excluded.nombre, estado = excluded.estado, motivo = excluded.motivo,
      cargado_en = excluded.cargado_en, pasado_por_nombre = excluded.pasado_por_nombre
    where public.asistencia_eventos.origen = 'plataforma';
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
comment on function public.pase_de_lista(uuid, jsonb) is 'D192: pase de lista de un entreno o partido ya terminado, en asistencia_eventos (origen plataforma). Solo gestores.';
revoke execute on function public.pase_de_lista(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.pase_de_lista(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
