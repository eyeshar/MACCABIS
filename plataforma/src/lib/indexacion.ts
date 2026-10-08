// Indexacion en buscadores (D85). La web publica (portada, /club, /privacidad...) se indexa; todo lo que exige login
// no (noindex y Disallow en robots.txt). Las vistas previas de Vercel nunca se indexan.
// La lista se repite en next.config.ts (cabecera X-Robots-Tag), que no puede importar de src/: pruebas:portada
// comprueba que las dos coinciden.
export const RUTAS_PRIVADAS = ["/entrar", "/mi-zona", "/gestion", "/cuenta", "/auth", "/avisos", "/api"];

/** Despliegue de vista previa o desarrollo en Vercel (VERCEL_ENV lo pone Vercel; en local no existe). */
export const esVistaPrevia = () => Boolean(process.env.VERCEL_ENV) && process.env.VERCEL_ENV !== "production";

/** URL de produccion (sitemap y enlaces canonicos). */
export const URL_PRODUCCION = "https://maccabis.vercel.app";
