-- D200: desde el fin de SportEasy (D172) nadie crea respuestas en nombre de un jugador. El importador («Importar ›
-- Respuestas») ya no existe; esto impide que vuelva a pasar: una fila NUEVA de respuestas con origen 'sporteasy', o una
-- que pasa a 'sporteasy', se rechaza. Las que ya hay (histórico: los partidos jugados y el 29/11/2026) se quedan como
-- están y se pueden seguir cambiando (al responder en la web pasan a 'jugador') o borrando. Solo aditiva: una función y
-- un disparador; no cambia ninguna fila.
create function public._sin_respuestas_importadas()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.origen = 'sporteasy' and (tg_op = 'INSERT' or old.origen is distinct from 'sporteasy') then
    raise exception 'respuesta_importada_no_permitida' using errcode = 'P0001',
      hint = 'D200: las respuestas las da el jugador en la web (o un gestor por él); ya no se importan de SportEasy.';
  end if;
  return new;
end $$;
comment on function public._sin_respuestas_importadas() is 'D200: rechaza respuestas nuevas con origen sporteasy (nadie responde en nombre de un jugador desde el fin de SportEasy).';
revoke execute on function public._sin_respuestas_importadas() from public, anon, authenticated;

create trigger respuestas_sin_importadas before insert or update of origen on public.respuestas
  for each row execute function public._sin_respuestas_importadas();
