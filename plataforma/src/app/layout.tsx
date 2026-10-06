import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed, JetBrains_Mono } from "next/font/google";
import RegistroSW from "@/components/RegistroSW";
import "./globals.css";

// Tipos del redisenio (D76). next/font los sirve desde el propio dominio: la CSP sigue en font-src 'self'.
const titulos = Barlow_Condensed({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--fuente-titulos" });
const texto = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--fuente-texto" });
const cifras = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--fuente-cifras" });

export const metadata: Metadata = {
  title: "Maccabis",
  description: "Maccabis, baloncesto en Madrid: MdA y MdL en la Liga Municipal de Moratalaz. Partidos, clasificación, estadísticas e historia del club.",
  applicationName: "Maccabis",
  robots: { index: false, follow: false },
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
    <html lang="es" className={`${titulos.variable} ${texto.variable} ${cifras.variable}`}>
      <body>
        {children}
        <RegistroSW />
      </body>
    </html>
  );
}
