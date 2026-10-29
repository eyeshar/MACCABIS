-- Vuelta atrás de 20261029_valdebernardo_reabre.sql (D148): Valdebernardo otra vez en obras, sin la marca, con su nota
-- de antes, y los entrenos del 04/11/2026 al 05/05/2027 sin la nota de «no se copia» (siguen «copiado», como estaban el
-- 29/10/2026 antes del cambio: ninguno tenía pista propia, ubicación libre ni otro horario, así que el paso 2 no cambió
-- nada en el real). Se aplica ANTES de revertir la migración 20261029100000 (usa la columna solo_con_ficha).

update public.pistas
   set estado = 'en_obras', solo_con_ficha = false,
       nota = 'Cerrada por obras: cada miércoles sale «Pista por confirmar» hasta que reabra o se fije otra pista.'
 where slug = 'valdebernardo';

-- Uno que se haya cambiado después queda «pendiente» con la nota como descripción (el disparador la conserva): pasa a
-- «Cambio sin describir», lo mismo que pone el disparador sin descripción.
update public.eventos
   set sporteasy_cambio = case when sporteasy_estado = 'pendiente' then 'Cambio sin describir' end
 where tipo = 'entreno' and fecha between '2026-11-04' and '2027-05-05'
   and sporteasy_cambio = 'Iván: no se copia a SportEasy (29/10/2026)';
