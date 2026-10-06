-- =============================================================================
-- Liga 26/27: partidos de TODOS los equipos de nuestros dos grupos y estadisticas
-- POR JUGADOR de todos los equipos (D73).
--
-- PRIVACIDAD: los datos por jugador de otros equipos son de terceros (D43). Solo
-- viven aqui, en tablas que SOLO LEEN LOS GESTORES (RLS + is_gestor()). anon y los
-- jugadores no tienen ningun permiso. Nunca van al repositorio ni a GitHub Pages
-- (alli solo van los datos por equipo, data/liga_<temporada>.json).
-- Las escribe unicamente el script local `npm run db:liga` (conexion directa, sin
-- sesion web): ningun rol de la API tiene insert/update/delete (D58, minimo).
-- =============================================================================

create table public.liga_partidos (
  id            uuid primary key default gen_random_uuid(),
  temporada     text not null,
  grupo         text not null,                       -- 'G1' (MdA) | 'G2' (MdL)
  jornada       int  not null check (jornada > 0),
  fecha         date,
  local         text not null,
  visitante     text not null,
  pts_local     int  not null check (pts_local >= 0),
  pts_visitante int  not null check (pts_visitante >= 0),
  hoja          text,                                -- nombre del XLSX de origen (fuera de git)
  nuestro       boolean not null default false,      -- juega MdA o MdL
  cargado_en    timestamptz not null default now(),
  unique (temporada, grupo, jornada, local, visitante),
  check (local <> visitante)
);

create table public.liga_estadisticas_jugador (
  id          uuid primary key default gen_random_uuid(),
  partido_id  uuid not null references public.liga_partidos(id) on delete cascade,
  equipo      text not null,
  dorsal      text not null,
  nombre      text not null,
  segundos    int  not null default 0,               -- minutos jugados, en segundos
  pts         int  not null default 0,
  p2a         int  not null default 0,               -- en 2P y 3P la hoja solo registra los ACERTADOS
  p2i         int  not null default 0,
  p3a         int  not null default 0,
  p3i         int  not null default 0,
  tla         int  not null default 0,               -- tiros libres anotados / intentados
  tli         int  not null default 0,
  faltas      int  not null default 0,               -- faltas cometidas
  valoracion  int  not null default 0,
  mas_menos   int  not null default 0,
  unique (partido_id, equipo, dorsal, nombre)
);
create index liga_estadisticas_jugador_partido on public.liga_estadisticas_jugador (partido_id);

-- Acumulado por jugador (scouting y liga consolidada). security_invoker: la vista aplica la
-- RLS de quien la consulta, asi que un no-gestor ve 0 filas.
create view public.v_liga_jugadores with (security_invoker = true) as
  select p.temporada, p.grupo, e.equipo, e.dorsal, e.nombre,
         (count(*) filter (where e.segundos > 0))::int as pj,
         sum(e.segundos)::int as segundos,
         sum(e.pts)::int as pts,
         sum(e.p2a)::int as p2a, sum(e.p3a)::int as p3a,
         sum(e.tla)::int as tla, sum(e.tli)::int as tli,
         sum(e.faltas)::int as faltas
  from public.liga_estadisticas_jugador e
  join public.liga_partidos p on p.id = e.partido_id
  group by p.temporada, p.grupo, e.equipo, e.dorsal, e.nombre;

-- RLS: solo gestores, y solo lectura.
alter table public.liga_partidos enable row level security;
alter table public.liga_estadisticas_jugador enable row level security;
create policy gestores_leen on public.liga_partidos             for select to authenticated using (public.is_gestor());
create policy gestores_leen on public.liga_estadisticas_jugador for select to authenticated using (public.is_gestor());

revoke all on public.liga_partidos, public.liga_estadisticas_jugador, public.v_liga_jugadores from anon, authenticated, public;
grant select on public.liga_partidos, public.liga_estadisticas_jugador, public.v_liga_jugadores to authenticated;
