"use server";

import { revalidatePath } from "next/cache";
import { clienteAnonimo } from "@/lib/supabase";
import type { DatosPedido, Resultado } from "@/components/FormularioPedido";
import { tokenConForma } from "./datos";

// Todas reciben el token y lo mandan a la base de datos, que es quien decide
// (funciones security definer): el servidor web no puede saltarse esa comprobacion.

export async function guardarPedidoJugador(token: string, datos: DatosPedido): Promise<Resultado> {
  if (!tokenConForma(token)) return { ok: false, error: "enlace_invalido" };
  const { jugador_id: _ignorado, ...pedido } = datos;
  const { data, error } = await clienteAnonimo().rpc("guardar_pedido", { p_token: token, p_pedido: pedido });
  if (error) return { ok: false, error: "datos_invalidos" };
  revalidatePath(`/j/${token}`);
  return data as Resultado;
}

export async function comprobarDorsalJugador(token: string, campana: string, dorsal: number, pedido: string | null): Promise<boolean> {
  if (!tokenConForma(token) || !Number.isInteger(dorsal) || dorsal < 0 || dorsal > 99) return false;
  const { data, error } = await clienteAnonimo().rpc("dorsal_cogido", { p_token: token, p_campana: campana, p_dorsal: dorsal, p_pedido: pedido });
  return !error && data === true;
}

export async function anularPedidoJugador(token: string, pedido: string) {
  if (!tokenConForma(token)) return;
  await clienteAnonimo().rpc("anular_pedido", { p_token: token, p_pedido: pedido });
  revalidatePath(`/j/${token}`);
}
