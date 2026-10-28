-- =============================================================================
-- Disponibilidad por defecto (D146): dos marcas privadas por jugador y la excepcion de un entreno.
--
-- SOLO ADITIVA (D94, D111): dos columnas nuevas (con valor por defecto) en jugadores_privado y una tabla nueva. No cambia
-- ni borra nada de lo que ya existe. Reversion al lado: 20261028230000_disponibilidad_por_defecto.revertir.sql (db:migrar
-- nunca la aplica).
--
--  - jugadores_privado.no_suele_entrenar: en cada ENTRENO, si no ha respondido, cuenta como «no va (por defecto)»; si
--    responde, manda su respuesta. Nunca cuenta en partidos.
--  - jugadores_privado.nunca_partidos («Solo entreno: nunca a partidos»): el motor de convocatoria no lo propone nunca
--    (ni para cubrir huecos) y en los partidos no cuenta como pendiente ni recibe recordatorios. Es otra cosa que el rol
--    «solo entreno» de public.jugadores, que sí se puede convocar para cubrir huecos con menos de 20 disponibles.
--  - entreno_defecto_quitado: un gestor pasa a alguien con «no suele entrenar» a «sin responder» SOLO para un entreno.
--
-- Confidencial (D39): las marcas viven en jugadores_privado (solo gestores); la tabla nueva, igual. Ningun jugador las lee
-- ni las ve: su pantalla sigue igual. La tarea de avisos (rol de servicio) las lee para no mandar recordatorios.
-- =============================================================================

alter table public.jugadores_privado
  add column no_suele_entrenar boolean not null default false,
  add column nunca_partidos    boolean not null default false;
comment on column public.jugadores_privado.no_suele_entrenar is 'D146: en los entrenos, sin respuesta = «no va (por defecto)». Solo gestores.';
comment on column public.jugadores_privado.nunca_partidos is 'D146: «Solo entreno: nunca a partidos». El motor no lo propone nunca. Distinto del rol solo_entreno. Solo gestores.';

create table public.entreno_defecto_quitado (
  evento_id   uuid not null references public.eventos (id),
  person_id   text not null references public.jugadores (person_id),
  en          timestamptz not null default now(),
  por_nombre  text,
  primary key (evento_id, person_id)
);
comment on table public.entreno_defecto_quitado is 'D146: en este entreno, «no suele entrenar» no cuenta (vuelve a «sin responder»). Solo gestores.';

alter table public.entreno_defecto_quitado enable row level security;
create policy gestores_leen     on public.entreno_defecto_quitado for select to authenticated using (public.is_gestor());
create policy gestores_insertan on public.entreno_defecto_quitado for insert to authenticated with check (public.is_gestor());
create policy gestores_borran   on public.entreno_defecto_quitado for delete to authenticated using (public.is_gestor());

revoke all on public.entreno_defecto_quitado from anon, authenticated, public;
grant select, insert, delete on public.entreno_defecto_quitado to authenticated;

-- La tarea de avisos (servidor, service_role) lee las marcas y las excepciones para no mandar recordatorios por defecto.
do $$
begin
  grant select on public.jugadores_privado, public.entreno_defecto_quitado to service_role;
exception when undefined_object then
  null;
end $$;
