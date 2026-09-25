import { notFound } from "next/navigation";
import { exigirGestor } from "@/lib/gestor";
import FormularioPedido from "@/components/FormularioPedido";
import type { Pedido, Tallas } from "@/lib/ropa";
import { guardarPedidoGestor, comprobarDorsalGestor } from "../../../acciones";

export const metadata = { title: "Editar pedido · Gestión Maccabis" };

export default async function EditarPedidoGestor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await exigirGestor();
  const { data: p } = await supabase.from("pedidos_ropa").select("*, campanas_ropa(nombre, precios)").eq("id", id).maybeSingle();
  if (!p) notFound();
  const { data: jugadores } = await supabase.from("jugadores").select("id, nombre_visible, nombre_oficial").order("nombre_visible");
  const tallas: Tallas = {};
  for (const k of ["camiseta", "pantalon", "cubre", "sudadera"] as const) if (p[`talla_${k}`]) tallas[k] = p[`talla_${k}`];
  const inicial: Pedido = {
    id: p.id, campana_id: p.campana_id, para: p.para, nombre_completo: p.nombre_completo,
    nombre_ropa: p.nombre_ropa, dorsal: p.dorsal, tallas,
  };
  return (
    <>
      <h1>Editar pedido</h1>
      <p className="suave">{p.campanas_ropa?.nombre}</p>
      <FormularioPedido
        modo="gestor"
        campanaId={p.campana_id}
        precios={p.campanas_ropa?.precios ?? {}}
        inicial={inicial}
        nombrePropio=""
        jugadores={(jugadores ?? []).map((j) => ({ id: j.id, nombre: j.nombre_visible, oficial: j.nombre_oficial }))}
        jugadorInicial={p.jugador_id}
        guardar={guardarPedidoGestor}
        comprobarDorsal={comprobarDorsalGestor.bind(null, p.campana_id)}
        volverA={`/gestion/ropa?c=${p.campana_id}`}
      />
    </>
  );
}
