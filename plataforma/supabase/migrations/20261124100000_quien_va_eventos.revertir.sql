-- Deshace 20261124100000_quien_va_eventos.sql (D198): quita quien_va(uuid[]). La web vuelve sola a v_quien_va.
drop function if exists public.quien_va(uuid[]);
delete from supabase_migrations.schema_migrations where version = '20261124100000';
