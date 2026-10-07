import Link from "next/link";
import { cargarMiZona } from "../../datos";
import { guardarPedidoJugador, comprobarDorsalJugador } from "../../acciones";
import FormularioPedido from "@/components/FormularioPedido";
import SinZona from "../../SinZona";
import { nombreNatural } from "@/lib/ropa";
import { fechaCorta } from "@/lib/fechas";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pedido de ropa · Maccabis" };

export default async function NuevoPedido() {
  const zona = await cargarMiZona();
  if (!zona) return <SinZona />;
  const { campana, jugador } = zona;
  const volver = "/mi-zona";

  return (
    <>
      <div className="cabecera">
        <div className="dentro">
          <div className="marca"><Link href={volver}>Maccabis · {jugador.nombre_visible}</Link></div>
          <h1>Pedido de ropa</h1>
        </div>
      </div>
      <main className="pagina">
        {!campana || !campana.abierta_ahora ? (
          <section className="tarjeta">
            <p>El pedido de ropa está cerrado: ya no se pueden hacer pedidos.</p>
            <Link className="boton" href={volver}>Volver a mi zona</Link>
          </section>
        ) : (
          <>
            <p className="suave">
              {campana.nombre}{campana.fecha_limite ? `, abierto hasta el ${fechaCorta(campana.fecha_limite)}` : ""}.
              {" "}Un pedido es para una persona: su nombre y su dorsal valen para todas las prendas del pedido.
            </p>
            <FormularioPedido
              modo="jugador"
              campanaId={campana.id}
              precios={campana.precios}
              inicial={null}
              nombrePropio={nombreNatural(jugador.nombre_oficial)}
              guardar={guardarPedidoJugador}
              comprobarDorsal={comprobarDorsalJugador.bind(null, campana.id)}
              volverA={volver}
            />
          </>
        )}
      </main>
    </>
  );
}
