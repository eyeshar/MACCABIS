"use server";

import { revalidatePath } from "next/cache";
import { exigirGestor } from "@/lib/sesion";
import { repuntuarTrasAsistencia } from "@/lib/fantasy/servidor";
import { cargarEvento } from "@/lib/eventos/datos";
import { filasAsistencia, filasParaGuardar } from "@/lib/fantasy/asistencia";

// «¿Falto alguien ayer?» (D196, fase 4): guarda con pase_de_lista (D192), con la sesion del gestor. Vale la primera
// respuesta: si otro gestor ya respondio mientras tanto, no se pisa salvo que se venga a corregir.
export type RAsistencia = { ok: true; fueron: number; faltaron: number } | { ok: false; error: string };

const ERR: Record<string, string> = {
  solo_gestores: "Solo los gestores.", evento_sin_pase: "Este evento no lleva asistencia.", evento_sin_terminar: "Todavía no ha terminado.",
  evento_de_sporteasy: "Ese día ya está en la asistencia de SportEasy.", no_invitado: "Hay alguien que no está invitado.", estado_no_valido: "Hay un estado que no vale.",
};

export async function guardarAsistenciaReal(eventoId: string, ausentes: string[], sinAvisar: string[], corregir: boolean): Promise<RAsistencia> {
  const { supabase } = await exigirGestor();
  const ev = await cargarEvento(supabase, eventoId);
  if (!ev) return { ok: false, error: "Ese evento no existe." };
  const { filas, respondida } = await filasAsistencia(supabase, ev);
  if (respondida && !corregir) return { ok: false, error: `Ya lo ha respondido ${respondida.por ?? "otro gestor"}. Recarga la página si quieres corregirlo.` };
  const guardar = filasParaGuardar(filas, ausentes, sinAvisar);
  const { error } = await supabase.rpc("pase_de_lista", { p_evento: eventoId, p_filas: guardar });
  if (error) return { ok: false, error: ERR[Object.keys(ERR).find((k) => error.message.includes(k)) ?? ""] ?? `No se pudo guardar: ${error.message}` };
  revalidatePath(`/evento/${eventoId}`, "layout");
  revalidatePath("/gestion/asistencia", "layout");
  // D196: corregir un «no vino» de una jornada ya puntuada recalcula los puntos al momento
  if ((await repuntuarTrasAsistencia())?.length) revalidatePath("/mdfantasy", "layout");
  return { ok: true, fueron: guardar.filter((f) => f.estado === "a_tiempo").length, faltaron: guardar.filter((f) => f.estado === "sin_excusa" && ausentes.includes(f.person_id)).length };
}
