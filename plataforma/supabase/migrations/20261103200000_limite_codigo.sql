-- =============================================================================
-- Límite de intentos del código de «Entrar» (revisión de seguridad, Iván 03/11/2026). SOLO ADITIVA.
-- El código de 6 dígitos se comprueba desde el servidor de Vercel (verificarCodigo, src/app/entrar/acciones.ts): el límite
-- por IP de Supabase ve la IP de Vercel, no la de quien prueba. Aquí, uno propio POR CORREO:
--   - como mucho 5 fallos en 15 minutos y 20 en 24 horas; pasado eso, ni se pregunta a Supabase;
--   - un acierto borra los fallos de ese correo.
-- Nunca se guarda el correo: `clave` es un HMAC del correo con un secreto del servidor (src/lib/entrar/limite.ts).
-- Solo lo usa el servidor con la clave de servicio: la tabla y las dos funciones, nada para anon ni authenticated.
-- Reversión al lado: 20261103200000_limite_codigo.revertir.sql.
-- =============================================================================

create table public.intentos_codigo (
  clave text not null,
  en timestamptz not null default now()
);
comment on table public.intentos_codigo is 'Fallos del código de Entrar por correo (HMAC, nunca el correo). Solo service_role. Se borran a las 24 h.';
create index intentos_codigo_clave_en_idx on public.intentos_codigo (clave, en);
alter table public.intentos_codigo enable row level security;
revoke all on public.intentos_codigo from public, anon, authenticated;
grant select, insert, delete on public.intentos_codigo to service_role;

-- ¿Se puede probar otro código con este correo?
create function public.codigo_permitido(p_clave text)
returns boolean language sql stable set search_path = ''
as $$
  select count(*) filter (where en > now() - interval '15 minutes') < 5 and count(*) < 20
  from public.intentos_codigo
  where clave = p_clave and en > now() - interval '24 hours'
$$;
comment on function public.codigo_permitido(text) is 'Límite del código de Entrar: false con 5 fallos en 15 min o 20 en 24 h. Solo service_role.';
revoke execute on function public.codigo_permitido(text) from public, anon, authenticated;
grant execute on function public.codigo_permitido(text) to service_role;

-- Apunta el resultado: un fallo suma; un acierto borra los de ese correo. De paso, fuera lo de hace más de 24 h.
create function public.codigo_resultado(p_clave text, p_ok boolean)
returns void language plpgsql set search_path = ''
as $$
begin
  delete from public.intentos_codigo where en < now() - interval '24 hours';
  if p_ok then
    delete from public.intentos_codigo where clave = p_clave;
  else
    insert into public.intentos_codigo (clave) values (p_clave);
  end if;
end
$$;
comment on function public.codigo_resultado(text, boolean) is 'Límite del código de Entrar: apunta un fallo o, con un acierto, borra los de ese correo. Solo service_role.';
revoke execute on function public.codigo_resultado(text, boolean) from public, anon, authenticated;
grant execute on function public.codigo_resultado(text, boolean) to service_role;

notify pgrst, 'reload schema';
