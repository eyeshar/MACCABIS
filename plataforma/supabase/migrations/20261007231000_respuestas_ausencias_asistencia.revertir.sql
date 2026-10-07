-- REVERSION de 20261007231000_respuestas_ausencias_asistencia.sql (no la aplica `db:migrar`; se lanza a mano y SOLO
-- si hace falta). asistencia_motivos no se toca nunca: la copia se puede volver a crear desde ella.
drop table if exists public.asistencia_resumen;
drop table if exists public.importaciones;
drop table if exists public.diccionario_sporteasy;
drop table if exists public.ausencias_periodo;
drop table if exists public.respuestas;
delete from supabase_migrations.schema_migrations where version = '20261007231000';
