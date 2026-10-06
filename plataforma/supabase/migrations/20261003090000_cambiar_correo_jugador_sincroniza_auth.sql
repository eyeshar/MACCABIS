-- =============================================================================
-- Cambio de correo seguro: sincroniza jugadores.email con su cuenta de
-- Supabase Auth (si ya existe) y con gestores.email (si esa persona es
-- ademas gestor con el mismo correo), para que cambiar un correo en
-- Gestion -> Jugadores nunca deje una cuenta de auth huerfana (con el
-- correo viejo, sin jugador que apunte a ella) ni duplicada (una cuenta
-- nueva con el correo nuevo cuando ya habia una para esa persona).
-- =============================================================================
--
-- Por que RENOMBRAR auth.users.email en vez de borrar y esperar a que se
-- recree sola: si la persona ya entro alguna vez con Google, su cuenta esta
-- enlazada por el "sub" de Google (auth.identities.provider_id), no por el
-- correo (comprobado en el proyecto real); renombrar el correo no rompe esa
-- sesion. auth.identities.identity_data (una copia de los datos del
-- proveedor) se actualiza tambien cuando esa tabla existe -- no existe en la
-- pila local de pruebas (pruebas/supabase_local.sql), que no la necesita: de
-- ahi el "to_regclass" antes de tocarla.
--
-- Si la persona NUNCA entro, no hay auth.users que renombrar: el proximo
-- login con el correo nuevo crea la cuenta sola (ya es lo que pasaba).
--
-- Quien puede llamarla:
--  * Desde la web (PostgREST, con sesion de gestor): solo gestores, is_gestor().
--  * Desde los scripts locales (conexion directa como "postgres", SIN JWT:
--    auth.uid() es null ahi): sin restriccion -- igual que el resto de
--    scripts/db.mjs, que ya operan con confianza total sobre la base.
create or replace function public.cambiar_correo_jugador(p_jugador_id uuid, p_email text)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_nuevo text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_viejo text;
  v_auth_viejo uuid;
  v_auth_nuevo uuid;
  v_gestor_id uuid;
  v_renombrado boolean := false;
  v_gestor_sincronizado boolean := false;
begin
  if not (auth.uid() is null or public.is_gestor()) then
    raise exception 'solo_gestores' using errcode = '42501';
  end if;

  if v_nuevo is not null and v_nuevo !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return jsonb_build_object('ok', false, 'error', 'correo_invalido');
  end if;

  select email into v_viejo from public.jugadores where id = p_jugador_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_encontrado');
  end if;
  v_viejo := nullif(lower(btrim(v_viejo)), '');

  if v_nuevo is not distinct from v_viejo then
    return jsonb_build_object('ok', true, 'sin_cambios', true);
  end if;

  if v_viejo is not null then
    select id into v_auth_viejo from auth.users where lower(email) = v_viejo;
  end if;

  -- El correo nuevo no puede pertenecer YA a otra cuenta de auth distinta
  -- de la que estamos renombrando (fusionar dos identidades no es seguro:
  -- lo resuelve un gestor a mano).
  if v_nuevo is not null then
    select id into v_auth_nuevo from auth.users where lower(email) = v_nuevo;
    if v_auth_nuevo is not null and v_auth_nuevo is distinct from v_auth_viejo then
      return jsonb_build_object('ok', false, 'error', 'correo_en_uso_auth');
    end if;
  end if;

  begin
    update public.jugadores set email = v_nuevo where id = p_jugador_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'correo_duplicado_jugadores');
  end;

  if v_auth_viejo is not null and v_nuevo is not null then
    update auth.users set email = v_nuevo where id = v_auth_viejo;
    if to_regclass('auth.identities') is not null then
      update auth.identities
         set identity_data = jsonb_set(coalesce(identity_data, '{}'::jsonb), '{email}', to_jsonb(v_nuevo))
       where user_id = v_auth_viejo;
    end if;
    v_renombrado := true;
  end if;

  -- Si el correo viejo era tambien el de un gestor (Carlos, Edu...), lo
  -- actualizamos igual. Solo al RENOMBRAR: si el correo se borra (v_nuevo
  -- null) no se toca el acceso de gestor, que es una cosa aparte.
  if v_viejo is not null and v_nuevo is not null then
    update public.gestores set email = v_nuevo where lower(email) = v_viejo
      returning id into v_gestor_id;
    v_gestor_sincronizado := v_gestor_id is not null;
  end if;

  return jsonb_build_object('ok', true, 'auth_renombrado', v_renombrado, 'gestor_sincronizado', v_gestor_sincronizado);
end $$;

revoke execute on function public.cambiar_correo_jugador(uuid, text) from public, anon;
grant execute on function public.cambiar_correo_jugador(uuid, text) to authenticated;

notify pgrst, 'reload schema';
