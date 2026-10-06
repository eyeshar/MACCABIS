-- =============================================================================
-- Asistencia con MOTIVOS de ausencia (D82): con excusa, sin excusa, no convocado,
-- lesion. Los necesitan los gestores; los jugadores nunca los ven (D46) y NUNCA
-- van a un fichero publico del repositorio (alli solo queda fueron / total / %).
--
-- Solo LEEN los gestores (RLS + is_gestor()). anon y los jugadores, nada.
-- La escribe unicamente el script local `npm run db:asistencia` (conexion directa,
-- sin sesion web) desde privado/asistencia/ (fuera de git): ningun rol de la API
-- tiene insert/update/delete (D58, minimo).
-- =============================================================================

create table public.asistencia_motivos (
  temporada   text not null,
  person_id   text not null,
  nombre      text not null,
  ambito      text not null check (ambito in ('partidos', 'entrenos')),
  fueron      int  not null default 0 check (fueron >= 0),
  excusa      int  not null default 0 check (excusa >= 0),
  sin_excusa  int  not null default 0 check (sin_excusa >= 0),
  no_conv     int  not null default 0 check (no_conv >= 0),
  lesion      int  not null default 0 check (lesion >= 0),
  total       int  not null default 0 check (total >= 0),
  cargado_en  timestamptz not null default now(),
  primary key (temporada, person_id, ambito)
);

alter table public.asistencia_motivos enable row level security;
create policy gestores_leen on public.asistencia_motivos for select to authenticated using (public.is_gestor());

revoke all on public.asistencia_motivos from anon, authenticated, public;
grant select on public.asistencia_motivos to authenticated;
