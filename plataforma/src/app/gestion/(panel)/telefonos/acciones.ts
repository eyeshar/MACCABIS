"use server";

import { revalidatePath } from "next/cache";
import { exigirGestor } from "@/lib/sesion";
import { aGuardar, quedanSinTelefono, revisar, type FilaCsv, type JugadorTel, type Revision } from "@/lib/whatsapp/importar";

// Importar teléfonos (D178), con la sesion del GESTOR (RLS de jugadores: solo is_gestor()). El CSV se lee en el
// navegador; aqui llegan sus filas, se cruzan con la base y se devuelve la revision con los telefonos ENMASCARADOS (el
// navegador nunca recibe de vuelta un telefono de la base). Al confirmar se vuelven a cruzar aqui (manda la base, no lo
// que diga el navegador) y solo se guardan whatsapp_contacto y telefono. Ningun error ni log lleva un telefono.

const MAX_FILAS = 200;

async function jugadoresConTelefono(): Promise<JugadorTel[]> {
  const { supabase } = await exigirGestor();
  const { data, error } = await supabase.from("jugadores").select("person_id, nombre_visible, whatsapp_contacto, telefono, activo").order("nombre_visible");
  if (error) throw new Error("No se pudieron leer los jugadores.");
  return (data ?? []) as JugadorTel[];
}

/** Solo los campos de texto que se esperan, recortados (nada mas viaja ni se usa). */
const limpias = (filas: FilaCsv[]): FilaCsv[] => filas.slice(0, MAX_FILAS).map((f, i) => ({
  linea: Number.isFinite(f?.linea) ? Number(f.linea) : i + 2,
  mote: String(f?.mote ?? "").slice(0, 80), whatsapp_contacto: String(f?.whatsapp_contacto ?? "").slice(0, 120),
  telefono: String(f?.telefono ?? "").slice(0, 30), estado: String(f?.estado ?? "").slice(0, 60),
}));

export type ResultadoRevision = { ok: true; filas: Revision[]; sinTelefono: string[] } | { ok: false; error: string };

export async function revisarTelefonos(filas: FilaCsv[]): Promise<ResultadoRevision> {
  if (!Array.isArray(filas) || !filas.length) return { ok: false, error: "No hay filas que revisar." };
  if (filas.length > MAX_FILAS) return { ok: false, error: `Como mucho ${MAX_FILAS} filas.` };
  try {
    const f = limpias(filas), j = await jugadoresConTelefono();
    return { ok: true, filas: revisar(f, j), sinTelefono: quedanSinTelefono(f, j) };
  } catch {
    return { ok: false, error: "No se pudo revisar el archivo. Vuelve a intentarlo." };
  }
}

export type ResultadoGuardar = { ok: true; guardados: string[] } | { ok: false; error: string; guardados: string[] };

export async function guardarTelefonos(filas: FilaCsv[]): Promise<ResultadoGuardar> {
  if (!Array.isArray(filas) || !filas.length || filas.length > MAX_FILAS) return { ok: false, error: "No hay filas válidas que guardar.", guardados: [] };
  const { supabase } = await exigirGestor();
  let jugadores: JugadorTel[];
  try { jugadores = await jugadoresConTelefono(); } catch { return { ok: false, error: "No se pudieron leer los jugadores.", guardados: [] }; }
  const nombre = new Map(jugadores.map((j) => [j.person_id, j.nombre_visible]));
  const guardados: string[] = [];
  for (const g of aGuardar(limpias(filas), jugadores)) {
    const { error } = await supabase.from("jugadores").update({ telefono: g.telefono, whatsapp_contacto: g.whatsapp_contacto }).eq("person_id", g.person_id);
    // El mensaje de la base no se devuelve: podría citar la fila (con el teléfono).
    if (error) return { ok: false, error: `No se pudo guardar el de ${nombre.get(g.person_id) ?? "un jugador"}. Los anteriores sí se guardaron.`, guardados };
    guardados.push(nombre.get(g.person_id) ?? g.person_id);
  }
  revalidatePath("/gestion/telefonos");
  revalidatePath("/gestion/jugadores");
  return { ok: true, guardados };
}
