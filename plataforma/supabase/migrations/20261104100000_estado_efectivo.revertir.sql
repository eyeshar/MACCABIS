-- Reversión de 20261104100000_estado_efectivo.sql (D177). NUNCA la aplica db:migrar: se ejecuta a mano.
-- _quien_va vuelve a su cuerpo de 20261008100000 (solo ausencias) y se quita _estado_efectivo.
create or replace function public._quien_va()
returns table (evento_id uuid, nombre text, estado text)
language sql stable security definer set search_path = ''
as $$
  select e.id, j.nombre_visible,
         case when coalesce(r.respuesta, 'sin_responder') = 'sin_responder'
                   and public._ausencia_que_cubre(j.person_id, e.fecha) is not null then 'no'
              else coalesce(r.respuesta, 'sin_responder') end
  from public.eventos e
  join public.jugadores j on public._invitado(j.person_id, e.id)
  left join public.respuestas r on r.evento_id = e.id and r.person_id = j.person_id
  where public._invitado(public._mi_person_id(), e.id)
$$;
drop function if exists public._estado_efectivo(uuid, text, text);
delete from supabase_migrations.schema_migrations where version = '20261104100000';
