// Pase de lista (D50, D189, D192): funciones PURAS (`node` carga este fichero tal cual en las pruebas). La base guarda el
// pase en asistencia_eventos (función pase_de_lista, migración 20261110120000) con origen = 'plataforma'; «a tiempo» y
// «retraso» son 'fue' (el retraso, en el motivo), y «no convocado» solo existe en los partidos.
import { madrid } from "../avisos/horario.ts";

export type EstadoPase = "a_tiempo" | "retraso" | "con_excusa" | "sin_excusa" | "lesion" | "no_convocado";

export const TEXTO_PASE: Record<EstadoPase, string> = {
  a_tiempo: "Fue, a tiempo", retraso: "Fue, con retraso", con_excusa: "Faltó con excusa", sin_excusa: "Faltó sin excusa",
  lesion: "Lesionado", no_convocado: "No convocado",
};

/** Los estados que se ofrecen: «no convocado», solo en los partidos. */
export const estadosPase = (partido: boolean): EstadoPase[] =>
  ["a_tiempo", "retraso", "con_excusa", "sin_excusa", "lesion", ...(partido ? (["no_convocado"] as const) : [])];

/** Cuándo termina el evento (y se abre el pase de lista): la hora de fin; sin ella, la de inicio más dos horas; sin
 *  ninguna, al acabar el día. Igual que la base (pase_de_lista). */
export function finDelEvento(e: { fecha: string; inicio: string | null; fin: string | null }): Date {
  const hm = (t: string | null) => (t ? String(t).slice(0, 5) : null);
  const ini = hm(e.inicio), fin = hm(e.fin);
  if (fin) {
    const f = madrid(e.fecha, fin);
    return ini && fin < ini ? new Date(f.getTime() + 24 * 3600 * 1000) : f;
  }
  if (ini) {
    const [h, m] = ini.split(":").map(Number);
    const t = (h * 60 + m + 120) % (24 * 60); // como `time + interval '2 hours'` en la base: da la vuelta al pasar de medianoche
    return madrid(e.fecha, `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  }
  return madrid(e.fecha, "23:59");
}

/** Lo que propone el pase si nadie lo ha pasado todavía: «por defecto se copia la respuesta» (D50).
 *  - En un partido con la convocatoria aprobada, quien no está en la de su equipo: «no convocado».
 *  - «Va»: fue, a tiempo. «No va» por lesión (su motivo o su ausencia): lesionado; por otro motivo: con excusa (avisó).
 *  - «Duda» o «sin responder» en un evento que ya pasó: sin excusa. */
export function estadoPorDefecto(p: { respuesta: "va" | "duda" | "no" | "sin_responder"; lesion: boolean; convocado: boolean | null }): EstadoPase {
  if (p.convocado === false) return "no_convocado";
  if (p.respuesta === "va") return "a_tiempo";
  if (p.respuesta === "no") return p.lesion ? "lesion" : "con_excusa";
  return "sin_excusa";
}

/** El estado de una fila ya guardada (asistencia_eventos), en los del pase. */
export function estadoGuardado(f: { estado: string; motivo: string | null }): EstadoPase {
  if (f.estado === "fue") return f.motivo === "retraso" ? "retraso" : "a_tiempo";
  return (["con_excusa", "sin_excusa", "lesion", "no_convocado"].includes(f.estado) ? f.estado : "sin_excusa") as EstadoPase;
}

/** Recuento para la cabecera del pase: cuántos fueron (a tiempo o con retraso), faltaron (con o sin excusa) y el resto. */
export function recuentoPase(estados: EstadoPase[]) {
  const n = (...k: EstadoPase[]) => estados.filter((e) => k.includes(e)).length;
  return { fueron: n("a_tiempo", "retraso"), retraso: n("retraso"), conExcusa: n("con_excusa"), sinExcusa: n("sin_excusa"), lesion: n("lesion"), noConvocado: n("no_convocado") };
}
