import Link from "next/link";
import { exigirGestor } from "@/lib/sesion";
import { proximosEntrenos } from "@/lib/grupos/datos";
import { redirect } from "next/navigation";

export const metadata = { title: "Grupos de entreno · Gestión Maccabis" };
export const dynamic = "force-dynamic";

// Grupos de entreno (D122): los proximos entrenos y sus repartos. Sin parametros, al del proximo entreno.
export default async function PaginaGrupos({ searchParams }: { searchParams: Promise<{ lista?: string }> }) {
  const { lista } = await searchParams;
  const { supabase } = await exigirGestor();
  const entrenos = await proximosEntrenos(supabase);
  if (!lista && entrenos[0]) redirect(`/gestion/grupos/${entrenos[0].id}`);
  return (
    <>
      <div className="gs-titulo"><div><div className="gs-eyebrow">Grupos de entreno</div><h1>Próximos entrenos</h1></div></div>
      {entrenos.length ? (
        <ul className="gs-pendientes">
          {entrenos.map((e) => (
            <li key={e.id}><Link href={`/gestion/grupos/${e.id}`}>{new Date(`${e.fecha}T12:00:00Z`).toLocaleDateString("es-ES", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" })}{e.inicio ? ` · ${e.inicio.slice(0, 5)}` : ""}</Link>
              <span className="suave"> · {e.repartos ? `${e.repartos} ${e.repartos === 1 ? "reparto" : "repartos"}` : "sin repartos"}{e.publicado ? " · publicado" : ""}</span></li>
          ))}
        </ul>
      ) : <p className="suave">No quedan entrenos en el calendario.</p>}
    </>
  );
}
