-- Reversión de 20261103210000_seguridad_base.sql (revisión de seguridad, 03/11/2026). NUNCA la aplica db:migrar: se
-- ejecuta a mano. Vuelve la vista pública CON «notas» (tal cual 20261029120000), quita los 4 índices, la política vuelve a
-- auth.uid() / is_gestor() por fila y authenticated vuelve a leer toda la tabla de suscripciones. No toca datos.

drop view public.v_eventos_publicos;
create view public.v_eventos_publicos as
select
  e.clave, e.temporada, e.tipo, e.equipo, e.titulo, e.jornada, e.rival, e.es_local,
  e.fecha, e.inicio, e.fin, e.quedada, e.notas, e.estado,
  case when p.id is not null then p.nombre when ps.estado = 'habitual' then ps.nombre else null end as pista_nombre,
  case when p.id is not null then p.nombre_corto when ps.estado = 'habitual' then ps.nombre_corto else null end as pista_nombre_corto,
  case when p.id is not null then e.numero_pista else null end as numero_pista,
  (p.id is null and (e.tipo <> 'entreno' or ps.id is null or ps.estado <> 'habitual')) as pista_por_confirmar,
  case when p.id is null and e.tipo = 'entreno' and ps.id is not null and ps.estado = 'en_obras'
       then split_part(ps.nombre, ' (', 1) || ' en obras' else null end as pista_motivo,
  case when p.id is null then nullif(btrim(e.ubicacion_nombre), '') end as ubicacion_nombre,
  case when p.id is null and nullif(btrim(e.ubicacion_nombre), '') is not null then e.ubicacion_direccion end as ubicacion_direccion
from public.eventos e
left join public.pistas p  on p.id = e.pista_id
left join public.pistas ps on e.pista_id is null and e.tipo = 'entreno' and ps.es_de_serie and ps.uso = 'entreno'
                     and e.fecha >= coalesce(ps.habitual_desde, e.fecha)
where e.oficial and e.borrado_en is null;
revoke all on public.v_eventos_publicos from anon, authenticated, public;
grant select on public.v_eventos_publicos to anon, authenticated;

drop index if exists public.entreno_defecto_quitado_person_idx;
drop index if exists public.eventos_pista_idx;
drop index if exists public.respuestas_ausencia_idx;
drop index if exists public.respuestas_domingo_solo_evento_idx;

alter policy cada_cual_lee_las_suyas on public.suscripciones_avisos
  using ((user_id = auth.uid()) or public.is_gestor());

revoke select (id, user_id, person_id, navegador, creado_en, ultimo_envio_ok, activa, desactivada_en, motivo_baja)
  on public.suscripciones_avisos from authenticated;
grant select on public.suscripciones_avisos to authenticated;

delete from supabase_migrations.schema_migrations where version = '20261103210000';
notify pgrst, 'reload schema';
