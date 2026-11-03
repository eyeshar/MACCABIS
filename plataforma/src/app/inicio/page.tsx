import type { Metadata } from "next";
import InicioPersonal from "@/components/inicio/InicioPersonal";
import PortadaPublica from "@/components/web/PortadaPublica";
import { hoyMadrid } from "@/lib/dias";
import { usuarioActual } from "@/lib/usuario";
import "@/components/inicio/inicio.css";
import "@/components/respuestas/respuestas.css";

// «/» con sesion (D117, D175): el proxy reescribe «/» a esta pagina cuando hay cookie de sesion de Supabase, y next.config
// cuando lleva ?hoy= (pruebas y revisiones: fija la fecha de la portada publica). Dinamica: lee la sesion. Si la cookie
// ya no vale (sesion caducada), enseña la portada publica, como antes.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const usuario = await usuarioActual().catch(() => null);
  if (!usuario) return { title: "Maccabis · Baloncesto en Madrid", alternates: { canonical: "/" } };
  // El inicio personal exige login: fuera de los buscadores (D85). El manifiesto es el de toda la web (layout,
  // /manifest.webmanifest): empieza en «/», que con sesion ya es el inicio; nunca uno bajo /mi-zona (necesitaba sesion).
  return { title: "Inicio · Maccabis", robots: { index: false, follow: false } };
}

export default async function Inicio({ searchParams }: { searchParams: Promise<{ hoy?: string; guardado?: string; no_gestor?: string }> }) {
  const { hoy: hoyPrueba, guardado, no_gestor } = await searchParams;
  const usuario = await usuarioActual().catch(() => null);
  if (usuario) return <InicioPersonal usuario={usuario} aviso={guardado ? "guardado" : no_gestor ? "no_gestor" : null} />;
  // ?hoy=AAAA-MM-DD fija la fecha (solo para pruebas y revisiones; los datos son publicos igualmente).
  return <PortadaPublica hoy={hoyPrueba && /^\d{4}-\d{2}-\d{2}$/.test(hoyPrueba) ? hoyPrueba : hoyMadrid()} />;
}
