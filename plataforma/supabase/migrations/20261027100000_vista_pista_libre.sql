-- =============================================================================
-- Vista publica de eventos con la UBICACION LIBRE (D119) — fix/vista-pista-libre (26/10/2026, OK de Ivan; D138).
-- v_eventos_publicos no la conocia: a un entreno con la pista como ubicacion libre (el del 28/10/2026 en «Ciudad de
-- los Periodistas») le ponia «pista por confirmar» (o la pista de la serie), y asi salia en la portada, /club, el
-- calendario publico y el .ics.
-- SOLO ADITIVA (D111): las columnas de siempre quedan IGUALES, en el mismo orden y con los mismos valores; se anaden
-- dos al final con la ubicacion libre de los eventos SIN pista propia (la misma regla que pistaEfectiva: pista propia,
-- si no la ubicacion libre, si no la de la serie). La web (lib/eventos/fuente.ts) la usa cuando viene. Sigue sin
-- planes no oficiales, respuestas, motivos ni datos personales. Permisos: los de siempre (create or replace los
-- conserva). Reversion al lado: 20261027100000_vista_pista_libre.revertir.sql (db:migrar nunca la aplica).
-- =============================================================================
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

notify pgrst, 'reload schema';
