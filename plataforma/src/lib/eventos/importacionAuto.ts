// Estado de la importacion de respuestas de SportEasy (D126): cuando fue la ultima y cuando toca la proxima automatica.
// PURO (lo usan Gestion y las pruebas con la hora simulada). La regla sale de la tarea programada de Claude
// «Maccabis · respuestas de SportEasy» (D113, RUTINAS/C_CONVOCATORIA.md): de lunes a miercoles a las 9:54, hora de
// Madrid. La web NO puede lanzar a Claude: aqui solo se informa.
import { diaSemana, enMadrid, madrid, sumarDias } from "../avisos/horario.ts";

export const TAREA_RESPUESTAS = { nombre: "Maccabis · respuestas de SportEasy", dias: [0, 1, 2], hora: "09:54" } as const; // 0 = lunes
const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

/** La proxima ejecucion de la tarea (lunes, martes o miercoles a las 9:54 de Madrid) despues de `ahora`. */
export function proximaImportacion(ahora: Date) {
  const hoy = enMadrid(ahora).fecha;
  for (let i = 0; i < 8; i++) {
    const f = sumarDias(hoy, i);
    if (!(TAREA_RESPUESTAS.dias as readonly number[]).includes(diaSemana(f))) continue;
    const t = madrid(f, TAREA_RESPUESTAS.hora);
    if (t > ahora) return t;
  }
  return madrid(sumarDias(hoy, 7), TAREA_RESPUESTAS.hora);
}

/** «lunes 26/10 a las 9:54» (o «hoy a las 9:54» / «mañana a las 9:54») */
export function textoProxima(t: Date, ahora: Date) {
  const f = enMadrid(t).fecha, hoy = enMadrid(ahora).fecha;
  const hora = enMadrid(t).hora.replace(/^0/, "");
  if (f === hoy) return `hoy a las ${hora}`;
  if (f === sumarDias(hoy, 1)) return `mañana (${DIAS[diaSemana(f)]}) a las ${hora}`;
  return `${DIAS[diaSemana(f)]} ${f.slice(8, 10)}/${f.slice(5, 7)} a las ${hora}`;
}

/** «Las respuestas pueden estar desactualizadas»: la ultima importacion tiene mas de 48 horas (o no hay ninguna) y hay
 *  un partido en los proximos 5 dias. */
export function desactualizadas(ultima: Date | null, ahora: Date, proximoPartido: Date | null) {
  const vieja = !ultima || ahora.getTime() - ultima.getTime() > 48 * 3600 * 1000;
  const cerca = !!proximoPartido && proximoPartido > ahora && proximoPartido.getTime() - ahora.getTime() <= 5 * 24 * 3600 * 1000;
  return vieja && cerca;
}

export type EstadoImportacion = { ultima: string | null; por: string | null; proxima: string; desactualizadas: boolean };

export function estadoImportacion(ultima: string | null, por: string | null, proximoPartido: Date | null, ahora = new Date()): EstadoImportacion {
  return { ultima, por, proxima: textoProxima(proximaImportacion(ahora), ahora), desactualizadas: desactualizadas(ultima ? new Date(ultima) : null, ahora, proximoPartido) };
}
