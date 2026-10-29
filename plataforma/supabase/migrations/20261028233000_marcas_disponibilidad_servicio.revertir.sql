-- Reversion de 20261028233000_marcas_disponibilidad_servicio.sql (D146). NUNCA la aplica db:migrar: se ejecuta a mano.
-- Quita la funcion y devuelve a service_role los permisos que tenia sobre jugadores_privado antes (en el Supabase real,
-- todos: arwdDxtm, los de por defecto; comprobado el 28/10/2026 antes de aplicarla).
drop function if exists public.marcas_disponibilidad();
do $$
begin
  grant all on public.jugadores_privado to service_role;
exception when undefined_object then
  null;
end $$;
delete from supabase_migrations.schema_migrations where version = '20261028233000';
