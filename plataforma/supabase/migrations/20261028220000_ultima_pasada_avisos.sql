-- =============================================================================
-- Salud de la tarea de avisos (fix/salud-avisos, 28/10/2026). SOLO ADITIVA (D111): una funcion nueva, de solo lectura.
--   ultima_pasada_avisos(): la hora de la ultima respuesta 200 que ha recibido pg_net (la tarea de avisos es su unica
--   llamada), o null si no hay ninguna (pg_net conserva ~6 h) o no existe el esquema `net` (pila local). SOLO el rol de
--   servicio: la usa /api/avisos/salud, que un workflow de GitHub Actions consulta cada hora.
-- Reversion al lado: 20261028220000_ultima_pasada_avisos.revertir.sql (db:migrar nunca la aplica).
-- =============================================================================

create function public.ultima_pasada_avisos()
returns timestamptz
language plpgsql stable security definer set search_path = ''
as $$
declare
  v timestamptz;
begin
  execute 'select max(created) from net._http_response where status_code = 200' into v;
  return v;
exception when undefined_table or invalid_schema_name then
  return null;
end $$;

revoke execute on function public.ultima_pasada_avisos() from public, anon, authenticated;
grant execute on function public.ultima_pasada_avisos() to service_role;

notify pgrst, 'reload schema';
