import "server-only";
import type { Cliente } from "@/lib/eventos/datos";
import { defectoDe, SIN_DEFECTO, type Defecto } from "@/lib/disponibilidad/porDefecto";

/** Marcas de disponibilidad por defecto (D146) y excepciones de esos entrenos, con la sesion del GESTOR (RLS: solo
 *  gestores; a cualquier otro la base le devuelve 0 filas y todo sigue como sin marcas). Si la migracion aun no esta
 *  aplicada en esta base, sin marcas. */
export async function cargarDefecto(sb: Cliente, eventoIds?: string[]): Promise<Defecto> {
  const [m, q] = await Promise.all([
    sb.from("jugadores_privado").select("person_id, no_suele_entrenar, nunca_partidos").or("no_suele_entrenar.eq.true,nunca_partidos.eq.true"),
    // Sin lista de eventos, todas las excepciones (son pocas: una fila por persona y entreno quitado a mano).
    !eventoIds ? sb.from("entreno_defecto_quitado").select("evento_id, person_id")
      : eventoIds.length ? sb.from("entreno_defecto_quitado").select("evento_id, person_id").in("evento_id", eventoIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (m.error) return SIN_DEFECTO;
  return defectoDe((m.data ?? []) as { person_id: string; no_suele_entrenar: boolean; nunca_partidos: boolean }[], q.error ? [] : ((q.data ?? []) as { evento_id: string; person_id: string }[]));
}
