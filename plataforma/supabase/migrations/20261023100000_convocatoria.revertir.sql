-- Reversion de 20261023100000_convocatoria.sql (D94/D107). NUNCA la aplica db:migrar: se ejecuta a mano.
-- Se pierden los datos privados por jugador, las convocatorias y sus cambios (antes, un volcado: npm run db:backup).
-- No toca nada anterior.
drop function if exists public.mi_convocatoria();
drop function if exists public.convocatoria_marcar(date, text);
drop function if exists public.convocatoria_aprobar(date);
drop function if exists public.convocatoria_guardar(date, int, jsonb, jsonb, text, text, text, text, text, jsonb);
drop function if exists public._nombre_gestor();
drop table if exists public.convocatoria_cambios;
drop table if exists public.convocatorias;
drop table if exists public.jugadores_privado;
delete from supabase_migrations.schema_migrations where version = '20261023100000';
