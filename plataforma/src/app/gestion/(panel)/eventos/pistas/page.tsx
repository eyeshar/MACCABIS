import Link from "next/link";
import { exigirGestor } from "@/lib/sesion";
import { cargarPistas } from "@/lib/eventos/datos";
import { FilaPista, PistaNueva } from "./FormulariosPista";

export const metadata = { title: "Pistas · Gestión Maccabis" };

export default async function Pistas({ searchParams }: { searchParams: Promise<{ volver?: string; creada?: string }> }) {
  const { volver, creada } = await searchParams;
  const { supabase } = await exigirGestor();
  const pistas = await cargarPistas(supabase);
  const vuelta = volver?.startsWith("/gestion/eventos") ? volver : "/gestion/eventos";
  return (
    <>
      <div className="gs-titulo">
        <div>
          <div className="gs-eyebrow"><Link href={vuelta}>← Volver</Link> · Catálogo</div>
          <h1>Pistas</h1>
        </div>
      </div>
      {creada && <div className="aviso aviso-ok" role="status">Pista añadida.</div>}
      <div className="gs-dos">
        <ul className="lista-limpia gs-izq" style={{ gap: 16 }}>{pistas.map((p) => <FilaPista key={p.id} pista={p} />)}</ul>
        <div className="gs-der"><PistaNueva volver={vuelta} /></div>
      </div>
    </>
  );
}
