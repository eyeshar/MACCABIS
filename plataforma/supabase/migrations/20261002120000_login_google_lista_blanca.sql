-- =============================================================================
-- Login unico con Google (o codigo por correo) para jugadores y gestores (D68)
-- =============================================================================
-- Sustituye el modelo de enlaces personales /j/<token> de la v0 (D45, derogada
-- por D68, ver docs/DECISIONS.md). Resumen del modelo nuevo:
--
--  * Todo el mundo entra con su sesion de Supabase Auth: "Entrar con Google"
--    o, de respaldo, un codigo de un solo uso por correo (OTP). Ya no hay
--    contrasenas ni enlaces secretos.
--  * LISTA BLANCA: solo puede crear una cuenta quien tiene su correo dado de
--    alta en `jugadores.email` o en `gestores.email`. Un correo desconocido
--    nunca llega a crear un usuario: lo bloquea el hook "Before User Created"
--    de Supabase (funcion `public.antes_de_crear_usuario`, se registra a mano
--    en el panel, ver plataforma/LEEME.md) llamando a `public.correo_permitido`.
--  * `auth.users` se vincula a `jugadores`/`gestores` POR CORREO. Un jugador
--    no tiene fila propia con permisos directos: sigue identificandose con
--    funciones `security definer` (`mi_zona`, `guardar_pedido`...), igual que
--    en la v0, solo que ahora usan `auth.uid()` en vez de un token.
--  * `anon` se queda SIN NINGUN permiso: ni tablas ni funciones. Todo pasa por
--    una sesion real.
--  * Se retiran: la tabla `enlaces`, las 4 funciones que podia llamar `anon`
--    (en su forma con token) y las de gestionar enlaces.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. jugadores: columna de correo (la usa el propio jugador para entrar)
-- ---------------------------------------------------------------------------
alter table public.jugadores add column email text;
alter table public.jugadores add constraint jugadores_email_formato
  check (email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');
create unique index jugadores_email_unico on public.jugadores (lower(email)) where email is not null;

-- ---------------------------------------------------------------------------
-- 2. gestores: permitir reservar una plaza por correo ANTES de que exista el
--    usuario (hace falta para la lista blanca: el hook tiene que poder
--    encontrar el correo de un futuro gestor antes de su primer login).
-- ---------------------------------------------------------------------------
alter table public.gestores drop constraint gestores_pkey;
alter table public.gestores add column id uuid not null default gen_random_uuid();
alter table public.gestores add column email text;
update public.gestores g set email = lower(u.email) from auth.users u where u.id = g.user_id;
alter table public.gestores alter column email set not null;
alter table public.gestores add constraint gestores_email_formato
  check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');
alter table public.gestores alter column user_id drop not null;
alter table public.gestores add primary key (id);
create unique index gestores_email_unico on public.gestores (lower(email));
create unique index gestores_user_id_unico on public.gestores (user_id) where user_id is not null;

-- Vincula el usuario nuevo con su plaza de gestor reservada por correo, si la hay.
create or replace function public.vincular_gestor_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.gestores set user_id = new.id
   where lower(email) = lower(new.email) and user_id is null;
  return new;
end $$;

drop trigger if exists vincular_gestor_nuevo_usuario on auth.users;
create trigger vincular_gestor_nuevo_usuario
  after insert on auth.users
  for each row execute function public.vincular_gestor_nuevo_usuario();

-- GoTrue inserta en auth.users como supabase_auth_admin: ese rol necesita
-- EXECUTE sobre la funcion del trigger para que dispare (igual que con
-- antes_de_crear_usuario). No existe en la pila local de pruebas.
do $$
begin
  grant execute on function public.vincular_gestor_nuevo_usuario() to supabase_auth_admin;
exception when undefined_object then
  null;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Lista blanca: ¿puede entrar este correo?
-- ---------------------------------------------------------------------------
create or replace function public.correo_permitido(p_email text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select
    exists (select 1 from public.jugadores where lower(email) = lower(p_email))
    or exists (select 1 from public.gestores where lower(email) = lower(p_email))
$$;

-- Hook "Before User Created" (Authentication > Hooks en el panel de Supabase,
-- ver plataforma/LEEME.md: hay que registrarlo a mano, no se activa solo).
-- Contrato de Supabase: recibe {"user": {...}, "metadata": {...}} y devuelve
-- '{}' para dejar pasar, o {"error": {"http_code":.., "message":..}} para
-- rechazar. Nunca ejecutable por anon/authenticated: solo por GoTrue.
create or replace function public.antes_de_crear_usuario(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(event->'user'->>'email');
begin
  if v_email is not null and public.correo_permitido(v_email) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Este correo no esta dado de alta en Maccabis. Habla con Ivan, Carlos o Edu.'
  ));
end $$;

revoke execute on function public.antes_de_crear_usuario(jsonb) from public, anon, authenticated;
-- supabase_auth_admin es el rol con el que corre GoTrue en el proyecto real.
-- No existe en la pila local de pruebas (pila.mjs no lo necesita: emula el
-- hook llamando a correo_permitido directamente). Por eso el grant es "best
-- effort": si el rol no existe (pruebas locales), se ignora sin romper la migracion.
do $$
begin
  grant execute on function public.antes_de_crear_usuario(jsonb) to supabase_auth_admin;
exception when undefined_object then
  null;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Identificacion del jugador con sesion, por correo (sustituye al token)
-- ---------------------------------------------------------------------------
create or replace function public._mi_jugador()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select j.id
  from public.jugadores j
  join auth.users u on lower(u.email) = lower(j.email)
  where u.id = auth.uid() and j.activo
$$;

-- Todo lo que necesita la zona personal. null = no hay jugador para esta sesion.
create or replace function public.mi_zona()
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_jugador uuid := public._mi_jugador();
  v_campana uuid;
  v_out jsonb;
begin
  if v_jugador is null then
    return null;
  end if;

  v_campana := public._campana_actual();

  select jsonb_build_object(
    'jugador', jsonb_build_object('nombre_visible', j.nombre_visible, 'nombre_oficial', j.nombre_oficial, 'person_id', j.person_id),
    'campana', (
      select jsonb_build_object(
        'id', c.id, 'nombre', c.nombre, 'proveedor', c.proveedor, 'estado', c.estado,
        'fecha_limite', c.fecha_limite, 'precios', c.precios, 'guia_tallas_url', c.guia_tallas_url,
        'abierta_ahora', public._campana_abierta(c.id))
      from public.campanas_ropa c where c.id = v_campana),
    'pedidos', coalesce((
      select jsonb_agg(public._pedido_json(p) || jsonb_build_object('campana_nombre', c.nombre, 'campana_abierta', public._campana_abierta(c.id))
                       order by c.creado_en desc, p.creado_en)
      from public.pedidos_ropa p join public.campanas_ropa c on c.id = p.campana_id
      where p.jugador_id = v_jugador), '[]'::jsonb)
  ) into v_out
  from public.jugadores j where j.id = v_jugador;

  return v_out;
end $$;

-- ¿Esta cogido ese dorsal? Solo responde si/no: nunca dice de quien.
create or replace function public.dorsal_cogido(p_campana uuid, p_dorsal int, p_pedido uuid default null)
returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if public._mi_jugador() is null then
    raise exception 'sin_sesion_de_jugador' using errcode = '28000';
  end if;
  return public._dorsal_cogido(p_campana, p_dorsal, p_pedido);
end $$;

-- Crear (p_pedido.id vacio) o modificar un pedido propio.
create or replace function public.guardar_pedido(p_pedido jsonb)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_jugador uuid := public._mi_jugador();
  v_id uuid := nullif(p_pedido->>'id', '')::uuid;
  v_campana uuid := nullif(p_pedido->>'campana_id', '')::uuid;
  v_para text := coalesce(p_pedido->>'para', 'yo');
  v_nombre_completo text := btrim(coalesce(p_pedido->>'nombre_completo', ''));
  v_nombre_ropa text := nullif(upper(btrim(coalesce(p_pedido->>'nombre_ropa', ''))), '');
  v_dorsal int;
  v_tallas jsonb := coalesce(p_pedido->'tallas', '{}'::jsonb);
  v_t_camiseta text := nullif(v_tallas->>'camiseta', '');
  v_t_pantalon text := nullif(v_tallas->>'pantalon', '');
  v_t_cubre text := nullif(v_tallas->>'cubre', '');
  v_t_sudadera text := nullif(v_tallas->>'sudadera', '');
  v_existente public.pedidos_ropa;
  v_t text;
begin
  if v_jugador is null then
    return jsonb_build_object('ok', false, 'error', 'sin_sesion_de_jugador');
  end if;

  if v_id is not null then
    select * into v_existente from public.pedidos_ropa where id = v_id and jugador_id = v_jugador;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'no_encontrado');
    end if;
    v_campana := v_existente.campana_id;
  end if;

  if v_campana is null or not public._campana_abierta(v_campana) then
    return jsonb_build_object('ok', false, 'error', 'campana_cerrada');
  end if;

  foreach v_t in array array['camiseta', 'pantalon', 'cubre', 'sudadera'] loop
    if v_tallas ? v_t and nullif(v_tallas->>v_t, '') is null then
      return jsonb_build_object('ok', false, 'error', 'falta_talla', 'prenda', v_t);
    end if;
  end loop;
  foreach v_t in array array[v_t_camiseta, v_t_pantalon, v_t_cubre, v_t_sudadera] loop
    if v_t is not null and not (v_t = any (public.tallas_vive())) then
      return jsonb_build_object('ok', false, 'error', 'talla_invalida');
    end if;
  end loop;
  if coalesce(v_t_camiseta, v_t_pantalon, v_t_cubre, v_t_sudadera) is null then
    return jsonb_build_object('ok', false, 'error', 'sin_prendas');
  end if;

  if v_para not in ('yo', 'familiar') then
    return jsonb_build_object('ok', false, 'error', 'datos_invalidos');
  end if;
  if length(v_nombre_completo) not between 3 and 80 then
    return jsonb_build_object('ok', false, 'error', 'falta_nombre_completo');
  end if;

  if coalesce(v_t_camiseta, v_t_cubre, v_t_sudadera) is not null then
    if v_nombre_ropa is null or length(v_nombre_ropa) > 15 then
      return jsonb_build_object('ok', false, 'error', 'falta_nombre_ropa');
    end if;
  else
    v_nombre_ropa := null;
  end if;

  if coalesce(v_t_camiseta, v_t_pantalon, v_t_cubre) is not null then
    begin
      v_dorsal := (p_pedido->>'dorsal')::int;
    exception when others then
      v_dorsal := null;
    end;
    if v_dorsal is null or v_dorsal not between 0 and 99 then
      return jsonb_build_object('ok', false, 'error', 'dorsal_invalido');
    end if;
    if v_para = 'yo' and public._dorsal_cogido(v_campana, v_dorsal, v_id) then
      return jsonb_build_object('ok', false, 'error', 'dorsal_cogido');
    end if;
  else
    v_dorsal := null;
  end if;

  if v_id is null then
    insert into public.pedidos_ropa (campana_id, jugador_id, para, nombre_completo, nombre_ropa, dorsal,
                                     talla_camiseta, talla_pantalon, talla_cubre, talla_sudadera, actualizado_por)
    values (v_campana, v_jugador, v_para, v_nombre_completo, v_nombre_ropa, v_dorsal,
            v_t_camiseta, v_t_pantalon, v_t_cubre, v_t_sudadera, 'jugador')
    returning id into v_id;
  else
    update public.pedidos_ropa set
      para = v_para, nombre_completo = v_nombre_completo, nombre_ropa = v_nombre_ropa, dorsal = v_dorsal,
      talla_camiseta = v_t_camiseta, talla_pantalon = v_t_pantalon,
      talla_cubre = v_t_cubre, talla_sudadera = v_t_sudadera, actualizado_por = 'jugador'
    where id = v_id and jugador_id = v_jugador;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- Anular un pedido propio mientras la campana este abierta.
create or replace function public.anular_pedido(p_pedido uuid)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_jugador uuid := public._mi_jugador();
  v_campana uuid;
begin
  if v_jugador is null then
    return jsonb_build_object('ok', false, 'error', 'sin_sesion_de_jugador');
  end if;
  select campana_id into v_campana from public.pedidos_ropa where id = p_pedido and jugador_id = v_jugador;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_encontrado');
  end if;
  if not public._campana_abierta(v_campana) then
    return jsonb_build_object('ok', false, 'error', 'campana_cerrada');
  end if;
  delete from public.pedidos_ropa where id = p_pedido and jugador_id = v_jugador;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------
-- 5. Se retiran los enlaces y lo que solo servia para ellos
-- ---------------------------------------------------------------------------
drop function if exists public.zona_jugador(text);
drop function if exists public.dorsal_cogido(text, uuid, int, uuid);
drop function if exists public.guardar_pedido(text, jsonb);
drop function if exists public.anular_pedido(text, uuid);
drop function if exists public.regenerar_enlace(uuid);
drop function if exists public.anular_enlace(uuid);
drop function if exists public._jugador_de_token(text);
drop function if exists public.nuevo_token();
drop table if exists public.enlaces;

-- ---------------------------------------------------------------------------
-- 6. Permisos: anon se queda SIN NADA. authenticated solo lo imprescindible.
-- ---------------------------------------------------------------------------
-- IMPORTANTE: "revoke ... from anon" por si solo NO basta para las funciones
-- creadas en este bloque, porque Postgres les concede EXECUTE a PUBLIC (el
-- pseudo-rol de "todo el mundo") al crearlas, y anon hereda eso por ser
-- PUBLIC. Por eso el revoke de abajo incluye tambien "public" (como ya hacia
-- D58 con las funciones de la v0), y despues se vuelve a conceder a
-- authenticated solo lo que necesita (incluida is_gestor/tocar_actualizado_en/
-- tallas_vive, que D58/D59 ya concedian y este revoke en bloque retira).
revoke all on public.jugadores, public.gestores, public.campanas_ropa, public.pedidos_ropa, public.v_dorsales_repetidos from anon;
revoke execute on all functions in schema public from public, anon, authenticated;
revoke usage on schema public from anon;

grant execute on function public.is_gestor()                        to authenticated;
grant execute on function public.tocar_actualizado_en()              to authenticated;
grant execute on function public.tallas_vive()                       to authenticated;
grant execute on function public.mi_zona()                          to authenticated;
grant execute on function public.dorsal_cogido(uuid, int, uuid)     to authenticated;
grant execute on function public.guardar_pedido(jsonb)              to authenticated;
grant execute on function public.anular_pedido(uuid)                to authenticated;
-- supabase_auth_admin ya tiene su propio grant explicito mas arriba
-- (antes_de_crear_usuario); el resto de funciones (_mi_jugador,
-- correo_permitido, vincular_gestor_nuevo_usuario y las auxiliares con "_")
-- quedan sin EXECUTE para nadie: solo las llaman otras funciones
-- security definer del mismo dueño, que no necesitan el grant.

-- Que PostgREST recargue el esquema.
notify pgrst, 'reload schema';
