-- Reversion de 20261028230000_disponibilidad_por_defecto.sql (D146). NUNCA la aplica db:migrar: se ejecuta a mano.
-- Se pierden las dos marcas por jugador y las excepciones de entreno (antes, la copia de privado/backups/).
-- El permiso de lectura de jugadores_privado para service_role se deja como esta: en el Supabase real ya lo tenia antes
-- de esta migracion (comprobado al aplicarla), y quitarlo romperia lo anterior.
drop table if exists public.entreno_defecto_quitado;
alter table public.jugadores_privado drop column if exists nunca_partidos;
alter table public.jugadores_privado drop column if exists no_suele_entrenar;
delete from supabase_migrations.schema_migrations where version = '20261028230000';
