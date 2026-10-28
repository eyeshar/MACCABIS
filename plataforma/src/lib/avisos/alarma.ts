// Alarma de la tarea de avisos: la llama pg_cron cada 15 minutos; si el servidor la rechaza (401) o falla, no sale ningun
// aviso y nadie se entera. Gestion mira las ultimas respuestas HTTP (estado_tarea_avisos) y avisa a la vista.

export type Pasada = { codigo: number | null; creado: string };

const MIN_SIN_PASADAS = 40;

/** Dos pasadas seguidas con error, o ninguna en los ultimos 40 minutos (con historial). `null` = todo bien o sin datos. */
export function problemaTarea(pasadas: Pasada[], ahora = new Date()): string | null {
  if (!pasadas.length) return null;
  const orden = [...pasadas].sort((a, b) => new Date(b.creado).getTime() - new Date(a.creado).getTime());
  const [a, b] = orden;
  if (b && a.codigo !== 200 && b.codigo !== 200) {
    const codigos = [a.codigo, b.codigo].map((c) => c ?? "sin respuesta").join(" y ");
    return `Las dos últimas pasadas dieron error (${codigos}). Hasta que se arregle no sale ningún aviso.`;
  }
  if (ahora.getTime() - new Date(a.creado).getTime() > MIN_SIN_PASADAS * 60_000) {
    return "La tarea lleva más de 40 minutos sin pasar. Hasta que se arregle no sale ningún aviso.";
  }
  return null;
}

/** Salud para el workflow de GitHub: "ok" si la ultima pasada correcta (200) tiene menos de 40 minutos. */
export function estadoSalud(ultimaOk: string | null, ahora = new Date()): "ok" | "fallando" {
  if (!ultimaOk) return "fallando";
  return ahora.getTime() - new Date(ultimaOk).getTime() > MIN_SIN_PASADAS * 60_000 ? "fallando" : "ok";
}
