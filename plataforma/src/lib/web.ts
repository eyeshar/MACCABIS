// Configuracion de la web publica (D76): un solo sitio para lo que se repite en varias pantallas.

/** Año de fundacion que se muestra ("Desde 2013"): 2013, temporada 2013/14, confirmado por Ivan (D81).
 *  Un solo sitio: el escudo (imagen) tambien dice "since 2013". */
export const FUNDACION = 2013;

/** Secciones de la navegacion (D189, estructura nueva; sustituye a los menus de D89, D90 y D117). */
export type IdSeccion = "inicio" | "semana" | "calendario" | "liga" | "club" | "gestion" | "acceso";
export type Seccion = { id: IdSeccion; texto: string; href: string };

const S: Record<IdSeccion, Seccion> = {
  inicio: { id: "inicio", texto: "Inicio", href: "/" },
  semana: { id: "semana", texto: "Semana", href: "/" },
  calendario: { id: "calendario", texto: "Calendario", href: "/calendario" },
  liga: { id: "liga", texto: "Liga", href: "/liga" },
  club: { id: "club", texto: "Club", href: "/club" },
  gestion: { id: "gestion", texto: "Gestión", href: "/gestion" },
  acceso: { id: "acceso", texto: "Acceso", href: "/entrar" },
};

/** La barra (y el menu de escritorio) de cada persona: jugador Semana · Calendario · Liga · Club; gestor, con o sin ficha,
 *  ademas Gestión; sin sesion, Inicio (la portada publica) · Liga · Club · Acceso. */
export function seccionesDe(u: { esGestor: boolean } | null): Seccion[] {
  if (!u) return [S.inicio, S.liga, S.club, S.acceso];
  return [S.semana, S.calendario, S.liga, S.club, ...(u.esGestor ? [S.gestion] : [])];
}

/** Titulo de la seccion en la cabecera del movil. */
export const TITULO_SECCION: Record<IdSeccion, string> = {
  inicio: "Inicio", semana: "Semana", calendario: "Calendario", liga: "Liga", club: "Club", gestion: "Gestión", acceso: "Acceso",
};

/** La seccion de una pantalla (la que se marca en la barra). Yo (/yo, /avisos) no es de ninguna: se marca el avatar. */
export function seccionDe(ruta: string, conSesion: boolean): IdSeccion | null {
  const en = (...rs: string[]) => rs.some((r) => ruta === r || ruta.startsWith(`${r}/`));
  if (ruta === "/" || ruta === "/inicio") return conSesion ? "semana" : "inicio";
  if (en("/calendario", "/evento", "/agenda", "/planes", "/mi-zona", "/guia-tallas")) return "calendario";
  if (en("/gestion")) return "gestion";
  if (en("/liga")) return "liga";
  if (en("/club", "/plantilla", "/historia", "/jugador", "/privacidad")) return "club";
  if (en("/entrar", "/auth")) return "acceso";
  return null;
}

/** Entrada del menu de Gestion. Sin href = aun no existe (llega en el paso 2): se ve en gris, sin enlace. */
/** `enBarra: false`: solo en el desplegable y la hoja «Más», no en la barra fija de Gestión (que en escritorio ya va llena). */
export type EntradaGestion = { texto: string; corto: string; descripcion: string; href?: string; enBarra?: false };
export type GrupoGestion = { grupo: string; entradas: EntradaGestion[] };

/** Pantallas de Gestion por grupos (D90). Desde D189 ya no hay desplegable, hoja «Más» ni barra de Gestión: /gestion lleva a todas. */
export const MENU_GESTION: GrupoGestion[] = [
  {
    grupo: "La semana",
    entradas: [
      { texto: "Panel de la semana", corto: "Panel", descripcion: "Rutinas, partidos del domingo y pendientes", href: "/gestion" },
      { texto: "Eventos y pistas", corto: "Eventos", descripcion: "Partidos, entrenos y la pista de cada semana", href: "/gestion/eventos" },
      { texto: "Convocatoria", corto: "Convocatoria", descripcion: "Propuesta, reparto MdA / MdL y mensaje", href: "/gestion/convocatoria" },
      { texto: "Tablero", corto: "Tablero", descripcion: "Quién va de un vistazo y ajustes a mano", href: "/gestion/tablero" },
      { texto: "Grupos", corto: "Grupos", descripcion: "Grupos de entreno para preparar el domingo", href: "/gestion/grupos" },
    ],
  },
  {
    grupo: "Plantilla",
    entradas: [
      { texto: "Jugadores", corto: "Jugadores", descripcion: "Plantilla, fichas y correos de acceso", href: "/gestion/jugadores" },
      { texto: "Importar teléfonos", corto: "Teléfonos", descripcion: "Contacto de WhatsApp y teléfono de cada jugador (CSV)", href: "/gestion/telefonos", enBarra: false },
      { texto: "Asistencia y motivos", corto: "Asistencia y motivos", descripcion: "Quién viene y por qué falta (solo gestores)", href: "/gestion/asistencia" },
      { texto: "Pedido de ropa", corto: "Pedido de ropa", descripcion: "Campaña, pedidos y Excel para VIVE", href: "/gestion/ropa" },
    ],
  },
  {
    grupo: "Competición",
    entradas: [
      { texto: "Scouting rivales", corto: "Scouting rivales", descripcion: "Próximo rival y sus máximos anotadores", href: "/liga/scouting" },
      { texto: "Liga consolidada", corto: "Liga consolidada", descripcion: "Líderes y todos los jugadores de la liga", href: "/liga/consolidada" },
    ],
  },
];

/** «Yo» (D189): la pagina de cada persona, que sustituye a Mi cuenta (D90) y a Mis números (D117). */
export const RUTA_CUENTA = "/yo";

export const NOMBRE_EQUIPO = { MDA: "MdA", MDL: "MdL" } as const;
export const GRUPO_EQUIPO = { MDA: "G1", MDL: "G2" } as const;
