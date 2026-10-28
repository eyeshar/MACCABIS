// Limpieza de la respuesta del modelo en el servidor, antes de que llegue al navegador (D142). PURA, para probarla.
//   1. Enlaces: solo las paginas reales (RUTAS) y las direcciones que vienen tal cual en los datos que se le dieron
//      (la pagina de cada evento, el «Como llegar» de Google Maps). Cualquier otro enlace se quita y queda el texto.
//      Como mucho 2 enlaces distintos.
//   2. Frases de relleno: despedidas y ofertas de ayuda («¿hay algo mas…?», «estare encantado…»), fuera.
//   3. Nada de como funciona por dentro: una frase que hable de «contexto», «instrucciones», «prompt» o de «las reglas»
//      se quita; si no queda nada, «Eso no puedo hacerlo.».
import { RUTAS, WEB } from "./contexto.ts";

const MAX_ENLACES = 2;
/** Una direccion y lo que la introduce («en», «a», «desde», «aquí:», «:»), que se va con ella si se quita. */
const URL_RE = /((?:\s*\b(?:en|a|desde|aqu[ií]|visita|entra en)\b:?|\s*:)?\s*)(https?:\/\/[^\s<>"'«»()\[\]]+)/gi;
const RELLENO = /(estar[ée] encantad|¿\s*(hay|tienes) algo (m[aá]s|espec[ií]fico)|¿\s*quieres saber algo|¿\s*(te|le) puedo ayudar|si (necesitas|tienes) (algo|alguna|m[aá]s|otra|ayuda)|no dudes en|espero (que|haberte)|cualquier otra (duda|pregunta))/i;
const INTERNO = /\b(contexto|instrucciones|prompt|secci[oó]n (de )?(datos|contexto)|(mis|estas|las|unas) reglas( establecidas| que)?|datos de la web que (me|tengo))\b/i;
export const NEGATIVA = "Eso no puedo hacerlo.";
export const NO_DECIR = "Eso no te lo puedo decir.";

const rutasValidas = new Set(RUTAS.map(([r]) => r));

/** ¿Es una direccion a la que se puede enlazar? `datos` es el texto que se le dio al modelo. */
export function enlaceValido(url: string, datos: string) {
  if (url.startsWith(WEB)) {
    const ruta = url.slice(WEB.length) || "/";
    if (/[#?]/.test(ruta)) return datos.includes(url);
    const sinBarra = ruta.length > 1 ? ruta.replace(/\/$/, "") : ruta;
    return rutasValidas.has(sinBarra) || datos.includes(`${WEB}${sinBarra}`);
  }
  // Fuera de la web, solo lo que venia tal cual en los datos (Google Maps de un evento).
  return url.length > 12 && datos.includes(url);
}

/** Lo que queda colgando al quitar un enlace: «y .», «o» al final, «( )», dobles espacios. */
function ordenar(t: string) {
  let x = t, antes;
  do {
    antes = x;
    x = x.replace(/,?\s*(?:que|donde) (?:puedes|podr[aá]s) (?:encontrar|ver|consultar|mirar)(?:la|lo|las|los)?\s*(?=[.,;:!?]|$)/gi, "").replace(/\(\s*\)/g, "").replace(/[ \t]{2,}/g, " ").replace(/\s+([.,;:!?])/g, "$1")
      .replace(/\s+(?:y|o|e|u)\s*(?=[.,;:!?]|$)/gi, "").replace(/\s+(?:y|o)\s+(?=(?:y|o)\s)/gi, " ").replace(/:\s*(?=[.,;]|$)/g, "");
  } while (x !== antes);
  return x.trim();
}

export function limpiarRespuesta(texto: string, datos: string): string {
  let vistos = 0;
  const usados = new Set<string>();
  const conservar = (url: string) => {
    if (!enlaceValido(url, datos)) return false;
    if (usados.has(url)) return true;
    if (vistos >= MAX_ENLACES) return false;
    usados.add(url); vistos++;
    return true;
  };
  // Enlaces en markdown [texto](url): valido -> «texto: url»; si no, solo el texto.
  let t = texto.replace(/\[([^\]]{1,120})\]\((https?:\/\/[^)\s]+)\)/g, (_, txt: string, url: string) => (conservar(url) ? `${txt}: ${url}` : txt));
  // Direcciones sueltas (sin la puntuacion final).
  t = t.replace(URL_RE, (_, previo: string, crudo: string) => {
    const url = crudo.replace(/[.,;:!?»]+$/, "");
    const cola = crudo.slice(url.length);
    return (conservar(url) ? previo + url : "") + cola;
  });
  // Frase a frase (respetando saltos de linea y listas): fuera el relleno y lo interno.
  const lineas = t.split("\n").map((l) => {
    const frases = l.split(/(?<=[.!?…])\s+/);
    return ordenar(frases.filter((f) => !RELLENO.test(f) && !INTERNO.test(f)).join(" "));
  });
  const limpio = lineas.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  // Una negativa va sola (el modelo a veces la adorna: «Lo siento, pero no puedo hacerlo. Eso no puedo hacerlo.»).
  for (const n of [NEGATIVA, NO_DECIR]) if (limpio.includes(n)) return n;
  return limpio && /[\p{L}\p{N}]/u.test(limpio) ? limpio : NEGATIVA;
}
