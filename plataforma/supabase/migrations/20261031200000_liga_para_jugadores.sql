-- =============================================================================
-- D162 (Iván, 31/10/2026; matiza D73): «Scouting rivales» y «Liga consolidada» pasan de solo gestores a cualquier
-- jugador CON SESIÓN (vinculado a su ficha) y a los gestores. Nunca anónimo: sin sesión, nada.
--
-- Solo AÑADE (D111): una función y una política de SELECT más en liga_partidos, liga_estadisticas_jugador y
-- liga_clasificacion. Las políticas «gestores_leen» siguen igual. liga_calendario NO se abre: ya no la lee ninguna
-- pantalla (el calendario sale de la tabla de eventos, D162) y queda solo para gestores. Nadie gana escritura.
-- Reversión: 20261031200000_liga_para_jugadores.revertir.sql.
-- =============================================================================

-- ¿La sesión es de un jugador activo (su correo está en su ficha) o de un gestor?
create function public.puede_ver_liga()
returns boolean language sql stable security definer set search_path = ''
as $$ select public.is_gestor() or public._mi_jugador() is not null $$;

revoke all on function public.puede_ver_liga() from public, anon;
grant execute on function public.puede_ver_liga() to authenticated;

create policy jugadores_leen on public.liga_partidos             for select to authenticated using (public.puede_ver_liga());
create policy jugadores_leen on public.liga_estadisticas_jugador for select to authenticated using (public.puede_ver_liga());
create policy jugadores_leen on public.liga_clasificacion        for select to authenticated using (public.puede_ver_liga());

notify pgrst, 'reload schema';
