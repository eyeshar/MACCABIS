import personasJson from "@/data/estadisticas/personas.json";

// Enlaces de nombres (D139): el jugador va a su ficha de estadisticas (/jugador/<person_id>) solo si tiene alguna temporada
// con estadisticas; si no, sin enlace (nunca a una pagina que no existe, igual que la Historia).
const INDICE = (personasJson as unknown as { indice_stats: Record<string, string[]> }).indice_stats;

export const hrefJugador = (personId: string | null | undefined): string | null => (personId && INDICE[personId]?.length ? `/jugador/${personId}` : null);
