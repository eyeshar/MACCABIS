import "server-only";
import type { clienteSesion } from "@/lib/supabase";

type Cliente = Awaited<ReturnType<typeof clienteSesion>>;
export type ResumenConvocatoria = { fecha: string; estado: "aprobada" | "borrador"; equipos: Record<string, unknown[]> };

/** Estado de la convocatoria de cada domingo y sus convocados por equipo (D107), para la franja GESTIÓN de la Semana y la
 *  pestaña «Convocatoria» del evento (D189). Solo gestores: la tabla tiene RLS de gestores; a un jugador le da vacío. Sin
 *  propuesta (origen null) no cuenta. */
export async function resumenConvocatorias(sb: Cliente, fechas: string[]): Promise<ResumenConvocatoria[]> {
  if (!fechas.length) return [];
  const { data } = await sb.from("convocatorias").select("fecha, estado, origen, equipos").in("fecha", fechas);
  return ((data ?? []) as { fecha: string; estado: string; origen: string | null; equipos: Record<string, unknown[]> }[])
    .filter((c) => c.origen)
    .map((c) => ({ fecha: c.fecha, estado: c.estado === "aprobada" ? "aprobada" : "borrador", equipos: c.equipos ?? {} }));
}

/** Los convocados de un equipo en la convocatoria APROBADA de ese domingo, o null si no está aprobada (pase de lista del
 *  partido, D192: quien no está sale «no convocado» por defecto). Solo gestores (RLS). */
export async function convocadosAprobados(sb: Cliente, fecha: string, equipo: string): Promise<Set<string> | null> {
  const { data } = await sb.from("convocatorias").select("equipos").eq("fecha", fecha).eq("estado", "aprobada").maybeSingle();
  const equipos = (data as { equipos?: Record<string, { person_id: string }[]> } | null)?.equipos;
  return equipos ? new Set((equipos[equipo] ?? []).map((c) => c.person_id)) : null;
}
