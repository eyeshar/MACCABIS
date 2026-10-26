-- Revertir 20261027100000_vista_pista_libre: repone v_eventos_publicos tal cual estaba en 20261024200000_inicio_y_planes
-- (sin las dos columnas de la ubicacion libre). Una vista no puede perder columnas con create or replace: se borra y se
-- vuelve a crear con los mismos permisos de 20261007230000_eventos_pistas (nada depende de ella en la base).
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
       then split_part(ps.nombre, ' (', 1) || ' en obras' else null end as pista_motivo
from public.eventos e
left join public.pistas p  on p.id = e.pista_id
left join public.pistas ps on e.pista_id is null and e.tipo = 'entreno' and ps.es_de_serie and ps.uso = 'entreno'
where e.oficial and e.borrado_en is null;

revoke all on public.v_eventos_publicos from anon, authenticated, public;
grant select on public.v_eventos_publicos to anon, authenticated;

notify pgrst, 'reload schema';
delete from supabase_migrations.schema_migrations where version = '20261027100000';
