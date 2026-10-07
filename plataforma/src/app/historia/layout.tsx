import MarcoPublico from "@/components/web/Marco";
import { FUNDACION } from "@/lib/web";
import "../liga/estadisticas.css";
import "../liga/historia.css";

// Historia del club (migración de GitHub Pages, paso 2, entrega 3).
export default function HistoriaLayout({ children }: { children: React.ReactNode }) {
  return (
    <MarcoPublico actual="historia">
      <section className="w-dentro e-cab">
        <div className="w-eyebrow">Maccabis · desde {FUNDACION} · El club</div>
        <h1 className="e-h1">Historia del <span>club</span></h1>
        <p className="e-sub">Quién ha pasado por Maccabis, temporada a temporada. Pincha en una persona para ver su ficha.</p>
      </section>
      <section className="w-dentro e-cuerpo">{children}</section>
    </MarcoPublico>
  );
}
