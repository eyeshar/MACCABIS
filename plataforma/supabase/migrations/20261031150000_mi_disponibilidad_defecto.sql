-- =============================================================================
-- El jugador ve SU «no va (puesto por defecto)» en su zona (D152, completa D146).
--
-- Quien tiene «no suele entrenar» y no ha respondido a un entreno cuenta como «no va (por defecto)». Hasta ahora eso
-- solo lo veian los gestores. Para que el propio jugador lo vea en su zona (y pueda decir «Sí voy»), esta funcion le da
-- a CADA jugador solo lo suyo:
--  - no_suele_entrenar: su marca (ni la otra marca, ni niveles, ni nada mas de jugadores_privado; D39);
--  - quitados: los entrenos en los que un gestor le quito el defecto (sin quien ni cuando).
-- La regla (si cuenta o no) NO va aqui: la aplica la web con respuestaEfectiva (lib/disponibilidad/porDefecto.ts).
-- security definer; la ejecuta solo authenticated. Sin ficha de jugador: marca false y lista vacia.
-- Solo aditiva. Reversion al lado: 20261031150000_mi_disponibilidad_defecto.revertir.sql (db:migrar nunca la aplica).
-- =============================================================================

create function public.mi_disponibilidad_defecto()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'no_suele_entrenar', coalesce((select p.no_suele_entrenar from public.jugadores_privado p where p.person_id = public._mi_person_id()), false),
    'quitados', coalesce((select jsonb_agg(q.evento_id order by q.evento_id) from public.entreno_defecto_quitado q where q.person_id = public._mi_person_id()), '[]'::jsonb)
  )
$$;
comment on function public.mi_disponibilidad_defecto() is 'D152: solo para el propio jugador, su «no suele entrenar» y los entrenos en que se le quito. Sin niveles.';

revoke execute on function public.mi_disponibilidad_defecto() from public, anon, authenticated;
grant execute on function public.mi_disponibilidad_defecto() to authenticated;
