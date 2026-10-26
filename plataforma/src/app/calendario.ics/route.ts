import { calendarioIcs } from "@/lib/ical";
import { cargarFuente } from "@/lib/eventos/fuente";

// Feed iCal publico (D76): "Añadir a mi calendario". De la tabla de eventos (paso 2; cacheada 60 s en cargarFuente) y los
// ficheros del repo si Supabase no responde. Se genera en cada peticion, como la portada y /club (D138): generado al
// desplegar salia de los ficheros si la base no respondia en la compilacion, y asi se quedaba hasta 5 minutos (sin la
// ubicacion libre del entreno del 28/10/2026).
export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(calendarioIcs(new Date(), await cargarFuente()), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="maccabis.ics"',
      "cache-control": "public, max-age=3600",
    },
  });
}
