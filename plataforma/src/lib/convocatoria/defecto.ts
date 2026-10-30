import "server-only";
import type { Cliente } from "@/lib/eventos/datos";
import { defectoDe, SIN_DEFECTO, type AusenciaDisp, type Defecto } from "@/lib/disponibilidad/porDefecto";

/** Marcas de disponibilidad por defecto (D146) y excepciones de esos entrenos, con la sesion del GESTOR (RLS: solo
 *  gestores; a cualquier otro la base le devuelve 0 filas y todo sigue como sin marcas). Si la migracion aun no esta
 *  aplicada en esta base, sin marcas. Con ellas, las ausencias por periodo vigentes (D150). */
export async function cargarDefecto(sb: Cliente, eventoIds?: string[]): Promise<Defecto> {
  const [m, q, ausencias] = await Promise.all([
    sb.from("jugadores_privado").select("person_id, no_suele_entrenar, nunca_partidos").or("no_suele_entrenar.eq.true,nunca_partidos.eq.true"),
    // Sin lista de eventos, todas las excepciones (son pocas: una fila por persona y entreno quitado a mano).
    !eventoIds ? sb.from("entreno_defecto_quitado").select("evento_id, person_id")
      : eventoIds.length ? sb.from("entreno_defecto_quitado").select("evento_id, person_id").in("evento_id", eventoIds) : Promise.resolve({ data: [], error: null }),
    cargarAusencias(sb),
  ]);
  if (m.error) return { ...SIN_DEFECTO, ausencias };
  return defectoDe((m.data ?? []) as { person_id: string; no_suele_entrenar: boolean; nunca_partidos: boolean }[], q.error ? [] : ((q.data ?? []) as { evento_id: string; person_id: string }[]), ausencias);
}

/** Ausencias por periodo sin borrar (D150), con la sesion del GESTOR (RLS). Son pocas: todas, y cada pantalla mira las
 *  que cubren el dia de su evento (`ausenciaQueCubre`). */
export async function cargarAusencias(sb: Cliente): Promise<AusenciaDisp[]> {
  const { data, error } = await sb.from("ausencias_periodo").select("person_id, desde, hasta, motivo, borrada_en").is("borrada_en", null);
  return error ? [] : ((data ?? []) as AusenciaDisp[]);
}
