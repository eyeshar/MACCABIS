-- Reversión de 20261103100000_rutina_c_automatica.sql (D173). NUNCA la aplica db:migrar: se ejecuta a mano.
-- Vuelve al plazo de D141 (martes a las 20:00 el partido y el entreno del miércoles) y a la banda roja desde el martes a las
-- 20:00 para cualquier cambio; quita las dos funciones nuevas y las dos columnas (se pierde cuándo se hizo la propuesta
-- automática y quién recibe su aviso: las convocatorias y sus cambios se quedan como están).

create or replace function public._limite_dudas(p_evento uuid)
returns timestamptz language sql stable security definer set search_path = ''
as $$
  select case
    when e.oficial and e.tipo = 'entreno' and extract(isodow from e.fecha) = 3
      then ((e.fecha - 1) + time '20:00') at time zone 'Europe/Madrid'
    when e.oficial and e.tipo = 'liga' and extract(isodow from e.fecha) >= 3
      then ((e.fecha - (extract(isodow from e.fecha)::int - 1) + 1) + time '20:00') at time zone 'Europe/Madrid'
    else ((e.fecha + coalesce(e.inicio, time '00:00')) at time zone 'Europe/Madrid') - interval '24 hours'
  end
  from public.eventos e where e.id = p_evento
$$;

create or replace function public._tras_cambio_jugador(p_evento uuid, p_person text, p_antes text, p_despues text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  e public.eventos;
begin
  if p_antes is not distinct from p_despues then return false; end if;
  select * into e from public.eventos where id = p_evento;
  if e.tipo <> 'liga' then return false; end if;
  -- martes de la semana del partido (lunes = fecha - (isodow - 1)) a las 20:00 de Madrid
  if now() < (((e.fecha - (extract(isodow from e.fecha)::int - 1) + 1) + time '20:00') at time zone 'Europe/Madrid') then
    return false;
  end if;
  insert into public.alertas_gestores (evento_id, person_id, antes, despues) values (p_evento, p_person, p_antes, p_despues);
  return true;
end $$;

drop function if exists public.convocatoria_propuesta_auto(date, int, jsonb, jsonb, jsonb);
drop function if exists public.convocatoria_privados_tarea();
alter table public.convocatorias drop column if exists automatica_en;
alter table public.gestores drop column if exists recibe_propuesta;

delete from supabase_migrations.schema_migrations where version = '20261103100000';
notify pgrst, 'reload schema';
