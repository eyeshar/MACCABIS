-- =============================================================================
-- Mi zona: a que equipos pertenece el jugador (avisos de equipacion, D79).
-- Unico cambio respecto a la version anterior de mi_zona(): el objeto 'jugador' lleva tambien ficha_mda y ficha_mdl,
-- para ensenar solo el proximo partido de SU equipo. Es el propio dato del jugador (su ficha), no de terceros.
-- `create or replace`: los permisos (execute para authenticated) se conservan.
-- =============================================================================

create or replace function public.mi_zona()
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_jugador uuid := public._mi_jugador();
  v_campana uuid;
  v_out jsonb;
begin
  if v_jugador is null then
    return null;
  end if;

  v_campana := public._campana_actual();

  select jsonb_build_object(
    'jugador', jsonb_build_object('nombre_visible', j.nombre_visible, 'nombre_oficial', j.nombre_oficial, 'person_id', j.person_id, 'ficha_mda', j.ficha_mda, 'ficha_mdl', j.ficha_mdl),
    'campana', (
      select jsonb_build_object(
        'id', c.id, 'nombre', c.nombre, 'proveedor', c.proveedor, 'estado', c.estado,
        'fecha_limite', c.fecha_limite, 'precios', c.precios, 'guia_tallas_url', c.guia_tallas_url,
        'abierta_ahora', public._campana_abierta(c.id))
      from public.campanas_ropa c where c.id = v_campana),
    'pedidos', coalesce((
      select jsonb_agg(public._pedido_json(p) || jsonb_build_object('campana_nombre', c.nombre, 'campana_abierta', public._campana_abierta(c.id))
                       order by c.creado_en desc, p.creado_en)
      from public.pedidos_ropa p join public.campanas_ropa c on c.id = p.campana_id
      where p.jugador_id = v_jugador), '[]'::jsonb)
  ) into v_out
  from public.jugadores j where j.id = v_jugador;

  return v_out;
end $$;
