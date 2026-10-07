import type { MetadataRoute } from "next";
import { URL_PRODUCCION } from "@/lib/indexacion";
import { TEMPORADAS } from "@/lib/estadisticas/datos";

// Paginas publicas de la web (D85). Liga (D91) y sus estadisticas por temporada ya son de la web; Plantilla e Historia siguen en GitHub Pages hasta su migracion.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${URL_PRODUCCION}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${URL_PRODUCCION}/liga`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${URL_PRODUCCION}/liga/rivales`, changeFrequency: "monthly", priority: 0.6 },
    ...TEMPORADAS.map((t) => ({ url: `${URL_PRODUCCION}/liga/${t.id}/equipo`, changeFrequency: "monthly" as const, priority: 0.5 })),
    { url: `${URL_PRODUCCION}/plantilla`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${URL_PRODUCCION}/club`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${URL_PRODUCCION}/privacidad`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
