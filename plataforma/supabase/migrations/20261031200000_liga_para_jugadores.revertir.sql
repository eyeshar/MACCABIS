-- Reversión de 20261031200000_liga_para_jugadores.sql (D162). NUNCA la aplica db:migrar: se ejecuta a mano.
-- Vuelve a dejar la liga por jugador solo para gestores (D73).
drop policy if exists jugadores_leen on public.liga_partidos;
drop policy if exists jugadores_leen on public.liga_estadisticas_jugador;
drop policy if exists jugadores_leen on public.liga_clasificacion;
drop function if exists public.puede_ver_liga();
delete from supabase_migrations.schema_migrations where version = '20261031200000';
notify pgrst, 'reload schema';
