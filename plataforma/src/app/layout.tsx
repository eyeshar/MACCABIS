import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed, JetBrains_Mono } from "next/font/google";
import RegistroSW from "@/components/RegistroSW";
import { Suspense } from "react";
import Cabecera from "@/components/nav/Cabecera";
import SesionProvider, { SCRIPT_SESION } from "@/components/nav/Sesion";
import RastroNavegacion from "@/components/nav/RastroNavegacion";
import { URL_PRODUCCION, esVistaPrevia } from "@/lib/indexacion";
import "./globals.css";

// Tipos del redisenio (D76). next/font los sirve desde el propio dominio: la CSP sigue en font-src 'self'.
const titulos = Barlow_Condensed({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--fuente-titulos" });
// D175: solo los grosores que se ven de verdad (comprobado en un recorrido de 86 cargas de pantalla, movil y escritorio, con jugador y gestor):
// Barlow no usa el 500 en ninguna (el 800 que pide el CSS cae en el 700, que es el mas cercano que hay).
const texto = Barlow({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--fuente-texto" });
const cifras = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--fuente-cifras" });

export const metadata: Metadata = {
  title: "Maccabis",
  description: "Maccabis, baloncesto en Madrid: MdA y MdL en la Liga Municipal de Moratalaz. Partidos, clasificación, estadísticas e historia del club.",
  applicationName: "Maccabis",
  metadataBase: new URL(URL_PRODUCCION),
  // D85: la web publica se indexa (salvo en las vistas previas de Vercel); lo que exige login pone noindex en su layout.
  robots: esVistaPrevia() ? { index: false, follow: false } : { index: true, follow: true },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Maccabis", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0E0D12",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: SCRIPT_SESION pone data-sesion en <html> antes de hidratar (D175).
    <html lang="es" className={`${titulos.variable} ${texto.variable} ${cifras.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: SCRIPT_SESION }} /></head>
      <body>
        {/* La sesion llega del navegador (D175): el layout no lee cookies y asi las paginas publicas se sirven ya hechas. */}
        <SesionProvider>
          <a href="#contenido" className="nv-saltar">Saltar al contenido</a>
          {/* Una sola navegacion en toda la web (D89): la cabecera y la barra inferior viven aqui, no en cada zona. */}
          <Cabecera />
          <div id="contenido" tabIndex={-1}>{children}</div>
        </SesionProvider>
        <Suspense fallback={null}><RastroNavegacion /></Suspense>
        <RegistroSW />
      </body>
    </html>
  );
}
