import type { MetadataRoute } from "next";

// Manifiesto de la web instalable (D76), el UNICO: lo enlazan todas las paginas (layout) y se sirve sin sesion.
// "Añadir a pantalla de inicio" abre «/»: la portada sin sesion y, con sesion, el inicio personal (D117). El antiguo
// /mi-zona/manifest.webmanifest redirige aqui (next.config.ts), para las webs ya instaladas desde Mi zona.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Maccabis",
    short_name: "Maccabis",
    description: "Partidos, clasificación, estadísticas e historia del club Maccabis.",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0E0D12",
    theme_color: "#0E0D12",
    icons: [
      { src: "/iconos/icono-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/iconos/icono-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/iconos/icono-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
