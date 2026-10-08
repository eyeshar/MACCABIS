-- =============================================================================
-- Paso 3 (D99): AVISOS AL MOVIL (Web Push de la web instalada, D78).
--
-- SOLO ADITIVA (D94): dos tablas nuevas, sus politicas y dos funciones del jugador. Reversion al lado:
-- 20261008101000_avisos.revertir.sql.
--
--  - suscripciones_avisos: una por movil (varias por persona). Se da de alta y de baja SOLO con alta_suscripcion y
--    baja_suscripcion (la baja la deja inactiva, no la borra). La tarea de avisos la desactiva sola si el servicio de
--    avisos responde 404/410 (suscripcion caducada).
--  - avisos_registro: cada aviso que toca enviar (tipo, destinatario, eventos, programado para, enviado, resultado). La
--    clave es unica: repetir la tarea no duplica nada (se escribe aqui ANTES de enviar).
-- Lo escribe la tarea del servidor (rol service_role, con la clave que solo vive en .env.local y en Vercel).
-- =============================================================================

create table public.suscripciones_avisos (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null,
  person_id       text,
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  navegador       text,
  creado_en       timestamptz not null default now(),
  ultimo_envio_ok timestamptz,
  activa          boolean not null default true,
  desactivada_en  timestamptz,
  motivo_baja     text check (motivo_baja is null or motivo_baja in ('baja', 'caducada', 'otro_usuario'))
);
create index suscripciones_avisos_user_idx on public.suscripciones_avisos (user_id) where activa;
create index suscripciones_avisos_person_idx on public.suscripciones_avisos (person_id) where activa;

create table public.avisos_registro (
  id              uuid primary key default gen_random_uuid(),
  clave           text not null unique,
  tipo            text not null check (tipo in ('recordatorio', 'cambio', 'cancelacion', 'prueba', 'gestores')),
  user_id         uuid,
  person_id       text,
  eventos         uuid[] not null default '{}',
  titulo          text not null,
  cuerpo          text not null,
  url             text not null default '/mi-zona',
  programado_para timestamptz not null,
  creado_en       timestamptz not null default now(),
  enviado_en      timestamptz,
  resultado       text,
  enviados        int not null default 0,
  fallidos        int not null default 0
);
create index avisos_registro_pendientes_idx on public.avisos_registro (programado_para) where enviado_en is null;

alter table public.suscripciones_avisos enable row level security;
alter table public.avisos_registro      enable row level security;

-- Cada cual ve sus moviles; los gestores ven todo (para "Avisos: Si/No" y "Sin avisos activados").
create policy cada_cual_lee_las_suyas on public.suscripciones_avisos for select to authenticated
  using (user_id = auth.uid() or public.is_gestor());
create policy gestores_leen on public.avisos_registro for select to authenticated using (public.is_gestor());

revoke all on public.suscripciones_avisos, public.avisos_registro from anon, authenticated, public;
grant select on public.suscripciones_avisos, public.avisos_registro to authenticated;

-- La tarea de avisos (servidor, service_role) lee lo que necesita y escribe solo en estas dos tablas y en las marcas
-- "aviso_encolado" de las alertas.
do $$
begin
  grant select, insert, update on public.suscripciones_avisos, public.avisos_registro to service_role;
  grant select on public.eventos, public.pistas, public.jugadores, public.respuestas, public.ausencias_periodo,
                  public.gestores, public.descansos, public.respuestas_web_config, public.respuestas_domingo to service_role;
  grant select, update on public.alertas_gestores to service_role;
exception when undefined_object then
  null;
end $$;

/** Alta (o renovacion) de la suscripcion de ESTE movil para quien tiene sesion. Funciona con el interruptor apagado
 *  (D99.12): activar avisos y recibir el de prueba no depende de responder en la web. */
create function public.alta_suscripcion(p_endpoint text, p_p256dh text, p_auth text, p_navegador text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'sin_sesion' using errcode = 'P0001'; end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000 or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'suscripcion_no_valida' using errcode = 'P0001';
  end if;
  insert into public.suscripciones_avisos (user_id, person_id, endpoint, p256dh, auth, navegador)
  values (auth.uid(), public._mi_person_id(), p_endpoint, p_p256dh, p_auth, left(p_navegador, 200))
  on conflict (endpoint) do update set
    user_id = excluded.user_id, person_id = excluded.person_id, p256dh = excluded.p256dh, auth = excluded.auth,
    navegador = excluded.navegador, activa = true, desactivada_en = null, motivo_baja = null
  returning id into v_id;
  -- Si este movil era de otra cuenta (otra persona entro en el), esa ya no recibe en el.
  return v_id;
end $$;

/** Baja de la suscripcion de ESTE movil (solo la propia). Queda inactiva, no se borra. */
create function public.baja_suscripcion(p_endpoint text)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  update public.suscripciones_avisos set activa = false, desactivada_en = now(), motivo_baja = 'baja'
   where endpoint = p_endpoint and user_id = auth.uid() and activa;
  return found;
end $$;

-- ---------------------------------------------------------------- activacion (D99.13, D103)
-- Jornadas seguidas sin arreglos a mano, contando hacia atras desde la ultima marcada: una "con arreglo" o un hueco
-- cortan la cuenta.
create function public._jornadas_limpias_seguidas()
returns int language plpgsql stable security definer set search_path = ''
as $$
declare
  r record;
  v_esperada int;
  n int := 0;
begin
  for r in select jornada, estado from public.jornadas_control where temporada = '2026-27' order by jornada desc loop
    if v_esperada is not null and r.jornada <> v_esperada then exit; end if;
    if r.estado <> 'limpia' then exit; end if;
    n := n + 1;
    v_esperada := r.jornada - 1;
  end loop;
  return n;
end $$;

-- Solo Ivan maneja el interruptor, las jornadas y la casilla de SportEasy (D103): el gestor con sesion cuyo correo es
-- el de la ficha de jugador de respuestas_web_config.responsable_person_id ('villaescusa-silva-ivan').
create function public._es_responsable()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.gestores g
    join public.jugadores j on lower(j.email) = lower(g.email)
    join public.respuestas_web_config c on c.id = 1 and c.responsable_person_id = j.person_id
    where g.user_id = auth.uid())
$$;

create function public._exigir_responsable()
returns text language plpgsql stable security definer set search_path = ''
as $$
declare v_nombre text;
begin
  if not public._es_responsable() then raise exception 'solo_responsable' using errcode = 'P0001'; end if;
  select nombre into v_nombre from public.gestores where user_id = auth.uid();
  return coalesce(v_nombre, 'gestor');
end $$;

/** Las cuatro condiciones de la tarjeta "Respuestas en la web: activar" (todos los gestores la ven; solo Ivan la
 *  maneja). Condicion 2: un minimo configurable (20) de los de la plantilla han entrado, con la lista de quien falta. */
create function public.estado_activacion()
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
  from public.jugadores j where j.activo and (j.ficha_mda or j.ficha_mdl);
  return jsonb_build_object(
    'encendido', c.encendido, 'encendido_desde', c.encendido_desde, 'sporteasy_comprobado', c.sporteasy_comprobado,
    'cambiado_en', c.cambiado_en, 'cambiado_por', c.cambiado_por_nombre,
    'jornadas_seguidas', public._jornadas_limpias_seguidas(), 'plantilla', v_plantilla, 'entrados', v_entrados,
    'minimo_entrados', least(c.minimo_entrados, v_plantilla), 'faltan_por_entrar', v_faltan, 'con_avisos', v_avisos,
    'puede_manejar', public._es_responsable(),
    'se_puede_encender', public._jornadas_limpias_seguidas() >= 3 and v_entrados >= least(c.minimo_entrados, v_plantilla)
                         and c.sporteasy_comprobado);
end $$;

/** Enciende o apaga "respuestas en la web" (solo Ivan). Encender exige las condiciones 1, 2 y 4 (la 3 es informativa);
 *  apagar se puede siempre y no pierde nada. Cada cambio queda registrado (quien y cuando). */
create function public.cambiar_interruptor(p_encender boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_nombre text := public._exigir_responsable();
  v_estado jsonb;
begin
  v_estado := public.estado_activacion();
  if p_encender and not (v_estado->>'se_puede_encender')::boolean then
    raise exception 'condiciones_sin_cumplir' using errcode = 'P0001';
  end if;
  update public.respuestas_web_config set encendido = p_encender,
         encendido_desde = case when p_encender then now() else encendido_desde end,
         cambiado_en = now(), cambiado_por_nombre = v_nombre
   where id = 1;
  insert into public.respuestas_web_registro (por_user_id, por_nombre, que)
  values (auth.uid(), v_nombre, case when p_encender then 'encender' else 'apagar' end);
  return public.estado_activacion();
end $$;

/** Casilla 4: "SportEasy deja de pedir respuesta, comprobado por Claude" (solo Ivan). Queda registrada. */
create function public.marcar_sporteasy(p_comprobado boolean)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_nombre text := public._exigir_responsable();
begin
  update public.respuestas_web_config set sporteasy_comprobado = p_comprobado where id = 1;
  insert into public.respuestas_web_registro (por_user_id, por_nombre, que)
  values (auth.uid(), v_nombre, case when p_comprobado then 'sporteasy_comprobado' else 'sporteasy_sin_comprobar' end);
  return public.estado_activacion();
end $$;

/** Casilla de una jornada (solo Ivan): 'limpia' o 'con_arreglo' (la cuenta vuelve a 0). Queda registrada. */
create function public.marcar_jornada(p_jornada int, p_estado text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_nombre text := public._exigir_responsable();
begin
  if p_estado not in ('limpia', 'con_arreglo') then raise exception 'estado_no_valido' using errcode = 'P0001'; end if;
  insert into public.jornadas_control (temporada, jornada, estado, marcado_por_nombre)
  values ('2026-27', p_jornada, p_estado, v_nombre)
  on conflict (temporada, jornada) do update set estado = excluded.estado, marcado_por_nombre = excluded.marcado_por_nombre,
    marcado_en = now();
  insert into public.respuestas_web_registro (por_user_id, por_nombre, que, detalle)
  values (auth.uid(), v_nombre, case when p_estado = 'limpia' then 'jornada_limpia' else 'jornada_con_arreglo' end, 'J' || p_jornada);
  return public.estado_activacion();
end $$;

revoke execute on function public.alta_suscripcion(text, text, text, text), public.baja_suscripcion(text),
  public._jornadas_limpias_seguidas(), public._es_responsable(), public._exigir_responsable(), public.estado_activacion(),
  public.cambiar_interruptor(boolean), public.marcar_sporteasy(boolean), public.marcar_jornada(int, text)
  from public, anon, authenticated;
grant execute on function public.alta_suscripcion(text, text, text, text), public.baja_suscripcion(text),
  public.estado_activacion(), public.cambiar_interruptor(boolean), public.marcar_sporteasy(boolean),
  public.marcar_jornada(int, text) to authenticated;
revoke insert, update on public.jornadas_control from authenticated;
-- El interruptor solo cambia con cambiar_interruptor (que comprueba responsable y condiciones): nadie lo toca a mano.
revoke update on public.respuestas_web_config from authenticated;