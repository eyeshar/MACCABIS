-- =============================================================================
-- Inicio personal y planes (D117-D122): un solo paso en el Supabase real (D111).
--
-- SOLO ADITIVA (D111): columnas, tablas, vistas, politicas y funciones nuevas. Lo unico que cambia de lo existente, sin
-- perder ningun dato (la reversion lo deja como estaba):
--   - el check de eventos.tipo admite ademas 'quedada', 'pachanga' y 'otro' (relajacion);
--   - v_eventos_publicos deja fuera los planes no oficiales (todo lo que ya existe es oficial: no cambia nada de lo que
--     se ve hoy);
--   - _invitado: los planes no oficiales y los tipos nuevos invitan segun «para quien» (D118);
--   - las tres pistas del catalogo reciben sus coordenadas (columnas nuevas, de OpenStreetMap).
-- Reversion al lado: 20261024200000_inicio_y_planes.revertir.sql (db:migrar nunca la aplica).
--
--  B (D118) planes no oficiales: eventos.oficial (todo lo que existe, true), creado_por, plazas, recordar_un_dia_antes,
--     rival_texto, borrado_en; los jugadores escriben SOLO con funciones (crear_plan, editar_plan, cancelar_plan,
--     responder_plan) y los gestores ademas borrar_plan y hacer_oficial. avisos_personales: lo que le queda en el inicio
--     al organizador cuando un gestor toca su plan.
--  C (D119) ubicacion: eventos.ubicacion_* (nombre, direccion, lat, lng, enlace) y pistas.lat / pistas.lng.
--  D (D120) calendario personal: calendario_tokens (solo el HASH del enlace) y calendario_personal(token), la unica
--     funcion que puede llamar anon: devuelve SOLO los eventos de esa persona, sin nada de nadie mas.
--  E (D121) tablero: tablero_responder / tablero_deshacer (funcionan con el interruptor apagado), tablero_registro y
--     respuestas.sporteasy_descartado (una importacion no pisa un cambio de gestor: sale como conflicto).
--  F (D122) grupos de entreno: grupos_repartos (solo gestores) y mis_grupos() (el jugador: SOLO su grupo publicado).
-- Horas: Europe/Madrid.
-- =============================================================================

-- ---------------------------------------------------------------- eventos: tipos nuevos, planes y ubicacion
alter table public.eventos drop constraint eventos_tipo_check;
alter table public.eventos add constraint eventos_tipo_check
  check (tipo in ('entreno', 'liga', 'amistoso', 'torneo', 'interno', 'quedada', 'pachanga', 'otro'));

alter table public.eventos add column oficial boolean not null default true;
alter table public.eventos add column creado_por text;
alter table public.eventos add column plazas int check (plazas is null or plazas between 2 and 60);
alter table public.eventos add column recordar_un_dia_antes boolean not null default false;
alter table public.eventos add column rival_texto text check (rival_texto is null or length(rival_texto) <= 80);
alter table public.eventos add column borrado_en timestamptz;
alter table public.eventos add column borrado_por_nombre text;
alter table public.eventos add column ubicacion_nombre text check (ubicacion_nombre is null or length(ubicacion_nombre) <= 120);
alter table public.eventos add column ubicacion_direccion text check (ubicacion_direccion is null or length(ubicacion_direccion) <= 240);
alter table public.eventos add column ubicacion_lat double precision check (ubicacion_lat is null or ubicacion_lat between -90 and 90);
alter table public.eventos add column ubicacion_lng double precision check (ubicacion_lng is null or ubicacion_lng between -180 and 180);
alter table public.eventos add column ubicacion_enlace text check (ubicacion_enlace is null or (ubicacion_enlace ~ '^https://' and length(ubicacion_enlace) <= 500));
-- SEQUENCE del calendario personal (D120): sube en cada cambio que se ve en el calendario.
alter table public.eventos add column secuencia int not null default 0;
alter table public.eventos add constraint plan_con_organizador check (oficial or creado_por is not null);
comment on column public.eventos.oficial is 'false = plan no oficial de un jugador (D118): no cuenta para nada del club ni sale en lo publico.';
comment on column public.eventos.creado_por is 'person_id de quien propuso el plan (D118).';

alter table public.pistas add column lat double precision check (lat is null or lat between -90 and 90);
alter table public.pistas add column lng double precision check (lng is null or lng between -180 and 180);
-- Coordenadas de OpenStreetMap (24/10/2026): CDM Moratalaz (C/ Arroyo Fontarron), CDM Faustina Valladolid
-- (Valdebernardo) y Caja Magica (Estadio Manolo Santana, Camino de Perales 23).
update public.pistas set lat = 40.3975133, lng = -3.6315708 where slug = 'cdm-moratalaz' and lat is null;
update public.pistas set lat = 40.4047802, lng = -3.6219452 where slug = 'valdebernardo' and lat is null;
update public.pistas set lat = 40.3686417, lng = -3.6843345 where slug = 'caja-magica' and lat is null;

create function public._eventos_secuencia()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if (new.tipo, new.titulo, new.rival, new.rival_texto, new.es_local, new.fecha, new.inicio, new.fin, new.quedada,
      new.pista_id, new.numero_pista, new.notas, new.estado, new.ubicacion_nombre, new.ubicacion_direccion,
      new.ubicacion_lat, new.ubicacion_lng, new.ubicacion_enlace, new.borrado_en, new.equipo)
     is distinct from
     (old.tipo, old.titulo, old.rival, old.rival_texto, old.es_local, old.fecha, old.inicio, old.fin, old.quedada,
      old.pista_id, old.numero_pista, old.notas, old.estado, old.ubicacion_nombre, old.ubicacion_direccion,
      old.ubicacion_lat, old.ubicacion_lng, old.ubicacion_enlace, old.borrado_en, old.equipo) then
    new.secuencia := old.secuencia + 1;
    new.actualizado_en := now();
  end if;
  return new;
end $$;
create trigger eventos_secuencia before update on public.eventos
  for each row execute function public._eventos_secuencia();
revoke all on function public._eventos_secuencia() from public, anon, authenticated;

-- ---------------------------------------------------------------- lo publico: sin planes no oficiales
create or replace view public.v_eventos_publicos as
select
  e.clave, e.temporada, e.tipo, e.equipo, e.titulo, e.jornada, e.rival, e.es_local,
  e.fecha, e.inicio, e.fin, e.quedada, e.notas, e.estado,
  case when p.id is not null then p.nombre when ps.estado = 'habitual' then ps.nombre else null end as pista_nombre,
  case when p.id is not null then p.nombre_corto when ps.estado = 'habitual' then ps.nombre_corto else null end as pista_nombre_corto,
  case when p.id is not null then e.numero_pista else null end as numero_pista,
  (p.id is null and (e.tipo <> 'entreno' or ps.id is null or ps.estado <> 'habitual')) as pista_por_confirmar,
  case when p.id is null and e.tipo = 'entreno' and ps.id is not null and ps.estado = 'en_obras'
       then split_part(ps.nombre, ' (', 1) || ' en obras' else null end as pista_motivo
from public.eventos e
left join public.pistas p  on p.id = e.pista_id
left join public.pistas ps on e.pista_id is null and e.tipo = 'entreno' and ps.es_de_serie and ps.uso = 'entreno'
where e.oficial and e.borrado_en is null;

-- ---------------------------------------------------------------- quien esta invitado (D105 + D118)
-- Igual que antes para todo lo que ya existe. Planes no oficiales y tipos nuevos (quedada, pachanga, otro): «para
-- quien» = toda la plantilla (quien entrena o tiene ficha), solo MdA o solo MdL. La web tiene la misma definicion
-- (quienResponde en lib/respuestas/dominio.ts).
create or replace function public._invitado(p_person text, p_evento uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.jugadores j join public.eventos e on e.id = p_evento
    where j.person_id = p_person and j.activo and j.rol <> 'entrenador'
      and case
            when not e.oficial or e.tipo in ('quedada', 'pachanga', 'otro') then
              case e.equipo when 'MdA' then j.ficha_mda when 'MdL' then j.ficha_mdl else (j.entrena or j.ficha_mda or j.ficha_mdl) end
            when e.tipo in ('entreno', 'interno') then (j.entrena or j.ficha_mda or j.ficha_mdl)
            when j.rol = 'solo_entreno' then false
            when e.equipo = 'MdA' then j.ficha_mda
            when e.equipo = 'MdL' then j.ficha_mdl
            else (j.ficha_mda or j.ficha_mdl)
          end)
$$;

-- ---------------------------------------------------------------- lo que lee el jugador: su agenda (oficiales y planes)
-- Ubicacion efectiva: la pista del evento (o la de la serie si esta habitual, como en v_mis_eventos) o la ubicacion
-- libre. Sin respuestas ajenas, sin estado de SportEasy, sin datos personales (el organizador de un plan: su mote).
create function public._mi_agenda()
returns table (id uuid, clave text, temporada text, tipo text, equipo text, titulo text, jornada int, rival text,
               rival_texto text, es_local boolean, fecha date, inicio time, fin time, quedada time, notas text, estado text,
               cambio_visible jsonb, cambio_visible_en timestamptz, oficial boolean, creado_por text, organizador text,
               es_mio boolean, plazas int, recordar_un_dia_antes boolean, pista_nombre text, pista_nombre_corto text,
               pista_direccion text, numero_pista int, pista_por_confirmar boolean, pista_motivo text,
               lugar_nombre text, lugar_direccion text, lugar_lat double precision, lugar_lng double precision,
               lugar_enlace text, secuencia int, actualizado_en timestamptz)
language sql stable security definer set search_path = ''
as $$
  select
    e.id, e.clave, e.temporada, e.tipo, e.equipo, e.titulo, e.jornada, e.rival, e.rival_texto, e.es_local, e.fecha,
    e.inicio, e.fin, e.quedada, e.notas, e.estado, e.cambio_visible, e.cambio_visible_en, e.oficial, e.creado_por,
    (select o.nombre_visible from public.jugadores o where o.person_id = e.creado_por),
    (e.creado_por is not null and e.creado_por = public._mi_person_id()), e.plazas, e.recordar_un_dia_antes,
    pe.nombre, pe.nombre_corto, pe.direccion, case when p.id is not null then e.numero_pista end,
    (pe.id is null and e.ubicacion_nombre is null and e.ubicacion_lat is null and e.ubicacion_enlace is null),
    case when p.id is null and e.tipo = 'entreno' and ps.id is not null and ps.estado = 'en_obras'
         then split_part(ps.nombre, ' (', 1) || ' en obras' end,
    coalesce(pe.nombre_corto, pe.nombre, e.ubicacion_nombre), coalesce(pe.direccion, e.ubicacion_direccion),
    coalesce(pe.lat, e.ubicacion_lat), coalesce(pe.lng, e.ubicacion_lng), case when pe.id is null then e.ubicacion_enlace end,
    e.secuencia, e.actualizado_en
  from public.eventos e
  left join public.pistas p  on p.id = e.pista_id
  left join public.pistas ps on e.pista_id is null and e.tipo = 'entreno' and ps.es_de_serie and ps.uso = 'entreno'
  left join lateral (select x.* from public.pistas x
                     where x.id = coalesce(p.id, case when ps.estado = 'habitual' then ps.id end)) pe on true
  where e.borrado_en is null and public._invitado(public._mi_person_id(), e.id)
$$;
create view public.v_mi_agenda as select * from public._mi_agenda();

-- ---------------------------------------------------------------- su posicion, para el saludo del inicio (D117)
/** SOLO la posicion de quien consulta (la suya). Ni su nivel ni nada de nadie mas (D39). */
create function public.mi_posicion()
returns text language sql stable security definer set search_path = ''
as $$ select p.posicion from public.jugadores_privado p where p.person_id = public._mi_person_id() $$;

-- ---------------------------------------------------------------- avisos que quedan en el inicio (D118)
create table public.avisos_personales (
  id         uuid primary key default gen_random_uuid(),
  person_id  text not null,
  texto      text not null,
  url        text not null default '/',
  creado_en  timestamptz not null default now(),
  visto_en   timestamptz
);
create index avisos_personales_persona_idx on public.avisos_personales (person_id) where visto_en is null;

-- ---------------------------------------------------------------- planes no oficiales (D118)
create function public._plan_valido(p jsonb, p_es_gestor boolean)
returns void language plpgsql immutable set search_path = ''
as $$
begin
  if coalesce(p ->> 'tipo', '') not in ('quedada', 'pachanga', 'amistoso', 'otro') then
    raise exception 'tipo_no_valido' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p ->> 'titulo', ''))) < 3 or length(p ->> 'titulo') > 80 then
    raise exception 'falta_titulo' using errcode = 'P0001';
  end if;
  if coalesce(p ->> 'equipo', 'ambos') not in ('ambos', 'MdA', 'MdL') then
    raise exception 'para_quien_no_valido' using errcode = 'P0001';
  end if;
  if (p ->> 'fecha') is null then raise exception 'falta_fecha' using errcode = 'P0001'; end if;
  if (p ->> 'inicio') is null then raise exception 'falta_hora' using errcode = 'P0001'; end if;
  if (p ->> 'plazas') is not null and ((p ->> 'plazas')::int < 2 or (p ->> 'plazas')::int > 60) then
    raise exception 'plazas_no_validas' using errcode = 'P0001';
  end if;
  if length(coalesce(p ->> 'notas', '')) > 300 then raise exception 'nota_larga' using errcode = 'P0001'; end if;
end $$;

-- Campos de un plan desde el jsonb del formulario (lo que no viene, null).
create function public._plan_aplicar(p_id uuid, p jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.eventos set
    tipo = p ->> 'tipo', equipo = coalesce(p ->> 'equipo', 'ambos'), titulo = btrim(p ->> 'titulo'),
    fecha = (p ->> 'fecha')::date, inicio = (p ->> 'inicio')::time, fin = (p ->> 'fin')::time,
    quedada = coalesce((p ->> 'quedada')::time, (p ->> 'inicio')::time - interval '20 minutes'),
    rival_texto = case when p ->> 'tipo' = 'amistoso' then nullif(btrim(coalesce(p ->> 'rival_texto', '')), '') end,
    plazas = (p ->> 'plazas')::int, recordar_un_dia_antes = coalesce((p ->> 'recordar')::boolean, false),
    notas = nullif(btrim(coalesce(p ->> 'notas', '')), ''),
    pista_id = (p ->> 'pista_id')::uuid, numero_pista = null,
    ubicacion_nombre = nullif(btrim(coalesce(p ->> 'ubicacion_nombre', '')), ''),
    ubicacion_direccion = nullif(btrim(coalesce(p ->> 'ubicacion_direccion', '')), ''),
    ubicacion_lat = (p ->> 'ubicacion_lat')::double precision, ubicacion_lng = (p ->> 'ubicacion_lng')::double precision,
    ubicacion_enlace = nullif(btrim(coalesce(p ->> 'ubicacion_enlace', '')), '')
  where id = p_id;
end $$;

/** Un jugador (o un gestor que tenga ficha) propone un plan: se publica al momento como no oficial. */
create function public.crear_plan(p jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_person text := public._exigir_jugador();
  v_id uuid;
begin
  perform public._plan_valido(p, false);
  if (p ->> 'fecha')::date < (now() at time zone 'Europe/Madrid')::date then raise exception 'fecha_pasada' using errcode = 'P0001'; end if;
  insert into public.eventos (clave, temporada, tipo, equipo, titulo, fecha, oficial, creado_por, origen, sporteasy_estado, sporteasy_cambio)
  values ('plan-' || gen_random_uuid(), '2026-27', p ->> 'tipo', coalesce(p ->> 'equipo', 'ambos'), btrim(p ->> 'titulo'),
          (p ->> 'fecha')::date, false, v_person, 'manual', 'pendiente', 'Plan no oficial: no se copia a SportEasy')
  returning id into v_id;
  perform public._plan_aplicar(v_id, p);
  return v_id;
end $$;

create function public._plan_de(p_id uuid)
returns public.eventos language sql stable security definer set search_path = ''
as $$ select * from public.eventos where id = p_id and not oficial and borrado_en is null $$;

-- Si un gestor toca el plan de otro, al organizador le queda un aviso en su inicio (y la web le manda un push si lo
-- tiene activado).
create function public._avisar_organizador(e public.eventos, p_texto text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if e.creado_por is null or e.creado_por = public._mi_person_id() then return; end if;
  insert into public.avisos_personales (person_id, texto, url) values (e.creado_por, p_texto, '/planes/' || e.id);
end $$;

/** El organizador (o un gestor) cambia un plan. */
create function public.editar_plan(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  e public.eventos := public._plan_de(p_id);
  v_gestor boolean := public.is_gestor();
begin
  if e.id is null then raise exception 'plan_no_encontrado' using errcode = 'P0001'; end if;
  if not v_gestor and e.creado_por is distinct from public._mi_person_id() then raise exception 'no_es_tuyo' using errcode = 'P0001'; end if;
  perform public._plan_valido(p, v_gestor);
  perform public._plan_aplicar(p_id, p);
  if v_gestor then perform public._avisar_organizador(e, public._nombre_gestor() || ' ha cambiado tu plan «' || e.titulo || '».'); end if;
  return jsonb_build_object('id', p_id, 'organizador', e.creado_por, 'avisado', v_gestor and e.creado_por is distinct from public._mi_person_id());
end $$;

/** Cancelar (el organizador o un gestor): sigue en la agenda como cancelado. */
create function public.cancelar_plan(p_id uuid, p_restablecer boolean default false)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  e public.eventos := public._plan_de(p_id);
  v_gestor boolean := public.is_gestor();
begin
  if e.id is null then raise exception 'plan_no_encontrado' using errcode = 'P0001'; end if;
  if not v_gestor and e.creado_por is distinct from public._mi_person_id() then raise exception 'no_es_tuyo' using errcode = 'P0001'; end if;
  update public.eventos set estado = case when p_restablecer then 'programado' else 'cancelado' end where id = p_id;
  if v_gestor then perform public._avisar_organizador(e, public._nombre_gestor() || case when p_restablecer then ' ha restablecido' else ' ha cancelado' end || ' tu plan «' || e.titulo || '».'); end if;
  return jsonb_build_object('id', p_id, 'organizador', e.creado_por, 'avisado', v_gestor and e.creado_por is distinct from public._mi_person_id());
end $$;

/** Borrar un plan (solo gestores). Queda marcado (borrado_en): desaparece de la web y en los calendarios sale cancelado. */
create function public.borrar_plan(p_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare e public.eventos := public._plan_de(p_id);
begin
  if not public.is_gestor() then raise exception 'solo_gestores' using errcode = 'P0001'; end if;
  if e.id is null then raise exception 'plan_no_encontrado' using errcode = 'P0001'; end if;
  update public.eventos set borrado_en = now(), borrado_por_nombre = public._nombre_gestor(), estado = 'cancelado' where id = p_id;
  perform public._avisar_organizador(e, public._nombre_gestor() || ' ha borrado tu plan «' || e.titulo || '».');
  return jsonb_build_object('id', p_id, 'organizador', e.creado_por, 'avisado', e.creado_por is distinct from public._mi_person_id());
end $$;

/** «Hacer oficial» (solo gestores): desde ahi sigue el flujo del club (p. ej. la cola de copia a SportEasy). */
create function public.hacer_oficial(p_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare e public.eventos := public._plan_de(p_id);
begin
  if not public.is_gestor() then raise exception 'solo_gestores' using errcode = 'P0001'; end if;
  if e.id is null then raise exception 'plan_no_encontrado' using errcode = 'P0001'; end if;
  update public.eventos set oficial = true, rival = coalesce(rival, rival_texto), sporteasy_estado = 'pendiente',
         sporteasy_cambio = 'Evento nuevo: crearlo en SportEasy' where id = p_id;
  perform public._avisar_organizador(e, public._nombre_gestor() || ' ha hecho oficial tu plan «' || e.titulo || '».');
  return jsonb_build_object('id', p_id, 'organizador', e.creado_por, 'avisado', e.creado_por is distinct from public._mi_person_id());
end $$;

/** Responder a un plan: SIEMPRE en la web (excepcion a D64: no existe en SportEasy), «No voy» sin motivo y, con
 *  plazas, «Voy» solo si queda sitio. */
create function public.responder_plan(p_evento uuid, p_respuesta text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_person text := public._exigir_jugador();
  e public.eventos := public._plan_de(p_evento);
  v_antes text;
  v_van int;
begin
  if e.id is null then raise exception 'plan_no_encontrado' using errcode = 'P0001'; end if;
  if not public._invitado(v_person, p_evento) then raise exception 'no_invitado' using errcode = 'P0001'; end if;
  if not public._evento_abierto(p_evento) then raise exception 'evento_cerrado' using errcode = 'P0001'; end if;
  if p_respuesta not in ('va', 'duda', 'no') then raise exception 'respuesta_no_valida' using errcode = 'P0001'; end if;
  perform 1 from public.eventos where id = p_evento for update;
  if p_respuesta = 'va' and e.plazas is not null then
    select count(*) into v_van from public.respuestas where evento_id = p_evento and respuesta = 'va' and person_id <> v_person;
    if v_van >= e.plazas then raise exception 'completo' using errcode = 'P0001'; end if;
  end if;
  v_antes := public._escribir_respuesta(p_evento, v_person, p_respuesta, null, null, 'jugador', auth.uid(), null, null);
  return jsonb_build_object('antes', v_antes, 'despues', p_respuesta);
end $$;

/** El organizador ve lo que le ha dejado un gestor; «Entendido» lo quita. */
create function public.marcar_aviso_visto(p_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  update public.avisos_personales set visto_en = now() where id = p_id and person_id = public._mi_person_id() and visto_en is null;
  return found;
end $$;

-- ---------------------------------------------------------------- calendario personal (D120, excepcion acotada a D68)
-- Un enlace secreto por persona, solo de lectura. Aqui solo vive el HASH (sha256) del enlace: el enlace lo calcula el
-- servidor con su secreto y la version (cambiar el enlace sube la version y el anterior deja de valer).
create table public.calendario_tokens (
  person_id       text primary key references public.jugadores (person_id),
  hash            text unique,
  version         int not null default 1 check (version > 0),
  creado_en       timestamptz not null default now(),
  regenerado_en   timestamptz,
  ventana_inicio  timestamptz,
  peticiones      int not null default 0,
  ultima_lectura  timestamptz
);

/** Version del enlace de quien tiene sesion (1 si aun no tiene). */
create function public.mi_calendario_version()
returns int language sql stable security definer set search_path = ''
as $$ select coalesce((select version from public.calendario_tokens where person_id = public._mi_person_id()), 1) $$;

/** Registra el enlace (su hash) de esa version para quien tiene sesion. Una version vieja no se acepta. */
create function public.mi_calendario_registrar(p_token text, p_version int)
returns int language plpgsql security definer set search_path = ''
as $$
declare
  v_person text := public._exigir_jugador();
  v_actual int;
begin
  if length(coalesce(p_token, '')) < 40 then raise exception 'token_no_valido' using errcode = 'P0001'; end if;
  select version into v_actual from public.calendario_tokens where person_id = v_person;
  if v_actual is not null and p_version < v_actual then raise exception 'version_vieja' using errcode = 'P0001'; end if;
  insert into public.calendario_tokens (person_id, hash, version)
  values (v_person, encode(sha256(convert_to(p_token, 'UTF8')), 'hex'), p_version)
  on conflict (person_id) do update set hash = excluded.hash, version = excluded.version;
  return p_version;
end $$;

/** «Cambiar mi enlace»: el anterior deja de funcionar al momento. Devuelve la version nueva. */
create function public.mi_calendario_regenerar()
returns int language plpgsql security definer set search_path = ''
as $$
declare
  v_person text := public._exigir_jugador();
  v_version int;
begin
  insert into public.calendario_tokens (person_id, hash, version, regenerado_en) values (v_person, null, 2, now())
  on conflict (person_id) do update set hash = null, version = public.calendario_tokens.version + 1, regenerado_en = now()
  returning version into v_version;
  return v_version;
end $$;

/** Lo unico que ve una app de calendario con el enlace secreto: SOLO los eventos de esa persona (oficiales y planes a
 *  los que esta invitada, de 30 dias atras en adelante), con SU estado. Nunca motivos, niveles, nombres de otros ni
 *  respuestas ajenas. null = enlace que no existe, regenerado o de alguien inactivo. Limite: 120 lecturas por hora. */
create function public.calendario_personal(p_token text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  t public.calendario_tokens;
  j public.jugadores;
  v_desde date := (now() at time zone 'Europe/Madrid')::date - 30;
begin
  if length(coalesce(p_token, '')) < 40 or length(p_token) > 200 then return null; end if;
  select * into t from public.calendario_tokens where hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
  if t.person_id is null then return null; end if;
  select * into j from public.jugadores where person_id = t.person_id;
  if j.person_id is null or not j.activo then return null; end if;
  if t.ventana_inicio is null or t.ventana_inicio < now() - interval '1 hour' then
    update public.calendario_tokens set ventana_inicio = now(), peticiones = 1, ultima_lectura = now() where person_id = t.person_id;
  elsif t.peticiones >= 120 then
    return jsonb_build_object('limite', true);
  else
    update public.calendario_tokens set peticiones = peticiones + 1, ultima_lectura = now() where person_id = t.person_id;
  end if;
  return jsonb_build_object(
    'person_id', j.person_id, 'nombre', j.nombre_visible,
    'eventos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'tipo', e.tipo, 'equipo', e.equipo, 'oficial', e.oficial, 'titulo', e.titulo, 'rival', e.rival,
        'rival_texto', e.rival_texto, 'es_local', e.es_local, 'jornada', e.jornada, 'fecha', e.fecha, 'inicio', e.inicio,
        'fin', e.fin, 'quedada', e.quedada,
        'estado', case when e.borrado_en is not null then 'cancelado' else e.estado end,
        'lugar_nombre', coalesce(pe.nombre, e.ubicacion_nombre), 'lugar_direccion', coalesce(pe.direccion, e.ubicacion_direccion),
        'lugar_lat', coalesce(pe.lat, e.ubicacion_lat), 'lugar_lng', coalesce(pe.lng, e.ubicacion_lng),
        'lugar_enlace', case when pe.id is null then e.ubicacion_enlace end,
        'numero_pista', case when p.id is not null then e.numero_pista end,
        'secuencia', e.secuencia, 'actualizado_en', greatest(e.actualizado_en, r.cambiado_en, c.cambiado_en),
        'respuesta', coalesce(r.respuesta, 'sin_responder'),
        'convocado', (e.tipo = 'liga' and c.estado = 'aprobada'
                      and exists (select 1 from jsonb_array_elements(coalesce(c.equipos -> e.equipo, '[]'::jsonb)) x where x ->> 'person_id' = j.person_id)),
        'convocatoria_aprobada', (e.tipo = 'liga' and c.estado = 'aprobada'))
        order by e.fecha, e.inicio)
      from public.eventos e
      left join public.pistas p  on p.id = e.pista_id
      left join public.pistas ps on e.pista_id is null and e.tipo = 'entreno' and ps.es_de_serie and ps.uso = 'entreno'
      left join lateral (select x.* from public.pistas x where x.id = coalesce(p.id, case when ps.estado = 'habitual' then ps.id end)) pe on true
      left join public.respuestas r on r.evento_id = e.id and r.person_id = j.person_id
      left join public.convocatorias c on c.fecha = e.fecha and e.tipo = 'liga'
      where e.temporada = '2026-27' and e.fecha >= v_desde and public._invitado(j.person_id, e.id)), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------- tablero de asistencias y convocatoria (D121)
-- Una importacion de SportEasy no pisa un cambio de gestor mas reciente: el valor de SportEasy que se decidio no usar
-- queda aqui, y solo vuelve a salir como conflicto si SportEasy dice otra cosa.
alter table public.respuestas add column sporteasy_descartado text check (sporteasy_descartado is null or sporteasy_descartado in ('va', 'duda', 'no', 'sin_responder'));

create table public.tablero_registro (
  id           uuid primary key default gen_random_uuid(),
  en           timestamptz not null default now(),
  por_user_id  uuid,
  por_nombre   text not null,
  evento_id    uuid references public.eventos (id),
  fecha        date,
  accion       text not null check (accion in ('respuesta', 'deshacer')),
  personas     text[] not null default '{}',
  despues      text,
  motivo       text,
  -- Lo que habia antes, por persona: {"person_id": {"respuesta": "...", "motivo": ..., "detalle": ..., "origen": ...}}
  antes        jsonb not null default '{}'::jsonb,
  deshecho_en  timestamptz
);
create index tablero_registro_evento_idx on public.tablero_registro (evento_id, en);

/** Cambiar la respuesta de varios jugadores a un evento desde el tablero (solo gestores). Funciona tambien con el
 *  interruptor apagado (fase puente, D121). Queda «puesta por <gestor>» con fecha y hora; «No van» pide motivo. */
create function public.tablero_responder(p_evento uuid, p_personas text[], p_respuesta text, p_motivo text default null,
                                         p_detalle text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_nombre text := public._nombre_gestor();
  v_antes jsonb := '{}'::jsonb;
  v_p text;
  v_id uuid;
  r public.respuestas;
begin
  if not public.is_gestor() then raise exception 'solo_gestores' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.eventos where id = p_evento and estado = 'programado' and oficial) then
    raise exception 'evento_cerrado' using errcode = 'P0001';
  end if;
  perform public._validar_respuesta(p_respuesta, p_motivo);
  if coalesce(array_length(p_personas, 1), 0) = 0 then raise exception 'sin_personas' using errcode = 'P0001'; end if;
  foreach v_p in array p_personas loop
    if not public._invitado(v_p, p_evento) then raise exception 'no_invitado' using errcode = 'P0001'; end if;
    select * into r from public.respuestas where evento_id = p_evento and person_id = v_p;
    v_antes := v_antes || jsonb_build_object(v_p, jsonb_build_object('respuesta', coalesce(r.respuesta, 'sin_responder'),
      'motivo', r.motivo, 'detalle', r.detalle, 'origen', r.origen, 'puesto_por', r.puesto_por,
      'puesto_por_nombre', r.puesto_por_nombre, 'fuente', r.fuente, 'existia', r.id is not null));
    perform public._escribir_respuesta(p_evento, v_p, p_respuesta, case when p_respuesta = 'no' then p_motivo end,
                                       case when p_respuesta = 'no' then p_detalle end, 'gestor', auth.uid(), v_nombre, null);
  end loop;
  insert into public.tablero_registro (por_user_id, por_nombre, evento_id, fecha, accion, personas, despues, motivo, antes)
  select auth.uid(), v_nombre, p_evento, e.fecha, 'respuesta', p_personas, p_respuesta, p_motivo, v_antes
  from public.eventos e where e.id = p_evento
  returning id into v_id;
  return jsonb_build_object('registro', v_id, 'cambiados', array_length(p_personas, 1));
end $$;

/** «Deshacer» el ultimo cambio de respuestas (un nivel): deja cada respuesta como estaba. */
create function public.tablero_deshacer(p_registro uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  g public.tablero_registro;
  k text;
  a jsonb;
begin
  if not public.is_gestor() then raise exception 'solo_gestores' using errcode = 'P0001'; end if;
  select * into g from public.tablero_registro where id = p_registro and accion = 'respuesta' and deshecho_en is null for update;
  if g.id is null then raise exception 'nada_que_deshacer' using errcode = 'P0001'; end if;
  for k, a in select * from jsonb_each(g.antes) loop
    update public.respuestas set respuesta = a ->> 'respuesta', motivo = a ->> 'motivo', detalle = a ->> 'detalle',
           origen = coalesce(a ->> 'origen', 'sporteasy'), puesto_por = (a ->> 'puesto_por')::uuid,
           puesto_por_nombre = a ->> 'puesto_por_nombre', fuente = coalesce(a ->> 'fuente', fuente), cambiado_en = now()
     where evento_id = g.evento_id and person_id = k;
  end loop;
  update public.tablero_registro set deshecho_en = now() where id = g.id;
  insert into public.tablero_registro (por_user_id, por_nombre, evento_id, fecha, accion, personas, despues, antes)
  values (auth.uid(), public._nombre_gestor(), g.evento_id, g.fecha, 'deshacer', g.personas, null, jsonb_build_object('deshace', g.id));
  return jsonb_build_object('deshecho', g.id);
end $$;

-- ---------------------------------------------------------------- grupos de entreno (D122)
create table public.grupos_repartos (
  id                  uuid primary key default gen_random_uuid(),
  evento_id           uuid not null references public.eventos (id),
  nombre              text not null check (length(nombre) between 1 and 60),
  tamano              int not null default 5 check (tamano between 3 and 6),
  -- [{"nombre": "Grupo 1", "personas": ["person_id", ...], "explica": "MdL del domingo 8; completa ..."}]
  grupos              jsonb not null default '[]'::jsonb check (jsonb_typeof(grupos) = 'array'),
  publicado           boolean not null default false,
  publicado_en        timestamptz,
  orden               int not null default 0,
  creado_en           timestamptz not null default now(),
  creado_por_nombre   text,
  cambiado_en         timestamptz not null default now(),
  cambiado_por_nombre text,
  borrado_en          timestamptz
);
create index grupos_repartos_evento_idx on public.grupos_repartos (evento_id);
-- Un solo reparto publicado por entreno.
create unique index grupos_repartos_un_publicado on public.grupos_repartos (evento_id) where publicado and borrado_en is null;

/** Lo unico que ve un jugador de los grupos: en los entrenos a los que esta invitado, con un reparto publicado, el
 *  nombre de SU grupo y los motes de sus compañeros. Ni niveles, ni el criterio, ni los otros grupos. */
create function public.mis_grupos()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'evento_id', g.evento_id, 'grupo', x ->> 'nombre',
           'companeros', (select coalesce(jsonb_agg(j.nombre_visible order by j.nombre_visible), '[]'::jsonb)
                          from jsonb_array_elements_text(x -> 'personas') pid
                          join public.jugadores j on j.person_id = pid
                          where pid <> public._mi_person_id()))), '[]'::jsonb)
  from public.grupos_repartos g
  join public.eventos e on e.id = g.evento_id
  cross join lateral jsonb_array_elements(g.grupos) x
  where g.publicado and g.borrado_en is null and e.fecha >= (now() at time zone 'Europe/Madrid')::date
    and public._mi_person_id() is not null
    and exists (select 1 from jsonb_array_elements_text(x -> 'personas') p where p = public._mi_person_id())
$$;

-- ---------------------------------------------------------------- RLS
alter table public.avisos_personales  enable row level security;
alter table public.calendario_tokens  enable row level security;
alter table public.tablero_registro   enable row level security;
alter table public.grupos_repartos    enable row level security;

create policy cada_cual_lee_los_suyos on public.avisos_personales for select to authenticated using (person_id = public._mi_person_id());
create policy gestores_leen on public.tablero_registro for select to authenticated using (public.is_gestor());
create policy gestores_leen     on public.grupos_repartos for select to authenticated using (public.is_gestor());
create policy gestores_insertan on public.grupos_repartos for insert to authenticated with check (public.is_gestor());
create policy gestores_cambian  on public.grupos_repartos for update to authenticated using (public.is_gestor()) with check (public.is_gestor());
-- calendario_tokens: nadie la lee por la API (ni su dueño: solo hay hashes); se usa solo con las funciones de arriba.

revoke all on public.avisos_personales, public.calendario_tokens, public.tablero_registro, public.grupos_repartos
  from anon, authenticated, public;
grant select on public.avisos_personales, public.tablero_registro to authenticated;
grant select, insert, update on public.grupos_repartos to authenticated;
revoke all on public.v_mi_agenda from anon, authenticated, public;
grant select on public.v_mi_agenda to authenticated;

-- La tarea de avisos (servidor, service_role) lee los planes (recordatorio de un dia antes) y lo que avisa al organizador.
do $$
begin
  grant select on public.avisos_personales to service_role;
exception when undefined_object then
  null;
end $$;

revoke execute on function public.mi_posicion() from public, anon, authenticated;
grant execute on function public.mi_posicion() to authenticated;
revoke execute on function
  public._mi_agenda(), public._plan_valido(jsonb, boolean), public._plan_aplicar(uuid, jsonb), public.crear_plan(jsonb),
  public._plan_de(uuid), public._avisar_organizador(public.eventos, text), public.editar_plan(uuid, jsonb),
  public.cancelar_plan(uuid, boolean), public.borrar_plan(uuid), public.hacer_oficial(uuid), public.responder_plan(uuid, text),
  public.marcar_aviso_visto(uuid), public.mi_calendario_version(), public.mi_calendario_registrar(text, int),
  public.mi_calendario_regenerar(), public.calendario_personal(text),
  public.tablero_responder(uuid, text[], text, text, text), public.tablero_deshacer(uuid), public.mis_grupos()
  from public, anon, authenticated;
grant execute on function
  public._mi_agenda(), public.crear_plan(jsonb), public.editar_plan(uuid, jsonb), public.cancelar_plan(uuid, boolean),
  public.borrar_plan(uuid), public.hacer_oficial(uuid), public.responder_plan(uuid, text), public.marcar_aviso_visto(uuid),
  public.mi_calendario_version(), public.mi_calendario_registrar(text, int), public.mi_calendario_regenerar(),
  public.tablero_responder(uuid, text[], text, text, text), public.tablero_deshacer(uuid), public.mis_grupos()
  to authenticated;
-- La unica funcion que puede llamar anon (la app de calendario no inicia sesion): con el enlace secreto, y nada mas.
grant execute on function public.calendario_personal(text) to anon, authenticated;
