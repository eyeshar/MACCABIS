// Textos de los avisos al movil (D99.8, lienzo «Paso 3»): funciones PURAS. Sin motivos, niveles ni posiciones: lo que
// sale aqui lo ve la pantalla de bloqueo del movil (test:privacidad lo comprueba).

import { textoLimite } from "./horario.ts";

export type EventoTexto = {
  id: string; tipo: "entreno" | "liga" | "amistoso" | "torneo" | "interno" | "quedada" | "pachanga" | "otro"; equipo: "MdA" | "MdL" | "ambos";
  fecha: string; inicio: string | null; fin: string | null; quedada: string | null; titulo: string | null;
  /** "Antonio Díaz Miguel, pista 3" o "pista por confirmar" */
  sitio: string;
};

const hh = (t: string | null | undefined) => (t ? String(t).slice(0, 5) : null);
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
/** "miércoles 14" */
export const nombreDia = (f: string) => `${DIAS[new Date(`${f}T12:00:00Z`).getUTCDay()]} ${+f.slice(8, 10)}`;
/** "a, b y c" */
export const listaY = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} y ${xs.at(-1)}`);
const mayus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const NOMBRE_TIPO = { entreno: "entreno", liga: "partido", amistoso: "amistoso", torneo: "torneo", interno: "partido entre nosotros", quedada: "plan", pachanga: "plan", otro: "plan" } as const;
/** "entreno del miércoles 14", "partido del domingo 18" */
export const queEs = (e: Pick<EventoTexto, "tipo" | "fecha">) => `${NOMBRE_TIPO[e.tipo]} del ${nombreDia(e.fecha)}`;

/** "20:00 (encuentro 19:40)" / "de 20:00 a 22:00 (encuentro 19:40)" */
export function horas(e: Pick<EventoTexto, "inicio" | "fin" | "quedada">, conFin = false) {
  const i = hh(e.inicio), f = hh(e.fin), q = hh(e.quedada);
  if (!i) return "hora por confirmar";
  return `${conFin && f ? `de ${i} a ${f}` : i}${q ? ` (encuentro ${q})` : ""}`;
}

export type Texto = { titulo: string; cuerpo: string };

/** (a) Lunes 19:00, uno por jugador con todo lo que le falta. `unidades` = "entreno del miércoles 14",
 *  "partido del domingo 18" (un domingo con dos partidos cuenta como uno). */
export function textoLunes(unidades: string[]): Texto {
  const n = unidades.length;
  return { titulo: n === 1 ? "Te falta 1 respuesta" : `Te faltan ${n} respuestas`, cuerpo: `${mayus(listaY(unidades))}. Toca para responder.` };
}

/** «Enviar un recordatorio ahora» de un partido (Gestión): a quien no ha respondido, con el plazo (D173: martes a las 12:00). */
export function textoMartes(fecha: string, horasPartidos: string[], plazo?: string): Texto {
  const dia = `Domingo ${+fecha.slice(8, 10)}`;
  const a = listaY([...new Set(horasPartidos)].map((h) => `a las ${h}`));
  return {
    titulo: `${dia}: aún no has respondido`,
    cuerpo: `¿Puedes jugar el domingo${a ? ` ${a}` : ""}? ${plazo ? `Tienes hasta ${plazo} para decir si vas; si no, te quedas fuera de la convocatoria.` : "Toca para responder."}`,
  };
}

/** (a) D173, a las 09:00 del día del plazo: UN aviso a quien no ha respondido o sigue en «duda» a un evento con plazo
 *  semanal (partido del domingo o entreno del miércoles). `ademas` junta lo demás que le tocaba ese día. */
export function textoPlazo(items: { tipo: "partido" | "entreno"; fecha: string; inicio?: string | null; duda: boolean; limite: Date }[], ademas: string[] = [], cuando: Date = new Date()): Texto {
  const resto = listaY(ademas);
  const cola = ademas.length ? ` Además: ${resto}${/[.?!]$/.test(resto) ? "" : "."}` : "";
  const hasta = textoLimite(items[0].limite, cuando);
  const partido = items.find((i) => i.tipo === "partido");
  if (partido) {
    return {
      titulo: `Domingo ${+partido.fecha.slice(8, 10)}: responde hasta ${hasta}`,
      cuerpo: `Tienes hasta ${hasta} para decir si vas; si no, te quedas fuera de la convocatoria.${cola}`,
    };
  }
  const e = items[0];
  const duda = items.some((i) => i.duda);
  return {
    titulo: `Entreno del ${nombreDia(e.fecha)}: responde hasta ${hasta}`,
    cuerpo: `Tienes hasta ${hasta} para decir si vas al entreno${e.inicio ? ` (${hh(e.inicio)})` : ""}${duda ? "; si sigues en «duda», contarás como «no va»" : ""}.${cola}`,
  };
}

/** (a) D173, al cierre del partido (martes 12:00): a quien sigue sin responder. */
export function textoCierre(fecha: string): Texto {
  return {
    titulo: `Domingo ${+fecha.slice(8, 10)}: no has respondido`,
    cuerpo: "No has respondido: no entras en la propuesta de convocatoria. Si puedes jugar, di «voy» cuanto antes.",
  };
}

/** Hora de un instante en Madrid: "20:00". */

/** (a) D141, las 12:00 del dia del limite: a quien siga en «duda». `items` = lo que tiene en duda y su limite. Si ya salia
 *  otro recordatorio ese dia a esa persona, `ademas` lo junta en el mismo aviso. */
export function textoDudas(items: { que: string; limite: Date }[], ademas: string[] = [], cuando: Date = new Date()): Texto {
  const horas = [...new Set(items.map((i) => textoLimite(i.limite, cuando)))];
  const cola = ademas.length ? ` Además: ${listaY(ademas)}.` : "";
  if (horas.length === 1) {
    return {
      titulo: `Tienes «duda»: confirma hasta ${horas[0]}`,
      cuerpo: `Te quedan hasta ${horas[0]} para confirmar; si no, contarás como «no va». ${mayus(listaY([...new Set(items.map((i) => i.que))]))}.${cola}`,
    };
  }
  return {
    titulo: "Tienes «duda»: confirma antes del plazo",
    cuerpo: `Si no confirmas, contarás como «no va»: ${listaY([...new Set(items.map((i) => `${i.que} (hasta ${textoLimite(i.limite, cuando)})`))])}.${cola}`,
  };
}

/** (a) D141, al llegar el limite: la «duda» ha pasado a «no va». Sin motivos: lo ve la pantalla de bloqueo. */
export function textoPasoNoVa(unidades: string[]): Texto {
  return {
    titulo: new Set(unidades).size === 1 ? "Tu «duda» ha pasado a «no va»" : "Tus «duda» han pasado a «no va»",
    cuerpo: `No confirmaste a tiempo: ${listaY([...new Set(unidades)])}. Si al final puedes, entra y pon «Voy».`,
  };
}

/** (a) D152, el lunes a las 19:00: a quien le hemos puesto «no va (por defecto)» en un entreno. Habla de SU respuesta:
 *  nunca nombra la marca. */
export function textoNoVaPorDefecto(e: Pick<EventoTexto, "tipo" | "fecha">): Texto {
  return { titulo: `${mayus(queEs(e))}: no vas`, cuerpo: `Te hemos puesto que no vas al ${queEs(e)}. Si vienes, cámbialo aquí.` };
}

/** (a) El mismo dia del entreno a las 10:00. */
export function textoEntrenoHoy(e: EventoTexto): Texto {
  return { titulo: "Entreno hoy: ¿vas?", cuerpo: `${horas(e)} en ${e.sitio}. Aún no has respondido.`.replace(" en pista por confirmar", ", pista por confirmar") };
}

/** (a) Amistoso, torneo o «entre nosotros»: al crearlo y 24 h antes. */
export function textoOtro(e: EventoTexto, cuando: "creado" | "24h"): Texto {
  const que = `${NOMBRE_TIPO[e.tipo]}${e.titulo ? ` «${e.titulo}»` : ""}`;
  return {
    titulo: cuando === "creado" ? `Nuevo ${que}: ¿vas?` : `Mañana: ${que}. ¿Vas?`,
    cuerpo: `${mayus(nombreDia(e.fecha))}, ${horas(e)} en ${e.sitio}. Aún no has respondido.`.replace(" en pista por confirmar", ", pista por confirmar"),
  };
}

/** Plan no oficial (D118) con «recordar un día antes»: a los invitados que no han respondido. */
export function textoPlanManana(e: EventoTexto): Texto {
  return {
    titulo: `Mañana: ${e.titulo ?? "plan"}. ¿Te apuntas?`,
    cuerpo: `${mayus(nombreDia(e.fecha))}, ${horas(e)}${e.sitio && e.sitio !== "pista por confirmar" ? ` en ${e.sitio}` : ""}. Plan no oficial: aún no has respondido.`,
  };
}

export type RespuestaTexto = "va" | "duda" | "no" | "sin_responder";
const SIGUES: Record<RespuestaTexto, string> = {
  va: "Sigues en «Voy»: si ya no puedes, cámbialo.",
  duda: "Sigues en «Duda»: cuando lo sepas, cámbialo.",
  no: "Tenías «No voy»: si ahora puedes, cámbialo.",
  sin_responder: "Aún no has respondido: toca para responder.",
};

/** (b) Cambio de fecha, hora, pista o encuentro. Si cambia el dia, las respuestas vuelven a «sin responder». */
export function textoCambio(e: EventoTexto, respuesta: RespuestaTexto, cambiaElDia: boolean): Texto {
  if (cambiaElDia) {
    return {
      titulo: `Cambio de día: ${queEs(e)}`,
      cuerpo: `Ahora es el ${nombreDia(e.fecha)}, ${horas(e, true)} en ${e.sitio}. Vuelve a responder.`.replace(" en pista por confirmar", ", pista por confirmar"),
    };
  }
  return { titulo: `Cambio en el ${queEs(e)}`, cuerpo: `${mayus(e.sitio)}, ${horas(e, true)}. ${SIGUES[respuesta]}` };
}

/** (c) Cancelacion. */
export const textoCancelacion = (e: EventoTexto): Texto => ({ titulo: `Se cancela el ${queEs(e)}`, cuerpo: "No hace falta que hagas nada." });

/** (d) Aviso de prueba. */
export const TEXTO_PRUEBA: Texto = { titulo: "Aviso de prueba", cuerpo: "Así te llegarán los avisos de Maccabis. Solo si te falta responder, si cambia algo o si se cancela; de noche solo si el partido es en pocas horas." };

const TEXTO_ESTADO: Record<RespuestaTexto, string> = { va: "Voy", duda: "Duda", no: "No voy", sin_responder: "Sin responder" };
/** (e) A los gestores: un jugador cambia un partido despues del cierre (martes a las 12:00, D173) y antes de aprobar la
 *  convocatoria. Solo nombre y respuesta. (Tras aprobar, los cambios que importan salen con su propio aviso: lib/convocatoria.) */
export function textoGestores(nombre: string, e: EventoTexto, antes: RespuestaTexto, despues: RespuestaTexto): Texto {
  return {
    titulo: `${nombre} cambia el ${queEs(e)}${e.equipo !== "ambos" ? ` (${e.equipo})` : ""}`,
    cuerpo: `De «${TEXTO_ESTADO[antes]}» a «${TEXTO_ESTADO[despues]}», después del cierre del martes. Toca para ver las respuestas.`,
  };
}
