-- =============================================================================
-- Dudas sin retroactividad (fix/cerrar-dudas, 28/10/2026; D141). SOLO ADITIVA (D111): una columna nueva con valor por
-- defecto y el cuerpo de UNA funcion (cerrar_dudas), que sigue siendo solo del rol de servicio.
--   - respuestas_web_config.dudas_desde: el momento en que D141 se activa (aqui: la hora a la que se aplica esta
--     migracion). Se guarda en la base, no en el codigo, para que sea el mismo para todos los despliegues.
--   - cerrar_dudas solo cierra dudas cuyo LIMITE es posterior a dudas_desde. Una duda cuyo limite ya habia pasado cuando
--     se activo (p. ej. la del entreno del 28/10, limite el 27/10 a las 20:00) no se cierra sin el aviso de las 12:00 ni
--     el margen de un dia que tiene el resto: se queda como esta y su dueño la cambia cuando quiera.
-- Reversion al lado: 20261028200000_dudas_activacion.revertir.sql (db:migrar nunca la aplica).
-- =============================================================================

alter table public.respuestas_web_config add column dudas_desde timestamptz not null default now();

create or replace function public.cerrar_dudas(p_ahora timestamptz default now())
returns table (r_evento uuid, r_person text, r_limite timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  v_desde timestamptz := (select dudas_desde from public.respuestas_web_config where id = 1);
begin
  for r in
    select rs.evento_id as ev, rs.person_id as pe, public._limite_dudas(rs.evento_id) as lim
    from public.respuestas rs join public.eventos e on e.id = rs.evento_id
    where rs.respuesta = 'duda' and e.estado = 'programado' and e.borrado_en is null
      and (not e.oficial or public._respuestas_web_encendido())
      and public._inicio_evento(e.id) > p_ahora
      and public._limite_dudas(e.id) <= p_ahora
      and public._limite_dudas(e.id) > v_desde
    order by 1, 2
  loop
    perform public._escribir_respuesta(r.ev, r.pe, 'no', 'no_confirmo', null, 'sistema', null, 'Sistema', null);
    r_evento := r.ev; r_person := r.pe; r_limite := r.lim;
    return next;
  end loop;
end $$;

revoke execute on function public.cerrar_dudas(timestamptz) from public, anon, authenticated;
grant execute on function public.cerrar_dudas(timestamptz) to service_role;

notify pgrst, 'reload schema';
