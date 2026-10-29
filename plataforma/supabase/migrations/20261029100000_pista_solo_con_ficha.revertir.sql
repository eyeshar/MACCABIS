-- Revierte 20261029100000_pista_solo_con_ficha (D148): `_invitado` vuelve a la versión de 20261024200000 (misma firma y
-- permisos), se borran la función solo_con_ficha_en y la columna pistas.solo_con_ficha, y su registro de migración.
-- Nada más depende de ellas.

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

drop function public.solo_con_ficha_en(public.eventos);
alter table public.pistas drop column solo_con_ficha;

delete from supabase_migrations.schema_migrations where version = '20261029100000';

notify pgrst, 'reload schema';
