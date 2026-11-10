-- Reversión de 20261110140000_propuesta_borrador_vacio.sql: vuelve a la convocatoria_propuesta_auto de 20261103100000
-- (un borrador con cualquier cambio a mano posterior a la última propuesta cuenta como «tocada», aunque esté vacío).
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

notify pgrst, 'reload schema';
delete from supabase_migrations.schema_migrations where version = '20261110140000';
