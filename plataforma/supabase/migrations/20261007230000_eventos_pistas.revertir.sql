-- REVERSION de 20261007230000_eventos_pistas.sql (no la aplica `db:migrar`; se lanza a mano y SOLO si hace falta).
-- Borra lo que esa migracion creo. Si ya se aplico la siguiente (20261007231000), revertir ANTES esa.
drop view if exists public.v_descansos_publicos;
drop view if exists public.v_eventos_publicos;
drop table if exists public.descansos;
drop table if exists public.eventos;
drop table if exists public.pistas;
drop function if exists public._eventos_antes_de_escribir();
delete from supabase_migrations.schema_migrations where version = '20261007230000';
