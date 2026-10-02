import "server-only";
import { cache } from "react";
import { clienteSesion, configurado } from "@/lib/supabase";
import type { Campana, Pedido } from "@/lib/ropa";

export type Zona = {
  jugador: { nombre_visible: string; nombre_oficial: string; person_id: string };
  campana: Campana | null;
  pedidos: Pedido[];
};

// null = hay sesion pero esta cuenta no tiene zona de jugador (p. ej. un
// gestor que no es jugador). Sin sesion, la pagina redirige antes de llegar aqui.
// cache(): una sola llamada a mi_zona() aunque generateMetadata y la pagina
// la pidan las dos en la misma peticion.
export const cargarMiZona = cache(async (): Promise<Zona | null> => {
  if (!configurado()) return null;
  const supabase = await clienteSesion();
  const { data, error } = await supabase.rpc("mi_zona");
  if (error) throw new Error(`mi_zona: ${error.message}`);
  return (data as Zona | null) ?? null;
});
