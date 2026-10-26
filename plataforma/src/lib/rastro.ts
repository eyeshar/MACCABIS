// Rastro de pantallas de la sesion (D139): lo que ya se ha visto en esta pestaña, para que «← volver» lleve a la pantalla de
// ORIGEN con su pestaña, su filtro y su jornada (todo eso vive en la URL: ?f=, ?fecha=, ?t=...). Puro y sin React: se prueba aparte.
export const CLAVE_RASTRO = "maccabis.rastro";
const MAXIMO = 30;

/** Pantallas por las que solo se pasa (formularios, acceso): nunca son «el origen» al que se vuelve. */
const DE_PASO = /^\/(entrar|auth)(\/|$)|\/(nuevo|editar)(\/|$)|\/gestion\/eventos\/importar(\/|$)/;

const ETIQUETAS: [string, string][] = [
  ["/gestion/convocatoria/salida", "Salida de la convocatoria"], ["/gestion/convocatoria/datos", "Datos de los jugadores"], ["/gestion/convocatoria", "Convocatoria"],
  ["/gestion/eventos/pistas", "Pistas"], ["/gestion/eventos", "Eventos"], ["/gestion/scouting", "Scouting"], ["/gestion/tablero", "Tablero"], ["/gestion/grupos", "Entrenos y grupos"],
  ["/gestion/jugadores", "Jugadores"], ["/gestion/ropa", "Pedido de ropa"], ["/gestion/liga", "Liga (gestión)"], ["/gestion/asistencia", "Asistencia"],
  ["/mi-zona/ausencias", "Mis ausencias"], ["/mi-zona/ropa", "Mi pedido de ropa"], ["/mi-zona", "Mi zona"], ["/agenda", "Agenda"], ["/planes", "Plan"],
  ["/liga/rivales", "Rivales"], ["/liga", "Liga"], ["/jugador", "Ficha del jugador"], ["/historia", "Historia"], ["/club", "El club"], ["/plantilla", "Plantilla"],
  ["/cuenta", "Mi cuenta"], ["/avisos", "Avisos"], ["/guia-tallas", "Guía de tallas"],
];

const rutaDe = (u: string) => u.split(/[?#]/)[0];

export function etiquetaDe(url: string, defecto: string): string {
  const r = rutaDe(url);
  if (r === "/gestion") return "Panel";
  if (r === "/") return "Inicio";
  return ETIQUETAS.find(([p]) => r === p || r.startsWith(`${p}/`))?.[1] ?? defecto;
}

/** La pantalla anterior a la actual en el rastro (la primera distinta y que no sea de paso), con su posicion; null si no hay. */
export function origenDe(rastro: string[], actual: string): { url: string; indice: number } | null {
  const aqui = rutaDe(actual);
  for (let i = rastro.length - 1; i >= 0; i--) {
    const u = rastro[i];
    if (rutaDe(u) === aqui || DE_PASO.test(rutaDe(u))) continue;
    if (!u.startsWith("/") || u.startsWith("//")) continue;
    return { url: u, indice: i };
  }
  return null;
}

/** Anota la pantalla actual al final del rastro (sin repetir la ultima). */
export function anotar(rastro: string[], actual: string): string[] {
  if (rastro[rastro.length - 1] === actual) return rastro;
  return [...rastro, actual].slice(-MAXIMO);
}
