-- Reversión de 20261104110000_whatsapp_contacto.sql (D178). NUNCA la aplica db:migrar: se ejecuta a mano.
-- Quita la columna (y con ella los contactos). `telefono` existía antes y no se toca.
alter table public.jugadores drop column if exists whatsapp_contacto;
delete from supabase_migrations.schema_migrations where version = '20261104110000';
