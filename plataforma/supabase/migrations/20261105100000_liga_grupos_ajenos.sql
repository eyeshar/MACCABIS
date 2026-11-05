-- =============================================================================
-- D184 (Iván, 05/11/2026; amplía D183): las hojas de los cuatro grupos AJENOS de la fase (G3 DOM MAÑ G3, G4 DOM TAR,
-- G5 SAB TAR G1, G6 SAB TAR G2) se cargan en liga_partidos, liga_estadisticas_jugador y liga_clasificacion, con el
-- grupo como campo, igual que G1 y G2.
--
-- La hoja de la FBM no trae fecha ni jornada y esos grupos no tienen calendario en la base: sus partidos van SIN
-- jornada (null). G1 y G2 la siguen exigiendo. Las políticas no cambian: con sesión de jugador o gestor
-- (puede_ver_liga(), D162) y nunca anónimo; nadie gana escritura.
-- Solo AÑADE (D111): quita un NOT NULL y pone un CHECK que G1/G2 ya cumplen.
-- Reversión: 20261105100000_liga_grupos_ajenos.revertir.sql.
-- =============================================================================

alter table public.liga_partidos alter column jornada drop not null;
alter table public.liga_partidos add constraint liga_partidos_jornada_nuestros
  check (jornada is not null or grupo not in ('G1', 'G2'));

notify pgrst, 'reload schema';
