import type { MetadataRoute } from "next";
import { URL_PRODUCCION } from "@/lib/indexacion";

// Paginas publicas de la web (D85). Las secciones de estadisticas siguen en GitHub Pages hasta su migracion.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${URL_PRODUCCION}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${URL_PRODUCCION}/club`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${URL_PRODUCCION}/privacidad`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
