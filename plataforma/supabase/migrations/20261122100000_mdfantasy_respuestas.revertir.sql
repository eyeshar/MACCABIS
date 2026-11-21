-- Deshace 20261122100000_mdfantasy_respuestas.sql (D196): quita las dos funciones de respuestas y el aviso, y devuelve
-- _fantasy_param a como la dejó 20261121100000 (sin «mitadSinRespuesta»). Si el interruptor estaba guardado en
-- fantasy_config.parametros, lo quita. No toca nada más.
drop function if exists public.fantasy_sin_responder();
drop function if exists public.fantasy_respuestas_domingo();
drop function if exists public._fantasy_respuestas(date);
update public.fantasy_config set parametros = parametros - 'mitadSinRespuesta' where parametros ? 'mitadSinRespuesta';

create or replace function public._fantasy_param(p_clave text)
returns numeric language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select nullif(c.parametros ->> p_clave, '')::numeric from public.fantasy_config c where c.id = 1),
    case p_clave
      when 'puntoPorPunto' then 1 when 'masMenosDivisor' then 2 when 'masMenosTope' then 5 when 'bonusDoblete' then 3
      when 'respuestaRapida' then 2 when 'respuestaATiempo' then 1 when 'sinRespuesta' then -2 when 'horasRapida' then 24
      when 'entrenoAsistido' then 2 when 'planton' then -5 when 'topeCompromiso' then 6
      when 'plantilla' then 7 when 'alineados' then 5 when 'porraAcierto' then 3
      when 'valorMinimo' then 4 when 'jornadasValor' then 4 when 'clausula' then 1.5 when 'margenCopias' then 0.15
      when 'margenInicio' then 0.1 when 'cajaInicial' then 11 when 'ingresoFijo' then 1.5 when 'ingresoPorPunto' then 0.04
    end)
$$;

notify pgrst, 'reload schema';
delete from supabase_migrations.schema_migrations where version = '20261122100000';
