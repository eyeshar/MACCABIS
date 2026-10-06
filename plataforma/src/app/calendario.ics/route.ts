import { calendarioIcs } from "@/lib/ical";

// Feed iCal publico (D76): "Añadir a mi calendario". Se genera al desplegar (los datos son ficheros del repo).
export const dynamic = "force-static";

export function GET() {
  return new Response(calendarioIcs(), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="maccabis.ics"',
      "cache-control": "public, max-age=3600",
    },
  });
}
