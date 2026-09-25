import "server-only";
import { cache } from "react";
import { clienteAnonimo, configurado } from "@/lib/supabase";
import type { Campana, Pedido } from "@/lib/ropa";

export type Zona = {
  jugador: { nombre_visible: string; nombre_oficial: string; person_id: string };
  campana: Campana | null;
  pedidos: Pedido[];
};

// Formato del token: 64 caracteres hexadecimales. Cualquier otra cosa ni se consulta.
export const tokenConForma = (t: string) => /^[0-9a-f]{64}$/.test(t);

// null = enlace no valido (inventado, anulado o de alguien dado de baja).
export const cargarZona = cache(async (token: string): Promise<Zona | null> => {
  if (!configurado() || !tokenConForma(token)) return null;
  const { data, error } = await clienteAnonimo().rpc("zona_jugador", { p_token: token });
  if (error) throw new Error(`zona_jugador: ${error.message}`);
  return (data as Zona | null) ?? null;
});
