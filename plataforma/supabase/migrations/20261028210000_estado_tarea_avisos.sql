-- =============================================================================
-- Alarma de la tarea de avisos (fix/cerrar-dudas, 28/10/2026). SOLO ADITIVA (D111): una funcion nueva, de solo lectura.
--   estado_tarea_avisos(): las ultimas respuestas HTTP que ha recibido pg_net (la tarea de avisos es su unica llamada),
--   para que Gestion avise si la tarea falla (p. ej. 401 por un secreto que no coincide). Solo gestores. pg_net conserva
--   las respuestas unas 6 horas. Si el esquema `net` no existe (pila local), devuelve cero filas.
-- Reversion al lado: 20261028210000_estado_tarea_avisos.revertir.sql (db:migrar nunca la aplica).
-- =============================================================================

create function public.estado_tarea_avisos()
returns table (codigo int, creado timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_gestor() then
    raise exception 'solo gestores' using errcode = '42501';
  end if;
  return query execute 'select status_code, created from net._http_response order by created desc limit 4';
exception when undefined_table or invalid_schema_name then
  return;
end $$;

revoke execute on function public.estado_tarea_avisos() from public, anon;
grant execute on function public.estado_tarea_avisos() to authenticated;

notify pgrst, 'reload schema';
