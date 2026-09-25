-- =============================================================================
-- Ajustes al proyecto real de Supabase (D58, D59, D60)
--  1. "Automatically expose new tables" esta DESACTIVADO en el proyecto: no hay
--     permisos por defecto para anon/authenticated. Se dan aqui, explicitos y minimos.
--  2. "Enable automatic RLS" esta DESACTIVADO: un event trigger activa RLS en
--     cualquier tabla nueva del esquema public.
--  3. Dorsales: solo son unicos entre los pedidos de jugadores del club
--     (para = 'yo'). En un pedido para un familiar el dorsal es libre y no avisa.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Permisos explicitos minimos
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

-- Tablas: nada para anon. Los gestores (authenticated) pasan ademas por RLS + is_gestor().
revoke all on public.jugadores, public.enlaces, public.gestores, public.campanas_ropa, public.pedidos_ropa, public.v_dorsales_repetidos from anon, authenticated, public;
grant select, insert, update, delete on public.jugadores, public.campanas_ropa, public.pedidos_ropa to authenticated;
grant select on public.enlaces, public.gestores, public.v_dorsales_repetidos to authenticated;

-- Funciones: anon solo puede ejecutar las que exigen token. Nada mas.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.zona_jugador(text)                  to anon, authenticated;
grant execute on function public.dorsal_cogido(text, uuid, int, uuid) to anon, authenticated;
grant execute on function public.guardar_pedido(text, jsonb)          to anon, authenticated;
grant execute on function public.anular_pedido(text, uuid)            to anon, authenticated;
grant execute on function public.is_gestor()                          to authenticated;
grant execute on function public.regenerar_enlace(uuid)               to authenticated;
grant execute on function public.anular_enlace(uuid)                  to authenticated;

-- Que las funciones FUTURAS de public no nazcan ejecutables por cualquiera.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. RLS automatica en tablas nuevas de public
-- ---------------------------------------------------------------------------
create or replace function public.rls_automatica()
returns event_trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select * from pg_event_trigger_ddl_commands()
    where object_type = 'table' and schema_name = 'public'
  loop
    execute format('alter table %s enable row level security', r.object_identity);
  end loop;
end $$;

revoke execute on function public.rls_automatica() from public, anon, authenticated;

drop event trigger if exists rls_automatica;
create event trigger rls_automatica
  on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function public.rls_automatica();

-- ---------------------------------------------------------------------------
-- 3. Dorsal unico solo entre pedidos de jugadores (para = 'yo')
-- ---------------------------------------------------------------------------
create or replace function public._dorsal_cogido(p_campana uuid, p_dorsal int, p_excluir uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pedidos_ropa p
    where p.campana_id = p_campana and p.dorsal = p_dorsal and p.para = 'yo'
      and (p_excluir is null or p.id <> p_excluir)
      and coalesce(p.talla_camiseta, p.talla_pantalon, p.talla_cubre) is not null
  )
$$;
revoke execute on function public._dorsal_cogido(uuid, int, uuid) from public, anon, authenticated;

create or replace view public.v_dorsales_repetidos with (security_invoker = true) as
  select p.campana_id, p.dorsal,
         array_agg(p.nombre_completo order by p.creado_en) as nombres,
         count(*) as veces
  from public.pedidos_ropa p
  where p.para = 'yo' and p.dorsal is not null
    and coalesce(p.talla_camiseta, p.talla_pantalon, p.talla_cubre) is not null
  group by p.campana_id, p.dorsal
  having count(*) > 1;
revoke all on public.v_dorsales_repetidos from anon, public;
grant select on public.v_dorsales_repetidos to authenticated;

-- guardar_pedido: igual que en v0, pero la comprobacion del dorsal solo se hace
-- cuando el pedido es para el propio jugador.
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
    -- Solo los pedidos de jugadores compiten por el dorsal; el de un familiar es libre.
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
revoke execute on function public.guardar_pedido(text, jsonb) from public;
grant execute on function public.guardar_pedido(text, jsonb) to anon, authenticated;

-- Que PostgREST recargue el esquema.
notify pgrst, 'reload schema';
