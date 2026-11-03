-- =============================================================================
-- Estado de asistencia en un solo sitio (D177): «Quién va» del jugador = Gestión.
--
-- El 03/11/2026 el entreno del 04/11 daba en la pantalla del jugador 12 / 1 / 7 / 4 (Julio y Luis «sin responder») y
-- en Gestión 12 / 1 / 9 / 2 (Julio y Luis «no va (por defecto)»). La regla (D146 + D150) vivía en la web
-- (`respuestaEfectiva`, lib/disponibilidad/porDefecto.ts), pero `_quien_va` (la vista v_quien_va del jugador y del
-- asistente) solo aplicaba las ausencias: el jugador no puede leer las marcas (D39) y la vista no las miraba.
--
-- _estado_efectivo(evento, persona, respuesta) es la MISMA regla, en este orden:
--   1. respuesta explícita (va, duda, no)            -> esa
--   2. partido y «nunca a partidos», sin responder    -> fuera (ni invitado ni pendiente)
--   3. ausencia por periodo que cubre el día          -> no  (por = 'ausencia')
--   4. entreno y «no suele entrenar» (sin quitar)     -> no  (por = 'defecto'); nunca en partidos
--   5. si no                                          -> sin_responder
-- Una prueba (pruebas:asistencia-efectiva) la compara caso a caso con `respuestaEfectiva`.
-- Interna: nadie la ejecuta por la API (la llama _quien_va, security definer). _quien_va sigue dando solo evento,
-- nombre y estado: ni la marca ni el motivo salen de la base.
-- Solo cambia el cuerpo de _quien_va (mismas columnas y permisos). Reversión: 20261104100000_estado_efectivo.revertir.sql.
-- =============================================================================

create function public._estado_efectivo(p_evento uuid, p_person text, p_respuesta text)
returns table (respuesta text, por text, fuera boolean)
language sql stable set search_path = ''
as $$
  select
    case when r.r <> 'sin_responder' then r.r
         when partido and coalesce(p.nunca_partidos, false) then 'sin_responder'
         when public._ausencia_que_cubre(p_person, e.fecha) is not null then 'no'
         when entreno and coalesce(p.no_suele_entrenar, false) and q.person_id is null then 'no'
         else 'sin_responder' end,
    case when r.r <> 'sin_responder' then null
         when partido and coalesce(p.nunca_partidos, false) then null
         when public._ausencia_que_cubre(p_person, e.fecha) is not null then 'ausencia'
         when entreno and coalesce(p.no_suele_entrenar, false) and q.person_id is null then 'defecto'
         else null end,
    r.r = 'sin_responder' and partido and coalesce(p.nunca_partidos, false)
  from public.eventos e
  cross join lateral (select coalesce(p_respuesta, 'sin_responder') as r) r
  cross join lateral (select e.oficial is not false and e.tipo in ('liga', 'amistoso', 'torneo') as partido,
                             e.oficial is not false and e.tipo = 'entreno' as entreno) t
  left join public.jugadores_privado p on p.person_id = p_person
  left join public.entreno_defecto_quitado q on q.evento_id = e.id and q.person_id = p_person
  where e.id = p_evento
$$;
comment on function public._estado_efectivo(uuid, text, text) is 'D177: estado efectivo de una persona en un evento (respuesta > nunca a partidos > ausencia > no suele entrenar > sin responder). Interna.';
revoke execute on function public._estado_efectivo(uuid, text, text) from public, anon, authenticated;

create or replace function public._quien_va()
returns table (evento_id uuid, nombre text, estado text)
language sql stable security definer set search_path = ''
as $$
  select e.id, j.nombre_visible, ef.respuesta
  from public.eventos e
  join public.jugadores j on public._invitado(j.person_id, e.id)
  left join public.respuestas r on r.evento_id = e.id and r.person_id = j.person_id
  cross join lateral public._estado_efectivo(e.id, j.person_id, r.respuesta) ef
  where public._invitado(public._mi_person_id(), e.id)
    and not ef.fuera
$$;
