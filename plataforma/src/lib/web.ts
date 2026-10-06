// Configuracion de la web publica (D76): un solo sitio para lo que se repite en varias pantallas.

/** Año de fundacion que se muestra ("Desde 2013"). PENDIENTE DE CONFIRMAR por Ivan: SportEasy dice 2012.
 *  Si cambia, se cambia solo aqui (el escudo, que es una imagen, dice "since 2013" y habria que rehacerlo aparte). */
export const FUNDACION = 2013;

/** Web de estadisticas actual (GitHub Pages). Las secciones aun no migradas enlazan aqui (inventario en
 *  docs/MIGRACION_WEB.md). */
export const URL_ESTADISTICAS = "https://eyeshar.github.io/MACCABIS/";

/** Enlace a una pestaña de la web de estadisticas: estadisticas("liga", { g: "G1" }). */
export function estadisticas(pestana?: string, extra: Record<string, string> = {}) {
  const q = new URLSearchParams({ ...(pestana ? { p: pestana } : {}), ...extra }).toString();
  return q ? `${URL_ESTADISTICAS}?${q}` : URL_ESTADISTICAS;
}

export type Seccion = { id: string; texto: string; href: string; externo: boolean };

/** Menu principal de la web publica (maqueta Main). Partidos y El club viven en la portada nueva; Liga, Plantilla e
 *  Historia siguen en la web de estadisticas hasta su migracion. */
export const MENU: Seccion[] = [
  { id: "inicio", texto: "Inicio", href: "/", externo: false },
  { id: "partidos", texto: "Partidos", href: "/#calendario", externo: false },
  { id: "liga", texto: "Liga", href: estadisticas("liga"), externo: true },
  { id: "plantilla", texto: "Plantilla", href: estadisticas("jugadores"), externo: true },
  { id: "historia", texto: "Historia", href: estadisticas("historia"), externo: true },
  { id: "club", texto: "El club", href: "/#club", externo: false },
];

export const NOMBRE_EQUIPO = { MDA: "MdA", MDL: "MdL" } as const;
export const GRUPO_EQUIPO = { MDA: "G1", MDL: "G2" } as const;
