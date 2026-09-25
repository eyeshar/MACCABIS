import { exigirGestor } from "@/lib/gestor";
import FormularioPedido from "@/components/FormularioPedido";
import { guardarPedidoGestor, comprobarDorsalGestor } from "../../acciones";

export const metadata = { title: "Añadir pedido · Gestión Maccabis" };

export default async function NuevoPedidoGestor({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const { supabase } = await exigirGestor();
  const { data: campanas } = await supabase.from("campanas_ropa").select("id, nombre, precios").order("creado_en", { ascending: false });
  const campana = (campanas ?? []).find((x) => x.id === c) ?? campanas?.[0];
  const { data: jugadores } = await supabase.from("jugadores").select("id, nombre_visible, nombre_oficial").eq("activo", true).order("nombre_visible");
  if (!campana) return <p>No hay ninguna campaña.</p>;
  return (
    <>
      <h1>Añadir pedido a mano</h1>
      <p className="suave">{campana.nombre}. Como gestor puedes guardar aunque la campaña esté cerrada o el dorsal esté repetido.</p>
      <FormularioPedido
        modo="gestor"
        campanaId={campana.id}
        precios={campana.precios ?? {}}
        inicial={null}
        nombrePropio=""
        jugadores={(jugadores ?? []).map((j) => ({ id: j.id, nombre: j.nombre_visible, oficial: j.nombre_oficial }))}
        guardar={guardarPedidoGestor}
        comprobarDorsal={comprobarDorsalGestor.bind(null, campana.id)}
        volverA={`/gestion/ropa?c=${campana.id}`}
      />
    </>
  );
}
