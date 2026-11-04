-- Reversión de 20261104140000_aviso_entreno_cierre.sql (D181). NUNCA la aplica db:migrar: se ejecuta a mano.
-- Repone _tras_cambio_jugador de 20261103100000 (solo los partidos de liga dejan alerta). Las alertas de entreno que ya se
-- hubieran creado se quedan como están (son filas de alertas_gestores; el gestor las da por vistas).

create or replace function public._tras_cambio_jugador(p_evento uuid, p_person text, p_antes text, p_despues text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  e public.eventos;
  c public.convocatorias;
begin
  if p_antes is not distinct from p_despues then return false; end if;
  select * into e from public.eventos where id = p_evento;
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

delete from supabase_migrations.schema_migrations where version = '20261104140000';
notify pgrst, 'reload schema';
