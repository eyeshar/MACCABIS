-- Reversion de 20261031180000_reserva.sql (D158). NUNCA la aplica db:migrar: se ejecuta a mano.
-- Se pierde la marca «Reserva» de cada jugador (antes, la copia de privado/backups/).
alter table public.jugadores_privado drop column if exists reserva;
delete from supabase_migrations.schema_migrations where version = '20261031180000';
