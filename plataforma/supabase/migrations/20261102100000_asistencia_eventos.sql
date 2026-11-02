-- =============================================================================
-- Asistencia EVENTO A EVENTO (D170): una fila por persona y evento, con fecha, ámbito, equipo y estado. Alimenta el
-- rediseño de «Asistencia y motivos» (periodo «últimas 4 semanas», tendencia, equipo MdA/MdL, últimos 10 eventos).
--
-- SOLO ADITIVA (D94, D111): una tabla nueva; no toca asistencia_motivos ni nada existente. Reversión al lado:
-- 20261102100000_asistencia_eventos.revertir.sql (db:migrar nunca la aplica).
--
-- Confidencial (D46, D82): solo LEEN los gestores (RLS + is_gestor()). anon y los jugadores, nada. No la escribe ningún
-- rol de la API (ni siquiera un gestor): solo el script local `npm run db:asistencia-eventos` (conexión directa, sin
-- sesión web), desde el export de SportEasy que está en privado/ (fuera de git).
--
--  - evento_ref: 'se-<id del evento en SportEasy>'. Las respuestas de la plataforma (desde el 24/10/2026, D161) NO se
--    guardan aquí: la pantalla las suma en vivo a partir de eventos y respuestas, para que no se queden viejas.
--  - estado: fue | con_excusa | sin_excusa | no_convocado | lesion. «no_convocado» y «lesion» se excluyen del cálculo.
--  - equipo: MdA | MdL en los partidos; null en los entrenos (son comunes).
-- =============================================================================

create table public.asistencia_eventos (
  person_id   text not null,
  evento_ref  text not null,
  nombre      text not null,
  temporada   text not null,
  fecha       date not null,
  ambito      text not null check (ambito in ('entrenos', 'partidos')),
  equipo      text check (equipo in ('MdA', 'MdL')),
  titulo      text,
  estado      text not null check (estado in ('fue', 'con_excusa', 'sin_excusa', 'no_convocado', 'lesion')),
  motivo      text,
  origen      text not null default 'sporteasy' check (origen in ('sporteasy', 'plataforma')),
  cargado_en  timestamptz not null default now(),
  primary key (person_id, evento_ref),
  check (ambito = 'partidos' or equipo is null)
);
create index asistencia_eventos_temporada_idx on public.asistencia_eventos (temporada, fecha);

alter table public.asistencia_eventos enable row level security;
create policy gestores_leen on public.asistencia_eventos for select to authenticated using (public.is_gestor());

revoke all on public.asistencia_eventos from anon, authenticated, public;
grant select on public.asistencia_eventos to authenticated;

comment on table public.asistencia_eventos is 'D170: asistencia evento a evento (SportEasy hasta el 23/10/2026). Solo gestores; la escribe únicamente db:asistencia-eventos.';
