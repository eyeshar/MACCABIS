import { calendarioIcs } from "@/lib/ical";
import { cargarFuente } from "@/lib/eventos/fuente";

// Feed iCal publico (D76): "Añadir a mi calendario". Se genera al desplegar (desde el paso 2, la tabla de eventos; cada 5 minutos, y los ficheros del repo si Supabase no responde).
export const revalidate = 300;

export async function GET() {
  return new Response(calendarioIcs(new Date(), await cargarFuente()), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="maccabis.ics"',
      "cache-control": "public, max-age=3600",
    },
  });
}
