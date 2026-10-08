// Textos de los avisos al movil (D99.8, lienzo «Paso 3»): funciones PURAS. Sin motivos, niveles ni posiciones: lo que
// sale aqui lo ve la pantalla de bloqueo del movil (test:privacidad lo comprueba).

export type EventoTexto = {
  id: string; tipo: "entreno" | "liga" | "amistoso" | "torneo" | "interno"; equipo: "MdA" | "MdL" | "ambos";
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

const NOMBRE_TIPO = { entreno: "entreno", liga: "partido", amistoso: "amistoso", torneo: "torneo", interno: "partido entre nosotros" } as const;
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

/** (a) Martes 10:00 de un domingo de partido: a quien no ha respondido y a quien tiene «duda». */
export function textoMartes(fecha: string, horasPartidos: string[], tieneDuda: boolean): Texto {
  const dia = `Domingo ${+fecha.slice(8, 10)}`;
  const a = listaY([...new Set(horasPartidos)].map((h) => `a las ${h}`));
  return {
    titulo: tieneDuda ? `${dia}: tienes «duda»` : `${dia}: aún no has respondido`,
    cuerpo: `Hoy se hace la convocatoria. ¿Puedes jugar el domingo${a ? ` ${a}` : ""}?`,
  };
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
export const TEXTO_PRUEBA: Texto = { titulo: "Aviso de prueba", cuerpo: "Así te llegarán los avisos de Maccabis. Solo si te falta responder, si cambia algo o si se cancela; nunca de noche." };

const TEXTO_ESTADO: Record<RespuestaTexto, string> = { va: "Voy", duda: "Duda", no: "No voy", sin_responder: "Sin responder" };
/** (e) A los gestores: un jugador cambia un partido despues del martes a las 10:00. Solo nombre y respuesta. */
export function textoGestores(nombre: string, e: EventoTexto, antes: RespuestaTexto, despues: RespuestaTexto): Texto {
  return {
    titulo: `${nombre} cambia el ${queEs(e)}${e.equipo !== "ambos" ? ` (${e.equipo})` : ""}`,
    cuerpo: `De «${TEXTO_ESTADO[antes]}» a «${TEXTO_ESTADO[despues]}», con la convocatoria ya hecha. Toca para ver las respuestas.`,
  };
}
