-- =============================================================================
-- Paso 3 (D99): el jugador RESPONDE EN LA WEB, con interruptor que solo enciende Ivan desde Gestion (D64).
--
-- SOLO ADITIVA (D94): columnas, tablas, vistas, politicas y funciones nuevas. Lo unico que se toca de lo existente son
-- tres RELAJACIONES que no pierden ningun dato (todo lo que valia antes sigue valiendo):
--   - ausencias_periodo.hasta admite vacio ("sin fecha de vuelta", D99.4);
--   - respuestas.motivo admite ademas 'horario' (motivo interno de "solo al de las HH:MM", D99.3);
--   - respuestas.fuente y ausencias_periodo.fuente admiten ademas 'web'.
-- Reversion al lado: 20261008100000_respuestas_web.revertir.sql.
--
-- Los jugadores escriben SOLO con funciones del servidor (responder, responder_domingo, guardar_ausencia,
-- cerrar_ausencia, borrar_ausencia), que comprueban en la base: interruptor encendido, invitado segun su ficha, evento
-- ni cancelado ni empezado y "no va" con motivo. Leen lo suyo por RLS y los nombres de "quien va" por una vista sin
-- motivos, detalles ni origen. Nadie borra por la API: una ausencia "borrada" queda marcada (borrada_en).
-- Horas: Europe/Madrid.
-- =============================================================================

-- ---------------------------------------------------------------- respuestas: origen, quien la puso, cuando cambio
alter table public.respuestas add column origen text not null default 'sporteasy'
  check (origen in ('sporteasy', 'jugador', 'gestor'));
alter table public.respuestas add column puesto_por uuid;
alter table public.respuestas add column puesto_por_nombre text;
alter table public.respuestas add column cambiado_en timestamptz;
comment on column public.respuestas.origen is 'sporteasy (importada) | jugador (en la web) | gestor ("Responder por el")';

alter table public.respuestas drop constraint respuestas_motivo_check;
alter table public.respuestas add constraint respuestas_motivo_check
  check (motivo in ('lesion', 'trabajo', 'viaje', 'familia', 'otro', 'horario'));
alter table public.respuestas drop constraint respuestas_fuente_check;
alter table public.respuestas add constraint respuestas_fuente_check check (fuente in ('sporteasy', 'web'));

-- ---------------------------------------------------------------- ausencias: sin fecha de vuelta, quien la creo
alter table public.ausencias_periodo alter column hasta drop not null;
alter table public.ausencias_periodo add column detalle text;
alter table public.ausencias_periodo add column origen text not null default 'sporteasy'
  check (origen in ('sporteasy', 'jugador', 'gestor'));
alter table public.ausencias_periodo add column creado_por uuid;
alter table public.ausencias_periodo add column creado_por_nombre text;
alter table public.ausencias_periodo add column creado_en timestamptz not null default now();
alter table public.ausencias_periodo add column cambiado_en timestamptz;
alter table public.ausencias_periodo add column borrada_en timestamptz;
alter table public.ausencias_periodo drop constraint ausencias_periodo_fuente_check;
alter table public.ausencias_periodo add constraint ausencias_periodo_fuente_check check (fuente in ('sporteasy', 'web'));

-- Respuesta puesta por una ausencia: al borrarla (o cerrarla), esos eventos vuelven a "sin responder".
alter table public.respuestas add column ausencia_id uuid references public.ausencias_periodo (id);

-- ---------------------------------------------------------------- eventos: sin recordatorios y ultimo cambio avisado
alter table public.eventos add column sin_recordatorios boolean not null default false;
alter table public.eventos add column cambio_visible jsonb;
alter table public.eventos add column cambio_visible_en timestamptz;
comment on column public.eventos.cambio_visible is
  'Ultimo cambio avisado a los jugadores: {"campos": ["pista","hora"], "antes": "..."}. Lo pinta la linea amarilla del evento.';

-- ---------------------------------------------------------------- interruptor "respuestas en la web" (D99.13)
create table public.respuestas_web_config (
  id                   int primary key default 1 check (id = 1),
  encendido            boolean not null default false,
  encendido_desde      timestamptz,
  sporteasy_comprobado boolean not null default false,
  cambiado_en          timestamptz,
  cambiado_por_nombre  text
);
insert into public.respuestas_web_config (id) values (1);

create table public.respuestas_web_registro (
  id          uuid primary key default gen_random_uuid(),
  en          timestamptz not null default now(),
  por_user_id uuid,
  por_nombre  text not null,
  que         text not null check (que in ('encender', 'apagar', 'sporteasy_comprobado', 'sporteasy_sin_comprobar',
                                           'jornada_limpia', 'jornada_con_arreglo', 'jornada_sin_marcar')),
  detalle     text
);

-- Jornadas "sin arreglos a mano" (D64): las marca Ivan una a una.
create table public.jornadas_control (
  temporada          text not null default '2026-27',
  jornada            int  not null check (jornada > 0),
  estado             text not null check (estado in ('limpia', 'con_arreglo')),
  marcado_por_nombre text,
  marcado_en         timestamptz not null default now(),
  primary key (temporada, jornada)
);

-- Banda roja de Gestion: cambios de un partido despues del martes a las 10:00 (D99.8).
create table public.alertas_gestores (
  id               uuid primary key default gen_random_uuid(),
  evento_id        uuid not null references public.eventos (id),
  person_id        text not null,
  antes            text not null,
  despues          text not null,
  en               timestamptz not null default now(),
  aviso_encolado   boolean not null default false,
  visto_en         timestamptz,
  visto_por_nombre text
);
create index alertas_gestores_evento_idx on public.alertas_gestores (evento_id);

-- ---------------------------------------------------------------- funciones internas
create function public._mi_person_id()
returns text language sql stable security definer set search_path = ''
as $$ select j.person_id from public.jugadores j where j.id = public._mi_jugador() $$;

create function public._respuestas_web_encendido()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce((select encendido from public.respuestas_web_config where id = 1), false) $$;

-- Invitado a un evento segun su ficha (igual que convocadosDe de la web): entreno o "entre nosotros", quien entrena o
-- tiene ficha; partido de MdA o MdL, su ficha; de los dos, cualquiera de las dos.
create function public._invitado(p_person text, p_evento uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.jugadores j join public.eventos e on e.id = p_evento
    where j.person_id = p_person and j.activo
      and case
            when e.tipo in ('entreno', 'interno') then (j.entrena or j.ficha_mda or j.ficha_mdl)
            when e.equipo = 'MdA' then j.ficha_mda
            when e.equipo = 'MdL' then j.ficha_mdl
            else (j.ficha_mda or j.ficha_mdl)
          end)
$$;

-- Inicio del evento en hora de Madrid (sin hora: el principio del dia).
create function public._inicio_evento(p_evento uuid)
returns timestamptz language sql stable security definer set search_path = ''
as $$ select ((e.fecha + coalesce(e.inicio, time '00:00')) at time zone 'Europe/Madrid') from public.eventos e where e.id = p_evento $$;

create function public._evento_abierto(p_evento uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.eventos e where e.id = p_evento and e.estado = 'programado')
     and public._inicio_evento(p_evento) > now()
$$;

-- Escribe (o cambia) una respuesta y devuelve la anterior ('sin_responder' si no habia).
create function public._escribir_respuesta(p_evento uuid, p_person text, p_respuesta text, p_motivo text, p_detalle text,
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

-- Un jugador cambia un partido despues del martes a las 10:00 de esa semana (la convocatoria ya esta hecha): alerta a
-- los gestores (banda roja y aviso al movil, que encola la tarea de avisos con las horas de silencio).
create function public._tras_cambio_jugador(p_evento uuid, p_person text, p_antes text, p_despues text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  e public.eventos;
begin
  if p_antes is not distinct from p_despues then return false; end if;
  select * into e from public.eventos where id = p_evento;
  if e.tipo <> 'liga' then return false; end if;
  -- martes de la semana del partido (lunes = fecha - (isodow - 1)) a las 10:00 de Madrid
  if now() < (((e.fecha - (extract(isodow from e.fecha)::int - 1) + 1) + time '10:00') at time zone 'Europe/Madrid') then
    return false;
  end if;
  insert into public.alertas_gestores (evento_id, person_id, antes, despues) values (p_evento, p_person, p_antes, p_despues);
  return true;
end $$;

-- Periodo activo de una persona que cubre una fecha (el mas reciente).
create function public._ausencia_que_cubre(p_person text, p_fecha date)
returns uuid language sql stable security definer set search_path = ''
as $$
  select a.id from public.ausencias_periodo a
  where a.person_id = p_person and a.borrada_en is null and a.desde <= p_fecha and (a.hasta is null or a.hasta >= p_fecha)
  order by a.creado_en desc limit 1
$$;

-- Aplica los periodos de ausencia a un evento abierto: quien tenga uno que lo cubre queda "no" con su motivo.
create function public._aplicar_ausencias_evento(p_evento uuid)
returns int language plpgsql security definer set search_path = ''
as $$
declare
  e public.eventos;
  a record;
  n int := 0;
begin
  select * into e from public.eventos where id = p_evento;
  if e.id is null or not public._evento_abierto(p_evento) then return 0; end if;
  for a in
    select distinct on (ap.person_id) ap.*
    from public.ausencias_periodo ap
    where ap.borrada_en is null and ap.desde <= e.fecha and (ap.hasta is null or ap.hasta >= e.fecha)
      and public._invitado(ap.person_id, p_evento)
    order by ap.person_id, ap.creado_en desc
  loop
    perform public._escribir_respuesta(p_evento, a.person_id, 'no', a.motivo, a.detalle, a.origen, a.creado_por,
                                       a.creado_por_nombre, a.id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Al quitar (o acortar) un periodo: sus eventos abiertos fuera del periodo vuelven a "sin responder" (y si otro
-- periodo los cubre, se le aplica ese).
create function public._soltar_ausencia(p_ausencia uuid)
returns int language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  v_otra uuid;
  n int := 0;
begin
  for r in
    select rs.evento_id, rs.person_id, ev.fecha from public.respuestas rs
    join public.eventos ev on ev.id = rs.evento_id
    join public.ausencias_periodo ap on ap.id = rs.ausencia_id
    where rs.ausencia_id = p_ausencia
      and (ap.borrada_en is not null or ev.fecha < ap.desde or (ap.hasta is not null and ev.fecha > ap.hasta))
  loop
    if not public._evento_abierto(r.evento_id) then continue; end if;
    v_otra := public._ausencia_que_cubre(r.person_id, r.fecha);
    if v_otra is not null and v_otra <> p_ausencia then
      perform public._escribir_respuesta(r.evento_id, r.person_id, 'no', a.motivo, a.detalle, a.origen, a.creado_por,
                                         a.creado_por_nombre, a.id)
      from public.ausencias_periodo a where a.id = v_otra;
    else
      update public.respuestas set respuesta = 'sin_responder', motivo = null, detalle = null, ausencia_id = null,
             cambiado_en = now()
       where evento_id = r.evento_id and person_id = r.person_id;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------- eventos nuevos o con otro dia (D99.4, D99.9)
-- Con el interruptor encendido: un evento nuevo recibe las ausencias que lo cubren; si cambia el DIA, todas sus
-- respuestas vuelven a "sin responder" y se vuelven a aplicar las ausencias. Apagado no se toca nada (fase puente:
-- las respuestas vienen de SportEasy).
create function public._eventos_tras_escribir()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if not public._respuestas_web_encendido() then return null; end if;
  if tg_op = 'UPDATE' then
    if new.fecha is not distinct from old.fecha then return null; end if;
    update public.respuestas set respuesta = 'sin_responder', motivo = null, detalle = null, ausencia_id = null,
           cambiado_en = now()
     where evento_id = new.id and respuesta <> 'sin_responder';
  end if;
  perform public._aplicar_ausencias_evento(new.id);
  return null;
end $$;
create trigger eventos_tras_escribir after insert or update of fecha on public.eventos
  for each row execute function public._eventos_tras_escribir();

-- ---------------------------------------------------------------- funciones del jugador
create function public._exigir_jugador()
returns text language plpgsql stable security definer set search_path = ''
as $$
declare v text := public._mi_person_id();
begin
  if v is null then raise exception 'sin_ficha' using errcode = 'P0001'; end if;
  return v;
end $$;

create function public._exigir_encendido()
returns void language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public._respuestas_web_encendido() then raise exception 'respuestas_apagadas' using errcode = 'P0001'; end if;
end $$;

create function public._validar_respuesta(p_respuesta text, p_motivo text)
returns void language plpgsql immutable set search_path = ''
as $$
begin
  if p_respuesta not in ('va', 'duda', 'no') then raise exception 'respuesta_no_valida' using errcode = 'P0001'; end if;
  if p_respuesta = 'no' and (p_motivo is null or p_motivo not in ('lesion', 'trabajo', 'viaje', 'familia', 'otro')) then
    raise exception 'falta_motivo' using errcode = 'P0001';
  end if;
end $$;

/** Responder a UN evento: va | duda | no (con motivo). Devuelve {antes, despues, alerta}. */
create function public.responder(p_evento uuid, p_respuesta text, p_motivo text default null, p_detalle text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_person text := public._exigir_jugador();
  v_antes text;
  v_alerta boolean;
begin
  perform public._exigir_encendido();
  if not public._invitado(v_person, p_evento) then raise exception 'no_invitado' using errcode = 'P0001'; end if;
  if not public._evento_abierto(p_evento) then raise exception 'evento_cerrado' using errcode = 'P0001'; end if;
  perform public._validar_respuesta(p_respuesta, p_motivo);
  v_antes := public._escribir_respuesta(p_evento, v_person, p_respuesta,
               case when p_respuesta = 'no' then p_motivo end, case when p_respuesta = 'no' then p_detalle end,
               'jugador', auth.uid(), null, null);
  v_alerta := public._tras_cambio_jugador(p_evento, v_person, v_antes, p_respuesta);
  return jsonb_build_object('antes', v_antes, 'despues', p_respuesta, 'alerta', v_alerta);
end $$;

/** Una sola respuesta por domingo (D99.3). p_opcion: 'ambos' | 'solo' (con p_evento) | 'voy' | 'no' | 'duda'.
 *  Se guarda por evento: con "solo al de las HH:MM", el otro partido queda "no" con el motivo interno 'horario'. */
create function public._responder_domingo_de(v_person text, p_fecha date, p_opcion text, p_evento uuid, p_motivo text,
                                             p_detalle text, p_origen text, p_por_nombre text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_ids uuid[];
  v_inicios time[];
  v_id uuid;
  v_resp text;
  v_mot text;
  v_det text;
  v_antes text;
  v_alertas int := 0;
begin
  select array_agg(e.id order by e.inicio nulls last, e.equipo), array_agg(e.inicio order by e.inicio nulls last, e.equipo)
    into v_ids, v_inicios
  from public.eventos e
  where e.fecha = p_fecha and e.tipo = 'liga' and e.estado = 'programado' and public._invitado(v_person, e.id);
  if v_ids is null then raise exception 'no_invitado' using errcode = 'P0001'; end if;
  foreach v_id in array v_ids loop
    if not public._evento_abierto(v_id) then raise exception 'evento_cerrado' using errcode = 'P0001'; end if;
  end loop;
  -- Que opciones valen: dos partidos a horas distintas -> ambos | solo | no | duda; si no -> voy | no | duda.
  if array_length(v_ids, 1) = 2 and v_inicios[1] is distinct from v_inicios[2] then
    if p_opcion not in ('ambos', 'solo', 'no', 'duda') then raise exception 'opcion_no_valida' using errcode = 'P0001'; end if;
    if p_opcion = 'solo' and (p_evento is null or not (p_evento = any (v_ids))) then
      raise exception 'opcion_no_valida' using errcode = 'P0001';
    end if;
  elsif p_opcion not in ('voy', 'no', 'duda') then
    raise exception 'opcion_no_valida' using errcode = 'P0001';
  end if;
  if p_opcion = 'no' then perform public._validar_respuesta('no', p_motivo); end if;

  foreach v_id in array v_ids loop
    v_mot := null; v_det := null;
    if p_opcion in ('ambos', 'voy') then v_resp := 'va';
    elsif p_opcion = 'duda' then v_resp := 'duda';
    elsif p_opcion = 'no' then v_resp := 'no'; v_mot := p_motivo; v_det := p_detalle;
    elsif v_id = p_evento then v_resp := 'va';
    else v_resp := 'no'; v_mot := 'horario';
    end if;
    v_antes := public._escribir_respuesta(v_id, v_person, v_resp, v_mot, v_det, p_origen, auth.uid(), p_por_nombre, null);
    if p_origen = 'jugador' and public._tras_cambio_jugador(v_id, v_person, v_antes, v_resp) then v_alertas := v_alertas + 1; end if;
  end loop;
  return jsonb_build_object('eventos', to_jsonb(v_ids), 'alertas', v_alertas);
end $$;

create function public.responder_domingo(p_fecha date, p_opcion text, p_evento uuid default null,
                                         p_motivo text default null, p_detalle text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_person text := public._exigir_jugador();
begin
  perform public._exigir_encendido();
  return public._responder_domingo_de(v_person, p_fecha, p_opcion, p_evento, p_motivo, p_detalle, 'jugador', null);
end $$;

/** "Responder por el" en la vista de domingo de Gestion: la misma respuesta unica, puesta por un gestor. */
create function public.responder_domingo_por(p_fecha date, p_person text, p_opcion text, p_evento uuid default null,
                                             p_motivo text default null, p_detalle text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_nombre text;
begin
  if not public.is_gestor() then raise exception 'solo_gestores' using errcode = 'P0001'; end if;
  select nombre into v_nombre from public.gestores where user_id = auth.uid();
  return public._responder_domingo_de(p_person, p_fecha, p_opcion, p_evento, p_motivo, p_detalle, 'gestor', v_nombre);
end $$;

-- Eventos abiertos a los que esta invitado que cubre un periodo (para el resumen antes de guardar).
create function public._eventos_del_periodo(p_person text, p_desde date, p_hasta date)
returns setof public.eventos language sql stable security definer set search_path = ''
as $$
  select e.* from public.eventos e
  where e.estado = 'programado' and e.fecha >= p_desde and (p_hasta is null or e.fecha <= p_hasta)
    and public._invitado(p_person, e.id) and public._evento_abierto(e.id)
  order by e.fecha, e.inicio
$$;

/** Resumen antes de guardar: los eventos que quedaran en "no voy" y en cuales tenia "voy". No escribe nada. */
create function public.previsualizar_ausencia(p_desde date, p_hasta date default null)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_person text := public._exigir_jugador();
begin
  perform public._exigir_encendido();
  if p_desde is null or (p_hasta is not null and p_hasta < p_desde) then raise exception 'fechas_no_validas' using errcode = 'P0001'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', e.id, 'tipo', e.tipo, 'equipo', e.equipo, 'titulo', e.titulo, 'rival', e.rival,
                                        'es_local', e.es_local, 'fecha', e.fecha, 'inicio', e.inicio,
                                        'respuesta', coalesce(r.respuesta, 'sin_responder')) order by e.fecha, e.inicio)
    from public._eventos_del_periodo(v_person, p_desde, p_hasta) e
    left join public.respuestas r on r.evento_id = e.id and r.person_id = v_person), '[]'::jsonb);
end $$;

/** Crea o cambia un periodo de no disponibilidad (p_hasta vacio = sin fecha de vuelta). */
create function public.guardar_ausencia(p_id uuid, p_desde date, p_hasta date, p_motivo text, p_detalle text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_person text := public._exigir_jugador();
  v_id uuid;
  e record;
  v_antes text;
  n int := 0;
begin
  perform public._exigir_encendido();
  if p_desde is null or (p_hasta is not null and p_hasta < p_desde) then raise exception 'fechas_no_validas' using errcode = 'P0001'; end if;
  perform public._validar_respuesta('no', p_motivo);
  if p_id is not null then
    update public.ausencias_periodo set desde = p_desde, hasta = p_hasta, motivo = p_motivo,
           detalle = nullif(btrim(coalesce(p_detalle, '')), ''), cambiado_en = now()
     where id = p_id and person_id = v_person and borrada_en is null
     returning id into v_id;
    if v_id is null then raise exception 'ausencia_no_encontrada' using errcode = 'P0001'; end if;
    perform public._soltar_ausencia(v_id);
  else
    -- La misma franja borrada antes se reutiliza (una por persona, desde y hasta).
    update public.ausencias_periodo set borrada_en = null, motivo = p_motivo, detalle = nullif(btrim(coalesce(p_detalle, '')), ''),
           origen = 'jugador', fuente = 'web', creado_por = auth.uid(), creado_por_nombre = null, cambiado_en = now()
     where person_id = v_person and desde = p_desde and hasta is not distinct from p_hasta
     returning id into v_id;
    if v_id is null then
      insert into public.ausencias_periodo (person_id, desde, hasta, motivo, detalle, fuente, origen, creado_por)
      values (v_person, p_desde, p_hasta, p_motivo, nullif(btrim(coalesce(p_detalle, '')), ''), 'web', 'jugador', auth.uid())
      returning id into v_id;
    end if;
  end if;
  for e in select * from public._eventos_del_periodo(v_person, p_desde, p_hasta) loop
    v_antes := public._escribir_respuesta(e.id, v_person, 'no', p_motivo, p_detalle, 'jugador', auth.uid(), null, v_id);
    perform public._tras_cambio_jugador(e.id, v_person, v_antes, 'no');
    n := n + 1;
  end loop;
  return jsonb_build_object('id', v_id, 'eventos', n);
end $$;

/** "Ya puedo volver": cierra un periodo sin fecha de vuelta. Puede volver desde hoy: el ultimo dia ausente es ayer (si
 *  el periodo aun no habia empezado, se quita). Los eventos que quedan fuera vuelven a "sin responder". */
create function public.cerrar_ausencia(p_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_person text := public._exigir_jugador();
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  a public.ausencias_periodo;
begin
  perform public._exigir_encendido();
  select * into a from public.ausencias_periodo where id = p_id and person_id = v_person and borrada_en is null;
  if a.id is null then raise exception 'ausencia_no_encontrada' using errcode = 'P0001'; end if;
  if a.desde <= v_hoy - 1 then
    update public.ausencias_periodo set hasta = v_hoy - 1, cambiado_en = now() where id = p_id;
  else
    update public.ausencias_periodo set borrada_en = now() where id = p_id;
  end if;
  return jsonb_build_object('eventos', public._soltar_ausencia(p_id));
end $$;

/** Quita un periodo (queda marcado como borrado): sus eventos abiertos vuelven a "sin responder". */
create function public.borrar_ausencia(p_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_person text := public._exigir_jugador();
  v_id uuid;
begin
  perform public._exigir_encendido();
  update public.ausencias_periodo set borrada_en = now() where id = p_id and person_id = v_person and borrada_en is null
  returning id into v_id;
  if v_id is null then raise exception 'ausencia_no_encontrada' using errcode = 'P0001'; end if;
  return jsonb_build_object('eventos', public._soltar_ausencia(v_id));
end $$;

/** Estado del interruptor (lo lee la web para mostrar o no los botones; la base lo vuelve a comprobar). */
create function public.respuestas_web_encendido()
returns boolean language sql stable security definer set search_path = ''
as $$ select public._respuestas_web_encendido() $$;

-- ---------------------------------------------------------------- funciones de los gestores
/** "Responder por el": un gestor pone la respuesta de un jugador; queda quien la puso. */
create function public.responder_por(p_evento uuid, p_person text, p_respuesta text, p_motivo text default null,
                                     p_detalle text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_nombre text;
  v_antes text;
begin
  if not public.is_gestor() then raise exception 'solo_gestores' using errcode = 'P0001'; end if;
  if not public._invitado(p_person, p_evento) then raise exception 'no_invitado' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.eventos where id = p_evento and estado = 'programado') then
    raise exception 'evento_cerrado' using errcode = 'P0001';
  end if;
  perform public._validar_respuesta(p_respuesta, p_motivo);
  select nombre into v_nombre from public.gestores where user_id = auth.uid();
  v_antes := public._escribir_respuesta(p_evento, p_person, p_respuesta,
               case when p_respuesta = 'no' then p_motivo end, case when p_respuesta = 'no' then p_detalle end,
               'gestor', auth.uid(), v_nombre, null);
  return jsonb_build_object('antes', v_antes, 'despues', p_respuesta);
end $$;

-- ---------------------------------------------------------------- lo que lee el jugador
-- Las dos vistas leen de funciones "security definer" que SOLO devuelven lo de quien consulta (sus eventos; los nombres
-- de los invitados a sus eventos). Asi el jugador no necesita permiso sobre ninguna funcion interna.

-- Sus eventos (a los que esta invitado), con lo publico del evento, el id y la direccion de la pista. Sin respuestas
-- ajenas, sin estado de SportEasy, sin datos personales.
create function public._mis_eventos()
returns table (id uuid, clave text, temporada text, tipo text, equipo text, titulo text, jornada int, rival text,
               es_local boolean, fecha date, inicio time, fin time, quedada time, notas text, estado text,
               cambio_visible jsonb, cambio_visible_en timestamptz, pista_nombre text, pista_nombre_corto text,
               pista_direccion text, numero_pista int, pista_por_confirmar boolean, pista_motivo text)
language sql stable security definer set search_path = ''
as $$
  select
    e.id, e.clave, e.temporada, e.tipo, e.equipo, e.titulo, e.jornada, e.rival, e.es_local, e.fecha, e.inicio, e.fin,
    e.quedada, e.notas, e.estado, e.cambio_visible, e.cambio_visible_en,
    case when p.id is not null then p.nombre when ps.estado = 'habitual' then ps.nombre else null end,
    case when p.id is not null then p.nombre_corto when ps.estado = 'habitual' then ps.nombre_corto else null end,
    case when p.id is not null then p.direccion when ps.estado = 'habitual' then ps.direccion else null end,
    case when p.id is not null then e.numero_pista else null end,
    (p.id is null and (e.tipo <> 'entreno' or ps.id is null or ps.estado <> 'habitual')),
    case when p.id is null and e.tipo = 'entreno' and ps.id is not null and ps.estado = 'en_obras'
         then split_part(ps.nombre, ' (', 1) || ' en obras' else null end
  from public.eventos e
  left join public.pistas p  on p.id = e.pista_id
  left join public.pistas ps on e.pista_id is null and e.tipo = 'entreno' and ps.es_de_serie and ps.uso = 'entreno'
  where public._invitado(public._mi_person_id(), e.id)
$$;
create view public.v_mis_eventos as select * from public._mis_eventos();

-- "Quien va" de sus eventos: SOLO nombre y estado (D46, D82). Un periodo de ausencia que cubre el dia cuenta como "no".
create function public._quien_va()
returns table (evento_id uuid, nombre text, estado text)
language sql stable security definer set search_path = ''
as $$
  select e.id, j.nombre_visible,
         case when coalesce(r.respuesta, 'sin_responder') = 'sin_responder'
                   and public._ausencia_que_cubre(j.person_id, e.fecha) is not null then 'no'
              else coalesce(r.respuesta, 'sin_responder') end
  from public.eventos e
  join public.jugadores j on public._invitado(j.person_id, e.id)
  left join public.respuestas r on r.evento_id = e.id and r.person_id = j.person_id
  where public._invitado(public._mi_person_id(), e.id)
$$;
create view public.v_quien_va as select * from public._quien_va();

-- ---------------------------------------------------------------- RLS
alter table public.respuestas_web_config   enable row level security;
alter table public.respuestas_web_registro enable row level security;
alter table public.jornadas_control        enable row level security;
alter table public.alertas_gestores        enable row level security;

create policy jugador_lee_las_suyas on public.respuestas for select to authenticated
  using (person_id = public._mi_person_id());
create policy jugador_lee_las_suyas on public.ausencias_periodo for select to authenticated
  using (person_id = public._mi_person_id());

create policy gestores_leen    on public.respuestas_web_config for select to authenticated using (public.is_gestor());
create policy gestores_cambian on public.respuestas_web_config for update to authenticated using (public.is_gestor()) with check (public.is_gestor());
create policy gestores_leen     on public.respuestas_web_registro for select to authenticated using (public.is_gestor());
create policy gestores_insertan on public.respuestas_web_registro for insert to authenticated with check (public.is_gestor());
create policy gestores_leen     on public.jornadas_control for select to authenticated using (public.is_gestor());
create policy gestores_insertan on public.jornadas_control for insert to authenticated with check (public.is_gestor());
create policy gestores_cambian  on public.jornadas_control for update to authenticated using (public.is_gestor()) with check (public.is_gestor());
create policy gestores_leen     on public.alertas_gestores for select to authenticated using (public.is_gestor());
create policy gestores_cambian  on public.alertas_gestores for update to authenticated using (public.is_gestor()) with check (public.is_gestor());

revoke all on public.respuestas_web_config, public.respuestas_web_registro, public.jornadas_control, public.alertas_gestores
  from anon, authenticated, public;
grant select, update on public.respuestas_web_config to authenticated;
grant select, insert on public.respuestas_web_registro to authenticated;
grant select, insert, update on public.jornadas_control to authenticated;
grant select, update on public.alertas_gestores to authenticated;

revoke all on public.v_mis_eventos, public.v_quien_va from anon, authenticated, public;
grant select on public.v_mis_eventos, public.v_quien_va to authenticated;

-- Funciones: nada para anon. Los jugadores, solo las suyas; las internas (con "_"), nadie desde la API.
revoke execute on function
  public._mi_person_id(), public._respuestas_web_encendido(), public._invitado(text, uuid), public._inicio_evento(uuid),
  public._evento_abierto(uuid), public._escribir_respuesta(uuid, text, text, text, text, text, uuid, text, uuid),
  public._tras_cambio_jugador(uuid, text, text, text), public._ausencia_que_cubre(text, date),
  public._aplicar_ausencias_evento(uuid), public._soltar_ausencia(uuid), public._eventos_tras_escribir(),
  public._exigir_jugador(), public._exigir_encendido(), public._validar_respuesta(text, text),
  public._eventos_del_periodo(text, date, date),
  public._responder_domingo_de(text, date, text, uuid, text, text, text, text), public.responder_domingo_por(date, text, text, uuid, text, text),
  public.responder(uuid, text, text, text), public.responder_domingo(date, text, uuid, text, text),
  public.previsualizar_ausencia(date, date), public.guardar_ausencia(uuid, date, date, text, text),
  public.cerrar_ausencia(uuid), public.borrar_ausencia(uuid), public.respuestas_web_encendido(),
  public.responder_por(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function
  public.responder(uuid, text, text, text), public.responder_domingo(date, text, uuid, text, text),
  public.previsualizar_ausencia(date, date), public.guardar_ausencia(uuid, date, date, text, text),
  public.cerrar_ausencia(uuid), public.borrar_ausencia(uuid), public.respuestas_web_encendido(),
  public.responder_por(uuid, text, text, text, text), public.responder_domingo_por(date, text, text, uuid, text, text)
  to authenticated;
-- Las politicas "lo suyo" se evaluan con el rol de quien consulta: necesita poder saber su propio person_id (solo
-- devuelve el suyo; nada de otros).
grant execute on function public._mi_person_id() to authenticated;
-- Las dos vistas del jugador leen de estas (solo devuelven lo de quien consulta).
revoke execute on function public._mis_eventos(), public._quien_va() from public, anon, authenticated;
grant execute on function public._mis_eventos(), public._quien_va() to authenticated;
