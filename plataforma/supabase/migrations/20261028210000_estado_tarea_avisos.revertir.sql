-- Revierte 20261028210000_estado_tarea_avisos.sql: quita la funcion (no guarda datos).
drop function if exists public.estado_tarea_avisos();
notify pgrst, 'reload schema';
