import MarcoPublico from "@/components/web/Marco";
import NavClub from "@/components/liga/NavClub";
import "../liga/estadisticas.css";
import "../liga/historia.css";

// Club (bloque 6 de la estructura nueva): título de una línea y tres pestañas, Plantilla (/club) · Historia (/club/historia)
// · El club (/club/el-club). /plantilla y /historia redirigen aquí con 308 (next.config). Todo estático (D175): la
// consulta (?t=, ?persona=) va a la gemela dinámica por los rewrites.
export default function ClubLayout({ children }: { children: React.ReactNode }) {
  return (
    <MarcoPublico actual="club">
      <section className="w-dentro e-cab e-cab-compacta">
        <h1 className="e-h1 e-h1-compacto">Club</h1>
        <NavClub />
      </section>
      <section className="w-dentro e-cuerpo">{children}</section>
    </MarcoPublico>
  );
}
