-- Datos de D148 (Iván, 29/10/2026): Valdebernardo vuelve a estar disponible y es «solo jugadores con ficha».
-- Se aplica en el Supabase real DESPUÉS de la migración 20261029100000_pista_solo_con_ficha (D111), en una transacción.
-- Su vuelta atrás: 20261029_valdebernardo_reabre.revertir.sql.
--
--  1. Pista: de «en obras» a habitual, con la marca «solo con ficha» y la nota nueva (fuera «Cerrada por obras»).
--  2. Entrenos del 04/11/2026 (incluido) al 05/05/2027, programados: en Valdebernardo (sin pista propia ni ubicación
--     libre: van a la de la serie) y de 20:30 a 22:30. Los miércoles sin entreno (D87: 23/12, 30/12, 06/01 y 24/03) no
--     existen como eventos; los cancelados y los pasados no se tocan.
--  3. SportEasy (decisión de Iván): no se copia nada. Esos entrenos quedan cerrados («copiado») con la nota «Iván: no se
--     copia a SportEasy (29/10/2026)»: ni pendientes, ni en la tarjeta «Copia a SportEasy», ni en el filtro «Pendientes».
--     El paso 2 va aparte porque el disparador de eventos pone «pendiente» a quien cambia de datos sin cambiar de estado.
--     Ningún otro evento cambia su estado de copia.

update public.pistas
   set estado = 'habitual', solo_con_ficha = true,
       nota = 'Reabierta el 29/10/2026. Solo pueden entrenar los jugadores con ficha en MdA o MdL.'
 where slug = 'valdebernardo';

update public.eventos
   set pista_id = null, numero_pista = null, ubicacion_nombre = null, ubicacion_direccion = null, ubicacion_lat = null,
       ubicacion_lng = null, ubicacion_enlace = null, inicio = '20:30', fin = '22:30'
 where tipo = 'entreno' and oficial and borrado_en is null and estado = 'programado'
   and fecha between '2026-11-04' and '2027-05-05'
   and (pista_id, numero_pista, ubicacion_nombre, ubicacion_direccion, ubicacion_lat, ubicacion_lng, ubicacion_enlace, inicio, fin)
       is distinct from (null::uuid, null::int, null::text, null::text, null::float8, null::float8, null::text, '20:30'::time, '22:30'::time);

update public.eventos
   set sporteasy_estado = 'copiado', sporteasy_cambio = 'Iván: no se copia a SportEasy (29/10/2026)',
       sporteasy_copiado_en = coalesce(sporteasy_copiado_en, now())
 where tipo = 'entreno' and oficial and borrado_en is null and estado = 'programado'
   and fecha between '2026-11-04' and '2027-05-05';
