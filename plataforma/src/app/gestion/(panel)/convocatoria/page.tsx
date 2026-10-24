import { exigirGestor } from "@/lib/sesion";
import { cargarContexto } from "@/lib/convocatoria/datos";
import Convocatoria from "./Convocatoria";

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
  return <Convocatoria key={`${ctx.fecha}-${ctx.convocatoria?.cambiado_en ?? "nueva"}`} ctx={ctx} />;
}
