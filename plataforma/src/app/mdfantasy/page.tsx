import type { Metadata } from "next";
import Link from "next/link";
import { exigirSesion } from "@/lib/sesion";
import { cargarFantasy, esFantasy } from "@/lib/fantasy/datos";
import Inicio from "./secciones/Inicio";
import Plantilla from "./secciones/Plantilla";
import Mercado from "./secciones/Mercado";
import Jornada from "./secciones/Jornada";
import Ranking from "./secciones/Ranking";
import "./fantasy.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "MdFantasy · Maccabis", robots: { index: false, follow: false } };

// MdFantasy (D196): el fantasy interno del club. Una sola pantalla con las secciones como pestañas ARRIBA (la pestaña, la
// jornada y el filtro viven en la URL: norma 13.4). Apagado (o sin la migracion), una linea y nada mas.
const PESTANAS = [
  { id: "inicio", texto: "Inicio" }, { id: "plantilla", texto: "Plantilla" }, { id: "mercado", texto: "Mercado" },
  { id: "jornada", texto: "Jornada" }, { id: "ranking", texto: "Ranking" },
] as const;
export type Consulta = { tab?: string; j?: string; r?: string; m?: string; mes?: string; c?: string };

export default async function MdFantasy({ searchParams }: { searchParams: Promise<Consulta> }) {
  const { supabase } = await exigirSesion();
  const q = await searchParams;
  const f = await cargarFantasy(supabase);
  if (!esFantasy(f)) {
    const gestor = f?.estado.modo != null;
    return (
      <main className="pagina fz" data-testid="fz-apagado">
        <h1 className="fz-h1">MdFantasy</h1>
        <p className="suave">{f ? "MdFantasy aún no está abierto." : "MdFantasy aún no está disponible."}</p>
        {gestor && <p><Link href="/mdfantasy/ajustes" className="boton boton-contorno">Ajustes (gestores)</Link></p>}
      </main>
    );
  }
  const actual = PESTANAS.find((p) => p.id === q.tab)?.id ?? "inicio";
  return (
    <main className="pagina pagina-ancha fz" data-testid="fz">
      <h1 className="solo-lectores">MdFantasy</h1>
      <nav className="fz-pestanas" aria-label="Secciones de MdFantasy" data-testid="fz-pestanas">
        {PESTANAS.map((p) => <Link key={p.id} href={p.id === "inicio" ? "/mdfantasy" : `/mdfantasy?tab=${p.id}`} aria-current={actual === p.id ? "page" : undefined}>{p.texto}</Link>)}
      </nav>
      <p className="fz-ayuda"><Link href="/mdfantasy/como-se-juega" data-testid="fz-como-enlace">Cómo se juega ›</Link></p>
      <div className="fz-panel" data-pestana={actual}>
        {actual === "inicio" && <Inicio f={f} />}
        {actual === "plantilla" && <Plantilla f={f} q={q} />}
        {actual === "mercado" && <Mercado f={f} q={q} />}
        {actual === "jornada" && <Jornada f={f} q={q} />}
        {actual === "ranking" && <Ranking f={f} q={q} />}
      </div>
    </main>
  );
}
