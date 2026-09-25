import Link from "next/link";
import { exigirGestor } from "@/lib/gestor";
import { PRENDAS, TALLAS, type PrendaId } from "@/lib/ropa";
import { fechaHora } from "@/lib/fechas";
import BotonConfirmar from "@/components/BotonConfirmar";
import { borrarPedidoGestor, crearCampana } from "../acciones";
import FormularioCampana from "./FormularioCampana";

export const metadata = { title: "Pedido de ropa · Gestión Maccabis" };

type FilaPedido = {
  id: string;
  para: "yo" | "familiar";
  nombre_completo: string;
  nombre_ropa: string | null;
  dorsal: number | null;
  talla_camiseta: string | null;
  talla_pantalon: string | null;
  talla_cubre: string | null;
  talla_sudadera: string | null;
  creado_por_gestor: boolean;
  actualizado_en: string;
  jugadores: { nombre_visible: string } | null;
};

export default async function RopaGestion({ searchParams }: { searchParams: Promise<{ c?: string; guardado?: string }> }) {
  const { c, guardado } = await searchParams;
  const { supabase } = await exigirGestor();
  const { data: campanas } = await supabase.from("campanas_ropa").select("*").order("creado_en", { ascending: false });
  const campana = (campanas ?? []).find((x) => x.id === c) ?? campanas?.[0];

  if (!campana) {
    return (
      <>
        <h1>Pedido de ropa</h1>
        <section className="tarjeta">
          <p>No hay ninguna campaña.</p>
          <form action={crearCampana} className="botones">
            <input type="text" name="nombre" defaultValue="Ropa 2026/27" aria-label="Nombre de la campaña" />
            <button className="boton">Crear campaña</button>
          </form>
        </section>
      </>
    );
  }

  const [{ data: pedidosRaw }, { data: repetidos }] = await Promise.all([
    supabase.from("pedidos_ropa").select("*, jugadores(nombre_visible)").eq("campana_id", campana.id).order("creado_en"),
    supabase.from("v_dorsales_repetidos").select("dorsal, nombres").eq("campana_id", campana.id).order("dorsal"),
  ]);
  const pedidos = (pedidosRaw ?? []) as FilaPedido[];

  // Recuento por prenda y talla.
  const recuento: Record<PrendaId, Record<string, number>> = { camiseta: {}, pantalon: {}, cubre: {}, sudadera: {} };
  for (const p of pedidos) {
    for (const x of PRENDAS) {
      const t = p[`talla_${x.id}` as keyof FilaPedido] as string | null;
      if (t) recuento[x.id][t] = (recuento[x.id][t] ?? 0) + 1;
    }
  }
  const tallasUsadas = TALLAS.filter((t) => PRENDAS.some((x) => recuento[x.id][t]));
  const abiertaAhora = campana.estado === "abierta" && (!campana.fecha_limite || new Date(campana.fecha_limite) >= new Date());

  return (
    <>
      <h1>Pedido de ropa</h1>
      {guardado && <div className="aviso aviso-ok" role="status">Pedido guardado.</div>}

      {(campanas?.length ?? 0) > 1 && (
        <nav className="botones" aria-label="Campañas">
          {campanas!.map((x) => (
            <Link key={x.id} className={`boton ${x.id === campana.id ? "" : "boton-claro"}`} href={`/gestion/ropa?c=${x.id}`}>{x.nombre}</Link>
          ))}
        </nav>
      )}

      <section className="tarjeta">
        <h2>{campana.nombre}</h2>
        <p>
          {abiertaAhora ? <span className="etiqueta etiqueta-abierta">Abierta: los jugadores pueden pedir</span> : <span className="etiqueta etiqueta-cerrada">Cerrada: los jugadores no pueden pedir ni cambiar</span>}
          {campana.estado === "abierta" && !abiertaAhora && <span className="suave"> (ha pasado la fecha límite)</span>}
        </p>
        <FormularioCampana campana={campana} />
        <div className="botones">
          <a className="boton boton-amarillo" href={`/gestion/ropa/excel?c=${campana.id}`}>Descargar Excel para VIVE</a>
          <Link className="boton" href={`/gestion/ropa/nuevo?c=${campana.id}`}>Añadir pedido a mano</Link>
        </div>
      </section>

      <section className="tarjeta">
        <h2>Dorsales repetidos</h2>
        {!repetidos?.length ? (
          <p className="suave" style={{ margin: 0 }}>Ningún dorsal repetido.</p>
        ) : (
          <div className="aviso aviso-error" style={{ margin: 0 }}>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {repetidos.map((r) => <li key={r.dorsal}><strong>{r.dorsal}</strong>: {(r.nombres as string[]).join(", ")}</li>)}
            </ul>
          </div>
        )}
      </section>

      <section className="tarjeta">
        <h2>Recuento por prenda y talla</h2>
        {!tallasUsadas.length ? <p className="suave" style={{ margin: 0 }}>Aún no hay pedidos.</p> : (
          <div className="tabla-desplazable">
            <table>
              <thead>
                <tr><th>Prenda</th>{tallasUsadas.map((t) => <th key={t}>{t}</th>)}<th>Total</th></tr>
              </thead>
              <tbody>
                {PRENDAS.map((x) => (
                  <tr key={x.id}>
                    <td>{x.nombre}</td>
                    {tallasUsadas.map((t) => <td key={t}>{recuento[x.id][t] ?? ""}</td>)}
                    <td><strong>{Object.values(recuento[x.id]).reduce((a, b) => a + b, 0)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="tarjeta">
        <h2>Pedidos ({pedidos.length})</h2>
        {!pedidos.length && <p className="suave" style={{ margin: 0 }}>Todavía no hay pedidos.</p>}
        <ul className="lista-limpia">
          {pedidos.map((p) => (
            <li key={p.id} className="fila-jugador" data-pedido={p.id}>
              <h3 style={{ marginBottom: 2 }}>{p.nombre_completo}</h3>
              <p className="pequeno suave" style={{ marginBottom: 6 }}>
                Lo pidió {p.jugadores?.nombre_visible ?? "?"}{p.para === "familiar" ? " para un familiar" : ""}
                {p.creado_por_gestor ? " (añadido por un gestor)" : ""} · {fechaHora(p.actualizado_en)}
              </p>
              <p style={{ marginBottom: 6 }}>
                {p.nombre_ropa && <><strong>{p.nombre_ropa}</strong> · </>}
                {p.dorsal != null && <>dorsal <strong>{p.dorsal}</strong> · </>}
                {PRENDAS.filter((x) => p[`talla_${x.id}` as keyof FilaPedido]).map((x) => `${x.nombre} ${p[`talla_${x.id}` as keyof FilaPedido]}`).join(" · ")}
              </p>
              <div className="botones" style={{ marginTop: 0 }}>
                <Link className="boton boton-claro" href={`/gestion/ropa/pedido/${p.id}`}>Editar</Link>
                <form action={borrarPedidoGestor.bind(null, p.id)}>
                  <BotonConfirmar className="boton boton-peligro" pregunta={`¿Borrar el pedido de ${p.nombre_completo}?`}>Borrar</BotonConfirmar>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <details className="tarjeta">
        <summary>Crear otra campaña</summary>
        <form action={crearCampana} className="botones">
          <input type="text" name="nombre" placeholder="Nombre de la campaña" aria-label="Nombre de la campaña" />
          <button className="boton">Crear campaña</button>
        </form>
      </details>
    </>
  );
}
