import "server-only";
import { cargarEventos, cargarJugadores, TEMPORADA, type Cliente } from "./datos";
import { asistenciaPlataforma, type RespuestaEvento } from "./asistencia";
import { filasDePlataforma, type FilaEvento, type TotalTemporada } from "./asistenciaPantalla";
import { cargarDefecto } from "@/lib/convocatoria/defecto";
import { hoyMadrid } from "@/lib/dias";

const COLUMNAS = "person_id, nombre, temporada, evento_ref, fecha, ambito, equipo, titulo, estado, motivo, origen";
const PAGINA = 1000; // tope de filas por petición de la API

/** Filas de asistencia_eventos (D170) de unas temporadas y/o una persona, por páginas: la API devuelve como mucho 1000. */
export async function cargarFilasGuardadas(sb: Cliente, { temporadas, persona }: { temporadas?: string[]; persona?: string }): Promise<FilaEvento[]> {
  const out: FilaEvento[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    let q = sb.from("asistencia_eventos").select(COLUMNAS);
    if (temporadas) q = q.in("temporada", temporadas);
    if (persona) q = q.eq("person_id", persona);
    const { data, error } = await q.order("person_id").order("evento_ref").range(desde, desde + PAGINA - 1);
    if (error) throw new Error(`asistencia_eventos: ${error.message}`);
    out.push(...((data ?? []) as FilaEvento[]));
    if ((data ?? []).length < PAGINA) return out;
  }
}

/** Totales por temporada de asistencia_motivos (los corregidos de 2025/26 mandan, D72). 573 filas: caben en una página. */
export async function cargarTotales(sb: Cliente): Promise<TotalTemporada[]> {
  const { data, error } = await sb.from("asistencia_motivos").select("temporada, person_id, nombre, ambito, fueron, con_excusa:excusa, sin_excusa, no_convocado:no_conv, lesion, total").range(0, 4999);
  if (error) throw new Error(`asistencia_motivos: ${error.message}`);
  return (data ?? []) as TotalTemporada[];
}

/** Desde el 24/10/2026 (D161): lo que dicen las respuestas de la plataforma en los eventos ya pasados, en vivo. */
export async function cargarFilasPlataforma(sb: Cliente): Promise<{ filas: FilaEvento[]; nombres: Record<string, string>; actuales: Set<string> }> {
  const [eventos, jugadores, defecto, { data: r, error }] = await Promise.all([
    cargarEventos(sb), cargarJugadores(sb), cargarDefecto(sb),
    sb.from("respuestas").select("evento_id, person_id, respuesta, motivo").range(0, 19999),
  ]);
  if (error) throw new Error(error.message);
  const nombres: Record<string, string> = {};
  for (const j of jugadores) nombres[j.person_id] = j.nombre_visible;
  const a = asistenciaPlataforma(eventos, (r ?? []) as RespuestaEvento[], defecto, hoyMadrid());
  return { filas: filasDePlataforma(a, nombres), nombres, actuales: new Set(jugadores.filter((j) => j.activo && j.rol !== "entrenador").map((j) => j.person_id)) };
}

export { TEMPORADA };
