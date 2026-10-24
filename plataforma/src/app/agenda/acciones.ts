"use server";

import { revalidatePath } from "next/cache";
import { exigirSesion } from "@/lib/sesion";
import { cargarMiZona } from "@/app/mi-zona/datos";
import { nuevoEnlace } from "@/lib/calendario/enlace";

/** «Cambiar mi enlace» del calendario personal (D119): el anterior deja de funcionar al momento. */
export async function cambiarMiEnlace(): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await exigirSesion();
  const zona = await cargarMiZona();
  if (!zona) return { ok: false, error: "Tu cuenta no tiene ficha de jugador." };
  const ok = await nuevoEnlace(supabase, zona.jugador.person_id);
  revalidatePath("/agenda");
  revalidatePath("/cuenta");
  return ok ? { ok: true } : { ok: false, error: "No se pudo cambiar el enlace. Inténtalo otra vez." };
}
