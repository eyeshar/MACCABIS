-- =============================================================================
-- Cambio de correo de un jugador cuyo correo viejo NO tiene cuenta (D135, Iván 26/10/2026).
-- =============================================================================
--
-- Antes (20261003090000): si el correo nuevo ya tenia una cuenta de auth, devolvia «correo_en_uso_auth» aunque el
-- correo viejo de la ficha no tuviera ninguna. Pero entonces no hay dos identidades que fusionar: la ficha pasa a usar
-- ese correo y queda enlazada a esa cuenta (el enlace jugador <-> cuenta es por el correo: _mi_jugador()).
--
-- Sigue bloqueando:
--  * correo_en_uso_auth: el correo viejo y el nuevo tienen CADA UNO su propia cuenta (fusionar no es seguro).
--  * correo_duplicado_jugadores: el correo nuevo ya es el de otro jugador.
--  * correo_de_gestor: el correo nuevo ya es el de un gestor (que no sea el correo viejo de esta misma ficha).
--
-- Aditiva en la practica: solo reemplaza esta funcion (misma firma y permisos). Revertir: el .revertir.sql repone la
-- version de 20261003090000 tal cual.
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
  v_vinculado boolean := false;
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

  if v_nuevo is not null then
    -- El correo nuevo ya es el de otro jugador o el de un gestor: se resuelve a mano.
    if exists (select 1 from public.jugadores where lower(btrim(email)) = v_nuevo and id <> p_jugador_id) then
      return jsonb_build_object('ok', false, 'error', 'correo_duplicado_jugadores');
    end if;
    if exists (select 1 from public.gestores where lower(email) = v_nuevo) then
      return jsonb_build_object('ok', false, 'error', 'correo_de_gestor');
    end if;
  end if;

  if v_viejo is not null then
    select id into v_auth_viejo from auth.users where lower(email) = v_viejo;
  end if;
  if v_nuevo is not null then
    select id into v_auth_nuevo from auth.users where lower(email) = v_nuevo;
  end if;

  -- Dos cuentas distintas (una con el correo viejo y otra con el nuevo): fusionar dos identidades no es seguro.
  if v_auth_viejo is not null and v_auth_nuevo is not null and v_auth_nuevo <> v_auth_viejo then
    return jsonb_build_object('ok', false, 'error', 'correo_en_uso_auth');
  end if;

  begin
    update public.jugadores set email = v_nuevo where id = p_jugador_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'correo_duplicado_jugadores');
  end;

  if v_auth_viejo is not null and v_nuevo is not null then
    -- La cuenta del correo viejo se renombra (no queda huerfana ni duplicada).
    update auth.users set email = v_nuevo where id = v_auth_viejo;
    if to_regclass('auth.identities') is not null then
      update auth.identities
         set identity_data = jsonb_set(coalesce(identity_data, '{}'::jsonb), '{email}', to_jsonb(v_nuevo))
       where user_id = v_auth_viejo;
    end if;
    v_renombrado := true;
  elsif v_auth_nuevo is not null then
    -- El correo viejo no tenia cuenta y el nuevo si: la ficha queda enlazada a esa cuenta (por el correo).
    v_vinculado := true;
  end if;

  -- Si el correo viejo era tambien el de un gestor, se actualiza igual (solo al renombrar).
  if v_viejo is not null and v_nuevo is not null then
    update public.gestores set email = v_nuevo where lower(email) = v_viejo
      returning id into v_gestor_id;
    v_gestor_sincronizado := v_gestor_id is not null;
  end if;

  return jsonb_build_object('ok', true, 'auth_renombrado', v_renombrado, 'vinculado_a_cuenta', v_vinculado, 'gestor_sincronizado', v_gestor_sincronizado);
end $$;

revoke execute on function public.cambiar_correo_jugador(uuid, text) from public, anon;
grant execute on function public.cambiar_correo_jugador(uuid, text) to authenticated;

notify pgrst, 'reload schema';
