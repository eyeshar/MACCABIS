-- =============================================================================
-- Preferencia de partido en los domingos con dos partidos (D194, Iván 20/11/2026).
--
-- Quien está disponible para los dos partidos de un domingo («A los dos», o «Voy» si son a la misma hora) puede decir cuál
-- prefiere y por qué. Es una preferencia: la convocatoria la sigue decidiendo Iván y el motor solo la usa para decidir el
-- EQUIPO de quien ya va (nunca quién va; regla 3.4 de REGLAS_CONVOCATORIA).
--
-- SOLO ADITIVA (D94, D111): una tabla nueva, tres funciones nuevas y dos disparadores nuevos. No cambia ni borra nada
-- que exista. Reversión al lado: 20261120100000_preferencia_partido.revertir.sql (db:migrar nunca la aplica).
--
--  - preferencias_domingo: una fila por (domingo, jugador): el partido que prefiere, el motivo (lista cerrada; los textos
--    y el orden viven en src/lib/respuestas/preferencia.ts, MOTIVOS_PREFERENCIA, y esta comprobación lleva los mismos
--    identificadores: pruebas:preferencia-rls falla si no coinciden) y una nota (obligatoria con «otro»; 200 letras).
--  - PRIVACIDAD: la leen SOLO el propio jugador y los gestores (RLS). Nadie escribe directamente: solo por las funciones.
--    No sale en v_quien_va, ni en la zona pública, ni en el iCal, ni en los mensajes de WhatsApp.
--  - guardar_preferencia(fecha, evento, motivo, nota): el jugador, con los dos partidos abiertos y «va» a los dos.
--    Tras APROBAR la convocatoria no cambia nada solo: deja una alerta a los gestores (como un «voy» tardío).
--  - quitar_preferencia(fecha): la borra (con la misma alerta si ya está aprobada).
--  - Se borra SOLA si deja de estar disponible para los dos (cualquier camino: su respuesta del domingo, una ausencia,
--    un gestor que responde por él), si un partido se cancela o cambia de día.
-- =============================================================================

create table public.preferencias_domingo (
  fecha       date not null,
  person_id   text not null,
  evento_id   uuid not null references public.eventos (id) on delete cascade,
  motivo      text not null check (motivo in ('trabajo', 'familia', 'ninos', 'desplazamiento', 'otro')),
  nota        text check (nota is null or (char_length(nota) between 1 and 200)),
  cambiado_en timestamptz not null default now(),
  primary key (fecha, person_id),
  check (motivo <> 'otro' or nota is not null)
);
create index preferencias_domingo_evento_idx on public.preferencias_domingo (evento_id);
comment on table public.preferencias_domingo is 'D194: partido preferido de un domingo con dos partidos (solo si va a los dos). Privado: el jugador y los gestores.';

alter table public.preferencias_domingo enable row level security;
create policy jugador_lee_la_suya on public.preferencias_domingo for select to authenticated
  using (person_id = public._mi_person_id());
create policy gestores_leen on public.preferencias_domingo for select to authenticated using (public.is_gestor());
revoke all on public.preferencias_domingo from public, anon, authenticated;
grant select on public.preferencias_domingo to authenticated;
grant select on public.preferencias_domingo to service_role;

-- Los dos partidos de liga programados de ese domingo a los que está invitado, y si dice «va» a los dos.
create function public._domingo_doble(p_person text, p_fecha date)
returns uuid[] language sql stable security definer set search_path = ''
as $$
  select case when count(*) = 2 and bool_and(r.respuesta = 'va') then array_agg(e.id order by e.inicio nulls last, e.equipo) end
  from public.eventos e
  left join public.respuestas r on r.evento_id = e.id and r.person_id = p_person
  where e.fecha = p_fecha and e.tipo = 'liga' and e.estado = 'programado' and public._invitado(p_person, e.id)
$$;
revoke execute on function public._domingo_doble(text, date) from public, anon, authenticated;

-- Tras aprobar la convocatoria de ese domingo, un cambio de preferencia solo avisa (alertas_gestores, antes/después
-- «pref:MdA», «pref:MdL» o «pref:-»). Antes de aprobar no avisa: entra en la propuesta si se recalcula.
create function public._alerta_preferencia(p_fecha date, p_person text, p_evento uuid, p_antes text, p_despues text)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if p_antes is not distinct from p_despues then return false; end if;
  if not exists (select 1 from public.convocatorias where fecha = p_fecha and estado = 'aprobada') then return false; end if;
  insert into public.alertas_gestores (evento_id, person_id, antes, despues) values (p_evento, p_person, p_antes, p_despues);
  return true;
end $$;
revoke execute on function public._alerta_preferencia(date, text, uuid, text, text) from public, anon, authenticated;

create function public.guardar_preferencia(p_fecha date, p_evento uuid, p_motivo text, p_nota text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_person text := public._exigir_jugador();
  v_ids uuid[];
  v_id uuid;
  v_nota text := nullif(btrim(coalesce(p_nota, '')), '');
  v_antes text;
  v_despues text;
  v_alerta boolean;
begin
  v_ids := public._domingo_doble(v_person, p_fecha);
  if v_ids is null then raise exception 'preferencia_sin_los_dos' using errcode = 'P0001'; end if;
  if p_evento is null or not (p_evento = any (v_ids)) then raise exception 'opcion_no_valida' using errcode = 'P0001'; end if;
  foreach v_id in array v_ids loop
    if not public._evento_abierto(v_id) then raise exception 'evento_cerrado' using errcode = 'P0001'; end if;
  end loop;
  if p_motivo is null or p_motivo not in ('trabajo', 'familia', 'ninos', 'desplazamiento', 'otro') then
    raise exception 'preferencia_falta_motivo' using errcode = 'P0001';
  end if;
  if p_motivo = 'otro' and v_nota is null then raise exception 'preferencia_falta_nota' using errcode = 'P0001'; end if;
  if char_length(coalesce(v_nota, '')) > 200 then raise exception 'preferencia_nota_larga' using errcode = 'P0001'; end if;

  select 'pref:' || e.equipo into v_antes from public.preferencias_domingo p join public.eventos e on e.id = p.evento_id
   where p.fecha = p_fecha and p.person_id = v_person;
  select 'pref:' || equipo into v_despues from public.eventos where id = p_evento;
  insert into public.preferencias_domingo (fecha, person_id, evento_id, motivo, nota, cambiado_en)
  values (p_fecha, v_person, p_evento, p_motivo, v_nota, now())
  on conflict (fecha, person_id) do update set evento_id = excluded.evento_id, motivo = excluded.motivo, nota = excluded.nota,
    cambiado_en = now();
  v_alerta := public._alerta_preferencia(p_fecha, v_person, p_evento, coalesce(v_antes, 'pref:-'), v_despues);
  return jsonb_build_object('alerta', v_alerta);
end $$;
comment on function public.guardar_preferencia(date, uuid, text, text) is 'D194: el jugador guarda su partido preferido de un domingo al que va a los dos.';
revoke execute on function public.guardar_preferencia(date, uuid, text, text) from public, anon, authenticated;
grant execute on function public.guardar_preferencia(date, uuid, text, text) to authenticated;

create function public.quitar_preferencia(p_fecha date)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_person text := public._exigir_jugador();
  v_evento uuid;
  v_antes text;
  v_alerta boolean := false;
begin
  delete from public.preferencias_domingo p using public.eventos e
   where p.fecha = p_fecha and p.person_id = v_person and e.id = p.evento_id
   returning p.evento_id, 'pref:' || e.equipo into v_evento, v_antes;
  if v_evento is not null then v_alerta := public._alerta_preferencia(p_fecha, v_person, v_evento, v_antes, 'pref:-'); end if;
  return jsonb_build_object('alerta', v_alerta);
end $$;
comment on function public.quitar_preferencia(date) is 'D194: el jugador quita su preferencia de partido de un domingo.';
revoke execute on function public.quitar_preferencia(date) from public, anon, authenticated;
grant execute on function public.quitar_preferencia(date) to authenticated;

-- Se borra sola si deja de estar disponible para los dos (venga de donde venga el cambio de respuesta).
create function public._preferencia_tras_respuesta()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_ev uuid := coalesce(new.evento_id, old.evento_id);
  v_person text := coalesce(new.person_id, old.person_id);
  v_fecha date;
begin
  select fecha into v_fecha from public.eventos where id = v_ev and tipo = 'liga';
  if v_fecha is null then return null; end if;
  if exists (select 1 from public.preferencias_domingo where fecha = v_fecha and person_id = v_person)
     and public._domingo_doble(v_person, v_fecha) is null then
    delete from public.preferencias_domingo where fecha = v_fecha and person_id = v_person;
  end if;
  return null;
end $$;
revoke execute on function public._preferencia_tras_respuesta() from public, anon, authenticated;
create trigger preferencia_tras_respuesta after insert or update or delete on public.respuestas
  for each row execute function public._preferencia_tras_respuesta();

-- Un partido cancelado o movido de día: las preferencias de ese domingo dejan de valer.
create function public._preferencia_tras_evento()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.tipo = 'liga' and (new.estado is distinct from old.estado or new.fecha is distinct from old.fecha or new.tipo is distinct from old.tipo) then
    delete from public.preferencias_domingo p where p.fecha = old.fecha and public._domingo_doble(p.person_id, p.fecha) is null;
    delete from public.preferencias_domingo p where p.evento_id = old.id and p.fecha <> new.fecha;
  end if;
  return null;
end $$;
revoke execute on function public._preferencia_tras_evento() from public, anon, authenticated;
create trigger preferencia_tras_evento after update on public.eventos
  for each row execute function public._preferencia_tras_evento();

notify pgrst, 'reload schema';
