// MdFantasy (D196): volver a puntuar al momento desde una accion del servidor (corregir la asistencia real, «Puntuar
// ahora»). Hace lo mismo que la tarea de cada 15 minutos; si este servidor no tiene la clave de servicio o algo falla,
// no rompe la accion que lo llama: la jornada queda pendiente y la puntua la siguiente pasada.
import { clienteServicio, configuradoEnvio, encolar } from "@/lib/avisos/servidor";
import { tareaFantasy } from "./tarea";

export async function repuntuarFantasy(): Promise<string[] | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const sb = clienteServicio();
  const r = await tareaFantasy(sb, new Date());
  if (configuradoEnvio()) await encolar(sb, r.filas);
  return r.puntuadas;
}

/** Tras guardar un pase de lista: si cambia una jornada ya puntuada, se recalcula ya. Nunca lanza. */
export async function repuntuarTrasAsistencia() {
  try { return await repuntuarFantasy(); } catch (e) { console.error("mdfantasy: no se pudo volver a puntuar tras la asistencia", e); return null; }
}
