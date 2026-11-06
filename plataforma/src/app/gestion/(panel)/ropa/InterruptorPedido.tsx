"use client";

import { useActionState } from "react";
import { cambiarPedidoJugadores } from "../acciones";
import type { EstadoPedido } from "@/lib/pedidoRopa";

const ymd = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso)) : "";

/** El interruptor «Abrir el pedido a los jugadores» con UN solo estado real y su causa (bloque 5). Apagado por defecto. */
export default function InterruptorPedido({ campanaId, estado, fechaLimite }: { campanaId: string; estado: EstadoPedido; fechaLimite: string | null }) {
  const abrir = !estado.abierto;
  const [aviso, accion, pendiente] = useActionState(cambiarPedidoJugadores.bind(null, campanaId, abrir), null);
  // Al abrir, la fecha límite que ya tenía si sigue vigente; si ya pasó, vacía (sin fecha) para no abrir y cerrar a la vez.
  const fecha = estado.causa === "fecha" ? "" : ymd(fechaLimite);
  return (
    <div className="rp-interruptor" data-testid="ropa-estado" data-abierto={estado.abierto ? "si" : "no"} data-causa={estado.causa}>
      <p className="rp-estado">
        <span className={`etiqueta ${estado.abierto ? "etiqueta-abierta" : "etiqueta-cerrada"}`}>{estado.texto}</span>
        <span className="suave"> · {estado.detalle}</span>
      </p>
      <form action={accion} className="rp-form">
        {abrir && (
          <div className="campo" style={{ margin: 0 }}>
            <label htmlFor={`rp-fecha-${campanaId}`}>Hasta (incluido; vacío = sin fecha)</label>
            <input id={`rp-fecha-${campanaId}`} name="fecha_limite" type="date" defaultValue={fecha} />
          </div>
        )}
        <button className={`boton ${abrir ? "boton-amarillo" : "boton-claro"}`} disabled={pendiente} data-testid="ropa-interruptor">
          {pendiente ? "Guardando…" : abrir ? "Abrir el pedido a los jugadores" : "Cerrar el pedido a los jugadores"}
        </button>
      </form>
      {aviso && <p className="ayuda" role="status">{aviso}</p>}
    </div>
  );
}
