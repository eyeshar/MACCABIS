-- =============================================================================
-- Pagina del domingo del jugador (D128) — SOLO ADITIVA (D111): dos funciones nuevas, nada mas.
--
--  - convocados_del_domingo(fecha): con la convocatoria de ese domingo APROBADA, el NOMBRE VISIBLE de los convocados de
--    cada equipo, en orden alfabetico ({"MdA": [...], "MdL": [...]}); sin aprobar, null. Lo mismo que ya se manda por
--    WhatsApp. Nada mas: ni niveles, ni posiciones, ni motivos, ni quien no va, ni propuestas ni borradores.
--    Solo para quien tiene ficha activa en la plantilla (o es gestor).
--  - ultima_importacion_respuestas(): cuando fue la ultima «Importar -> Respuestas» de SportEasy (solo la hora; ni quien
--    ni que se importo). Para «Según SportEasy … Actualizado el …» en la fase puente.
-- Horas: Europe/Madrid. Se deshace con 20261025100000_convocados_domingo.revertir.sql.
-- =============================================================================

create function public.convocados_del_domingo(p_fecha date)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select case when c.id is null then null else (
    select coalesce(jsonb_object_agg(k, (
             select coalesce(jsonb_agg(j.nombre_visible order by j.nombre_visible), '[]'::jsonb)
             from jsonb_array_elements(c.equipos -> k) x
             join public.jugadores j on j.person_id = x ->> 'person_id')), '{}'::jsonb)
    from jsonb_object_keys(c.equipos) k
    where k in ('MdA', 'MdL')) end
  from (select 1) uno
  left join public.convocatorias c on c.fecha = p_fecha and c.estado = 'aprobada'
  where (public._mi_person_id() is not null
         and exists (select 1 from public.jugadores me where me.person_id = public._mi_person_id() and me.activo))
     or public.is_gestor()
$$;

create function public.ultima_importacion_respuestas()
returns timestamptz language sql stable security definer set search_path = ''
as $$
  select max(i.en) from public.importaciones i
  where i.tipo = 'respuestas'
    and ((public._mi_person_id() is not null
          and exists (select 1 from public.jugadores me where me.person_id = public._mi_person_id() and me.activo))
         or public.is_gestor())
$$;

revoke execute on function public.convocados_del_domingo(date), public.ultima_importacion_respuestas() from public, anon, authenticated;
grant execute on function public.convocados_del_domingo(date), public.ultima_importacion_respuestas() to authenticated;
