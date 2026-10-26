import { exigirGestor } from "@/lib/sesion";
import Volver from "@/components/nav/Volver";
import { cargarContexto } from "@/lib/convocatoria/datos";
import Convocatoria from "./Convocatoria";
import { hrefJugador } from "@/lib/numeros/enlaces";

export const metadata = { title: "Convocatoria · Gestión Maccabis" };

// Convocatoria del proximo domingo con partido (o del que se pida con ?fecha=). Solo gestores (D107, D39): niveles,
// posiciones y propuestas viven solo aqui.
export default async function PaginaConvocatoria({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const { fecha } = await searchParams;
  const { supabase } = await exigirGestor();
  const ctx = await cargarContexto(supabase, fecha);
  if (!ctx) {
    return (
      <div className="gs-titulo"><div><div className="gs-eyebrow">Convocatoria</div><h1>Sin partidos</h1><span className="suave">No quedan partidos de liga en el calendario.</span></div></div>
    );
  }
  // Cada nombre enlaza a su ficha (D139) si tiene estadisticas.
  const enlaces = Object.fromEntries(ctx.jugadores.flatMap((j) => { const h = hrefJugador(j.person_id); return h ? [[j.person_id, h]] : []; }));
  return <><Volver defecto="/gestion" etiqueta="Panel" /><Convocatoria key={ctx.fecha} ctx={ctx} enlaces={enlaces} /></>;
}
