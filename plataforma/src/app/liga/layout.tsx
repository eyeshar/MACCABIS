import MarcoPublico from "@/components/web/Marco";
import { NavLiga } from "@/components/liga/NavLiga";
import { TEMPORADA_POR_DEFECTO } from "@/lib/estadisticas/datos";
import { FUNDACION } from "@/lib/web";
import "./estadisticas.css";

// Liga (migración de GitHub Pages, paso 2): Liga 26/27, Rivales 26/27 y las estadísticas por temporada
// (Equipo, Jugadores, Rankings, Por cuartos, Asistencia y MdA) con el selector 2013/14 → 2026/27.
export default function LigaLayout({ children }: { children: React.ReactNode }) {
  return (
    <MarcoPublico actual="liga">
      <section className="w-dentro e-cab">
        <div className="w-eyebrow">Maccabis · desde {FUNDACION} · Liga Municipal Moratalaz</div>
        <h1 className="e-h1">Estadísticas <span>Maccabis</span></h1>
        <p className="e-sub">Dos equipos, una plantilla. Datos verificados contra el marcador de cada acta.</p>
        <NavLiga temporadaPorDefecto={TEMPORADA_POR_DEFECTO} />
      </section>
      <section className="w-dentro e-cuerpo">{children}</section>
    </MarcoPublico>
  );
}
