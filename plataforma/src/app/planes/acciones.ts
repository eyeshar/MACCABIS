"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirSesion } from "@/lib/sesion";
import { textoError } from "@/lib/respuestas/dominio";
import { avisarOrganizador } from "@/lib/avisos/servidor";

// Planes no oficiales (D117). Todo pasa por funciones de la base (crear_plan, editar_plan, cancelar_plan, borrar_plan,
// hacer_oficial, responder_plan), que comprueban quien es el organizador, si es gestor, la invitacion y las plazas.
// La pantalla solo pinta.

export type Estado = { error?: string } | null;
export type Resultado = { ok: true; texto?: string } | { ok: false; error: string };

const refrescar = () => { revalidatePath("/", "layout"); };
const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const hora = (v: string) => (/^\d{1,2}:\d{2}$/.test(v) ? v.padStart(5, "0") : null);
const numero = (v: string) => (v === "" ? null : Number(v.replace(",", ".")));

/** Del formulario «Proponer un plan» al jsonb de crear_plan / editar_plan. */
function leer(f: FormData): { p?: Record<string, unknown>; error?: string } {
  const tipo = texto(f, "tipo");
  if (!["quedada", "pachanga", "amistoso", "otro"].includes(tipo)) return { error: "Elige qué tipo de plan es." };
  const titulo = texto(f, "titulo");
  if (titulo.length < 3) return { error: "Ponle un título (3 letras o más)." };
  const fecha = texto(f, "fecha");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: "Elige el día." };
  const inicio = hora(texto(f, "inicio"));
  if (!inicio) return { error: "Pon la hora a la que empieza." };
  const quedadaTxt = texto(f, "quedada");
  const quedada = quedadaTxt ? hora(quedadaTxt) : null;
  if (quedadaTxt && !quedada) return { error: "La quedada debe ser una hora tipo 20:10." };
  if (quedada && quedada > inicio) return { error: "La quedada tiene que ser antes de empezar (o a la misma hora)." };
  const plazasTxt = texto(f, "plazas");
  const plazas = plazasTxt ? Number(plazasTxt) : null;
  if (plazas != null && (!Number.isInteger(plazas) || plazas < 2 || plazas > 60)) return { error: "Las plazas van de 2 a 60." };
  const equipo = texto(f, "equipo") || "ambos";
  const lat = numero(texto(f, "ubicacion_lat")), lng = numero(texto(f, "ubicacion_lng"));
  return {
    p: {
      tipo, titulo: titulo.slice(0, 80), fecha, inicio, quedada, equipo, plazas, notas: texto(f, "notas").slice(0, 300) || null,
      recordar: f.get("recordar") === "on", rival_texto: tipo === "amistoso" ? texto(f, "rival_texto").slice(0, 80) || null : null,
      ubicacion_nombre: texto(f, "ubicacion_nombre") || null, ubicacion_direccion: texto(f, "ubicacion_direccion") || null,
      ubicacion_lat: Number.isFinite(lat) ? lat : null, ubicacion_lng: Number.isFinite(lng) ? lng : null,
      ubicacion_enlace: texto(f, "ubicacion_enlace") || null,
    },
  };
}

export async function crearPlan(_prev: Estado, f: FormData): Promise<Estado> {
  const { supabase } = await exigirSesion();
  const r = leer(f);
  if (!r.p) return { error: r.error };
  const { data, error } = await supabase.rpc("crear_plan", { p: r.p });
  if (error) return { error: textoError(error.message) };
  // Quien lo propone va (si luego no puede, lo cambia).
  await supabase.rpc("responder_plan", { p_evento: data as string, p_respuesta: "va" });
  refrescar();
  redirect(`/planes/${data as string}?nuevo=1`);
}

/** Si un gestor ha tocado el plan de otro, el organizador recibe un push (si lo tiene activado); en su inicio le queda
 *  el aviso igualmente (lo deja la base). */
async function avisar(r: { organizador?: string; avisado?: boolean } | null, id: string, titulo: string, cuerpo: string) {
  if (!r?.avisado || !r.organizador) return;
  try { await avisarOrganizador(r.organizador, id, titulo, cuerpo, `/planes/${id}`); } catch { /* queda en su inicio */ }
}

export async function editarPlan(id: string, _prev: Estado, f: FormData): Promise<Estado> {
  const { supabase } = await exigirSesion();
  const r = leer(f);
  if (!r.p) return { error: r.error };
  const { data, error } = await supabase.rpc("editar_plan", { p_id: id, p: r.p });
  if (error) return { error: textoError(error.message) };
  await avisar(data as { organizador?: string; avisado?: boolean }, id, "Un gestor ha cambiado tu plan", `«${String(r.p.titulo)}»: toca para ver cómo queda.`);
  refrescar();
  redirect(`/planes/${id}?guardado=1`);
}

export async function cancelarPlan(id: string, restablecer = false): Promise<Resultado> {
  const { supabase } = await exigirSesion();
  const { data, error } = await supabase.rpc("cancelar_plan", { p_id: id, p_restablecer: restablecer });
  if (error) return { ok: false, error: textoError(error.message) };
  await avisar(data as { organizador?: string; avisado?: boolean }, id, restablecer ? "Un gestor ha restablecido tu plan" : "Un gestor ha cancelado tu plan", "Toca para verlo.");
  refrescar();
  return { ok: true };
}

export async function borrarPlan(id: string): Promise<Resultado> {
  const { supabase } = await exigirSesion();
  const { data, error } = await supabase.rpc("borrar_plan", { p_id: id });
  if (error) return { ok: false, error: textoError(error.message) };
  await avisar(data as { organizador?: string; avisado?: boolean }, id, "Un gestor ha borrado tu plan", "Ya no sale en la agenda de nadie.");
  refrescar();
  revalidatePath("/gestion/eventos");
  redirect("/gestion/eventos?f=planes&borrado=1");
}

export async function hacerOficial(id: string): Promise<Resultado> {
  const { supabase } = await exigirSesion();
  const { data, error } = await supabase.rpc("hacer_oficial", { p_id: id });
  if (error) return { ok: false, error: textoError(error.message) };
  await avisar(data as { organizador?: string; avisado?: boolean }, id, "Tu plan ya es oficial", "Un gestor lo ha hecho oficial: ahora es un evento del club.");
  refrescar();
  revalidatePath("/gestion/eventos");
  redirect(`/gestion/eventos/${id}?guardado=oficial`);
}

export async function responderPlan(id: string, respuesta: "va" | "duda" | "no"): Promise<Resultado> {
  const { supabase } = await exigirSesion();
  const { error } = await supabase.rpc("responder_plan", { p_evento: id, p_respuesta: respuesta });
  if (error) return { ok: false, error: textoError(error.message) };
  refrescar();
  return { ok: true };
}

export async function marcarAvisoVisto(id: string): Promise<Resultado> {
  const { supabase } = await exigirSesion();
  await supabase.rpc("marcar_aviso_visto", { p_id: id });
  refrescar();
  return { ok: true };
}
