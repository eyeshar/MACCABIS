-- =============================================================================
-- La tarea de avisos deja de leer jugadores_privado (D146, ajuste del 28/10/2026, pedido de Ivan).
--
-- jugadores_privado tiene niveles, posiciones y notas (D39). La tarea de avisos (service_role) solo necesita saber quien
-- «no suele entrenar» y quien es «nunca a partidos». Esta migracion:
--  - crea marcas_disponibilidad(): devuelve SOLO person_id, no_suele_entrenar y nunca_partidos de quien tiene alguna
--    marca. security definer; la ejecuta SOLO service_role (ni anon, ni authenticated, ni public);
--  - quita a service_role TODOS sus permisos sobre jugadores_privado (los tenia por los permisos por defecto de Supabase,
--    desde antes de D146). Es el unico cambio no aditivo y lo pide Ivan expresamente (NORMAS §10).
-- Es una funcion y no una vista a proposito: una vista dependeria de jugadores_privado y su DROP (el revertir de la
-- convocatoria, 20261023100000) dejaria de funcionar.
-- Reversion al lado: 20261028233000_marcas_disponibilidad_servicio.revertir.sql (db:migrar nunca la aplica).
-- =============================================================================

create function public.marcas_disponibilidad()
returns table (person_id text, no_suele_entrenar boolean, nunca_partidos boolean)
language sql stable security definer set search_path = ''
as $$
  select p.person_id, p.no_suele_entrenar, p.nunca_partidos
  from public.jugadores_privado p
  where p.no_suele_entrenar or p.nunca_partidos
$$;
comment on function public.marcas_disponibilidad() is 'D146: solo las dos marcas de disponibilidad por defecto, para la tarea de avisos (service_role). Sin niveles.';

revoke execute on function public.marcas_disponibilidad() from public, anon, authenticated;

do $$
begin
  revoke all on public.jugadores_privado from service_role;
  grant execute on function public.marcas_disponibilidad() to service_role;
exception when undefined_object then
  null;
end $$;
