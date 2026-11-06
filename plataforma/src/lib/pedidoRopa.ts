// Estado del pedido de ropa (bloque 5 de la estructura nueva): UN solo estado real con su causa, para Gestión y para lo que
// ven los jugadores. Sin columnas ni tablas nuevas: el interruptor «Abrir el pedido a los jugadores» es `campanas_ropa.estado`
// («abierta» / «cerrada»; una campaña nueva nace «cerrada») y la fecha límite, `fecha_limite` (incluida, día de Madrid).
// La base aplica la misma regla (`_campana_abierta`: mi_zona, guardar_pedido, anular_pedido). Funciones PURAS.
import { campanaAbiertaAhora, fechaCorta } from "./fechas.ts";

export type CampanaEstado = { estado: string; fecha_limite: string | null | undefined };

export type EstadoPedido = {
  /** Lo que de verdad pasa: los jugadores lo ven y pueden pedir. */
  abierto: boolean;
  /** Por qué: «interruptor» (apagado), «fecha» (encendido pero pasó la fecha límite) o «abierto». */
  causa: "interruptor" | "fecha" | "abierto";
  /** El interruptor tal como está guardado. */
  interruptor: boolean;
  /** «Abierto a los jugadores» / «Cerrado a los jugadores». */
  texto: string;
  /** La causa en una línea: «hasta el 31 de diciembre», «sin fecha límite», «interruptor apagado», «pasó la fecha límite (23 de octubre)». */
  detalle: string;
};

export function estadoPedido(c: CampanaEstado, ahora: Date = new Date()): EstadoPedido {
  const interruptor = c.estado === "abierta";
  if (!interruptor) return { abierto: false, causa: "interruptor", interruptor, texto: "Cerrado a los jugadores", detalle: "interruptor apagado" };
  if (!campanaAbiertaAhora(c, ahora)) return { abierto: false, causa: "fecha", interruptor, texto: "Cerrado a los jugadores", detalle: `pasó la fecha límite (${fechaCorta(c.fecha_limite)})` };
  return { abierto: true, causa: "abierto", interruptor, texto: "Abierto a los jugadores", detalle: c.fecha_limite ? `hasta el ${fechaCorta(c.fecha_limite)}` : "sin fecha límite" };
}

/** ¿Ven los jugadores el pedido de ropa (tarjeta en su Semana, formulario)? Solo con el interruptor encendido y la fecha
 *  límite sin pasar. Sin campaña, no. La usa la Semana del jugador para pintar (o no) la tarjeta del pedido. */
export function pedidoVisibleParaJugadores(c: CampanaEstado | null | undefined, ahora: Date = new Date()): boolean {
  return !!c && estadoPedido(c, ahora).abierto;
}
