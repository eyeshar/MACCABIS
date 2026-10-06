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
  turbopack: { root: path.join(__dirname) },
  async headers() {
    const NOINDEX = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    const vistaPrevia = Boolean(process.env.VERCEL_ENV) && process.env.VERCEL_ENV !== "production";
    const privadas = ["/entrar", "/mi-zona", "/gestion", "/auth"];
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
