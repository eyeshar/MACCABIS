-- =============================================================================
-- Plataforma Maccabis v0 — identidad, enlaces personales y pedido de ropa
-- =============================================================================
-- Modelo de seguridad (D44 b/c, ver docs/DECISIONS.md):
--
--  * RLS activada en TODAS las tablas. Ninguna tabla tiene politica para
--    `anon`: un visitante sin sesion no puede leer ni escribir nada directamente.
--  * Los GESTORES (Supabase Auth) leen y escriben las tablas a traves de
--    politicas `is_gestor()`.
--  * Los JUGADORES no tienen sesion: entran con su enlace personal /j/<token>.
--    Solo pueden usar un punado de funciones (RPC) `security definer` que
--    reciben el token, localizan a SU jugador y solo devuelven o tocan lo suyo.
--    Nunca reciben niveles, posiciones, telefonos ni nada del motor.
--  * La service role key no se usa en la app: solo en scripts locales.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tipos y constantes
-- ---------------------------------------------------------------------------
create type public.rol_jugador as enum ('jugador', 'solo_entreno', 'entrenador');

-- Tallas de VIVE, en orden de menor a mayor (el orden se usa en el Excel).
create or replace function public.tallas_vive()
returns text[]
language sql immutable
set search_path = ''
as $$ select array['3','4','6','8','10','12','XS','S','M','L','XL','XXL','3XL','5XL','7XL']::text[] $$;

create domain public.talla_vive as text
  check (value = any (array['3','4','6','8','10','12','XS','S','M','L','XL','XXL','3XL','5XL','7XL']));

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

-- Plantilla. SIN niveles ni posiciones (eso vive en privado/, D39).
create table public.jugadores (
  id              uuid primary key default gen_random_uuid(),
  person_id       text not null unique,          -- el de data/personas.json
  nombre_oficial  text not null,                 -- "Apellidos, Nombre"
  nombre_visible  text not null,                 -- el mote ("Manu", "Fernando T.")
  temporada       text not null default '2026-27',
  ficha_mda       boolean not null default false,
  ficha_mdl       boolean not null default false,
  entrena         boolean not null default true,
  rol             public.rol_jugador not null default 'jugador',
  telefono        text,                          -- opcional, lo apunta un gestor; solo gestores
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  constraint telefono_formato check (telefono is null or telefono ~ '^\+?[0-9 ]{9,16}$'),
  constraint nombre_visible_no_vacio check (length(btrim(nombre_visible)) between 1 and 40)
);

-- Enlaces personales. Un jugador tiene como mucho UN enlace vivo.
-- Regenerar = anular el vivo + crear otro. Los anulados se conservan (historial).
create table public.enlaces (
  id           uuid primary key default gen_random_uuid(),
  jugador_id   uuid not null references public.jugadores(id) on delete cascade,
  token        text not null unique,
  creado_en    timestamptz not null default now(),
  creado_por   uuid,                              -- auth.uid() del gestor (null = semilla)
  anulado_en   timestamptz,
  anulado_por  uuid,
  ultimo_uso   timestamptz,                       -- ultima vez que el jugador abrio su zona
  constraint token_largo check (length(token) >= 40)
);
create unique index enlaces_un_vivo_por_jugador on public.enlaces (jugador_id) where anulado_en is null;

-- Gestores: usuarios de Supabase Auth con acceso a la zona de gestion.
-- Se dan de alta con SQL (ver plataforma/LEEME.md), nunca desde la web.
create table public.gestores (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null,
  creado_en  timestamptz not null default now()
);

-- Campanas de pedido de ropa.
create table public.campanas_ropa (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null,
  proveedor        text not null default 'VIVE',
  estado           text not null default 'cerrada' check (estado in ('abierta', 'cerrada')),
  fecha_limite     timestamptz,
  -- Precio orientativo por prenda, en euros. Se muestra como "por confirmar".
  precios          jsonb not null default '{"camiseta": 14, "pantalon": 14, "cubre": 14, "sudadera": 25}'::jsonb,
  guia_tallas_url  text,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now()
);

-- Pedidos. Un pedido = una persona cuyo nombre va en la ropa.
-- El nombre y el dorsal valen para todas las prendas del pedido.
create table public.pedidos_ropa (
  id                 uuid primary key default gen_random_uuid(),
  campana_id         uuid not null references public.campanas_ropa(id) on delete cascade,
  jugador_id         uuid not null references public.jugadores(id) on delete cascade, -- quien lo pide
  para               text not null default 'yo' check (para in ('yo', 'familiar')),
  nombre_completo    text not null,
  nombre_ropa        text,
  dorsal             smallint,
  talla_camiseta     public.talla_vive,
  talla_pantalon     public.talla_vive,
  talla_cubre        public.talla_vive,
  talla_sudadera     public.talla_vive,
  creado_por_gestor  boolean not null default false,
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now(),
  actualizado_por    text not null default 'jugador',  -- 'jugador' | 'gestor:<uuid>'
  constraint nombre_completo_ok check (length(btrim(nombre_completo)) between 3 and 80),
  constraint nombre_ropa_ok check (nombre_ropa is null or (nombre_ropa = upper(nombre_ropa) and length(btrim(nombre_ropa)) between 1 and 15)),
  constraint dorsal_ok check (dorsal is null or dorsal between 0 and 99),
  constraint alguna_prenda check (coalesce(talla_camiseta, talla_pantalon, talla_cubre, talla_sudadera) is not null),
  -- Camiseta, pantalon y cubre llevan dorsal.
  constraint dorsal_si_hace_falta check (dorsal is not null or (talla_camiseta is null and talla_pantalon is null and talla_cubre is null)),
  -- Camiseta, cubre y sudadera llevan nombre.
  constraint nombre_si_hace_falta check (nombre_ropa is not null or (talla_camiseta is null and talla_cubre is null and talla_sudadera is null))
);
create index pedidos_ropa_campana on public.pedidos_ropa (campana_id);
create index pedidos_ropa_jugador on public.pedidos_ropa (jugador_id);

-- ---------------------------------------------------------------------------
-- Marcas de tiempo
-- ---------------------------------------------------------------------------
create or replace function public.tocar_actualizado_en()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.actualizado_en := now();
  return new;
end $$;

create trigger jugadores_actualizado before update on public.jugadores
  for each row execute function public.tocar_actualizado_en();
create trigger campanas_actualizado before update on public.campanas_ropa
  for each row execute function public.tocar_actualizado_en();
create trigger pedidos_actualizado before update on public.pedidos_ropa
  for each row execute function public.tocar_actualizado_en();

-- ---------------------------------------------------------------------------
-- Funciones auxiliares
-- ---------------------------------------------------------------------------

-- ¿El usuario con sesion es gestor?
create or replace function public.is_gestor()
returns boolean
language sql stable security definer
set search_path = ''
as $$ select exists (select 1 from public.gestores g where g.user_id = auth.uid()) $$;

-- Token nuevo: dos UUID v4 aleatorios sin guiones = 64 caracteres hex (244 bits).
create or replace function public.nuevo_token()
returns text
language sql volatile
set search_path = ''
as $$ select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') $$;

-- Jugador dueno de un token vivo (null si no existe, esta anulado o el jugador no esta activo).
create or replace function public._jugador_de_token(p_token text)
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select e.jugador_id
  from public.enlaces e
  join public.jugadores j on j.id = e.jugador_id
  where e.token = p_token and e.anulado_en is null and j.activo
$$;

-- ¿Acepta pedidos la campana ahora mismo?
create or replace function public._campana_abierta(p_campana uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.campanas_ropa c
    where c.id = p_campana and c.estado = 'abierta'
      and (c.fecha_limite is null or now() <= c.fecha_limite)
  )
$$;

-- ¿Hay OTRO pedido en la campana con ese dorsal en una prenda que lo lleva?
create or replace function public._dorsal_cogido(p_campana uuid, p_dorsal int, p_excluir uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pedidos_ropa p
    where p.campana_id = p_campana and p.dorsal = p_dorsal
      and (p_excluir is null or p.id <> p_excluir)
      and coalesce(p.talla_camiseta, p.talla_pantalon, p.talla_cubre) is not null
  )
$$;

-- Campana que se ensena en la zona personal: la ultima abierta; si no hay, la ultima creada.
create or replace function public._campana_actual()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select c.id from public.campanas_ropa c
  order by (c.estado = 'abierta') desc, c.creado_en desc
  limit 1
$$;

create or replace function public._pedido_json(p public.pedidos_ropa)
returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id, 'campana_id', p.campana_id, 'para', p.para,
    'nombre_completo', p.nombre_completo, 'nombre_ropa', p.nombre_ropa, 'dorsal', p.dorsal,
    'tallas', jsonb_strip_nulls(jsonb_build_object(
      'camiseta', p.talla_camiseta, 'pantalon', p.talla_pantalon,
      'cubre', p.talla_cubre, 'sudadera', p.talla_sudadera)),
    'actualizado_en', p.actualizado_en)
$$;

-- ---------------------------------------------------------------------------
-- API del JUGADOR (enlace personal). Solo estas funciones son ejecutables por anon.
-- ---------------------------------------------------------------------------

-- Todo lo que necesita la zona personal. null = enlace no valido.
create or replace function public.zona_jugador(p_token text)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_jugador uuid := public._jugador_de_token(p_token);
  v_campana uuid;
  v_out jsonb;
begin
  if v_jugador is null then
    return null;
  end if;

  update public.enlaces set ultimo_uso = now()
   where token = p_token and anulado_en is null;

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
create or replace function public.dorsal_cogido(p_token text, p_campana uuid, p_dorsal int, p_pedido uuid default null)
returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if public._jugador_de_token(p_token) is null then
    raise exception 'enlace_invalido' using errcode = '28000';
  end if;
  return public._dorsal_cogido(p_campana, p_dorsal, p_pedido);
end $$;

-- Crear (p_pedido.id vacio) o modificar un pedido propio.
-- Devuelve {ok: true, id} o {ok: false, error: <codigo>}.
create or replace function public.guardar_pedido(p_token text, p_pedido jsonb)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_jugador uuid := public._jugador_de_token(p_token);
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
    return jsonb_build_object('ok', false, 'error', 'enlace_invalido');
  end if;

  -- Si modifica, el pedido tiene que ser suyo; la campana es la del pedido.
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

  -- Prendas marcadas: cada una con una talla valida.
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

  -- Nombre en la ropa: camiseta, cubre y sudadera.
  if coalesce(v_t_camiseta, v_t_cubre, v_t_sudadera) is not null then
    if v_nombre_ropa is null or length(v_nombre_ropa) > 15 then
      return jsonb_build_object('ok', false, 'error', 'falta_nombre_ropa');
    end if;
  else
    v_nombre_ropa := null;
  end if;

  -- Dorsal: camiseta, pantalon y cubre.
  if coalesce(v_t_camiseta, v_t_pantalon, v_t_cubre) is not null then
    begin
      v_dorsal := (p_pedido->>'dorsal')::int;
    exception when others then
      v_dorsal := null;
    end;
    if v_dorsal is null or v_dorsal not between 0 and 99 then
      return jsonb_build_object('ok', false, 'error', 'dorsal_invalido');
    end if;
    if public._dorsal_cogido(v_campana, v_dorsal, v_id) then
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
create or replace function public.anular_pedido(p_token text, p_pedido uuid)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_jugador uuid := public._jugador_de_token(p_token);
  v_campana uuid;
begin
  if v_jugador is null then
    return jsonb_build_object('ok', false, 'error', 'enlace_invalido');
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
-- API de GESTORES para los enlaces (el resto lo hacen con las tablas y RLS)
-- ---------------------------------------------------------------------------
create or replace function public.regenerar_enlace(p_jugador uuid)
returns text
language plpgsql volatile security definer
set search_path = ''
as $$
declare v_token text;
begin
  if not public.is_gestor() then
    raise exception 'solo_gestores' using errcode = '42501';
  end if;
  update public.enlaces set anulado_en = now(), anulado_por = auth.uid()
   where jugador_id = p_jugador and anulado_en is null;
  v_token := public.nuevo_token();
  insert into public.enlaces (jugador_id, token, creado_por) values (p_jugador, v_token, auth.uid());
  return v_token;
end $$;

create or replace function public.anular_enlace(p_jugador uuid)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  if not public.is_gestor() then
    raise exception 'solo_gestores' using errcode = '42501';
  end if;
  update public.enlaces set anulado_en = now(), anulado_por = auth.uid()
   where jugador_id = p_jugador and anulado_en is null;
end $$;

-- Dorsales repetidos en una campana, con nombres (solo gestores, por RLS de la tabla).
create view public.v_dorsales_repetidos with (security_invoker = true) as
  select p.campana_id, p.dorsal,
         array_agg(p.nombre_completo order by p.creado_en) as nombres,
         count(*) as veces
  from public.pedidos_ropa p
  where p.dorsal is not null and coalesce(p.talla_camiseta, p.talla_pantalon, p.talla_cubre) is not null
  group by p.campana_id, p.dorsal
  having count(*) > 1;

-- ---------------------------------------------------------------------------
-- RLS: activada en todas las tablas; solo gestores
-- ---------------------------------------------------------------------------
alter table public.jugadores      enable row level security;
alter table public.enlaces        enable row level security;
alter table public.gestores       enable row level security;
alter table public.campanas_ropa  enable row level security;
alter table public.pedidos_ropa   enable row level security;

create policy gestores_todo on public.jugadores     for all to authenticated using (public.is_gestor()) with check (public.is_gestor());
create policy gestores_leen on public.enlaces       for select to authenticated using (public.is_gestor());
create policy gestores_leen on public.gestores      for select to authenticated using (public.is_gestor());
create policy gestores_todo on public.campanas_ropa for all to authenticated using (public.is_gestor()) with check (public.is_gestor());
create policy gestores_todo on public.pedidos_ropa  for all to authenticated using (public.is_gestor()) with check (public.is_gestor());

-- ---------------------------------------------------------------------------
-- Permisos. Supabase concede por defecto todo a anon/authenticated en public;
-- aqui se retira y se da solo lo necesario (defensa en profundidad sobre RLS).
-- ---------------------------------------------------------------------------
revoke all on public.jugadores, public.enlaces, public.gestores, public.campanas_ropa, public.pedidos_ropa, public.v_dorsales_repetidos from anon, public;
revoke all on public.jugadores, public.enlaces, public.gestores, public.campanas_ropa, public.pedidos_ropa, public.v_dorsales_repetidos from authenticated;
grant select, insert, update, delete on public.jugadores, public.campanas_ropa, public.pedidos_ropa to authenticated;
grant select on public.enlaces, public.gestores, public.v_dorsales_repetidos to authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.zona_jugador(text)                      to anon, authenticated;
grant execute on function public.dorsal_cogido(text, uuid, int, uuid)     to anon, authenticated;
grant execute on function public.guardar_pedido(text, jsonb)              to anon, authenticated;
grant execute on function public.anular_pedido(text, uuid)                to anon, authenticated;
grant execute on function public.tallas_vive()                            to anon, authenticated;
grant execute on function public.is_gestor()                              to authenticated;
grant execute on function public.regenerar_enlace(uuid)                   to authenticated;
grant execute on function public.anular_enlace(uuid)                      to authenticated;
-- Las politicas RLS llaman a is_gestor() y los triggers a tocar_actualizado_en().
grant execute on function public.tocar_actualizado_en()                   to authenticated;
