-- Reversion de 20261008101000_avisos.sql (D94/D99). NUNCA la aplica db:migrar: se ejecuta a mano, ANTES que la de
-- 20261008100000_respuestas_web.revertir.sql. Se pierden las suscripciones (cada movil tendria que volver a activar).
drop function if exists public.marcar_jornada(int, text);
drop function if exists public.marcar_sporteasy(boolean);
drop function if exists public.cambiar_interruptor(boolean);
drop function if exists public.estado_activacion();
drop function if exists public._jornadas_limpias_seguidas();
drop function if exists public._exigir_responsable();
drop function if exists public._es_responsable();
-- (respuestas_web_config vuelve a tener UPDATE para gestores, como la dejo la 20261008100000)
grant update on public.respuestas_web_config to authenticated;
grant insert, update on public.jornadas_control to authenticated;
drop function if exists public.baja_suscripcion(text);
drop function if exists public.alta_suscripcion(text, text, text, text);
drop table if exists public.avisos_registro;
drop table if exists public.suscripciones_avisos;
delete from supabase_migrations.schema_migrations where version = '20261008101000';
