-- =============================================================================
-- Paso 2 (pista E, D94): RESPUESTAS, AUSENCIAS POR PERIODO, DICCIONARIO DE SPORTEASY, REGISTRO DE IMPORTACIONES y
-- el RESUMEN DE ASISTENCIA de la temporada.
--
-- SOLO ADITIVA (D94). Reversion al lado: 20261007231000_respuestas_ausencias_asistencia.revertir.sql.
--
--  - respuestas:            evento + persona -> va | duda | no | sin responder, con motivo y detalle, leidas de
--                           SportEasy (fuente) hasta el paso 3.
--  - ausencias_periodo:     "no estoy del X al Y" con su motivo (D87).
--  - diccionario_sporteasy: nombre tal como sale en SportEasy -> person_id. CERRADO: un nombre que no esta aqui nunca
--                           se empareja por parecido; se asigna a mano una vez.
--  - importaciones:         registro de cada importacion (quien, cuando, cuantas lineas, que se acepto).
--  - asistencia_resumen:    COPIA de public.asistencia_motivos (que no se toca) en la estructura nueva, con el recuento
--                           verificado dentro de esta misma migracion: si no cuadra, se aborta y no se aplica nada.
--
-- RLS: LEEN solo los gestores (los jugadores tampoco ven los de otros, D46/D82); escriben solo los gestores. Ninguna
-- tabla tiene DELETE. Lo publico no ve nada de esto.
-- =============================================================================

create table public.respuestas (
  id         uuid primary key default gen_random_uuid(),
  evento_id  uuid not null references public.eventos (id),
  person_id  text not null,
  respuesta  text not null check (respuesta in ('va', 'duda', 'no', 'sin_responder')),
  motivo     text check (motivo in ('lesion', 'trabajo', 'viaje', 'familia', 'otro')),
  detalle    text,
  fuente     text not null default 'sporteasy' check (fuente in ('sporteasy')),
  leido_en   timestamptz not null default now(),
  unique (evento_id, person_id)
);
create index respuestas_persona_idx on public.respuestas (person_id);

create table public.ausencias_periodo (
  id        uuid primary key default gen_random_uuid(),
  person_id text not null,
  desde     date not null,
  hasta     date not null,
  motivo    text not null check (motivo in ('lesion', 'trabajo', 'viaje', 'familia', 'otro')),
  fuente    text not null default 'sporteasy' check (fuente in ('sporteasy')),
  leido_en  timestamptz not null default now(),
  check (hasta >= desde),
  unique (person_id, desde, hasta)
);

create table public.diccionario_sporteasy (
  nombre_sporteasy text primary key,
  person_id        text not null,
  creado_en        timestamptz not null default now(),
  creado_por       text
);

create table public.importaciones (
  id           uuid primary key default gen_random_uuid(),
  tipo         text not null check (tipo in ('calendario', 'respuestas')),
  por_user_id  uuid,
  por_nombre   text not null,
  en           timestamptz not null default now(),
  lineas       int  not null default 0,
  validas      int  not null default 0,
  aceptadas    int  not null default 0,
  ignoradas    int  not null default 0,
  bloqueadas   int  not null default 0,
  detalle      jsonb not null default '{}'::jsonb
);

create table public.asistencia_resumen (
  temporada         text not null,
  person_id         text not null,
  nombre            text not null,
  ambito            text not null check (ambito in ('partidos', 'entrenos')),
  fueron            int  not null default 0 check (fueron >= 0),
  total             int  not null default 0 check (total >= 0),
  con_excusa        int  not null default 0 check (con_excusa >= 0),
  sin_excusa        int  not null default 0 check (sin_excusa >= 0),
  no_convocado      int  not null default 0 check (no_convocado >= 0),
  lesion            int  not null default 0 check (lesion >= 0),
  origen            text not null default 'asistencia_motivos',
  copiado_en        timestamptz not null default now(),
  primary key (temporada, person_id, ambito)
);

-- ---------------------------------------------------------------- RLS
alter table public.respuestas             enable row level security;
alter table public.ausencias_periodo      enable row level security;
alter table public.diccionario_sporteasy  enable row level security;
alter table public.importaciones          enable row level security;
alter table public.asistencia_resumen     enable row level security;

create policy gestores_leen     on public.respuestas for select to authenticated using (public.is_gestor());
create policy gestores_insertan on public.respuestas for insert to authenticated with check (public.is_gestor());
create policy gestores_cambian  on public.respuestas for update to authenticated using (public.is_gestor()) with check (public.is_gestor());
create policy gestores_leen     on public.ausencias_periodo for select to authenticated using (public.is_gestor());
create policy gestores_insertan on public.ausencias_periodo for insert to authenticated with check (public.is_gestor());
create policy gestores_cambian  on public.ausencias_periodo for update to authenticated using (public.is_gestor()) with check (public.is_gestor());
create policy gestores_leen     on public.diccionario_sporteasy for select to authenticated using (public.is_gestor());
create policy gestores_insertan on public.diccionario_sporteasy for insert to authenticated with check (public.is_gestor());
create policy gestores_cambian  on public.diccionario_sporteasy for update to authenticated using (public.is_gestor()) with check (public.is_gestor());
create policy gestores_leen     on public.importaciones for select to authenticated using (public.is_gestor());
create policy gestores_insertan on public.importaciones for insert to authenticated with check (public.is_gestor());
create policy gestores_leen     on public.asistencia_resumen for select to authenticated using (public.is_gestor());

revoke all on public.respuestas, public.ausencias_periodo, public.diccionario_sporteasy, public.importaciones,
  public.asistencia_resumen from anon, authenticated, public;
grant select, insert, update on public.respuestas, public.ausencias_periodo, public.diccionario_sporteasy to authenticated;
grant select, insert on public.importaciones to authenticated;
grant select on public.asistencia_resumen to authenticated;

-- ---------------------------------------------------------------- copia de asistencia_motivos (que NO se toca)
insert into public.asistencia_resumen (temporada, person_id, nombre, ambito, fueron, total, con_excusa, sin_excusa, no_convocado, lesion)
select temporada, person_id, nombre, ambito, fueron, total, excusa, sin_excusa, no_conv, lesion
from public.asistencia_motivos;

do $$
declare
  a record;
  b record;
begin
  select count(*) n, coalesce(sum(fueron), 0) f, coalesce(sum(total), 0) t, coalesce(sum(excusa), 0) e,
         coalesce(sum(sin_excusa), 0) s, coalesce(sum(no_conv), 0) nc, coalesce(sum(lesion), 0) l
    into a from public.asistencia_motivos;
  select count(*) n, coalesce(sum(fueron), 0) f, coalesce(sum(total), 0) t, coalesce(sum(con_excusa), 0) e,
         coalesce(sum(sin_excusa), 0) s, coalesce(sum(no_convocado), 0) nc, coalesce(sum(lesion), 0) l
    into b from public.asistencia_resumen;
  if a is distinct from b then
    raise exception 'La copia de asistencia_motivos no cuadra: origen % / copia %', a, b;
  end if;
  if exists (
    select 1 from public.asistencia_motivos m
    left join public.asistencia_resumen r using (temporada, person_id, ambito)
    where r.person_id is null or (m.fueron, m.total, m.excusa, m.sin_excusa, m.no_conv, m.lesion)
                                 is distinct from (r.fueron, r.total, r.con_excusa, r.sin_excusa, r.no_convocado, r.lesion)
  ) then
    raise exception 'La copia de asistencia_motivos no cuadra fila a fila';
  end if;
end;
$$;

-- ---------------------------------------------------------------- diccionario inicial (scripts/estadisticas/nombres_sporteasy.json)
-- Se carga con `npm run db:eventos` (lee ese fichero), no aqui: asi hay una sola fuente.
