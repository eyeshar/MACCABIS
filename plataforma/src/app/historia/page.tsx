import type { Metadata } from "next";
import HistoriaClub from "@/components/liga/Historia";
import { ALIAS, personasHistoria } from "@/lib/estadisticas/historiaDatos";

export const metadata: Metadata = {
  title: "Historia del club · Maccabis",
  description: "Quién ha pasado por Maccabis desde 2013: rejilla de personas por temporada, altas y bajas de cada año y la ficha de cada persona.",
  alternates: { canonical: "/historia" },
};

// Historia del club (antes, la pestaña «El Club» de GitHub Pages ?p=historia). ?persona=<person_id> abre la ficha de una persona.
export default async function Historia({ searchParams }: { searchParams: Promise<{ persona?: string }> }) {
  const { persona } = await searchParams;
  const personas = await personasHistoria();
  const id = persona ? (ALIAS.get(persona) ?? persona) : null;
  return <HistoriaClub personas={personas} personaInicial={id && personas.some((p) => p.person_id === id) ? id : null} />;
}
