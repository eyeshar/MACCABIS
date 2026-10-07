import Link from "next/link";
import { exigirGestor } from "@/lib/sesion";
import { cargarPistas } from "@/lib/eventos/datos";
import { TIPOS, type TipoEvento } from "@/lib/eventos/dominio";
import FormularioEvento from "../FormularioEvento";

export const metadata = { title: "Nuevo evento · Gestión Maccabis" };

export default async function NuevoEvento({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo } = await searchParams;
  const { supabase } = await exigirGestor();
  const pistas = await cargarPistas(supabase);
  const tipoInicial = (TIPOS.find((t) => t.id === tipo)?.id ?? "amistoso") as TipoEvento;
  return (
    <>
      <div className="gs-titulo">
        <div>
          <div className="gs-eyebrow"><Link href="/gestion/eventos">← Eventos</Link> · Nuevo evento</div>
          <h1 style={{ fontSize: 44 }}>Nuevo evento</h1>
        </div>
      </div>
      <FormularioEvento evento={null} pistas={pistas} nSiguientes={0} alcanceInicial="este" tipoInicial={tipoInicial} volver="/gestion/eventos" />
    </>
  );
}
