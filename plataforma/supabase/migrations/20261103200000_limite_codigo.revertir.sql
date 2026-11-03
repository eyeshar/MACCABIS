-- Reversión de 20261103200000_limite_codigo.sql (revisión de seguridad, 03/11/2026). NUNCA la aplica db:migrar: se ejecuta a mano.
-- Quita el límite de intentos del código de Entrar: la web sigue funcionando (sin las funciones, verificarCodigo deja pasar
-- y queda solo el límite de Supabase). Se pierden los fallos apuntados (solo HMAC de correos, nada más).

drop function if exists public.codigo_resultado(text, boolean);
drop function if exists public.codigo_permitido(text);
drop table if exists public.intentos_codigo;

delete from supabase_migrations.schema_migrations where version = '20261103200000';
notify pgrst, 'reload schema';
