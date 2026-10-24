-- =============================================================================
-- Convocatoria v1 (D107): DATOS PRIVADOS POR JUGADOR, CONVOCATORIAS y CAMBIOS CON MOTIVO.
--
-- SOLO ADITIVA (D94): tres tablas nuevas, sus politicas y funciones nuevas. No toca nada de lo que ya existe.
-- Reversion al lado: 20261023100000_convocatoria.revertir.sql (db:migrar nunca la aplica).
--
--  - jugadores_privado:    posicion, base de reserva, nivel A-E, notas (ataque, defensa, total, minutos y puntos por
--                          minuto, D108), Dobla / No dobla (recomendacion), regla personal
--                          ("fijo a un equipo" o "va al equipo al que le falte un jugador") y sancion. Confidencial
--                          (D39): SOLO los gestores la leen y la escriben. "Solo entreno" y las fichas siguen en
--                          public.jugadores (rol y ficha_mda / ficha_mdl), como hasta ahora.
--  - convocatorias:        una por domingo: lo convocado por equipo (jsonb, solo person_id y la posicion del partido
--                          si se cambia a mano), la dificultad de cada rival (propuesta y la de Ivan), el estado
--                          (borrador | aprobada) y el estado de las tres salidas: WhatsApp, aviso en la web y SportEasy.
--  - convocatoria_cambios: cada cambio, con quien, cuando y su MOTIVO (obligatorio en los cambios a mano).
--
-- RLS: leen y escriben SOLO los gestores. Nadie borra por la API (sin DELETE). Los jugadores no ven ninguna de las tres
-- tablas: solo mi_convocatoria(), que devuelve SUS equipos de las convocatorias APROBADAS (ni niveles, ni posiciones,
-- ni propuestas, ni la convocatoria de otros).
-- Horas: Europe/Madrid.
-- =============================================================================

create table public.jugadores_privado (
  person_id                 text primary key references public.jugadores (person_id),
  posicion                  text check (posicion in ('base', 'escolta', 'alero', 'ala_pivot', 'pivot')),
  base_reserva              boolean not null default false,
  nivel                     text check (nivel in ('A', 'B', 'C', 'D', 'E')),
  dobla                     boolean not null default true,
  regla                     text check (regla in ('fijo', 'comodin')),
  regla_equipo              text check (regla_equipo in ('MdA', 'MdL')),
  sancionado_hasta_jornada  int check (sancionado_hasta_jornada > 0),
  nota                      text,
  -- Notas de referencia de la hoja de Ivan (privado/jugadores_2026-27.xlsx, D108): ataque USADO (con 300 minutos o mas,
  -- de los puntos por minuto; si no, el de Ivan), defensa, total calculado, minutos, puntos y puntos por minuto.
  -- El nivel que usa el motor es «nivel» (el que fija Ivan a mano), no el total.
  nota_ataque               text check (nota_ataque in ('A', 'B', 'C', 'D', 'E')),
  nota_defensa              text check (nota_defensa in ('A', 'B', 'C', 'D', 'E')),
  nota_total                text check (nota_total in ('A', 'B', 'C', 'D', 'E')),
  minutos                   int check (minutos >= 0),
  puntos                    int check (puntos >= 0),
  pts_min                   numeric(6, 4) check (pts_min >= 0),
  notas_fuente              text,
  cambiado_en               timestamptz not null default now(),
  cambiado_por_nombre       text,
  constraint regla_fijo_con_equipo check ((regla = 'fijo') = (regla_equipo is not null))
);
comment on table public.jugadores_privado is 'Datos de convocatoria por jugador (D39, D107). Confidencial: solo gestores.';
comment on column public.jugadores_privado.dobla is 'Recomendacion (no regla): Ivan hace excepciones por partido.';

create table public.convocatorias (
  id                   uuid primary key default gen_random_uuid(),
  temporada            text not null default '2026-27',
  fecha                date not null unique,
  jornada              int,
  estado               text not null default 'borrador' check (estado in ('borrador', 'aprobada')),
  -- null = aun no se ha elegido «Usar propuesta» ni «Empezar en blanco» (puede haber ya dificultad)
  origen               text check (origen in ('propuesta', 'blanco')),
  -- {"MdA": [{"person_id": "...", "posicion": "escolta"?}], "MdL": [...]}
  equipos              jsonb not null default '{}'::jsonb,
  -- {"MdA": {"valor": "alta", "propuesta": "media", "porque": "10.o del G1 tras la J2 (-5 por partido)"}}
  dificultad           jsonb not null default '{}'::jsonb,
  creado_en            timestamptz not null default now(),
  creado_por_nombre    text,
  cambiado_en          timestamptz not null default now(),
  cambiado_por_nombre  text,
  aprobada_en          timestamptz,
  aprobada_por_nombre  text,
  -- Salidas (D107): WhatsApp y SportEasy vuelven a «pendiente» si la convocatoria cambia tras aprobarla; *_base es
  -- lo que se copio la ultima vez (para decir que ha cambiado).
  whatsapp_estado      text not null default 'pendiente' check (whatsapp_estado in ('pendiente', 'al_dia')),
  whatsapp_en          timestamptz,
  whatsapp_base        jsonb,
  sporteasy_estado     text not null default 'pendiente' check (sporteasy_estado in ('pendiente', 'al_dia')),
  sporteasy_en         timestamptz,
  sporteasy_base       jsonb,
  -- Aviso «Estas convocado» en la web: solo sale con el interruptor de respuestas en la web encendido (D99).
  aviso_estado         text not null default 'sin_preparar' check (aviso_estado in ('sin_preparar', 'en_espera', 'enviado')),
  aviso_en             timestamptz,
  aviso_base           jsonb,
  constraint equipos_objeto check (jsonb_typeof(equipos) = 'object'),
  constraint dificultad_objeto check (jsonb_typeof(dificultad) = 'object')
);

create table public.convocatoria_cambios (
  id               uuid primary key default gen_random_uuid(),
  convocatoria_id  uuid not null references public.convocatorias (id),
  en               timestamptz not null default now(),
  por_user_id      uuid,
  por_nombre       text not null,
  accion           text not null check (accion in ('propuesta', 'blanco', 'recalcular', 'mover', 'doblar', 'quitar',
                                                   'anadir', 'posicion', 'dificultad', 'aprobar', 'whatsapp',
                                                   'sporteasy', 'aviso')),
  person_id        text,
  equipo           text check (equipo in ('MdA', 'MdL')),
  motivo           text check (motivo in ('rotacion', 'rival', 'lesion', 'equilibrar', 'pedido', 'otro')),
  nota             text,
  detalle          jsonb not null default '{}'::jsonb,
  -- Un cambio a mano de un jugador siempre lleva su motivo (D107: «cada cambio guarda su motivo»).
  constraint cambio_a_mano_con_motivo check (accion not in ('mover', 'doblar', 'quitar', 'anadir', 'posicion') or motivo is not null)
);
create index convocatoria_cambios_conv_idx on public.convocatoria_cambios (convocatoria_id, en);

-- ---------------------------------------------------------------- funciones
create function public._nombre_gestor()
returns text language sql stable security definer set search_path = ''
as $$ select coalesce((select nombre from public.gestores where user_id = auth.uid()), 'gestor') $$;

-- Guarda la convocatoria de un domingo (la crea si no existe) y apunta el cambio con su motivo, todo a la vez.
-- Si ya estaba aprobada y cambia lo convocado, WhatsApp y SportEasy vuelven a «pendiente».
create function public.convocatoria_guardar(p_fecha date, p_jornada int, p_equipos jsonb, p_dificultad jsonb,
                                            p_accion text, p_person text default null, p_equipo text default null,
                                            p_motivo text default null, p_nota text default null,
                                            p_detalle jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  c public.convocatorias;
  v_nombre text := public._nombre_gestor();
  v_cambia boolean;
begin
  if not public.is_gestor() then raise exception 'solo_gestores' using errcode = 'P0001'; end if;
  if p_equipos is not null and (jsonb_typeof(p_equipos) <> 'object'
       or exists (select 1 from jsonb_object_keys(p_equipos) k where k not in ('MdA', 'MdL'))) then
    raise exception 'equipos_no_validos' using errcode = 'P0001';
  end if;
  insert into public.convocatorias (fecha, jornada, creado_por_nombre, cambiado_por_nombre)
  values (p_fecha, p_jornada, v_nombre, v_nombre)
  on conflict (fecha) do nothing;
  select * into c from public.convocatorias where fecha = p_fecha for update;
  v_cambia := p_equipos is not null and p_equipos is distinct from c.equipos;
  update public.convocatorias set
    jornada = coalesce(p_jornada, jornada),
    equipos = coalesce(p_equipos, equipos),
    dificultad = coalesce(p_dificultad, dificultad),
    origen = case when p_accion in ('propuesta', 'blanco') then p_accion else origen end,
    cambiado_en = now(), cambiado_por_nombre = v_nombre,
    whatsapp_estado = case when estado = 'aprobada' and v_cambia then 'pendiente' else whatsapp_estado end,
    sporteasy_estado = case when estado = 'aprobada' and v_cambia then 'pendiente' else sporteasy_estado end
  where id = c.id
  returning * into c;
  insert into public.convocatoria_cambios (convocatoria_id, por_user_id, por_nombre, accion, person_id, equipo, motivo, nota, detalle)
  values (c.id, auth.uid(), v_nombre, p_accion, p_person, p_equipo, p_motivo, nullif(btrim(coalesce(p_nota, '')), ''),
          coalesce(p_detalle, '{}'::jsonb));
  return jsonb_build_object('id', c.id, 'estado', c.estado, 'whatsapp', c.whatsapp_estado, 'sporteasy', c.sporteasy_estado);
end $$;

-- «Aprobar convocatoria»: pasa a aprobada; WhatsApp y SportEasy quedan pendientes de copiar.
create function public.convocatoria_aprobar(p_fecha date)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  c public.convocatorias;
  v_nombre text := public._nombre_gestor();
begin
  if not public.is_gestor() then raise exception 'solo_gestores' using errcode = 'P0001'; end if;
  update public.convocatorias set
    estado = 'aprobada', aprobada_en = now(), aprobada_por_nombre = v_nombre,
    whatsapp_estado = case when whatsapp_base is not distinct from equipos then whatsapp_estado else 'pendiente' end,
    sporteasy_estado = case when sporteasy_base is not distinct from equipos then sporteasy_estado else 'pendiente' end
  where fecha = p_fecha and origen is not null
  returning * into c;
  if c.id is null then raise exception 'sin_convocatoria' using errcode = 'P0001'; end if;
  insert into public.convocatoria_cambios (convocatoria_id, por_user_id, por_nombre, accion)
  values (c.id, auth.uid(), v_nombre, 'aprobar');
  return jsonb_build_object('id', c.id, 'estado', c.estado);
end $$;

-- Marca una salida: 'whatsapp' (copiado al grupo), 'sporteasy' (copiado por Claude, sin notificar, D104),
-- 'aviso_enviado' o 'aviso_en_espera' (el aviso «Estas convocado» de la web).
create function public.convocatoria_marcar(p_fecha date, p_que text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  c public.convocatorias;
  v_nombre text := public._nombre_gestor();
begin
  if not public.is_gestor() then raise exception 'solo_gestores' using errcode = 'P0001'; end if;
  if p_que not in ('whatsapp', 'sporteasy', 'aviso_enviado', 'aviso_en_espera') then
    raise exception 'salida_no_valida' using errcode = 'P0001';
  end if;
  update public.convocatorias set
    whatsapp_estado = case when p_que = 'whatsapp' then 'al_dia' else whatsapp_estado end,
    whatsapp_en = case when p_que = 'whatsapp' then now() else whatsapp_en end,
    whatsapp_base = case when p_que = 'whatsapp' then equipos else whatsapp_base end,
    sporteasy_estado = case when p_que = 'sporteasy' then 'al_dia' else sporteasy_estado end,
    sporteasy_en = case when p_que = 'sporteasy' then now() else sporteasy_en end,
    sporteasy_base = case when p_que = 'sporteasy' then equipos else sporteasy_base end,
    aviso_estado = case when p_que = 'aviso_enviado' then 'enviado' when p_que = 'aviso_en_espera' then 'en_espera' else aviso_estado end,
    aviso_en = case when p_que in ('aviso_enviado', 'aviso_en_espera') then now() else aviso_en end,
    aviso_base = case when p_que = 'aviso_enviado' then equipos else aviso_base end
  where fecha = p_fecha and estado = 'aprobada'
  returning * into c;
  if c.id is null then raise exception 'sin_aprobar' using errcode = 'P0001'; end if;
  insert into public.convocatoria_cambios (convocatoria_id, por_user_id, por_nombre, accion, detalle)
  values (c.id, auth.uid(), v_nombre, case when p_que like 'aviso%' then 'aviso' else p_que end, jsonb_build_object('que', p_que));
  return jsonb_build_object('whatsapp', c.whatsapp_estado, 'sporteasy', c.sporteasy_estado, 'aviso', c.aviso_estado);
end $$;

-- Lo UNICO que ve un jugador (Mi zona): de las convocatorias APROBADAS de hoy en adelante, la fecha y en que equipos
-- esta EL (lista vacia si no esta). Ni niveles, ni posiciones, ni propuestas, ni a quien mas se ha convocado.
create function public.mi_convocatoria()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'fecha', c.fecha,
           'equipos', (select coalesce(jsonb_agg(k order by k), '[]'::jsonb)
                       from jsonb_object_keys(c.equipos) k
                       where exists (select 1 from jsonb_array_elements(c.equipos -> k) x
                                     where x ->> 'person_id' = public._mi_person_id())))
         order by c.fecha), '[]'::jsonb)
  from public.convocatorias c
  where c.estado = 'aprobada' and c.fecha >= (now() at time zone 'Europe/Madrid')::date
    and public._mi_person_id() is not null
$$;

-- ---------------------------------------------------------------- RLS
alter table public.jugadores_privado    enable row level security;
alter table public.convocatorias        enable row level security;
alter table public.convocatoria_cambios enable row level security;

create policy gestores_leen     on public.jugadores_privado for select to authenticated using (public.is_gestor());
create policy gestores_insertan on public.jugadores_privado for insert to authenticated with check (public.is_gestor());
create policy gestores_cambian  on public.jugadores_privado for update to authenticated using (public.is_gestor()) with check (public.is_gestor());
create policy gestores_leen     on public.convocatorias for select to authenticated using (public.is_gestor());
create policy gestores_leen     on public.convocatoria_cambios for select to authenticated using (public.is_gestor());

-- Convocatorias y cambios se escriben SOLO con las funciones de arriba (que comprueban is_gestor y apuntan el cambio).
revoke all on public.jugadores_privado, public.convocatorias, public.convocatoria_cambios from anon, authenticated, public;
grant select, insert, update on public.jugadores_privado to authenticated;
grant select on public.convocatorias, public.convocatoria_cambios to authenticated;

-- La tarea de avisos (servidor, service_role) lee las convocatorias para el aviso «Estas convocado».
do $$
begin
  grant select on public.convocatorias to service_role;
exception when undefined_object then
  null;
end $$;

revoke execute on function
  public._nombre_gestor(), public.convocatoria_guardar(date, int, jsonb, jsonb, text, text, text, text, text, jsonb),
  public.convocatoria_aprobar(date), public.convocatoria_marcar(date, text), public.mi_convocatoria()
  from public, anon, authenticated;
grant execute on function
  public.convocatoria_guardar(date, int, jsonb, jsonb, text, text, text, text, text, jsonb),
  public.convocatoria_aprobar(date), public.convocatoria_marcar(date, text), public.mi_convocatoria()
  to authenticated;
