-- Revierte 20261029120000_pista_desde.sql: las funciones y la vista vuelven a su versión anterior (copiadas tal cual),
-- solo_con_ficha_en a la de 20261029100000 y se quitan las dos columnas. db:migrar nunca la aplica.

create or replace function public.solo_con_ficha_en(e public.eventos)
returns text language sql stable set search_path = ''
as $$
  select case when e.tipo = 'entreno' and e.oficial then (
    select coalesce(p.nombre_corto, p.nombre) from public.pistas p
    where p.solo_con_ficha
      and (p.id = e.pista_id
           or (e.pista_id is null and nullif(e.ubicacion_nombre, '') is null and p.es_de_serie and p.uso = 'entreno' and p.estado = 'habitual'))
    limit 1) end
$$;

create or replace function public._mis_eventos()
returns table (id uuid, clave text, temporada text, tipo text, equipo text, titulo text, jornada int, rival text,
               es_local boolean, fecha date, inicio time, fin time, quedada time, notas text, estado text,
               cambio_visible jsonb, cambio_visible_en timestamptz, pista_nombre text, pista_nombre_corto text,
               pista_direccion text, numero_pista int, pista_por_confirmar boolean, pista_motivo text)
language sql stable security definer set search_path = ''
as $$
  select
    e.id, e.clave, e.temporada, e.tipo, e.equipo, e.titulo, e.jornada, e.rival, e.es_local, e.fecha, e.inicio, e.fin,
    e.quedada, e.notas, e.estado, e.cambio_visible, e.cambio_visible_en,
    case when p.id is not null then p.nombre when ps.estado = 'habitual' then ps.nombre else null end,
    case when p.id is not null then p.nombre_corto when ps.estado = 'habitual' then ps.nombre_corto else null end,
    case when p.id is not null then p.direccion when ps.estado = 'habitual' then ps.direccion else null end,
    case when p.id is not null then e.numero_pista else null end,
    (p.id is null and (e.tipo <> 'entreno' or ps.id is null or ps.estado <> 'habitual')),
    case when p.id is null and e.tipo = 'entreno' and ps.id is not null and ps.estado = 'en_obras'
         then split_part(ps.nombre, ' (', 1) || ' en obras' else null end
  from public.eventos e
  left join public.pistas p  on p.id = e.pista_id
  left join public.pistas ps on e.pista_id is null and e.tipo = 'entreno' and ps.es_de_serie and ps.uso = 'entreno'
  where public._invitado(public._mi_person_id(), e.id)
$$;

create or replace function public._mi_agenda()
returns table (id uuid, clave text, temporada text, tipo text, equipo text, titulo text, jornada int, rival text,
               rival_texto text, es_local boolean, fecha date, inicio time, fin time, quedada time, notas text, estado text,
               cambio_visible jsonb, cambio_visible_en timestamptz, oficial boolean, creado_por text, organizador text,
               es_mio boolean, plazas int, recordar_un_dia_antes boolean, pista_nombre text, pista_nombre_corto text,
               pista_direccion text, numero_pista int, pista_por_confirmar boolean, pista_motivo text,
               lugar_nombre text, lugar_direccion text, lugar_lat double precision, lugar_lng double precision,
               lugar_enlace text, secuencia int, actualizado_en timestamptz)
language sql stable security definer set search_path = ''
as $$
  select
    e.id, e.clave, e.temporada, e.tipo, e.equipo, e.titulo, e.jornada, e.rival, e.rival_texto, e.es_local, e.fecha,
    e.inicio, e.fin, e.quedada, e.notas, e.estado, e.cambio_visible, e.cambio_visible_en, e.oficial, e.creado_por,
    (select o.nombre_visible from public.jugadores o where o.person_id = e.creado_por),
    (e.creado_por is not null and e.creado_por = public._mi_person_id()), e.plazas, e.recordar_un_dia_antes,
    pe.nombre, pe.nombre_corto, pe.direccion, case when p.id is not null then e.numero_pista end,
    (pe.id is null and e.ubicacion_nombre is null and e.ubicacion_lat is null and e.ubicacion_enlace is null),
    case when p.id is null and e.tipo = 'entreno' and ps.id is not null and ps.estado = 'en_obras'
         then split_part(ps.nombre, ' (', 1) || ' en obras' end,
    coalesce(pe.nombre_corto, pe.nombre, e.ubicacion_nombre), coalesce(pe.direccion, e.ubicacion_direccion),
    coalesce(pe.lat, e.ubicacion_lat), coalesce(pe.lng, e.ubicacion_lng), case when pe.id is null then e.ubicacion_enlace end,
    e.secuencia, e.actualizado_en
  from public.eventos e
  left join public.pistas p  on p.id = e.pista_id
  left join public.pistas ps on e.pista_id is null and e.tipo = 'entreno' and ps.es_de_serie and ps.uso = 'entreno'
  left join lateral (select x.* from public.pistas x
                     where x.id = coalesce(p.id, case when ps.estado = 'habitual' then ps.id end)) pe on true
  where e.borrado_en is null and public._invitado(public._mi_person_id(), e.id)
$$;

create or replace function public.calendario_personal(p_token text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  t public.calendario_tokens;
  j public.jugadores;
  v_desde date := (now() at time zone 'Europe/Madrid')::date - 30;
begin
  if length(coalesce(p_token, '')) < 40 or length(p_token) > 200 then return null; end if;
  select * into t from public.calendario_tokens where hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  if t.person_id is null then return null; end if;
  select * into j from public.jugadores where person_id = t.person_id;
  if j.person_id is null or not j.activo then return null; end if;
  if t.ventana_inicio is null or t.ventana_inicio < now() - interval '1 hour' then
    update public.calendario_tokens set ventana_inicio = now(), peticiones = 1, ultima_lectura = now() where person_id = t.person_id;
  elsif t.peticiones >= 120 then
    return jsonb_build_object('limite', true);
  else
    update public.calendario_tokens set peticiones = peticiones + 1, ultima_lectura = now() where person_id = t.person_id;
  end if;
  return jsonb_build_object(
    'person_id', j.person_id, 'nombre', j.nombre_visible,
    'eventos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'tipo', e.tipo, 'equipo', e.equipo, 'oficial', e.oficial, 'titulo', e.titulo, 'rival', e.rival,
        'rival_texto', e.rival_texto, 'es_local', e.es_local, 'jornada', e.jornada, 'fecha', e.fecha, 'inicio', e.inicio,
        'fin', e.fin, 'quedada', e.quedada,
        'estado', case when e.borrado_en is not null then 'cancelado' else e.estado end,
        'lugar_nombre', coalesce(pe.nombre, e.ubicacion_nombre), 'lugar_direccion', coalesce(pe.direccion, e.ubicacion_direccion),
        'lugar_lat', coalesce(pe.lat, e.ubicacion_lat), 'lugar_lng', coalesce(pe.lng, e.ubicacion_lng),
        'lugar_enlace', case when pe.id is null then e.ubicacion_enlace end,
        'numero_pista', case when p.id is not null then e.numero_pista end,
        'secuencia', e.secuencia, 'actualizado_en', greatest(e.actualizado_en, r.cambiado_en, c.cambiado_en),
        'respuesta', coalesce(r.respuesta, 'sin_responder'),
        'convocado', (e.tipo = 'liga' and c.estado = 'aprobada'
                      and exists (select 1 from jsonb_array_elements(coalesce(c.equipos -> e.equipo, '[]'::jsonb)) x where x ->> 'person_id' = j.person_id)),
        'convocatoria_aprobada', (e.tipo = 'liga' and c.estado = 'aprobada'))
        order by e.fecha, e.inicio)
      from public.eventos e
      left join public.pistas p  on p.id = e.pista_id
      left join public.pistas ps on e.pista_id is null and e.tipo = 'entreno' and ps.es_de_serie and ps.uso = 'entreno'
      left join lateral (select x.* from public.pistas x where x.id = coalesce(p.id, case when ps.estado = 'habitual' then ps.id end)) pe on true
      left join public.respuestas r on r.evento_id = e.id and r.person_id = j.person_id
      left join public.convocatorias c on c.fecha = e.fecha and e.tipo = 'liga'
      where e.temporada = '2026-27' and e.fecha >= v_desde and public._invitado(j.person_id, e.id)), '[]'::jsonb));
end $$;

create or replace view public.v_eventos_publicos as
select
  e.clave, e.temporada, e.tipo, e.equipo, e.titulo, e.jornada, e.rival, e.es_local,
  e.fecha, e.inicio, e.fin, e.quedada, e.notas, e.estado,
  case when p.id is not null then p.nombre when ps.estado = 'habitual' then ps.nombre else null end as pista_nombre,
  case when p.id is not null then p.nombre_corto when ps.estado = 'habitual' then ps.nombre_corto else null end as pista_nombre_corto,
  case when p.id is not null then e.numero_pista else null end as numero_pista,
  (p.id is null and (e.tipo <> 'entreno' or ps.id is null or ps.estado <> 'habitual')) as pista_por_confirmar,
  case when p.id is null and e.tipo = 'entreno' and ps.id is not null and ps.estado = 'en_obras'
       then split_part(ps.nombre, ' (', 1) || ' en obras' else null end as pista_motivo,
  -- nuevas: la ubicacion libre, solo si el evento no tiene pista propia (si la tiene, manda la pista)
  case when p.id is null then nullif(btrim(e.ubicacion_nombre), '') end as ubicacion_nombre,
  case when p.id is null and nullif(btrim(e.ubicacion_nombre), '') is not null then e.ubicacion_direccion end as ubicacion_direccion
from public.eventos e
left join public.pistas p  on p.id = e.pista_id
left join public.pistas ps on e.pista_id is null and e.tipo = 'entreno' and ps.es_de_serie and ps.uso = 'entreno'
where e.oficial and e.borrado_en is null;

alter table public.pistas drop column solo_con_ficha_desde;
alter table public.pistas drop column habitual_desde;
delete from supabase_migrations.schema_migrations where version = '20261029120000';
notify pgrst, 'reload schema';
