-- Revertir 20261027110000_entrados_reales: repone estado_activacion como estaba en 20261008102000_quien_responde
-- (cuenta como «entrado» a cualquiera con una cuenta de Auth). Misma firma y permisos; se ejecuta a mano (D111).
create or replace function public.estado_activacion()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  c public.respuestas_web_config;
  v_plantilla int;
  v_entrados int;
  v_avisos int;
  v_faltan jsonb;
begin
  if not public.is_gestor() then raise exception 'solo_gestores' using errcode = 'P0001'; end if;
  select * into c from public.respuestas_web_config where id = 1;
  select count(*)::int,
         count(*) filter (where exists (select 1 from auth.users u where lower(u.email) = lower(j.email)))::int,
         count(*) filter (where exists (select 1 from public.suscripciones_avisos s where s.person_id = j.person_id and s.activa))::int,
         coalesce(jsonb_agg(j.nombre_visible order by j.nombre_visible)
                    filter (where not exists (select 1 from auth.users u where lower(u.email) = lower(j.email))), '[]'::jsonb)
    into v_plantilla, v_entrados, v_avisos, v_faltan
  from public.jugadores j where j.activo and j.rol <> 'entrenador';
  return jsonb_build_object(
    'encendido', c.encendido, 'encendido_desde', c.encendido_desde, 'sporteasy_comprobado', c.sporteasy_comprobado,
    'cambiado_en', c.cambiado_en, 'cambiado_por', c.cambiado_por_nombre,
    'jornadas_seguidas', public._jornadas_limpias_seguidas(), 'plantilla', v_plantilla, 'entrados', v_entrados,
    'minimo_entrados', least(c.minimo_entrados, v_plantilla), 'faltan_por_entrar', v_faltan, 'con_avisos', v_avisos,
    'puede_manejar', public._es_responsable(),
    'se_puede_encender', public._jornadas_limpias_seguidas() >= 3 and v_entrados >= least(c.minimo_entrados, v_plantilla)
                         and c.sporteasy_comprobado);
end $$;

notify pgrst, 'reload schema';
delete from supabase_migrations.schema_migrations where version = '20261027110000';
