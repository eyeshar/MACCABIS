-- =====================================================================================================================
-- D196 · MdFantasy: fantasy interno del club (Iván, 20/11/2026; Code, `feat/mdfantasy`).
-- SOLO ADITIVA (D94, D111): tablas, funciones y UN disparador nuevos. No cambia ni borra nada de lo que hay.
-- Reversión: 20261121100000_mdfantasy.revertir.sql (probada en la pila local, pruebas:fantasy-rls).
--
-- Qué crea
--   fantasy_config              interruptor (apagado | gestores | todos; nace APAGADO), parámetros cambiados y alias de nombres
--   fantasy_managers            quién juega (una persona de `jugadores`, también el entrenador)
--   fantasy_jugadores           el mercado: jugadores elegibles (rol jugador y activos), su valor y sus copias
--   fantasy_copias              qué copia tiene cada mánager
--   fantasy_movimientos         fichajes, ventas, clausulazos e ingresos; la caja es la SUMA de los importes
--   fantasy_jornadas            cada domingo con partido: cuándo se puntuó y con qué hoja
--   fantasy_alineaciones        los alineados, capitán y vicecapitán de cada mánager y jornada
--   fantasy_porras              gana / pierde por equipo
--   fantasy_duelos              rival de cada jornada (calendario rotatorio)
--   fantasy_puntos_jugador      puntos de cada jugador en cada jornada (rendimiento y compromiso)
--   fantasy_puntos_manager      puntos de cada mánager en cada jornada
--   fantasy_logros              logros de los mánagers
--   fantasy_primeras_respuestas cuándo respondió cada jugador POR PRIMERA VEZ a cada evento (respuestas solo guarda la última)
--
-- Privacidad
--   - Nada lee niveles, posiciones, «dobla» ni motivos. El estado de cada respuesta es el que ya ven los jugadores
--     (_estado_efectivo, el de v_quien_va).
--   - Todo se lee solo con el juego encendido y siendo jugador con sesión o gestor (_fantasy_acceso). Nadie escribe
--     directamente: solo por las funciones de abajo.
--   - Plantillas, valores, movimientos y puntos: los ven todos. Alineación, capitán y porra de los demás: solo desde el
--     primer partido del domingo (_fantasy_cerrada).
-- =====================================================================================================================

-- --------------------------------------------------------------------------------------------------------- tablas
create table public.fantasy_config (
  id int primary key default 1 check (id = 1),
  modo text not null default 'apagado' check (modo in ('apagado', 'gestores', 'todos')),
  temporada text not null default '2026-27',
  parametros jsonb not null default '{}'::jsonb,
  alias jsonb not null default '{}'::jsonb,
  cambiado_en timestamptz,
  cambiado_por_nombre text
);
insert into public.fantasy_config (id) values (1);
comment on table public.fantasy_config is 'D196 MdFantasy: interruptor (nace apagado), parámetros cambiados por los gestores y alias de nombres de la hoja.';

create table public.fantasy_managers (
  person_id text primary key references public.jugadores (person_id),
  nombre text not null,
  alta_en timestamptz not null default now()
);

create table public.fantasy_jugadores (
  person_id text primary key references public.jugadores (person_id),
  nombre text not null,
  valor numeric(6, 1) not null,
  copias int not null default 0,
  media numeric(6, 1) not null default 0,
  jornadas int not null default 0,
  en_mercado boolean not null default true,
  actualizado_en timestamptz not null default now()
);

create table public.fantasy_copias (
  id uuid primary key default gen_random_uuid(),
  jugador text not null references public.fantasy_jugadores (person_id),
  manager text not null references public.fantasy_managers (person_id),
  precio numeric(6, 1) not null,
  comprada_en timestamptz not null default now(),
  robada_en date,
  unique (jugador, manager)
);
create index fantasy_copias_manager on public.fantasy_copias (manager);

create table public.fantasy_movimientos (
  id uuid primary key default gen_random_uuid(),
  manager text not null references public.fantasy_managers (person_id),
  tipo text not null check (tipo in ('inicio', 'fichaje', 'venta', 'clausulazo', 'clausulado', 'ingreso', 'ajuste')),
  jugador text,
  otro text,
  importe numeric(8, 1) not null,
  jornada date,
  clave text unique,
  creado_en timestamptz not null default now()
);
create index fantasy_movimientos_manager on public.fantasy_movimientos (manager, creado_en desc);

create table public.fantasy_jornadas (
  fecha date primary key,
  temporada text not null,
  puntuada_en timestamptz,
  huella text,
  ronda int,
  sin_casar text[] not null default '{}',
  resultados jsonb not null default '{}'::jsonb,
  -- La jornada está pendiente de volver a puntuarse SOLO por una corrección de asistencia: el valor de mercado no se mueve.
  valor_quieto boolean not null default false
);

create table public.fantasy_alineaciones (
  manager text not null references public.fantasy_managers (person_id),
  jornada date not null,
  titulares text[] not null default '{}',
  capitan text,
  vice text,
  arrastrada boolean not null default false,
  cambiada_en timestamptz not null default now(),
  primary key (manager, jornada)
);

create table public.fantasy_porras (
  manager text not null references public.fantasy_managers (person_id),
  jornada date not null,
  equipo text not null check (equipo in ('MdA', 'MdL')),
  pronostico text not null check (pronostico in ('gana', 'pierde')),
  acierto boolean,
  puesta_en timestamptz not null default now(),
  primary key (manager, jornada, equipo)
);

create table public.fantasy_duelos (
  jornada date not null,
  manager_a text not null references public.fantasy_managers (person_id),
  manager_b text references public.fantasy_managers (person_id),
  puntos_a numeric(7, 1),
  puntos_b numeric(7, 1),
  primary key (jornada, manager_a)
);

create table public.fantasy_puntos_jugador (
  jornada date not null,
  person_id text not null,
  rendimiento numeric(6, 1) not null,
  compromiso numeric(6, 1) not null,
  total numeric(6, 1) not null,
  -- El total que cuenta para el VALOR de mercado. Igual que `total`, salvo tras corregir la asistencia de una jornada ya
  -- puntuada: entonces se queda como estaba hasta que se puntúe la siguiente jornada (nadie ve saltar un precio a mitad de semana).
  total_valor numeric(6, 1) not null,
  minutos int not null default 0,
  convocado boolean not null default false,
  doblete boolean not null default false,
  detalle jsonb not null default '{}'::jsonb,
  primary key (jornada, person_id)
);

create table public.fantasy_puntos_manager (
  jornada date not null,
  manager text not null references public.fantasy_managers (person_id),
  alineacion numeric(7, 1) not null,
  porra numeric(6, 1) not null default 0,
  total numeric(7, 1) not null,
  ingreso numeric(6, 1) not null default 0,
  detalle jsonb not null default '{}'::jsonb,
  primary key (jornada, manager)
);

create table public.fantasy_logros (
  manager text not null references public.fantasy_managers (person_id),
  logro text not null,
  jornada date not null,
  texto text not null,
  primary key (manager, logro, jornada)
);

create table public.fantasy_primeras_respuestas (
  evento_id uuid not null,
  person_id text not null,
  primera_en timestamptz not null,
  primary key (evento_id, person_id)
);
comment on table public.fantasy_primeras_respuestas is 'D196: primera vez que cada jugador respondió él mismo a cada evento (respuestas solo guarda el último cambio). Solo el rol de servicio.';

-- ------------------------------------------------------------------------------------------- funciones internas
-- Parámetro vigente: lo cambiado por los gestores o el valor de salida (la copia de src/lib/fantasy/reglas.ts).
create function public._fantasy_param(p_clave text)
returns numeric language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select nullif(c.parametros ->> p_clave, '')::numeric from public.fantasy_config c where c.id = 1),
    case p_clave
      when 'puntoPorPunto' then 1 when 'masMenosDivisor' then 2 when 'masMenosTope' then 5 when 'bonusDoblete' then 3
      when 'respuestaRapida' then 2 when 'respuestaATiempo' then 1 when 'sinRespuesta' then -2 when 'horasRapida' then 24
      when 'entrenoAsistido' then 2 when 'planton' then -5 when 'topeCompromiso' then 6
      when 'plantilla' then 7 when 'alineados' then 5 when 'porraAcierto' then 3
      when 'valorMinimo' then 4 when 'jornadasValor' then 4 when 'clausula' then 1.5 when 'margenCopias' then 0.15
      when 'margenInicio' then 0.1 when 'cajaInicial' then 11 when 'ingresoFijo' then 1.5 when 'ingresoPorPunto' then 0.04
    end)
$$;

create function public._fantasy_modo()
returns text language sql stable security definer set search_path = ''
as $$ select coalesce((select modo from public.fantasy_config where id = 1), 'apagado') $$;

-- Puede entrar al juego: encendido para todos y es alguien de la plantilla con sesión o un gestor; o «solo gestores».
create function public._fantasy_acceso()
returns boolean language sql stable security definer set search_path = ''
as $$
  select case public._fantasy_modo()
    when 'todos' then public._mi_person_id() is not null or public.is_gestor()
    when 'gestores' then public.is_gestor()
    else false end
$$;

create function public._fantasy_temporada()
returns text language sql stable security definer set search_path = ''
as $$ select coalesce((select temporada from public.fantasy_config where id = 1), '2026-27') $$;

-- Hora del primer partido de liga de un día (null si ese día no hay partido).
create function public._fantasy_primer_partido(p_fecha date)
returns timestamptz language sql stable security definer set search_path = ''
as $$
  select min((e.fecha + coalesce(e.inicio, time '09:00')) at time zone 'Europe/Madrid')
  from public.eventos e
  where e.fecha = p_fecha and e.tipo = 'liga' and e.oficial is not false and e.estado = 'programado' and e.borrado_en is null
    and e.temporada = public._fantasy_temporada()
$$;

-- La jornada en juego: el primer día con partido de liga que aún no está puntuado.
create function public._fantasy_jornada_actual()
returns date language sql stable security definer set search_path = ''
as $$
  select min(e.fecha) from public.eventos e
  where e.tipo = 'liga' and e.oficial is not false and e.estado = 'programado' and e.borrado_en is null
    and e.temporada = public._fantasy_temporada()
    and not exists (select 1 from public.fantasy_jornadas j where j.fecha = e.fecha and j.puntuada_en is not null)
$$;

-- Una jornada está cerrada (ya se ve la alineación de todos) desde su primer partido.
create function public._fantasy_cerrada(p_fecha date)
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(now() >= public._fantasy_primer_partido(p_fecha), true) $$;

-- Clausulazos cerrados desde el sábado (el día anterior) a las 20:00.
create function public._fantasy_clausulas_cerradas(p_fecha date)
returns boolean language sql stable security definer set search_path = ''
as $$ select now() >= least(public._fantasy_primer_partido(p_fecha), ((p_fecha - 1) + time '20:00') at time zone 'Europe/Madrid') $$;

-- Un gestor no opera desde que existe el borrador de la convocatoria de esa jornada hasta que se aprueba.
create function public._fantasy_gestor_bloqueado(p_fecha date)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.is_gestor() and exists (select 1 from public.convocatorias c where c.fecha = p_fecha and c.estado = 'borrador') $$;

create function public._fantasy_caja(p_manager text)
returns numeric language sql stable security definer set search_path = ''
as $$ select coalesce(sum(importe), 0) from public.fantasy_movimientos where manager = p_manager $$;

create function public._fantasy_libres(p_jugador text)
returns int language sql stable security definer set search_path = ''
as $$
  select greatest(0, j.copias - (select count(*)::int from public.fantasy_copias c where c.jugador = j.person_id))
  from public.fantasy_jugadores j where j.person_id = p_jugador and j.en_mercado
$$;

-- Copias por jugador: las justas para que todos llenen la plantilla, con un poco de margen. Nunca por debajo de las ya repartidas.
create function public._fantasy_recalcular_copias()
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_managers int := greatest(1, (select count(*) from public.fantasy_managers));
  v_elegibles int := (select count(*) from public.fantasy_jugadores where en_mercado);
  v_copias int;
begin
  if v_elegibles = 0 then return; end if;
  v_copias := greatest(1, ceil(v_managers * public._fantasy_param('plantilla') * (1 + public._fantasy_param('margenCopias')) / v_elegibles)::int);
  update public.fantasy_jugadores j
     set copias = greatest(v_copias, (select count(*)::int from public.fantasy_copias c where c.jugador = j.person_id))
   where j.en_mercado;
end $$;

-- Valor de mercado: media de los puntos de las últimas N jornadas con datos, con un mínimo. Mete a los elegibles nuevos
-- y saca del mercado a quien deja de ser jugador activo (sus copias siguen siendo de quien las tiene).
create function public._fantasy_recalcular_valores()
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_n int := public._fantasy_param('jornadasValor')::int;
  v_min numeric := public._fantasy_param('valorMinimo');
begin
  insert into public.fantasy_jugadores (person_id, nombre, valor)
  select j.person_id, j.nombre_visible, v_min from public.jugadores j where j.activo and j.rol = 'jugador'
  on conflict (person_id) do nothing;
  update public.fantasy_jugadores f
     set nombre = j.nombre_visible, en_mercado = (j.activo and j.rol = 'jugador')
    from public.jugadores j where j.person_id = f.person_id;
  update public.fantasy_jugadores f
     set valor = greatest(v_min, coalesce(x.media_n, v_min)), media = coalesce(x.media, 0), jornadas = coalesce(x.n, 0), actualizado_en = now()
    from (select f2.person_id,
                 (select round(avg(u.total_valor), 1) from (select p.total_valor from public.fantasy_puntos_jugador p where p.person_id = f2.person_id order by p.jornada desc limit v_n) u) as media_n,
                 (select round(avg(p.total), 1) from public.fantasy_puntos_jugador p where p.person_id = f2.person_id) as media,
                 (select count(*)::int from public.fantasy_puntos_jugador p where p.person_id = f2.person_id) as n
          from public.fantasy_jugadores f2) x
   where x.person_id = f.person_id;
  perform public._fantasy_recalcular_copias();
end $$;

create function public._fantasy_exigir()
returns text language plpgsql stable security definer set search_path = ''
as $$
declare v text := public._mi_person_id();
begin
  if not public._fantasy_acceso() then raise exception 'fantasy_apagado' using errcode = 'P0001'; end if;
  if v is null then raise exception 'sin_ficha' using errcode = 'P0001'; end if;
  return v;
end $$;

-- Mánager con sesión, con el mercado abierto para él en la jornada en juego. Devuelve la jornada.
create function public._fantasy_exigir_abierto(p_manager text)
returns date language plpgsql security definer set search_path = ''
as $$
declare v_j date := public._fantasy_jornada_actual();
begin
  perform pg_advisory_xact_lock(hashtext('mdfantasy'));
  if not exists (select 1 from public.fantasy_managers where person_id = p_manager) then raise exception 'sin_equipo' using errcode = 'P0001'; end if;
  if v_j is null then raise exception 'sin_jornada' using errcode = 'P0001'; end if;
  if public._fantasy_cerrada(v_j) then raise exception 'cerrado' using errcode = 'P0001'; end if;
  if public._fantasy_gestor_bloqueado(v_j) then raise exception 'gestor_bloqueado' using errcode = 'P0001'; end if;
  return v_j;
end $$;

-- Quita a un jugador de la alineación de la jornada en juego de un mánager (al venderlo o perderlo).
create function public._fantasy_quitar_de_alineacion(p_manager text, p_jugador text, p_jornada date)
returns void language sql security definer set search_path = ''
as $$
  update public.fantasy_alineaciones
     set titulares = array_remove(titulares, p_jugador),
         capitan = nullif(capitan, p_jugador), vice = nullif(vice, p_jugador), cambiada_en = now()
   where manager = p_manager and jornada = p_jornada and p_jugador = any (titulares)
$$;

-- ------------------------------------------------------------------------------------ funciones para los jugadores
create function public.fantasy_acceso()
returns boolean language sql stable security definer set search_path = ''
as $$ select public._fantasy_acceso() $$;

-- Estado del juego para quien consulta (lo que no sale de las tablas).
create function public.fantasy_estado()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_p text := public._mi_person_id();
  v_j date := public._fantasy_jornada_actual();
begin
  if not public._fantasy_acceso() then return jsonb_build_object('acceso', false, 'modo', case when public.is_gestor() then public._fantasy_modo() end); end if;
  return jsonb_build_object(
    'acceso', true, 'modo', public._fantasy_modo(), 'person_id', v_p, 'es_gestor', public.is_gestor(),
    'es_manager', exists (select 1 from public.fantasy_managers where person_id = v_p),
    'elegible', exists (select 1 from public.fantasy_jugadores where person_id = v_p and en_mercado),
    'jornada', v_j, 'primer_partido', public._fantasy_primer_partido(v_j),
    'cerrado', case when v_j is null then true else public._fantasy_cerrada(v_j) end,
    'clausulas_cerradas', case when v_j is null then true else public._fantasy_clausulas_cerradas(v_j) end,
    'gestor_bloqueado', case when v_j is null then false else public._fantasy_gestor_bloqueado(v_j) end,
    'caja', public._fantasy_caja(v_p),
    'equipos', coalesce((select jsonb_agg(jsonb_build_object('equipo', e.equipo, 'rival', coalesce(e.rival_texto, e.rival), 'inicio', e.inicio, 'evento', e.id, 'jornada', e.jornada) order by e.inicio)
                         from public.eventos e where e.fecha = v_j and e.tipo = 'liga' and e.oficial is not false and e.estado = 'programado' and e.borrado_en is null), '[]'::jsonb),
    -- Empezado el primer partido, los equipos nuestros de ese domingo cuya hoja aún no está: la jornada no se puntúa hasta
    -- tenerlas todas («Pendiente: falta la hoja de MdA»).
    'hojas_pendientes', case when v_j is null or not public._fantasy_cerrada(v_j) then '[]'::jsonb else coalesce((
        select jsonb_agg(distinct e.equipo) from public.eventos e
        where e.fecha = v_j and e.tipo = 'liga' and e.oficial is not false and e.estado = 'programado' and e.borrado_en is null
          and e.temporada = public._fantasy_temporada()
          and not exists (select 1 from public.liga_partidos p
                          join public.liga_estadisticas_jugador s on s.partido_id = p.id and s.equipo = e.equipo
                          where p.temporada = public._fantasy_temporada() and p.nuestro and p.jornada = e.jornada
                            and p.grupo = case e.equipo when 'MdA' then 'G1' else 'G2' end)), '[]'::jsonb) end,
    -- La convocatoria PUBLICADA de la jornada en juego (lo mismo que ya ven los jugadores en su portada): quién va con
    -- cada equipo. null = sin publicar (no existe o sigue en borrador).
    'convocatoria', (select jsonb_build_object(
                       'MdA', coalesce((select jsonb_agg(x ->> 'person_id') from jsonb_array_elements(case when jsonb_typeof(c.equipos -> 'MdA') = 'array' then c.equipos -> 'MdA' else '[]'::jsonb end) x), '[]'::jsonb),
                       'MdL', coalesce((select jsonb_agg(x ->> 'person_id') from jsonb_array_elements(case when jsonb_typeof(c.equipos -> 'MdL') = 'array' then c.equipos -> 'MdL' else '[]'::jsonb end) x), '[]'::jsonb))
                     from public.convocatorias c where c.fecha = v_j and c.estado = 'aprobada'),
    'parametros', (select parametros from public.fantasy_config where id = 1),
    'ahora', now());
end $$;

-- Alta: plantilla al azar de valor parecido para todos (±margen) con las copias libres, más la caja inicial.
-- Quien entra tarde, igual con las copias que queden libres; si no llegan para el margen, se compensa en la caja.
create function public.fantasy_alta()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_p text := public._fantasy_exigir();
  v_j date := public._fantasy_jornada_actual();
  v_tam int := public._fantasy_param('plantilla')::int;
  v_margen numeric := public._fantasy_param('margenInicio');
  v_objetivo numeric;
  v_mejor text[]; v_mejor_dif numeric; v_ids text[]; v_valor numeric; v_dif numeric;
  i int;
begin
  perform pg_advisory_xact_lock(hashtext('mdfantasy'));
  if exists (select 1 from public.fantasy_managers where person_id = v_p) then raise exception 'ya_tiene_equipo' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.fantasy_jugadores where en_mercado) then raise exception 'sin_mercado' using errcode = 'P0001'; end if;
  if v_j is not null and public._fantasy_cerrada(v_j) then raise exception 'cerrado' using errcode = 'P0001'; end if;
  insert into public.fantasy_managers (person_id, nombre)
  select j.person_id, j.nombre_visible from public.jugadores j where j.person_id = v_p;
  perform public._fantasy_recalcular_copias();
  select v_tam * avg(valor) into v_objetivo from public.fantasy_jugadores where en_mercado;
  for i in 1..300 loop
    select array_agg(x.person_id), sum(x.valor) into v_ids, v_valor
    from (select f.person_id, f.valor from public.fantasy_jugadores f
          where f.en_mercado and f.person_id <> v_p and public._fantasy_libres(f.person_id) > 0
          order by random() limit v_tam) x;
    exit when v_ids is null;
    v_dif := abs(v_valor - v_objetivo) / nullif(v_objetivo, 0);
    if v_mejor is null or v_dif < v_mejor_dif then v_mejor := v_ids; v_mejor_dif := v_dif; end if;
    exit when v_mejor_dif <= v_margen;
  end loop;
  if v_mejor is null then raise exception 'sin_copias' using errcode = 'P0001'; end if;
  insert into public.fantasy_copias (jugador, manager, precio)
  select f.person_id, v_p, f.valor from public.fantasy_jugadores f where f.person_id = any (v_mejor);
  insert into public.fantasy_movimientos (manager, tipo, importe, jornada, clave)
  values (v_p, 'inicio',
          -- si con las copias libres no sale una plantilla dentro del margen, la diferencia con el objetivo va a la caja
          greatest(0, round(public._fantasy_param('cajaInicial') + case when v_mejor_dif > v_margen
            then v_objetivo - (select sum(f.valor) from public.fantasy_jugadores f where f.person_id = any (v_mejor)) else 0 end, 1)),
          v_j, 'inicio:' || v_p);
  if v_j is not null then
    insert into public.fantasy_alineaciones (manager, jornada, titulares, capitan, vice)
    select v_p, v_j, t.ids, t.ids[1], t.ids[2]
    from (select array_agg(x.person_id order by x.valor desc, x.person_id) as ids
          from (select f.person_id, f.valor from public.fantasy_jugadores f where f.person_id = any (v_mejor)
                order by f.valor desc, f.person_id limit public._fantasy_param('alineados')::int) x) t;
  end if;
  return jsonb_build_object('plantilla', to_jsonb(v_mejor), 'dentro_del_margen', v_mejor_dif <= v_margen);
end $$;

create function public.fantasy_fichar(p_jugador text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_p text := public._fantasy_exigir();
  v_j date := public._fantasy_exigir_abierto(v_p);
  v_valor numeric;
begin
  select valor into v_valor from public.fantasy_jugadores where person_id = p_jugador and en_mercado;
  if v_valor is null then raise exception 'jugador_no_valido' using errcode = 'P0001'; end if;
  if p_jugador = v_p then raise exception 'copia_propia' using errcode = 'P0001'; end if;
  if exists (select 1 from public.fantasy_copias where jugador = p_jugador and manager = v_p) then raise exception 'ya_lo_tienes' using errcode = 'P0001'; end if;
  if (select count(*) from public.fantasy_copias where manager = v_p) >= public._fantasy_param('plantilla') then raise exception 'plantilla_llena' using errcode = 'P0001'; end if;
  if public._fantasy_libres(p_jugador) < 1 then raise exception 'sin_copias_libres' using errcode = 'P0001'; end if;
  if public._fantasy_caja(v_p) < v_valor then raise exception 'sin_caja' using errcode = 'P0001'; end if;
  insert into public.fantasy_copias (jugador, manager, precio) values (p_jugador, v_p, v_valor);
  insert into public.fantasy_movimientos (manager, tipo, jugador, importe, jornada) values (v_p, 'fichaje', p_jugador, -v_valor, v_j);
  return jsonb_build_object('precio', v_valor);
end $$;

create function public.fantasy_vender(p_jugador text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_p text := public._fantasy_exigir();
  v_j date := public._fantasy_exigir_abierto(v_p);
  v_valor numeric;
begin
  if not exists (select 1 from public.fantasy_copias where jugador = p_jugador and manager = v_p) then raise exception 'no_lo_tienes' using errcode = 'P0001'; end if;
  select valor into v_valor from public.fantasy_jugadores where person_id = p_jugador;
  delete from public.fantasy_copias where jugador = p_jugador and manager = v_p;
  insert into public.fantasy_movimientos (manager, tipo, jugador, importe, jornada) values (v_p, 'venta', p_jugador, v_valor, v_j);
  perform public._fantasy_quitar_de_alineacion(v_p, p_jugador, v_j);
  return jsonb_build_object('precio', v_valor);
end $$;

-- Clausulazo: sin copias libres, pagando valor x multiplicador se le quita la copia al dueño que se elija; el dueño cobra.
-- Uno por mánager y jornada; una copia robada no se vuelve a robar esa jornada; cerrado desde el sábado a las 20:00.
create function public.fantasy_clausulazo(p_jugador text, p_dueno text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_p text := public._fantasy_exigir();
  v_j date := public._fantasy_exigir_abierto(v_p);
  v_valor numeric; v_precio numeric; v_copia public.fantasy_copias;
begin
  if public._fantasy_clausulas_cerradas(v_j) then raise exception 'clausulas_cerradas' using errcode = 'P0001'; end if;
  select valor into v_valor from public.fantasy_jugadores where person_id = p_jugador and en_mercado;
  if v_valor is null then raise exception 'jugador_no_valido' using errcode = 'P0001'; end if;
  if p_jugador = v_p then raise exception 'copia_propia' using errcode = 'P0001'; end if;
  if p_dueno = v_p then raise exception 'dueno_no_valido' using errcode = 'P0001'; end if;
  if exists (select 1 from public.fantasy_copias where jugador = p_jugador and manager = v_p) then raise exception 'ya_lo_tienes' using errcode = 'P0001'; end if;
  if public._fantasy_libres(p_jugador) > 0 then raise exception 'hay_copias_libres' using errcode = 'P0001'; end if;
  select * into v_copia from public.fantasy_copias where jugador = p_jugador and manager = p_dueno;
  if v_copia.id is null then raise exception 'dueno_no_valido' using errcode = 'P0001'; end if;
  if v_copia.robada_en = v_j then raise exception 'copia_ya_robada' using errcode = 'P0001'; end if;
  if exists (select 1 from public.fantasy_movimientos where manager = v_p and tipo = 'clausulazo' and jornada = v_j) then raise exception 'clausulazo_gastado' using errcode = 'P0001'; end if;
  if (select count(*) from public.fantasy_copias where manager = v_p) >= public._fantasy_param('plantilla') then raise exception 'plantilla_llena' using errcode = 'P0001'; end if;
  v_precio := round(v_valor * public._fantasy_param('clausula'), 1);
  if public._fantasy_caja(v_p) < v_precio then raise exception 'sin_caja' using errcode = 'P0001'; end if;
  update public.fantasy_copias set manager = v_p, precio = v_precio, comprada_en = now(), robada_en = v_j where id = v_copia.id;
  insert into public.fantasy_movimientos (manager, tipo, jugador, otro, importe, jornada) values
    (v_p, 'clausulazo', p_jugador, p_dueno, -v_precio, v_j),
    (p_dueno, 'clausulado', p_jugador, v_p, v_precio, v_j);
  perform public._fantasy_quitar_de_alineacion(p_dueno, p_jugador, v_j);
  return jsonb_build_object('precio', v_precio, 'dueno', p_dueno,
    'jugador', (select nombre from public.fantasy_jugadores where person_id = p_jugador),
    'comprador', (select nombre from public.fantasy_managers where person_id = v_p));
end $$;

-- Alineación de la jornada en juego. El capitán no puede ser el de la jornada anterior.
create function public.fantasy_alinear(p_titulares text[], p_capitan text, p_vice text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_p text := public._fantasy_exigir();
  v_j date := public._fantasy_exigir_abierto(v_p);
  v_t text[] := coalesce(p_titulares, '{}');
  v_anterior text;
begin
  if cardinality(v_t) > public._fantasy_param('alineados') then raise exception 'demasiados' using errcode = 'P0001'; end if;
  if (select count(distinct x) from unnest(v_t) x) <> cardinality(v_t) then raise exception 'repetidos' using errcode = 'P0001'; end if;
  if exists (select 1 from unnest(v_t) x where not exists (select 1 from public.fantasy_copias c where c.manager = v_p and c.jugador = x)) then
    raise exception 'no_lo_tienes' using errcode = 'P0001';
  end if;
  if p_capitan is not null and not (p_capitan = any (v_t)) then raise exception 'capitan_no_alineado' using errcode = 'P0001'; end if;
  if p_vice is not null and (not (p_vice = any (v_t)) or p_vice = p_capitan) then raise exception 'vice_no_valido' using errcode = 'P0001'; end if;
  select a.capitan into v_anterior from public.fantasy_alineaciones a where a.manager = v_p and a.jornada < v_j order by a.jornada desc limit 1;
  if p_capitan is not null and p_capitan = v_anterior then raise exception 'capitan_repetido' using errcode = 'P0001'; end if;
  insert into public.fantasy_alineaciones (manager, jornada, titulares, capitan, vice, arrastrada, cambiada_en)
  values (v_p, v_j, v_t, p_capitan, p_vice, false, now())
  on conflict (manager, jornada) do update set titulares = excluded.titulares, capitan = excluded.capitan, vice = excluded.vice, arrastrada = false, cambiada_en = now();
end $$;

-- Porra: gana o pierde cada equipo que juega. Hasta el primer partido (los gestores también: no depende de la convocatoria).
create function public.fantasy_apostar(p_equipo text, p_pronostico text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_p text := public._fantasy_exigir();
  v_j date := public._fantasy_jornada_actual();
begin
  if not exists (select 1 from public.fantasy_managers where person_id = v_p) then raise exception 'sin_equipo' using errcode = 'P0001'; end if;
  if v_j is null then raise exception 'sin_jornada' using errcode = 'P0001'; end if;
  if public._fantasy_cerrada(v_j) then raise exception 'cerrado' using errcode = 'P0001'; end if;
  if p_pronostico not in ('gana', 'pierde') then raise exception 'pronostico_no_valido' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.eventos e where e.fecha = v_j and e.tipo = 'liga' and e.equipo = p_equipo and e.oficial is not false and e.estado = 'programado' and e.borrado_en is null) then
    raise exception 'equipo_no_juega' using errcode = 'P0001';
  end if;
  insert into public.fantasy_porras (manager, jornada, equipo, pronostico) values (v_p, v_j, p_equipo, p_pronostico)
  on conflict (manager, jornada, equipo) do update set pronostico = excluded.pronostico, puesta_en = now();
end $$;

-- ------------------------------------------------------------------------------------------ funciones de gestores
-- Ajustes: interruptor, parámetros (solo números) y alias de nombres de la hoja. p_recalcular vuelve a puntuar todo.
create function public.fantasy_guardar_ajustes(p_modo text, p_parametros jsonb, p_alias jsonb, p_recalcular boolean default false)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_gestor() then raise exception 'solo_gestores' using errcode = 'P0001'; end if;
  if p_modo is not null and p_modo not in ('apagado', 'gestores', 'todos') then raise exception 'modo_no_valido' using errcode = 'P0001'; end if;
  if p_parametros is not null and (jsonb_typeof(p_parametros) <> 'object'
     or exists (select 1 from jsonb_each(p_parametros) x where jsonb_typeof(x.value) <> 'number' or public._fantasy_param(x.key) is null)) then
    raise exception 'parametros_no_validos' using errcode = 'P0001';
  end if;
  if p_alias is not null and (jsonb_typeof(p_alias) <> 'object'
     or exists (select 1 from jsonb_each_text(p_alias) x where not exists (select 1 from public.jugadores j where j.person_id = x.value))) then
    raise exception 'alias_no_valido' using errcode = 'P0001';
  end if;
  update public.fantasy_config
     set modo = coalesce(p_modo, modo), parametros = coalesce(p_parametros, parametros), alias = coalesce(p_alias, alias),
         cambiado_en = now(), cambiado_por_nombre = public._nombre_gestor()
   where id = 1;
  if p_recalcular then update public.fantasy_jornadas set huella = null, valor_quieto = false; end if;
  if exists (select 1 from public.fantasy_jugadores) then perform public._fantasy_recalcular_valores(); end if;
end $$;

-- --------------------------------------------------------------------------------- funciones del rol de servicio
-- Huella de la hoja de una jornada (si cambia, se vuelve a puntuar) y si están todos sus partidos publicados.
create function public._fantasy_hoja(p_fecha date)
returns table (publicada boolean, huella text) language sql stable security definer set search_path = ''
as $$
  with ev as (
    select e.equipo, e.jornada from public.eventos e
    where e.fecha = p_fecha and e.tipo = 'liga' and e.oficial is not false and e.estado = 'programado' and e.borrado_en is null
      and e.temporada = public._fantasy_temporada()),
  pa as (
    select ev.equipo, p.id, p.pts_local, p.pts_visitante from ev
    join public.liga_partidos p on p.temporada = public._fantasy_temporada() and p.nuestro and p.jornada = ev.jornada
      and p.grupo = case ev.equipo when 'MdA' then 'G1' else 'G2' end
    where exists (select 1 from public.liga_estadisticas_jugador s where s.partido_id = p.id and s.equipo = ev.equipo))
  select (select count(*) from ev) > 0 and (select count(*) from ev) = (select count(*) from pa),
         md5(coalesce((select string_agg(pa.equipo || ':' || pa.pts_local || '-' || pa.pts_visitante || ':' || s.nombre || ':' || s.segundos || ':' || s.pts || ':' || s.mas_menos, '|' order by pa.equipo, s.nombre, s.dorsal)
                       from pa join public.liga_estadisticas_jugador s on s.partido_id = pa.id and s.equipo = pa.equipo), ''))
$$;

-- Jornadas con las estadísticas publicadas que aún no están puntuadas (o cuya hoja ha cambiado), de la más antigua a la más nueva.
create function public.fantasy_pendientes()
returns table (fecha date) language sql stable security definer set search_path = ''
as $$
  select d.fecha from (select distinct e.fecha from public.eventos e
                       where e.tipo = 'liga' and e.oficial is not false and e.estado = 'programado' and e.borrado_en is null
                         and e.temporada = public._fantasy_temporada() and e.fecha <= (now() at time zone 'Europe/Madrid')::date) d
  cross join lateral public._fantasy_hoja(d.fecha) h
  left join public.fantasy_jornadas j on j.fecha = d.fecha
  where h.publicada and (j.puntuada_en is null or j.huella is distinct from h.huella)
  order by d.fecha
$$;

-- Todo lo que hace falta para puntuar una jornada (lo consume src/lib/fantasy/jornada.ts).
create function public.fantasy_datos_jornada(p_fecha date)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_t text := public._fantasy_temporada();
  v_desde date := coalesce((select max(e.fecha) from public.eventos e where e.tipo = 'liga' and e.oficial is not false and e.estado = 'programado'
                             and e.borrado_en is null and e.temporada = v_t and e.fecha < p_fecha), date '2000-01-01');
  v_ev uuid[];
begin
  select array_agg(e.id) into v_ev from public.eventos e
  where e.temporada = v_t and e.oficial is not false and e.estado = 'programado' and e.borrado_en is null
    and ((e.tipo = 'entreno' and e.fecha > v_desde and e.fecha <= p_fecha) or (e.tipo = 'liga' and e.fecha = p_fecha));
  return jsonb_build_object(
    'fecha', p_fecha,
    'huella', (select h.huella from public._fantasy_hoja(p_fecha) h),
    'jugadores', coalesce((select jsonb_agg(jsonb_build_object('person_id', j.person_id, 'nombre_oficial', j.nombre_oficial, 'nombre_visible', j.nombre_visible) order by j.person_id)
                           from public.jugadores j where j.activo and j.rol = 'jugador'), '[]'::jsonb),
    'partidos', coalesce((select jsonb_agg(jsonb_build_object(
                            'equipo', e.equipo, 'evento', e.id, 'partido', p.id, 'jornada', p.jornada,
                            'rival', case when p.local = e.equipo then p.visitante else p.local end,
                            'pts_favor', case when p.local = e.equipo then p.pts_local else p.pts_visitante end,
                            'pts_contra', case when p.local = e.equipo then p.pts_visitante else p.pts_local end,
                            'segundos_equipo', (select coalesce(sum(s.segundos), 0) from public.liga_estadisticas_jugador s where s.partido_id = p.id and s.equipo = e.equipo)))
                          from public.eventos e
                          join public.liga_partidos p on p.temporada = v_t and p.nuestro and p.jornada = e.jornada and p.grupo = case e.equipo when 'MdA' then 'G1' else 'G2' end
                          where e.id = any (v_ev) and e.tipo = 'liga'), '[]'::jsonb),
    'lineas', coalesce((select jsonb_agg(jsonb_build_object('equipo', e.equipo, 'partido', p.id, 'nombre', s.nombre, 'segundos', coalesce(s.segundos, 0), 'pts', coalesce(s.pts, 0), 'mas_menos', coalesce(s.mas_menos, 0)))
                        from public.eventos e
                        join public.liga_partidos p on p.temporada = v_t and p.nuestro and p.jornada = e.jornada and p.grupo = case e.equipo when 'MdA' then 'G1' else 'G2' end
                        join public.liga_estadisticas_jugador s on s.partido_id = p.id and s.equipo = e.equipo
                        where e.id = any (v_ev) and e.tipo = 'liga'), '[]'::jsonb),
    'eventos', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'tipo', e.tipo, 'equipo', e.equipo, 'fecha', e.fecha, 'inicio', e.inicio, 'oficial', e.oficial) order by e.fecha, e.inicio)
                         from public.eventos e where e.id = any (v_ev)), '[]'::jsonb),
    'estados', coalesce((select jsonb_agg(jsonb_build_object('evento_id', e.id, 'person_id', j.person_id, 'estado', ef.respuesta, 'por', ef.por,
                                                             'origen', r.origen, 'cambiado_en', r.cambiado_en, 'primera_en', pr.primera_en))
                         from public.eventos e
                         join public.jugadores j on j.activo and j.rol = 'jugador' and public._invitado(j.person_id, e.id)
                         left join public.respuestas r on r.evento_id = e.id and r.person_id = j.person_id
                         left join public.fantasy_primeras_respuestas pr on pr.evento_id = e.id and pr.person_id = j.person_id
                         cross join lateral public._estado_efectivo(e.id, j.person_id, r.respuesta) ef
                         where e.id = any (v_ev) and not ef.fuera), '[]'::jsonb),
    'avisos', coalesce((select jsonb_agg(jsonb_build_object('person_id', a.person_id, 'eventos', to_jsonb(a.eventos), 'enviado_en', a.enviado_en))
                        from public.avisos_registro a
                        where a.tipo = 'recordatorio' and a.person_id is not null and a.enviado_en is not null and a.eventos && v_ev), '[]'::jsonb),
    'asistencia', coalesce((select jsonb_agg(jsonb_build_object('evento_id', e.id, 'person_id', a.person_id, 'estado', a.estado))
                            from public.asistencia_eventos a
                            join public.eventos e on e.id = any (v_ev)
                              and (a.evento_ref = e.id::text or (a.origen = 'sporteasy' and a.ambito = 'entrenos' and e.tipo = 'entreno' and a.fecha = e.fecha))
                            where a.temporada = v_t), '[]'::jsonb),
    'convocados', coalesce((select jsonb_agg(distinct x ->> 'person_id')
                            from public.convocatorias c, jsonb_each(c.equipos) eq,
                                 jsonb_array_elements(case when jsonb_typeof(eq.value) = 'array' then eq.value else '[]'::jsonb end) x
                            where c.fecha = p_fecha and c.estado = 'aprobada'), '[]'::jsonb),
    'alias', (select alias from public.fantasy_config where id = 1),
    'parametros', (select parametros from public.fantasy_config where id = 1),
    'managers', coalesce((select jsonb_agg(jsonb_build_object('person_id', m.person_id, 'nombre', m.nombre, 'alta_en', m.alta_en,
                             'plantilla', coalesce((select jsonb_agg(c.jugador) from public.fantasy_copias c where c.manager = m.person_id), '[]'::jsonb),
                             'alineacion', (select to_jsonb(a) from public.fantasy_alineaciones a where a.manager = m.person_id and a.jornada = p_fecha),
                             'anterior', (select to_jsonb(a) from public.fantasy_alineaciones a where a.manager = m.person_id and a.jornada < p_fecha order by a.jornada desc limit 1),
                             'porras', coalesce((select jsonb_object_agg(po.equipo, po.pronostico) from public.fantasy_porras po where po.manager = m.person_id and po.jornada = p_fecha), '{}'::jsonb))
                           order by m.person_id)
                          from public.fantasy_managers m
                          where m.alta_en < coalesce(public._fantasy_primer_partido(p_fecha), now())), '[]'::jsonb),
    'ronda', coalesce((select j.ronda from public.fantasy_jornadas j where j.fecha = p_fecha and j.ronda is not null),
                      (select count(*)::int from public.fantasy_jornadas j where j.ronda is not null and j.fecha <> p_fecha)));
end $$;

-- Guarda una jornada puntuada. Repetible: todo va por su clave (jornada + persona), nada se duplica; el ingreso de cada
-- mánager es UN movimiento por jornada, que se corrige si los puntos cambian.
create function public.fantasy_guardar_jornada(p jsonb)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_f date := (p ->> 'fecha')::date;
  -- ¿Se vuelve a puntuar solo por una corrección de asistencia? Entonces el valor de mercado se queda quieto.
  v_quieto boolean := coalesce((select j.valor_quieto from public.fantasy_jornadas j where j.fecha = v_f and j.puntuada_en is not null), false);
  v_viejos jsonb := (select jsonb_object_agg(pj.person_id, pj.total_valor) from public.fantasy_puntos_jugador pj where pj.jornada = v_f);
begin
  perform pg_advisory_xact_lock(hashtext('mdfantasy'));
  delete from public.fantasy_puntos_jugador where jornada = v_f;
  insert into public.fantasy_puntos_jugador (jornada, person_id, rendimiento, compromiso, total, total_valor, minutos, convocado, doblete, detalle)
  select v_f, x ->> 'person_id', (x ->> 'rendimiento')::numeric, (x ->> 'compromiso')::numeric, (x ->> 'total')::numeric,
         case when v_quieto then coalesce((v_viejos ->> (x ->> 'person_id'))::numeric, (x ->> 'total')::numeric) else (x ->> 'total')::numeric end,
         (x ->> 'minutos')::int, (x ->> 'convocado')::boolean, (x ->> 'doblete')::boolean, coalesce(x -> 'detalle', '{}'::jsonb)
  from jsonb_array_elements(coalesce(p -> 'jugadores', '[]'::jsonb)) x;

  insert into public.fantasy_alineaciones (manager, jornada, titulares, capitan, vice, arrastrada)
  select x ->> 'manager', v_f, array(select jsonb_array_elements_text(x -> 'titulares')), x ->> 'capitan', x ->> 'vice', true
  from jsonb_array_elements(coalesce(p -> 'arrastradas', '[]'::jsonb)) x
  on conflict (manager, jornada) do nothing;

  delete from public.fantasy_puntos_manager where jornada = v_f;
  insert into public.fantasy_puntos_manager (jornada, manager, alineacion, porra, total, ingreso, detalle)
  select v_f, x ->> 'manager', (x ->> 'alineacion')::numeric, (x ->> 'porra')::numeric, (x ->> 'total')::numeric, (x ->> 'ingreso')::numeric, coalesce(x -> 'detalle', '{}'::jsonb)
  from jsonb_array_elements(coalesce(p -> 'managers', '[]'::jsonb)) x;

  insert into public.fantasy_movimientos (manager, tipo, importe, jornada, clave)
  select x ->> 'manager', 'ingreso', (x ->> 'ingreso')::numeric, v_f, 'ingreso:' || v_f || ':' || (x ->> 'manager')
  from jsonb_array_elements(coalesce(p -> 'managers', '[]'::jsonb)) x
  on conflict (clave) do update set importe = excluded.importe;

  update public.fantasy_porras po set acierto = (po.pronostico = (p -> 'resultados' ->> po.equipo))
   where po.jornada = v_f and (p -> 'resultados') ? po.equipo;

  delete from public.fantasy_duelos where jornada = v_f;
  insert into public.fantasy_duelos (jornada, manager_a, manager_b, puntos_a, puntos_b)
  select v_f, x ->> 'a', x ->> 'b', (x ->> 'puntos_a')::numeric, (x ->> 'puntos_b')::numeric
  from jsonb_array_elements(coalesce(p -> 'duelos', '[]'::jsonb)) x;

  delete from public.fantasy_logros where jornada = v_f;
  insert into public.fantasy_logros (manager, logro, jornada, texto)
  select x ->> 'manager', x ->> 'logro', v_f, x ->> 'texto' from jsonb_array_elements(coalesce(p -> 'logros', '[]'::jsonb)) x
  on conflict do nothing;

  insert into public.fantasy_jornadas (fecha, temporada, puntuada_en, huella, ronda, sin_casar, resultados)
  values (v_f, public._fantasy_temporada(), now(), p ->> 'huella', (p ->> 'ronda')::int,
          array(select jsonb_array_elements_text(coalesce(p -> 'sin_casar', '[]'::jsonb))), coalesce(p -> 'resultados', '{}'::jsonb))
  on conflict (fecha) do update set puntuada_en = now(), huella = excluded.huella, ronda = excluded.ronda, sin_casar = excluded.sin_casar, resultados = excluded.resultados, valor_quieto = false;
  -- Una puntuación normal (jornada nueva, hoja cambiada, parámetros) pone al día el valor de TODO: también lo que una
  -- corrección de asistencia había dejado quieto.
  if not v_quieto then update public.fantasy_puntos_jugador set total_valor = total where total_valor is distinct from total; end if;

  perform public._fantasy_recalcular_valores();
end $$;

-- Entrenos oficiales de AYER sin asistencia real apuntada (para el aviso «¿Faltó alguien ayer?» a los gestores).
create function public.fantasy_entrenos_de_ayer()
returns table (evento_id uuid, fecha date) language sql stable security definer set search_path = ''
as $$
  select e.id, e.fecha from public.eventos e
  where e.tipo = 'entreno' and e.oficial is not false and e.estado = 'programado' and e.borrado_en is null
    and e.fecha = (now() at time zone 'Europe/Madrid')::date - 1
    and not exists (select 1 from public.asistencia_eventos a where a.evento_ref = e.id::text and a.origen = 'plataforma')
$$;

-- ----------------------------------------------------------------------------------------------------- disparador
-- Apunta la PRIMERA respuesta que da el propio jugador a cada evento. Nunca puede hacer fallar la respuesta.
create function public._fantasy_primera_respuesta()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  begin
    if new.origen = 'jugador' and new.respuesta <> 'sin_responder' then
      insert into public.fantasy_primeras_respuestas (evento_id, person_id, primera_en)
      values (new.evento_id, new.person_id, coalesce(new.cambiado_en, now()))
      on conflict do nothing;
    end if;
  exception when others then null;
  end;
  return new;
end $$;
create trigger fantasy_primera_respuesta after insert or update on public.respuestas
  for each row execute function public._fantasy_primera_respuesta();

-- Corregir la asistencia real (un «no vino» mal marcado, o al revés) de un entreno o partido de una jornada YA puntuada
-- la deja pendiente: se vuelve a puntuar al momento desde la web (lib/fantasy/servidor.ts) o, como muy tarde, en la
-- siguiente pasada de la tarea. Nunca puede hacer fallar el pase de lista.
create function public._fantasy_asistencia_cambia()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_f date := coalesce(new.fecha, old.fecha);
begin
  if tg_op = 'UPDATE' and new.estado is not distinct from old.estado and new.fecha = old.fecha then return null; end if;
  begin
    update public.fantasy_jornadas set huella = null, valor_quieto = true
    where puntuada_en is not null and fecha = (select min(j.fecha) from public.fantasy_jornadas j where j.fecha >= v_f);
  exception when others then null;
  end;
  return null;
end $$;
create trigger fantasy_asistencia_cambia after insert or update or delete on public.asistencia_eventos
  for each row execute function public._fantasy_asistencia_cambia();

-- -------------------------------------------------------------------------------------------------------- permisos
do $$
declare t text;
begin
  foreach t in array array['fantasy_config', 'fantasy_managers', 'fantasy_jugadores', 'fantasy_copias', 'fantasy_movimientos', 'fantasy_jornadas',
                           'fantasy_alineaciones', 'fantasy_porras', 'fantasy_duelos', 'fantasy_puntos_jugador', 'fantasy_puntos_manager',
                           'fantasy_logros', 'fantasy_primeras_respuestas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
  end loop;
  foreach t in array array['fantasy_managers', 'fantasy_jugadores', 'fantasy_copias', 'fantasy_movimientos', 'fantasy_jornadas',
                           'fantasy_duelos', 'fantasy_puntos_jugador', 'fantasy_puntos_manager', 'fantasy_logros'] loop
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using (public._fantasy_acceso())', t || '_leer', t);
  end loop;
end $$;

grant select on public.fantasy_config to authenticated;
create policy fantasy_config_leer on public.fantasy_config for select to authenticated using (public.is_gestor());

grant select on public.fantasy_alineaciones, public.fantasy_porras to authenticated;
create policy fantasy_alineaciones_leer on public.fantasy_alineaciones for select to authenticated
  using (public._fantasy_acceso() and (manager = public._mi_person_id() or public._fantasy_cerrada(jornada)));
create policy fantasy_porras_leer on public.fantasy_porras for select to authenticated
  using (public._fantasy_acceso() and (manager = public._mi_person_id() or public._fantasy_cerrada(jornada)));

grant select, insert, update, delete on public.fantasy_config, public.fantasy_managers, public.fantasy_jugadores, public.fantasy_copias,
  public.fantasy_movimientos, public.fantasy_jornadas, public.fantasy_alineaciones, public.fantasy_porras, public.fantasy_duelos,
  public.fantasy_puntos_jugador, public.fantasy_puntos_manager, public.fantasy_logros, public.fantasy_primeras_respuestas to service_role;

do $$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and (p.proname like 'fantasy\_%' or p.proname like '\_fantasy\_%') loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;
grant execute on function public.fantasy_acceso(), public.fantasy_estado(), public.fantasy_alta(), public.fantasy_fichar(text),
  public.fantasy_vender(text), public.fantasy_clausulazo(text, text), public.fantasy_alinear(text[], text, text),
  public.fantasy_apostar(text, text), public.fantasy_guardar_ajustes(text, jsonb, jsonb, boolean) to authenticated;
-- las usan las políticas de lectura (solo devuelven sí o no)
grant execute on function public._fantasy_acceso(), public._fantasy_cerrada(date) to authenticated;
grant execute on function public.fantasy_pendientes(), public.fantasy_datos_jornada(date), public.fantasy_guardar_jornada(jsonb),
  public.fantasy_entrenos_de_ayer(), public._fantasy_modo() to service_role;

notify pgrst, 'reload schema';
