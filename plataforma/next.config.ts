import path from "node:path";
import type { NextConfig } from "next";

// Cabeceras de seguridad para todas las rutas.
// - Referrer-Policy no-referrer: nada de esta plataforma debe viajar a otras
//   webs al pulsar un enlace externo (p. ej. "Ver mi ficha" al dashboard).
// - X-Robots-Tag noindex (D85): solo en lo que exige login y en las vistas previas de Vercel. La web publica
//   (portada, /club...) si se indexa. Lista igual que RUTAS_PRIVADAS en src/lib/indexacion.ts.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://*.supabase.co",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // La app vive en plataforma/ dentro del repositorio del dashboard: esta es su raiz.
  outputFileTracingRoot: path.join(__dirname),
  turbopack: {
    root: path.join(__dirname),
    // D185: la web de las PRUEBAS se compila con el calendario, los entrenos y las equipaciones de prueba (fijos), nunca con
    // los reales. Solo la infraestructura de pruebas pone PRUEBAS_CALENDARIO (pruebas/infra/app.mjs); Vercel, nunca.
    ...(process.env.PRUEBAS_CALENDARIO
      ? { resolveAlias: {
          "@/data/calendario.json": "./pruebas/fixtures/calendario_prueba.json",
          "@/data/entrenos.json": "./pruebas/fixtures/entrenos_prueba.json",
          "@/data/equipaciones.json": "./pruebas/fixtures/equipaciones_prueba.json",
          // D186: quien descansa y los huecos de los grupos ajenos, de los equipos sinteticos de pruebas:grupos-ajenos.
          "@/data/jornadasAjenas.json": "./pruebas/fixtures/jornadas_ajenas_prueba.json",
        } }
      : {}),
  },
  // forbidden() (403) en /asistente para quien no tiene abierto el asistente (D142).
  experimental: { authInterrupts: true },
  // Una sola pagina de cuenta para jugadores y gestores (D90): la antigua de gestion lleva a la nueva.
  // D117: /mi-zona es ahora el inicio personal («/» con sesion); sus paginas (evento, domingo, ausencias, ropa) siguen.
  async redirects() {
    return [
      { source: "/gestion/cuenta", destination: "/cuenta", permanent: true },
      { source: "/mi-zona", destination: "/", permanent: true },
      // Un solo manifiesto, sin sesion: el de Mi zona (que leia mi_zona y fallaba) lleva al de toda la web.
      { source: "/mi-zona/manifest.webmanifest", destination: "/manifest.webmanifest", permanent: true },
      // D162: Scouting rivales y Liga consolidada salen de Gestión a la Liga, para cualquier jugador con sesión.
      { source: "/gestion/scouting", destination: "/liga/scouting", permanent: true },
      { source: "/gestion/liga", destination: "/liga/consolidada", permanent: true },
      // Estructura nueva, bloque 6: Plantilla e Historia pasan a ser pestañas del Club (/club y /club/historia). La consulta
      // (?t=, ?persona=) viaja sola con la redireccion y alli la recogen los rewrites de abajo (gemelas dinamicas, D175).
      { source: "/plantilla", destination: "/club", permanent: true },
      { source: "/historia", destination: "/club/historia", permanent: true },
      // Las gemelas viejas, por si alguien tenia guardada la direccion interna.
      { source: "/plantilla/con-parametros", destination: "/club", permanent: true },
      { source: "/historia/con-parametros", destination: "/club/historia", permanent: true },
      // Liga › Temporadas › Jugadores vuelve a ser su propia pestaña (antes llevaba a /plantilla?t=).
    ];
  },
  // D175: las paginas publicas se sirven ya hechas (cache), asi que no leen la consulta. Con una consulta que cambia lo que
  // se ve (?hoy= en «/» y /liga, ?g= en /liga, ?persona= en /club/historia, ?t= en /club), se reescriben a su pagina
  // gemela, dinamica; la direccion que se ve no cambia. Es la misma regla de siempre, solo que ahora el caso normal es el rapido.
  async rewrites() {
    const conConsulta = (source: string, claves: string[], destination: string) => claves.map((key) => ({ source, has: [{ type: "query" as const, key }], destination }));
    return {
      beforeFiles: [
        ...conConsulta("/", ["hoy"], "/inicio"),
        ...conConsulta("/liga", ["g", "hoy"], "/liga/con-parametros"),
        // Bloque 6: Plantilla e Historia viven en el Club (antes /plantilla?t= y /historia?persona=, que redirigen con 308).
        ...conConsulta("/club/historia", ["persona"], "/club/historia/con-parametros"),
        ...conConsulta("/club", ["t"], "/club/con-parametros"),
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  async headers() {
    const NOINDEX = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    const vistaPrevia = Boolean(process.env.VERCEL_ENV) && process.env.VERCEL_ENV !== "production";
    const privadas = ["/entrar", "/mi-zona", "/gestion", "/cuenta", "/auth", "/avisos", "/api", "/agenda", "/planes", "/mis-numeros", "/cal", "/asistente", "/liga/scouting", "/liga/consolidada", "/inicio", "/liga/con-parametros", "/club/historia/con-parametros", "/club/con-parametros"];
    return [
      ...(vistaPrevia
        ? [{ source: "/:path*", headers: NOINDEX }]
        : privadas.flatMap((r) => [{ source: r, headers: NOINDEX }, { source: `${r}/:path*`, headers: NOINDEX }])),
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: CSP },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
