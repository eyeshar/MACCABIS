-- REVERSION de 20261007232000_pista_habitual_publica.sql (a mano, solo si hace falta).
drop view if exists public.v_pista_habitual_publica;
delete from supabase_migrations.schema_migrations where version = '20261007232000';
