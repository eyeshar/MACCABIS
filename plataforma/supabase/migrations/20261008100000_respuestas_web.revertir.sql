-- Reversion de 20261008100000_respuestas_web.sql (D94/D99). NUNCA la aplica db:migrar: se ejecuta a mano y en una sola
-- transaccion (psql -1 -f ...).
-- Deja las tablas de antes como estaban. OJO: lo que se haya respondido en la web (respuestas y ausencias con
-- fuente 'web') no existe en el modelo anterior y se pierde: antes de ejecutar esto, volcado completo (D94).

drop trigger if exists eventos_tras_escribir on public.eventos;

drop view if exists public.v_quien_va;
drop view if exists public.v_mis_eventos;
drop function if exists public._quien_va();
drop function if exists public._mis_eventos();
drop policy if exists jugador_lee_las_suyas on public.respuestas;
drop policy if exists jugador_lee_las_suyas on public.ausencias_periodo;

drop function if exists public.responder_por(uuid, text, text, text, text);
drop function if exists public.respuestas_web_encendido();
drop function if exists public.borrar_ausencia(uuid);
drop function if exists public.cerrar_ausencia(uuid);
drop function if exists public.guardar_ausencia(uuid, date, date, text, text);
drop function if exists public.previsualizar_ausencia(date, date);
drop function if exists public._eventos_del_periodo(text, date, date);
drop function if exists public.responder_domingo_por(date, text, text, uuid, text, text);
drop function if exists public.responder_domingo(date, text, uuid, text, text);
drop function if exists public._responder_domingo_de(text, date, text, uuid, text, text, text, text);
drop function if exists public.responder(uuid, text, text, text);
drop function if exists public._validar_respuesta(text, text);
drop function if exists public._exigir_encendido();
drop function if exists public._exigir_jugador();
drop function if exists public._eventos_tras_escribir();
drop function if exists public._soltar_ausencia(uuid);
drop function if exists public._aplicar_ausencias_evento(uuid);
drop function if exists public._ausencia_que_cubre(text, date);
drop function if exists public._tras_cambio_jugador(uuid, text, text, text);
drop function if exists public._escribir_respuesta(uuid, text, text, text, text, text, uuid, text, uuid);
drop function if exists public._evento_abierto(uuid);
drop function if exists public._inicio_evento(uuid);
drop function if exists public._invitado(text, uuid);
drop function if exists public._respuestas_web_encendido();
drop function if exists public._mi_person_id();

drop policy if exists jugador_lee_las_suyas on public.respuestas;
drop policy if exists jugador_lee_las_suyas on public.ausencias_periodo;

drop table if exists public.alertas_gestores;
drop table if exists public.jornadas_control;
drop table if exists public.respuestas_web_registro;
drop table if exists public.respuestas_web_config;

alter table public.eventos drop column if exists cambio_visible_en;
alter table public.eventos drop column if exists cambio_visible;
alter table public.eventos drop column if exists sin_recordatorios;

-- Lo escrito desde la web no cabe en el modelo anterior.
alter table public.respuestas drop column if exists ausencia_id;
delete from public.respuestas where fuente = 'web';
delete from public.ausencias_periodo where fuente = 'web' or hasta is null;
-- Las importadas de SportEasy que se "borraron" vuelven a estar (antes no se podia borrar).

alter table public.respuestas drop constraint respuestas_fuente_check;
alter table public.respuestas add constraint respuestas_fuente_check check (fuente in ('sporteasy'));
alter table public.respuestas drop constraint respuestas_motivo_check;
alter table public.respuestas add constraint respuestas_motivo_check check (motivo in ('lesion', 'trabajo', 'viaje', 'familia', 'otro'));
alter table public.respuestas drop column if exists cambiado_en;
alter table public.respuestas drop column if exists puesto_por_nombre;
alter table public.respuestas drop column if exists puesto_por;
alter table public.respuestas drop column if exists origen;

alter table public.ausencias_periodo drop constraint ausencias_periodo_fuente_check;
alter table public.ausencias_periodo add constraint ausencias_periodo_fuente_check check (fuente in ('sporteasy'));
alter table public.ausencias_periodo drop column if exists borrada_en;
alter table public.ausencias_periodo drop column if exists cambiado_en;
alter table public.ausencias_periodo drop column if exists creado_en;
alter table public.ausencias_periodo drop column if exists creado_por_nombre;
alter table public.ausencias_periodo drop column if exists creado_por;
alter table public.ausencias_periodo drop column if exists origen;
alter table public.ausencias_periodo drop column if exists detalle;
alter table public.ausencias_periodo alter column hasta set not null;

delete from supabase_migrations.schema_migrations where version = '20261008100000';
