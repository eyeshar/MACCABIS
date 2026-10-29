-- Pista «solo jugadores con ficha» (D148, Iván, 29/10/2026): en Valdebernardo solo entrenan quienes tienen ficha en
-- algún equipo del club (MdA o MdL).
--
-- SOLO ADITIVA (D111): una columna nueva en pistas (por defecto false: nada cambia hasta que se marque una pista), una
-- función nueva y `_invitado` reemplazada con la misma firma y permisos. Su reversión está al lado:
-- 20261029100000_pista_solo_con_ficha.revertir.sql.
--
--  - pistas.solo_con_ficha: la marca. La ficha NO se duplica: se lee de jugadores.ficha_mda / ficha_mdl.
--  - solo_con_ficha_en(eventos): el nombre corto de la pista con la marca si el evento es un entreno oficial que va a
--    ella (su pista propia; si no tiene, ni ubicación libre, la de la serie cuando está habitual: la misma regla que
--    pistaEfectiva en lib/eventos/dominio.ts); null si no. PostgREST la sirve como columna calculada de eventos
--    (select=…,solo_con_ficha_en), así la web lee la regla de la base y no la repite.
--  - _invitado: en esos entrenos, quien no tiene ficha no está invitado (no sale en «quién va», no responde, no recibe
--    recordatorios). Todo lo demás, igual que en 20261024200000. La web tiene la misma regla en quienResponde.

alter table public.pistas add column solo_con_ficha boolean not null default false;
comment on column public.pistas.solo_con_ficha is
  'D148: en los entrenos en esta pista solo están invitados los jugadores con ficha en MdA o MdL (jugadores.ficha_mda / ficha_mdl).';

create function public.solo_con_ficha_en(e public.eventos)
returns text language sql stable set search_path = ''
as $$
  select case when e.tipo = 'entreno' and e.oficial then (
    select coalesce(p.nombre_corto, p.nombre) from public.pistas p
    where p.solo_con_ficha
      and (p.id = e.pista_id
           or (e.pista_id is null and nullif(e.ubicacion_nombre, '') is null and p.es_de_serie and p.uso = 'entreno' and p.estado = 'habitual'))
    limit 1) end
$$;
comment on function public.solo_con_ficha_en(public.eventos) is
  'D148: pista «solo con ficha» a la que va este entreno (nombre corto), o null. Columna calculada de eventos para PostgREST.';
revoke all on function public.solo_con_ficha_en(public.eventos) from public, anon;
grant execute on function public.solo_con_ficha_en(public.eventos) to authenticated, service_role;

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
                                                      and (j.ficha_mda or j.ficha_mdl or public.solo_con_ficha_en(e) is null)
            when j.rol = 'solo_entreno' then false
            when e.equipo = 'MdA' then j.ficha_mda
            when e.equipo = 'MdL' then j.ficha_mdl
            else (j.ficha_mda or j.ficha_mdl)
          end)
$$;

notify pgrst, 'reload schema';
