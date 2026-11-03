-- =============================================================================
-- WhatsApp a quien no ha respondido (D178): el nombre con el que Iván tiene guardado a cada jugador en su móvil.
--
-- WhatsApp no convierte en mención un «@Nombre» pegado como texto: la mención solo se crea si se escribe @ en la app y
-- se elige el contacto. Gestión copia un mensaje con @ + mote (lo que ven todos en el grupo) y debajo, solo para el
-- gestor, el nombre de contacto que hay que buscar al escribir @.
--
-- La columna va en public.jugadores, junto a `telefono` (que ya existía): RLS «gestores_todo» (solo is_gestor()); ningún
-- jugador ni anónimo la lee, y ninguna vista ni función la devuelve. Los teléfonos NO van aquí: se cargan desde
-- Gestión, Importar teléfonos (nunca en el repositorio, D178). Los contactos sí: no son datos sensibles (Iván, 03/11).
-- Sin contacto: Iván (es él) y Carlos (entrenador), que no estaba en la lista.
-- Solo aditiva. Reversión: 20261104110000_whatsapp_contacto.revertir.sql (quita la columna).
-- =============================================================================

alter table public.jugadores add column whatsapp_contacto text;
comment on column public.jugadores.whatsapp_contacto is 'D178: nombre del contacto en el móvil de Iván, para buscarlo al escribir @ en WhatsApp. Solo gestores.';

update public.jugadores j set whatsapp_contacto = c.contacto
from (values
  ('gianatti-adriano', 'Adriano Amigo Jon Baloncesto'),
  ('martinez-martinez-andres', 'Andres Baloncesto'),
  ('esteban-jon', 'jon Baloncesto'),
  ('mileo-ignacio-agustin', 'Nacho Mileo Mdl'),
  ('teruel-fernandez-tomas', 'Tomás Murcia Baloncesto'),
  ('banos-gallego-carlos', 'Carlos Amigo Nacho Baloncesto'),
  ('villa-guerrero-edwin', 'Edwin Baloncesto'),
  ('santos-artiles-enyel-geuris', 'Enyel Basket Amigo Jon'),
  ('de-maria-sanchez-jaime', 'Jaime Amigo Manu Baloncesto'),
  ('martinez-martinez-victor', 'Victor Baloncesto'),
  ('perez-nunez-victor', 'Víctor Hermano De Raúl Baloncesto'),
  ('garcia-gijon-eduardo', 'Eduardo Amigo Carlos Baloncesto'),
  ('mendez-escandon-fernando', 'Fernando (Amigo De julio)'),
  ('tejeiro-perez-de-agreda-fernando', 'Fernando Tejeiro'),
  ('martin-ortega-rico-eduardo', 'Edu Baloncesto'),
  ('galan-domingo-guillermo', 'Guille Baloncesto'),
  ('de-carvalho-rodrigues-julio-cesar', 'Julio Baloncesto'),
  ('jorba-lopez-sergi', 'Sergi Amigo Rafa Baloncesto'),
  ('romero-barrueco-alonso', 'Alonso baloncesto'),
  ('calahorro-sanchez-manuel', 'Manu baloncesto'),
  ('varas-garcia-luis-alberto', 'Luiso Baloncesto'),
  ('vallesi-daniele', 'Daniele Baloncesto'),
  ('lopez-lucero-alfredo-david', 'David Baloncesto'),
  ('mateos-aparicio-ignacio', 'Ignacio Sevillano Amigo Pablo Baloncesto'),
  ('yamin-squicciarini-nicolas', 'Nicolás Baloncesto'),
  ('feliz-gomez-edimil', 'Edimil Baloncesto')
) as c(person_id, contacto)
where j.person_id = c.person_id and j.whatsapp_contacto is null;
