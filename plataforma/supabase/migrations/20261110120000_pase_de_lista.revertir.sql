-- Deshace 20261110120000_pase_de_lista.sql (D192). Quita la función y la columna «quién pasó lista». Las filas del pase
-- (origen = 'plataforma', evento_ref = id del evento) se quedan: la tabla ya las admitía antes; si también se quieren
-- quitar, `delete from public.asistencia_eventos where origen = 'plataforma';` aparte, a propósito.
-- Probado en la pila local (pruebas:pase-lista): se deshace limpia y se vuelve a aplicar.
drop function if exists public.pase_de_lista(uuid, jsonb);
alter table public.asistencia_eventos drop column if exists pasado_por_nombre;
delete from supabase_migrations.schema_migrations where version = '20261110120000';
notify pgrst, 'reload schema';
