"use server";

import { revalidatePath } from "next/cache";
import { exigirGestor } from "@/lib/sesion";
import { textoError } from "@/lib/respuestas/dominio";
import { recordatorioManual } from "@/lib/avisos/servidor";

// Gestion de las respuestas en la web (D99): «Responder por él», «Visto» de la banda roja, «Enviar un recordatorio
// ahora» y el interruptor con sus condiciones. Todo con la sesion del gestor: la base (is_gestor) decide.

export type R = { ok: true; texto?: string } | { ok: false; error: string };
const refrescar = (id?: string) => { revalidatePath("/gestion"); if (id) revalidatePath(`/gestion/eventos/${id}/respuestas`); revalidatePath("/mi-zona", "layout"); };

export async function responderPor(eventoId: string, personId: string, respuesta: "va" | "duda" | "no", motivo: string | null, detalle: string | null): Promise<R> {
  const { supabase } = await exigirGestor();
  const { error } = await supabase.rpc("responder_por", { p_evento: eventoId, p_person: personId, p_respuesta: respuesta, p_motivo: motivo, p_detalle: detalle?.trim() || null });
  if (error) return { ok: false, error: textoError(error.message) };
  refrescar(eventoId);
  return { ok: true };
}

export async function responderDomingoPor(eventoId: string, fecha: string, personId: string, opcion: string, soloEvento: string | null, motivo: string | null, detalle: string | null): Promise<R> {
  const { supabase } = await exigirGestor();
  const { error } = await supabase.rpc("responder_domingo_por", { p_fecha: fecha, p_person: personId, p_opcion: opcion, p_evento: soloEvento, p_motivo: motivo, p_detalle: detalle?.trim() || null });
  if (error) return { ok: false, error: textoError(error.message) };
  refrescar(eventoId);
  return { ok: true };
}

/** «Visto»: quita la banda roja de esos cambios. */
export async function marcarVisto(eventoId: string, ids: string[]) {
  const { supabase, nombre } = await exigirGestor();
  await supabase.from("alertas_gestores").update({ visto_en: new Date().toISOString(), visto_por_nombre: nombre }).in("id", ids).is("visto_en", null);
  refrescar(eventoId);
}

export async function recordatorioAhora(eventoId: string): Promise<R> {
  await exigirGestor();
  const r = await recordatorioManual(eventoId);
  refrescar(eventoId);
  if (!r.avisados) return { ok: true, texto: "No hay nadie a quien recordar (o los avisos no están configurados)." };
  const mas = r.programado && r.programado > new Date() ? ` Es de noche: saldrá a las 08:30.` : "";
  return { ok: true, texto: `Recordatorio para ${r.avisados} ${r.avisados === 1 ? "jugador" : "jugadores"}.${mas}` };
}

// ---------------------------------------------------------------- interruptor (D99.13)
const ERR: Record<string, string> = { condiciones_sin_cumplir: "Aún no se cumplen las condiciones 1, 2 y 4.", solo_gestores: "Solo los gestores." };
const err = (m: string) => ERR[Object.keys(ERR).find((k) => m.includes(k)) ?? ""] ?? m;

export async function cambiarInterruptor(encender: boolean): Promise<R> {
  const { supabase } = await exigirGestor();
  const { error } = await supabase.rpc("cambiar_interruptor", { p_encender: encender });
  if (error) return { ok: false, error: err(error.message) };
  refrescar();
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function marcarJornada(jornada: number, estado: "limpia" | "con_arreglo"): Promise<R> {
  const { supabase } = await exigirGestor();
  const { error } = await supabase.rpc("marcar_jornada", { p_jornada: jornada, p_estado: estado });
  if (error) return { ok: false, error: err(error.message) };
  refrescar();
  return { ok: true };
}

export async function marcarSporteasy(comprobado: boolean): Promise<R> {
  const { supabase } = await exigirGestor();
  const { error } = await supabase.rpc("marcar_sporteasy", { p_comprobado: comprobado });
  if (error) return { ok: false, error: err(error.message) };
  refrescar();
  return { ok: true };
}
