import "server-only";
import { cargarEventos, cargarPistas, type Cliente } from "@/lib/eventos/datos";
import { pistaEfectiva, type EventoFila, type Pista, type PistaEfectiva } from "@/lib/eventos/dominio";

// Proximo entreno para Gestion (Panel y «Pendiente esta semana»), leido de la TABLA de eventos con la sesion del gestor
// y con su pista efectiva (pistaEfectiva: pista propia, ubicacion libre de D119 o la de la serie). No del fichero de
// entrenos ni de v_eventos_publicos: la vista no conoce la ubicacion libre y daba «pista por confirmar» (entreno del
// 28/10/2026 en Ciudad de los Periodistas).
export type EntrenoGestion = { evento: EventoFila; pista: PistaEfectiva; serie: Pista | null };

export async function proximoEntreno(supabase: Cliente, hoy: string): Promise<EntrenoGestion | null> {
  const [eventos, pistas] = await Promise.all([cargarEventos(supabase), cargarPistas(supabase)]);
  const evento = eventos.find((e) => e.tipo === "entreno" && e.estado === "programado" && e.fecha >= hoy);
  const serie = pistas.find((p) => p.es_de_serie && p.uso === "entreno") ?? null;
  return evento ? { evento, pista: pistaEfectiva(evento, pistas), serie } : null;
}
