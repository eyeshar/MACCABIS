import Link from "next/link";
import { cargarMiZona } from "../../datos";
import { guardarPedidoJugador, comprobarDorsalJugador } from "../../acciones";
import FormularioPedido from "@/components/FormularioPedido";
import SinZona from "../../SinZona";
import { nombreNatural } from "@/lib/ropa";

export const dynamic = "force-dynamic";
export const metadata = { title: "Modificar pedido · Maccabis" };

export default async function ModificarPedido({ params }: { params: Promise<{ pedido: string }> }) {
  const { pedido: pedidoId } = await params;
  const zona = await cargarMiZona();
  if (!zona) return <SinZona />;
  const volver = "/mi-zona";
  // Solo se encuentra entre SUS pedidos: la base de datos no le devuelve los de otros.
  const pedido = zona.pedidos.find((x) => x.id === pedidoId);

  return (
    <>
      <div className="cabecera">
        <div className="dentro">
          <div className="marca"><Link href={volver}>Maccabis · {zona.jugador.nombre_visible}</Link></div>
          <h1>Modificar pedido</h1>
        </div>
      </div>
      <main className="pagina">
        {!pedido ? (
          <section className="tarjeta">
            <p>No encontramos ese pedido entre los tuyos.</p>
            <Link className="boton" href={volver}>Volver a mi zona</Link>
          </section>
        ) : !pedido.campana_abierta ? (
          <section className="tarjeta">
            <p>El pedido de ropa está cerrado: este pedido ya no se puede cambiar.</p>
            <Link className="boton" href={volver}>Volver a mi zona</Link>
          </section>
        ) : (
          <FormularioPedido
            modo="jugador"
            campanaId={pedido.campana_id}
            precios={zona.campana?.id === pedido.campana_id ? zona.campana.precios : {}}
            inicial={pedido}
            nombrePropio={nombreNatural(zona.jugador.nombre_oficial)}
            guardar={guardarPedidoJugador}
            comprobarDorsal={comprobarDorsalJugador.bind(null, pedido.campana_id)}
            volverA={volver}
          />
        )}
      </main>
    </>
  );
}
