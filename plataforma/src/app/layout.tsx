import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const titulos = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700"], variable: "--fuente-titulos" });
const texto = Source_Sans_3({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--fuente-texto" });

export const metadata: Metadata = {
  title: "Maccabis",
  description: "Zona de jugadores y de gestión del club Maccabis",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#16150F",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${titulos.variable} ${texto.variable}`}>
      <body>{children}</body>
    </html>
  );
}
