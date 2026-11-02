// Lo que NUNCA puede leer un jugador (D39, D173.F): un nivel (A–E en contexto de nivel), «nivel», «riesgo», «reserva», «dobla»
// o la proyección. Lo usan pruebas:privacidad-avisos (textos de avisos y WhatsApp) y pruebas:rutina-c (pantallas y registro).
export const PROHIBIDO_JUGADOR = /\bnivel(es)?\b|\briesgo\b|\breserva\b|\bdobla\b|proyecci[oó]n|puntos esperados/i;
// Una letra de nivel suelta: «(B)», «A+», «C-», «nivel A» (en mayúscula y con su signo o entre paréntesis, para no confundir
// con una palabra).
const LETRA = /\([A-E][+-]?\)|(?:^|[\s(])[A-E][+-](?=[\s).,;]|$)/;

/** Devuelve lo prohibido que encuentra en el texto, o null. */
export function prohibidoEn(texto) {
  const a = texto.match(PROHIBIDO_JUGADOR);
  if (a) return a[0];
  const b = texto.match(LETRA);
  return b ? b[0].trim() : null;
}
