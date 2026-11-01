-- Reversion de 20261031190000_respuesta_a_mano.sql (D159). NUNCA la aplica db:migrar: se ejecuta a mano.
-- Solo quita la funcion: no habia nada antes que devolver. Las respuestas que puso siguen (son respuestas normales,
-- origen 'gestor') y su rastro en tablero_registro tambien.
drop function if exists public.gestor_responder(uuid, text[], text, text, text);
delete from supabase_migrations.schema_migrations where version = '20261031190000';
