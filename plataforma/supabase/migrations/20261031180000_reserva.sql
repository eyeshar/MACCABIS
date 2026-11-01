-- =============================================================================
-- Marca «Reserva» por jugador (D158).
--
-- SOLO ADITIVA (D94, D111): una columna nueva con valor por defecto en jugadores_privado. No cambia ni borra nada de lo
-- que ya existe. Reversion al lado: 20261031180000_reserva.revertir.sql (db:migrar nunca la aplica).
--
--  - jugadores_privado.reserva: el reserva recibe y responde los partidos como cualquiera con ficha, pero el motor de
--    convocatoria solo lo mete si sin él no se cubren los mínimos o el número compensado (regla 1.8); si no, sale como
--    «reserva disponible». Con 20 o más disponibles no va por defecto.
--
-- Confidencial (D39): vive en jugadores_privado, que solo leen y escriben los gestores (RLS ya existente). Ningun jugador
-- la ve; no sale en mensajes ni en la zona de jugadores. Los datos (quien es reserva) se cargan aparte, no aqui.
-- =============================================================================

alter table public.jugadores_privado
  add column reserva boolean not null default false;
comment on column public.jugadores_privado.reserva is 'D158: reserva. Solo entra en la convocatoria si hace falta para los mínimos o el número compensado. Solo gestores.';
