import { cargarJugadores } from "@/lib/eventos/datos";
import { cargarActivacionViva } from "@/lib/gestion/activacion";
import { esGestorActual, origenMensajes, sesionActual } from "@/lib/sesion";

// El recuadro «Respuestas en la web» del panel de gestion se vuelve a pedir aqui cada minuto con la pestana visible.
// Solo gestores (con la sesion de quien pregunta, por RLS); nunca en cache.
export const dynamic = "force-dynamic";

export async function GET() {
  const { supabase, user } = await sesionActual();
  if (!supabase || !user) return Response.json({ error: "sin sesión" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (!(await esGestorActual())) return Response.json({ error: "solo gestores" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const viva = await cargarActivacionViva(supabase, await cargarJugadores(supabase), await origenMensajes());
  if (!viva) return Response.json({ error: "sin datos" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return Response.json(viva, { headers: { "Cache-Control": "no-store" } });
}
