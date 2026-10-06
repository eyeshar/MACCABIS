import type { MetadataRoute } from "next";
import { RUTAS_PRIVADAS, URL_PRODUCCION, esVistaPrevia } from "@/lib/indexacion";

// D85: la web publica se indexa; lo que exige login, no. Una vista previa de Vercel no se indexa nunca.
export default function robots(): MetadataRoute.Robots {
  if (esVistaPrevia()) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: RUTAS_PRIVADAS }],
    sitemap: `${URL_PRODUCCION}/sitemap.xml`,
  };
}
