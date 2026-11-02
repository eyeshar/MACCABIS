-- Reversión de 20261102100000_asistencia_eventos.sql (D170). NUNCA la aplica db:migrar: se ejecuta a mano.
-- Se pierde el detalle por evento (se vuelve a generar con `npm run db:asistencia-eventos`; antes, la copia de
-- privado/backups/). asistencia_motivos no se toca.
drop table if exists public.asistencia_eventos;
delete from supabase_migrations.schema_migrations where version = '20261102100000';
