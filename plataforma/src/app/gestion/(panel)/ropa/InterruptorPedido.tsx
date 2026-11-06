"use client";

import { useActionState } from "react";
import { cambiarPedidoJugadores } from "../acciones";
import type { EstadoPedido } from "@/lib/pedidoRopa";

const ymd = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso)) : "";

/** El interruptor «Abrir el pedido a los jugadores» con UN solo estado real y su causa (bloque 5). Apagado por defecto.
 *  Con el interruptor encendido siempre se puede cerrar, también si ya pasó la fecha límite (fix/g5-rutina-s21-y-repaso:
 *  antes solo salía «Abrir» y la campaña se quedaba «abierta» en la base); en ese caso, además, se puede reabrir con otra fecha. */
export default function InterruptorPedido({ campanaId, estado, fechaLimite }: { campanaId: string; estado: EstadoPedido; fechaLimite: string | null }) {
  const [avisoA, abrir, abriendo] = useActionState(cambiarPedidoJugadores.bind(null, campanaId, true), null);
  const [avisoC, cerrar, cerrando] = useActionState(cambiarPedidoJugadores.bind(null, campanaId, false), null);
  const pendiente = abriendo || cerrando;
  // Al abrir, la fecha límite que ya tenía si sigue vigente; si ya pasó, vacía (sin fecha) para no abrir y cerrar a la vez.
  const fecha = estado.causa === "fecha" ? "" : ymd(fechaLimite);
  const aviso = avisoC ?? avisoA;
  return (
    <div className="rp-interruptor" data-testid="ropa-estado" data-abierto={estado.abierto ? "si" : "no"} data-causa={estado.causa}>
      <p className="rp-estado">
        <span className={`etiqueta ${estado.abierto ? "etiqueta-abierta" : "etiqueta-cerrada"}`}>{estado.texto}</span>
        <span className="suave"> · {estado.detalle}</span>
      </p>
      {!estado.abierto && (
        <form action={abrir} className="rp-form">
          <div className="campo" style={{ margin: 0 }}>
            <label htmlFor={`rp-fecha-${campanaId}`}>Hasta (incluido; vacío = sin fecha)</label>
            <input id={`rp-fecha-${campanaId}`} name="fecha_limite" type="date" defaultValue={fecha} />
          </div>
          <button className="boton boton-amarillo" disabled={pendiente} data-testid="ropa-interruptor">
            {abriendo ? "Guardando…" : estado.causa === "fecha" ? "Abrir el pedido a los jugadores con otra fecha" : "Abrir el pedido a los jugadores"}
          </button>
        </form>
      )}
      {estado.interruptor && (
        <form action={cerrar} className="rp-form">
          <button className="boton boton-claro" disabled={pendiente} data-testid={estado.abierto ? "ropa-interruptor" : "ropa-cerrar"}>
            {cerrando ? "Guardando…" : "Cerrar el pedido a los jugadores"}
          </button>
        </form>
      )}
      {aviso && <p className="ayuda" role="status">{aviso}</p>}
    </div>
  );
}
