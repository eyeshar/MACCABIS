-- =============================================================================
-- Paso 2 (pista E, D94): EVENTOS y PISTAS en la plataforma (fase puente con SportEasy, D80).
--
-- SOLO ADITIVA (D94): crea tablas, vistas, politicas y funciones nuevas. No toca ninguna tabla existente. Su
-- reversion esta al lado: 20261007230000_eventos_pistas.revertir.sql.
--
--  - pistas:    catalogo de pistas (nombre, direccion, uso, estado, numero de pistas).
--  - eventos:   entrenos, partidos de liga, amistosos, torneos y eventos internos. Los partidos de liga vienen del
--               Ayuntamiento (origen 'ayuntamiento'); el resto, de la plataforma ('manual'). Cada fila guarda su
--               estado de copia a SportEasy (pendiente | copiado) y la descripcion del cambio pendiente.
--  - descansos: jornadas de descanso de MdA y MdL (no son eventos: no se juega).
--
-- RLS: escriben solo los gestores (is_gestor()). Nadie tiene DELETE por la API (un evento se CANCELA, no se borra).
-- Lo publico (calendario, .ics, portada) lee la vista v_eventos_publicos: sin respuestas, sin motivos, sin datos
-- personales, sin estado de SportEasy. anon no tiene permiso sobre ninguna tabla (D68), solo sobre las dos vistas.
-- =============================================================================

create table public.pistas (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  nombre       text not null,
  nombre_corto text,
  direccion    text,
  uso          text not null check (uso in ('entreno', 'partido')),
  estado       text not null check (estado in ('habitual', 'provisional', 'en_obras', 'cerrada')),
  es_de_serie  boolean not null default false,
  num_pistas   int check (num_pistas is null or num_pistas > 0),
  nota         text,
  creado_en    timestamptz not null default now()
);
comment on column public.pistas.es_de_serie is
  'Pista habitual de la serie de entrenos: los entrenos sin pista propia van a ella cuando su estado es habitual; si esta en obras, salen como "Pista por confirmar".';

create table public.eventos (
  id                   uuid primary key default gen_random_uuid(),
  clave                text not null unique,
  temporada            text not null default '2026-27',
  tipo                 text not null check (tipo in ('entreno', 'liga', 'amistoso', 'torneo', 'interno')),
  equipo               text not null check (equipo in ('MdA', 'MdL', 'ambos')),
  titulo               text,
  jornada              int  check (jornada is null or jornada > 0),
  rival                text,
  es_local             boolean,
  fecha                date not null,
  inicio               time,
  fin                  time,
  quedada              time,
  pista_id             uuid references public.pistas (id),
  numero_pista         int  check (numero_pista is null or numero_pista > 0),
  notas                text,
  origen               text not null default 'manual' check (origen in ('ayuntamiento', 'manual')),
  serie                text,
  estado               text not null default 'programado' check (estado in ('programado', 'cancelado')),
  sporteasy_estado     text not null default 'pendiente' check (sporteasy_estado in ('pendiente', 'copiado')),
  sporteasy_cambio     text,
  sporteasy_copiado_en timestamptz,
  creado_en            timestamptz not null default now(),
  actualizado_en       timestamptz not null default now()
);
create index eventos_fecha_idx on public.eventos (fecha);
create index eventos_serie_idx on public.eventos (serie) where serie is not null;

create table public.descansos (
  temporada text not null default '2026-27',
  equipo    text not null check (equipo in ('MdA', 'MdL')),
  jornada   int  not null check (jornada > 0),
  fecha     date,
  primary key (temporada, equipo, jornada)
);

-- Quedada por defecto: 20 minutos antes del inicio. Y un evento cuyos datos cambian vuelve a "pendiente de copiar" a
-- SportEasy aunque la aplicacion no lo diga (solo "Marcar como copiado" lo deja en 'copiado', cambiando ese campo).
create function public._eventos_antes_de_escribir()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.quedada is null and new.inicio is not null then
    new.quedada := new.inicio - interval '20 minutes';
  end if;
  if tg_op = 'UPDATE' then
    new.actualizado_en := now();
    if new.sporteasy_estado is not distinct from old.sporteasy_estado
       and (new.tipo, new.equipo, new.titulo, new.jornada, new.rival, new.es_local, new.fecha, new.inicio, new.fin,
            new.quedada, new.pista_id, new.numero_pista, new.notas, new.estado)
           is distinct from
           (old.tipo, old.equipo, old.titulo, old.jornada, old.rival, old.es_local, old.fecha, old.inicio, old.fin,
            old.quedada, old.pista_id, old.numero_pista, old.notas, old.estado) then
      new.sporteasy_estado := 'pendiente';
      new.sporteasy_cambio := coalesce(new.sporteasy_cambio, 'Cambio sin describir');
    end if;
  end if;
  return new;
end;
$$;
create trigger eventos_antes_de_escribir before insert or update on public.eventos
  for each row execute function public._eventos_antes_de_escribir();

-- ---------------------------------------------------------------- RLS
alter table public.pistas    enable row level security;
alter table public.eventos   enable row level security;
alter table public.descansos enable row level security;

create policy gestores_leen     on public.pistas    for select to authenticated using (public.is_gestor());
create policy gestores_insertan on public.pistas    for insert to authenticated with check (public.is_gestor());
create policy gestores_cambian  on public.pistas    for update to authenticated using (public.is_gestor()) with check (public.is_gestor());
create policy gestores_leen     on public.eventos   for select to authenticated using (public.is_gestor());
create policy gestores_insertan on public.eventos   for insert to authenticated with check (public.is_gestor());
create policy gestores_cambian  on public.eventos   for update to authenticated using (public.is_gestor()) with check (public.is_gestor());
create policy gestores_leen     on public.descansos for select to authenticated using (public.is_gestor());
create policy gestores_insertan on public.descansos for insert to authenticated with check (public.is_gestor());
create policy gestores_cambian  on public.descansos for update to authenticated using (public.is_gestor()) with check (public.is_gestor());

revoke all on public.pistas, public.eventos, public.descansos from anon, authenticated, public;
grant select, insert, update on public.pistas, public.eventos, public.descansos to authenticated;
revoke all on function public._eventos_antes_de_escribir() from public, anon, authenticated;

-- ---------------------------------------------------------------- lo publico: una vista, sin nada privado
-- Pista efectiva: la propia del evento; si no tiene y es un entreno, la de la serie SOLO si esta habitual (si esta en
-- obras, "Pista por confirmar" y pista_motivo dice cual). Un partido sin pista tambien sale "por confirmar".
create view public.v_eventos_publicos as
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

create view public.v_descansos_publicos as
select temporada, equipo, jornada, fecha from public.descansos;

revoke all on public.v_eventos_publicos, public.v_descansos_publicos from anon, authenticated, public;
grant select on public.v_eventos_publicos, public.v_descansos_publicos to anon, authenticated;

-- ---------------------------------------------------------------- carga inicial del catalogo de pistas (D94)
-- No se inventan direcciones: la de la Caja Magica la pone Ivan. La del CDM Moratalaz es la de /club (D88).
insert into public.pistas (slug, nombre, nombre_corto, direccion, uso, estado, es_de_serie, num_pistas, nota) values
  ('valdebernardo', 'Valdebernardo (Faustina Valladolid)', 'Valdebernardo', null, 'entreno', 'en_obras', true, null,
   'Cerrada por obras: cada miércoles sale «Pista por confirmar» hasta que reabra o se fije otra pista.'),
  ('caja-magica', 'Caja Mágica', 'Caja Mágica', null, 'entreno', 'provisional', false, null, 'Provisional.'),
  ('cdm-moratalaz', 'CDM Moratalaz', 'Moratalaz', 'C/ Valdebernardo, 2, 28030 Madrid', 'partido', 'habitual', false, 3,
   'Partidos de la Liga Municipal de Moratalaz (JDM). Pistas 1 a 3.');
