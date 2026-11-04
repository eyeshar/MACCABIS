-- =============================================================================
-- Aviso a gestores por los cambios al ENTRENO tras el cierre (D181; Iván, 04/11/2026). SOLO ADITIVA: reemplaza con CREATE OR
-- REPLACE la función interna _tras_cambio_jugador (misma firma: conserva sus permisos); no toca tablas ni datos.
--
-- El fallo: la función devolvía false para todo lo que no fuera un partido de liga, así que una baja al entreno no avisaba a
-- nadie (caso real: un jugador pasó de «va» a «no» el 04/11 a las 16:08, con el entreno a las 20:30, sin aviso).
--
-- Ahora, para el ENTRENO OFICIAL y PROGRAMADO, cualquier cambio de respuesta de un jugador a partir de su límite
-- (_limite_dudas: el miércoles a las 12:00 para el entreno del miércoles) deja la alerta de gestores, en los dos sentidos
-- (baja y alta tardía). Antes del límite, nada. Lo hace tanto «responder» como una ausencia que lo pasa a «no». El cierre
-- automático de las dudas (cerrar_dudas, origen «sistema») no pasa por aquí: no avisa.
-- La regla de los partidos de liga NO cambia (idéntica a 20261103100000).
-- Reversión al lado: 20261104140000_aviso_entreno_cierre.revertir.sql.
-- =============================================================================
create or replace function public._tras_cambio_jugador(p_evento uuid, p_person text, p_antes text, p_despues text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  e public.eventos;
  c public.convocatorias;
begin
  if p_antes is not distinct from p_despues then return false; end if;
  select * into e from public.eventos where id = p_evento;
  -- Entreno oficial: desde su límite (miércoles 12:00), cualquier cambio de un jugador, sea baja o alta.
  if e.tipo = 'entreno' then
    if not e.oficial or e.estado <> 'programado' or now() < public._limite_dudas(p_evento) then return false; end if;
    insert into public.alertas_gestores (evento_id, person_id, antes, despues) values (p_evento, p_person, p_antes, p_despues);
    return true;
  end if;
  if e.tipo <> 'liga' then return false; end if;
  -- martes de la semana del partido (lunes = fecha - (isodow - 1)) a las 12:00 de Madrid: el cierre (D173)
  if now() < (((e.fecha - (extract(isodow from e.fecha)::int - 1) + 1) + time '12:00') at time zone 'Europe/Madrid') then
    return false;
  end if;
  select * into c from public.convocatorias where fecha = e.fecha and estado = 'aprobada';
  if c.id is not null
     and not exists (select 1 from jsonb_array_elements(coalesce(c.equipos -> e.equipo, '[]'::jsonb)) x where x ->> 'person_id' = p_person)
     and p_despues <> 'va' then
    return false;
  end if;
  insert into public.alertas_gestores (evento_id, person_id, antes, despues) values (p_evento, p_person, p_antes, p_despues);
  return true;
end $$;

notify pgrst, 'reload schema';
