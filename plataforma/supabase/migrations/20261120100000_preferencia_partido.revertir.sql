-- Deshace 20261120100000_preferencia_partido.sql (D194). Quita los disparadores, las funciones y la tabla de preferencias
-- (con las preferencias guardadas: son opcionales y no las usa nada más). Las alertas «pref:…» de alertas_gestores se
-- quedan (la tabla ya admitía cualquier texto); si se quieren quitar, aparte y a propósito:
-- `delete from public.alertas_gestores where antes like 'pref:%' or despues like 'pref:%';`
-- Probado en la pila local (pruebas:preferencia-rls): se deshace limpia y se vuelve a aplicar.
drop trigger if exists preferencia_tras_evento on public.eventos;
drop trigger if exists preferencia_tras_respuesta on public.respuestas;
drop function if exists public._preferencia_tras_evento();
drop function if exists public._preferencia_tras_respuesta();
drop function if exists public.quitar_preferencia(date);
drop function if exists public.guardar_preferencia(date, uuid, text, text);
drop function if exists public._alerta_preferencia(date, text, uuid, text, text);
drop function if exists public._domingo_doble(text, date);
drop table if exists public.preferencias_domingo;
delete from supabase_migrations.schema_migrations where version = '20261120100000';
notify pgrst, 'reload schema';
