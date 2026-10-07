import MarcoPublico from "@/components/web/Marco";
import { FUNDACION } from "@/lib/web";
import "../liga/estadisticas.css";

// Plantilla (migración de GitHub Pages, paso 2, entrega 2): la plantilla de cada temporada, con enlace a la ficha de cada jugador.
export default function PlantillaLayout({ children }: { children: React.ReactNode }) {
  return (
    <MarcoPublico actual="plantilla">
      <section className="w-dentro e-cab">
        <div className="w-eyebrow">Maccabis · desde {FUNDACION} · Liga Municipal Moratalaz</div>
        <h1 className="e-h1">Plantilla <span>Maccabis</span></h1>
        <p className="e-sub">Dos equipos, una plantilla. Pincha en un jugador para ver su ficha.</p>
      </section>
      <section className="w-dentro e-cuerpo">{children}</section>
    </MarcoPublico>
  );
}
