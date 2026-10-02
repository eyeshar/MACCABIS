"use server";

import { revalidatePath } from "next/cache";
import { clienteSesion } from "@/lib/supabase";
import type { DatosPedido, Resultado } from "@/components/FormularioPedido";

// Todas usan la sesion (RPC security definer con auth.uid()): la base de
// datos es quien decide, nunca el servidor web.

export async function guardarPedidoJugador(datos: DatosPedido): Promise<Resultado> {
  const { jugador_id: _ignorado, ...pedido } = datos;
  const supabase = await clienteSesion();
  const { data, error } = await supabase.rpc("guardar_pedido", { p_pedido: pedido });
  if (error) return { ok: false, error: "datos_invalidos" };
  revalidatePath("/mi-zona");
  return data as Resultado;
}

export async function comprobarDorsalJugador(campana: string, dorsal: number, pedido: string | null): Promise<boolean> {
  if (!Number.isInteger(dorsal) || dorsal < 0 || dorsal > 99) return false;
  const supabase = await clienteSesion();
  const { data, error } = await supabase.rpc("dorsal_cogido", { p_campana: campana, p_dorsal: dorsal, p_pedido: pedido });
  return !error && data === true;
}

export async function anularPedidoJugador(pedido: string) {
  const supabase = await clienteSesion();
  await supabase.rpc("anular_pedido", { p_pedido: pedido });
  revalidatePath("/mi-zona");
}
