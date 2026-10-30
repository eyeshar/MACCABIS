import type { MetadataRoute } from "next";
import { URL_PRODUCCION } from "@/lib/indexacion";
import { TEMPORADAS } from "@/lib/estadisticas/datos";
import { LIGA, hrefPartido } from "@/lib/estadisticas/liga";

// Paginas publicas de la web (D85). Liga (D91) y sus estadisticas por temporada ya son de la web; Plantilla e Historia siguen en GitHub Pages hasta su migracion.
// Las paginas de partido de la liga (D129) son publicas: una por resultado de los dos grupos (lo de terceros solo lo ve un gestor).
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${URL_PRODUCCION}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${URL_PRODUCCION}/liga`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${URL_PRODUCCION}/liga/rivales`, changeFrequency: "monthly", priority: 0.6 },
    ...Object.values(LIGA.grupos).flatMap((g) => g.resultados).map((r) => ({ url: `${URL_PRODUCCION}${hrefPartido(r.id)}`, changeFrequency: "monthly" as const, priority: 0.4 })),
    ...TEMPORADAS.map((t) => ({ url: `${URL_PRODUCCION}/liga/${t.id}/equipo`, changeFrequency: "monthly" as const, priority: 0.5 })),
    { url: `${URL_PRODUCCION}/plantilla`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${URL_PRODUCCION}/historia`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${URL_PRODUCCION}/club`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${URL_PRODUCCION}/privacidad`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
