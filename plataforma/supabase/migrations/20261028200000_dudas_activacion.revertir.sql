-- Revierte 20261028200000_dudas_activacion.sql: cerrar_dudas vuelve a cerrar toda duda con el limite pasado (cuerpo de
-- 20261028100000) y se quita respuestas_web_config.dudas_desde. No toca datos de respuestas.
create or replace function public.cerrar_dudas(p_ahora timestamptz default now())
returns table (r_evento uuid, r_person text, r_limite timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select rs.evento_id as ev, rs.person_id as pe, public._limite_dudas(rs.evento_id) as lim
    from public.respuestas rs join public.eventos e on e.id = rs.evento_id
    where rs.respuesta = 'duda' and e.estado = 'programado' and e.borrado_en is null
      and (not e.oficial or public._respuestas_web_encendido())
      and public._inicio_evento(e.id) > p_ahora
      and public._limite_dudas(e.id) <= p_ahora
    order by 1, 2
  loop
    perform public._escribir_respuesta(r.ev, r.pe, 'no', 'no_confirmo', null, 'sistema', null, 'Sistema', null);
    r_evento := r.ev; r_person := r.pe; r_limite := r.lim;
    return next;
  end loop;
end $$;

revoke execute on function public.cerrar_dudas(timestamptz) from public, anon, authenticated;
grant execute on function public.cerrar_dudas(timestamptz) to service_role;

alter table public.respuestas_web_config drop column dudas_desde;

notify pgrst, 'reload schema';
