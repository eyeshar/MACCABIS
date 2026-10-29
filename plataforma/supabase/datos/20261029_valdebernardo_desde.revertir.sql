-- Revierte 20261029_valdebernardo_desde.sql: Valdebernardo vuelve a valer «desde siempre» (sin fechas).
update public.pistas set habitual_desde = null, solo_con_ficha_desde = null where slug = 'valdebernardo';
