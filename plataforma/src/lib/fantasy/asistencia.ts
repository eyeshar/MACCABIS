import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cargarJugadores } from "@/lib/eventos/datos";
import { convocadosDe, type EventoFila, type Motivo, type Respuesta } from "@/lib/eventos/dominio";
import { cargarDefecto } from "@/lib/convocatoria/defecto";
import { convocadosAprobados } from "@/lib/convocatoria/resumen";
import { efectivaEn } from "@/lib/disponibilidad/porDefecto";
import { estadoPorDefecto, type EstadoPase } from "@/lib/eventos/paseDeLista";

// «¿Falto alguien ayer?» (D196, fase 4): la asistencia real en dos toques. Es el mismo pase de lista de D192 (se guarda
// con pase_de_lista en asistencia_eventos, origen «plataforma», y lo usa «Asistencia y motivos»), reducido a lo que se
// pregunta: de los que dijeron «voy», quien falto; y quien vino sin avisar.

export type FilaAsistencia = {
  person_id: string; nombre: string;
  /** dijo «voy» (en un partido, ademas estaba convocado): se puede marcar como ausente */
  dijoVoy: boolean;
  /** estado del pase si no se toca nada (el que copia la respuesta) */
  porDefecto: EstadoPase;
  /** lo guardado, si ya se respondio */
  guardado: string | null;
};

export async function filasAsistencia(supabase: SupabaseClient, ev: EventoFila) {
  const partido = ev.tipo === "liga";
  const [jugadores, defecto, { data: resp }, { data: guardadasDB }, convocados] = await Promise.all([
    cargarJugadores(supabase), cargarDefecto(supabase, [ev.id]),
    supabase.from("respuestas").select("person_id, respuesta, motivo").eq("evento_id", ev.id),
    supabase.from("asistencia_eventos").select("person_id, estado, cargado_en, pasado_por_nombre").eq("evento_ref", ev.id).eq("origen", "plataforma"),
    partido ? convocadosAprobados(supabase, ev.fecha, ev.equipo) : Promise.resolve(null),
  ]);
  const respDe = new Map(((resp ?? []) as { person_id: string; respuesta: Respuesta; motivo: Motivo | null }[]).map((r) => [r.person_id, r]));
  const guardadas = (guardadasDB ?? []) as { person_id: string; estado: string; cargado_en: string; pasado_por_nombre: string | null }[];
  const guardadaDe = new Map(guardadas.map((g) => [g.person_id, g]));
  const filas: FilaAsistencia[] = convocadosDe(ev, jugadores)
    .map((j) => ({ j, r: respDe.get(j.person_id), ef: efectivaEn(ev, j.person_id, respDe.get(j.person_id)?.respuesta ?? "sin_responder", defecto) }))
    .filter((x) => !x.ef.fuera)
    .map(({ j, r, ef }) => {
      const lesion = r?.motivo === "lesion" || (ef.por === "ausencia" && ef.ausencia?.motivo === "lesion");
      const convocado = convocados ? convocados.has(j.person_id) : null;
      return {
        person_id: j.person_id, nombre: j.nombre_visible,
        dijoVoy: ef.respuesta === "va" && convocado !== false,
        porDefecto: estadoPorDefecto({ respuesta: ef.respuesta, lesion, convocado }),
        guardado: guardadaDe.get(j.person_id)?.estado ?? null,
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const ultima = [...guardadas].sort((a, b) => (a.cargado_en < b.cargado_en ? 1 : -1))[0] ?? null;
  return { filas, partido, respondida: ultima ? { por: ultima.pasado_por_nombre, en: ultima.cargado_en } : null };
}

/** Las filas que se mandan a pase_de_lista: quien dijo «voy» fue (a tiempo) salvo los marcados como ausentes (sin
 *  excusa); el resto queda con lo que respondio, salvo quien vino sin avisar (a tiempo). */
export function filasParaGuardar(filas: FilaAsistencia[], ausentes: string[], sinAvisar: string[]) {
  return filas.map((f) => ({
    person_id: f.person_id, motivo: null,
    estado: (f.dijoVoy ? (ausentes.includes(f.person_id) ? "sin_excusa" : "a_tiempo") : sinAvisar.includes(f.person_id) ? "a_tiempo" : f.porDefecto) as EstadoPase,
  }));
}
