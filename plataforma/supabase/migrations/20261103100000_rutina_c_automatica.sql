-- =============================================================================
-- Rutina C automática (D173; Iván, 02/11/2026). SOLO ADITIVA salvo dos funciones internas que se reescriben con CREATE OR
-- REPLACE (misma firma: conservan sus permisos), por decisión expresa de Iván (D173.A y E):
--   1. _limite_dudas: el plazo del partido de liga (de miércoles a domingo) pasa al MARTES a las 12:00 (antes, 20:00) y el
--      del entreno oficial del miércoles, al MIÉRCOLES a las 12:00 (antes, martes 20:00). El resto, 24 h antes, igual. La copia
--      de la web es limiteDudas (src/lib/avisos/horario.ts); pruebas:dudas compara las dos.
--   2. _tras_cambio_jugador (banda roja y aviso a gestores): empieza en el cierre (martes 12:00, antes 20:00) y, con la
--      convocatoria de ese domingo APROBADA, solo salta por cambios que afectan a un convocado de ese partido o por un
--      «voy» de alguien sin convocar (la tarea de avisos decide si ese «voy» importa: solo con un equipo bajo mínimos).
-- Lo nuevo:
--   3. convocatorias.automatica_en: cuándo dejó la plataforma la propuesta automática del martes (Panel y pantalla).
--   4. gestores.recibe_propuesta: a quién llega el push «Convocatoria del domingo … lista» y el recordatorio de las 19:00
--      (Iván); a las 21:00, a los tres.
--   5. convocatoria_privados_tarea(): los datos privados que necesita el motor (posición, base de reserva, nivel, dobla,
--      regla, sanción, marcas y la letra de ataque de la proyección), para la tarea de avisos (service_role), que desde D146 no lee jugadores_privado. Solo la
--      ejecuta service_role; la tarea no los imprime ni los manda en ningún aviso (D39, D173.F).
--   6. convocatoria_propuesta_auto(): guarda la propuesta automática como BORRADOR, solo si la convocatoria de ese domingo no
--      está aprobada ni tiene cambios a mano posteriores a su última propuesta. Solo service_role. Nunca aprueba.
-- Reversión al lado: 20261103100000_rutina_c_automatica.revertir.sql.
-- =============================================================================

-- ---------------------------------------------------------------- 1. plazo
create or replace function public._limite_dudas(p_evento uuid)
returns timestamptz language sql stable security definer set search_path = ''
as $$
  select case
    when e.oficial and e.tipo = 'entreno' and extract(isodow from e.fecha) = 3
      then (e.fecha + time '12:00') at time zone 'Europe/Madrid'
    when e.oficial and e.tipo = 'liga' and extract(isodow from e.fecha) >= 3
      then ((e.fecha - (extract(isodow from e.fecha)::int - 1) + 1) + time '12:00') at time zone 'Europe/Madrid'
    else ((e.fecha + coalesce(e.inicio, time '00:00')) at time zone 'Europe/Madrid') - interval '24 hours'
  end
  from public.eventos e where e.id = p_evento
$$;

-- ---------------------------------------------------------------- 2. banda roja
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

-- ---------------------------------------------------------------- 3 y 4. columnas nuevas
alter table public.convocatorias add column if not exists automatica_en timestamptz;
alter table public.gestores add column if not exists recibe_propuesta boolean not null default false;
update public.gestores set recibe_propuesta = true where nombre = 'Iván';

-- ---------------------------------------------------------------- 5. datos del motor para la tarea
create or replace function public.convocatoria_privados_tarea()
returns table (person_id text, posicion text, base_reserva boolean, nivel text, dobla boolean, regla text, regla_equipo text,
               sancionado_hasta_jornada int, no_suele_entrenar boolean, nunca_partidos boolean, reserva boolean, nota_ataque text)
language sql stable security definer set search_path = ''
as $$
  select p.person_id, p.posicion, p.base_reserva, p.nivel, p.dobla, p.regla, p.regla_equipo, p.sancionado_hasta_jornada,
         p.no_suele_entrenar, p.nunca_partidos, p.reserva, p.nota_ataque
  from public.jugadores_privado p
$$;
comment on function public.convocatoria_privados_tarea() is 'D173: lo que necesita el motor de convocatoria para la propuesta automática y los recambios (service_role). Nunca sale en un aviso.';
revoke execute on function public.convocatoria_privados_tarea() from public, anon, authenticated;
grant execute on function public.convocatoria_privados_tarea() to service_role;

-- ---------------------------------------------------------------- 6. propuesta automática
create or replace function public.convocatoria_propuesta_auto(p_fecha date, p_jornada int, p_equipos jsonb, p_dificultad jsonb,
                                                              p_detalle jsonb default '{}'::jsonb)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  c public.convocatorias;
  v_nombre constant text := 'Propuesta automática';
begin
  if p_equipos is null or jsonb_typeof(p_equipos) <> 'object'
     or exists (select 1 from jsonb_object_keys(p_equipos) k where k not in ('MdA', 'MdL')) then
    raise exception 'equipos_no_validos' using errcode = 'P0001';
  end if;
  insert into public.convocatorias (fecha, jornada, creado_por_nombre, cambiado_por_nombre)
  values (p_fecha, p_jornada, v_nombre, v_nombre)
  on conflict (fecha) do nothing;
  select * into c from public.convocatorias where fecha = p_fecha for update;
  if c.estado = 'aprobada' then return 'aprobada'; end if;
  -- «Tocada a mano»: un cambio a mano (o «Empezar en blanco») posterior a la última propuesta o «Recalcular».
  if exists (
    select 1 from public.convocatoria_cambios x
    where x.convocatoria_id = c.id and x.accion in ('blanco', 'mover', 'doblar', 'quitar', 'anadir', 'posicion')
      and x.en > coalesce((select max(y.en) from public.convocatoria_cambios y
                           where y.convocatoria_id = c.id and y.accion in ('propuesta', 'recalcular')), '-infinity'::timestamptz)
  ) then
    return 'tocada';
  end if;
  update public.convocatorias set
    jornada = coalesce(p_jornada, jornada), equipos = p_equipos, dificultad = coalesce(p_dificultad, dificultad),
    origen = 'propuesta', automatica_en = now(), cambiado_en = now(), cambiado_por_nombre = v_nombre
  where id = c.id;
  insert into public.convocatoria_cambios (convocatoria_id, por_user_id, por_nombre, accion, nota, detalle)
  values (c.id, null, v_nombre, 'propuesta', 'propuesta automática', coalesce(p_detalle, '{}'::jsonb) || jsonb_build_object('automatica', true));
  return 'guardada';
end $$;
comment on function public.convocatoria_propuesta_auto(date, int, jsonb, jsonb, jsonb) is 'D173: la propuesta automática del martes, como borrador (nunca aprueba ni pisa una aprobada o tocada a mano). Solo service_role.';
revoke execute on function public.convocatoria_propuesta_auto(date, int, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.convocatoria_propuesta_auto(date, int, jsonb, jsonb, jsonb) to service_role;

notify pgrst, 'reload schema';
