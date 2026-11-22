// MdFantasy (D196): el aviso al afectado por un clausulazo. Logica pura (pruebas:fantasy-logica).
// Sale al momento, salvo en el horario de silencio (22:30-08:00, D155): entonces espera a las 08:00.
import { horaDeEnvio } from "../avisos/horario.ts";
import { millones } from "./reglas.ts";

export function avisoClausulazo(d: { precio: number; jugador: string; comprador: string }, jugadorId: string, dueno: string, ahora: Date) {
  return {
    titulo: "MdFantasy: te han hecho un clausulazo",
    cuerpo: `${d.comprador} se lleva a ${d.jugador}. Cobras ${millones(Number(d.precio))}.`,
    clave: `fantasy-clausulazo:${jugadorId}:${dueno}:${ahora.getTime()}`,
    tipo: "cambio" as const, person_id: dueno, eventos: [] as string[], url: "/mdfantasy?tab=mercado",
    programado_para: horaDeEnvio(ahora, null),
  };
}
