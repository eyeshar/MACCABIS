-- Revierte 20261028220000_ultima_pasada_avisos.sql: quita la funcion (no guarda datos).
drop function if exists public.ultima_pasada_avisos();
delete from supabase_migrations.schema_migrations where version = '20261028220000';
notify pgrst, 'reload schema';
