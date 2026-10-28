"use server";

import { revalidatePath } from "next/cache";
import { exigirGestor } from "@/lib/sesion";
import { cargarGrupos, type Privado } from "@/lib/grupos/datos";
import { sugerirGrupos, type Sugerencia } from "@/lib/grupos/sugerir";
import { siguientePartido, type Siguiente } from "@/lib/grupos/siguiente";

// Grupos de entreno (D122). Solo gestores (RLS de grupos_repartos: is_gestor). La sugerencia se calcula en el servidor
// con los datos de la base; lo que se guarda se valida contra los invitados al entreno.

export type R<T = undefined> = { ok: true; dato?: T } | { ok: false; error: string };
const refrescar = (evento: string) => { revalidatePath(`/gestion/grupos/${evento}`); revalidatePath("/gestion/grupos"); revalidatePath("/", "layout"); };

/** Posicion, base de reserva y nivel de los invitados al entreno: la pantalla los pide aparte para que no viajen en el
 *  HTML de la pagina (D143) y los tiene solo en memoria. */
export async function datosPrivados(eventoId: string): Promise<R<Record<string, Privado>>> {
  const { supabase } = await exigirGestor();
  const d = await cargarGrupos(supabase, eventoId);
  if (!d) return { ok: false, error: "Ese entreno no existe." };
  return { ok: true, dato: Object.fromEntries(d.jugadores.map((j) => [j.person_id, { posicion: j.posicion, base_reserva: j.base_reserva, nivel: j.nivel }])) };
}

/** Quien juega con quien el siguiente partido (D147, criterio 4 y dato del resumen): solo para esta pantalla. */
export async function datosSiguiente(eventoId: string): Promise<R<Siguiente | null>> {
  const { supabase } = await exigirGestor();
  const d = await cargarGrupos(supabase, eventoId);
  if (!d) return { ok: false, error: "Ese entreno no existe." };
  return { ok: true, dato: await siguientePartido(supabase, d.evento.fecha) };
}

/** «Sugerir grupos» y «Otra sugerencia» (variante = la siguiente combinacion igual de buena). D147: primero la
 *  estructura del quinteto, despues el nivel y, el ultimo, juntar a los del siguiente partido si hay convocatoria. */
export async function sugerir(eventoId: string, tamano: number, variante = 0): Promise<R<Sugerencia>> {
  const { supabase } = await exigirGestor();
  const d = await cargarGrupos(supabase, eventoId);
  if (!d) return { ok: false, error: "Ese entreno no existe." };
  const van = d.jugadores.filter((j) => d.van.includes(j.person_id));
  if (!van.length) return { ok: false, error: "Nadie ha dicho «Voy» a este entreno todavía." };
  const siguiente = await siguientePartido(supabase, d.evento.fecha);
  return { ok: true, dato: sugerirGrupos({ van, tamano, variante, juntos: siguiente?.juntos }) };
}

type Entrada = { id: string | null; nombre: string; tamano: number; grupos: { nombre: string; personas: string[] }[] };

export async function guardarReparto(eventoId: string, r: Entrada): Promise<R<string>> {
  const { supabase, nombre: quien } = await exigirGestor();
  const d = await cargarGrupos(supabase, eventoId);
  if (!d) return { ok: false, error: "Ese entreno no existe." };
  const nombre = r.nombre.trim().slice(0, 60);
  if (!nombre) return { ok: false, error: "Ponle un nombre al reparto (por ejemplo, «5 contra 5»)." };
  const validos = new Set(d.jugadores.map((j) => j.person_id));
  const vistos = new Set<string>();
  const grupos = r.grupos.map((g, i) => ({
    nombre: (g.nombre || `Grupo ${i + 1}`).trim().slice(0, 40),
    personas: g.personas.filter((p) => validos.has(p) && !vistos.has(p) && vistos.add(p)),
  }));
  const tamano = Math.min(6, Math.max(3, Math.round(r.tamano || 5)));
  const fila = { nombre, tamano, grupos, cambiado_en: new Date().toISOString(), cambiado_por_nombre: quien };
  if (r.id) {
    const { error } = await supabase.from("grupos_repartos").update(fila).eq("id", r.id).eq("evento_id", eventoId);
    if (error) return { ok: false, error: `No se pudo guardar: ${error.message}` };
    refrescar(eventoId);
    return { ok: true, dato: r.id };
  }
  const { data, error } = await supabase.from("grupos_repartos").insert({ ...fila, evento_id: eventoId, creado_por_nombre: quien, orden: d.repartos.length }).select("id").single();
  if (error) return { ok: false, error: `No se pudo guardar: ${error.message}` };
  refrescar(eventoId);
  return { ok: true, dato: (data as { id: string }).id };
}

export async function duplicarReparto(eventoId: string, id: string): Promise<R<string>> {
  const { supabase, nombre: quien } = await exigirGestor();
  const { data: o } = await supabase.from("grupos_repartos").select("nombre, tamano, grupos, orden").eq("id", id).eq("evento_id", eventoId).maybeSingle();
  if (!o) return { ok: false, error: "Ese reparto ya no existe." };
  const x = o as { nombre: string; tamano: number; grupos: unknown; orden: number };
  const { data, error } = await supabase.from("grupos_repartos").insert({ evento_id: eventoId, nombre: `${x.nombre} (copia)`.slice(0, 60), tamano: x.tamano, grupos: x.grupos, orden: x.orden + 1, creado_por_nombre: quien, cambiado_por_nombre: quien }).select("id").single();
  if (error) return { ok: false, error: `No se pudo duplicar: ${error.message}` };
  refrescar(eventoId);
  return { ok: true, dato: (data as { id: string }).id };
}

/** Borrar un reparto: queda marcado (nadie borra por la API) y deja de estar publicado. */
export async function borrarReparto(eventoId: string, id: string): Promise<R> {
  const { supabase } = await exigirGestor();
  const { error } = await supabase.from("grupos_repartos").update({ borrado_en: new Date().toISOString(), publicado: false }).eq("id", id).eq("evento_id", eventoId);
  if (error) return { ok: false, error: `No se pudo borrar: ${error.message}` };
  refrescar(eventoId);
  return { ok: true };
}

/** «Publicar a la plantilla»: cada jugador ve SOLO el nombre de su grupo y sus compañeros. Uno publicado por entreno. */
export async function publicarReparto(eventoId: string, id: string, publicar: boolean): Promise<R> {
  const { supabase } = await exigirGestor();
  if (publicar) await supabase.from("grupos_repartos").update({ publicado: false }).eq("evento_id", eventoId).neq("id", id);
  const { error } = await supabase.from("grupos_repartos").update({ publicado: publicar, publicado_en: publicar ? new Date().toISOString() : null }).eq("id", id).eq("evento_id", eventoId);
  if (error) return { ok: false, error: `No se pudo ${publicar ? "publicar" : "retirar"}: ${error.message}` };
  refrescar(eventoId);
  return { ok: true };
}
