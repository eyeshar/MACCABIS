-- =============================================================================
-- Revisión de seguridad de la base (Iván, 03/11/2026). Con OK EXPRESO de Iván a lo que no es aditivo (D111):
--   1. v_eventos_publicos SIN «notas» (NO ADITIVO: se borra y se vuelve a crear la vista). Las notas las escribe un gestor
--      a mano y la vista la lee cualquiera con la clave anónima (portada, /calendario.ics, API). Con sesión se siguen viendo
--      (v_mi_agenda, v_mis_eventos). Las notas siguen en `eventos`: no se borra ningún dato. El resto de columnas, igual y
--      en el mismo orden (copiada de 20261029120000, menos `notas`), con los mismos permisos: solo SELECT a anon y
--      authenticated.
--   2. Índices de las 4 claves foráneas sin índice (aviso del asesor de rendimiento). Aditivo.
--   3. Política cada_cual_lee_las_suyas de suscripciones_avisos con (select auth.uid()) y (select is_gestor()): se evalúan
--      una vez por consulta, no por fila. Mismo resultado (NO ADITIVO en sentido estricto: cambia una política).
--   4. suscripciones_avisos: authenticated deja de poder leer endpoint, p256dh y auth (las claves push de cada móvil). Las
--      pantallas solo leen person_id/user_id y activa; quien envía es el servidor con la clave de servicio.
-- Reversión al lado: 20261103210000_seguridad_base.revertir.sql.
-- =============================================================================

-- ---------------------------------------------------------------- 1. vista pública sin notas
drop view public.v_eventos_publicos;
create view public.v_eventos_publicos as
select
  e.clave, e.temporada, e.tipo, e.equipo, e.titulo, e.jornada, e.rival, e.es_local,
  e.fecha, e.inicio, e.fin, e.quedada, e.estado,
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

-- ---------------------------------------------------------------- 2. índices de las claves foráneas
create index entreno_defecto_quitado_person_idx on public.entreno_defecto_quitado (person_id);
create index eventos_pista_idx on public.eventos (pista_id);
create index respuestas_ausencia_idx on public.respuestas (ausencia_id);
create index respuestas_domingo_solo_evento_idx on public.respuestas_domingo (solo_evento);

-- ---------------------------------------------------------------- 3. política: una evaluación por consulta
alter policy cada_cual_lee_las_suyas on public.suscripciones_avisos
  using ((user_id = (select auth.uid())) or (select public.is_gestor()));

-- ---------------------------------------------------------------- 4. sin claves push para authenticated
revoke select on public.suscripciones_avisos from authenticated;
grant select (id, user_id, person_id, navegador, creado_en, ultimo_envio_ok, activa, desactivada_en, motivo_baja)
  on public.suscripciones_avisos to authenticated;

notify pgrst, 'reload schema';
