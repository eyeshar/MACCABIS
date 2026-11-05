-- Reversión de 20261105100000_liga_grupos_ajenos.sql (D184). NUNCA la aplica db:migrar: se ejecuta a mano.
-- Borra los partidos de los grupos ajenos (sus jugadores caen en cascada) y su clasificación, y vuelve a exigir jornada.
delete from public.liga_partidos where grupo not in ('G1', 'G2');
delete from public.liga_clasificacion where grupo not in ('G1', 'G2');
alter table public.liga_partidos drop constraint if exists liga_partidos_jornada_nuestros;
alter table public.liga_partidos alter column jornada set not null;
delete from supabase_migrations.schema_migrations where version = '20261105100000';
notify pgrst, 'reload schema';
