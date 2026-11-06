import MarcoPublico from "@/components/web/Marco";
import { NavLiga } from "@/components/liga/NavLiga";
import { TEMPORADA_POR_DEFECTO } from "@/lib/estadisticas/datos";
import "./estadisticas.css";

// Liga (bloque 6 de la estructura nueva): título de una línea y cuatro pestañas fijas, Clasificación · Rivales ·
// Jugadores de la liga (solo con sesión, D162) · Temporadas. Sin el bloque de portada de antes: el primer dato se ve sin
// desplazar en el móvil.
export default function LigaLayout({ children }: { children: React.ReactNode }) {
  return (
    <MarcoPublico actual="liga">
      <section className="w-dentro e-cab e-cab-compacta">
        <h1 className="e-h1 e-h1-compacto">Liga</h1>
        <NavLiga temporadaPorDefecto={TEMPORADA_POR_DEFECTO} />
      </section>
      <section className="w-dentro e-cuerpo">{children}</section>
    </MarcoPublico>
  );
}
