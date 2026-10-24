import Link from "next/link";
import { anularPedidoJugador } from "@/app/mi-zona/acciones";
import BotonConfirmar from "@/components/BotonConfirmar";
import { Bolsa, Flecha } from "@/components/Iconos";
import { fechaCorta } from "@/lib/fechas";
import { PRENDAS, type Campana, type Pedido, type PrendaId } from "@/lib/ropa";

function TablaPedido({ pedido }: { pedido: Pedido }) {
  const prendas = PRENDAS.filter((x) => pedido.tallas[x.id as PrendaId]);
  return (
    <div className="tabla-desplazable">
      <table>
        <thead><tr><th>Prenda</th><th>Nombre</th><th>Número</th><th>Talla</th></tr></thead>
        <tbody>
          {prendas.map((x) => (
            <tr key={x.id}>
              <td>{x.nombre}</td>
              <td className={x.llevaNombre ? "" : "suave"}>{x.llevaNombre ? pedido.nombre_ropa : "Sin nombre"}</td>
              <td className={x.llevaDorsal ? "" : "suave"}>{x.llevaDorsal ? pedido.dorsal : "Sin número"}</td>
              <td>{pedido.tallas[x.id]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** El pedido de ropa en el inicio (D116): solo con una campaña abierta (campanaAbiertaAhora) o con un pedido suyo en una
 *  campaña abierta. Con ella, como en la Mi zona de siempre: «Hacer mi pedido» y sus pedidos (modificar o anular). */
export default function RopaInicio({ campana, pedidos }: { campana: (Campana & { abierta_ahora?: boolean }) | null; pedidos: Pedido[] }) {
  const abiertos = pedidos.filter((p) => p.campana_abierta);
  const deEsta = pedidos.filter((x) => x.campana_id === campana?.id);
  return (
    <section className="in-sec in-ropa" id="ropa" aria-labelledby="t-ropa">
      <h2 id="t-ropa">Pedido de ropa</h2>
      {campana?.abierta_ahora && (
        <>
          <Link href="/mi-zona/ropa/nuevo" className="mz-ropa">
            <span className="mz-ropa-icono"><Bolsa size={24} /></span>
            <span style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", gap: 2 }}>
              <strong>Pedido de ropa abierto</strong>
              <span className="pequeno tenue">{campana.fecha_limite ? `Hasta el ${fechaCorta(campana.fecha_limite)}` : "Mientras siga abierto"} · {campana.nombre}</span>
            </span>
            <Flecha />
          </Link>
          <p className="suave" style={{ margin: 0 }}>
            {campana.fecha_limite ? `Puedes pedir o cambiar tus pedidos hasta el ${fechaCorta(campana.fecha_limite)}.` : "Puedes pedir o cambiar tus pedidos mientras siga abierto."}
            {" "}Cada pedido es para una persona: tú o un familiar. Precios orientativos, por confirmar: {PRENDAS.filter((x) => campana.precios[x.id] != null).map((x) => `${x.nombre.toLowerCase()} unos ${campana.precios[x.id]} €`).join(", ")}. No se paga por aquí.
          </p>
          <Link className="boton boton-amarillo boton-bloque" href="/mi-zona/ropa/nuevo">{deEsta.length ? "Hacer otro pedido" : "Hacer mi pedido"}</Link>
        </>
      )}
      {abiertos.length > 0 && <h3 style={{ textTransform: "uppercase", margin: "8px 0 0" }}>Mis pedidos</h3>}
      {abiertos.map((x) => (
        <article key={x.id} style={{ borderTop: "1px solid var(--borde)", paddingTop: 12 }}>
          <h3 style={{ marginBottom: 2 }}>{x.para === "yo" ? "Para mí" : `Para ${x.nombre_completo}`}</h3>
          <p className="pequeno suave" style={{ marginBottom: 6 }}>{x.campana_nombre}{x.para === "yo" ? ` · ${x.nombre_completo}` : " · familiar"}</p>
          <TablaPedido pedido={x} />
          <div className="botones">
            <Link className="boton boton-claro" href={`/mi-zona/ropa/${x.id}`}>Modificar</Link>
            <form action={anularPedidoJugador.bind(null, x.id)}>
              <BotonConfirmar className="boton boton-peligro" pregunta="¿Seguro que quieres anular este pedido?">Anular pedido</BotonConfirmar>
            </form>
          </div>
        </article>
      ))}
    </section>
  );
}
