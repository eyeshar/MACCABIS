import MarcoPublico from "@/components/web/Marco";
import { FUNDACION } from "@/lib/web";
import "../liga/estadisticas.css";

// Ficha de jugador (migración de GitHub Pages, paso 2, entrega 2): estadísticas de un jugador en una temporada.
export default function JugadorLayout({ children }: { children: React.ReactNode }) {
  return (
    <MarcoPublico actual="plantilla">
      <section className="w-dentro e-cab">
        <div className="w-eyebrow">Maccabis · desde {FUNDACION} · Ficha de jugador</div>
        <h1 className="e-h1">Ficha de <span>jugador</span></h1>
      </section>
      <section className="w-dentro e-cuerpo">{children}</section>
    </MarcoPublico>
  );
}
