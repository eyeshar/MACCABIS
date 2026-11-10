// WhatsApp a quien no ha respondido (D178): funciones PURAS (`node` carga este fichero tal cual en las pruebas).
//
// WhatsApp no convierte en mención un «@Nombre» pegado como texto: la mención solo se crea si se escribe @ en la app y
// se elige el contacto. Por eso hay dos herramientas manuales en Gestión, en el bloque «Sin responder» de cada evento:
//   - «Mensaje al grupo»: un texto con @ + MOTE de cada uno (lo que ven todos), y debajo, solo para el gestor, el nombre
//     de contacto de cada uno en el móvil de Iván (lo que hay que buscar al escribir @);
//   - un botón «WhatsApp» por persona: abre wa.me con su teléfono y un mensaje individual ya escrito.
// La lista sale de la regla única (D177): quien no va por defecto o por una ausencia no sale. Desde D189 («Mensaje a los
// que faltan») también van los que siguen en «duda», con su propia frase, sin quien tiene una ausencia por periodo ese día.
// El plazo es el de la plataforma (`limiteDudas`, D173): partidos, el martes a las 12:00; entreno del miércoles, ese día a
// las 12:00.

import { enMadrid, sumarDias, textoLimite } from "../avisos/horario.ts";

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const NOMBRE_TIPO: Record<string, string> = { entreno: "entreno", liga: "partido", amistoso: "amistoso", torneo: "torneo", interno: "partido entre nosotros" };

/** Lo que dice el mensaje del evento. `horas`: una o dos (un domingo con dos partidos). */
export type EventoMensaje = { tipo: string; fecha: string; horas: string[]; lugar: string | null; url: string; limite: Date };

/** "miércoles 4/11" */
export const diaYFecha = (f: string) => `${DIAS[new Date(`${f}T12:00:00Z`).getUTCDay()]} ${+f.slice(8, 10)}/${+f.slice(5, 7)}`;
/** "entreno del miércoles 4/11" */
export const queEvento = (e: Pick<EventoMensaje, "tipo" | "fecha">) => `${NOMBRE_TIPO[e.tipo] ?? "evento"} del ${diaYFecha(e.fecha)}`;
/** "20:30, Valdebernardo" / "09:00 y 11:00, Antonio Díaz Miguel" */
export function horaYLugar(e: Pick<EventoMensaje, "horas" | "lugar">) {
  const h = [...new Set(e.horas.filter(Boolean))];
  const horas = h.length ? h.join(" y ") : "hora por confirmar";
  return e.lugar ? `${horas}, ${e.lugar}` : horas;
}

/** "las 12:00 de mañana", "las 12:00 de hoy", "el martes a las 12:00". Null si el plazo ya pasó. */
export function antesDe(limite: Date, ahora: Date) {
  if (limite.getTime() <= ahora.getTime()) return null;
  const l = enMadrid(limite), hoy = enMadrid(ahora).fecha;
  if (l.fecha === hoy) return `las ${l.hora} de hoy`;
  if (l.fecha === sumarDias(hoy, 1)) return `las ${l.hora} de mañana`;
  return textoLimite(limite, ahora);
}

/** «Mensaje al grupo»: @ + mote de cada uno (nunca el nombre de contacto: lo verían todos). `dudan`: los que siguen en
 *  «duda» (D189), que van aparte: «@Ana sigues en «duda»». */
export function mensajeGrupo(motes: string[], e: EventoMensaje, ahora: Date, dudan: string[] = []) {
  const plazo = antesDe(e.limite, ahora);
  const cuando = plazo ? `${plazo.startsWith("el ") ? "antes del " + plazo.slice(3) : "antes de " + plazo}` : "cuanto antes";
  const arrobas = (xs: string[]) => xs.map((m) => `@${m}`).join(" ");
  const uno = motes.length + dudan.length === 1;
  const sin = motes.length ? `${arrobas(motes)} aún no ${motes.length === 1 ? "has" : "habéis"} respondido` : "";
  const duda = dudan.length ? `${arrobas(dudan)} ${dudan.length === 1 ? "sigues" : "seguís"} en «duda»` : "";
  if (!duda) return `${sin} al ${queEvento(e)} (${horaYLugar(e)}). ${uno ? "Responde" : "Responded"} en la web ${cuando}: ${e.url}`;
  if (!sin) return `${duda} para el ${queEvento(e)} (${horaYLugar(e)}). ${uno ? "Confirma" : "Confirmad"} en la web ${cuando}: ${e.url}`;
  return `${sin} al ${queEvento(e)} (${horaYLugar(e)}), y ${duda}. Responded en la web ${cuando}: ${e.url}`;
}

/** Mensaje individual del botón «WhatsApp» de cada uno. */
export function mensajeIndividual(mote: string, e: EventoMensaje, ahora: Date) {
  const plazo = e.limite.getTime() > ahora.getTime() ? textoLimite(e.limite, ahora) : null;
  return `Hola ${mote}, aún no has respondido al ${queEvento(e)} (${horaYLugar(e)}). Responde aquí: ${e.url}.${plazo ? ` Tienes hasta ${plazo}.` : ""}`;
}

/** Mensaje individual a quien sigue en «duda» (D189). */
export function mensajeIndividualDuda(mote: string, e: EventoMensaje, ahora: Date) {
  const plazo = e.limite.getTime() > ahora.getTime() ? textoLimite(e.limite, ahora) : null;
  return `Hola ${mote}, sigues en «duda» para el ${queEvento(e)} (${horaYLugar(e)}). Confirma aquí: ${e.url}.${plazo ? ` Tienes hasta ${plazo}; si no, contarás como «no va».` : ""}`;
}

/** https://wa.me/<teléfono sin + ni espacios>?text=<mensaje>. Null sin teléfono válido (el botón sale «Falta teléfono»). */
export function enlaceWa(telefono: string | null | undefined, texto: string) {
  let digitos = (telefono ?? "").replace(/\D/g, "");
  if (/^\s*00/.test(telefono ?? "")) digitos = digitos.slice(2);
  else if (digitos.length === 9 && !/^\s*\+/.test(telefono ?? "")) digitos = `34${digitos}`; // móvil español sin prefijo (como enlaceWhatsApp)
  if (digitos.length < 8) return null;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`;
}
