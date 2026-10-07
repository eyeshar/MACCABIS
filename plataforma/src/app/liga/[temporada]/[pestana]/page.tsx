import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import AsistenciaPestana from "@/components/liga/Asistencia";
import CuartosPestana from "@/components/liga/Cuartos";
import EquipoPestana from "@/components/liga/Equipo";
import JugadoresPestana from "@/components/liga/Jugadores";
import MdaPestana from "@/components/liga/Mda";
import RankingsPestana from "@/components/liga/Rankings";
import { metricasDe } from "@/lib/estadisticas/calculo";
import { PESTANAS, TEMPORADA_POR_DEFECTO, TEXTO_PESTANA, cargarTemporada, equiposDe, pestanasDe, type Pestana } from "@/lib/estadisticas/datos";

export async function generateMetadata({ params }: { params: Promise<{ temporada: string; pestana: string }> }): Promise<Metadata> {
  const { temporada, pestana } = await params;
  const t = await cargarTemporada(temporada);
  if (!t || !(PESTANAS as readonly string[]).includes(pestana)) return {};
  return {
    title: `${TEXTO_PESTANA[pestana as Pestana]} ${t.label.replace(/ /g, "")} · Maccabis`,
    description: `Estadísticas de Maccabis, temporada ${t.label}: ${TEXTO_PESTANA[pestana as Pestana].toLowerCase()}.`,
    alternates: { canonical: `/liga/${temporada}/${pestana}` },
  };
}

// Una pestaña de estadísticas de una temporada. Los datos son los de data/season_<t>.json (copiados por npm run datos:sync);
// a la pantalla solo llega lo que esa pestaña pinta (sin los partidos de cada jugador, que son de la ficha).
export default async function PestanaTemporada({ params }: { params: Promise<{ temporada: string; pestana: string }> }) {
  const { temporada, pestana } = await params;
  const t = await cargarTemporada(temporada);
  if (!t && /^[0-9]{4}-[0-9]{2}$/.test(temporada)) redirect(`/liga/${TEMPORADA_POR_DEFECTO}/equipo`);
  if (!t) notFound();
  if (!(PESTANAS as readonly string[]).includes(pestana)) notFound();
  // Una pestaña que esa temporada no tiene (p. ej. Por cuartos en 2013/14) lleva a Equipo, como la web anterior.
  if (!pestanasDe(t).includes(pestana as Pestana)) redirect(`/liga/${temporada}/equipo`);

  const M = metricasDe(t.metrics);
  const equipos = equiposDe(t);
  const multi = equipos.length > 1;
  // Solo los campos que pintan Jugadores y Rankings (sin partidos por jugador ni asistencia).
  const jugadores = t.players.map((p) => ({
    person_id: p.person_id, nombre: p.nombre, display: p.display, dorsales: p.dorsales, equipos: p.equipos, conv: p.conv, pj: p.pj,
    min_tot: p.min_tot, tot: p.tot, avg: p.avg, tl_pct: p.tl_pct, p2_pct: p.p2_pct, p3_pct: p.p3_pct, pm_total: p.pm_total, ppm: p.ppm,
  }));

  const contenido = (() => {
    switch (pestana as Pestana) {
      case "equipo": return <EquipoPestana key={temporada} partidos={t.partidos} box={t.box} M={M} equipos={equipos} />;
      case "jugadores": return <JugadoresPestana key={temporada} jugadores={jugadores} M={M} multiEquipo={multi} />;
      case "rankings": return <RankingsPestana key={temporada} jugadores={jugadores} M={M} multiEquipo={multi} />;
      case "cuartos": return <CuartosPestana key={temporada} qstats={t.qstats!} multiEquipo={multi} />;
      case "asistencia": return <AsistenciaPestana key={temporada} jugadores={t.players.map((p) => ({ person_id: p.person_id, nombre: p.nombre, display: p.display, asist_part: p.asist_part, asist_entr: p.asist_entr }))} />;
      case "mda": return <MdaPestana key={temporada} resumen={t.mda_resumen!} />;
    }
  })();

  return (
    <>
      {contenido}
      <div className="e-fuente" data-testid="pie-fuente">{(t.fuente || "Fuente: actas y hojas de estadistica oficiales") + " · temporada " + (t.label || t.season)}</div>
    </>
  );
}
