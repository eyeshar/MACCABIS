import path from "node:path";
import type { NextConfig } from "next";

// Cabeceras de seguridad para todas las rutas.
// - Referrer-Policy no-referrer: las URL de la zona personal llevan el enlace
//   secreto (/j/<token>); asi no viaja a otras webs al pulsar un enlace externo.
// - X-Robots-Tag noindex: nada de esta plataforma debe salir en buscadores.
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
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
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
