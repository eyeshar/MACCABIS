"use server";

import { revalidatePath } from "next/cache";
import { exigirSesion } from "@/lib/sesion";
import { textoError } from "@/lib/respuestas/dominio";
import { avisoDePrueba, configuradoEnvio, ejecutarTarea } from "@/lib/avisos/servidor";

// Acciones del jugador (D99): todas pasan por funciones de la base (responder, responder_domingo, guardar_ausencia...),
// que vuelven a comprobar el interruptor, la invitacion, que el evento siga abierto y el motivo. La pantalla solo pinta.

export type Resultado = { ok: true; aviso?: string } | { ok: false; error: string };

const refrescar = () => { revalidatePath("/mi-zona", "layout"); };

/** Si el cambio llega despues del martes a las 10:00, la base deja una alerta: se avisa a los gestores en el momento
 *  (con las horas de silencio). Si falla el envio, la tarea de cada 15 minutos lo recoge. */
async function alertarSiHace(alerta: boolean) {
  if (!alerta || !configuradoEnvio()) return;
  try { await ejecutarTarea(new Date()); } catch { /* lo recoge la tarea */ }
}

export async function responder(eventoId: string, respuesta: "va" | "duda" | "no", motivo?: string | null, detalle?: string | null): Promise<Resultado> {
  const { supabase } = await exigirSesion();
  const { data, error } = await supabase.rpc("responder", { p_evento: eventoId, p_respuesta: respuesta, p_motivo: motivo ?? null, p_detalle: detalle?.trim() || null });
  if (error) return { ok: false, error: textoError(error.message) };
  await alertarSiHace(Boolean((data as { alerta?: boolean })?.alerta));
  refrescar();
  return { ok: true };
}

export async function responderDomingo(fecha: string, opcion: string, eventoId?: string | null, motivo?: string | null, detalle?: string | null): Promise<Resultado> {
  const { supabase } = await exigirSesion();
  const { data, error } = await supabase.rpc("responder_domingo", { p_fecha: fecha, p_opcion: opcion, p_evento: eventoId ?? null, p_motivo: motivo ?? null, p_detalle: detalle?.trim() || null });
  if (error) return { ok: false, error: textoError(error.message) };
  await alertarSiHace(((data as { alertas?: number })?.alertas ?? 0) > 0);
  refrescar();
  return { ok: true };
}

export type EventoPeriodo = { id: string; tipo: string; equipo: string; titulo: string | null; rival: string | null; es_local: boolean | null; fecha: string; inicio: string | null; respuesta: string };

export async function previsualizarAusencia(desde: string, hasta: string | null): Promise<{ ok: true; eventos: EventoPeriodo[] } | { ok: false; error: string }> {
  const { supabase } = await exigirSesion();
  const { data, error } = await supabase.rpc("previsualizar_ausencia", { p_desde: desde, p_hasta: hasta });
  if (error) return { ok: false, error: textoError(error.message) };
  return { ok: true, eventos: (data ?? []) as EventoPeriodo[] };
}

export async function guardarAusencia(id: string | null, desde: string, hasta: string | null, motivo: string, detalle: string | null): Promise<Resultado> {
  const { supabase } = await exigirSesion();
  const { error } = await supabase.rpc("guardar_ausencia", { p_id: id, p_desde: desde, p_hasta: hasta, p_motivo: motivo, p_detalle: detalle?.trim() || null });
  if (error) return { ok: false, error: textoError(error.message) };
  await alertarSiHace(true);
  refrescar();
  return { ok: true };
}

export async function cerrarAusencia(id: string): Promise<Resultado> {
  const { supabase } = await exigirSesion();
  const { error } = await supabase.rpc("cerrar_ausencia", { p_id: id });
  if (error) return { ok: false, error: textoError(error.message) };
  refrescar();
  return { ok: true };
}

export async function borrarAusencia(id: string): Promise<Resultado> {
  const { supabase } = await exigirSesion();
  const { error } = await supabase.rpc("borrar_ausencia", { p_id: id });
  if (error) return { ok: false, error: textoError(error.message) };
  refrescar();
  return { ok: true };
}

// ---------------------------------------------------------------- avisos en este movil (funcionan con el interruptor apagado)
export async function altaSuscripcion(s: { endpoint: string; p256dh: string; auth: string; navegador: string }): Promise<Resultado> {
  const { supabase } = await exigirSesion();
  const { error } = await supabase.rpc("alta_suscripcion", { p_endpoint: s.endpoint, p_p256dh: s.p256dh, p_auth: s.auth, p_navegador: s.navegador.slice(0, 200) });
  if (error) return { ok: false, error: "No se pudieron activar los avisos. Inténtalo otra vez." };
  revalidatePath("/avisos");
  return { ok: true };
}

export async function bajaSuscripcion(endpoint: string): Promise<Resultado> {
  const { supabase } = await exigirSesion();
  await supabase.rpc("baja_suscripcion", { p_endpoint: endpoint });
  revalidatePath("/avisos");
  return { ok: true };
}

export async function mandarAvisoPrueba(): Promise<Resultado> {
  const { user } = await exigirSesion();
  const r = await avisoDePrueba(user.id);
  if (!r.configurado) return { ok: false, error: "Los avisos aún no están configurados en el servidor." };
  if (!r.moviles) return { ok: false, error: "No hay ningún móvil con avisos activados en tu cuenta." };
  return r.enviados ? { ok: true, aviso: "Aviso enviado: te llegará en unos segundos." } : { ok: false, error: "No se pudo entregar. Desactiva y vuelve a activar los avisos en este móvil." };
}
