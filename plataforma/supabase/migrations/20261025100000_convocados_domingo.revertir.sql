-- Reversion de 20261025100000_convocados_domingo.sql (D111, D128). NUNCA la aplica db:migrar: se ejecuta a mano.
-- Solo quita las dos funciones nuevas; no hay datos que perder. No toca nada anterior.
drop function if exists public.ultima_importacion_respuestas();
drop function if exists public.convocados_del_domingo(date);
delete from supabase_migrations.schema_migrations where version = '20261025100000';
