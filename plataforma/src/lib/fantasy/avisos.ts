// MdFantasy (D196): el aviso al afectado por un clausulazo. Logica pura (pruebas:fantasy-logica).
// Sale al momento, salvo en el horario de silencio (22:30-08:00, D155): entonces espera a las 08:00.
import { enMadrid, horaDeEnvio, limiteDudas, madrid, sumarDias } from "../avisos/horario.ts";
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

// ---------------------------------------------------------------- aviso a los managers: «no han contestado al domingo»
// La VISPERA del plazo de respuesta del domingo (el de toda la web: el martes a las 12:00, `limiteDudas`), a las 20:30:
// hora y media despues del recordatorio del lunes a las 19:00 a los jugadores, para no pisarlo y para nombrar solo a
// quien sigue sin contestar despues de recibirlo; y dos horas antes del silencio de las 22:30. Uno por manager, solo si
// tiene alguno pendiente. Si la tarea no pudo pasar a su hora, aun sale dentro del margen (y, ya en silencio, a las 08:00
// del dia del plazo).
export const HORA_AVISO_MANAGERS = "20:30";
const MARGEN_AVISO_MS = 3 * 3600 * 1000;
export type SinResponder = { fecha: string; evento: { tipo: string; fecha: string; inicio: string | null; oficial: boolean | null } | null; managers: { person_id: string; pendientes: string[] }[] } | null;

/** Cuando toca el aviso de un domingo: la vispera de su plazo, a las 20:30. */
export function tocaAvisoManagers(evento: NonNullable<NonNullable<SinResponder>["evento"]>) {
  const limite = limiteDudas({ tipo: evento.tipo, fecha: evento.fecha, inicio: evento.inicio, oficial: evento.oficial ?? true });
  return { limite, toca: madrid(sumarDias(enMadrid(limite).fecha, -1), HORA_AVISO_MANAGERS) };
}

/** «Jon y Alonso no han contestado al domingo y los tienes en plantilla.» */
export function textoSinResponder(nombres: string[]) {
  if (nombres.length === 1) return `${nombres[0]} no ha contestado al domingo y lo tienes en plantilla.`;
  return `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)} no han contestado al domingo y los tienes en plantilla.`;
}

export function avisosSinResponder(d: SinResponder, ahora: Date) {
  if (!d?.evento) return [];
  const { limite, toca } = tocaAvisoManagers(d.evento);
  const t = ahora.getTime();
  if (t < toca.getTime() || t >= toca.getTime() + MARGEN_AVISO_MS || t >= limite.getTime()) return [];
  return d.managers.filter((m) => m.pendientes.length > 0).map((m) => ({
    titulo: "MdFantasy: sin contestar al domingo", cuerpo: textoSinResponder(m.pendientes),
    clave: `fantasy-sin-responder:${d.fecha}:${m.person_id}`,
    tipo: "cambio" as const, person_id: m.person_id as string | null, user_id: null as string | null, eventos: [] as string[], url: "/mdfantasy?tab=plantilla",
    programado_para: horaDeEnvio(ahora, null),
  }));
}
