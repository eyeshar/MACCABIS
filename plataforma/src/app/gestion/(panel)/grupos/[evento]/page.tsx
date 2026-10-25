import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirGestor } from "@/lib/sesion";
import { cargarGrupos } from "@/lib/grupos/datos";
import Grupos from "../Grupos";
import "../../tablero/tablero.css";
import "../grupos.css";

export const metadata = { title: "Grupos de entreno · Gestión Maccabis" };
export const dynamic = "force-dynamic";

export default async function GruposEntreno({ params }: { params: Promise<{ evento: string }> }) {
  const { evento } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(evento)) notFound();
  const { supabase } = await exigirGestor();
  const d = await cargarGrupos(supabase, evento);
  if (!d) notFound();
  // El editor no se vuelve a montar al guardar (conserva lo que se está viendo y el aviso); lee los repartos de las props.
  const clave = d.evento.id;
  return (
    <>
      <div className="gs-titulo">
        <div>
          <div className="gs-eyebrow"><Link href="/gestion/grupos?lista=1">← Entrenos</Link> · Grupos de entreno</div>
          <h1>{new Date(`${d.evento.fecha}T12:00:00Z`).toLocaleDateString("es-ES", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" })}</h1>
          <span className="suave">{d.van.length} dicen «Voy» · {d.duda.length} dudan · <Link href={`/gestion/tablero?evento=${d.evento.id}`}>Abrir tablero</Link></span>
        </div>
      </div>
      <Grupos key={clave} d={d} />
    </>
  );
}
