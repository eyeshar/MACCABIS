-- Deshace 20261121100000_mdfantasy.sql (D196, MdFantasy). Quita el disparador de respuestas, todas las funciones
-- fantasy_* y _fantasy_* y las trece tablas fantasy_* (con lo jugado: plantillas, movimientos y puntos). No toca nada
-- más: respuestas, eventos, asistencia_eventos y avisos_registro se quedan como están (los avisos «fantasy-…» ya
-- enviados siguen en avisos_registro; son texto).
-- Probado en la pila local (pruebas:fantasy-rls): se deshace limpia y se vuelve a aplicar.
drop trigger if exists fantasy_primera_respuesta on public.respuestas;
drop trigger if exists fantasy_asistencia_cambia on public.asistencia_eventos;
do $$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and (p.proname like 'fantasy\_%' or p.proname like '\_fantasy\_%') loop
    execute format('drop function if exists %s cascade', f);
  end loop;
end $$;
drop table if exists public.fantasy_primeras_respuestas;
drop table if exists public.fantasy_logros;
drop table if exists public.fantasy_puntos_manager;
drop table if exists public.fantasy_puntos_jugador;
drop table if exists public.fantasy_duelos;
drop table if exists public.fantasy_porras;
drop table if exists public.fantasy_alineaciones;
drop table if exists public.fantasy_jornadas;
drop table if exists public.fantasy_movimientos;
drop table if exists public.fantasy_copias;
drop table if exists public.fantasy_jugadores;
drop table if exists public.fantasy_managers;
drop table if exists public.fantasy_config;
delete from supabase_migrations.schema_migrations where version = '20261121100000';
notify pgrst, 'reload schema';
