-- Revierte 20261104130000_pasadas_avisos_hora.sql: quita la funcion (no guarda datos).
drop function if exists public.pasadas_avisos_hora();
delete from supabase_migrations.schema_migrations where version = '20261104130000';
notify pgrst, 'reload schema';
