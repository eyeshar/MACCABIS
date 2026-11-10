"use server";

import { revalidatePath } from "next/cache";
import { exigirGestor } from "@/lib/sesion";
import type { EstadoPase } from "@/lib/eventos/paseDeLista";

// Pase de lista (D192): guarda con la sesion del gestor; la base (pase_de_lista, is_gestor) decide.
export type RPase = { ok: true; n: number } | { ok: false; error: string };

const ERR: Record<string, string> = {
  solo_gestores: "Solo los gestores.", evento_sin_pase: "Este evento no lleva pase de lista (solo entrenos y partidos de liga programados).",
  evento_sin_terminar: "El pase de lista se abre al terminar el evento.", evento_de_sporteasy: "Ese día ya está en la asistencia de SportEasy: no se pasa lista otra vez.",
  no_invitado: "Hay alguien que no está invitado a este evento.", estado_no_valido: "Hay un estado que no vale para este evento.",
};

export async function guardarPaseDeLista(eventoId: string, filas: { person_id: string; estado: EstadoPase | null; motivo: string | null }[]): Promise<RPase> {
  const { supabase } = await exigirGestor();
  const { data, error } = await supabase.rpc("pase_de_lista", { p_evento: eventoId, p_filas: filas });
  if (error) return { ok: false, error: ERR[Object.keys(ERR).find((k) => error.message.includes(k)) ?? ""] ?? `No se pudo guardar: ${error.message}` };
  revalidatePath(`/evento/${eventoId}`);
  revalidatePath("/gestion/asistencia", "layout");
  return { ok: true, n: Number(data ?? 0) };
}
