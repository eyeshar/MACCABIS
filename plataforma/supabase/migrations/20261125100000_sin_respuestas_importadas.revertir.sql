-- Deshace 20261125100000_sin_respuestas_importadas.sql (D200): quita el disparador y su función. No toca filas.
drop trigger if exists respuestas_sin_importadas on public.respuestas;
drop function if exists public._sin_respuestas_importadas();
delete from supabase_migrations.schema_migrations where version = '20261125100000';
