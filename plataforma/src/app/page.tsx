import type { Metadata } from "next";
import PortadaPublica from "@/components/web/PortadaPublica";
import { hoyMadrid } from "@/lib/dias";

// «/» para quien no ha entrado (D175): la portada publica, ya hecha y servida desde la cache (se rehace como mucho cada
// minuto y en cuanto un gestor toca el calendario). No lee cookies, cabeceras ni la direccion: nada de lo que sale es
// de nadie. Con sesion de Supabase (cookie), el proxy reescribe «/» a /inicio (el inicio personal, D117); con ?hoy=
// (pruebas y revisiones), next.config lo manda tambien a /inicio.
export const revalidate = 60;
export const metadata: Metadata = { title: "Maccabis · Baloncesto en Madrid" };

export default function Portada() {
  return <PortadaPublica hoy={hoyMadrid()} />;
}
