-- Revierte 20261028210000_estado_tarea_avisos.sql: quita la funcion (no guarda datos).
drop function if exists public.estado_tarea_avisos();
delete from supabase_migrations.schema_migrations where version = '20261028210000';
notify pgrst, 'reload schema';
