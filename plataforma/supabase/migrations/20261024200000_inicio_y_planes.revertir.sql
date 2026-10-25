-- Reversion de 20261024200000_inicio_y_planes.sql (D111). NUNCA la aplica db:migrar: se ejecuta a mano.
-- Antes, un volcado (privado/backups/). Se pierden los planes no oficiales (y sus respuestas), las ubicaciones libres,
-- las coordenadas de las pistas, los enlaces del calendario personal, el registro del tablero y los grupos de entreno.
-- Todo lo anterior queda como estaba.

drop function if exists public.mis_grupos();
drop function if exists public.mi_posicion();
drop function if exists public.tablero_deshacer(uuid);
drop function if exists public.tablero_responder(uuid, text[], text, text, text);
drop function if exists public.calendario_personal(text);
drop function if exists public.mi_calendario_regenerar();
drop function if exists public.mi_calendario_registrar(text, int);
drop function if exists public.mi_calendario_version();
drop function if exists public.marcar_aviso_visto(uuid);
drop function if exists public.responder_plan(uuid, text);
drop function if exists public.hacer_oficial(uuid);
drop function if exists public.borrar_plan(uuid);
drop function if exists public.cancelar_plan(uuid, boolean);
drop function if exists public.editar_plan(uuid, jsonb);
drop function if exists public._avisar_organizador(public.eventos, text);
drop function if exists public._plan_de(uuid);
drop function if exists public.crear_plan(jsonb);
drop function if exists public._plan_aplicar(uuid, jsonb);
drop function if exists public._plan_valido(jsonb, boolean);
drop view if exists public.v_mi_agenda;
drop function if exists public._mi_agenda();
drop table if exists public.grupos_repartos;
drop table if exists public.tablero_registro;
drop table if exists public.calendario_tokens;
drop table if exists public.avisos_personales;
alter table public.respuestas drop column if exists sporteasy_descartado;

-- Los planes no oficiales no existian antes: sus respuestas, alertas y avisos, y ellos, fuera.
delete from public.respuestas where evento_id in (select id from public.eventos where not oficial);
delete from public.alertas_gestores where evento_id in (select id from public.eventos where not oficial);
delete from public.eventos where not oficial;
update public.eventos set tipo = 'interno' where tipo in ('quedada', 'pachanga', 'otro');

-- _invitado y v_eventos_publicos como en 20261008102000_quien_responde y 20261007230000_eventos_pistas.
create or replace function public._invitado(p_person text, p_evento uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.jugadores j join public.eventos e on e.id = p_evento
    where j.person_id = p_person and j.activo and j.rol <> 'entrenador'
      and case
            when e.tipo in ('entreno', 'interno') then (j.entrena or j.ficha_mda or j.ficha_mdl)
            when j.rol = 'solo_entreno' then false
            when e.equipo = 'MdA' then j.ficha_mda
            when e.equipo = 'MdL' then j.ficha_mdl
            else (j.ficha_mda or j.ficha_mdl)
          end)
$$;

create or replace view public.v_eventos_publicos as
select
  e.clave, e.temporada, e.tipo, e.equipo, e.titulo, e.jornada, e.rival, e.es_local,
  e.fecha, e.inicio, e.fin, e.quedada, e.notas, e.estado,
  case when p.id is not null then p.nombre when ps.estado = 'habitual' then ps.nombre else null end as pista_nombre,
  case when p.id is not null then p.nombre_corto when ps.estado = 'habitual' then ps.nombre_corto else null end as pista_nombre_corto,
  case when p.id is not null then e.numero_pista else null end as numero_pista,
  (p.id is null and (e.tipo <> 'entreno' or ps.id is null or ps.estado <> 'habitual')) as pista_por_confirmar,
  case when p.id is null and e.tipo = 'entreno' and ps.id is not null and ps.estado = 'en_obras'
       then split_part(ps.nombre, ' (', 1) || ' en obras' else null end as pista_motivo
from public.eventos e
left join public.pistas p  on p.id = e.pista_id
left join public.pistas ps on e.pista_id is null and e.tipo = 'entreno' and ps.es_de_serie and ps.uso = 'entreno';

drop trigger if exists eventos_secuencia on public.eventos;
drop function if exists public._eventos_secuencia();
alter table public.eventos drop constraint if exists plan_con_organizador;
alter table public.eventos drop column if exists secuencia;
alter table public.eventos drop column if exists ubicacion_enlace;
alter table public.eventos drop column if exists ubicacion_lng;
alter table public.eventos drop column if exists ubicacion_lat;
alter table public.eventos drop column if exists ubicacion_direccion;
alter table public.eventos drop column if exists ubicacion_nombre;
alter table public.eventos drop column if exists borrado_por_nombre;
alter table public.eventos drop column if exists borrado_en;
alter table public.eventos drop column if exists rival_texto;
alter table public.eventos drop column if exists recordar_un_dia_antes;
alter table public.eventos drop column if exists plazas;
alter table public.eventos drop column if exists creado_por;
alter table public.eventos drop column if exists oficial;
alter table public.eventos drop constraint eventos_tipo_check;
alter table public.eventos add constraint eventos_tipo_check check (tipo in ('entreno', 'liga', 'amistoso', 'torneo', 'interno'));
alter table public.pistas drop column if exists lng;
alter table public.pistas drop column if exists lat;

delete from supabase_migrations.schema_migrations where version = '20261024200000';
