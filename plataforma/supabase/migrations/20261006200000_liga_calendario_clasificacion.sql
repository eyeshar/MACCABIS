-- =============================================================================
-- Liga 26/27, pantallas de gestion (D73): calendario propio, clasificacion calculada y acumulado por jugador
-- por equipo (no por dorsal).
--
--  - liga_calendario:     los partidos de MdA y MdL (data/calendario_2026-27.json), para "proximo partido contra
--                         nosotros". La app no lee ficheros del repositorio: lo necesario vive aqui.
--  - liga_clasificacion:  la clasificacion CALCULADA que tambien se publica (data/liga_2026-27.json); es la misma, para
--                         que la gestion y la web no puedan discrepar. pts null = "pendiente de la oficial" (D74).
-- Ambas: RLS solo lectura para gestores, igual que liga_partidos (D73). Las escribe solo `npm run db:liga`.
-- =============================================================================

create table public.liga_calendario (
  temporada  text not null,
  equipo     text not null check (equipo in ('MDA', 'MDL')),
  jornada    int  not null,
  fecha      date,
  hora       text,
  local      boolean,
  descansa   boolean not null default false,
  rival      text,
  campo      text,
  primary key (temporada, equipo, jornada)
);

create table public.liga_clasificacion (
  temporada  text not null,
  grupo      text not null,
  pos        int  not null,
  equipo     text not null,
  nuestro    boolean not null default false,
  pj         int  not null,
  g          int  not null,
  p          int  not null,
  pf         int  not null,
  pc         int  not null,
  pts        int,
  pts_fuente text,
  primary key (temporada, grupo, equipo)
);

alter table public.liga_calendario enable row level security;
alter table public.liga_clasificacion enable row level security;
create policy gestores_leen on public.liga_calendario    for select to authenticated using (public.is_gestor());
create policy gestores_leen on public.liga_clasificacion for select to authenticated using (public.is_gestor());
revoke all on public.liga_calendario, public.liga_clasificacion from anon, authenticated, public;
grant select on public.liga_calendario, public.liga_clasificacion to authenticated;

-- El acumulado por jugador agrupa por equipo y nombre (el dorsal puede cambiar de un partido a otro).
drop view public.v_liga_jugadores;
create view public.v_liga_jugadores with (security_invoker = true) as
  select p.temporada, p.grupo, e.equipo, e.nombre,
         min(e.dorsal) as dorsal,
         (count(*) filter (where e.segundos > 0))::int as pj,
         sum(e.segundos)::int as segundos,
         sum(e.pts)::int as pts,
         sum(e.p2a)::int as p2a, sum(e.p3a)::int as p3a,
         sum(e.tla)::int as tla, sum(e.tli)::int as tli,
         sum(e.faltas)::int as faltas
  from public.liga_estadisticas_jugador e
  join public.liga_partidos p on p.id = e.partido_id
  group by p.temporada, p.grupo, e.equipo, e.nombre;
revoke all on public.v_liga_jugadores from anon, authenticated, public;
grant select on public.v_liga_jugadores to authenticated;
