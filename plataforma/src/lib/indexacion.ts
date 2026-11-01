// Indexacion en buscadores (D85). La web publica (portada, /club, /privacidad...) se indexa; todo lo que exige login
// no (noindex y Disallow en robots.txt). Las vistas previas de Vercel nunca se indexan.
// La lista se repite en next.config.ts (cabecera X-Robots-Tag), que no puede importar de src/: pruebas:portada
// comprueba que las dos coinciden.
// D117-D120: la agenda, los planes, «Mis números» y el calendario personal (/cal/<enlace secreto>.ics) tambien.
// D162: Scouting rivales y Liga consolidada (dentro de la Liga, pero con sesion: datos de terceros).
export const RUTAS_PRIVADAS = ["/entrar", "/mi-zona", "/gestion", "/cuenta", "/auth", "/avisos", "/api", "/agenda", "/planes", "/mis-numeros", "/cal", "/asistente", "/liga/scouting", "/liga/consolidada"];

/** Despliegue de vista previa o desarrollo en Vercel (VERCEL_ENV lo pone Vercel; en local no existe). */
export const esVistaPrevia = () => Boolean(process.env.VERCEL_ENV) && process.env.VERCEL_ENV !== "production";

/** URL de produccion (sitemap y enlaces canonicos). */
export const URL_PRODUCCION = "https://maccabis.vercel.app";
