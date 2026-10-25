// Configuracion de la web publica (D76): un solo sitio para lo que se repite en varias pantallas.

/** Año de fundacion que se muestra ("Desde 2013"): 2013, temporada 2013/14, confirmado por Ivan (D81).
 *  Un solo sitio: el escudo (imagen) tambien dice "since 2013". */
export const FUNDACION = 2013;

export type Seccion = { id: string; texto: string; href: string; externo: boolean };

/** Menu principal de la cabecera unica (D89). Todas las secciones son rutas de esta app (Liga, Plantilla e Historia ya
 *  estan migradas); externo = no es una ruta de esta app, para usar <a> en vez de <Link>. */
export const MENU: Seccion[] = [
  { id: "inicio", texto: "Inicio", href: "/", externo: false },
  { id: "partidos", texto: "Partidos", href: "/#calendario", externo: false },
  { id: "liga", texto: "Liga", href: "/liga", externo: false },
  { id: "plantilla", texto: "Plantilla", href: "/plantilla", externo: false },
  { id: "historia", texto: "Historia", href: "/historia", externo: false },
  { id: "club", texto: "El club", href: "/club", externo: false },
];

/** Menu con sesion (D117): lo de cada persona primero. Escritorio: Inicio · Agenda · Mis números · Liga · Historia (y el
 *  menu GESTIÓN de los gestores). «Mis números» son sus estadisticas (/mis-numeros lleva a su ficha). */
export const MENU_SESION: Seccion[] = [
  { id: "inicio", texto: "Inicio", href: "/", externo: false },
  { id: "agenda", texto: "Agenda", href: "/agenda", externo: false },
  { id: "numeros", texto: "Mis números", href: "/mis-numeros", externo: false },
  { id: "liga", texto: "Liga", href: "/liga", externo: false },
  { id: "historia", texto: "Historia", href: "/historia", externo: false },
];

/** Calendario de SportEasy, para «Responder en SportEasy» en la fase puente (D117). No guardamos el id de cada evento en
 *  SportEasy: el enlace lleva a su calendario (BACKLOG: guardar el id para enlazar al evento). */
export const SPORTEASY_CALENDARIO = "https://app.sporteasy.net/";

/** Entrada del menu de Gestion. Sin href = aun no existe (llega en el paso 2): se ve en gris, sin enlace. */
export type EntradaGestion = { texto: string; corto: string; descripcion: string; href?: string };
export type GrupoGestion = { grupo: string; entradas: EntradaGestion[] };

/** Menu de Gestion (D90): el desplegable de la cabecera, la hoja "Mas" del movil y la barra de la zona. */
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
      { texto: "Asistencia y motivos", corto: "Asistencia y motivos", descripcion: "Quién viene y por qué falta (solo gestores)", href: "/gestion/asistencia" },
      { texto: "Pedido de ropa", corto: "Pedido de ropa", descripcion: "Campaña, pedidos y Excel para VIVE", href: "/gestion/ropa" },
    ],
  },
  {
    grupo: "Competición",
    entradas: [
      { texto: "Scouting rivales", corto: "Scouting rivales", descripcion: "Próximo rival y sus máximos anotadores", href: "/gestion/scouting" },
      { texto: "Liga consolidada", corto: "Liga consolidada", descripcion: "Líderes y todos los jugadores de la liga", href: "/gestion/liga" },
    ],
  },
];

/** Pagina de la cuenta, una para jugadores y gestores (D90). */
export const RUTA_CUENTA = "/cuenta";

export const NOMBRE_EQUIPO = { MDA: "MdA", MDL: "MdL" } as const;
export const GRUPO_EQUIPO = { MDA: "G1", MDL: "G2" } as const;
