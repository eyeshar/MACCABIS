import type { Metadata } from "next";
import Link from "next/link";
import { cargarZona } from "./datos";
import { anularPedidoJugador } from "./acciones";
import { PRENDAS, type PrendaId, type Pedido } from "@/lib/ropa";
import BotonConfirmar from "@/components/BotonConfirmar";
import { fechaCorta } from "@/lib/fechas";
import { fichaEstadisticas } from "@/lib/mensajes";
import EnlaceNoValido from "./EnlaceNoValido";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const zona = await cargarZona(token);
  return {
    title: zona ? `${zona.jugador.nombre_visible} · Maccabis` : "Maccabis",
    manifest: zona ? `/j/${token}/manifest.webmanifest` : undefined,
    appleWebApp: { capable: true, title: "Maccabis", statusBarStyle: "black-translucent" },
  };
}

function TablaPedido({ pedido }: { pedido: Pedido }) {
  const prendas = PRENDAS.filter((x) => pedido.tallas[x.id as PrendaId]);
  return (
    <div className="tabla-desplazable">
      <table>
        <thead>
          <tr><th>Prenda</th><th>Nombre</th><th>Número</th><th>Talla</th></tr>
        </thead>
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

export default async function ZonaJugador({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ guardado?: string }>;
}) {
  const { token } = await params;
  const { guardado } = await searchParams;
  const zona = await cargarZona(token);
  if (!zona) return <EnlaceNoValido />;

  const { jugador, campana, pedidos } = zona;
  const deEstaCampana = pedidos.filter((x) => x.campana_id === campana?.id);
  const anteriores = pedidos.filter((x) => x.campana_id !== campana?.id);

  return (
    <>
      <header className="cabecera">
        <div className="dentro">
          <div className="marca">Maccabis · tu zona</div>
          <h1>Hola, {jugador.nombre_visible}</h1>
        </div>
      </header>
      <main className="pagina">
        {guardado && <div className="aviso aviso-ok" role="status">Pedido guardado. Puedes cambiarlo mientras el pedido siga abierto.</div>}

        {/* 1. Pedido de ropa activo */}
        <section className="tarjeta" aria-labelledby="t-ropa">
          <h2 id="t-ropa">Pedido de ropa</h2>
          {!campana ? (
            <p className="suave">Ahora mismo no hay ningún pedido de ropa.</p>
          ) : (
            <>
              <p style={{ marginBottom: 6 }}>
                <strong>{campana.nombre}</strong> · {campana.proveedor}{" "}
                {campana.abierta_ahora
                  ? <span className="etiqueta etiqueta-abierta">Abierto</span>
                  : <span className="etiqueta etiqueta-cerrada">Cerrado</span>}
              </p>
              {campana.abierta_ahora ? (
                <>
                  <p className="suave">
                    {campana.fecha_limite ? `Puedes pedir o cambiar tus pedidos hasta el ${fechaCorta(campana.fecha_limite)}.` : "Puedes pedir o cambiar tus pedidos mientras siga abierto."}
                    {" "}Cada pedido es para una persona: tú o un familiar.
                  </p>
                  <p className="pequeno suave">
                    Precios orientativos, por confirmar: {PRENDAS.filter((x) => campana.precios[x.id] != null).map((x) => `${x.nombre.toLowerCase()} unos ${campana.precios[x.id]} €`).join(", ")}. No se paga por aquí.
                  </p>
                  <Link className="boton boton-amarillo boton-bloque" href={`/j/${token}/ropa/nuevo`}>
                    {deEstaCampana.length ? "Hacer otro pedido" : "Hacer mi pedido"}
                  </Link>
                </>
              ) : (
                <p className="suave">
                  {campana.estado === "abierta" && campana.fecha_limite
                    ? `El plazo terminó el ${fechaCorta(campana.fecha_limite)}.`
                    : "El pedido está cerrado."}{" "}
                  {deEstaCampana.length ? "Tus pedidos ya no se pueden cambiar." : "No hiciste ningún pedido."}
                </p>
              )}
            </>
          )}
        </section>

        {/* 2. Mis pedidos */}
        <section className="tarjeta" aria-labelledby="t-pedidos">
          <h2 id="t-pedidos">Mis pedidos</h2>
          {pedidos.length === 0 && <p className="suave">Aún no has hecho ningún pedido.</p>}
          {[...deEstaCampana, ...anteriores].map((x) => (
            <article key={x.id} style={{ borderTop: "1px solid var(--borde)", paddingTop: 12, marginTop: 12 }}>
              <h3 style={{ marginBottom: 2 }}>{x.para === "yo" ? "Para mí" : `Para ${x.nombre_completo}`}</h3>
              <p className="pequeno suave" style={{ marginBottom: 6 }}>
                {x.campana_nombre}{x.para === "yo" ? ` · ${x.nombre_completo}` : " · familiar"}
              </p>
              <TablaPedido pedido={x} />
              {x.campana_abierta && (
                <div className="botones">
                  <Link className="boton boton-claro" href={`/j/${token}/ropa/${x.id}`}>Modificar</Link>
                  <form action={anularPedidoJugador.bind(null, token, x.id)}>
                    <BotonConfirmar className="boton boton-peligro" pregunta="¿Seguro que quieres anular este pedido?">Anular pedido</BotonConfirmar>
                  </form>
                </div>
              )}
            </article>
          ))}
        </section>

        {/* 3. Mis estadisticas */}
        <section className="tarjeta" aria-labelledby="t-stats">
          <h2 id="t-stats">Mis estadísticas</h2>
          <p>Tu ficha en la web de estadísticas del club. Ahí también puedes ver las de los demás.</p>
          <a className="boton boton-claro boton-bloque" href={fichaEstadisticas(jugador.person_id)} target="_blank" rel="noopener noreferrer">
            Ver mi ficha
          </a>
        </section>

        {/* 4. Proximamente */}
        <section className="tarjeta tarjeta-apagada" aria-labelledby="t-semana">
          <h2 id="t-semana">Mi semana</h2>
          <p style={{ margin: 0 }}>Próximamente: aquí dirás si puedes ir a cada partido y entreno.</p>
        </section>
        <section className="tarjeta tarjeta-apagada" aria-labelledby="t-partidos">
          <h2 id="t-partidos">Próximos partidos</h2>
          <p style={{ margin: 0 }}>Próximamente: calendario y convocatorias.</p>
        </section>

        <p className="pie">
          Este enlace es solo tuyo: no lo reenvíes. Guárdalo en la pantalla de inicio del móvil.
          <br />¿Algo no cuadra? Habla con Iván, Carlos o Edu.
        </p>
      </main>
    </>
  );
}

