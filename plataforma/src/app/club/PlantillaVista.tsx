import type { Metadata } from "next";
import JugadoresPestana from "@/components/liga/Jugadores";
import { SelectorTemporadaRuta } from "@/components/liga/Selectores";
import { metricasDe } from "@/lib/estadisticas/calculo";
import { TEMPORADAS, TEMPORADA_POR_DEFECTO, cargarTemporada, equiposDe, esTemporada } from "@/lib/estadisticas/datos";

export const metadata: Metadata = {
  title: "Plantilla · Maccabis",
  description: "La plantilla de Maccabis temporada a temporada: partidos, puntos, medias, porcentajes de tiro y valoración de cada jugador.",
  alternates: { canonical: "/club" },
};

// Club › Plantilla (bloque 6; antes /plantilla, que redirige aquí con 308). D175: la comparten «/club», ya hecha, y
// /club/con-parametros, que lee ?t=. Ranking de la plantilla de una temporada a 4 columnas, con «Más columnas» y enlace a
// la ficha de cada jugador. La tabla completa está también en Liga › Temporadas › Jugadores.
export default async function PlantillaVista({ t }: { t?: string }) {
  const id = t && esTemporada(t) ? t : TEMPORADA_POR_DEFECTO;
  const temporada = (await cargarTemporada(id))!;
  const M = metricasDe(temporada.metrics);
  const jugadores = temporada.players.map((p) => ({
    person_id: p.person_id, nombre: p.nombre, display: p.display, dorsales: p.dorsales, equipos: p.equipos, conv: p.conv, pj: p.pj,
    min_tot: p.min_tot, tot: p.tot, avg: p.avg, tl_pct: p.tl_pct, p2_pct: p.p2_pct, p3_pct: p.p3_pct, pm_total: p.pm_total, ppm: p.ppm,
  }));
  return (
    <>
      <JugadoresPestana key={id} jugadores={jugadores} M={M} multiEquipo={equiposDe(temporada).length > 1} temporada={id} compacta
        selector={<SelectorTemporadaRuta ruta="/club" temporada={id} temporadas={TEMPORADAS.map((s) => ({ id: s.id, label: s.label }))} />} />
      <div className="e-fuente">{(temporada.fuente || "Fuente: actas y hojas de estadistica oficiales") + " · temporada " + (temporada.label || temporada.season)}</div>
    </>
  );
}
