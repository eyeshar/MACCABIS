// Analitica de Vercel (Web Analytics, D188): el codigo esta listo pero NO se activa hasta que Ivan decida (coste y plan,
// DECISIONS D188). Sin NEXT_PUBLIC_ANALITICA=1 en la compilacion, el layout no pone nada en la pagina.
// Lo que sale hacia Vercel pasa antes por aqui: solo visitas de pagina, con la URL sin consulta (?…) ni fragmento (#…),
// y sin los enlaces secretos (el calendario personal, /cal/<enlace>.ics). Ningun evento propio: no hay datos personales.

/** Se compila con la analitica solo si Vercel tiene NEXT_PUBLIC_ANALITICA=1 (y Web Analytics activada en el proyecto). */
export const ANALITICA_ACTIVA = process.env.NEXT_PUBLIC_ANALITICA === "1";

/** Rutas con un secreto dentro: se manda la plantilla, nunca el valor. */
const SECRETOS: [RegExp, string][] = [[/^\/cal\/[^/]+$/, "/cal/[enlace]"]];

/** La URL que se puede mandar: origen y ruta, sin consulta, sin fragmento y con los secretos tapados. */
export function limpiarUrl(url: string): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  let ruta = u.pathname;
  for (const [patron, plantilla] of SECRETOS) if (patron.test(ruta)) ruta = plantilla;
  return `${u.origin}${ruta}`;
}

type Evento = { type: "pageview" | "event"; url: string };

/** beforeSend de <Analytics />: solo visitas de pagina, con la URL limpia; lo demas no sale. */
export function antesDeEnviar<E extends Evento>(evento: E): E | null {
  if (evento.type !== "pageview") return null;
  const url = limpiarUrl(evento.url);
  return url ? { ...evento, url } : null;
}
