import "server-only";
import personasJson from "@/data/estadisticas/personas.json";
import historiaJson from "@/data/estadisticas/historia_club.json";
import { TEMPORADAS, cargarTemporada } from "./datos";
import { ordenBase, type PersonaH } from "./historia";

// Datos de la Historia del club: personas.json (identidades y temporadas con estadisticas) + historia_club.json (presencia
// por año), copias de data/ hechas por npm run datos:sync. Solo nombres y presencia por temporada: nada personal (D17).
type Registro = { person_id: string; formal: string; display: string; es_entrenador: boolean; solo_mote: boolean; alias_ids: string[] };
const REG = personasJson as unknown as { personas: Registro[]; indice_stats: Record<string, string[]> };
const HIST = historiaJson as unknown as { personas: Omit<PersonaH, "stats" | "destinos" | "formal" | "display">[] & { formal?: string; display?: string }[] };

/** alias antiguo (D20: Castro Mayo -> Castro Moya, Mar Calvo -> Martin Calvo...) -> person_id canonico */
export const ALIAS: ReadonlyMap<string, string> = new Map(REG.personas.flatMap((p) => p.alias_ids.map((a) => [a, p.person_id] as const)));

let CACHE: Promise<PersonaH[]> | null = null;
/** Todas las personas del club, de mas a menos veterana, con a donde lleva cada temporada con estadisticas. */
export function personasHistoria(): Promise<PersonaH[]> {
  CACHE ??= (async () => {
    const reg = new Map(REG.personas.map((p) => [p.person_id, p]));
    // Para no enlazar nunca a una pagina que no existe: ficha si la persona esta en los jugadores de esa temporada; si solo
    // esta en el resumen agregado del MdA (23/24 y 24/25), la pestaña MdA; si no, sin enlace.
    const fichas = new Map<string, Set<string>>(), mda = new Map<string, Set<string>>();
    for (const s of TEMPORADAS) {
      const t = await cargarTemporada(s.id);
      fichas.set(s.id, new Set(t?.players.map((p) => p.person_id)));
      mda.set(s.id, new Set((t?.mda_resumen?.jugadores ?? []).map((j) => j.person_id).filter((x): x is string => !!x)));
    }
    return (HIST.personas as unknown as (PersonaH & { display?: string; formal?: string })[]).map((p) => {
      const r = reg.get(p.person_id);
      const stats = REG.indice_stats[p.person_id] ?? [];
      return {
        ...p,
        display: r?.display || p.display || "", formal: r?.formal || p.formal || "",
        es_entrenador: !!p.es_entrenador, solo_mote: !!p.solo_mote,
        stats,
        destinos: Object.fromEntries(stats.map((s) => [s, fichas.get(s)?.has(p.person_id) ? "ficha" : mda.get(s)?.has(p.person_id) ? "mda" : null])),
      } as PersonaH;
    }).sort(ordenBase);
  })();
  return CACHE;
}
