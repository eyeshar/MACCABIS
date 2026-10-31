-- Reversion de 20261031150000_mi_disponibilidad_defecto.sql (D151). NUNCA la aplica db:migrar: se ejecuta a mano.
-- Solo quita la funcion: no habia nada antes que devolver.
drop function if exists public.mi_disponibilidad_defecto();
delete from supabase_migrations.schema_migrations where version = '20261031150000';
