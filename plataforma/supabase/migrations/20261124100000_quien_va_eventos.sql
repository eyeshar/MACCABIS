-- =====================================================================================================================
-- D198 · «Quién va» de unos eventos concretos, sin calcular la temporada entera (Iván, 24/11/2026; Code,
-- `fix/domingo-tactil`).
-- SOLO ADITIVA (D94, D111): una función nueva. No toca tablas, ni la vista v_quien_va, ni _quien_va(), ni permisos de
-- nada que ya exista. Si no está aplicada, la web lee v_quien_va como antes (lib/respuestas/jugador.ts).
-- Reversión: 20261124100000_quien_va_eventos.revertir.sql.
--
-- Por qué: v_quien_va es `select * from _quien_va()`, y _quien_va es security definer, así que Postgres no la «abre»
-- dentro de la consulta: el `evento_id in (...)` de la web se aplica DESPUÉS de calcular todos los eventos × todos los
-- jugadores (_invitado, _estado_efectivo y _ausencia_que_cubre en cada par). En el real (pg_stat_statements, 24/11):
-- 838 llamadas, media 706 ms y máximo 3,7 s, frente a < 60 ms del resto de consultas de la página del domingo.
--
--   quien_va(p_eventos uuid[])   lo mismo que v_quien_va (evento, nombre y estado efectivo; nunca motivo ni detalle),
--                                pero SOLO de esos eventos y de los que esté invitado quien pregunta. Para autenticados.
-- =====================================================================================================================

create function public.quien_va(p_eventos uuid[])
returns table (evento_id uuid, nombre text, estado text)
language sql stable security definer set search_path = ''
as $$
  -- Primero los eventos pedidos a los que está invitado quien pregunta (materialized: que el filtro vaya antes del
  -- cruce con los jugadores); después, como _quien_va (D177).
  with mios as materialized (
    select e.id from public.eventos e
    where e.id = any(p_eventos) and public._invitado(public._mi_person_id(), e.id)
  )
  select e.id, j.nombre_visible, ef.respuesta
  from mios m
  join public.eventos e on e.id = m.id
  join public.jugadores j on public._invitado(j.person_id, e.id)
  left join public.respuestas r on r.evento_id = e.id and r.person_id = j.person_id
  cross join lateral public._estado_efectivo(e.id, j.person_id, r.respuesta) ef
  where not ef.fuera
$$;
comment on function public.quien_va(uuid[]) is 'D198: v_quien_va solo de los eventos pedidos (nombre y estado efectivo; nada de motivos). Para autenticados.';
revoke execute on function public.quien_va(uuid[]) from public, anon, authenticated;
grant execute on function public.quien_va(uuid[]) to authenticated;
