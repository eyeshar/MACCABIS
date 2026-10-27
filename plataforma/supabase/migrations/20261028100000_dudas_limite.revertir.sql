-- Revertir 20261028100000_dudas_limite (D141): quita el cierre de dudas y el limite, repone _escribir_respuesta como
-- estaba en 20261008100000_respuestas_web y deja los CHECK de respuestas como antes. Se ejecuta a mano y en una sola
-- transaccion (psql -1 -f ...; D111). OJO: las respuestas con origen 'sistema' / motivo 'no_confirmo' (las puestas por el
-- cierre automatico) no caben en el modelo anterior: se pasan a origen 'gestor' y motivo 'otro' antes de restituir los CHECK
-- (siguen siendo «no va»; se pierde solo la marca de que fue el sistema).
update public.respuestas set origen = 'gestor' where origen = 'sistema';
update public.respuestas set motivo = 'otro' where motivo = 'no_confirmo';

drop function if exists public.cerrar_dudas(timestamptz);

create or replace function public._escribir_respuesta(p_evento uuid, p_person text, p_respuesta text, p_motivo text, p_detalle text,
                                           p_origen text, p_por uuid, p_por_nombre text, p_ausencia uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  v_antes text;
begin
  select respuesta into v_antes from public.respuestas where evento_id = p_evento and person_id = p_person;
  insert into public.respuestas (evento_id, person_id, respuesta, motivo, detalle, fuente, origen, puesto_por,
                                 puesto_por_nombre, cambiado_en, leido_en, ausencia_id)
  values (p_evento, p_person, p_respuesta, p_motivo, nullif(btrim(coalesce(p_detalle, '')), ''), 'web', p_origen, p_por,
          p_por_nombre, now(), now(), p_ausencia)
  on conflict (evento_id, person_id) do update set
    respuesta = excluded.respuesta, motivo = excluded.motivo, detalle = excluded.detalle, fuente = 'web',
    origen = excluded.origen, puesto_por = excluded.puesto_por, puesto_por_nombre = excluded.puesto_por_nombre,
    cambiado_en = now(), ausencia_id = excluded.ausencia_id;
  return coalesce(v_antes, 'sin_responder');
end $$;

drop function if exists public._limite_dudas(uuid);

alter table public.respuestas drop constraint respuestas_motivo_check;
alter table public.respuestas add constraint respuestas_motivo_check
  check (motivo in ('lesion', 'trabajo', 'viaje', 'familia', 'otro', 'horario'));
alter table public.respuestas drop constraint respuestas_origen_check;
alter table public.respuestas add constraint respuestas_origen_check check (origen in ('sporteasy', 'jugador', 'gestor'));

notify pgrst, 'reload schema';
delete from supabase_migrations.schema_migrations where version = '20261028100000';
