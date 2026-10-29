-- Datos de D148, corrección de Iván (29/10/2026): nada retroactivo. Valdebernardo es la habitual y «solo con ficha»
-- SOLO desde el 04/11/2026: los entrenos anteriores (el 21/10 sin pista propia, el 28/10 con ubicación libre y los de
-- pista propia) no cambian de pista, de ubicación ni de quién cuenta.
-- Se aplica en el Supabase real DESPUÉS de la migración 20261029120000_pista_desde (D111), en una transacción.
-- Su vuelta atrás: 20261029_valdebernardo_desde.revertir.sql. No toca ningún evento ni su estado de copia.

update public.pistas
   set habitual_desde = '2026-11-04', solo_con_ficha_desde = '2026-11-04'
 where slug = 'valdebernardo';
