import Link from "next/link";
import { exigirGestor } from "@/lib/gestor";

export const metadata = { title: "Gestión · Maccabis" };

export default async function InicioGestion() {
  const { supabase } = await exigirGestor();
  const [{ count: jugadores }, { data: enlaces }, { data: campanas }] = await Promise.all([
    supabase.from("jugadores").select("id", { count: "exact", head: true }).eq("activo", true),
    supabase.from("enlaces").select("jugador_id, ultimo_uso").is("anulado_en", null),
    supabase.from("campanas_ropa").select("id, nombre, estado").order("creado_en", { ascending: false }).limit(1),
  ]);
  const abiertos = (enlaces ?? []).filter((e) => e.ultimo_uso).length;
  const campana = campanas?.[0];
  const { count: pedidos } = campana
    ? await supabase.from("pedidos_ropa").select("id", { count: "exact", head: true }).eq("campana_id", campana.id)
    : { count: 0 };

  return (
    <>
      <h1>Panel de gestión</h1>
      <div className="rejilla-2">
        <section className="tarjeta">
          <h2>Jugadores y enlaces</h2>
          <p>{jugadores ?? 0} personas activas. {enlaces?.length ?? 0} enlaces vivos; {abiertos} ya se han abierto alguna vez.</p>
          <Link className="boton" href="/gestion/jugadores">Ver jugadores y enlaces</Link>
        </section>
        <section className="tarjeta">
          <h2>Pedido de ropa</h2>
          {campana ? (
            <p>{campana.nombre}: <span className={`etiqueta ${campana.estado === "abierta" ? "etiqueta-abierta" : "etiqueta-cerrada"}`}>{campana.estado === "abierta" ? "Abierta" : "Cerrada"}</span> · {pedidos ?? 0} pedidos.</p>
          ) : <p>No hay ninguna campaña.</p>}
          <Link className="boton" href="/gestion/ropa">Ver pedido de ropa</Link>
        </section>
      </div>
      <section className="tarjeta tarjeta-apagada">
        <h2>Próximamente</h2>
        <p style={{ margin: 0 }}>Calendario único, disponibilidad de la semana, pase de lista y convocatorias (bloque de la jornada 2).</p>
      </section>
    </>
  );
}
