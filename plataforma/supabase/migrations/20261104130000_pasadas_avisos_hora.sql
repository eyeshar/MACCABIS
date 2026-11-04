-- =============================================================================
-- Alarma de la tarea de avisos por errores sueltos (fix/tarea-avisos-500, 04/11/2026). SOLO ADITIVA (D111): una funcion
-- nueva, de solo lectura.
--   pasadas_avisos_hora(): las respuestas que ha recibido pg_net (la tarea de avisos y su reintento son sus unicas
--   llamadas) en la ultima hora: codigo (null = sin respuesta) y hora. /api/avisos/salud da «fallando» si hay 2 o mas con
--   error, aunque entre medias haya pasadas buenas (el 04/11 fallaron 7 de 17 y la alarma de 40 minutos no salto).
--   Cero filas si no existe el esquema `net` (pila local). SOLO el rol de servicio.
-- Reversion al lado: 20261104130000_pasadas_avisos_hora.revertir.sql (db:migrar nunca la aplica).
-- =============================================================================

create function public.pasadas_avisos_hora()
returns table (codigo int, creado timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  return query execute
    'select status_code, created from net._http_response where created > now() - interval ''1 hour'' order by created desc limit 50';
exception when undefined_table or invalid_schema_name then
  return;
end $$;

revoke execute on function public.pasadas_avisos_hora() from public, anon, authenticated;
grant execute on function public.pasadas_avisos_hora() to service_role;

notify pgrst, 'reload schema';
